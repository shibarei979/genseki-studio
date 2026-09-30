/**
 * ============================================================
 * 原石航路 Studio
 * アイコン衣装の置き方
 *
 * ★ 衣装は、丸いアイコンの上に重ねる絵。
 *   帽子は頭の上、お面は横、王冠は丸のふち（3 分の 1 だけ中）、と
 *   品物ごとに置く場所が違う。
 *
 * ★ 数はアイコンの大きさに対する割合。
 *     w  絵の幅（1 ならアイコンと同じ幅）
 *     x  横のずれ（0 が真ん中。＋で右）
 *     y  絵の上の端の高さ（0 がアイコンの上の端。−で上へはみ出す）
 *
 * ★ アイコンに深くかぶせる（頭の上に浮かせず、帽子のように乗せる）。
 *
 * ★ 絵のファイル名で引く。無い品物は既定の置き方（頭の上）。
 * ============================================================
 */

export interface CostumeFit {
    w: number;
    x: number;
    y: number;
}

const DEFAULT_FIT: CostumeFit = { w: 1.3, x: 0, y: -0.22 };

const FITS: Record<string, CostumeFit> = {
    hanakanmuri: { w: 1.02, x: 0, y: -0.04 },
    kaigara: { w: 1.0, x: 0.04, y: -0.06 },
    funeboushi: { w: 1.02, x: 0.03, y: -0.16 },
    beret: { w: 1.0, x: 0.06, y: -0.12 },
    goggle: { w: 0.98, x: 0, y: -0.07 },
    lantern: { w: 0.5, x: 0.3, y: -0.02 },
    eyemask: { w: 0.98, x: 0, y: -0.2 },
    neko: { w: 0.98, x: 0, y: -0.2 },
    mizunowa: { w: 0.92, x: 0, y: -0.3 },
    kitsune: { w: 0.66, x: 0.2, y: -0.14 },
    oukan: { w: 0.6, x: 0.2, y: -0.16 },
};

/** 絵の住所から置き方を引く */
export function costumeFit(url: string | null | undefined): CostumeFit {
    if (!url) return DEFAULT_FIT;
    const name = url.split("/").pop()?.replace(/\.[a-z0-9]+(\?.*)?$/i, "") ?? "";
    return FITS[name] ?? DEFAULT_FIT;
}
