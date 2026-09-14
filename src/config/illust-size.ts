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

export type IllustSize = "small" | "medium" | "large" | "full";

export const ILLUST_SIZE_LABEL: Record<IllustSize, string> = {
    small: "小",
    medium: "中",
    large: "大",
    /*
     * ★ 縦横比を問わず、全体が入る。
     *
     *   小・中・大は高さで止めている。
     *   横に長い絵は、高さで止めると幅が伸びきらず、
     *   縦に長い絵は、幅で止めると小さくなる。
     *
     *   絵の形によって「いちばん大きい」が変わってしまう。
     *   形を問わず全体が入る選び方を、別に置く。
     */
    full: "全体",
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
        /*
         * ★ 幅の上限を外す。
         *
         *   縦書きでは、絵の幅が 240px までだった。
         *   横長の絵（1656×931）を幅 240 に収めると、
         *   高さは 135 にしかならない。
         *   【大】を選んでも、指の爪ほどの大きさになる。
         *
         *   縦書きで効くのは高さのほう。
         *   横は、列の高さに収まる範囲で伸ばせばよい。
         */
        small: { maxHeight: 200, maxWidth: "100%", stamp: 24 },
        medium: { maxHeight: 340, maxWidth: "100%", stamp: 30 },
        large: { maxHeight: 480, maxWidth: "100%", stamp: 38 },
        /* 列の高さいっぱいまで。横は絵の形に任せる */
        full: { maxHeight: 9999, maxWidth: "100%", stamp: 38 },
    },
    desktopHorizontal: {
        /*
         * ★ 上限を引き上げた。
         *
         *   本文の幅は 900px 以上あるのに、絵は 260px までだった。
         *   【大】を選んでも小さいままで、
         *   「大きさを選べていないのでは」という声が届いた。
         *
         *   元の絵より引き伸ばすことはしない。
         *   小さい絵は、これまでどおりの大きさで出る。
         */
        /*
         * ★ 【大】は、高さでも止めない。
         *
         *   1656×931 の絵を高さ 330 に収めると、幅は 587。
         *   本文は 900 あるのに、そこまでしか広がらない。
         *   「いちばん大きくしても全体が小さい」のは、これ。
         *
         *   幅いっぱいまで伸ばし、縦に長い絵だけ高さで止める。
         */
        small: { maxHeight: 180, maxWidth: "100%", stamp: 24 },
        medium: { maxHeight: 320, maxWidth: "100%", stamp: 30 },
        large: { maxHeight: 720, maxWidth: "100%", stamp: 38 },
        /* 高さで止めない。本文の幅いっぱいまで伸ばす */
        full: { maxHeight: 9999, maxWidth: "100%", stamp: 38 },
    },
    mobileVertical: {
        /* 縦書きの携帯も、幅ではなく高さで決める */
        small: { maxHeight: 150, maxWidth: "100%", stamp: 22 },
        medium: { maxHeight: 240, maxWidth: "100%", stamp: 28 },
        large: { maxHeight: 340, maxWidth: "100%", stamp: 34 },
        full: { maxHeight: 9999, maxWidth: "100%", stamp: 34 },
    },
    mobileHorizontal: {
        /*
         * ★ 【大】は高さで止めない。
         *   携帯の幅は 360 ほど。横長の絵を高さ 260 で止めると、
         *   幅 460 になって画面に収まらず、結局縮む。
         *   幅いっぱいまで伸ばすほうが、素直に大きく出る。
         */
        small: { maxHeight: 150, maxWidth: "100%", stamp: 22 },
        medium: { maxHeight: 240, maxWidth: "100%", stamp: 28 },
        large: { maxHeight: 520, maxWidth: "100%", stamp: 34 },
        full: { maxHeight: 9999, maxWidth: "100%", stamp: 34 },
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
        size === "small" || size === "medium" || size === "full"
            ? size
            : "large";

    return TABLE[where][key];
}
