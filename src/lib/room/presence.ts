/**
 * ============================================================
 * 原石航路 Studio
 * 執筆室の同期
 *
 * 2 つの実装がある。どちらを使うかは createPresence が決める。
 *
 *   Supabase に繋いでいる  … RealtimePresence（別の端末とも繋がる）
 *   繋いでいない          … LocalPresence（同じブラウザの別タブだけ）
 *
 * 画面側は subscribe / move / setStatus / send しか見ていないので、
 * どちらが動いていても書き方は変わらない。
 *
 * 【LocalPresence を残す理由】
 * 環境変数を設定せずに動かしたときに、
 * 部屋が真っ白になるのではなく、ひとりぶんは動いてほしい。
 * 作りながら確かめるときにも、繋がなくて済むぶん速い。
 *
 * 【声について】
 * 部屋主のマイクは WebRTC が要るため、まだ入れていない。
 * 設定だけ持たせて、繋いだときに有効になる形にしてある。
 * ============================================================
 */

import { hasSupabase } from "@/config/env.client";
import { RealtimePresence } from "@/lib/room/realtime-presence";
import type { MemberStatus, RoomMember, RoomMessage } from "@/types";
import { MEMBER_TIMEOUT_MS } from "@/types";

export interface RoomState {
    members: RoomMember[];
    messages: RoomMessage[];
    /**
     * 部屋が閉じられたか。
     *
     * 立てた人が部屋ごと閉じたとき、
     * 中にいる人の画面にも伝える必要がある。
     * 伝えないと、消えた部屋の中を歩き続けることになる。
     */
    isClosed: boolean;
}

export interface Presence {
    /** 別の端末とも繋がるか。画面に注意書きを出すために使う */
    readonly isNetworked: boolean;

    join(member: RoomMember): void;
    leave(): void;
    move(x: number, y: number): void;
    setStatus(status: MemberStatus): void;
    setColor(colorId: number): void;
    announceClosed(): void;
    addWrittenChars(count: number): void;
    send(message: Omit<RoomMessage, "id" | "created_at">): void;
    /** 状態が変わるたびに呼ばれる。戻り値で購読をやめる */
    subscribe(handler: (state: RoomState) => void): () => void;
    dispose(): void;
}

/**
 * ============================================================
 * BroadcastChannel 版
 * ============================================================
 */

type Packet =
    | { type: "sync"; members: RoomMember[]; messages: RoomMessage[] }
    | { type: "hello"; member: RoomMember }
    | { type: "update"; member: RoomMember }
    | { type: "bye"; memberId: string }
    | { type: "message"; message: RoomMessage }
    | { type: "ask" }
    | { type: "closed" };

/** 生きている合図を送る間隔 */
const HEARTBEAT_MS = 15 * 1000;
/** 残す発言の数 */
const MESSAGE_LIMIT = 60;

export class LocalPresence implements Presence {
    readonly isNetworked = false;

    private channel: BroadcastChannel | null = null;
    private timer: number | null = null;
    private handlers = new Set<(state: RoomState) => void>();
    private members = new Map<string, RoomMember>();
    private messages: RoomMessage[] = [];
    private self: RoomMember | null = null;
    /** 立てた人が部屋を閉じたか */
    private isClosed = false;

    constructor(private roomId: string) {
        if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

        this.channel = new BroadcastChannel(`genseki:room:${roomId}`);
        this.channel.onmessage = (event: MessageEvent<Packet>) => {
            this.receive(event.data);
        };
    }

    join(member: RoomMember): void {
        this.self = member;
        this.members.set(member.id, member);

        // すでに居る人に名乗り、いまの状態を教えてもらう
        this.post({ type: "hello", member });
        this.post({ type: "ask" });

        this.timer = window.setInterval(() => {
            if (!this.self) return;
            this.self = { ...this.self, last_seen: new Date().toISOString() };
            this.members.set(this.self.id, this.self);
            this.post({ type: "update", member: this.self });
            this.prune();
            this.emit();
        }, HEARTBEAT_MS);

        this.emit();
    }

