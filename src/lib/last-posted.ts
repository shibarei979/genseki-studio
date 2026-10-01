/**
 * ============================================================
 * 原石航路 Studio
 * 作品の「更新日」（いちばん新しく出た話の公開日）と、出た話の文字数
 *
 *   ランキング・作品を探す の「更新」はここで出す。
 *
 * ★ 更新日＝出た話（is_published）の posted_at のいちばん新しいもの。
 *   posted_at が空の古い話だけ、作った日（created_at）で代える。
 *
 * ★ 1 回で読める行は 1,000 件まで（サーバーの決まり）。
 *   limit(5000) と書いても 1,000 件で切られる。
 *   長い連載が何作も並ぶと 1,000 話を超え、
 *   後ろの作品の話が読めず、作品を作った日が「更新」に出ていた。
 *   ここでは 1,000 件ずつ、読み切るまで続けて取る。
 * ============================================================
 */

const PAGE = 1000;
/** 1 回に並べる作品の数（住所が長くなりすぎないように） */
const IDS_AT_ONCE = 100;

type Client = any;

export async function lastPostedOf(
    supabase: Client,
    novelIds: string[],
    options: { withChars?: boolean } = {},
): Promise<{ last: Record<string, string>; chars: Record<string, number> }> {
    const last: Record<string, string> = {};
    const chars: Record<string, number> = {};
    const ids = Array.from(new Set(novelIds.filter(Boolean)));
    const columns = options.withChars ? "id, novel_id, posted_at, created_at, body" : "id, novel_id, posted_at, created_at";

    for (let at = 0; at < ids.length; at += IDS_AT_ONCE) {
        const some = ids.slice(at, at + IDS_AT_ONCE);
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
                .from("episodes")
                .select(columns)
                .in("novel_id", some)
                .eq("is_published", true)
                .order("id", { ascending: true })
                .range(from, from + PAGE - 1);
            if (error || !data) break;

            for (const ep of data as { novel_id: string; posted_at: string | null; created_at: string | null; body?: string | null }[]) {
                const when = ep.posted_at || ep.created_at;
                if (when && (!last[ep.novel_id] || when > last[ep.novel_id])) last[ep.novel_id] = when;
                if (options.withChars) chars[ep.novel_id] = (chars[ep.novel_id] || 0) + (ep.body?.length || 0);
            }
            if (data.length < PAGE) break;
        }
    }
    return { last, chars };
}
