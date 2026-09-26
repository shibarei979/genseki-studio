import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * 原石航路 Studio
 * publishDueEpisodes — 時間の来た予約を出す
 *
 * ★ なぜ切り出したか。
 *
 *   前は定時の見回り（/api/cron/publish）だけがこれをしていた。
 *   その見回りが止まると、誰も気づかないまま
 *   予約が溜まる。実際に 15 件が 2 日ぶん止まった。
 *
 *   同じ仕事を、ホームが開かれたときにも回す。
 *   人が来ればそのたびに片付くので、
 *   見回りが止まっても止まったままにはならない。
 *
 * ★ 頁を重くしない。
 *
 *   ホームは何度も開かれる。
 *   毎回表を叩くと、そのぶん待たせる。
 *   最後に回した時刻を覚えて、間を空ける。
 *
 *   この覚えは機械ごと。Vercel は同じ頁でも
 *   別の機械で組み立てることがあるので、
 *   そのぶん多めに回ることはある。害はない。
 *
 * ★ 待たせない。
 *
 *   呼ぶ側は待たなくてよい。
 *   出るのが数秒遅れても困らないが、
 *   ホームの表示が遅れるのは困る。
 *
 * ------------------------------------------------------------
 * ここからは、あとで足したもの。
 *
 * ★ 予約の時刻を、消さずに残す。
 *
 *   前は出したあとに publish_at と scheduled_at を空にしていた。
 *   すると「予定どおりに出たのか、早く出てしまったのか」を
 *   あとから確かめる手がかりが、どこにも残らない。
 *
 *   「予約したのに普通に投稿された」という声が来たとき、
 *   表を見ても、出た時刻しか分からなかった。
 *
 *   もう一度拾われることはない。
 *   拾う条件が「まだ出していない話」だから。
 *   消す必要は初めから無かった。
 *
 * ★ 作品を勝手に公開しない。
 *
 *   前は、話の予約が来たら作品も公開に引き上げていた。
 *   初めて出す人のためだが、これだと
 *   「一度公開した作品を下書きに戻した」人まで巻き込む。
 *   戻したのは、その人が意図してやったこと。
 *
 *   引き上げるのは、まだ一話も出していない作品だけにする。
 *   すでに出したことがある作品が隠してあるなら、
 *   その予約は出さずに置いておく。
 *
 * ★ 出したことを控える。
 *
 *   誰が出したのか（作者か、この見回りか）が分からないと、
 *   声が来たときに調べようがない。
 *   一行ずつ控えを残す。
 * ============================================================
 */

/** 最後に回した時刻。機械ごとに覚える */
let lastRunAt = 0;

/** 回す間隔。これより短い間は、何もしない */
const INTERVAL_MS = 60_000;

interface Due {
    id: string;
    novel_id: string;
    publish_at: string | null;
    scheduled_at: string | null;
}

