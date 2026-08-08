/**
 * ============================================================
 * 原石航路 Studio
 * ScreenSlot — 画面写しを入れる場所
 *
 * 写しが用意できるまでは、空の枠を出しておく。
 *
 * 絵で見立てを描かない。
 * 作っていないものを描くのは嘘になるし、
 * 実物と違うものを見せると期待を裏切ることになる。
 *
 * 差し替えるときは src を渡すだけ。
 * ============================================================
 */

"use client";

interface Props {
    /** 画面写しの道筋。無ければ空の枠が出る */
    src?: string;
    /** 何の画面か。読み上げにも使う */
    label: string;
    /** 縦横比。既定は 16:10 */
    ratio?: string;
    /** 暗い面の上に置くか。枠の色が変わる */
    onDark?: boolean;
}

export default function ScreenSlot({
    src,
    label,
    ratio = "16 / 10",
    onDark = false,
}: Props) {
    if (src) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src}
                alt={label}
                className="block w-full rounded-xl shadow-xl"
                style={{ aspectRatio: ratio, objectFit: "cover" }}
            />
        );
    }

    return (
        <div
            role="img"
            aria-label={`${label}（準備中）`}
            className="flex w-full items-center justify-center rounded-xl border-2 border-dashed"
            style={{
                aspectRatio: ratio,
                borderColor: onDark
                    ? "rgba(255,255,255,0.28)"
                    : "var(--color-sea-line)",
                background: onDark
                    ? "rgba(255,255,255,0.06)"
                    : "var(--color-sea-tint)",
            }}
        >
            <span
                className="text-[11px] tracking-wide"
                style={{
                    color: onDark ? "rgba(255,255,255,0.45)" : "var(--color-sea-light)",
                }}
            >
                {label}
            </span>
        </div>
    );
}
