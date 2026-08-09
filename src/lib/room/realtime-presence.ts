/**
 * ============================================================
 * 原石航路 Studio
 * 執筆室の同期 — Supabase 版
 *
 * 同じ部屋にいる人どうしで、次のものを共有する。
 *
 *   参加者一覧・立ち位置・状態・色  … room_members
 *   チャット                      … room_messages
 *   部屋が閉じられたこと           … writing_rooms の削除
 *
 * 部屋そのもの（名前・説明・人数・公開範囲・発言設定・マイク設定）は
 * writing_rooms に入っていて、Repository が読み書きする。
 * こちらは「部屋の中で起きていること」だけを受け持つ。
 *
 * ------------------------------------------------------------
 * なぜ表に書くか（Realtime の presence を使わない理由）
 *
 * presence は繋がっている間だけの情報で、閉じると消える。
 * 再読み込みすると立ち位置が初期化され、
 * 後から入った人には過去のチャットが 1 行も見えない。
 *
 * 表に書けば、入り直しても続きから始められる。
 * 変更は postgres_changes で全員へ届くので、
 * 伝わる速さは presence とほとんど変わらない。
 *
 * ------------------------------------------------------------
 * 立ち位置の書き込みについて
 *
 * 歩くたびに書くと、20 人が動き回れば毎秒何十件になる。
 * 間引いて、最後の 1 歩は必ず書く。
 *
 * 間引くだけだと、歩き終わった場所が書かれないまま終わり、
 * 他の人の画面では途中の位置に立ち続けることになる。
 * ============================================================
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import type { Presence, RoomState } from "@/lib/room/presence";
import { createClient } from "@/lib/supabase/client";
import type { MemberStatus, RoomMember, RoomMessage } from "@/types";
import { MEMBER_TIMEOUT_MS } from "@/types";

/** 残す発言の数。読み込むときもこの数まで */
const MESSAGE_LIMIT = 60;

/** 立ち位置を書き込む間隔の下限 */
const MOVE_WRITE_MS = 400;

/** 生きている合図を送る間隔 */
const HEARTBEAT_MS = 15 * 1000;

interface MemberRow {
    room_id: string;
    member_id: string;
    display_name: string;
    avatar_seed: string;
    color_id: number | null;
    status: string;
    x: number;
    y: number;
    written_chars: number;
    joined_at: string;
    last_seen: string;
}

interface MessageRow {
    id: string;
    room_id: string;
    member_id: string;
    member_name: string;
    kind: string;
    body: string;
    created_at: string;
}

function toMember(row: MemberRow): RoomMember {
    return {
        id: row.member_id,
        room_id: row.room_id,
        display_name: row.display_name,
        avatar_seed: row.avatar_seed,
        color_id: row.color_id ?? undefined,
        status: row.status as MemberStatus,
        x: row.x,
        y: row.y,
        written_chars: row.written_chars,
        joined_at: row.joined_at,
        last_seen: row.last_seen,
    };
}

function toMessage(row: MessageRow): RoomMessage {
    return {
        id: row.id,
        room_id: row.room_id,
        member_id: row.member_id,
        member_name: row.member_name,
        kind: row.kind as RoomMessage["kind"],
        body: row.body,
        created_at: row.created_at,
    };
}

export class RealtimePresence implements Presence {
    readonly isNetworked = true;

    private channel: RealtimeChannel | null = null;
    private handlers = new Set<(state: RoomState) => void>();
    private members = new Map<string, RoomMember>();
    private messages: RoomMessage[] = [];
    private self: RoomMember | null = null;
    private isClosed = false;
    /** 購読が始まったか。始まる前に送っても届かない */
    private isReady = false;
    /*
     * どこで止まっているか。
     *
     * 表が無い・権限が足りない・配信が入っていない、のどれでも
     * 画面上は「相手が見えない」だけになる。
     * 理由をそのまま持っておいて、画面に出す。
     */
    private link: { phase: "idle" | "connecting" | "live" | "error"; detail: string } =
        { phase: "idle", detail: "" };
    /** 声と画面の合図を受け取る人たち */
    private mediaHandlers = new Set<(payload: unknown) => void>();

