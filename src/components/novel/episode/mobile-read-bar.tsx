/**
 * ============================================================
 * 原石航路 Studio
 * 携帯：話を読む画面の下の帯
 *
 *   ‹ 前の話 ｜ 目次 ｜ Aa ｜ 次の話 ›
 *
 * ★ 前は画面の上に並んでいて、読み終わってから押しに戻る必要があった。
 *   親指の届く下に置く。
 *
 * ★ 読み進めて下へ送っているあいだは隠れ、少し戻すと出る。
 *   本文を読む場所を減らさない。
 *
 * ★ 帯の上の細い線で、どこまで読んだかを見せる。
 *
 * ★ 1024px 未満でだけ出す（mobile-read.css）。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MobileReadBar({
    prevHref,
    tocHref,
    nextHref,
}: {
    prevHref: string | null;
    tocHref: string;
    nextHref: string | null;
}) {
    const [isHidden, setIsHidden] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let last = window.scrollY;
        /* 縦書きで読んでいる（進み具合は本文から届く） */
        let vertical = false;

        function onScroll() {
            const now = window.scrollY;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            if (!vertical) setProgress(max > 0 ? Math.min(1, Math.max(0, now / max)) : 1);

            /*
             * 下へ送っている → 隠す。上へ戻した → 出す。
             * いちばん下まで来たら出す（次の話へ進むため）。
             */
            if (now > max - 40) setIsHidden(false);
            else if (now > last + 6 && now > 120) setIsHidden(true);
            else if (now < last - 6) setIsHidden(false);
            last = now;
        }

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        /*
         * ★ 縦書きは本文の入れ物が横に動くだけで、頁は動かない。
         *   本文の側から進み具合を受け取って、線に出す。
         */
        function onVertical(event: Event) {
            const value = Number((event as CustomEvent<number>).detail);
            if (!Number.isFinite(value)) return;
            vertical = true;
            setProgress(Math.min(1, Math.max(0, value)));
        }
        window.addEventListener("gk-read-progress", onVertical);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("gk-read-progress", onVertical);
        };
    }, []);

    return (
        <>
            <div className="mrb-progress" aria-hidden="true">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <nav className={`mrb${isHidden ? " is-hidden" : ""}`} aria-label="話の行き来">
                {prevHref ? (
                    <Link href={prevHref} className="mrb-nb">‹ 前の話</Link>
                ) : (
                    <span className="mrb-nb is-off">‹ 前の話</span>
                )}
                <Link href={tocHref} className="mrb-sq" aria-label="目次">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M9 6h11M9 12h11M9 18h11" />
                        <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
                        <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
                        <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
                    </svg>
                </Link>
                {/* ★ 文字の設定（Aa）。読みながら親指で開ける（本文の上の Aa と同じ窓） */}
                <button
                    type="button"
                    className="mrb-sq mrb-aa"
                    aria-label="文字の設定"
                    onClick={() => window.dispatchEvent(new CustomEvent("gk-reading-open", { detail: "text" }))}
                >
                    Aa
                </button>
                {nextHref ? (
                    <Link href={nextHref} className="mrb-nb is-pri">次の話 ›</Link>
                ) : (
                    <Link href={tocHref} className="mrb-nb">目次へ</Link>
                )}
            </nav>
        </>
    );
}
