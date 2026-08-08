/**
 * ============================================================
 * 原石航路 Studio
 * 全文を読ませる回数
 *
 * 全文は 1 か月に 3 回まで。
 *
 * 全文は本文をまるごと送るので、長編ほど重い。
 * 何度も押されると費用が積み上がる。
 *
 * 「最新」は書き足したぶんだけを送るので、
 * 何度でも使える。ふだんはこちらで足りる。
 *
 * 数は端末の中に置く。
 * 作品ごとではなく、その人ごとに数える。
 * ============================================================
 */

/** 1 か月に使える回数 */
export const FULL_SCAN_LIMIT = 3;

const KEY = "genseki:full-scan";

interface Record {
    /** 「2026-08」の形 */
    month: string;
    count: number;
}

/** いまの月。月が変われば数は 0 に戻る */
function thisMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

function read(): Record {
    if (typeof window === "undefined") return { month: thisMonth(), count: 0 };

    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return { month: thisMonth(), count: 0 };

        const parsed = JSON.parse(raw) as Record;
        /* 月が変わっていれば、数え直す */
        if (parsed.month !== thisMonth()) return { month: thisMonth(), count: 0 };

        return parsed;
    } catch {
        return { month: thisMonth(), count: 0 };
    }
}

/** あと何回使えるか */
export function remainingFullScans(): number {
    return Math.max(0, FULL_SCAN_LIMIT - read().count);
}

/** 使ったことを記す */
export function recordFullScan(): void {
    if (typeof window === "undefined") return;

    const record = read();
    window.localStorage.setItem(
        KEY,
        JSON.stringify({ month: record.month, count: record.count + 1 }),
    );
}

/** 数が戻る日。「9月1日から」と伝えるために使う */
export function nextResetLabel(): string {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getMonth() + 1}月1日`;
}
