/**
 * ============================================================
 * 原石航路 Studio
 * Supabase Realtime 版の在室
 *
 * 別の端末の人が見えるようになる。
 *
 * 使う仕組みは 2 つ。
 *   presence  … 誰がいるか。切れたら自動で消える
 *   broadcast … 発言。流すだけで残さない
 *
 * 発言を表に残さないのは、書く場の会話は
 * その場限りのもので、あとから読み返すものではないため。
 * 残すなら別のテーブルを建てる話になる。
 * ============================================================
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { MemberStatus, RoomMember, RoomMessage } from "@/types";

import type { Presence, RoomState } from "@/lib/room/presence-types";

/** 発言はこの数だけ手元に残す */
const MESSAGE_LIMIT = 60;

export class SupabasePresence implements Presence {
    readonly isNetworked = true;

    /** 部屋主が閉じたか */
    private isClosed = false;

    private channel: RealtimeChannel | null = null;

    /** 声の合図に使い回す。繋がる前は null */
    get voiceChannel(): RealtimeChannel | null {
        return this.channel;
    }

    private handlers = new Set<(state: RoomState) => void>();

    /** 部屋の設定が変わったときに呼ぶ */
    private roomHandlers = new Set<() => void>();

    private me: RoomMember | null = null;
    private members: RoomMember[] = [];
    private messages: RoomMessage[] = [];

    /** 送るのを間引くための目印 */
    private lastSentAt = 0;
    private pending: number | null = null;
    /** 抜ける途中か。ここから先は送らない */
    private isLeaving = false;

    constructor(private roomId: string) {}

    join(member: RoomMember): void {
        this.me = member;

        const supabase = createClient();

        this.channel = supabase.channel(`room:${this.roomId}`, {
            config: {
                // 自分の状態を presence として置く
                presence: { key: member.id },
                // 自分の発言も受け取る。送った直後に画面へ出したい
                broadcast: { self: true },
            },
        });

        this.channel
            .on("presence", { event: "sync" }, () => {
                this.readMembers();
            })
            .on("broadcast", { event: "closed" }, () => {
                /* 部屋主が閉じた。中にいる人の画面に伝える */
                this.isClosed = true;
                this.emit();
            })
            .on("broadcast", { event: "room" }, () => {
                /*
                 * 部屋の設定が変わった。
                 *
                 * 話してよい人を足しても、相手の画面には何も届かない。
                 * 自分で見に行かないと、押しても変わらないように見える。
                 */
                this.roomHandlers.forEach((handler) => handler());
            })
            .on("broadcast", { event: "message" }, ({ payload }) => {
                this.pushMessage(payload as RoomMessage);
            })
            .subscribe(async (status) => {
                if (status !== "SUBSCRIBED" || !this.me) return;
                await this.channel?.track({ ...this.me });
            });
    }

    leave(): void {
        /*
         * 抜けたことを、残る人へ確実に伝える。
         *
         * untrack を投げっぱなしにして、
         * すぐ後ろで unsubscribe すると届かないことがある。
         * そのとき残る人の画面には、消えた人が残り続ける。
         */
        this.isLeaving = true;
        void this.channel?.untrack();
    }

    move(x: number, y: number): void {
        if (!this.me) return;
        this.me = { ...this.me, x, y };
        this.push();
    }

    setStatus(status: MemberStatus): void {
        if (!this.me) return;
        this.me = { ...this.me, status };
        this.push(true);
    }

    /** 部屋の設定が変わったことを、中にいる人へ伝える */
    announceRoomChanged(): void {
        this.channel?.send({
            type: "broadcast",
            event: "room",
            payload: {},
        });
    }

    /** 部屋の設定が変わったら呼ばれる。戻り値で購読をやめる */
    onRoomChanged(handler: () => void): () => void {
        this.roomHandlers.add(handler);
        return () => this.roomHandlers.delete(handler);
    }

    /** テーマカラーを変える。部屋にいる全員の画面に反映される */
    setColor(colorId: number): void {
        if (!this.me) return;
        this.me = { ...this.me, color_id: colorId };
        this.push(true);
    }

    /**
     * 部屋を閉じたことを伝える。
     *
     * 自分の画面には出さない。閉じた本人はもう出ていくので、
     * 「閉じられました」と知らせても意味がない。
     */
    announceClosed(): void {
        this.channel?.send({
            type: "broadcast",
            event: "closed",
            payload: {},
        });
    }

    addWrittenChars(count: number): void {
        if (!this.me) return;
        this.me = {
            ...this.me,
            written_chars: this.me.written_chars + count,
        };
        this.push();
    }

    send(message: Omit<RoomMessage, "id" | "created_at">): void {
        const full: RoomMessage = {
            ...message,
            id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: new Date().toISOString(),
        };

        void this.channel?.send({
            type: "broadcast",
            event: "message",
            payload: full,
        });
    }

    subscribe(handler: (state: RoomState) => void): () => void {
        this.handlers.add(handler);
        handler(this.snapshot());
        return () => this.handlers.delete(handler);
    }

    dispose(): void {
        if (this.pending !== null) window.clearTimeout(this.pending);

        const channel = this.channel;
        this.channel = null;
        this.handlers.clear();

        /*
         * 抜けたことを伝えてから畳む。
         * すぐ畳むと、残る人に届かないことがある。
         */
        void (async () => {
            try {
                await channel?.untrack();
            } catch {
                // すでに切れていれば何もしなくてよい
            }
            void channel?.unsubscribe();
        })();
    }

    /**
     * ==========================================================
     * 中身
     * ==========================================================
     */

    /**
     * 自分の状態を送る。
     *
     * 歩くたびに送ると、1 秒に何十回も飛ぶ。
     * 間引いて、最後の 1 回は必ず届くようにする。
     */
    private push(immediate = false): void {
        if (this.isLeaving || !this.me) return;

        const now = Date.now();

        if (immediate || now - this.lastSentAt > 200) {
            this.lastSentAt = now;
            void this.channel?.track({ ...this.me });
            return;
        }

        if (this.pending !== null) return;

        this.pending = window.setTimeout(() => {
            this.pending = null;
            this.lastSentAt = Date.now();
            if (this.me) void this.channel?.track({ ...this.me });
        }, 200);
    }

    private readMembers(): void {
        const state = this.channel?.presenceState() ?? {};

        /*
         * 同じ人が複数の端末から入ることがある。
         * その場合は最後の 1 つだけを見る。
         */
        const found: RoomMember[] = [];
        for (const list of Object.values(state)) {
            const last = (list as unknown[])[list.length - 1];
            if (last && typeof last === "object") {
                found.push(last as RoomMember);
            }
        }

        this.members = found.sort((a, b) =>
            (a.joined_at ?? "").localeCompare(b.joined_at ?? ""),
        );
        this.emit();
    }

    private pushMessage(message: RoomMessage): void {
        // 同じものが二度来ることがある
        if (this.messages.some((row) => row.id === message.id)) return;

        this.messages = [...this.messages, message].slice(-MESSAGE_LIMIT);
        this.emit();
    }

    private snapshot(): RoomState {
        return {
            members: this.members,
            messages: this.messages,
            isClosed: this.isClosed,
        };
    }

    private emit(): void {
        const state = this.snapshot();
        this.handlers.forEach((handler) => handler(state));
    }
}
