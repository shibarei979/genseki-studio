import type { Chapter, Episode } from "@/types";

/**
 * ============================================================
 * 原石航路 Studio
 * chapter-tree — 章の並びを組み立てる
 *
 * 章は 2 段になった。
 *
 *   第一部          ← 大きい章（子を持つ章）
 *     第一章  話 3
 *     第二章  話 5
 *   第三章  話 2    ← ふつうの章（子を持たない章）
 *
 * episode-list.tsx は JSX の入れ子が深く、
 * 中で組み立てを増やすと壊しやすい。
 * 数え方と並べ方だけを、ここに出しておく。
 *
 * ここは画面を持たない。ただの計算。
 * ============================================================
 */

export interface ChapterGroup {
    /** 章そのもの。null は「章に入れていない」 */
    chapter: Chapter | null;

    /** この章に直接入っている話 */
    items: Episode[];

    /** 0 は大きい章とふつうの章、1 は小さい章 */
    depth: 0 | 1;

    /** 子を持つ章。見出しを「第◯部」で出す */
    isBig: boolean;

    /** 小さい章のときだけ、親の id。しまうときに使う */
    parentId: string | null;

    /**
     * 見出しに出す番号（0 始まり）。
     *
     * 大きい章は部の通し番号、
     * それ以外は章の通し番号を、作品ぜんぶで数える。
     *
     * 大きい章を作っていない作品では、
     * これまでと同じ番号になる。
     */
    labelIndex: number;

    /**
     * 見出しに出す話数。
     *
     * 大きい章は、配下の小さい章までを合わせた数。
     * 「数の集計は作品でひとつ」に合わせる。
     */
    totalCount: number;
}

/**
 * 章と話から、上から順に並べた一覧を作る。
 *
 * 大きい章のすぐ後ろに、その子を続けて置く。
 * 最後に「章に入れていない」を必ず 1 つ置く
 * （空なら呼ぶ側が落とす。いまの作りに合わせている）。
 */
