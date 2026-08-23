/**
 * ============================================================
 * 原石航路 Studio
 * 声の繋がりを持ち続ける
 *
 * これまでは部屋の画面が繋がりを持っていた。
 * そのため別のページへ移ると画面ごと消え、
 * 声も途切れていた。
 *
 * ここに置けば、画面が入れ替わっても繋がりは残る。
 * 切れるのは「部屋を出たとき」と「タブを閉じたとき」だけ。
 *
 * 1 つの部屋に 1 つだけ。
 * 部屋の画面と入室中の帯が同じものを見るので、
 * マイクの入り切りがどちらからでも効く。
 * ============================================================
 */

import { VoiceRoom } from "@/lib/room/voice";

/** いま繋いでいる部屋 */
let current: { roomId: string; selfId: string; room: VoiceRoom } | null = null;

/**
 * その部屋の繋がりを得る。
 *
 * 同じ部屋なら、前に作ったものをそのまま返す。
 * 別の部屋なら、前のものを切ってから作り直す。
 */
export function acquireVoiceRoom(roomId: string, selfId: string): VoiceRoom {
    if (current && current.roomId === roomId && current.selfId === selfId) {
        return current.room;
    }

    /* 別の部屋へ移るときは、前の繋がりを切る */
    if (current) {
        current.room.dispose();
        current = null;
    }

    const room = new VoiceRoom(selfId, roomId);
    current = { roomId, selfId, room };
    return room;
}

/**
 * いま繋いでいるものを返す。無ければ null。
 *
 * 入室中の帯が、部屋の画面を離れたあとも
 * マイクを触れるようにするために使う。
 */
export function peekVoiceRoom(): VoiceRoom | null {
    return current?.room ?? null;
}

/**
 * 繋がりを切る。
 *
 * 部屋を出たときだけ呼ぶ。
 * 画面を移っただけでは呼ばない。
 */
export function releaseVoiceRoom(): void {
    if (!current) return;
    current.room.dispose();
    current = null;
}
