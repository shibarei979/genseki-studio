/**
 * ============================================================
 * トップページ (home_10 デザイン) 共通型
 * ============================================================
 */

/** 本の統一フォーマット（public/home/home.js の BookTemplate と同一キー） */
export interface HomeBook {
    id: string;
    href: string;
    title: string;
    author: string;
    tags: string[];
    /** 最初の本文数行（第1話冒頭） */
    head: string;
    /** 本文抜粋（キャッチコピー / あらすじ） */
    excerpt: string;
    /** 読者の発掘コメント */
    comment: string;
    likes: number;
    /** 準備中の埋め草（クリック無効・ポップアップ非表示） */
    placeholder?: boolean;
}

/** お知らせ・コンテスト共通の表示フォーマット */
export interface HomeNotice {
    id: string;
    href: string;
    image: string;
    /** MM/DD 表記 */
    time: string;
    title: string;
    detail: string;
}
