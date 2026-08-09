/**
 * ============================================================
 * 原石航路 Studio
 * 最後にいた場所
 *
 * 執筆室から資料へ行き、また戻ってきたとき、
 * 前と同じ場所に立っていてほしい。
 *
 * 毎回ばらばらの場所から始まると、
 * 隣に座っていた人と離れてしまう。
 * 席を選んだことも無かったことになる。
 *
 * 部屋ごとに覚える。別の部屋へ行けば、そこの入口から。
 * ============================================================
 */

const KEY = "genseki:last-spot";

interface Spot {
    x: number;
    y: number;
    /** 覚えた時刻。古すぎるものは使わない */
    at: number;
}

/** これより古ければ、入口から始める */
const KEEP_MS = 6 * 60 * 60 * 1000;

function read(): Record<string, Spot> {
    if (typeof window === "undefined") return {};

    try {
        return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    } catch {
        return {};
    }
}

/** その部屋で最後にいた場所。無ければ null */
export function loadLastSpot(roomId: string): { x: number; y: number } | null {
    const spot = read()[roomId];
    if (!spot) return null;

    /*
     * 時間が経ちすぎていれば忘れる。
     * 前に来たのが昨日なら、そこに立っている理由も無い。
     */
    if (Date.now() - spot.at > KEEP_MS) return null;

    return { x: spot.x, y: spot.y };
}

/**
 * いまの場所を覚える。
 *
 * 歩いている間は 1 歩ごとに呼ばれる。
 * 毎回書くと、そのたびに読んで組み直して書き戻すことになる。
 *
 * 少し待ってから、最後の 1 つだけを書く。
 * 途中の場所は覚えなくてよい。
 */
let saveTimer: number | null = null;

export function saveLastSpot(roomId: string, x: number, y: number): void {
    if (typeof window === "undefined") return;

    if (saveTimer !== null) window.clearTimeout(saveTimer);

    saveTimer = window.setTimeout(() => {
        saveTimer = null;
        writeSpot(roomId, x, y);
    }, 600);
}

function writeSpot(roomId: string, x: number, y: number): void {

    const all = read();
    all[roomId] = { x, y, at: Date.now() };

    try {
        window.localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
        // 入らなければ諦める。覚えられなくても歩ける
    }
}