    private heartbeat: number | null = null;
    private moveTimer: number | null = null;
    private lastMoveAt = 0;

    constructor(private roomId: string) {}

    join(member: RoomMember): void {
        this.self = member;
        this.members.set(member.id, member);
        this.emit();

        void this.writeSelf(member);
        void this.loadAll();
        this.listen();

        /*
         * 定期的に last_seen を更新する。
         * ブラウザを強制終了された場合、退室の書き込みが走らない。
         * 合図が途絶えた人は、読むときに一覧から外す。
         */
        this.heartbeat = window.setInterval(() => {
            if (!this.self) return;
            void this.writeSelf({ ...this.self, last_seen: new Date().toISOString() });
            this.prune();
            this.emit();
        }, HEARTBEAT_MS);
    }

    leave(): void {
        if (!this.self) return;

        const selfId = this.self.id;
        this.members.delete(selfId);
        this.emit();

        void createClient()
            .from("room_members")
            .delete()
            .eq("room_id", this.roomId)
            .eq("member_id", selfId);
    }

    move(x: number, y: number): void {
        if (!this.self) return;

        this.self = { ...this.self, x, y, last_seen: new Date().toISOString() };
        this.members.set(this.self.id, this.self);
        this.emit();

        const now = Date.now();
        if (this.moveTimer !== null) window.clearTimeout(this.moveTimer);

        if (now - this.lastMoveAt >= MOVE_WRITE_MS) {
            this.lastMoveAt = now;
            void this.writeSelf(this.self);
            return;
        }

        /* 最後の 1 歩を必ず書く */
        this.moveTimer = window.setTimeout(() => {
            this.lastMoveAt = Date.now();
            if (this.self) void this.writeSelf(this.self);
        }, MOVE_WRITE_MS);
    }

    setStatus(status: MemberStatus): void {
        this.patchSelf({ status });
    }

    setColor(colorId: number): void {
        this.patchSelf({ color_id: colorId });
    }

    addWrittenChars(count: number): void {
        this.patchSelf({ written_chars: Math.max(0, count) });
    }

    /**
     * 部屋を閉じたことを伝える。
     *
     * 部屋そのものが消えるので、writing_rooms の削除が
     * postgres_changes で全員に届く。
     * こちらは自分の画面に印を立てるだけ。
     */
    announceClosed(): void {
        this.isClosed = true;
        this.emit();
    }

    linkState(): { phase: "idle" | "connecting" | "live" | "error"; detail: string } {
        return this.link;
    }

    /**
     * 声と画面の合図を送る。
     *
     * 購読が始まる前は捨てる。送っても誰にも届かない。
     * 相手が増えたときに張り直すので、取りこぼしても支障はない。
     */
    sendMedia(payload: unknown): void {
        if (!this.isReady || !this.channel) return;
        void this.channel.send({
            type: "broadcast",
            event: "media",
            payload,
        });
    }

    /**
     * 声と画面の合図を受け取る。
     *
     * 受け取り口はここで束ねる。
     * 呼ぶ側にチャンネルを渡すと、購読が始まったあとに
     * listener を足すことになって落ちる。
     */
    onMedia(handler: (payload: unknown) => void): () => void {
        this.mediaHandlers.add(handler);
        return () => this.mediaHandlers.delete(handler);
    }

