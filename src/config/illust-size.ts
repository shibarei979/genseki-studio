/**
 * ============================================================
 * 原石航路 Studio
 * 挿絵の大きさ
 *
 * ★ 1 か所にまとめる。
 *
 *   挿絵は 4 か所に出る。
 *     パソコンの縦書き / 横書き
 *     携帯の縦書き / 横書き
 *
 *   それぞれに数字を書くと、片方だけ直して
 *   食い違うことになる。実際、これまで
 *   出す所を 1 つ見落として何度も直した。
 * ============================================================
 */

export type IllustSize = "small" | "medium" | "large";

export const ILLUST_SIZE_LABEL: Record<IllustSize, string> = {
    small: "小",
    medium: "中",
    large: "大",
};

/**
 * 見え方の寸法。
 *
 * 縦書きは高さが見た目の大きさを決める（横に流れるため）。
 * 横書きは高さで揃える（縦に流れるため）。
 *
 * 携帯は画面が狭いので、それぞれ一回り小さくする。
 */
interface Box {
    maxHeight: number;
    maxWidth: number | string;
    /** AI の印の大きさ。絵に対して大きすぎると絵が見えない */
    stamp: number;
}

const TABLE: Record<
    "desktopVertical" | "desktopHorizontal" | "mobileVertical" | "mobileHorizontal",
    Record<IllustSize, Box>
> = {
    desktopVertical: {
        small: { maxHeight: 160, maxWidth: 120, stamp: 24 },
        medium: { maxHeight: 250, maxWidth: 180, stamp: 30 },
        large: { maxHeight: 360, maxWidth: 240, stamp: 38 },
    },
    desktopHorizontal: {
        small: { maxHeight: 120, maxWidth: "100%", stamp: 24 },
        medium: { maxHeight: 180, maxWidth: "100%", stamp: 30 },
        large: { maxHeight: 260, maxWidth: "100%", stamp: 38 },
    },
    mobileVertical: {
        small: { maxHeight: 120, maxWidth: 90, stamp: 22 },
        medium: { maxHeight: 180, maxWidth: 130, stamp: 28 },
        large: { maxHeight: 260, maxWidth: 180, stamp: 34 },
    },
    mobileHorizontal: {
        small: { maxHeight: 110, maxWidth: "100%", stamp: 22 },
        medium: { maxHeight: 160, maxWidth: "100%", stamp: 28 },
        large: { maxHeight: 220, maxWidth: "100%", stamp: 34 },
    },
};

export function illustBox(
    where: keyof typeof TABLE,
    size: string | null | undefined,
): Box {
    /*
     * 知らない値が来たら大にする。
     *
     * 昔の話には列そのものが無く、
     * null で返ってくることがある。
     * そのとき小さくすると、
     * 見え方が勝手に変わってしまう。
     */
    const key: IllustSize =
        size === "small" || size === "medium" ? size : "large";

    return TABLE[where][key];
}
