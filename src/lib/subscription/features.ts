import { createClient } from "@/lib/supabase/server";
import { liveSubscriptionOf } from "@/lib/subscription/plans";

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
 *   graph_group  関係図を、所属で囲む・線を折れ曲がらせる
 * ============================================================
 */

export interface MemberFeatures {
    /** 関係図の囲みと、よけて回る線 */
    graphGroup: boolean;
}

const NONE: MemberFeatures = {
    graphGroup: false,
};

export async function memberFeatures(): Promise<MemberFeatures> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NONE;

    const live = await liveSubscriptionOf(user.id);

    if (!live) return NONE;

    const has = (ref: string) =>
        live.perks.some((perk) => perk.ref === ref);

    return {
        graphGroup: has("graph_group"),
    };
}
