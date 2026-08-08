/**
 * ============================================================
 * 原石航路 Studio
 * 時間の読み取り
 *
 * 「いつ」の欄に書かれた言葉を、数に直す。
 * 数に直せれば、並べ替えも、間隔の表示もできる。
 *
 * 読めないものは null。
 * 書き手の書き方を縛らず、読めたものだけ整える。
 * ============================================================
 */

import type { TimelineMode } from "@/types";

/** 読み取った結果 */
export interface TimePoint {
    /** 並べ替えに使う数。読めなければ null */
    value: number | null;
    /** 画面に出す言い方 */
    label: string;
}

/**
 * ------------------------------------------------------------
 * 年月日
 *
 *   1005年 春
 *   1005年3月4日
 *   3月4日
 *
 * 架空の暦もあるので、実在の日付として解さない。
 * 年・月・日を拾い、大きい順に並べる。
 * ------------------------------------------------------------
 */
function readDate(raw: string): number | null {
    const year = raw.match(/(-?\d+)\s*年/);
    const month = raw.match(/(\d+)\s*月/);
    const day = raw.match(/(\d+)\s*日/);

    /* 季節も月として扱う。春夏秋冬しか書かない人がいる */
    const SEASONS: Record<string, number> = { 春: 3, 夏: 6, 秋: 9, 冬: 12 };
    const season = Object.keys(SEASONS).find((key) => raw.includes(key));

    if (!year && !month && !day && !season) return null;

    const y = year ? Number(year[1]) : 0;
    const m = month ? Number(month[1]) : season ? SEASONS[season] : 0;
    const d = day ? Number(day[1]) : 0;

    /* 年を万倍して、月日と混ざらないようにする */
    return y * 10000 + m * 100 + d;
}

/**
 * ------------------------------------------------------------
 * 作中の日数
 *
 *   3日目 / 12日後 / 初日
 * ------------------------------------------------------------
 */
function readDays(raw: string): number | null {
    if (raw.includes("初日")) return 1;

    const found = raw.match(/(\d+)\s*日/);
    if (!found) return null;

    const days = Number(found[1]);
    /* 「3日前」は遡る */
    return raw.includes("前") ? -days : days;
}

/**
 * ------------------------------------------------------------
 * 年齢
 *
 *   17歳 / 17才 / 幼少期
 * ------------------------------------------------------------
 */
function readAge(raw: string): number | null {
    const found = raw.match(/(\d+)\s*[歳才]/);
    if (found) return Number(found[1]);

    /* 言葉での言い方も拾う */
    if (raw.includes("幼少")) return 5;
    if (raw.includes("少年") || raw.includes("少女")) return 12;
    if (raw.includes("青年")) return 20;
    if (raw.includes("晩年")) return 70;

    return null;
}

/**
 * ------------------------------------------------------------
 * 第何話
 *
 *   第4話 / 4話 / 第4話の直後
 * ------------------------------------------------------------
 */
function readEpisode(raw: string): number | null {
    const found = raw.match(/第?\s*(\d+)\s*話/);
    if (!found) return null;

    const number = Number(found[1]);
    /* 「直後」「のあと」は、その話より少し後ろ */
    if (raw.includes("直後") || raw.includes("あと") || raw.includes("後")) {
        return number + 0.5;
    }
    if (raw.includes("直前") || raw.includes("まえ") || raw.includes("前")) {
        return number - 0.5;
    }
    return number;
}

/**
 * ------------------------------------------------------------
 * 時刻
 *
 *   20:15 / 20時15分 / 朝 / 夕方
 * ------------------------------------------------------------
 */
function readClock(raw: string): number | null {
    const colon = raw.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

    const kanji = raw.match(/(\d{1,2})\s*時(?:\s*(\d{1,2})\s*分)?/);
    if (kanji) return Number(kanji[1]) * 60 + Number(kanji[2] ?? 0);

    /* おおまかな言い方 */
    const ROUGH: Record<string, number> = {
        未明: 3 * 60,
        明け方: 5 * 60,
        朝: 7 * 60,
        午前: 10 * 60,
        昼: 12 * 60,
        午後: 14 * 60,
        夕方: 17 * 60,
        夕: 17 * 60,
        夜: 20 * 60,
        深夜: 24 * 60,
    };

    const key = Object.keys(ROUGH).find((word) => raw.includes(word));
    return key ? ROUGH[key] : null;
}

/** 「いつ」を数に直す */
export function readTime(raw: string, mode: TimelineMode): TimePoint {
    const text = (raw ?? "").trim();
    if (!text) return { value: null, label: "" };

    const value =
        mode === "date"
            ? readDate(text)
            : mode === "days"
              ? readDays(text)
              : mode === "age"
                ? readAge(text)
                : mode === "episode"
                  ? readEpisode(text)
                  : mode === "clock"
                    ? readClock(text)
                    : null;

    return { value, label: text };
}

/**
 * 2 つの出来事のあいだを言葉にする。
 *
 * 「3日あいた」と分かると、物語の速さが見える。
 * 表し方によって単位が違う。
 */
export function describeGap(
    from: number,
    to: number,
    mode: TimelineMode,
): string {
    const gap = to - from;
    if (gap <= 0) return "";

    if (mode === "days") return `${gap}日`;
    if (mode === "age") return `${gap}年`;
    if (mode === "episode") {
        const eps = Math.round(gap);
        return eps > 0 ? `${eps}話` : "";
    }

    if (mode === "clock") {
        const hours = Math.floor(gap / 60);
        const minutes = gap % 60;
        if (hours === 0) return `${minutes}分`;
        return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
    }

    if (mode === "date") {
        /* 年 * 10000 + 月 * 100 + 日 で作った数を戻す */
        const years = Math.floor(gap / 10000);
        const months = Math.floor((gap % 10000) / 100);
        const days = gap % 100;

        if (years > 0) return `${years}年`;
        if (months > 0) return `${months}か月`;
        if (days > 0) return `${days}日`;
        return "";
    }

    return "";
}