    send(message: Omit<RoomMessage, "id" | "created_at">): void {
        /*
         * id は表側で振る。
         * こちらで作ると、届いた行と重複して 2 度出る。
         *
         * 失敗を握りつぶさない。
         * 書けていないのに画面上は何も起きないと、
         * 「送ったのに相手に見えない」の理由が分からなくなる。
         */
        void createClient()
            .from("room_messages")
            .insert({
                room_id: this.roomId,
                member_id: message.member_id,
                member_name: message.member_name,
                kind: message.kind,
                body: message.body,
            })
            .then(({ error }) => {
                if (!error) return;
                this.link = {
                    phase: "error",
                    detail: `発言を書けませんでした：${error.message}`,
                };
                this.emit();
            });
    }

    subscribe(handler: (state: RoomState) => void): () => void {
        this.handlers.add(handler);
        handler(this.snapshot());
        return () => this.handlers.delete(handler);
    }

    dispose(): void {
        this.leave();

        if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
        if (this.moveTimer !== null) window.clearTimeout(this.moveTimer);

        /*
         * 通り道を閉じる。
         *
         * 閉じずに残すと、次に同じ部屋へ入ったとき
         * 同じ名前のチャンネルが二重になり、
         * 発言が 2 度届いたり、購読済みのものに
         * listener を足そうとして落ちたりする。
         */
        if (this.channel) void createClient().removeChannel(this.channel);
        this.channel = null;
        this.isReady = false;
        this.handlers.clear();
        this.mediaHandlers.clear();
    }

    /**
     * ==========================================================
     * 内部
     * ==========================================================
     */

    private patchSelf(patch: Partial<RoomMember>): void {
        if (!this.self) return;

        this.self = { ...this.self, ...patch, last_seen: new Date().toISOString() };
        this.members.set(this.self.id, this.self);
        this.emit();

        void this.writeSelf(this.self);
    }

    /** 自分の行を書く。無ければ作り、あれば上書きする */
    private async writeSelf(member: RoomMember): Promise<void> {
        const { error } = await createClient()
            .from("room_members")
            .upsert(
                {
                    room_id: this.roomId,
                    member_id: member.id,
                    display_name: member.display_name,
                    avatar_seed: member.avatar_seed,
                    color_id: member.color_id ?? null,
                    status: member.status,
                    x: member.x,
                    y: member.y,
                    written_chars: member.written_chars,
                    joined_at: member.joined_at,
                    last_seen: member.last_seen,
                },
                { onConflict: "room_id,member_id" },
            );

        /*
         * 書けなかったら黙って落とさず、画面に出せるところまで持っていく。
         * ここで throw すると、歩くたびに例外が飛ぶ。
         */
        if (!error) return;

        /*
         * 画面へ出す。
         * コンソールにだけ書くと、開いていない人には
         * 「入ったのに相手から見えない」としか分からない。
         */
        this.link = {
            phase: "error",
            detail: `在室を書けませんでした：${error.message}`,
        };
        this.emit();
    }

    /** 入ったときに、いまの全員と直近のチャットを読む */
    private async loadAll(): Promise<void> {
        const supabase = createClient();

        const [members, messages] = await Promise.all([
            supabase.from("room_members").select("*").eq("room_id", this.roomId),
            supabase
                .from("room_messages")
                .select("*")
                .eq("room_id", this.roomId)
                .order("created_at", { ascending: false })
                .limit(MESSAGE_LIMIT),
        ]);

        /*
         * 読めなかったら、その理由を持っておく。
         *
         * 表が無い・権限が足りないときはここで分かる。
         * 空で返ってきたのか、そもそも読めなかったのかは、
         * 画面上ではどちらも「誰もいない」に見える。
         */
        const failed = members.error ?? messages.error;
        if (failed) {
            this.link = {
                phase: "error",
                detail: `部屋の中身を読めませんでした：${failed.message}`,
            };
        }

        for (const row of (members.data ?? []) as MemberRow[]) {
            if (row.member_id === this.self?.id) continue;
            this.members.set(row.member_id, toMember(row));
        }

        /* 読むときは新しい順、出すときは古い順 */
        this.messages = ((messages.data ?? []) as MessageRow[])
            .map(toMessage)
            .reverse();

        this.prune();
        this.emit();
    }

