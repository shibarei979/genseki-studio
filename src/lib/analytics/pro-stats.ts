/**
 * ============================================================
 * 原石航路 Studio
 * 詳しい分析（Pro）の集計
 *
 * ★ 新しく記録を取るものは無い。すでに残している記録から数える。
 *     page_views     閲覧（誰か＝入っている人の id か、機械の札。どこから来たか。いつ）
 *     read_progress  1 回の読書ごとの、読んだ割合・最後まで読んだか・読んだ時間
 *
 * ★ 誰が読んだかは出さない。人数と割合だけ。
 *
 * ★ 時刻は日本時間で数える。サーバーは世界標準時で動いているため。
 * ============================================================
 */

export type SourceKey = "x" | "youtube" | "instagram" | "note" | "search" | "site" | "direct" | "other" | "unknown";

export interface ProgressSummary {
    /** 読み始めた回数（1 回の読書を 1 と数える） */
    sessions: number;
    /** 最後まで読んだ割合（0〜1） */
    endRate: number;
    /** 平均でどこまで読んだか（0〜100） */
    avgPct: number;
    /** 読んだ時間の真ん中の値（秒）。0 は記録なし */
    medianSec: number;
    /** どこまで読んで閉じたか。0〜10% … 90〜100% の 10 区切り */
    buckets: number[];
}

export interface ProStats {
    progress: ProgressSummary & {
        episodes: (ProgressSummary & { title: string })[];
    };
    /** 読み続けてくれた率。1 話目を読んだ人のうち、その話まで来た割合 */
    retention: { title: string; readers: number; fromFirst: number; fromPrev: number }[];
    /** どこから来たか（閲覧の数） */
    sources: Partial<Record<SourceKey, number>>;
    /** 曜日（0＝日）× 時（0〜23）の閲覧数。日本時間 */
    heat: number[][];
    /** 投稿後の伸び。公開から 24 時間・7 日の閲覧数 */
    launch: { title: string; publishedAt: string; first24h: number; first7d: number; isYoung: boolean }[];
    /** 常連の読者。何話読んだ人が何人いるか */
    loyal: { readers: number; one: number; two: number; threeToNine: number; tenPlus: number };
}

export interface ProEpisode {
    id: string;
    title: string;
    /** 公開した日時。無ければ作った日時 */
    publishedAt: string;
}

export interface ProView {
    episode_id: string;
    user_id: string | null;
    visitor_id: string | null;
    viewed_at: string;
    source: string | null;
}

export interface ProProgress {
    episode_id: string;
    max_pct: number | null;
    read_seconds: number | null;
    reached_end: boolean | null;
}

const HOUR = 60 * 60 * 1000;
const JST = 9 * HOUR;
const KNOWN_SOURCES = new Set(["x", "youtube", "instagram", "note", "search", "site", "direct", "other"]);

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function summarize(rows: ProProgress[]): ProgressSummary {
    const buckets = new Array(10).fill(0);
    let sumPct = 0;
    let ended = 0;
    const seconds: number[] = [];
    for (const row of rows) {
        const pct = Math.max(0, Math.min(100, Number(row.max_pct) || 0));
        sumPct += pct;
        if (row.reached_end || pct >= 95) ended += 1;
        buckets[Math.min(9, Math.floor(pct / 10))] += 1;
        const sec = Number(row.read_seconds) || 0;
        if (sec > 0) seconds.push(sec);
    }
    const sessions = rows.length;
    return {
        sessions,
        endRate: sessions ? ended / sessions : 0,
        avgPct: sessions ? Math.round(sumPct / sessions) : 0,
        medianSec: median(seconds),
        buckets,
    };
}

/**
 * 1 作品ぶんを数える。
 *
 * @param episodes  公開中の話。読む順に並べて渡す
 * @param views     その作品の閲覧（作者自身と見回りの機械は除いたもの）
 * @param progress  その作品の読書の記録（同じく除いたもの）
 */
