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
 * ============================================================
 */

/** 最後に回した時刻。機械ごとに覚える */
let lastRunAt = 0;

/** 回す間隔。これより短い間は、何もしない */
const INTERVAL_MS = 60_000;

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
    } = {},
): Promise<number> {
    const now = Date.now();
    if (!options.force && now - lastRunAt < INTERVAL_MS) return 0;
    lastRunAt = now;

    try {
        const admin = createAdminClient();
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
                .select("id, novel_id")
                .or("is_published.is.null,is_published.eq.false")
                .not("scheduled_at", "is", null)
                .lte("scheduled_at", at),
            admin
                .from("episodes")
                .select("id, novel_id")
                .or("is_published.is.null,is_published.eq.false")
                .is("scheduled_at", null)
                .not("publish_at", "is", null)
                .lte("publish_at", at),
        ]);

        const due = [
            ...(byScheduled.data ?? []),
            ...(byPublishAt.data ?? []),
        ];

        if (due.length === 0) return 0;

        await admin
            .from("episodes")
            .update({
                is_published: true,
                published: true,
                scheduled_at: null,
                publish_at: null,
                /* 予約から出したぶんも、投稿した日時を残す */
                posted_at: new Date().toISOString(),
            })
            .in(
                "id",
                due.map((row) => row.id),
            );

        /*
         * 作品が下書きのままだと、話だけ出しても読めない。
         * 1 話でも出たら、作品も公開にする。
         */
        const novelIds = Array.from(new Set(due.map((row) => row.novel_id)));

        if (novelIds.length > 0) {
            await admin
                .from("novels")
                .update({ published: true, visibility: "public" })
                .in("id", novelIds)
                .eq("visibility", "draft");

            await admin
                .from("novels")
                .update({ published: true })
                .in("id", novelIds)
                .eq("published", false);

            /*
             * ★ 作品の側の時刻も、新しくする。
             *
             *   「最新話更新」は novels.updated_at で並べている。
             *   予約で話が出ても作品の時刻が変わらないと、
             *   その作品が上に来ない。
             *
             * ★ 公開に引き上げる条件とは、分けて書く。
             *   引き上げは「まだ下書きのとき」だけだが、
             *   時刻は出すたびに新しくする必要がある。
             */
            await admin
                .from("novels")
                .update({ updated_at: new Date().toISOString() })
                .in("id", novelIds);
        }

        return due.length;
    } catch {
        /*
         * 落ちても、頁は出す。
         * ここは片付けであって、読むための仕事ではない。
         */
        return 0;
    }
}
