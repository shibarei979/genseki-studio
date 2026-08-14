/**
 * ============================================================
 * 原石航路 Studio
 * HomeBannerCarousel — 流れる帯
 *
 * コンテスト・お知らせ・運営の帯の絵を、
 * 何枚も横に並べて、右から左へ絶え間なく流す。
 *
 * 1 枚ずつ矢印で送る形はやめた。
 * 小さな札が次々に通り過ぎる、掲示板の前を歩くような形。
 * カーソルを乗せている間は止まる（読んでいる最中に逃げない）。
 *
 * 仕組み: 同じ並びを 2 回つなげて、半分ぶん左へ動かし続ける。
 * 半分まで来たら頭に戻るが、絵柄が同じなので継ぎ目は見えない。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import { IDB_PREFIX } from "@/lib/storage/image-store";
import type { AdminBanner, AdminNotice, Contest } from "@/types";

/** 札 1 枚の幅。なろうの帯くらいの小ささ */
const CARD_WIDTH = 300;
/** 札と札の間 */
const CARD_GAP = 14;
/** 1 枚が通り過ぎるのにかける秒。小さいほど速い */
const SECONDS_PER_CARD = 5;

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
                            /* 端末の中の絵は流さない。他の人には無い */
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

    /*
     * 枚数が少ないと、流れの中に空白ができる。
     * 並びを繰り返して、半分だけでも画面幅より長くしておく。
     * （半分 = 継ぎ目なく回すための単位。下の注釈を参照）
     */
    const repeat = Math.max(1, Math.ceil(5 / slides.length));
    const half: Slide[] = Array.from({ length: repeat }, () => slides).flat();

    return (
        <section aria-label="コンテストとお知らせ" className="banner-flow">
            <div
                className="banner-flow__track"
                style={{
                    /* 半分（half 1 組）を流し切る時間。枚数に比例させる */
                    animationDuration: `${half.length * SECONDS_PER_CARD}s`,
                }}
            >
                {[...half, ...half].map((slide, index) => (
                    <div
                        key={`${slide.id}:${index}`}
                        className="shrink-0 overflow-hidden rounded-lg border border-line bg-surface"
                        style={{
                            width: CARD_WIDTH,
                            marginRight: CARD_GAP,
                        }}
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
                                    fallback={slide.notice.title || "お知らせ"}
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
                                    fallback={slide.banner.title || "お知らせ"}
                                />
                            </Link>
                        ) : (
                            <span className="block aspect-video">
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
        </section>
    );
}
