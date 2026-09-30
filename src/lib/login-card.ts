/**
 * ============================================================
 * 原石航路 Studio
 * ログインカード「乗船印帳」の決まり
 *
 *   1 冊 28 マス（7 マス × 4 行）。来た日に 1 つハンコが押される。
 *   続けて来なくても、次に来た日に次のマスへ進む（減らない）。
 *
 *   毎日                5 pt
 *   1 行（7 つ）そろう   +30 pt（行の右に「宝」の角印）
 *   28 マス 満印         +100 pt（次の日から 2 冊目。印の色が変わる）
 *   ときどき「金」の印    +10 pt（10 回に 1 回くらい。押すまで分からない）
 *
 * ★ 画面（印帳・その日のお知らせ）とサーバー（/api/points/daily）で同じ決まりを使う。
 * ============================================================
 */

export const CARD_CELLS = 28;
export const ROW_CELLS = 7;

export const DAILY_POINTS = 5;
export const ROW_BONUS = 30;
export const FULL_BONUS = 100;
export const GOLD_BONUS = 10;
/** 金の印が出る見込み */
export const GOLD_CHANCE = 0.1;

/** ポイントの履歴に残す名前 */
export const REASON = {
    daily: "login",
    row: "login-row",
    full: "login-full",
    gold: "login-gold",
} as const;

/** ハンコの柄（行の左から順） */
export const MOTIFS = ["anchor", "ship", "light", "gem", "compass", "wave", "star"] as const;
export type Motif = (typeof MOTIFS)[number];

export const MOTIF_NAME: Record<Motif, string> = {
    anchor: "錨",
    ship: "船",
    light: "灯台",
    gem: "原石",
    compass: "羅針盤",
    wave: "波",
    star: "星",
};

/** 印の色（冊ごとに変わる。5 冊目からはまた朱に戻る） */
const INKS = ["#c62f28", "#2c5a8f", "#2f7d57", "#6b3fa0"];
export const GOLD_INK = "#c9971f";

export function inkOf(book: number): string {
    return INKS[(Math.max(1, book) - 1) % INKS.length];
}

/** マス（1〜28）の柄 */
export function motifOf(cell: number): Motif {
    return MOTIFS[(Math.max(1, cell) - 1) % ROW_CELLS];
}

/** 押し方の傾き（マスごとに少しずつ違う。毎回同じ向き） */
export function tiltOf(cell: number): number {
    return [-8, 5, -3, 9, -6, 3, -10, 7, -2, 6, -7, 4, -5, 8][cell % 14];
}

/** サーバーから届く印帳のようす */
export interface LoginCardState {
    /** 何冊目か（1 から） */
    book: number;
    /** この冊で押した数（0〜28） */
    filled: number;
    /** 押した日（古い順）。gold は金の印 */
    days: { date: string; gold: boolean }[];
    /** 続けて来ている日数 */
    streak: number;
    /** 今日押したか */
    todayDone: boolean;
}

/** その日に配ったもの（お知らせ用） */
export interface LoginGrant {
    daily: number;
    row: number;
    full: number;
    gold: number;
}

/** この冊でもらったポイント（見せる用） */
export function pointsInBook(state: LoginCardState): number {
    const rows = Math.floor(state.filled / ROW_CELLS);
    const golds = state.days.filter((d) => d.gold).length;
    return (
        state.filled * DAILY_POINTS +
        rows * ROW_BONUS +
        golds * GOLD_BONUS +
        (state.filled >= CARD_CELLS ? FULL_BONUS : 0)
    );
}
