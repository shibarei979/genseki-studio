/**
 * ============================================================
 * 原石航路 Studio
 * Profile Types（書き手のプロフィール）
 *
 * ログインがまだ無いので、端末の中だけで持つ。
 * Supabase へ移ったときに profiles テーブルへそのまま移せる形にしておく。
 * ============================================================
 */

export interface Profile {
    /** 1 端末に 1 つなので固定 */
    id: "self";
    display_name: string;
    /** ペンネームの読み。並び替えや検索のため */
    name_reading: string;
    bio: string;
    /** アイコンの色。0〜359 */
    avatar_hue: number;
    /** 外部アカウント。投稿サイトができたら表示に使う */
    x_account: string;
    /**
     * ホームの見せ方。
     *   write  ふつう
     *   focus  執筆に集中（数字と他の人の痕跡を隠す）
     */
    home_mode?: string | null;
    website: string;
    /** 受け取り済みのミッション。受け取ると一覧から消える */
    claimed_missions: string[];
    /** 使い始めた日。「書き手になって◯日」を出すのに使う */
    started_at: string;
    updated_at: string;

    /*
     * ------------------------------------------------------------
     * Supabase の profiles にある列
     *
     * GENSEKIKORO と同じ表を見ているので、
     * あちらの画面が使う列も持っておく。
     * 手元だけで動かすときは空でよい。
     * ------------------------------------------------------------
     */

    /** ログインしている人の id */
    user_id?: string;
    email?: string;
    /** 絵。設定していなければ空 */
    icon_url?: string | null;
    login_provider?: string;
    /** 通し番号。「◯番目の書き手」 */
    user_number?: number | null;
    created_at?: string;
    gender?: string | null;
    is_admin?: boolean;
    frozen?: boolean;
    allow_comments?: boolean;
    default_ai_usage?: string | null;
    show_ai_works?: boolean;
    celebrated_first_like?: boolean;
    celebrated_first_discover?: boolean;
}

export function defaultProfile(): Profile {
    const timestamp = new Date().toISOString();
    return {
        id: "self",
        display_name: "名無しの書き手",
        name_reading: "",
        bio: "",
        // 航路の青あたり。あとから自由に変えられる
        avatar_hue: 205,
        x_account: "",
        website: "",
        claimed_missions: [],
        started_at: timestamp,
        updated_at: timestamp,
    };
}

/** 使い始めてからの日数 */
export function daysSince(iso: string): number {
    const start = new Date(iso).getTime();
    if (Number.isNaN(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}
