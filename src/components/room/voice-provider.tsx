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
    setup: (
        roomId: string,
        selfId: string,
        channel: RealtimeChannel | null,
    ) => void;

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

    /* いま声を繋いでいる部屋。変わったら繋ぎ直す */
    const roomIdRef = useRef<string | null>(null);

    const setup = useCallback(
        (roomId: string, selfId: string, channel: RealtimeChannel | null) => {
            if (!channel) return;

            /* 同じ部屋なら、そのまま。資料へ行って戻っても切れない */
            if (roomRef.current && roomIdRef.current === roomId) return;

            /* 別の部屋に入った。前の繋ぎは解く */
            roomRef.current?.dispose();

            const room = new VoiceRoom(selfId, roomId);
            roomRef.current = room;
            roomIdRef.current = roomId;

            room.subscribe(setVoice);
        },
        [],
    );

    const teardown = useCallback(() => {
        roomRef.current?.dispose();
        roomRef.current = null;
        roomIdRef.current = null;
        setVoice(IDLE);
    }, []);

    const toggleMic = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;

        /*
         * 音の流れだけを止める。繋ぎは解かない。
         *
         * 以前はここで繋ぎごと切っていた。
         * 押すたびに数秒無音になり、相手からは
         * 出たり入ったりを繰り返しているように見えていた。
         * 許可の問い合わせも毎回走っていた。
         */
        await room.toggle();
    }, []);

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