export function buildProStats(episodes: ProEpisode[], views: ProView[], progress: ProProgress[]): ProStats {
    const order = new Map(episodes.map((ep, index) => [ep.id, index]));

    /* ---- どこまで読まれたか ---- */
    const progressByEp = new Map<string, ProProgress[]>();
    for (const row of progress) {
        if (!order.has(row.episode_id)) continue;
        (progressByEp.get(row.episode_id) ?? progressByEp.set(row.episode_id, []).get(row.episode_id)!).push(row);
    }
    const allProgress = Array.from(progressByEp.values()).flat();

    /* ---- 誰がどの話を読んだか（読み続けてくれた率・常連） ---- */
    const readersByEp = new Map<string, Set<string>>();
    const episodesByReader = new Map<string, Set<string>>();
    const sources: Partial<Record<SourceKey, number>> = {};
    const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const viewsByEp = new Map<string, number[]>();

    for (const view of views) {
        if (!order.has(view.episode_id)) continue;
        const who = view.user_id || view.visitor_id;
        if (who) {
            (readersByEp.get(view.episode_id) ?? readersByEp.set(view.episode_id, new Set()).get(view.episode_id)!).add(who);
            (episodesByReader.get(who) ?? episodesByReader.set(who, new Set()).get(who)!).add(view.episode_id);
        }

        const key = (view.source && KNOWN_SOURCES.has(view.source) ? view.source : "unknown") as SourceKey;
        sources[key] = (sources[key] ?? 0) + 1;

        const time = new Date(view.viewed_at).getTime();
        if (!Number.isNaN(time)) {
            const jst = new Date(time + JST);
            heat[jst.getUTCDay()][jst.getUTCHours()] += 1;
            (viewsByEp.get(view.episode_id) ?? viewsByEp.set(view.episode_id, []).get(view.episode_id)!).push(time);
        }
    }

    const firstReaders = episodes.length ? readersByEp.get(episodes[0].id) ?? new Set<string>() : new Set<string>();
    let prevReaders = firstReaders;
    const retention = episodes.map((ep, index) => {
        const readers = readersByEp.get(ep.id) ?? new Set<string>();
        let fromFirst = 0;
        let fromPrev = 0;
        if (index === 0) {
            fromFirst = readers.size ? 1 : 0;
            fromPrev = fromFirst;
        } else {
            let keptFirst = 0;
            firstReaders.forEach((who) => {
                if (readers.has(who)) keptFirst += 1;
            });
            let keptPrev = 0;
            prevReaders.forEach((who) => {
                if (readers.has(who)) keptPrev += 1;
            });
            fromFirst = firstReaders.size ? keptFirst / firstReaders.size : 0;
            fromPrev = prevReaders.size ? keptPrev / prevReaders.size : 0;
        }
        prevReaders = readers;
        return { title: ep.title, readers: readers.size, fromFirst, fromPrev };
    });

    const loyal = { readers: episodesByReader.size, one: 0, two: 0, threeToNine: 0, tenPlus: 0 };
    episodesByReader.forEach((set) => {
        const n = set.size;
        if (n >= 10) loyal.tenPlus += 1;
        else if (n >= 3) loyal.threeToNine += 1;
        else if (n === 2) loyal.two += 1;
        else loyal.one += 1;
    });

    /* ---- 投稿後の伸び ---- */
    const now = Date.now();
    const launch = episodes.map((ep) => {
        const start = new Date(ep.publishedAt).getTime();
        const times = viewsByEp.get(ep.id) ?? [];
        const first24h = times.filter((t) => t >= start && t < start + 24 * HOUR).length;
        const first7d = times.filter((t) => t >= start && t < start + 7 * 24 * HOUR).length;
        return {
            title: ep.title,
            publishedAt: ep.publishedAt,
            first24h,
            first7d,
            /* 公開からまだ 7 日たっていない。7 日の数は途中 */
            isYoung: now - start < 7 * 24 * HOUR,
        };
    });

    return {
        progress: {
            ...summarize(allProgress),
            episodes: episodes.map((ep) => ({ title: ep.title, ...summarize(progressByEp.get(ep.id) ?? []) })),
        },
        retention,
        sources,
        heat,
        launch,
        loyal,
    };
}

/** すべての作品の合計。作品をまたぐもの（読み続けた率など）は出さない */
export function mergeProStats(list: ProStats[]): Pick<ProStats, "sources" | "heat"> {
    const sources: Partial<Record<SourceKey, number>> = {};
    const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const one of list) {
        for (const [key, value] of Object.entries(one.sources)) {
            sources[key as SourceKey] = (sources[key as SourceKey] ?? 0) + (value ?? 0);
        }
        one.heat.forEach((row, day) => row.forEach((value, hour) => (heat[day][hour] += value)));
    }
    return { sources, heat };
}
