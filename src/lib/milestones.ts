/**
 * ============================================================
 * 原石航路 Studio
 * 節目（PV・いいね・ランキング）を祝う
 *
 * ★ 祝うのは、作者が自分の作品で届いた節目だけ。
 *
 *     PV        100 / 500 / 1,000 / 3,000 / 5,000 / 1万 / 3万 / 5万 / 10万
 *     いいね    10 / 30 / 50 / 100 / 300 / 500 / 1,000
 *     ランキング 10位以内 / 3位以内 / 1位（期間ごと：日間・週間 など）
 *
 * ★ 一度祝ったものは、二度と出さない。
 *   「見た」の印は read_feedbacks（通知の既読と同じ表）に ms- で始まる名札で残す。
 *   端末を替えても、同じ節目がまた出ることはない。
 *
 * ★ まとめて届いたとき（はじめて開いた日など）は、作品と種類ごとに
 *   いちばん大きい節目だけを祝う。小さい節目は、見たことにしておく。
 * ============================================================
 */

export type MilestoneKind = "pv" | "like" | "rank";

export const PV_STEPS = [100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 100000];
/**
 * ★ 10 万 PV から先も、10 万ごとに節目にする（20 万・30 万 …）。終わりは作らない。
 *   港の名前と景色は、最初の 9 つをもう一周する（二巡目・三巡目 …）。
 */
export const PV_LAP = 100000;

/** その数までに届いた PV の節目すべて（10 万より先も含む） */
export function pvStepsUpTo(count: number): number[] {
    const steps = PV_STEPS.filter((s) => s <= count);
    for (let v = PV_LAP * 2; v <= count; v += PV_LAP) steps.push(v);
    return steps;
}
/** 何番目の港か（0 から） */
export function pvIndex(value: number): number {
    const i = PV_STEPS.indexOf(value);
    return i >= 0 ? i : PV_STEPS.length - 1 + Math.round(value / PV_LAP) - 1;
}
/** 次の節目 */
export function pvNext(value: number): number {
    const i = PV_STEPS.indexOf(value);
    return i >= 0 && i < PV_STEPS.length - 1 ? PV_STEPS[i + 1] : Math.floor(value / PV_LAP) * PV_LAP + PV_LAP;
}
/** 港の名前と景色に使う、最初の 9 つのどれか。lap は何巡目か（1 から） */
export function pvCycle(value: number): { base: number; lap: number } {
    const i = pvIndex(value);
    return { base: PV_STEPS[i % PV_STEPS.length], lap: Math.floor(i / PV_STEPS.length) + 1 };
}
export const LIKE_STEPS = [10, 30, 50, 100, 300, 500, 1000];
/** ランキングの節目。小さい数ほど上 */
export const RANK_STEPS = [10, 3, 1];

export const PERIOD_LABEL: Record<string, string> = {
    daily: "日間",
    weekly: "週間",
    monthly: "月間",
    quarterly: "四半期",
    yearly: "年間",
    all: "累計",
    rising: "急上昇",
};

export interface Milestone {
    /** 見た印の名札 */
    key: string;
    kind: MilestoneKind;
    novelId: string;
    novelTitle: string;
    /** PV・いいねは届いた数。ランキングは「何位以内」 */
    value: number;
    /** いまの実際の数（PV・いいね）。ランキングは実際の順位 */
    actual: number;
    /** ランキングの期間（daily など） */
    period?: string;
    /** 並べる強さ。大きいほど先に出す */
    weight: number;
    /** 作品の最初の話を出した日（PV の「航海を始めて何日目」に使う） */
    startedAt?: string;
}

export function milestoneKey(kind: MilestoneKind, novelId: string, value: number, period?: string): string {
    return kind === "rank" ? `ms-rank-${novelId}-${period}-${value}` : `ms-${kind}-${novelId}-${value}`;
}

/** 数の節目で、届いたものすべて */
export function reachedSteps(steps: number[], count: number): number[] {
    return steps.filter((step) => count >= step);
}

/** 画面に出す見出し。「1,000 PV 突破」など */
export function milestoneHeadline(m: Pick<Milestone, "kind" | "value" | "actual" | "period">): string {
    if (m.kind === "pv") return `${m.value.toLocaleString("ja-JP")} PV 突破`;
    if (m.kind === "like") return `いいね ${m.value.toLocaleString("ja-JP")} 突破`;
    const label = PERIOD_LABEL[m.period ?? ""] ?? "";
    return m.value === 1 ? `${label}ランキング 1位` : `${label}ランキング ${m.value}位以内`;
}

/** 並べる強さ。ランキング1位がいちばん上 */
export function milestoneWeight(kind: MilestoneKind, value: number): number {
    if (kind === "rank") return value === 1 ? 1_000_000_000 : value === 3 ? 500_000_000 : 100_000_000;
    if (kind === "pv") return value;
    return value * 20; /* いいね 1 は PV 20 くらいの重さ */
}
