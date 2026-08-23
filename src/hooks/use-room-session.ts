/**
 * ============================================================
 * 原石航路 Studio
 * useRoomSession — いま入っている部屋
 *
 * 部屋の画面を離れても、入室中であることを覚えておく。
 * 執筆に移ったとたん切れてしまうと、
 * 「一緒に書いている」という前提そのものが崩れる。
 *
 * 覚えるのは部屋の id と、声を入れているかどうかだけ。
 * 実際の繋がりは部屋の画面が持つ。
 *
 * sessionStorage に置く。
 * タブを閉じれば消えるので、退室し忘れが残らない。
 * localStorage だと、次に開いたときも入室中のままになる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { peekVoiceRoom, releaseVoiceRoom } from "@/lib/room/voice-session";

const KEY = "genseki:room-session";

export interface RoomSession {
    roomId: string;
}

/** 別のタブや別の画面へ知らせる */
const EVENT = "genseki:room-session-changed";

function read(): RoomSession | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<RoomSession>;
        if (typeof parsed.roomId !== "string") return null;
        return { roomId: parsed.roomId };
    } catch {
        return null;
    }
}

function write(session: RoomSession | null): void {
    if (typeof window === "undefined") return;
    if (session) window.sessionStorage.setItem(KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
}

export function useRoomSession() {
    const [session, setSession] = useState<RoomSession | null>(null);

    useEffect(() => {
        setSession(read());

        function sync() {
            setSession(read());
        }
        window.addEventListener(EVENT, sync);
        // 別のタブでの変更も拾う
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, []);

    const enter = useCallback((roomId: string) => {
        const current = read();
        /*
         * 覚えるのは部屋 id だけ。
         *
         * マイクの入切は繋がりの側が持つ。
         * 両方で持つと必ず食い違う。
         */
        if (current?.roomId === roomId) return;
        write({ roomId });
    }, []);

    const leave = useCallback(() => {
        /*
         * 声の繋がりも切る。
         *
         * 帯の「退室」からも出られるので、
         * ここで切らないとマイクが掴まれたまま残る。
         */
        releaseVoiceRoom();
        write(null);
    }, []);

    /**
     * マイクの入り切り。
     *
     * 状態は繋がりの側だけが持つ。
     * ここで覚えると、繋がりの実際と食い違い、
     * ページを移るたびに入切がずれて見える。
     */
    const toggleMic = useCallback(() => {
        void peekVoiceRoom()?.toggle();
    }, []);

    return { session, enter, leave, toggleMic };
}
