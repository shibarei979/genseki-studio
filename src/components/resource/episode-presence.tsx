/**
 * ============================================================
 * 原石航路 Studio
 * EpisodePresence — 話ごとの出番
 *
 * ★ 小さな四角を並べるだけだと、何を表しているのか分からなかった。
 *   ・どの四角が何話なのか
 *   ・色の濃さが何を意味するのか
 *   ・どこから出ていないのか
 *
 * ★ 棒グラフにする。
 *   横が話、棒の高さがその話に出た回数。
 *   下に話数の目盛り。初登場と最後の話には印を付ける。
 *   最後に出た話から最新話までは、薄い色で「出ていない区間」を示す。
 *
 * ★ 話が多い作品は、何話かずつまとめる。
 *   300 話を 1 本ずつ並べると、棒が細すぎて読めない。
 *   24 本に収まるよう、「1〜5話」のようにまとめて足し合わせる。
 * ============================================================
 */

"use client";

import { formatEpisodeLabel } from "@/types";

/**
 * 並べる棒の数の上限。これを超えたら、何話かずつまとめる。
 * スマホの幅（欄の中で 330px ほど）に横すべりなしで収まる数。
 */
const MAX_BARS = 24;

/** 棒のいちばん高いところ（px） */
const BAR_HEIGHT = 52;

interface Props {
    /** 話。話数の順に並べて渡す */
    episodes: { id: string; ep_number: number; title: string }[];
    /** 話の id ごとの、出た回数 */
    counts: Map<string, number>;
}

/*
 * ★ 話の番号（ep_number）は画面に出さない。
 *   並べ替えや消した話のあとで、番号が飛ぶことがある。
 *   いちばん前のプロローグが「9話」と出て、どの話か分からなかった。
 *   目盛りには、並びの何番目か（1 から）と、話の題名を使う。
 */
interface Bar {
    /** 並びの何番目から（1 から） */
    from: number;
    /** 並びの何番目まで */
    to: number;
    count: number;
    /** 1 話だけの棒なら、その話の題名 */
    title: string;
}

