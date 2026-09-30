/**
 * ============================================================
 * 原石航路 Studio
 * CostumeOverlay — アイコンの上に、衣装の絵を重ねる
 *
 * ★ 使い方：アイコンを包む箱を position: relative にして、その中に置く。
 *
 *     <span style={{ position: "relative", display: "inline-block" }}>
 *       <img src={icon} ... />
 *       <CostumeOverlay url={costumeUrl} size={48} />
 *     </span>
 *
 * ★ 押しても何も起きないようにする（下のアイコンが押せるように）。
 * ★ 衣装が無いときは何も出さない。
 * ============================================================
 */

import { costumeFit } from "@/lib/costume-fit";

export default function CostumeOverlay({
    url,
    size,
}: {
    url: string | null | undefined;
    /** 下のアイコンの大きさ（px） */
    size: number;
}) {
    if (!url) return null;

    const fit = costumeFit(url);
    const width = size * fit.w;

    return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
            src={url}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
                position: "absolute",
                left: size / 2 - width / 2 + size * fit.x,
                top: size * fit.y,
                width,
                height: "auto",
                maxWidth: "none",
                pointerEvents: "none",
                zIndex: 1,
            }}
        />
    );
}
