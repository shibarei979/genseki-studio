import { createAdminClient } from "@/lib/supabase/admin";
import { grantFreePoints } from "@/lib/points";

/**
 * ============================================================
 * 原石航路 Studio
 * 友だち招待キャンペーン
 *
 *   1. 招待する人が、自分の招待リンク（/?invite=コード）を共有する
 *   2. 招待された人が、そのリンクから来て登録する（invite_uses に 1 行）
 *   3. 招待された人が、どれか 1 話を最後まで読む（page_views.is_valid_read）
 *   4. そこで二人に INVITE_POINTS ずつ届く
 *
 * ★ 1 人が招待できるのは MAX_INVITES 人まで。
 * ★ 作ったばかりの捨てアカウントで稼がれないよう、「1 話読んだら」にしている。
 * ★ 二重に配らない。
 *   invite_uses.rewarded_at を「まだ空なら書く」で書き、書けたときだけ配る。
 *   配る側も grantFreePoints(once) と表の決まり（invite.sql）で止める。
 * ============================================================
 */

/** 今だけ 100pt（キャンペーン）。ふだんは 50pt の予定 */
export const INVITE_POINTS = 100;
/** 1 人が招待できる人数 */
export const MAX_INVITES = 10;
/** 招待として受け付ける、登録してからの日数（古いアカウントを後から招待扱いにさせない） */
export const CLAIM_WITHIN_DAYS = 14;

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
    let out = "";
    for (let i = 0; i < 8; i += 1) out += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return out;
}

/** 自分の招待コード。無ければ作る */
export async function inviteCodeOf(userId: string): Promise<string | null> {
    const admin = createAdminClient();
    const { data } = await admin.from("invite_codes").select("code").eq("user_id", userId).maybeSingle();
    if (data?.code) return data.code as string;

    for (let tries = 0; tries < 5; tries += 1) {
        const code = newCode();
        const { error } = await admin.from("invite_codes").insert({ user_id: userId, code });
        if (!error) return code;
        /* 同時に作られていたら、それを使う */
        const { data: again } = await admin.from("invite_codes").select("code").eq("user_id", userId).maybeSingle();
        if (again?.code) return again.code as string;
    }
    return null;
}

/**
 * 招待リンクから来た人を、招待された人として控える。
 *
 * ★ 受け付けないとき
 *   ・コードが無い／自分のコード
 *   ・もう誰かの招待で控えてある
 *   ・登録してから CLAIM_WITHIN_DAYS 日より経っている
 *   ・招待した人が、もう MAX_INVITES 人招待している
 */
export async function claimInvite(options: {
    inviteeId: string;
    inviteeCreatedAt: string | undefined;
    code: string;
}): Promise<{ ok: boolean; error?: string; final?: boolean }> {
    const code = options.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return { ok: false, error: "招待コードが違います", final: true };

    const created = options.inviteeCreatedAt ? new Date(options.inviteeCreatedAt).getTime() : 0;
    if (!created || Date.now() - created > CLAIM_WITHIN_DAYS * 24 * 60 * 60 * 1000) {
        return { ok: false, error: "招待は、はじめて登録した方だけが受けられます", final: true };
    }

    const admin = createAdminClient();

    const { data: owner } = await admin.from("invite_codes").select("user_id").eq("code", code).maybeSingle();
    if (!owner) return { ok: false, error: "招待コードが見つかりません", final: true };
    const inviterId = owner.user_id as string;
    if (inviterId === options.inviteeId) return { ok: false, error: "自分の招待は使えません", final: true };

    const { data: mine } = await admin
        .from("invite_uses")
        .select("inviter_id")
        .eq("invitee_id", options.inviteeId)
        .maybeSingle();
    if (mine) return { ok: true, final: true };

    const { count } = await admin
        .from("invite_uses")
        .select("invitee_id", { count: "exact", head: true })
        .eq("inviter_id", inviterId);
    if ((count ?? 0) >= MAX_INVITES) {
        return { ok: false, error: "この招待リンクは、もう上限の人数に達しています", final: true };
    }

    const { error } = await admin.from("invite_uses").insert({
        invitee_id: options.inviteeId,
        inviter_id: inviterId,
        code,
    });
    /* 同時に 2 回来たときは、あとの方が弾かれる（invitee_id が主キー） */
    if (error && error.code !== "23505") return { ok: false, error: error.message };

    await rewardInviteIfReady(options.inviteeId);
    return { ok: true, final: true };
}

/**
 * 招待された人が 1 話読み終えていたら、二人に配る。
 *
 * ★ 何度呼んでもよい。配るのは 1 回だけ。
 */
