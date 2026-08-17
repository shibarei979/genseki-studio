/**
 * ============================================================
 * 原石航路 Studio
 * DisplaySettings Types（表示設定）
 *
 * 執筆中の見え方と、将来の読者向け表示の両方を決める。
 * works テーブルに列を足さず 1:1 の別テーブルに分けている。
 * 一覧を出すだけの場面で読まずに済むため。
 * ============================================================
 */

/** 本文の組み方向 */
export type WritingMode = "vertical" | "horizontal";

/** 行間 */
export type LineHeightKey = "compact" | "normal" | "relaxed";

/**
 * 読み進め方。
 * 縦スクロールは PC 向け、ページ送りは携帯向けの既定になる。
 */
export type PageMode = "scroll" | "paged";

/** 背景色テーマ */
export type ThemeKey = "white" | "cream" | "sepia" | "night" | "black";

export interface DisplaySettings {
    work_id: string;
    writing_mode: WritingMode;
    /** 本文の文字サイズ（px） */
    font_size: number;
    line_height: LineHeightKey;
    theme: ThemeKey;
    /** PC で開いたときの読み進め方 */
    page_mode_pc: PageMode;
    /** 携帯で開いたときの読み進め方 */
    page_mode_mobile: PageMode;

    /** 本文の書体 */
    font_family: FontKey;
    /** 字間 */
    letter_spacing: LetterSpacingKey;

    /**
     * 読者へのおすすめ。
     *
     * 作者の執筆環境とは別のもの。
     * 横書きで書いて、縦書きで読んでほしいことがある。
     *
     * あくまで「おすすめ」で、読者は自分の読みやすい形に変えられる。
     * 読み方を押しつけない。
     */
    reader_mode: "none" | "horizontal" | "vertical";

    /**
     * 話の一覧に「第◯話」を出すか。
     *
     * 題名だけで並べたい人のため。
     * 執筆画面の見え方だけで、読者側は変わらない。
     */
    show_episode_number?: boolean;

}

export const PAGE_MODE_LABEL: Record<PageMode, string> = {
    scroll: "スクロール",
    paged: "ページ送り",
};

export const WRITING_MODE_LABEL: Record<WritingMode, string> = {
    horizontal: "横書き",
    vertical: "縦書き",
};

export const WRITING_MODE_DESCRIPTION: Record<WritingMode, string> = {
    horizontal: "ふつうに左から右へ書きます。",
    vertical: "右から左へ、縦に書きます。",
};

/**
 * ------------------------------------------------------------
 * 本文の書体
 *
 * 端末に入っているものだけを並べる。
 * 読み込みを待たせないため、また、
 * 書体は好みが分かれるので選べるようにする。
 * ------------------------------------------------------------
 */

/*
 * 書体は 3 つに絞る。
 *
 * 等幅と手書き風は、端末によって入っていないことが多く、
 * 無ければ隣の書体になる。
 * 選べるのに変わらない、というのが一番よくない。
 */
export type FontKey = "mincho" | "gothic" | "maru";

export const FONT_LABEL: Record<FontKey, string> = {
    mincho: "明朝",
    gothic: "ゴシック",
    maru: "丸ゴシック",
};

export const FONT_DESCRIPTION: Record<FontKey, string> = {
    mincho: "縦線が太く横線が細い。小説らしい書体",
    gothic: "線の太さが均一。画面で読みやすい",
    maru: "角が丸い。やわらかい印象になる",
};

/**
 * 書体の候補。
 *
 * 端末に入っているものを前から順に試す。
 * どれも無ければ、最後の総称（serif など）に落ちる。
 */
export const FONT_STACK: Record<FontKey, string> = {
    mincho:
        '"Hiragino Mincho ProN", "HiraMinProN-W3", "Yu Mincho", "YuMincho", "MS PMincho", "Noto Serif JP", serif',
    gothic:
        '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "YuGothic", "Meiryo", "Noto Sans JP", sans-serif',
    maru: '"Hiragino Maru Gothic ProN", "Hiragino Maru Gothic Pro", "Kosugi Maru", "M PLUS Rounded 1c", "Meiryo", sans-serif',
};

/**
 * 書体ごとの見え方の補正。
 *
 * 同じ大きさでも、書体によって字面の大きさが違う。
 * 明朝は小さく、丸ゴシックは大きく見える。
 */
export const FONT_SCALE: Record<FontKey, number> = {
    mincho: 1.04,
    gothic: 1,
    maru: 0.98,
};

export const LINE_HEIGHT_LABEL: Record<LineHeightKey, string> = {
    compact: "つめて",
    normal: "標準",
    relaxed: "ゆったり",
};

/*
 * 行の高さ。
 *
 * 横書きと縦書きで別に持つ。
 *
 * 縦書きは行が「列」になるので、同じ数字でも横書きより広く見える。
 * 逆に横書きは、同じ数字だと間延びする。
 */
export const LINE_HEIGHT_VALUE: Record<LineHeightKey, number> = {
    compact: 1.4,
    normal: 1.6,
    relaxed: 1.85,
};

export const LINE_HEIGHT_VALUE_VERTICAL: Record<LineHeightKey, number> = {
    compact: 1.6,
    normal: 1.85,
    relaxed: 2.2,
};

/**
 * ------------------------------------------------------------
 * 字間
 *
 * 縦書きは字が縦に積まれるので、詰まって見えやすい。
 * 少し空けたほうが読みやすい。
 * ------------------------------------------------------------
 */

export type LetterSpacingKey = "compact" | "normal" | "relaxed";

export const LETTER_SPACING_LABEL: Record<LetterSpacingKey, string> = {
    compact: "つめて",
    normal: "標準",
    relaxed: "ゆったり",
};

/** 文字の大きさに対する割合 */
export const LETTER_SPACING_VALUE: Record<LetterSpacingKey, number> = {
    compact: 0,
    normal: 0.04,
    relaxed: 0.1,
};

export const LETTER_SPACING_VALUE_VERTICAL: Record<LetterSpacingKey, number> = {
    compact: 0.02,
    normal: 0.08,
    relaxed: 0.16,
};

export const THEME_LABEL: Record<ThemeKey, string> = {
    white: "白",
    cream: "生成り",
    sepia: "セピア",
    night: "夜間",
    black: "黒",
};

export const FONT_SIZES = [14, 16, 18, 20, 24] as const;

export function defaultDisplaySettings(workId: string): DisplaySettings {
    return {
        work_id: workId,
        writing_mode: "horizontal",
        font_size: 16,
        line_height: "relaxed",
        theme: "white",
        page_mode_pc: "scroll",
        // 携帯は画面が狭く、指で送るほうが読みやすいので既定をページ送りにする
        page_mode_mobile: "paged",
        font_family: "mincho",
        letter_spacing: "normal",
        reader_mode: "none",
        show_episode_number: true,
    };
}

export const READER_MODE_LABEL: Record<
    DisplaySettings["reader_mode"],
    string
> = {
    none: "指定しない",
    horizontal: "横書きをすすめる",
    vertical: "縦書きをすすめる",
};
