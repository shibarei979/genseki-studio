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

    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));

    const childrenOf = new Map<string, Chapter[]>();
    for (const chapter of chapters) {
        if (!chapter.parent_id) continue;
        const list = childrenOf.get(chapter.parent_id);
        if (list) list.push(chapter);
        else childrenOf.set(chapter.parent_id, [chapter]);
    }

    const isPart = (chapter: Chapter) =>
        chapter.is_part === true || (childrenOf.get(chapter.id)?.length ?? 0) > 0;

    /*
     * 番号は、章そのものの並び順で決める。
     *
     * 話の置き方で番号が動くと、
     * 話を 1 つ動かしただけで章の番号が入れ替わる。
     * 番号は章の持ち物なので、章の並びから決める。
     */
    const partNumber = new Map<string, number>();
    const chapterNumber = new Map<string, number>();
    let bigAt = 0;
    let smallAt = 0;
    const innerAt = new Map<string, number>();

    for (const chapter of chapters) {
        if (chapter.parent_id) {
            const at = innerAt.get(chapter.parent_id) ?? 0;
            chapterNumber.set(chapter.id, at);
            innerAt.set(chapter.parent_id, at + 1);
        } else if (isPart(chapter)) {
            partNumber.set(chapter.id, bigAt);
            bigAt += 1;
        } else {
            chapterNumber.set(chapter.id, smallAt);
            smallAt += 1;
        }
    }

    /*
     * ★ 並びは話が主。章は、その並びの中に挟まる見出し。
     *
     * 前は章が主だった。第一章の話、第二章の話…と並べ、
     * 章に入っていない話を必ず最後に置いていた。
     * だから、章の前に置いたはずのプロローグが
     * 章の後ろへ回っていた。
     *
     * いまは話の並び（ep_number）をそのまま追い、
     * 章が変わったところで見出しを差し込む。
     * どこへ動かしても、置いた場所に出る。
     *
     * 同じ章の話を離して置くと、その章の見出しは 2 回出る。
     * 離して置いたのは作者なので、そのとおりに出すのが正しい。
     * 詰めて置けば 1 回に戻る。
     */
    const groups: ChapterGroup[] = [];
    let currentKey: string | null = "__start__";

    const push = (chapter: Chapter | null, episode: Episode) => {
        const last = groups[groups.length - 1];
        if (last && last.chapter?.id === chapter?.id && currentKey === (chapter?.id ?? null)) {
            last.items.push(episode);
            last.totalCount = last.items.length;
            return;
        }

        /* 部の見出しは、その中の章が始まるときに立てる */
        if (chapter?.parent_id) {
            const parent = byId.get(chapter.parent_id);
            const previous = groups[groups.length - 1];
            const partShown =
                previous &&
                (previous.chapter?.id === parent?.id ||
                    previous.parentId === parent?.id);

            if (parent && !partShown) {
                groups.push({
                    chapter: parent,
                    items: [],
                    depth: 0,
                    isBig: true,
                    parentId: null,
                    labelIndex: partNumber.get(parent.id) ?? 0,
                    totalCount: 0,
                });
            }
        }

        groups.push({
            chapter,
            items: [episode],
            depth: chapter?.parent_id ? 1 : 0,
            isBig: false,
            parentId: chapter?.parent_id ?? null,
            labelIndex: chapter ? (chapterNumber.get(chapter.id) ?? 0) : 0,
            totalCount: 1,
        });
        currentKey = chapter?.id ?? null;
    };

    for (const episode of episodes) {
        const chapter = episode.chapter_id ? byId.get(episode.chapter_id) : undefined;
        push(chapter ?? null, episode);
    }

    /*
     * 話の入っていない章も見出しだけ出す。
     *
     * 出さないと、作った章が消えたように見える。
     * 章そのものの並び順のところへ差し込む。
     */
    const shown = new Set(groups.map((g) => g.chapter?.id).filter(Boolean) as string[]);
    for (const chapter of chapters) {
        if (shown.has(chapter.id)) continue;
        if (isPart(chapter) && (childrenOf.get(chapter.id)?.length ?? 0) > 0) continue;

        groups.push({
            chapter,
            items: [],
            depth: chapter.parent_id ? 1 : 0,
            isBig: isPart(chapter),
            parentId: chapter.parent_id ?? null,
            labelIndex: isPart(chapter)
                ? (partNumber.get(chapter.id) ?? 0)
                : (chapterNumber.get(chapter.id) ?? 0),
            totalCount: 0,
        });
    }

    /* 部の話数は、その部にぶら下がる章の合計にそろえる */
    for (const group of groups) {
        if (!group.isBig || !group.chapter) continue;
        const partId = group.chapter.id;
        group.totalCount = groups
            .filter((g) => g.parentId === partId)
            .reduce((sum, g) => sum + g.items.length, 0);
    }

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

/**
 * 名前に番号が入っているか。
 *
 * 「第二章」「第3部」「2章」のように、作者が自分で
 * 番号を書いていることがある。
 * そこへこちらが番号の札を足すと、二重に出る。
 *
 * 先頭にあるものだけを見る。
 * 「英雄第一号の話」のような題名まで拾ってしまうため。
 */
export function hasOwnNumber(title: string | null | undefined): boolean {
    if (!title) return false;
    return /^\s*第?\s*[0-9０-９一二三四五六七八九十百]+\s*[章部話節幕]/.test(
        title.trim(),
    );
}