export async function publishDueEpisodes(
    options: {
        /**
         * 間を空ける決まりを外す。
         *
         * 定時の見回りから呼ぶときに使う。
         * あちらは呼ばれた時点で回すのが仕事なので、
         * 間を空けると出るのが遅れる。
         */
        force?: boolean;

        /** 控えに残す、呼ばれ方の名前 */
        from?: string;
    } = {},
): Promise<number> {
    const now = Date.now();
    if (!options.force && now - lastRunAt < INTERVAL_MS) return 0;
    lastRunAt = now;

    const admin = createAdminClient();
    const from = options.from ?? (options.force ? "cron" : "home");

    try {
        const at = new Date().toISOString();

        /*
         * 予約の時刻は 2 か所にある。
         *
         *   scheduled_at  こちらが本命
         *   publish_at    古い予約はこちらにしか入っていない
         *
         * ★ is_published が null の話も拾う。
         *
         *   neq("is_published", true) は null を弾く。
         *   is("is_published", false) も null を弾く。
         *   表の世界では「null は true でも false でもない」ため。
         *
         *   null の話が 1 つでもできると、その話は
         *   永久に出ないまま残る。「null または false」で絞る。
         */
        const [byScheduled, byPublishAt] = await Promise.all([
            admin
                .from("episodes")
                .select("id, novel_id, publish_at, scheduled_at")
                .or("is_published.is.null,is_published.eq.false")
                .not("scheduled_at", "is", null)
                .lte("scheduled_at", at),
            admin
                .from("episodes")
                .select("id, novel_id, publish_at, scheduled_at")
                .or("is_published.is.null,is_published.eq.false")
                .is("scheduled_at", null)
                .not("publish_at", "is", null)
                .lte("publish_at", at),
        ]);

        const due = [
            ...((byScheduled.data ?? []) as Due[]),
            ...((byPublishAt.data ?? []) as Due[]),
        ];

        if (due.length === 0) return 0;

        const novelIds = Array.from(new Set(due.map((row) => row.novel_id)));

        /*
         * 作品の側の姿を、先に読む。
         *
         * ★ 隠してある作品の話は、出さない。
         *   ただし、まだ一話も出していない作品は別。
         *   そちらは「これから初めて出す」ところなので、
         *   作品ごと公開に引き上げる。
         */
        const { data: novelRows } = await admin
            .from("novels")
            .select("id, visibility, published")
            .in("id", novelIds);

        const novels = new Map(
            (novelRows ?? []).map((row) => [
                row.id as string,
                {
                    visibility: (row.visibility as string) ?? "draft",
                    published: row.published === true,
                },
            ]),
        );

        /* すでに一話でも出したことのある作品 */
        const { data: doneRows } = await admin
            .from("episodes")
            .select("novel_id")
            .in("novel_id", novelIds)
            .eq("is_published", true);

        const everPosted = new Set(
            (doneRows ?? []).map((row) => row.novel_id as string),
        );

        const going: Due[] = [];
        const held: { row: Due; why: string }[] = [];

        for (const row of due) {
            const novel = novels.get(row.novel_id);

            if (!novel) {
                held.push({ row, why: "作品が見つからない" });
                continue;
            }

            /*
             * ★ 限定公開も出す。
             *   前は「公開」のときだけ出していたので、限定公開の作品の予約は
             *   一度でも話を出したあとだと、ずっと止まったままだった。
             *   限定公開は「見せる相手を絞っている」だけで、隠しているのではない。
             */
            if (novel.visibility === "public" || novel.visibility === "limited") {
                going.push(row);
                continue;
            }

            if (!everPosted.has(row.novel_id)) {
                /* 初めて出す作品。作品ごと引き上げる */
                going.push(row);
                continue;
            }

            /*
             * ★ 一度出したことがあるのに、いま隠してある。
             *
             *   作者が自分で戻したということなので、
             *   こちらで公開に引き上げない。
             *   予約はそのまま残す。作者が作品を出せば、
             *   次の見回りで出る。
             */
            held.push({ row, why: `作品が${novel.visibility}のまま` });
        }

        /* 出せなかったものも、控えには残す */
        if (held.length > 0) {
            await note(
                admin,
                held.map(({ row, why }) => ({
                    episode_id: row.id,
                    novel_id: row.novel_id,
                    planned_at: row.scheduled_at ?? row.publish_at,
                    result: "held",
                    detail: why,
                    source: from,
                })),
            );
        }

        if (going.length === 0) return 0;

        const posted = new Date().toISOString();

        /*
         * ★ 予約の時刻は消さない。
         *
         *   もう一度拾われることはない。
         *   拾う条件は「まだ出していない話」なので、
         *   出した時点で外れる。
         *
         *   残しておけば、出た時刻（posted_at）と
         *   出す予定だった時刻を、あとから見比べられる。
         */
        const { error } = await admin
            .from("episodes")
            .update({
                is_published: true,
                published: true,
                posted_at: posted,
                /* 誰が出したか。作者が押したものと見分ける */
                published_by: from,
            })
            .in(
                "id",
                going.map((row) => row.id),
            );

        if (error) {
            await note(admin, [
                {
                    episode_id: null,
                    novel_id: null,
                    planned_at: null,
                    result: "error",
                    detail: error.message,
                    source: from,
                },
            ]);

            return 0;
        }

        await note(
            admin,
            going.map((row) => ({
                episode_id: row.id,
                novel_id: row.novel_id,
                planned_at: row.scheduled_at ?? row.publish_at,
                result: "posted",
                detail: "",
                source: from,
            })),
        );

        /*
         * 作品の側。
         *
         * ★ 引き上げるのは、まだ一話も出していない作品だけ。
         *   隠してある作品を、こちらで公開に戻さない。
         */
        const raise = Array.from(
            new Set(
                going
                    .filter((row) => !everPosted.has(row.novel_id))
                    .map((row) => row.novel_id),
            ),
        );

        if (raise.length > 0) {
            await admin
                .from("novels")
                .update({ published: true, visibility: "public" })
                .in("id", raise)
                .eq("visibility", "draft");

            await admin
                .from("novels")
                .update({ published: true })
                .in("id", raise)
                .eq("published", false);
        }

        /*
         * ★ 作品の側の時刻は、出したものすべてで新しくする。
         *
         *   「最新話更新」は novels.updated_at で並べている。
         *   予約で話が出ても作品の時刻が変わらないと、
         *   その作品が上に来ない。
         */
        const touched = Array.from(
            new Set(going.map((row) => row.novel_id)),
        );

        await admin
            .from("novels")
            .update({ updated_at: new Date().toISOString() })
            .in("id", touched);

        return going.length;
    } catch (caught) {
        /*
         * 落ちても、頁は出す。
         * ここは片付けであって、読むための仕事ではない。
         *
         * ★ ただし、黙って消さない。
         *   前は何も残さなかったので、
         *   止まっていることに誰も気づけなかった。
         */
        try {
            await note(admin, [
                {
                    episode_id: null,
                    novel_id: null,
                    planned_at: null,
                    result: "error",
                    detail:
                        caught instanceof Error ? caught.message : String(caught),
                    source: from,
                },
            ]);
        } catch {
            /* 控えも残せないときは、諦める */
        }

        return 0;
    }
}

/** 控えを残す。残せなくても、出すほうは止めない */
async function note(
    admin: ReturnType<typeof createAdminClient>,
    rows: {
        episode_id: string | null;
        novel_id: string | null;
        planned_at: string | null;
        result: string;
        detail: string;
        source: string;
    }[],
): Promise<void> {
    if (rows.length === 0) return;

    try {
        await admin.from("publish_log").insert(rows);
    } catch {
        /* 控えが残らなくても、出すほうは済んでいる */
    }
}
