/**
 * ============================================================
 * 原石航路 Studio
 * VoiceProvider — 声の受け渡し
 *
 * マイクの入切だけを受け持つ。
 *
 * 在室や発言は部屋の画面が持っているので、
 * ここでは触らない。二重に持つと食い違う。
 *
 * 通り道は部屋の画面から渡してもらう。
 * 声そのものは端末どうしで直につなぐ（P2P）。
 * ============================================================
 */

"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { VoiceRoom } from "@/lib/room/voice";
import type { VoiceState } from "@/lib/room/voice";

interface VoiceContext {
    voice: VoiceState;

    /**
     * 声を使う支度をする。
     *
     * 部屋の画面が、自分の id と通り道を渡す。
     * 通り道が無ければ（同じ端末だけの版）何もしない。
     */
    setup: (selfId: string, channel: RealtimeChannel | null) => void;

    /** 部屋から出るときに呼ぶ */
    teardown: () => void;

    toggleMic: () => Promise<void>;
}

const IDLE: VoiceState = {
    isMicOn: false,
    isReady: false,
    members: [],
    error: "",
};

const Context = createContext<VoiceContext | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
    const [voice, setVoice] = useState<VoiceState>(IDLE);
    const roomRef = useRef<VoiceRoom | null>(null);

    const setup = useCallback(
        (selfId: string, channel: RealtimeChannel | null) => {
            /* すでに同じ相手なら作り直さない */
            if (roomRef.current) return;
            if (!channel) return;

            const room = new VoiceRoom(selfId, channel);
            roomRef.current = room;

            room.subscribe(setVoice);
        },
        [],
    );

    const teardown = useCallback(() => {
        roomRef.current?.dispose();
        roomRef.current = null;
        setVoice(IDLE);
    }, []);

    const toggleMic = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;

        /* 入っていれば切る。切れていれば入れる */
        if (voice.isMicOn) {
            room.stop();
            return;
        }

        await room.start();
    }, [voice.isMicOn]);

    /* 画面を離れるときは切る */
    useEffect(() => {
        return () => {
            roomRef.current?.dispose();
            roomRef.current = null;
        };
    }, []);

    const value = useMemo<VoiceContext>(
        () => ({ voice, setup, teardown, toggleMic }),
        [voice, setup, teardown, toggleMic],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRoomVoice(): VoiceContext | null {
    return useContext(Context);
}