export function buildChapterGroups(
    chapters: Chapter[],
    episodes: Episode[],
): ChapterGroup[] {
    /* 章の無い作品は、束ねずにただ並べる */
    if (chapters.length === 0) {
        return [
            {
                chapter: null,
                items: episodes,
                depth: 0,
                isBig: false,
                parentId: null,
                labelIndex: 0,
                totalCount: episodes.length,
            },
        ];
    }

    /*
     * 親ごとの子を先に集める。
     *
     * chapters は sort_order で並んでいるので、
     * 拾った順がそのまま子の並びになる。
     */
    const childrenOf = new Map<string, Chapter[]>();
    for (const chapter of chapters) {
        if (!chapter.parent_id) continue;
        const list = childrenOf.get(chapter.parent_id);
        if (list) list.push(chapter);
        else childrenOf.set(chapter.parent_id, [chapter]);
    }

    const episodesOf = (chapterId: string) =>
        episodes.filter((episode) => episode.chapter_id === chapterId);

    const groups: ChapterGroup[] = [];

    /*
     * 番号の数え方。
     *
     * 部は、作品ぜんぶで通して数える。
     *
     * 章は、部の中では第一章から数え直す。
     * 紙の本で部を立てるとき、部が変わると
     * 章の番号が戻るのに合わせている。
     *
     * 部に入っていない章は、これまでどおり
     * 作品ぜんぶで通して数える。
     * 大きい章を作っていない作品の番号が
     * 変わらないのは、ここのため。
     */
    let bigIndex = 0;
    let looseIndex = 0;

    for (const top of chapters) {
        /* 子は親のところで出す。ここでは飛ばす */
        if (top.parent_id) continue;

        const children = childrenOf.get(top.id) ?? [];

        /*
         * 部かどうかは、印で決める。
         *
         * 子の数で決めていたころは、中の章が空になると
         * 部が消えてただの章に戻っていた。
         *
         * 印を持たない古い章のために、子がいれば部として扱う。
         * SQL を流す前でも見え方が壊れない。
         */
        const isPart = top.is_part === true || children.length > 0;

        /*
         * 部でない章は、これまでどおり。
         *
         * 部を作っていない作品が、
         * 見え方も番号も変わらないのは、ここのため。
         */
        if (!isPart) {
            const items = episodesOf(top.id);
            groups.push({
                chapter: top,
                items,
                depth: 0,
                isBig: false,
                parentId: null,
                labelIndex: looseIndex,
                totalCount: items.length,
            });
            looseIndex += 1;
            continue;
        }

        /*
         * 大きい章。
         *
         * 束ねた後に直接ぶら下がったままの話も、
         * 落とさずに親の下へ出す。
         * （まとめる操作の途中で、こうなることがある）
         */
        const own = episodesOf(top.id);

        const childGroups: ChapterGroup[] = [];
        let total = own.length;

        /* 部の中は、毎回 第一章 から数え直す */
        let innerIndex = 0;

        for (const child of children) {
            const items = episodesOf(child.id);
            total += items.length;

            childGroups.push({
                chapter: child,
                items,
                depth: 1,
                isBig: false,
                parentId: top.id,
                labelIndex: innerIndex,
                totalCount: items.length,
            });
            innerIndex += 1;
        }

        groups.push({
            chapter: top,
            items: own,
            depth: 0,
            isBig: true,
            parentId: null,
            labelIndex: bigIndex,
            totalCount: total,
        });
        bigIndex += 1;

        groups.push(...childGroups);
    }

    /*
     * どの章にも入っていない話。
     *
     * 消えた章の id が残っている話も、ここへ拾う。
     * どこにも出ないと、書いた本人が見失う。
     */
    const known = new Set(chapters.map((chapter) => chapter.id));
    const loose = episodes.filter(
        (episode) => !episode.chapter_id || !known.has(episode.chapter_id),
    );

    groups.push({
        chapter: null,
        items: loose,
        depth: 0,
        isBig: false,
        parentId: null,
        labelIndex: 0,
        totalCount: loose.length,
    });

    return groups;
}

/**
 * 「第一部」のような見出し。大きい章にだけ使う。
 *
 * 題名だけ受け取る。作品ページ側の章は形が違う
 * （order_num を持ち、sort_order を持たない）ので、
 * 丸ごと要求すると渡せない。
 * 数え方を 2 か所に書くと、いつか食い違う。
 */
export function formatBigChapterLabel(
    chapter: Pick<Chapter, "title">,
    index: number,
): string {
    const number = toKanji(index + 1);
    return chapter.title ? `第${number}部　${chapter.title}` : `第${number}部`;
}

/** 1〜99 を漢数字に。章立てでこれ以上は使わない */
function toKanji(value: number): string {
    const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (value < 10) return digits[value] ?? String(value);

    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${tens > 1 ? digits[tens] : ""}十${digits[ones]}`;
}

/**
 * 「第一部」だけを返す。名前は付けない。
 *
 * 細い一覧では、番号と名前を 1 つの文字列にすると
 * 番号だけが見えて名前が切れる。
 * 番号は縮まない札に、名前は残り幅に分けて出す。
 */
export function formatPartNumber(index: number): string {
    return `第${toKanji(index + 1)}部`;
}

/** 「第一章」だけを返す。名前は付けない */
export function formatChapterNumber(index: number): string {
    return `第${toKanji(index + 1)}章`;
}

/**
 * 一覧に出る順に、話の id を並べる。
 *
 * 見えている順が分からないと、
 * 「ここからここまで」を選べない。
 */
export function orderedEpisodeIds(
    chapters: Chapter[],
    episodes: Episode[],
): string[] {
    return buildChapterGroups(chapters, episodes).flatMap((group) =>
        group.items.map((episode) => episode.id),
    );
}
