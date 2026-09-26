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

/**
 * 並べる棒の数の上限。これを超えたら、何話かずつまとめる。
 * スマホの幅（欄の中で 330px ほど）に横すべりなしで収まる数。
 */
const MAX_BARS = 24;

/** 棒のいちばん高いところ（px） */
const BAR_HEIGHT = 40;

interface Props {
    /** 話。話数の順に並べて渡す */
    episodes: { id: string; ep_number: number }[];
    /** 話の id ごとの、出た回数 */
    counts: Map<string, number>;
}

interface Bar {
    from: number;
    to: number;
    count: number;
}

export default function EpisodePresence({ episodes, counts }: Props) {
    if (episodes.length === 0) return null;

    /* 何話ずつまとめるか */
    const size = Math.max(1, Math.ceil(episodes.length / MAX_BARS));

    const bars: Bar[] = [];
    for (let i = 0; i < episodes.length; i += size) {
        const chunk = episodes.slice(i, i + size);
        bars.push({
            from: chunk[0].ep_number,
            to: chunk[chunk.length - 1].ep_number,
            count: chunk.reduce((sum, episode) => sum + (counts.get(episode.id) ?? 0), 0),
        });
    }

    const max = Math.max(1, ...bars.map((bar) => bar.count));
    const firstIndex = bars.findIndex((bar) => bar.count > 0);
    let lastIndex = -1;
    bars.forEach((bar, index) => {
        if (bar.count > 0) lastIndex = index;
    });

    const latest = episodes[episodes.length - 1].ep_number;
    const lastEpisode = [...episodes].reverse().find((episode) => (counts.get(episode.id) ?? 0) > 0);
    const firstEpisode = episodes.find((episode) => (counts.get(episode.id) ?? 0) > 0);
    const gap = lastEpisode ? latest - lastEpisode.ep_number : null;
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
    const nameOf = (bar: Bar) => (bar.from === bar.to ? `${bar.from}` : `${bar.from}〜${bar.to}`);
    const tickOf = (bar: Bar) => `${bar.from}`;

    return (
        <div>
            {/* ひと言のまとめ。グラフを読まなくても分かるように */}
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                <span>
                    全{episodes.length}話のうち
                    <span className="font-medium text-ink"> {appeared}話 </span>
                    に登場
                </span>
                {firstEpisode && <span>初登場 第{firstEpisode.ep_number}話</span>}
                {lastEpisode && lastEpisode !== firstEpisode && (
                    <span>最後 第{lastEpisode.ep_number}話</span>
                )}
            </p>

            <div className="thin-scroll mt-2 overflow-x-auto pb-1">
                <div className="inline-flex min-w-full items-end gap-[3px] px-1.5">
                    {bars.map((bar, index) => {
                        const height = bar.count > 0 ? Math.max(6, (bar.count / max) * BAR_HEIGHT) : 2;
                        const afterLast = lastIndex >= 0 && index > lastIndex;
                        const isMark = index === firstIndex || index === lastIndex;

                        return (
                            <div
                                key={`${bar.from}-${bar.to}`}
                                className="flex min-w-[10px] flex-1 flex-col items-center"
                                title={`第${nameOf(bar)}話：${bar.count}回`}
                            >
                                {/* 回数。棒の上に小さく */}
                                <span className="mb-0.5 h-3 text-[9px] leading-3 text-faint">
                                    {bar.count > 0 ? bar.count : ""}
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
                                        className="w-[70%] max-w-[18px] rounded-t-sm"
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
                                <span
                                    className={[
                                        "mt-0.5 h-3 whitespace-nowrap text-[9px] leading-3",
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
                    横＝話数{size > 1 && `（${size}話ずつまとめて、目盛りは始まりの話）`}　棒の高さ＝出た回数
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
