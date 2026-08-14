/**
 * ============================================================
 * 原石航路 Studio
 * HomeBannerCarousel — お知らせの帯
 *
 * コンテスト・お知らせ・運営の帯の絵を、横に並べて掲示する。
 *
 * 勝手には動かさない。読んでいる横で流れると落ち着かない。
 *
 * 札の幅は 240px の決め打ち。枠に入るだけ並べて、
 * 入りきらなくなったら左右に矢印が出る。
 * 押すと 1 枚ぶんずれる。
 * 何枚で矢印が出るかは、画面の幅で決まる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import { IDB_PREFIX } from "@/lib/storage/image-store";
import type { AdminBanner, AdminNotice, Contest } from "@/types";

/** 札 1 枚の幅 */
const CARD_WIDTH = 240;
/** 札と札の間 */
const CARD_GAP = 14;

interface Props {
    /** 開催中のコンテスト */
    contests: Contest[];
}

type Slide =
    | { kind: "contest"; id: string; contest: Contest }
    | { kind: "notice"; id: string; notice: AdminNotice }
    | { kind: "banner"; id: string; banner: AdminBanner };

/** 締切の見せ方。点で区切ると日付として読みやすい */
function dotDate(value: string | null | undefined): string {
    if (!value) return "未定";
    return value.slice(0, 10).replace(/-/g, ".");
}

export default function HomeBannerCarousel({ contests }: Props) {
    const [banners, setBanners] = useState<AdminBanner[]>([]);
    const [notices, setNotices] = useState<AdminNotice[]>([]);

    useEffect(() => {
        void (async () => {
            const today = new Date().toISOString().slice(0, 10);
            const [bannerRows, noticeRows] = await Promise.all([
                getRepository().listBanners(),
                getRepository().listNotices(),
            ]);
            setBanners(
                bannerRows
                    .filter(
                        (row) =>
                            row.is_active &&
                            row.place === "home-side" &&
                            /* 端末の中の絵は出さない。他の人には無い */
                            !!row.image_url &&
                            !row.image_url.startsWith(IDB_PREFIX),
                    )
                    .sort((a, b) => a.sort_order - b.sort_order),
            );
            setNotices(
                noticeRows.filter(
                    (row) =>
                        row.is_published &&
                        row.published_at <= today &&
                        row.image_url &&
                        !row.image_url.startsWith(IDB_PREFIX) &&
                        row.show_on_home !== false,
                ),
            );
        })();
    }, []);

    /*
     * 枠に何枚入るかを測る。
     * 入りきる間は矢印を出さず、あふれたら出す。
     */
    const viewportRef = useRef<HTMLDivElement>(null);
    const [perView, setPerView] = useState(4);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const measure = () => {
            setPerView(
                Math.max(
                    1,
                    Math.floor(
                        (el.clientWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP),
                    ),
                ),
            );
        };
        measure();

        const watcher = new ResizeObserver(measure);
        watcher.observe(el);
        return () => watcher.disconnect();
    }, []);

    const [index, setIndex] = useState(0);

    const slides: Slide[] = [
        ...contests
            .filter((contest) => contest.banner_url)
            .map((contest) => ({
                kind: "contest" as const,
                id: `contest:${contest.id}`,
                contest,
            })),
        ...notices.map((notice) => ({
            kind: "notice" as const,
            id: `notice:${notice.id}`,
            notice,
        })),
        ...banners.map((banner) => ({
            kind: "banner" as const,
            id: `banner:${banner.id}`,
            banner,
        })),
    ];

    if (slides.length === 0) return null;

    /* 端で止める。行き止まりの矢印は薄くする */
    const maxIndex = Math.max(0, slides.length - perView);
    const offset = Math.min(index, maxIndex);
    const hasArrows = slides.length > perView;

    return (
        <section aria-label="コンテストとお知らせ" className="relative">
            <div ref={viewportRef} className="overflow-hidden">
                <div
                    className="flex transition-transform duration-300"
                    style={{
                        gap: `${CARD_GAP}px`,
                        transform: `translateX(-${offset * (CARD_WIDTH + CARD_GAP)}px)`,
                    }}
                >
                    {slides.map((slide) => (
                        <div
                            key={slide.id}
                            className="shrink-0 overflow-hidden rounded-lg border border-line bg-surface"
                            style={{ width: `${CARD_WIDTH}px` }}
                        >
                            {slide.kind === "contest" ? (
                                <Link
                                    href={`/contest/${slide.contest.id}`}
                                    title={slide.contest.title || "コンテスト"}
                                    className="group/card relative block aspect-video"
                                >
                                    <ContestBanner
                                        contest={slide.contest}
                                        className="absolute inset-0 h-full w-full"
                                    />
                                    {/* 題と締切は、乗せたときだけ。絵を主役に */}
                                    <span
                                        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
                                        aria-hidden="true"
                                    >
                                        <span className="absolute inset-0 bg-[rgba(20,56,78,0.45)]" />
                                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
                                            <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">
                                                {slide.contest.title ||
                                                    "名前のないコンテスト"}
                                            </span>
                                            <span className="text-[10px] text-white/85">
                                                応募締切：
                                                {dotDate(slide.contest.ends_at)}
                                            </span>
                                        </span>
                                    </span>
                                </Link>
                            ) : slide.kind === "notice" ? (
                                <Link
                                    href={slide.notice.link || "/notices"}
                                    title={slide.notice.title}
                                    className="block aspect-video"
                                >
                                    <EntryImage
                                        src={slide.notice.image_url}
                                        alt={slide.notice.title}
                                        className="h-full w-full object-cover"
                                        fallback={
                                            slide.notice.title || "お知らせ"
                                        }
                                    />
                                </Link>
                            ) : slide.banner.link_url ? (
                                <Link
                                    href={slide.banner.link_url}
                                    title={slide.banner.title}
                                    className="block aspect-video"
                                >
                                    <EntryImage
                                        src={slide.banner.image_url}
                                        alt={slide.banner.title}
                                        className="h-full w-full object-cover"
                                        fallback={
                                            slide.banner.title || "お知らせ"
                                        }
                                    />
                                </Link>
                            ) : (
                                <span className="block aspect-video">
                                    <EntryImage
                                        src={slide.banner.image_url}
                                        alt={slide.banner.title}
                                        className="h-full w-full object-cover"
                                        fallback={
                                            slide.banner.title || "お知らせ"
                                        }
                                    />
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {hasArrows && (
                <>
                    <button
                        type="button"
                        aria-label="前へ"
                        disabled={offset === 0}
                        onClick={() => setIndex(Math.max(0, offset - 1))}
                        className="absolute -left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm hover:border-forest-line disabled:opacity-30"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        aria-label="次へ"
                        disabled={offset >= maxIndex}
                        onClick={() =>
                            setIndex(Math.min(maxIndex, offset + 1))
                        }
                        className="absolute -right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm hover:border-forest-line disabled:opacity-30"
                    >
                        ›
                    </button>
                </>
            )}
        </section>
    );
}
