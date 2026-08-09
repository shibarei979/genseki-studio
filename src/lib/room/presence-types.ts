/**
 * ============================================================
 * 原石航路 Studio
 * 在室の型
 *
 * presence.ts と supabase-presence.ts の両方が使う。
 *
 * どちらか一方に置くと、互いに読み込み合って輪になり、
 * ブラウザで落ちる。型だけを別に出しておく。
 * ============================================================
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import type { MemberStatus, RoomMember, RoomMessage } from "@/types";

export interface RoomState {
    members: RoomMember[];
    messages: RoomMessage[];
    /** 部屋主が閉じたか */
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

    /**
     * 声をつなぐための通り道。
     *
     * 相手を見つける合図のやり取りに使う。
     * 声そのものは通らない。
     *
     * 同じ端末の別タブだけで動く版には無いので、
     * 持っていなくてよい。
     */
    readonly voiceChannel?: RealtimeChannel | null;
}
