/**
 * ============================================================
 * 原石航路 Studio
 * 運営が扱うもの
 *
 * GENSEKIKORO の管理機能から、いまの作りで動くものを持ってきた。
 *
 * 持ってこなかったもの（ログインと他人のデータが要る）:
 *   ユーザー管理／通報の確認／お問い合わせ／個別メッセージ／
 *   発掘の承認／受賞ブースト
 * これらは誰が誰かが分からないと成り立たない。
 * ============================================================
 */

/**
 * ------------------------------------------------------------
 * 利用者
 *
 * 運営だけが見る。ログインが要る。
 * ------------------------------------------------------------
 */

export type UserRole = "user" | "admin";

export const USER_ROLE_LABEL: Record<UserRole, string> = {
    user: "書き手",
    admin: "運営",
};

/**
 * 誰にも解除できない運営。
 *
 * 権限の付け外しは運営どうしでできてしまう。
 * 誤って外したときに戻す道が無くなるのを避けるため、
 * この人だけは変えられないようにしてある。
 *
 * 本当の守りは Supabase 側の引き金。
 * ここは、押せないボタンを見せないための目印。
 */
export const ROOT_ADMIN_EMAIL = "gensekikoro@gmail.com";

export interface AdminUser {
    user_id: string;
    /** 運営が見分けるために使う */
    email: string;
    display_name: string;
    bio: string;
    role: UserRole;
    /** 停止した日時。null なら使える */
    suspended_at: string | null;
    suspend_reason: string;
    /** 数え上げ。何を書いている人か掴むため */
    work_count: number;
    created_at: string;
}

/**
 * ------------------------------------------------------------
 * お知らせ
 * ------------------------------------------------------------
 */

export type NoticeType = "info" | "release" | "maintenance" | "important";

export const NOTICE_TYPE_LABEL: Record<NoticeType, string> = {
    info: "お知らせ",
    release: "新機能",
    maintenance: "メンテナンス",
    important: "重要",
};

export const NOTICE_TYPE_COLOR: Record<NoticeType, { text: string; bg: string }> = {
    info: { text: "#55605a", bg: "#eeeeec" },
    release: { text: "#1f4e6b", bg: "#e6eef4" },
    maintenance: { text: "#8a6410", bg: "#fbf2dc" },
    important: { text: "#b3372c", bg: "#fbeceb" },
};

export interface AdminNotice {
    id: string;
    type: NoticeType;
    title: string;
    body: string;
    /** 押したときの行き先。空なら開かない */
    link: string;
    /**
     * 添える画像。IndexedDB を指す目印。
     * ベルの一覧では小さく、詳しく見るときは大きく出す。
     */
    image_url: string | null;
    is_published: boolean;
    /** 表に出す日。未来の日付なら、その日まで出さない */
    published_at: string;
    created_at: string;
    updated_at: string;
}

/**
 * ------------------------------------------------------------
 * バナー
 *
 * ホームの左側に出す帯。
 * ------------------------------------------------------------
 */

export type BannerPlace = "home-side" | "contest-top";

export const BANNER_PLACE_LABEL: Record<BannerPlace, string> = {
    "home-side": "ホームの左",
    "contest-top": "コンテストの上",
};

export interface AdminBanner {
    id: string;
    title: string;
    /** 画像の目印。IndexedDB を指す */
    image_url: string | null;
    link_url: string;
    place: BannerPlace;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

/**
 * ------------------------------------------------------------
 * 使わない言葉
 *
 * 推敲チェックと繋げて、書いているときに知らせる。
 * ------------------------------------------------------------
 */

export interface NgWord {
    id: string;
    word: string;
    /** なぜ避けるか。書き手に伝える */
    reason: string;
    /** 言い換えの案 */
    suggestion: string;
    created_at: string;
}

/**
 * ------------------------------------------------------------
 * 機能の入切
 *
 * 作りかけの機能を、運営が出したり隠したりする。
 * ------------------------------------------------------------
 */

export type FeatureStatus = "off" | "preview" | "on";

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
    off: "オフ",
    preview: "試験公開",
    on: "公開",
};

export const FEATURE_STATUS_COLOR: Record<
    FeatureStatus,
    { text: string; bg: string }
> = {
    off: { text: "#7d867f", bg: "#eeeeec" },
    preview: { text: "#8a6410", bg: "#fbf2dc" },
    on: { text: "#1f4e6b", bg: "#e6eef4" },
};

export interface FeatureFlag {
    key: string;
    label: string;
    description: string;
    status: FeatureStatus;
    updated_at: string;
}

/** 入切できる機能。ここに並んでいるものだけを扱う */
export const FEATURE_DEFS: { key: string; label: string; description: string }[] = [
    { key: "rooms", label: "執筆室", description: "誰かと同じ場所で書く" },
    { key: "contest", label: "コンテスト", description: "作品を出す場" },
    { key: "ai-extract", label: "AI補助（資料の抽出）", description: "本文から候補を拾う" },
    { key: "ai-image", label: "AI補助（図案づくり）", description: "資料の絵を作る" },
    { key: "room-decorate", label: "部屋の模様替え", description: "家具を置く" },
    { key: "post", label: "作品投稿", description: "書いたものを世に出す" },
];

export function defaultFeatureFlags(): FeatureFlag[] {
    const timestamp = new Date().toISOString();
    return FEATURE_DEFS.map((row) => ({
        ...row,
        status: "on" as FeatureStatus,
        updated_at: timestamp,
    }));
}

/**
 * ============================================================
 * 決めた値かどうか確かめてから引く
 *
 * 保存先から来た値が、決めた並びのどれでもないことがある。
 * 直に添字で引くと undefined が返り、その先で落ちる。
 * ============================================================
 */

export function toNoticeType(value: unknown): NoticeType {
    return value === "release" || value === "maintenance" || value === "important"
        ? value
        : "info";
}

export function noticeColor(value: unknown) {
    return NOTICE_TYPE_COLOR[toNoticeType(value)];
}

export function noticeLabel(value: unknown): string {
    return NOTICE_TYPE_LABEL[toNoticeType(value)];
}

export function toFeatureStatus(value: unknown): FeatureStatus {
    return value === "off" || value === "preview" ? value : "on";
}

export function featureColor(value: unknown) {
    return FEATURE_STATUS_COLOR[toFeatureStatus(value)];
}
