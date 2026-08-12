/**
 * ============================================================
 * 原石航路 Studio
 * HomeBannerCarousel — 流れる帯
 *
 * コンテストと運営のお知らせの絵を、順に流して見せる。
 * 前は「今日の執筆」を置く案だったが、続きへの入口は
 * 左の柱と棚に既にあるので、ここは知らせる場所に使う。
 *
 * 絵の出どころは 2 つ。
 *   コンテスト   banner_url のあるもの
 *   運営の帯     管理画面の「ホームの左」に出しているもの
 *              （柱から外し、ここへ移した。2 か所に出さない）
 *
 * 流すものが無ければ、何も出さない。空の枠を残さない。
 * 1 枚しか無ければ、流さずに置くだけにする。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import type { AdminBanner, Contest } from "@/types";

interface Props {
    /** 開催中のコンテスト */
    contests: Contest[];
}

/** 次の絵へ送るまでの間。読み終える前に流れると急かされる */
const FLOW_INTERVAL_MS = 5000;

type Slide =
    | { kind: "contest"; id: string; contest: Contest }
    | { kind: "banner"; id: string; banner: AdminBanner };

/** 締切の見せ方。点で区切ると日付として読みやすい */
function dotDate(value: string | null | undefined): string {
    if (!value) return "未定";
    return value.slice(0, 10).replace(/-/g, ".");
}

export default function HomeBannerCarousel({ contests }: Props) {
    const [banners, setBanners] = useState<AdminBanner[]>([]);

    useEffect(() => {
        void (async () => {
            const rows = await getRepository().listBanners();
            setBanners(
                rows
                    .filter((row) => row.is_active && row.place === "home-side")
                    .sort((a, b) => a.sort_order - b.sort_order),
            );
        })();
    }, []);

    const slides: Slide[] = [
        ...contests
            .filter((contest) => contest.banner_url)
            .map((contest) => ({
                kind: "contest" as const,
                id: `contest:${contest.id}`,
                contest,
            })),
        ...banners.map((banner) => ({
            kind: "banner" as const,
            id: `banner:${banner.id}`,
            banner,
        })),
    ];

    const trackRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);

    /*
     * 指が乗っている間は流さない。
     * 読んでいる最中に流れると、押す先が逃げる。
     * state にしないのは、止め外しのたびに描き直さないため。
     */
    const pausedRef = useRef(false);

    useEffect(() => {
        if (slides.length < 2) return;

        const timer = window.setInterval(() => {
            if (pausedRef.current || document.hidden) return;
            const track = trackRef.current;
            if (!track) return;
            const current = Math.round(track.scrollLeft / track.clientWidth);
            const next = (current + 1) % slides.length;
            track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
        }, FLOW_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [slides.length]);

    if (slides.length === 0) return null;

    function goTo(target: number) {
        const track = trackRef.current;
        if (!track) return;
        const count = slides.length;
        const next = (target + count) % count;
        track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }

    return (
        <section
            aria-label="コンテストとお知らせ"
            className="group relative overflow-hidden rounded-xl border border-line bg-surface"
            onPointerEnter={() => {
                pausedRef.current = true;
            }}
            onPointerLeave={() => {
                pausedRef.current = false;
            }}
        >
            <div
                ref={trackRef}
                onScroll={(event) => {
                    const track = event.currentTarget;
                    setIndex(Math.round(track.scrollLeft / track.clientWidth));
                }}
                /*
                 * つまみは出さない。
                 * 自分で流れる帯につまみが付くと、送る道具が 2 つになる。
                 * 手で送るのは矢印と点、指では横になぞる。
                 */
                style={{ scrollbarWidth: "none" }}
                className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
            >
                {slides.map((slide) => (
                    <div key={slide.id} className="w-full shrink-0 snap-start">
                        {slide.kind === "contest" ? (
                            <Link
                                href={`/contest/${slide.contest.id}`}
                                className="relative block aspect-[16/7] sm:aspect-[16/5]"
                            >
                                <ContestBanner
                                    contest={slide.contest}
                                    className="absolute inset-0 h-full w-full"
                                />
                                {/*
                                 * 下の縁だけ暗くして、題と締切を乗せる。
                                 * 絵の全体は伏せない。ここは絵を見せる場所。
                                 */}
                                <span
                                    className="absolute inset-x-0 bottom-0"
                                    style={{
                                        background:
                                            "linear-gradient(180deg, rgba(20,56,78,0) 0%, rgba(20,56,78,0.72) 100%)",
                                    }}
                                    aria-hidden="true"
                                />
                                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 py-3 sm:px-5">
                                    <span className="min-w-0 truncate text-[13px] font-semibold text-white sm:text-[14px]">
                                        {slide.contest.title || "名前のないコンテスト"}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-white/85">
                                        応募締切：{dotDate(slide.contest.ends_at)}
                                    </span>
                                </span>
                            </Link>
                        ) : slide.banner.link_url ? (
                            <Link
                                href={slide.banner.link_url}
                                title={slide.banner.title}
                                className="block aspect-[16/7] sm:aspect-[16/5]"
                            >
                                <EntryImage
                                    src={slide.banner.image_url}
                                    alt={slide.banner.title}
                                    className="h-full w-full object-cover"
                                    fallback={slide.banner.title || "お知らせ"}
                                />
                            </Link>
                        ) : (
                            <span className="block aspect-[16/7] sm:aspect-[16/5]">
                                <EntryImage
                                    src={slide.banner.image_url}
                                    alt={slide.banner.title}
                                    className="h-full w-full object-cover"
                                    fallback={slide.banner.title || "お知らせ"}
                                />
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {slides.length >= 2 && (
                <>
                    {/* 手で送る矢印。指を乗せたときだけ見せる */}
                    <button
                        type="button"
                        aria-label="前へ"
                        onClick={() => goTo(index - 1)}
                        className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow-sm hover:bg-white group-hover:flex"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        aria-label="次へ"
                        onClick={() => goTo(index + 1)}
                        className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow-sm hover:bg-white group-hover:flex"
                    >
                        ›
                    </button>

                    {/* いま何枚目か。点を押せばそこへ飛べる */}
                    <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5">
                        {slides.map((slide, i) => (
                            <button
                                key={slide.id}
                                type="button"
                                aria-label={`${i + 1}枚目へ`}
                                onClick={() => goTo(i)}
                                className={[
                                    "h-1.5 rounded-full transition-all",
                                    i === index
                                        ? "w-4 bg-white"
                                        : "w-1.5 bg-white/55 hover:bg-white/80",
                                ].join(" ")}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
