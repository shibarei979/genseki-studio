/**
 * ============================================================
 * 原石航路 Studio
 * 書体の一覧（読む画面・書く画面で共通）
 *
 * ★ 無料は 4 つ。Pro は 30 書体すべて。
 *   無料：明朝・ゴシック・丸ゴシック・UD ゴシック（これまでの 4 つ）
 *
 * ★ 書体は、選ばれたときだけ読み込む（Google Fonts）。
 *   30 書体を最初から全部読むと、日本語の書体は重く、頁が遅くなる。
 *   一覧の見本は「見本の字だけ」を取り寄せる（text= を付ける）ので軽い。
 *
 * ★ 前は「丸ゴシック」「UD」を名前で指定していたが、どこでも読み込んでいなかった。
 *   端末に無ければ、ふつうのゴシックで出ていた。ここで読み込むようにした。
 * ============================================================
 */

export type FontGroup = "basic" | "mincho" | "gothic" | "maru" | "brush" | "design";

export const FONT_GROUP_LABEL: Record<FontGroup, string> = {
    basic: "基本",
    mincho: "明朝",
    gothic: "ゴシック",
    maru: "丸ゴシック",
    brush: "手書き・筆",
    design: "個性派",
};

export interface FontDef {
    key: string;
    label: string;
    group: FontGroup;
    /** Google Fonts での名前。next/font で読み込み済みのものは空 */
    google: string;
    /** CSS の font-family */
    stack: string;
    /** Pro だけ */
    pro: boolean;
    /** ひと言。選ぶ手がかり */
    note: string;
}

const serifTail = "'Noto Serif JP', serif";
const sansTail = "'Noto Sans JP', sans-serif";

function g(
    key: string,
    label: string,
    group: FontGroup,
    google: string,
    note: string,
    tail: string,
): FontDef {
    return { key, label, group, google, stack: `'${google}', ${tail}`, pro: true, note };
}