    leave(): void {
        if (!this.self) return;
        this.post({ type: "bye", memberId: this.self.id });
        this.members.delete(this.self.id);
        this.emit();
    }

    move(x: number, y: number): void {
        this.patchSelf({ x, y });
    }

    setStatus(status: MemberStatus): void {
        this.patchSelf({ status });
    }

    /** テーマカラーを変える。部屋にいる全員の画面に反映される */
    setColor(colorId: number): void {
        this.patchSelf({ color_id: colorId });
    }

    /**
     * 部屋を閉じたことを伝える。
     *
     * 自分の画面には出さない。閉じた本人はもう出ていくので、
     * 「閉じられました」と知らせても意味がない。
     */
    announceClosed(): void {
        this.post({ type: "closed" });
    }

    addWrittenChars(count: number): void {
        if (!this.self) return;
        this.patchSelf({ written_chars: Math.max(0, count) });
    }

    send(message: Omit<RoomMessage, "id" | "created_at">): void {
        const full: RoomMessage = {
            ...message,
            id: `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            created_at: new Date().toISOString(),
        };
        this.pushMessage(full);
        this.post({ type: "message", message: full });
        this.emit();
    }

    subscribe(handler: (state: RoomState) => void): () => void {
        this.handlers.add(handler);
        handler(this.snapshot());
        return () => this.handlers.delete(handler);
    }

    dispose(): void {
        this.leave();
        if (this.timer !== null) window.clearInterval(this.timer);
        this.channel?.close();
        this.handlers.clear();
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
        this.post({ type: "update", member: this.self });
        this.emit();
    }

    private receive(packet: Packet): void {
        if (packet.type === "hello" || packet.type === "update") {
            this.members.set(packet.member.id, packet.member);
        } else if (packet.type === "bye") {
            this.members.delete(packet.memberId);
        } else if (packet.type === "message") {
            this.pushMessage(packet.message);
        } else if (packet.type === "ask") {
            // 新しく来た人へ、いまの状態を送り返す
            this.post({
                type: "sync",
                members: Array.from(this.members.values()),
                messages: this.messages,
            });
            return;
        } else if (packet.type === "sync") {
            for (const member of packet.members) this.members.set(member.id, member);
            for (const message of packet.messages) this.pushMessage(message);
        } else if (packet.type === "closed") {
            this.isClosed = true;
        }

        this.prune();
        this.emit();
    }

    private pushMessage(message: RoomMessage): void {
        if (this.messages.some((row) => row.id === message.id)) return;
        this.messages = [...this.messages, message].slice(-MESSAGE_LIMIT);
    }

    /** 応答が途絶えた人を消す。タブを閉じただけのときに残り続けないように */
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

    private post(packet: Packet): void {
        this.channel?.postMessage(packet);
    }
}

/**
 * どちらの実装で繋ぐかを決める。
 *
 * Supabase の設定があれば、別の端末とも繋がるほうを使う。
 * 無ければ同じブラウザの中だけで動かす。
 *
 * 読み込みを遅らせているのは、Supabase を使わない人の
 * 手元に Realtime の一式を落とさないため。
 */
export function createPresence(roomId: string): Presence {
    if (!hasSupabase()) return new LocalPresence(roomId);
    return new RealtimePresence(roomId);
}

/**
 * ============================================================
 * 自分の名前と id
 *
 * ログインがないので、端末の中だけで持つ。
 * ============================================================
 */

const IDENTITY_KEY = "genseki:room:identity";

export interface Identity {
    id: string;
    name: string;
    /** 選んだテーマカラー。選んでいなければ未指定 */
    colorId?: number;
}

export function loadIdentity(): Identity {
    if (typeof window === "undefined") return { id: "anon", name: "名無し" };

    try {
        const raw = window.localStorage.getItem(IDENTITY_KEY);
        if (raw) return JSON.parse(raw) as Identity;
    } catch {
        // 壊れていたら作り直す
    }

    const identity: Identity = {
        id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: "名無しの書き手",
    };
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    return identity;
}

export function saveIdentity(identity: Identity): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}
