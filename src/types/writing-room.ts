/**
 * ============================================================
 * 原石航路 Studio
 * WritingRoom Types（執筆室）
 *
 * 書く作業はひとりでするものだが、
 * 「誰かも書いている」と分かるだけで続けやすくなる。
 * 話しかけるための場所ではないので、
 * 発言はスタンプ中心にして、文字は回数を絞る。
 * ============================================================
 */

import type { RoomLayout } from "@/types/room-layout";

/**
 * 部屋の公開範囲。
 *
 * solo     … 完全にひとり。誰も入れない
 * link     … URL を知っている人だけ
 * open … 誰でも入れる
 */
export type RoomVisibility = "link" | "open";

/**
 * 誰が入れるか。2 つだけ。
 */
export const ROOM_VISIBILITY_LABEL: Record<RoomVisibility, string> = {
    link: "URL限定",
    open: "オープン",
};

export const ROOM_VISIBILITY_DESCRIPTION: Record<RoomVisibility, string> = {
    link: "URLを知っている人だけが入れます。仲間内で使う部屋に。",
    open: "誰でも入れます。執筆室の一覧に並び、知らない人も入ってきます。",
};

export const SELECTABLE_VISIBILITY: RoomVisibility[] = ["link", "open"];

/** 部屋の内装。見た目が変わるだけで、機能に差はない */
export type RoomTheme = "library" | "cafe" | "study";

export const ROOM_THEME_LABEL: Record<RoomTheme, string> = {
    library: "図書館",
    cafe: "喫茶店",
    study: "書斎",
};

export interface WritingRoom {
    id: string;
    name: string;
    description: string;
    visibility: RoomVisibility;
    /**
     * 運営が用意した部屋か。
     *
     * 公開の範囲とは別のもの。
     * オープンな部屋は誰でも立てられる。
     * この印は「運営が置いた部屋」であることを示すだけ。
     */
    is_official?: boolean;
    theme: RoomTheme;
    /**
     * 合言葉。
     *
     * URL 限定の部屋へ、番号だけで入れるようにするためのもの。
     * 立てたときに 6 桁が自動で振られる。
     */
    room_code?: string | null;

    /** 立てた人。公式の部屋は null */
    host_id: string | null;
    /**
     * 部屋を立てた人が最後にいた時刻。
     * ここが 5 分より古い部屋は、誰かが一覧を開いたときに畳まれる。
     * 在室そのものは Realtime が持つが、あれは一時的で
     * サーバーからは見えないので、時刻だけを表に残す。
     */
    host_seen_at?: string | null;
    /** 入れる人数の上限 */
    capacity: number;
    allow_chat: boolean;
    allow_stamps: boolean;
    /**
     * 部屋を立てた人だけが声を使える。
     * まだ実装していない（WebRTC が要る）ので、設定だけ持っておく。
     */
    allow_host_voice: boolean;
    /** 文字の発言を何分あたり何回まで許すか */
    chat_limit_count: number;
    chat_limit_minutes: number;
    /**
     * 文字で発言してよい人。部屋を立てた人は常に含む。
     * 誰でも喋れると、書く場所として成り立たなくなる。
     */
    speakers?: string[];
    /**
     * 入れない人。管理する人が決める。
     * 部屋には管理する人が要る、という前提の機能。
     */
    banned?: string[];
    /**
     * 部屋の中身。家具の配置と床・壁。
     * 古いデータには無いので、読み込み時に空の間取りを入れる。
     */
    layout?: RoomLayout | null;

    /**
     * ============================================================
     * 集中タイマー
     *
     * 部屋ごとに 1 つ。誰かが始めたら、いる人全員に同じ残りが出る。
     *
     * 残り秒数ではなく「いつ始まったか」と「何分か」を持つ。
     * 残りを持つと毎秒の書き込みになるうえ、
     * 途中から入った人の残りが計算できない。
     * ============================================================
     */
    /** 始まった時刻。null なら動いていない */
    sprint_started_at?: string | null;
    /** 何分ぶんか */
    sprint_minutes?: number;
    /** 始めた人の表示名 */
    sprint_by?: string;
    created_at: string;
    updated_at: string;
}

/**
 * ============================================================
 * 部屋にいる人
 * ============================================================
 */

/**
 * いまの状態。アイコンの上に出る。
 * 「書いている／休んでいる」が分かるだけで、
 * 声をかけていいかどうかの判断がつく。
 */
export type MemberStatus = "writing" | "break" | "thinking" | "away";

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
    writing: "執筆中",
    break: "休憩中",
    thinking: "考え中",
    away: "離席中",
};

export const MEMBER_STATUS_COLOR: Record<MemberStatus, string> = {
    writing: "#2f6b3d",
    break: "#c99a2e",
    thinking: "#6b7fbf",
    away: "#9aa39d",
};

export interface RoomMember {
    id: string;
    room_id: string;
    display_name: string;
    /** アイコンの色を決める種。名前から作る */
    avatar_seed: string;
    /**
     * 選んだテーマカラーの番号。
     *
     * 未指定なら id から決める。
     * 同じ部屋で被ったときは、先に入った人が優先される。
     */
    color_id?: number;
    status: MemberStatus;
    /** 部屋の中の位置。0〜1 の割合で持つ（画面の大きさに依存させない） */
    x: number;
    y: number;
    /** 今日この部屋で書いた文字数 */
    written_chars: number;
    joined_at: string;
    /** 最後に動きがあった時刻。古いものは居ないものとして扱う */
    last_seen: string;
}

/** これ以上応答がなければ退室したものとみなす（ミリ秒） */
export const MEMBER_TIMEOUT_MS = 60 * 1000;

/**
 * ============================================================
 * 発言
 * ============================================================
 */

export interface RoomMessage {
    id: string;
    room_id: string;
    member_id: string;
    member_name: string;
    kind: "stamp" | "text";
    /** スタンプなら stamp の id、文字ならそのまま */
    body: string;
    created_at: string;
}

export function defaultRoom(id: string, hostId: string | null): WritingRoom {
    const timestamp = new Date().toISOString();
    return {
        id,
        name: "",
        description: "",
        visibility: "open",
        theme: "library",
        host_id: hostId,
        capacity: 20,
        allow_chat: true,
        allow_stamps: true,
        allow_host_voice: false,
        chat_limit_count: 10,
        chat_limit_minutes: 10,
        speakers: [],
        banned: [],
        created_at: timestamp,
        updated_at: timestamp,
    };
}
