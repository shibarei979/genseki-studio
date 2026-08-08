/**
 * ============================================================
 * 原石航路 Studio
 * 読者からの反応
 *
 * 列の名前は、すでに動いている表に合わせる。
 * こちらで作り直すと、GENSEKIKORO 側と食い違う。
 *
 * ------------------------------------------------------------
 * 気をつけるところ
 *
 *   likes         … 作品への「好き」。話ではない
 *   episode_likes … 話への「好き」。こちらは話ごと
 *   follows       … follower_id が追いかける側、following_id が追われる側
 *   read_episodes … 読んだ話。1 話ごとに 1 行増える
 * ============================================================
 */

/** 作品への好き */
export interface NovelLike {
    user_id: string;
    novel_id: string;
    created_at: string;
}

/** 話への好き */
export interface EpisodeLike {
    id: string;
    episode_id: string;
    user_id: string;
    created_at: string;
}

/** 保存。folder_id で仕分けられる */
export interface Bookmark {
    user_id: string;
    novel_id: string;
    folder_id: string | null;
    created_at: string;
}

/**
 * フォロー。
 * follower_id が追いかける側、following_id が追われる側。
 */
export interface Follow {
    id: string;
    follower_id: string | null;
    following_id: string | null;
    created_at: string;
}

/**
 * コメント。
 *
 * episode_id が入っていれば話へのコメント、
 * 空なら作品へのコメント。
 * rating が入っていればレビューを兼ねる。
 */
export interface NovelComment {
    id: string;
    novel_id: string;
    user_id: string;
    body: string;
    is_pinned: boolean;
    created_at: string;

    episode_id: string | null;
    parent_id: string | null;
    reply_to_id: string | null;
    reply_to_name: string | null;
    quoted_text: string | null;
    is_muted: boolean;
    /** 1〜5。作品への評価を兼ねるとき */
    rating: number | null;
}

/** 読んだ話 */
export interface ReadEpisode {
    id: string;
    user_id: string;
    novel_id: string;
    episode_id: string;
    created_at: string;
}

/**
 * 発掘。
 *
 * まだ知られていない作品を見つけて広める。
 * comment に、なぜ良いと思ったかを添えられる。
 */
export interface Discover {
    user_id: string;
    novel_id: string;
    comment: string | null;
    display_name: string | null;
    is_pending: boolean;
    pending_reason: string | null;
    created_at: string;
}

/** シリーズ */
export interface Series {
    id: string;
    user_id: string | null;
    title: string;
    description: string;
    cover_url: string | null;
    order_num: number;
    created_at: string;
    updated_at: string;
}

/** シリーズと作品の対応 */
export interface SeriesNovel {
    id: string;
    series_id: string | null;
    novel_id: string | null;
    order_num: number;
    created_at: string;
}

/**
 * ------------------------------------------------------------
 * 作品（投稿サイト側の見え方）
 *
 * Studio の Work と同じ表だが、見る列が違う。
 * あちらの画面をそのまま動かすために、
 * あちらの形も持っておく。
 * ------------------------------------------------------------
 */
export interface Novel {
    id: string;
    author_id: string;
    title: string;
    summary: string | null;
    genre: string;
    tags: string[];
    is_serial: boolean;
    published: boolean;
    views: number;
    created_at: string;
    updated_at: string;

    /* 一緒に取ってくるもの */
    author?: {
        user_id?: string;
        display_name?: string;
        icon_url?: string | null;
    };
    counts?: NovelCounts;
}

export interface NovelCounts {
    novel_id: string;
    like_count: number;
    bookmark_count: number;
    discover_count: number;
    comment_count: number;
}
