/**
 * ============================================================
 * 原石航路 Studio
 * ログインカード「乗船印帳」の決まり
 *
 *   1 枚 28 マス（7 マス × 4 行）＝ 28 日分のカレンダー。
 *   最初にハンコを押した日が 1 マス目。そこから 1 日 1 マスずつ進む。
 *   来なかった日のマスは空いたまま（あとから埋まらない）。
 *   28 日たったら、次に来た日から次のカード（印の色が変わる）。
 *
 *   毎日                    5 pt
 *   1 行（7 日）ぜんぶ押す    +50 pt（7 日連続。行の右に「宝」の角印）
 *   28 マス ぜんぶ押す        +200 pt（28 日連続）
 *   ときどき「金」の印        +10 pt（10 回に 1 回くらい。押すまで分からない）
 *
 * ★ 画面（印帳・その日のお知らせ）とサーバー（/api/points/daily）で同じ決まりを使う。
 * ============================================================
 */

export const CARD_CELLS = 28;
export const ROW_CELLS = 7;

export const DAILY_POINTS = 5;
export const ROW_BONUS = 50;
export const FULL_BONUS = 200;
export const GOLD_BONUS = 10;
/** 金の印が出る見込み */
export const GOLD_CHANCE = 0.1;

/** ポイントの履歴に残す名前 */
export const REASON = {
    daily: "login",
    /** 7 日連続・28 日連続（印は「最後の日:7」「最後の日:28」） */
    streak: "login-streak",
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

/** 印の色（カードごとに変わる。5 枚目からはまた朱に戻る） */
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

/** マス 1 つ（その日） */
export interface LoginCell {
    /** その日の日付（2026-10-05 の形） */
    date: string;
    /** ハンコが押してあるか */
    stamped: boolean;
    /** 金の印か */
    gold: boolean;
}

/** サーバーから届く印帳のようす */
export interface LoginCardState {
    /** 何枚目か（1 から） */
    book: number;
    /** このカードの 1 日目と 28 日目 */
    start: string;
    end: string;
    /** 28 マス（1 日目から順に） */
    cells: LoginCell[];
    /** 今日が何マス目か（0 から） */
    todayIndex: number;
    /** このカードで押した数（0〜28） */
    filled: number;
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

/* ---------- 日付の計算（日本時間の「2026-10-05」の形のまま数える） ---------- */

const DAY_MS = 86400000;

export function addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** 「10/5」の形 */
export function shortDate(date: string): string {
    return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

/**
 * 押した日から、いまのカードを組み立てる（サーバーも見本も同じものを使う）
 *
 *   押した日を古い順に見ていき、カードの 28 日を過ぎた日に押していたら、そこから次のカード。
 *   今日がまだで、今日がカードの 28 日を過ぎていたら、今日から始まる空のカードを見せる。
 */
export function buildCard(
    stampDates: string[],
    goldDates: Set<string>,
    today: string,
    streak: number,
): LoginCardState {
    const dates = Array.from(new Set(stampDates.filter(Boolean))).sort();
    const todayDone = dates.includes(today);

    let book = 0;
    let start = "";
    for (const date of dates) {
        if (!start || daysBetween(start, date) >= CARD_CELLS) {
            book += 1;
            start = date;
        }
    }
    if (!start || daysBetween(start, today) >= CARD_CELLS) {
        book += 1;
        start = today;
    }

    const stamped = new Set(dates);
    const cells: LoginCell[] = Array.from({ length: CARD_CELLS }, (_, i) => {
        const date = addDays(start, i);
        return { date, stamped: stamped.has(date), gold: stamped.has(date) && goldDates.has(date) };
    });

    return {
        book,
        start,
        end: addDays(start, CARD_CELLS - 1),
        cells,
        todayIndex: Math.max(0, daysBetween(start, today)),
        filled: cells.filter((c) => c.stamped).length,
        streak,
        todayDone,
    };
}

/** 行 r（0 から）の 7 日がぜんぶ押してあるか */
export function rowDone(state: LoginCardState, r: number): boolean {
    return state.cells.slice(r * ROW_CELLS, (r + 1) * ROW_CELLS).every((c) => c.stamped);
}

/**
 * 行 r が、もうそろわないか（過ぎた日に、押していない日がある）
 *   今日はまだ押せるので、今日より前だけを見る。
 */
export function rowMissed(state: LoginCardState, r: number): boolean {
    return state.cells
        .slice(r * ROW_CELLS, (r + 1) * ROW_CELLS)
        .some((c, i) => r * ROW_CELLS + i < state.todayIndex && !c.stamped);
}

/** 28 日ぜんぶ押してあるか */
export function cardDone(state: LoginCardState): boolean {
    return state.cells.every((c) => c.stamped);
}

/** 28 日連続が、もう無理か */
export function cardMissed(state: LoginCardState): boolean {
    return state.cells.some((c, i) => i < state.todayIndex && !c.stamped);
}

/** このカードでもらったポイント（見せる用） */
export function pointsInBook(state: LoginCardState): number {
    const rows = Array.from({ length: CARD_CELLS / ROW_CELLS }, (_, r) => r).filter((r) => rowDone(state, r)).length;
    const golds = state.cells.filter((c) => c.gold).length;
    return (
        state.filled * DAILY_POINTS +
        rows * ROW_BONUS +
        golds * GOLD_BONUS +
        (cardDone(state) ? FULL_BONUS : 0)
    );
}
