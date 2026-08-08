/**
 * ============================================================
 * 原石航路 Studio
 * BannerStrip — 運営が出す帯
 *
 * 置き場所ごとに、出すことになっているものだけを並べる。
 * 何も無ければ何も出さない。空の枠を残さない。
 *
 * これが無かったので、管理画面で作っても
 * どこにも出ていなかった。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import type { AdminBanner, BannerPlace } from "@/types";

interface Props {
    place: BannerPlace;
    /** 出す数の上限 */
    limit?: number;
    className?: string;
}

export default function BannerStrip({ place, limit = 3, className }: Props) {
    const [banners, setBanners] = useState<AdminBanner[]>([]);

    useEffect(() => {
        void (async () => {
            const rows = await getRepository().listBanners();
            setBanners(
                rows.filter((row) => row.is_active && row.place === place).slice(0, limit),
            );
        })();
    }, [place, limit]);

    if (banners.length === 0) return null;

    return (
        <ul className={["space-y-2", className].filter(Boolean).join(" ")}>
            {banners.map((banner) => {
                const inner = (
                    <>
                        <EntryImage
                            src={banner.image_url}
                            alt={banner.title}
                            className="aspect-[16/6] w-full object-cover"
                            fallback={banner.title || "バナー"}
                        />
                        {/* 題名は画像に文字が入っていないときの助け */}
                        {banner.title && !banner.image_url && (
                            <span className="block px-3 py-2 text-xs text-ink">
                                {banner.title}
                            </span>
                        )}
                    </>
                );

                return (
                    <li key={banner.id}>
                        {banner.link_url ? (
                            <Link
                                href={banner.link_url}
                                title={banner.title}
                                className="block overflow-hidden rounded-lg border border-line bg-surface hover:opacity-90"
                            >
                                {inner}
                            </Link>
                        ) : (
                            <span className="block overflow-hidden rounded-lg border border-line bg-surface">
                                {inner}
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
