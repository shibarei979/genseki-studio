/**
 * ============================================================
 * 原石航路 Studio
 * useRoomVoice — 執筆室の声
 *
 * 部屋の画面から呼ぶ。
 * マイクの取得・繋ぎ・ミュート・後始末を、ここで抱える。
 *
 * ------------------------------------------------------------
 * 部屋の同期とは別の通り道を使う
 *
 * 同じチャンネルに相乗りすると、あちらが購読を始めたあとに
 * こちらが .on() を足すことになって落ちる。
 * 声は声で 1 本開く（room-voice:部屋のid）。
 *
 * ------------------------------------------------------------
 * 入るときは必ずマイクを切った状態から
 *
 * 部屋に入った瞬間に許可を聞かれると身構えさせる。
 * ボタンを押したときに初めて求める。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { hasSupabase } from "@/config/env.client";
import { VoiceRoom } from "@/lib/room/voice";
import type { VoiceState } from "@/lib/room/voice";

const IDLE: VoiceState = {
    isMicOn: false,
    isReady: false,
    members: [],
    error: "",
};

export function useRoomVoice(roomId: string | null, selfId: string) {
    const [voice, setVoice] = useState<VoiceState>(IDLE);
    const roomRef = useRef<VoiceRoom | null>(null);

    useEffect(() => {
        /*
         * 繋いでいない版では声を使わない。
         * 相手がいないのにマイクを掴むと、
         * 端末に「使用中」の印だけが立つ。
         */
        if (!roomId || !selfId || !hasSupabase()) return;

        const room = new VoiceRoom(selfId, roomId);
        roomRef.current = room;

        const stop = room.subscribe(setVoice);

        return () => {
            stop();
            room.dispose();
            roomRef.current = null;
            setVoice(IDLE);
        };
    }, [roomId, selfId]);

    /**
     * マイクの入り切り。
     *
     * 初回はここで許可を求める。
     * 2 回目からは音の流れだけを止める。繋ぎは解かない。
     */
    const toggleMic = useCallback(async () => {
        await roomRef.current?.toggle();
    }, []);

    return {
        isMicEnabled: voice.isMicOn,
        isReady: voice.isReady,
        members: voice.members,

        /**
         * マイクを入れている人。
         *
         * 自分は isMicOn を見る。
         * members の自分は「マイクを取ったか」を見ているので、
         * ミュートにしても入ったままになる。
         *
         * 相手は繋がっていれば入っているとみなす。
         * 相手がミュートにしたかどうかは、いまは分からない。
         */
        micOnIds: voice.members
            .filter((member) =>
                member.id === selfId ? voice.isMicOn : member.isConnected,
            )
            .map((member) => member.id),
        /** 自分が話しているか */
        isSpeaking: voice.members.some(
            (member) => member.id === selfId && member.isSpeaking,
        ),
        micError: voice.error,
        toggleMic,
    };
}