export default function EpisodePresence({ episodes, counts }: Props) {
    if (episodes.length === 0) return null;

    /* 何話ずつまとめるか */
    const size = Math.max(1, Math.ceil(episodes.length / MAX_BARS));

    const bars: Bar[] = [];
    for (let i = 0; i < episodes.length; i += size) {
        const chunk = episodes.slice(i, i + size);
        bars.push({
            from: i + 1,
            to: i + chunk.length,
            count: chunk.reduce((sum, episode) => sum + (counts.get(episode.id) ?? 0), 0),
            title: chunk.length === 1 ? formatEpisodeLabel(chunk[0]) : "",
        });
    }

    const max = Math.max(1, ...bars.map((bar) => bar.count));
    const firstIndex = bars.findIndex((bar) => bar.count > 0);
    let lastIndex = -1;
    bars.forEach((bar, index) => {
        if (bar.count > 0) lastIndex = index;
    });

    const lastEpisode = [...episodes].reverse().find((episode) => (counts.get(episode.id) ?? 0) > 0);
    const firstEpisode = episodes.find((episode) => (counts.get(episode.id) ?? 0) > 0);
    const gap = lastEpisode ? episodes.length - 1 - episodes.indexOf(lastEpisode) : null;
    const appeared = episodes.filter((episode) => (counts.get(episode.id) ?? 0) > 0).length;

    /*
     * 目盛りに出す棒。全部出すと字が重なるので、間引く。
     * 12 本までは全部。それより多いときは、両端と、4 つおきくらい。
     * 初登場と最後の棒は、間引かずに必ず出す（下の isMark）。
     */
    const labelEvery = bars.length <= 12 ? 1 : Math.ceil(bars.length / 4);
    const marks = [firstIndex, lastIndex].filter((index) => index >= 0);
    const showLabel = (index: number) => {
        if (marks.includes(index)) return true;
        if (!(index === 0 || index === bars.length - 1 || index % labelEvery === 0)) return false;
        /* 印の棒のすぐ隣は出さない。字が重なる */
        return bars.length <= 12 || marks.every((mark) => Math.abs(mark - index) > 2);
    };

    /* 何話かずつまとめたときの目盛りは、始まりの話数だけ。幅が足りない */
    const nameOf = (bar: Bar) =>
        bar.title ? bar.title : `${bar.from}〜${bar.to}番目の話`;
    /*
     * ★ 目盛りには「話」、棒の上には「回」を付ける。
     *   前はどちらも数字だけで、棒の上の「2」と下の「1」が並び、
     *   どちらが話数でどちらが回数か分からなかった。
     */
    const tickOf = (bar: Bar) => (isFew && bar.title ? bar.title : `${bar.from}`);

    /*
     * ★ 話が少ないときは、棒を太くして左に寄せる。
     *   前は 2 話でも枠いっぱいに広げていたので、細い棒が両端に離れて、すかすかに見えた。
     */
    const isFew = bars.length <= 12;

    return (
        <div>
            {/* ひと言のまとめ。グラフを読まなくても分かるように */}
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                <span>
                    全{episodes.length}話のうち
                    <span className="font-medium text-ink"> {appeared}話 </span>
                    に登場
                </span>
                {firstEpisode && <span>初登場「{formatEpisodeLabel(firstEpisode)}」</span>}
                {lastEpisode && lastEpisode !== firstEpisode && (
                    <span>最後「{formatEpisodeLabel(lastEpisode)}」</span>
                )}
            </p>

            <div className="thin-scroll mt-2 overflow-x-auto pb-1">
                <div
                    className={[
                        "relative items-end px-1.5",
                        isFew ? "flex w-full gap-1.5" : "inline-flex min-w-full gap-[3px]",
                    ].join(" ")}
                >
                    {/* 地の線 */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 border-t border-line"
                        style={{ bottom: isFew ? 26 : 16 }}
                    />
                    {bars.map((bar, index) => {
                        const height = bar.count > 0 ? Math.max(6, (bar.count / max) * BAR_HEIGHT) : 2;
                        const afterLast = lastIndex >= 0 && index > lastIndex;
                        const isMark = index === firstIndex || index === lastIndex;

                        return (
                            <div
                                key={`${bar.from}-${bar.to}`}
                                className={[
                                    "flex flex-col items-center",
                                    isFew ? "min-w-0 max-w-[64px] flex-1" : "min-w-[10px] flex-1",
                                ].join(" ")}
                                title={`${nameOf(bar)}：${bar.count}回`}
                            >
                                {/* 回数。棒の上に小さく */}
                                <span
                                    className={[
                                        "mb-0.5 h-3 whitespace-nowrap leading-3",
                                        isFew ? "text-[10.5px] font-medium text-forest" : "text-[9px] text-faint",
                                    ].join(" ")}
                                >
                                    {bar.count > 0 ? (isFew ? `${bar.count}回` : bar.count) : ""}
                                </span>

                                <div
                                    className="flex w-full items-end justify-center rounded-sm"
                                    style={{
                                        height: BAR_HEIGHT,
                                        /* 最後に出た話より後ろは「出ていない区間」 */
                                        background: afterLast ? "var(--color-amber-tint, #fbf0dd)" : undefined,
                                    }}
                                >
                                    <div
                                        className={isFew ? "w-6 rounded-t" : "w-[70%] max-w-[18px] rounded-t-sm"}
                                        style={{
                                            height,
                                            /*
                                             * 色は変数で直に。tailwind の「/60」は
                                             * 変数の色には効かないことがある。
                                             * 初登場と最後の話は濃く、ほかは少し薄く。
                                             */
                                            background:
                                                bar.count > 0
                                                    ? "var(--color-forest)"
                                                    : "var(--color-line)",
                                            opacity: bar.count > 0 && !isMark ? 0.6 : 1,
                                        }}
                                    />
                                </div>

                                {/* 目盛り */}
                                {/*
                                  * ★ 題名は 2 行まで折り返す。携帯では棒が細く、
                                  *   1 行に切ると「プ…」のように何の話か分からなかった。
                                  */}
                                <span
                                    className={[
                                        "mt-1 w-full text-center",
                                        isFew
                                            ? "line-clamp-2 h-[22px] break-all text-[10px] leading-[11px]"
                                            : "h-3 whitespace-nowrap text-[9px] leading-3",
                                        isMark ? "font-medium text-forest" : "text-faint",
                                    ].join(" ")}
                                >
                                    {showLabel(index) ? tickOf(bar) : ""}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-faint">
                <span>
                    {isFew ? "下＝話の題名" : `下＝前から何番目の話${size > 1 ? `（${size}話ずつまとめて、始まりの番目）` : ""}`}
                    {"　棒の高さ＝その話に出た回数"}
                </span>
                {gap !== null && gap >= 3 && (
                    <span className="flex items-center gap-1 text-[var(--color-amber)]">
                        <span
                            className="inline-block h-2 w-3 rounded-sm"
                            style={{ background: "var(--color-amber-tint, #fbf0dd)" }}
                        />
                        最新話まで{gap}話、出ていません
                    </span>
                )}
            </div>
        </div>
    );
}
