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

/**
 * 章をまるごと 1 つ上（または下）へ動かす。
 *
 * ★ 章の並びは、中の話の並びで決まる（上の buildChapterGroups）。
 *   章の番号（sort_order）だけを入れ替えても、画面の並びも
 *   読者の目次も変わらない。前のドラッグはそれで効かなかった。
 *
 *   だから、章に入っている話をひとかたまりで動かす。
 *   となりの章（またはとなりのかたまり）と、中の話ごと入れ替える。
 *
 * ★ 同じ段の中で動かす。
 *   小さい章は、同じ部の中のとなりと入れ替える。
 *   部とふつうの章は、上の段のとなり（部・章・章に入れていない話）と入れ替える。
 *   部を動かすと、中の章ごと動く。
 *
 * ★ 話の入っていない章は動かせない（並びを決める話が無い）。
 *
 * groupAt は buildChapterGroups の何番目の見出しか。
 * 同じ章が離れて 2 回出るときも、押した方を動かすため。
 *
 * 返すのは、新しい話の並びと、それに合わせた章の並び。
 * 動かせないときは null。
 */
export function moveChapterGroup(
    chapters: Chapter[],
    episodes: Episode[],
    groupAt: number,
    step: -1 | 1,
): { episodeIds: string[]; chapterIds: string[] } | null {
    const groups = buildChapterGroups(chapters, episodes);
    const target = groups[groupAt];
    if (!target || !target.chapter) return null;

    /* 動かす単位。groups の何番目から何番目までか */
    type Unit = { start: number; end: number };
    const units: Unit[] = [];

    if (target.depth === 1 && target.parentId) {
        /* 小さい章：同じ部の、続いているところの中だけ */
        let a = groupAt;
        let b = groupAt;
        while (a - 1 >= 0 && groups[a - 1].parentId === target.parentId) a -= 1;
        while (b + 1 < groups.length && groups[b + 1].parentId === target.parentId) b += 1;
        for (let i = a; i <= b; i += 1) units.push({ start: i, end: i });
    } else {
        /* 上の段：部は中の章ごと 1 つにまとめる */
        const partOf = (g: ChapterGroup) =>
            g.parentId ?? (g.isBig && g.chapter ? g.chapter.id : null);
        let i = 0;
        while (i < groups.length) {
            const key = partOf(groups[i]);
            let j = i;
            if (key) {
                while (j + 1 < groups.length && partOf(groups[j + 1]) === key) j += 1;
            }
            units.push({ start: i, end: j });
            i = j + 1;
        }
    }

    const idsOf = (from: number, to: number) =>
        groups.slice(from, to + 1).flatMap((g) => g.items.map((ep) => ep.id));

    /* 話の入っているかたまりだけで数える */
    const filled = units.filter((u) => idsOf(u.start, u.end).length > 0);
    const at = filled.findIndex((u) => groupAt >= u.start && groupAt <= u.end);
    if (at < 0) return null;

    const other = at + step;
    if (other < 0 || other >= filled.length) return null;

    const first = filled[Math.min(at, other)];
    const second = filled[Math.max(at, other)];

    const episodeIds = [
        ...idsOf(0, first.start - 1),
        ...idsOf(second.start, second.end),
        ...idsOf(first.end + 1, second.start - 1),
        ...idsOf(first.start, first.end),
        ...idsOf(second.end + 1, groups.length - 1),
    ];

    /*
     * 章の番号（第一章・第二章）も、新しい並びに合わせる。
     * 話が出てくる順に章を拾い、部はその中の章より先に置く。
     * 話の入っていない章は、今の順のまま後ろへ。
     */
    const byId = new Map(chapters.map((c) => [c.id, c]));
    const episodeById = new Map(episodes.map((ep) => [ep.id, ep]));
    const chapterIds: string[] = [];
    const add = (id: string) => {
        if (!chapterIds.includes(id)) chapterIds.push(id);
    };
    for (const id of episodeIds) {
        const chapterId = episodeById.get(id)?.chapter_id;
        const chapter = chapterId ? byId.get(chapterId) : undefined;
        if (!chapter) continue;
        if (chapter.parent_id && byId.has(chapter.parent_id)) add(chapter.parent_id);
        add(chapter.id);
    }
    for (const chapter of chapters) add(chapter.id);

    return { episodeIds, chapterIds };
}

/**
 * 章を、別の章の場所まで動かす（パソコンでつまんで落としたとき）。
 *
 * ★ 前は章の番号だけを入れ替えていたので、落としても並びが変わらなかった。
 *   moveChapterGroup を 1 つずつ重ねて、落とした章の場所まで運ぶ。
 *   下へ運ぶときは落とした章の後ろ、上へ運ぶときは前に入る。
 *
 * 段が違う（部の中の章を、ほかの部の章の上に落とした など）ときや、
 * 話の入っていない章のときは動かさない（null）。
 */
export function moveChapterOnto(
    chapters: Chapter[],
    episodes: Episode[],
    fromId: string,
    toId: string,
): { episodeIds: string[]; chapterIds: string[] } | null {
    if (fromId === toId) return null;

    let nowEpisodes = episodes;
    let nowChapters = chapters;
    let result: { episodeIds: string[]; chapterIds: string[] } | null = null;

    const firstAt = (list: ChapterGroup[], id: string) =>
        list.findIndex((g) => g.chapter?.id === id && (g.items.length > 0 || g.isBig));

    const startGroups = buildChapterGroups(nowChapters, nowEpisodes);
    const from0 = firstAt(startGroups, fromId);
    const to0 = firstAt(startGroups, toId);
    if (from0 < 0 || to0 < 0) return null;
    if ((startGroups[from0].parentId ?? null) !== (startGroups[to0].parentId ?? null)) return null;

    const step: -1 | 1 = from0 < to0 ? 1 : -1;

    for (let guard = 0; guard < chapters.length + 2; guard += 1) {
        const groups = buildChapterGroups(nowChapters, nowEpisodes);
        const from = firstAt(groups, fromId);
        const to = firstAt(groups, toId);
        if (from < 0 || to < 0) break;
        if (step === 1 ? from > to : from < to) break;

        const next = moveChapterGroup(nowChapters, nowEpisodes, from, step);
        if (!next) break;
        result = next;

        const epOrder = new Map(next.episodeIds.map((id, at) => [id, at]));
        nowEpisodes = [...nowEpisodes].sort(
            (a, b) => (epOrder.get(a.id) ?? 0) - (epOrder.get(b.id) ?? 0),
        );
        const chOrder = new Map(next.chapterIds.map((id, at) => [id, at]));
        nowChapters = [...nowChapters].sort(
            (a, b) => (chOrder.get(a.id) ?? 0) - (chOrder.get(b.id) ?? 0),
        );
    }

    return result;
}
