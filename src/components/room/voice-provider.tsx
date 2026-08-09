/**
 * ============================================================
 * 原石航路 Studio
 * VoiceProvider — 声を画面から切り離して持つ
 *
 * 部屋の画面が消えても、声は繋がったままにする。
 *
 * 喋りながら書く、という使い方が本筋なので、
 * 執筆画面へ移った瞬間に切れては意味がない。
 *
 * ここが在室と声の両方を持ち、
 * どの画面からでも同じものを見られるようにする。
 * ============================================================
 */

"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useRoomSession } from "@/hooks/use-room-session";
import { getRepository } from "@/lib/repository";
import { createPresence, loadIdentity } from "@/lib/room/presence";
import type { Presence, RoomState } from "@/lib/room/presence";
import type { VoiceState } from "@/lib/room/voice";
import { VoiceRoom } from "@/lib/room/voice";
import type { MemberStatus, RoomMember, RoomMessage, WritingRoom } from "@/types";

interface VoiceContext {
    /** いま入っている部屋 */
    room: WritingRoom | null;
    /** 在室と発言 */
    state: RoomState;
    /** 声 */
    voice: VoiceState & { canUseVoice: boolean };

    /** 部屋のやり取り。画面から呼ぶ */
    presence: Presence | null;
    move: (x: number, y: number) => void;
    setStatus: (status: MemberStatus) => void;
    addWrittenChars: (count: number) => void;
    send: (message: Omit<RoomMessage, "id" | "created_at">) => void;

    toggleMic: () => Promise<void>;
    leaveRoom: () => void;
}

const Context = createContext<VoiceContext | null>(null);

const IDLE_VOICE: VoiceState = {
    isMicOn: false,
    isReady: false,
    members: [],
    error: "",
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
    const { session, leave } = useRoomSession();
    const roomId = session?.roomId ?? null;

    const [room, setRoom] = useState<WritingRoom | null>(null);
    const [state, setState] = useState<RoomState>({ members: [], messages: [], isClosed: false });
    const [voiceState, setVoiceState] = useState<VoiceState>(IDLE_VOICE);

    const presenceRef = useRef<Presence | null>(null);
    const voiceRef = useRef<VoiceRoom | null>(null);

    /* 部屋の中身 */
    useEffect(() => {
        if (!roomId) {
            setRoom(null);
            setState({ members: [], messages: [], isClosed: false });
            setVoiceState(IDLE_VOICE);
            return;
        }
        void (async () => {
            const found = await getRepository().getRoom(roomId);
            setRoom(found);

            /*
             * 閉じた部屋からは自動で出る。
             * 入室中の帯が残っていると、まだ居るように見える。
             */
            if (!found) leave();
        })();
    }, [roomId, leave]);

    /*
     * 部屋がまだ生きているか、ときどき確かめる。
     *
     * 部屋主が閉じても、残った人の画面には何も届かない。
     * 自分で見に行かないと、閉じた部屋に居続けることになる。
     */
    useEffect(() => {
        if (!roomId) return;

        const timer = window.setInterval(() => {
            void (async () => {
                const found = await getRepository().getRoom(roomId);
                if (!found) {
                    voiceRef.current?.stop();
                    presenceRef.current?.leave();
                    setRoom(found);
                    leave();
                    return;
                }
                setRoom(found);
            })();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [roomId, leave]);

    /*
     * 在室に繋ぐ。
     *
     * 部屋の画面ではなく、ここが持つ。
     * 画面が消えても繋がったままになる。
     */
    useEffect(() => {
        if (!roomId) return;

        const identity = loadIdentity();
        const presence = createPresence(roomId);
        presenceRef.current = presence;

        const member: RoomMember = {
            id: identity.id,
            room_id: roomId,
            display_name: identity.name,
            avatar_seed: identity.id,
            status: "thinking",
            x: 0.44 + Math.random() * 0.12,
            y: 0.06 + Math.random() * 0.08,
            written_chars: 0,
            joined_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
        };

        presence.join(member);
        const unsubscribe = presence.subscribe(setState);

        return () => {
            unsubscribe();
            presence.leave();
            presence.dispose();
            presenceRef.current = null;
            setState({ members: [], messages: [], isClosed: false });
        };
    }, [roomId]);

    /* 声。通り道ができてから作る */
    useEffect(() => {
        const channel = presenceRef.current?.voiceChannel;
        if (!channel || !roomId) return;

        const identity = loadIdentity();
        const voice = new VoiceRoom(
            identity.id,
            channel as ConstructorParameters<typeof VoiceRoom>[1],
        );
        voiceRef.current = voice;

        const unsubscribe = voice.subscribe(setVoiceState);

        return () => {
            unsubscribe();
            voice.dispose();
            voiceRef.current = null;
            setVoiceState(IDLE_VOICE);
        };
    }, [roomId, state.members.length]);

    const toggleMic = useCallback(async () => {
        const voice = voiceRef.current;
        if (!voice) return;

        if (voiceState.isMicOn) voice.stop();
        else await voice.start();
    }, [voiceState.isMicOn]);

    const leaveRoom = useCallback(() => {
        voiceRef.current?.stop();
        presenceRef.current?.leave();

        /*
         * 手元も空にする。
         *
         * 部屋の情報を残したまま抜けると、
         * 消えたはずの人が画面に残り続ける。
         */
        setRoom(null);
        setState({ members: [], messages: [], isClosed: false });
        setVoiceState(IDLE_VOICE);

        leave();
    }, [leave]);

    const value = useMemo<VoiceContext>(
        () => ({
            room,
            state,
            voice: {
                ...voiceState,
                canUseVoice: Boolean(presenceRef.current?.voiceChannel),
            },
            presence: presenceRef.current,
            move: (x, y) => presenceRef.current?.move(x, y),
            setStatus: (status) => presenceRef.current?.setStatus(status),
            addWrittenChars: (count) =>
                presenceRef.current?.addWrittenChars(count),
            send: (message) => presenceRef.current?.send(message),
            toggleMic,
            leaveRoom,
        }),
        [room, state, voiceState, toggleMic, leaveRoom],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * 部屋と声を使う。
 * 部屋に入っていなければ null が返る。
 */
export function useRoomVoice(): VoiceContext | null {
    return useContext(Context);
}
