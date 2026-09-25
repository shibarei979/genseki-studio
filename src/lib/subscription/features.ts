import { createClient } from "@/lib/supabase/server";
import { isOperator, liveSubscriptionOf } from "@/lib/subscription/plans";

/**
 * ============================================================
 * 原石航路 Studio
 * 会員だけが使えるもの
 *
 * ★ 回数の上限は scan-quota で見ている。
 *   こちらは「使えるか・使えないか」だけのもの。
 *
 * ★ 合言葉（ref）で持つ。
 *
 *   特典の種類を増やすと、表の決まりまで直すことになる。
 *   「上限を広げる（limit）」に合言葉を入れておけば、
 *   売り物の中身は、運営がその場で足せる。
 *
 *   graph_group   関係図を、所属で囲む・線を折れ曲がらせる
 *   entry_report  資料へのリンクで、資料を報告書の形で見る
 *
 * ★ 運営は、はじめから全部が使える。
 *
 *   払わずに、会員と同じものが見える状態にしておく。
 *   売り物を直すたびに自分で買い直すことにすると、
 *   帳簿にも乗るし、期間が切れれば確かめる手も止まる。
 * ============================================================
 */

export interface MemberFeatures {
    /** 関係図の囲みと、よけて回る線 */
    graphGroup: boolean;
    /** 資料の報告書 */
    entryReport: boolean;
    /** 運営として通っているか。画面に出すためのもの */
    operator: boolean;
}

const NONE: MemberFeatures = {
    graphGroup: false,
    entryReport: false,
    operator: false,
};

const ALL: MemberFeatures = {
    graphGroup: true,
    entryReport: true,
    operator: true,
};

export async function memberFeatures(): Promise<MemberFeatures> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NONE;

    if (await isOperator(user.id)) return ALL;

    const live = await liveSubscriptionOf(user.id);

    if (!live) return NONE;

    const has = (ref: string) =>
        live.perks.some((perk) => perk.ref === ref);

    return {
        graphGroup: has("graph_group"),
        entryReport: has("entry_report"),
        operator: false,
    };
}