export const FONT_CATALOG: FontDef[] = [
    /* ---- 基本（無料） ---- */
    { key: "serif", label: "明朝", group: "basic", google: "", stack: `var(--font-serif), ${serifTail}`, pro: false, note: "小説らしい標準の明朝" },
    { key: "sans", label: "ゴシック", group: "basic", google: "", stack: `var(--font-sans), ${sansTail}`, pro: false, note: "画面で読みやすい" },
    { key: "rounded", label: "丸ゴシック", group: "basic", google: "Zen Maru Gothic", stack: `'Zen Maru Gothic', ${sansTail}`, pro: false, note: "やわらかい" },
    { key: "ud", label: "UDゴシック", group: "basic", google: "BIZ UDPGothic", stack: `'BIZ UDPGothic', ${sansTail}`, pro: false, note: "誰にでも読みやすい" },

    /*
     * ★ 似た書体を並べない。
     *   前は明朝が 12 種類あり、見本を並べても違いが分からなかった。
     *   系統ごとに「見てすぐ違う」ものだけを残し、手書き・個性派を増やした。
     */

    /* ---- 明朝（Pro） ---- */
    g("shippori", "しっぽり明朝", "mincho", "Shippori Mincho", "上品で、文芸書のよう", serifTail),
    g("zen-old", "Zen オールド明朝", "mincho", "Zen Old Mincho", "古い活字のような味わい", serifTail),
    g("kaisei-haruno", "解星春の海", "mincho", "Kaisei HarunoUmi", "おだやかでやさしい", serifTail),
    g("hina", "ひな明朝", "mincho", "Hina Mincho", "細く繊細", serifTail),
    g("zen-antique", "Zen アンチック", "mincho", "Zen Antique", "かなが太い、昔の本の風合い", serifTail),
    g("tegomin", "ニューテゴミン", "mincho", "New Tegomin", "古風で重みがある", serifTail),

    /* ---- ゴシック（Pro） ---- */
    g("zen-kaku", "Zen 角ゴシック", "gothic", "Zen Kaku Gothic New", "端正で落ち着いたゴシック", sansTail),
    g("mplus1p", "M+ 1p", "gothic", "M PLUS 1p", "軽やかで明るい", sansTail),
    g("plex", "IBM Plex Sans JP", "gothic", "IBM Plex Sans JP", "硬質で知的", sansTail),
    g("mplus-code", "M+ 1 Code", "gothic", "M PLUS 1 Code", "等幅。原稿用紙のように揃う", sansTail),

    /* ---- 丸ゴシック（Pro） ---- */
    g("mplus-rounded", "M+ 丸ゴシック", "maru", "M PLUS Rounded 1c", "やさしく明るい", sansTail),
    g("kiwi-maru", "キウイ丸", "maru", "Kiwi Maru", "ころんとかわいい", sansTail),
    g("tsukimi", "月見丸", "maru", "Tsukimi Rounded", "すらりとした丸み", sansTail),

    /* ---- 手書き・筆（Pro） ---- */
    g("klee", "クレー", "brush", "Klee One", "鉛筆で書いたような教科書体", serifTail),
    g("yuji-syuku", "佑字 肅", "brush", "Yuji Syuku", "筆で書いたような", serifTail),
    g("yuji-boku", "佑字 朴", "brush", "Yuji Boku", "太い筆。力強い", serifTail),
    g("kurenaido", "Zen くれない堂", "brush", "Zen Kurenaido", "ペンで書いたような", sansTail),
    g("yomogi", "よもぎ", "brush", "Yomogi", "ゆるい手書き", sansTail),
    g("hachi-maru", "はちまるポップ", "brush", "Hachi Maru Pop", "丸文字の手書き", sansTail),
    g("yusei", "油性マジック", "brush", "Yusei Magic", "マジックペンで書いたような", sansTail),

    /* ---- 個性派（Pro）。見出し向き。長い本文は読みにくいこともある ---- */
    g("dot", "ドットゴシック", "design", "DotGothic16", "昔のゲーム画面のような", sansTail),
    g("rocknroll", "ロックンロール", "design", "RocknRoll One", "太くてポップ", sansTail),
    g("reggae", "レゲエ", "design", "Reggae One", "角ばって力強い", sansTail),
    g("stick", "ステッキ", "design", "Stick", "直線だけでできた字", sansTail),
    g("mochiy", "もちやポップ", "design", "Mochiy Pop One", "もちっとした太字", sansTail),
    g("dela", "デラゴシック", "design", "Dela Gothic One", "極太。存在感がある", sansTail),
];

/** 前の書く画面の呼び名。保存されている値を読み替える */
const LEGACY: Record<string, string> = { mincho: "serif", gothic: "sans", maru: "rounded" };

export function fontDefOf(key: string | null | undefined): FontDef {
    const normalized = key ? LEGACY[key] ?? key : "serif";
    return FONT_CATALOG.find((font) => font.key === normalized) ?? FONT_CATALOG[0];
}

/**
 * 実際に使う書体。
 * Pro の書体でも、Pro でない人（切れた人を含む）には明朝で出す。
 */
export function usableFont(key: string | null | undefined, isPro: boolean): FontDef {
    const font = fontDefOf(key);
    return font.pro && !isPro ? FONT_CATALOG[0] : font;
}

function cssUrl(google: string, text?: string): string {
    const family = google.replace(/ /g, "+");
    return `https://fonts.googleapis.com/css2?family=${family}&display=swap${
        text ? `&text=${encodeURIComponent(text)}` : ""
    }`;
}

function inject(id: string, href: string) {
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}

/** 本文に使う書体を読み込む。読み込み済みなら何もしない */
export function loadFont(key: string | null | undefined) {
    const font = fontDefOf(key);
    if (!font.google) return;
    inject(`gf-${font.key}`, cssUrl(font.google));
}

/** 一覧の見本用。見本の字だけを取り寄せるので軽い */
export function loadFontPreview(font: FontDef, sample: string) {
    if (!font.google) return;
    inject(`gf-preview-${font.key}`, cssUrl(font.google, `${sample}${font.label}`));
}
