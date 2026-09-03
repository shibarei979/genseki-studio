/**
 * ============================================================
 * 原石航路 Studio
 * Work Types（作品）
 *
 * プロパティ名は snake_case。将来 Supabase のカラム名と
 * 1:1 で対応させ、変換レイヤーを不要にするため。
 * ============================================================
 */

/**
 * 作品ステータスは廃止した。
 *
 * 「非公開 / 執筆中 / 公開準備中 / 公開中」は、
 * 公開設定の「公開範囲（下書き・限定公開・公開）」と
 * 「連載状態（連載中・完結・休載）」の組み合わせで全部表せる。
 * 同じことを 2 か所で持つと必ず食い違い、どちらが本当か分からなくなる。
 *
 * 一覧に出す見出しが要るときは formatWorkState() を使う。
 */

/** 年齢区分 */
export type AgeRating = "all" | "r15" | "r18";

export interface Work {
    id: string;
    title: string;
    /** キャッチコピー */
    catchphrase: string | null;
    genre: string;
    tags: string[];
    /** あらすじ */
    summary: string | null;
    /** 作者メモ（作者のみ閲覧） */
    author_note: string | null;
    age_rating: AgeRating;
    /**
     * 作者がすすめる読む向き。
     *
     * 縦書きを前提に組んだ作品もあれば、
     * 横書きで読んでほしい作品もある。
     *
     * 決めていなければ null。
     * 読む人の設定を書き換えはせず、印を出すだけ。
     */
    recommended_mode?: "vertical" | "horizontal" | null;
    keywords: string[];
    /** カバー画像 URL。v1 では未使用 */
    cover_url: string | null;
    /** 表紙の絵が無いときに出す札 */
    cover_tile?: CoverTile | null;
    /**
     * 表紙に AI を使ったか。
     *
     * 本文のほうの ai_usage とは別に持つ。
     * 本文は自分で書き、表紙だけ AI という人がいる。
     * ひとつにまとめると、その区別が付かない。
     */
    cover_is_ai?: boolean | null;
    /** 作品の形 */
    format?: WorkFormat | null;
    /** AI をどう使ったか */
    ai_usage?: AiUsage | null;
    /**
     * ジャンルを最後に変えた日時。
     *
     * 公開したあとのジャンルは、週に 1 回までしか変えられない。
     * 上位に出るジャンルへ移し替える使い方を防ぐため。
     * 一度も変えていなければ null。
     */
    genre_changed_at?: string | null;
    /**
     * ゴミ箱に入った日時。null なら生きている。
     * 消す操作をすぐ本当の削除にしない。
     * 書いたものを取り違えて消したときに戻せないのは致命的なので。
     */
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * 作品作成時の入力。未指定の項目は既定値で埋める。
 * キャッチコピーはここに含めず、作品情報の設定画面で編集する。
 */
/**
 * 表紙に添える札。
 *
 * 絵を用意していない作品でも、
 * 並んだときに見分けがつくようにする。
 */
export type CoverTile = "book" | "feather" | "sparkle";

export const COVER_TILES: {
    key: CoverTile;
    label: string;
    src: string;
    bg: string;
}[] = [
    { key: "book", label: "本", src: "/icons/tile-book.png", bg: "#eaf0f5" },
    {
        key: "feather",
        label: "羽根",
        src: "/icons/tile-feather.png",
        bg: "#eef3ee",
    },
    {
        key: "sparkle",
        label: "きらめき",
        src: "/icons/tile-sparkle.png",
        bg: "#faf3e3",
    },
];

/** 決めていない作品は、id から割り振る */
export function tileOf(work: { id: string; cover_tile?: CoverTile | null }) {
    if (work.cover_tile) {
        const found = COVER_TILES.find((row) => row.key === work.cover_tile);
        if (found) return found;
    }

    let hash = 0;
    for (let i = 0; i < work.id.length; i += 1) {
        hash = (hash * 31 + work.id.charCodeAt(i)) | 0;
    }
    return COVER_TILES[Math.abs(hash) % COVER_TILES.length];
}

/**
 * 作品の形。
 *
 * 長さの見当がつくと、読み手が手に取りやすい。
 * 書き手にとっても、どこまで書くかの目安になる。
 */
export type WorkFormat = "long" | "short";

export const WORK_FORMAT_LABEL: Record<WorkFormat, string> = {
    long: "長編",
    short: "短編",
};

export const WORK_FORMAT_DESCRIPTION: Record<WorkFormat, string> = {
    long: "何話にも分けて書き継ぐもの",
    short: "1話から数話で終わるもの",
};

/**
 * AI をどう使ったか。
 *
 * 読者が知りたいことなので、書き手に申告してもらう。
 * 隠すためではなく、はじめから示せるようにするため。
 *
 *   none      … 使っていない
 *   assist    … 調べもの・推敲・誤字直しなどに使った。本文を書いたのは自分
 *   generated … 本文の一部または全部を AI が書いた
 *
 * ★ assist は「本文を書いたのは誰か」で分ける。
 *
 *   前は「資料の整理や調べもの」としか書いていなかった。
 *   推敲や誤字直しに使う人が、どちらを選べばよいか迷い、
 *   生成のほうを選んでしまうことがあった。
 *   自分の文を直してもらうのは、生成ではない。
 */
export type AiUsage = "none" | "assist" | "generated";

export const AI_USAGE_LABEL: Record<AiUsage, string> = {
    none: "使っていない",
    assist: "補助として使った",
    generated: "本文の生成に使った",
};

export const AI_USAGE_DESCRIPTION: Record<AiUsage, string> = {
    none: "AIは一切使っていません。",
    assist:
        "調べもの・資料の整理・推敲・誤字直しなどに使いました。本文を書いたのは自分です。",
    generated: "本文の一部、または全部をAIが書きました。",
};

export interface WorkCreateInput {
    title: string;
    genre: string;
    tags?: string[];
    summary?: string | null;
}

/** 作品更新時の入力（部分更新） */
export type WorkUpdateInput = Partial<Omit<Work, "id" | "created_at" | "updated_at">>;

/** 一覧表示用の集計値つき作品 */
export interface WorkWithStats extends Work {
    episode_count: number;
    total_char_count: number;
    /** 公開設定から持ってきた表示用の状態。「下書き・連載中」など */
    state_label: string;
    /** 絞り込みに使うので、組み合わせる前の値も渡す */
    visibility: "draft" | "limited" | "public";
    serial_status: "ongoing" | "completed" | "paused";
}

/*
 * ジャンル。
 *
 * ファンタジーを 3 つに分けた。
 *   ハイファンタジー    異世界そのものを一から作る話。指輪物語の系譜
 *   異世界ファンタジー  転生・転移など、こちらから向こうへ渡る話
 *   ローファンタジー    現代を舞台に、不思議が混じる話
 *
 * 「ファンタジー」でひとくくりだと、
 * 重厚な創作世界と、なろう系の転生ものが同じ棚に並ぶ。
 * 読む人も書く人も、棲み分けを望んでいた。
 *
 * 「SF / ファンタジー」は消さずに残す。
 * 消すと、既にそれで出している作品のジャンルが空になる。
 */
export const GENRES = [
    "ハイファンタジー",
    "異世界ファンタジー",
    "ローファンタジー",
    "SF",
    "恋愛",
    "学園",
    "ミステリー",
    "ホラー",
    "歴史・時代",
    "日常",
    "アクション",
    "コメディ",
    "文芸",

    /*
     * BL・GL は、どの年齢区分でも選べる。
     *
     * ★ 前は R18 の作品でしか選べなかった。
     *
     *   BL・GL は関係の書き方であって、
     *   その中身が大人向けとは限らない。
     *   選べないと、書いた人は別の棚へ入れるしかなかった。
     */
    "BL",
    "GL",

    /*
     * 下の 3 つは R18 の作品でだけ選べる。
     *
     * 同じ BL でも、全年齢のものと並べると
     * 探している人にも探していない人にも意図と違う出方をする。
     * 棚を分ける。
     */
    "BL R18",
    "GL R18",
    "官能 R18",

    "その他",

    /*
     * ここから下は、昔のジャンル。
     *
     * 新しく選ぶ人には出さないが、
     * 既にこれで出している作品のために残す。
     */
    "SF / ファンタジー",
    "異世界",
    "ファンタジー",
] as const;

/** 新しく選べるジャンル。昔のものは出さない */
export const GENRES_SELECTABLE = GENRES.slice(0, 19);

/**
 * R18 の作品でだけ選べるジャンル。
 *
 * 年齢の区分を R18 から下げたときは、
 * このジャンルを外して選び直してもらう。
 * 残したままだと、全年齢の棚に R18 用の棚が並ぶ。
 *
 * こちらで別のジャンルへ移し替えることはしない。
 * どこへ入れるかは作者が決めるものなので、
 * 空にして選び直してもらう。
 */
export const GENRES_R18_ONLY: string[] = ["BL R18", "GL R18", "官能 R18"];

/** その年齢区分で選べるジャンル */
export function selectableGenres(ageRating: AgeRating): string[] {
    return GENRES_SELECTABLE.filter(
        (genre) => !GENRES_R18_ONLY.includes(genre) || ageRating === "r18",
    );
}

/**
 * 昔のジャンルと、新しいジャンルの対応。
 *
 * 検索で「ハイファンタジー」を選んだとき、
 * 昔の「ファンタジー」で出している作品も一緒に出す。
 * 分けた日に、それまでの作品が検索から消えないように。
 */
export const GENRE_LEGACY_MATCH: Record<string, string[]> = {
    ハイファンタジー: ["SF / ファンタジー", "ファンタジー"],
    異世界ファンタジー: ["SF / ファンタジー", "ファンタジー", "異世界"],
    ローファンタジー: ["SF / ファンタジー", "ファンタジー"],
    SF: ["SF / ファンタジー"],
};

/**
 * ジャンルごとの付箋の色。
 *
 * 本棚で、背表紙の上に挿す小さな紙の色。
 * 色を見ただけで、どんな話かの見当がつく。
 *
 * 近いものは近い色にしてある。
 *   ファンタジー3種   緑〜青緑
 *   SF               藍
 *   恋愛・学園        桃〜橙
 *   ミステリー・ホラー 紫〜黒
 *   歴史             茶
 *   日常・コメディ     黄
 *   アクション         赤
 */
export const GENRE_COLOR: Record<string, string> = {
    /*
     * 色は、その話の気配に寄せる。
     *
     * くすませると本棚が沈んで、
     * どれも同じ本に見えてしまう。
     * 背表紙は緑なので、少し彩度を上げてちょうどよい。
     */
    ハイファンタジー: "#2f7d5b",
    異世界ファンタジー: "#3fa876",
    ローファンタジー: "#6cc0a0",
    SF: "#2a6fb5",
    恋愛: "#e56b96",
    学園: "#f29a4c",
    ミステリー: "#7a52b3",
    ホラー: "#2f2a38",
    "歴史・時代": "#9a7040",
    日常: "#efc23f",
    アクション: "#d9432f",
    コメディ: "#f5d040",
    /* 文芸は落ち着いた藍鼠。派手な色だと棚の中で浮く */
    文芸: "#5a6b7d",
    BL: "#4a90d9",
    /* R18 用の棚。元の色をそのまま使い、並びで見分ける */
    "BL R18": "#4a90d9",
    "GL R18": "#d96fa8",
    "官能 R18": "#b03a5b",
    GL: "#e07aa8",
    その他: "#8a8f93",

    /*
     * 昔のジャンル。
     *
     * 新しく選ぶ人には出さないが、
     * これで出している作品がまだある。
     * 色を決めておかないと、灰色になって
     * 何の話か分からない付箋になる。
     */
    "SF / ファンタジー": "#4f9e7a",
    異世界: "#4f9e7a",
    ファンタジー: "#3f7f5a",
};

/** そのジャンルの色。決めていないものは灰 */
export function genreColor(genre: string): string {
    return GENRE_COLOR[genre] ?? "#8a8f93";
}

/**
 * 付箋に出す、短いジャンル名。
 *
 * 本の背表紙に挿す紙は細い。
 * 「異世界ファンタジー」では、はみ出すか読めなくなる。
 *
 * 意味が変わらない範囲で詰める。
 * ここに無いものは、そのまま出して幅で切る。
 */
export const GENRE_SHORT: Record<string, string> = {
    ハイファンタジー: "ハイF",
    異世界ファンタジー: "異世界",
    ローファンタジー: "ローF",
    "歴史・時代": "歴史",
    ミステリー: "ミステリ",
    アクション: "アクション",
};

/** 付箋に出す名前。短いものがあればそちら */
export function genreShort(genre: string): string {
    return GENRE_SHORT[genre] ?? genre;
}

export const AGE_RATING_LABEL: Record<AgeRating, string> = {
    all: "全年齢",
    r15: "R15",
    r18: "R18",
};

export const AGE_RATING_DESCRIPTION: Record<AgeRating, string> = {
    all: "どなたでも読めます。",
    r15: "15歳以上向け。暴力・性的な示唆を含みます。",
    r18: "18歳以上向け。成人向けの描写を含みます。",
};

/**
 * タグの候補。
 * 自由入力を基本にしつつ、よく使うものを選べるようにする。
 * 全員が同じ語を使ってくれると、将来の投稿サイトで検索がまとまるため。
 */
export const SUGGESTED_TAGS = [
    // 世界観
    "異世界",
    "現代",
    "近未来",
    "ファンタジー",
    "SF",
    "和風",
    "西洋風",
    "学園",
    "魔法",
    "剣と魔法",
    // 題材
    "冒険",
    "戦記",
    "恋愛",
    "ミステリー",
    "ホラー",
    "サスペンス",
    "日常",
    "青春",
    "家族",
    "職業",
    // 主人公・関係
    "男主人公",
    "女主人公",
    "群像劇",
    "成長",
    "師弟",
    "幼なじみ",
    // 読み味
    "シリアス",
    "コメディ",
    "ほのぼの",
    "ダーク",
    "ハッピーエンド",
    "短編",
] as const;

/**
 * 一覧などに出す作品の状態。
 * 公開範囲と連載状態を組み合わせて 1 行にする。
 */
export function formatWorkState(visibility: string, serialStatus: string): string {
    const visibilityLabel =
        visibility === "public" ? "公開" : visibility === "limited" ? "限定公開" : "下書き";
    const serialLabel =
        serialStatus === "completed" ? "完結" : serialStatus === "paused" ? "休載" : "連載中";
    return `${visibilityLabel}・${serialLabel}`;
}