export async function rewardInviteIfReady(inviteeId: string): Promise<boolean> {
    const admin = createAdminClient();

    const { data: use } = await admin
        .from("invite_uses")
        .select("inviter_id, rewarded_at")
        .eq("invitee_id", inviteeId)
        .maybeSingle();
    if (!use || use.rewarded_at) return false;

    const { data: read } = await admin
        .from("page_views")
        .select("id")
        .eq("user_id", inviteeId)
        .eq("is_valid_read", true)
        .limit(1);
    if (!read || read.length === 0) return false;

    const inviterId = use.inviter_id as string;

    /*
     * ★ 同じ端末（同じブラウザ）で作った 2 つ目のアカウントには配らない。
     *   読んだ記録に残る端末の札（visitor_id）が、招待した人と重なっていたら止める。
     *   1 人で何個もアカウントを作って、自分で自分を招待するのを防ぐため。
     *   （止めたものは「まだ」のまま。数には入るが、ポイントは届かない）
     */
    if (await sameDevice(inviterId, inviteeId)) return false;

    /* 先に「配った」と書く。書けた方だけが配る */
    const { data: marked } = await admin
        .from("invite_uses")
        .update({ rewarded_at: new Date().toISOString() })
        .eq("invitee_id", inviteeId)
        .is("rewarded_at", null)
        .select("invitee_id");
    if (!marked || marked.length === 0) return false;

    await Promise.all([
        grantFreePoints({
            userId: inviteeId,
            amount: INVITE_POINTS,
            source: "invite",
            sourceRef: `invited-by:${inviterId}`,
            once: true,
        }),
        grantFreePoints({
            userId: inviterId,
            amount: INVITE_POINTS,
            source: "invite",
            sourceRef: `invited:${inviteeId}`,
            once: true,
        }),
    ]);

    /* 二人に知らせる（うまくいかなくても配ったことは変わらない） */
    try {
        const { data: people } = await admin
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", [inviteeId, inviterId]);
        const nameOf = (id: string) =>
            ((people ?? []).find((one) => one.user_id === id)?.display_name as string | undefined) || "名無し";
        await admin.from("notifications").insert([
            {
                user_id: inviterId,
                type: "announcement",
                message: `招待した${nameOf(inviteeId)}さんが 1 話読みました。無料ポイント ${INVITE_POINTS}pt が届きました`,
                link: "/mypage#mission",
            },
            {
                user_id: inviteeId,
                type: "announcement",
                message: `${nameOf(inviterId)}さんの招待で、無料ポイント ${INVITE_POINTS}pt が届きました`,
                link: "/mypage#mission",
            },
        ]);
    } catch {
        /* 知らせは、無くても困らない */
    }

    return true;
}

/** 二人が同じ端末（visitor_id）で読んだことがあるか */
async function sameDevice(inviterId: string, inviteeId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data: mine } = await admin
        .from("page_views")
        .select("visitor_id")
        .eq("user_id", inviteeId)
        .not("visitor_id", "is", null)
        .limit(200);
    const ids = Array.from(new Set((mine ?? []).map((row) => row.visitor_id as string).filter(Boolean)));
    if (ids.length === 0) return false;
    const { data: hit } = await admin
        .from("page_views")
        .select("id")
        .eq("user_id", inviterId)
        .in("visitor_id", ids)
        .limit(1);
    return !!hit && hit.length > 0;
}

/** マイページの招待の窓に出すもの */
export async function inviteSummaryOf(userId: string, createdAt?: string) {
    const admin = createAdminClient();
    const code = await inviteCodeOf(userId);
    const { data } = await admin
        .from("invite_uses")
        .select("invitee_id, rewarded_at, created_at")
        .eq("inviter_id", userId)
        .order("created_at", { ascending: true });
    const rows = data ?? [];

    /* 自分が招待された側として、あとからコードを入れられるか（登録して間もなく、まだ誰の招待も受けていない） */
    const { data: invited } = await admin
        .from("invite_uses")
        .select("invitee_id")
        .eq("invitee_id", userId)
        .maybeSingle();
    const created = createdAt ? new Date(createdAt).getTime() : 0;
    const canEnter =
        !invited && !!created && Date.now() - created <= CLAIM_WITHIN_DAYS * 24 * 60 * 60 * 1000;

    return {
        canEnter,
        code,
        points: INVITE_POINTS,
        max: MAX_INVITES,
        joined: rows.length,
        rewarded: rows.filter((row) => row.rewarded_at).length,
    };
}
