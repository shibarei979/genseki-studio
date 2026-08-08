/**
 * ============================================================
 * 原石航路 Studio
 * 組み込みの資料ページと、作品開始時のテンプレート
 *
 * 常設は「どのジャンルでも要るもの」だけ。
 * 恋愛作品に組織欄を、日常作品に年表を押しつけない。
 * 残りは作者が必要なぶんだけ足す。
 * ============================================================
 */

import type { ImageStyle, PageKind, PageLayout, ResourceField, TimelineMode } from "@/types";

export interface BuiltinPageDefinition {
    key: string;
    label: string;
    description: string;
    kind: PageKind;
    /** 常設。作者が消せない */
    isPinned: boolean;
    fields: ResourceField[];
    timelineMode?: TimelineMode;
    /** 一覧の見せ方 */
    layout: PageLayout;
    /** 項目に添える図案の系統。null なら図案なし */
    imageStyle: ImageStyle | null;
}

const EPISODE_FIELD: ResourceField = {
    key: "episodes",
    label: "登場する話",
    type: "relation_episode",
};

/**
 * ============================================================
 * 常設ページ
 * ============================================================
 */

export const PINNED_PAGES: BuiltinPageDefinition[] = [
    {
        key: "character",
        layout: "cards",
        imageStyle: "portrait",
        label: "人物",
        description: "登場人物、役割、人物像、他者との関係、登場話を管理します。",
        kind: "entries",
        isPinned: true,
        fields: [
            { key: "kana", label: "読み", type: "text", placeholder: "りお・あるせいん" },
            { key: "role", label: "役割", type: "text", placeholder: "主人公 / 幼なじみ / 容疑者" },
            { key: "profile", label: "人物像", type: "textarea" },
            { key: "tags", label: "タグ", type: "tags" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "place",
        layout: "grid",
        imageStyle: "scene",
        label: "場所",
        description: "国や都市だけでなく、教室・喫茶店・事件現場も同じ場所として扱います。",
        kind: "entries",
        isPinned: true,
        fields: [
            { key: "type", label: "種類", type: "text", placeholder: "学校 / 自宅 / 王国" },
            { key: "detail", label: "詳しく", type: "textarea" },
            { key: "tags", label: "タグ", type: "tags" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "relation",
        layout: "list",
        imageStyle: null,
        label: "関係図",
        description: "人物・組織・場所・事件のあいだの関係と、その変化を記録します。",
        kind: "relations",
        isPinned: true,
        fields: [],
    },
    {
        key: "timeline",
        layout: "list",
        imageStyle: null,
        label: "出来事・時系列",
        description: "起きたことを順に並べます。時間の表し方は切り替えられます。",
        kind: "timeline",
        isPinned: true,
        timelineMode: "order",
        fields: [
            { key: "when", label: "いつ", type: "text" },
            { key: "detail", label: "内容", type: "textarea" },
            { key: "people", label: "関わる人", type: "relation_entry" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "plot",
        layout: "list",
        imageStyle: null,
        label: "プロット・構成",
        description: "物語の骨格を組み立てます。AI補助は使いません。",
        kind: "plot",
        isPinned: true,
        fields: [],
    },
    {
        key: "memo",
        layout: "board",
        imageStyle: null,
        label: "メモ",
        description: "思いついたこと、調べたこと、伏線を自由に書き留めます。",
        kind: "notes",
        isPinned: true,
        fields: [
            { key: "category", label: "種類", type: "text", placeholder: "伏線 / 台詞 / 調査" },
            { key: "detail", label: "内容", type: "textarea" },
            EPISODE_FIELD,
        ],
    },
];

/**
 * ============================================================
 * 作者が足せるページ
 * ============================================================
 */

export const OPTIONAL_PAGES: BuiltinPageDefinition[] = [
    {
        key: "organization",
        layout: "cards",
        imageStyle: "crest",
        label: "組織・グループ",
        description: "国、会社、学校、部活、家族、サークル、犯罪組織などをまとめます。",
        kind: "entries",
        isPinned: false,
        fields: [
            { key: "type", label: "種類", type: "text", placeholder: "国家 / 部活 / 家族" },
            { key: "detail", label: "詳しく", type: "textarea" },
            { key: "members", label: "所属する人", type: "relation_entry" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "term",
        layout: "list",
        imageStyle: "icon",
        label: "用語・設定",
        description: "作品独自の言葉や決まりごと。分類は自由に作れます。",
        kind: "entries",
        isPinned: false,
        fields: [
            { key: "category", label: "分類", type: "text", placeholder: "魔法 / 校則 / 証言" },
            { key: "detail", label: "説明", type: "textarea" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "item",
        layout: "grid",
        imageStyle: "icon",
        label: "アイテム・小道具",
        description: "凶器、手紙、指輪、鍵、写真、研究資料など。",
        kind: "entries",
        isPinned: false,
        fields: [
            { key: "detail", label: "説明", type: "textarea" },
            { key: "owner", label: "持ち主", type: "relation_entry" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "case",
        layout: "board",
        imageStyle: null,
        label: "事件・謎",
        description: "事件、証拠、証言、容疑者、矛盾、未解決のことを紐づけます。",
        kind: "entries",
        isPinned: false,
        fields: [
            {
                key: "status",
                label: "状態",
                type: "select",
                options: ["未解決", "調査中", "解決済み"],
            },
            { key: "detail", label: "内容", type: "textarea" },
            { key: "suspects", label: "関係者", type: "relation_entry" },
            EPISODE_FIELD,
        ],
    },
    {
        key: "map",
        layout: "grid",
        imageStyle: "map",
        label: "図・マップ",
        description: "世界地図に限らず、校内図、間取り、路線、座席表、移動経路も。",
        kind: "entries",
        isPinned: false,
        fields: [
            { key: "type", label: "種類", type: "text", placeholder: "校内図 / 間取り / 路線" },
            { key: "detail", label: "説明", type: "textarea" },
        ],
    },
];

export const ALL_BUILTIN_PAGES = [...PINNED_PAGES, ...OPTIONAL_PAGES];

/**
 * ============================================================
 * 作品開始時のテンプレート
 *
 * 常設ページに加えて、どれを最初から出すかだけを決める。
 * 「テンプレートなし」でも常設ページは付く。
 * 何も無い状態から始めさせても、結局同じものを作ることになるため。
 * ============================================================
 */

export interface WorkTemplate {
    key: string;
    label: string;
    description: string;
    /** 常設に追加して有効にするページ */
    extraPages: string[];
}

export const WORK_TEMPLATES: WorkTemplate[] = [
    {
        key: "simple",
        label: "シンプル",
        description: "人物・場所・プロット・メモだけ。短編や、まず書き始めたいときに。",
        extraPages: [],
    },
    {
        key: "romance",
        label: "恋愛・青春",
        description: "関係の変化を追いかけたい作品に。",
        extraPages: ["organization"],
    },
    {
        key: "mystery",
        label: "ミステリー",
        description: "事件・証拠品・時系列を突き合わせたい作品に。",
        extraPages: ["case", "item", "organization"],
    },
    {
        key: "fantasy",
        label: "ファンタジー・SF",
        description: "世界そのものを作り込む作品に。",
        extraPages: ["organization", "term", "item", "map"],
    },
    {
        key: "none",
        label: "テンプレートなし",
        description: "常設ページだけで始めて、必要なものを自分で足します。",
        extraPages: [],
    },
];

/** 自作ページで選べる入力欄 */
export const CUSTOM_FIELD_CHOICES: { type: ResourceField["type"]; label: string }[] = [
    { type: "text", label: "短い文章" },
    { type: "textarea", label: "長い文章" },
    { type: "date", label: "日付" },
    { type: "number", label: "数値" },
    { type: "checkbox", label: "チェック項目" },
    { type: "tags", label: "タグ" },
    { type: "relation_entry", label: "他の資料との関連" },
    { type: "relation_episode", label: "エピソードとの関連" },
];
