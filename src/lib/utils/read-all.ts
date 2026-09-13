/**
 * ============================================================
 * 原石航路 Studio
 * readAll — 表から、全部を分けて取る
 *
 * ★ limit は効かない。
 *
 *   PostgREST は、既定で 1000 行までしか返さない。
 *   limit(50000) と書いても、そこで頭打ちになる。
 *
 *   閲覧の記録や星のように、行が増える表では
 *   途中から数え落とす。
 *   「読まれている作品ほど、数字が小さく出る」という
 *   ねじれた狂い方をする。
 *
 * ★ range で区切って、返らなくなるまで繰り返す。
 *
 * ★ 使い方
 *
 *     const rows = await readAll((from, to) =>
 *       supabase.from('page_views')
 *         .select('episode_id')
 *         .in('episode_id', ids)
 *         .range(from, to),
 *     )
 *
 * ★ 問い合わせは、毎回組み直すこと。
 *
 *   Supabase の問い合わせは一度きりのもの。
 *   1 つ作って range だけ変えて使い回すと、
 *   二度目から正しく走らない。
 *   だから「作る式」を渡してもらう形にしてある。
 * ============================================================
 */

/** 一度に取る行数。PostgREST の既定に合わせる */
const PAGE = 1000;

/** 取りすぎを止める。表が壊れていても、無限には回らない */
const MAX_ROWS = 200000;

export async function readAll<T = Record<string, unknown>>(
    build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
    const rows: T[] = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE) {
        const { data } = await build(from, from + PAGE - 1);

        if (!data || data.length === 0) break;

        rows.push(...data);

        /* 満たなければ、そこで終わり */
        if (data.length < PAGE) break;
    }

    return rows;
}

export default readAll;
