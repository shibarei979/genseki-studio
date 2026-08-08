/**
 * ============================================================
 * 原石航路 Studio
 * Resource Types（資料）
 *
 * 資料は「ページ」と「項目」の 2 段構えにしている。
 *
 *   ページ … 人物、場所、証拠品、部活動 … といった資料の種類
 *   項目   … そのページに並ぶ 1 件 1 件
 *
 * ページ自体を作者が作れるようにするため、
 * 入力欄の構成（fields）をデータとして持つ。
 * 型を増やして対応すると、作者が新しい種類を作れなくなる。
 * ============================================================
 */

/**
 * ページの表示のしかた。
 * 大半は entries（一覧＋詳細）で足りる。
 * 残りは並べ方そのものが違うので分けている。
 */
export type PageKind = "entries" | "timeline" | "relations" | "plot" | "notes";

/** 入力欄の種類 */
export type FieldType =
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "checkbox"
    | "tags"
    | "select"
    | "relation_entry"
    | "relation_episode";

export interface ResourceField {
    key: string;
    label: string;
    type: FieldType;
    /** select のときの選択肢 */
    options?: string[];
    placeholder?: string;
}

/**
 * 一覧の見せ方。
 * どのページも同じ表に並べると、人物も紋章も証拠品も同じ顔になる。
 * 中身に合った見せ方を選べるようにしている。
 */
export type PageLayout = "list" | "cards" | "grid" | "board";

/** 項目に添える図案の系統 */
export type ImageStyle = "portrait" | "scene" | "crest" | "icon" | "map";

export interface ResourcePage {
    id: string;
    work_id: string;
    /** 組み込みページの識別子。自作ページは null */
    builtin_key: string | null;
    label: string;
    description: string;
    kind: PageKind;
    fields: ResourceField[];
    /**
     * 常設ページ。作者が消せない。
     * どのジャンルでも要るものだけを true にする。
     */
    is_pinned: boolean;
    sort_order: number;
    layout: PageLayout;
    /** 図案の系統。null なら図案を持たないページ */
    image_style: ImageStyle | null;
    /** 出来事・時系列ページの、時間の表し方 */
    timeline_mode: TimelineMode;
    created_at: string;
    updated_at: string;
}

/**
 * 出来事の時間の表し方。
 * 「年表」を歴史ものだけのものにしないために切り替えられる。
 */
export type TimelineMode = "date" | "days" | "age" | "episode" | "clock" | "order";

export const TIMELINE_MODE_LABEL: Record<TimelineMode, string> = {
    date: "年月日",
    days: "作中の日数",
    age: "主人公の年齢",
    episode: "第何話",
    clock: "時刻",
    order: "順番だけ",
};

export const TIMELINE_MODE_PLACEHOLDER: Record<TimelineMode, string> = {
    date: "1005年 春",
    days: "3日目",
    age: "17歳",
    episode: "第4話の直後",
    clock: "20:15",
    order: "",
};

/**
 * ============================================================
 * 項目
 * ============================================================
 */

export type FieldValue = string | number | boolean | string[];

/**
 * 候補の状態。
 * rejected を覚えておかないと、拾うたびに同じものが並び続ける。
 */
export type CandidateStatus = "none" | "pending" | "rejected";

export interface ResourceEntry {
    id: string;
    work_id: string;
    page_id: string;
    name: string;
    /**
     * 別名・呼び方の揺れ。
     * 統合したときに、消えたほうの名前をここへ移す。
     * 本文からの候補抽出でも、別名は「登録済み」として扱う。
     */
    aliases: string[];
    /** 一覧に出る一言説明 */
    summary: string;
    /** ページの fields に対応する値 */
    values: Record<string, FieldValue>;
    is_major: boolean;
    /**
     * AI補助が拾った候補かどうか。
     * pending のあいだは一覧の本体に混ぜない。
     * 勝手に増えた項目と、自分で書いた項目が混ざると資料が信用できなくなる。
     */
    candidate_status: CandidateStatus;
    /** 候補の出どころ。本文の一文をそのまま入れる */
    candidate_source: string | null;
    /**
     * その一文がどこにあるか。「第3話 12行目」の形。
     * 根拠を確かめたいとき、本文のどこを見ればよいか分かるように。
     */
    source_ref?: string | null;
    /** 図案。SVG のデータURI か、将来は保存先のURL */
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * ============================================================
 * 関係
 *
 * 人物同士に限らない。人物と組織、人物と場所、人物と事件も結べる。
 * 恋愛の「すれ違い」もミステリーの「容疑者」も同じ形で持てる。
 * ============================================================
 */

export interface RelationChange {
    /** 「第5話」「再会のあと」など、自由に書ける */
    at: string;
    label: string;
}

export interface ResourceRelation {
    id: string;
    work_id: string;
    from_entry_id: string;
    to_entry_id: string;
    label: string;
    note: string;
    /**
     * 話が進むにつれての変化。
     * 関係を 1 つのラベルで固定すると、
     * 初対面から決別までを追えなくなる。
     */
    changes: RelationChange[];
    created_at: string;
    updated_at: string;
}

/**
 * ============================================================
 * プロット・構成
 *
 * AI は使わない。物語の骨格は作者が決めるものだから。
 * 「導入・旅立ち・試練」のような決まった段も持たせない。
 * ============================================================
 */

export interface PlotStage {
    id: string;
    work_id: string;
    title: string;
    description: string;
    /** 「第1話〜第3話」など、自由に書ける */
    episode_range: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

/**
 * 段の中に置く場面。
 *
 * 段だけだと「導入」「転機」という大枠しか置けず、
 * 実際に書くときに手が動かない。
 * 段を柱、場面を横木として、間に何が起きるかを並べられるようにする。
 */
export interface PlotScene {
    id: string;
    work_id: string;
    stage_id: string;
    title: string;
    description: string;
    /** 「1〜2話」など */
    episode_range: string;
    /** 関わる資料の項目 */
    entry_ids: string[];
    /** 書き終わったか。段の進み具合の計算に使う */
    is_done: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

/**
 * ============================================================
 * 本文からのリンク
 *
 * 本文には記法を埋め込まない。別テーブルに逃がす。
 * 本文を素のテキストのまま保てば、
 * 縦書き表示・書き出し・将来の投稿サイトへの転送が記法に縛られない。
 * ============================================================
 */

export interface EntryMention {
    id: string;
    work_id: string;
    episode_id: string;
    entry_id: string;
    /** 本文中に現れた表記。「リオ」「アルセイン王国」など */
    surface: string;
    created_at: string;
}