    /** 表の変更を受け取る */
    private listen(): void {
        const supabase = createClient();

        /*
         * 同じ名前の通り道が残っていたら、先に閉じる。
         *
         * channel(名前) は、同じ名前のものがあればそれを返す。
         * 購読済みのものに .on() を足すと落ちる。
         */
        for (const opened of supabase.getChannels()) {
            if (opened.topic === `realtime:room:${this.roomId}`) {
                void supabase.removeChannel(opened);
            }
        }

        this.channel = supabase
            .channel(`room:${this.roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "room_members",
                    filter: `room_id=eq.${this.roomId}`,
                },
                (payload) => {
                    if (payload.eventType === "DELETE") {
                        const gone = payload.old as Partial<MemberRow>;
                        if (gone.member_id) this.members.delete(gone.member_id);
                    } else {
                        const row = payload.new as MemberRow;
                        /*
                         * 自分の行は書き戻さない。
                         * 往復のぶん遅れて届くので、
                         * 歩いている最中に前の位置へ引き戻される。
                         */
                        if (row.member_id !== this.self?.id) {
                            this.members.set(row.member_id, toMember(row));
                        }
                    }
                    this.emit();
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "room_messages",
                    filter: `room_id=eq.${this.roomId}`,
                },
                (payload) => {
                    this.pushMessage(toMessage(payload.new as MessageRow));
                    this.emit();
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "writing_rooms",
                    filter: `id=eq.${this.roomId}`,
                },
                () => {
                    this.isClosed = true;
                    this.emit();
                },
            )
            /*
             * 声と画面の合図。
             *
             * 購読を始める前にここで登録しておく。
             * 使う側（RoomMedia）が後から足すと、
             * 「subscribe のあとに on は足せない」で落ちる。
             */
            .on("broadcast", { event: "media" }, ({ payload }) => {
                for (const handler of Array.from(this.mediaHandlers)) {
                    handler(payload);
                }
            })
            .subscribe((status, error) => {
                this.isReady = status === "SUBSCRIBED";

                if (status === "SUBSCRIBED") {
                    this.link = { phase: "live", detail: "" };
                } else if (status === "CHANNEL_ERROR") {
                    /*
                     * ほとんどの場合、表が配信に入っていない。
                     * 005_room_sharing.sql の publication のところ。
                     */
                    this.link = {
                        phase: "error",
                        detail:
                            error?.message ??
                            "受け取りを開けませんでした。room_members と room_messages が Realtime に入っているか確かめてください。",
                    };
                } else if (status === "TIMED_OUT") {
                    this.link = {
                        phase: "error",
                        detail: "受け取りが時間切れになりました。",
                    };
                } else {
                    this.link = { phase: "connecting", detail: "" };
                }

                this.emit();
            });
    }

    private pushMessage(message: RoomMessage): void {
        if (this.messages.some((row) => row.id === message.id)) return;
        this.messages = [...this.messages, message].slice(-MESSAGE_LIMIT);
    }

    /**
     * 合図が途絶えた人を外す。
     *
     * 表からは消さない。消してよいのは本人だけで、
     * 他の端末から消しにいくと、通信が一瞬切れた人まで追い出す。
     * 見せないだけにする。
     */
    private prune(): void {
        const now = Date.now();
        for (const [id, member] of Array.from(this.members.entries())) {
            if (id === this.self?.id) continue;
            if (now - new Date(member.last_seen).getTime() > MEMBER_TIMEOUT_MS) {
                this.members.delete(id);
            }
        }
    }

    private snapshot(): RoomState {
        return {
            members: Array.from(this.members.values()).sort((a, b) =>
                a.joined_at.localeCompare(b.joined_at),
            ),
            messages: this.messages,
            isClosed: this.isClosed,
        };
    }

    private emit(): void {
        const state = this.snapshot();
        for (const handler of Array.from(this.handlers)) handler(state);
    }
}
