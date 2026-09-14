/**
 * ============================================================
 * 原石航路 Studio
 * 挿絵の大きさ
 *
 * ★ 形と、つまみで決める。
 *
 *   形    どこまで伸ばせるかの上限を決める
 *   つまみ そこから、どれだけ狭めるか（10〜100%）
 *
 * ★ 絵は切らない。縦横比は変えない。
 *
 *   枠に収まるように縮めるだけ。
 *   余白は透明なので、絵だけが浮いて見える。
 *
 * ★ 形は 3 つ。
 *
 *     縦長    高く取れる。幅は狭い
 *     正方形  高さと幅が同じくらい
 *     横長    幅いっぱい。高さは抑える
 *
 *   横長の絵に縦長の枠を選べば、幅で止まって小さくなる。
 *   縦書きの本文で、絵が高すぎると読みにくいときに使う。
 *
 * ★ 前は 小・中・大 だった。
 *
 *   どれも高さで止めていたので、絵の形によって
 *   「いちばん大きい」が変わってしまった。
 *   横に長い絵は幅が伸びきらず、
 *   縦に長い絵は小さくなる。
 * ============================================================
 */

/** 枠の形 */
export type IllustShape = "tall" | "square" | "wide";

export const ILLUST_SHAPE_LABEL: Record<IllustShape, string> = {
    tall: "縦長",
    square: "正方形",
    wide: "横長",
};

/* 古い呼び名。表に入っている値を読み替えるのに使う */
export type IllustSize = "small" | "medium" | "large" | "full";

export const ILLUST_SIZE_LABEL: Record<IllustSize, string> = {
    small: "小",
    medium: "中",
    large: "大",
    full: "全体",
};

/**
 * 枠の寸法。
 *
 * ★ 本文の幅に対する割合で持つ。
 *   画面の広さが変わっても、釣り合いが崩れない。
 *
 * ★ 高さは画面の高さに対する割合。
 *   縦長を選んだとき、画面からはみ出さないように。
 */
interface Frame {
    /** 本文の幅に対する上限（%） */
    maxWidth: number;
    /** 画面の高さに対する上限（vh） */
    maxHeight: number;
}

const FRAME: Record<IllustShape, Frame> = {
    /* 縦長。高く取れるが、幅は本文の半分まで */
    tall: { maxWidth: 52, maxHeight: 78 },

    /* 正方形。どちらも中くらい */
    square: { maxWidth: 72, maxHeight: 60 },

    /* 横長。幅いっぱい。高さは抑える */
    wide: { maxWidth: 100, maxHeight: 46 },
};

/** 携帯は、画面が狭いぶん幅を広く取る */
const FRAME_MOBILE: Record<IllustShape, Frame> = {
    tall: { maxWidth: 66, maxHeight: 70 },
    square: { maxWidth: 88, maxHeight: 54 },
    wide: { maxWidth: 100, maxHeight: 40 },
};

/**
 * 古い値を、新しい形に読み替える。
 *
 * ★ すでに入っている挿絵を、そのままにしない。
 *
 *   小・中・大で保存された絵が残っている。
 *   読み替えないと、どれも既定の形で出てしまう。
 */
export function shapeOf(value: string | null | undefined): IllustShape {
    if (value === "tall" || value === "square" || value === "wide") {
        return value;
    }

    /* 古い小・中・大は、どれも横長として扱う */
    return "wide";
}

/**
 * 古い値から、つまみの位置を出す。
 *
 * 小 40 ／ 中 70 ／ 大・全体 100
 */
export function scaleOf(value: string | null | undefined): number {
    if (value === "small") return 40;
    if (value === "medium") return 70;

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber >= 10 && asNumber <= 100) {
        return Math.round(asNumber);
    }

    return 100;
}

/** AI の印の大きさ。絵が小さいと、印が絵を食う */
export function stampOf(scale: number, isMobile: boolean): number {
    const base = isMobile ? 34 : 38;
    return Math.max(18, Math.round((base * scale) / 100));
}

/**
 * 見せるときの寸法を出す。
 *
 * ★ 返すのは CSS にそのまま渡せる形。
 *   maxWidth は本文に対する %、maxHeight は画面に対する vh。
 */
export function illustFrame(options: {
    shape: IllustShape;
    /** 10〜100 */
    scale: number;
    isMobile?: boolean;
}): { maxWidth: string; maxHeight: string } {
    const table = options.isMobile ? FRAME_MOBILE : FRAME;
    const frame = table[options.shape];

    const scale = Math.min(100, Math.max(10, options.scale)) / 100;

    return {
        maxWidth: `${Math.round(frame.maxWidth * scale)}%`,
        maxHeight: `${Math.round(frame.maxHeight * scale)}vh`,
    };
}

/**
 * ============================================================
 * 古い呼び名。
 *
 * ★ 35 か所から呼ばれているので、名前を残す。
 *
 *   一度に全部書き換えると、直し漏れが必ず出る。
 *   中で新しい形に読み替えて、同じ形で返す。
 *
 * ★ size には、形とつまみが「wide:80」のように入る。
 *   古い「large」なども、そのまま渡してよい。
 * ============================================================
 */
export function illustBox(
    where:
        | "desktopVertical"
        | "desktopHorizontal"
        | "mobileVertical"
        | "mobileHorizontal",
    size: string | null | undefined,
): { maxHeight: string; maxWidth: string; stamp: number } {
    const isMobile = where.startsWith("mobile");

    const [shapePart, scalePart] = String(size ?? "").split(":");

    const shape = shapeOf(shapePart);
    const scale = scaleOf(scalePart || shapePart);

    const frame = illustFrame({ shape, scale, isMobile });

    return {
        maxHeight: frame.maxHeight,
        maxWidth: frame.maxWidth,
        stamp: stampOf(scale, isMobile),
    };
}
