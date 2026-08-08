/**
 * ============================================================
 * 原石航路 Studio
 * AdminBannersClient — バナー
 *
 * ホームの左などに出す帯。
 *
 * 置き場所を持たせてある。
 * 同じ絵をどこにでも出せると、画面ごとの狙いがぼやける。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import { deleteImage, putImage, shrinkImage } from "@/lib/storage/image-store";
import type { AdminBanner, BannerPlace } from "@/types";
import { BANNER_PLACE_LABEL } from "@/types";

export default function AdminBannersClient() {
    const [banners, setBanners] = useState<AdminBanner[]>([]);

    const reload = useCallback(async () => {
        setBanners(await getRepository().listBanners());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function patch(id: string, next: Partial<AdminBanner>) {
        await getRepository().updateBanner(id, next);
        await reload();
    }

    return (
        <AdminShell
            title="バナー"
            description="ホームなどに出す帯。押すと決めた行き先へ移ります。"
            action={
                <button
                    type="button"
                    onClick={async () => {
                        await getRepository().createBanner();
                        await reload();
                    }}
                    className="rounded-full bg-forest px-5 py-2 text-xs text-white hover:bg-forest-dark"
                >
                    ＋ 新しいバナー
                </button>
            }
        >
            {/* どこに出るかを先に伝える */}
            <div className="mb-4 rounded-xl bg-surface px-4 py-3">
                <p className="text-[11px] font-medium text-ink">出る場所</p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted">
                    <li>
                        <span className="text-ink">ホームの左</span>
                        　執筆室・コンテストの上に並びます（3つまで）
                    </li>
                    <li>
                        <span className="text-ink">コンテストの上</span>
                        　コンテスト一覧の見出しの上に出ます（2つまで）
                    </li>
                </ul>
                <p className="mt-1.5 text-[10px] text-faint">
                    「出す」に印を付けたものだけが表に出ます。
                    何も無ければ、その場所には何も出ません。
                </p>
            </div>

            {banners.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                    まだバナーがありません。
                </p>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                    {banners.map((banner) => (
                        <li
                            key={banner.id}
                            className="overflow-hidden rounded-xl border border-line bg-surface"
                        >
                            <EntryImage
                                src={banner.image_url}
                                className="aspect-[16/6] w-full object-cover"
                                fallback="画像なし"
                            />

                            <div className="px-4 py-3.5">
                                <input
                                    type="text"
                                    defaultValue={banner.title}
                                    maxLength={40}
                                    onBlur={(e) =>
                                        void patch(banner.id, {
                                            title: e.target.value.trim(),
                                        })
                                    }
                                    placeholder="題名"
                                    aria-label="題名"
                                    className="w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-forest"
                                />

                                <input
                                    type="text"
                                    defaultValue={banner.link_url}
                                    onBlur={(e) =>
                                        void patch(banner.id, {
                                            link_url: e.target.value.trim(),
                                        })
                                    }
                                    placeholder="行き先（/contest など）"
                                    aria-label="行き先"
                                    className="mt-2 w-full rounded-md border border-line px-3 py-1.5 text-xs outline-none focus:border-forest"
                                />

                                <div className="mt-2 flex flex-wrap gap-1">
                                    {(
                                        Object.keys(BANNER_PLACE_LABEL) as BannerPlace[]
                                    ).map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() =>
                                                void patch(banner.id, { place: key })
                                            }
                                            aria-pressed={banner.place === key}
                                            className={[
                                                "rounded-full border px-3 py-1 text-[10px]",
                                                banner.place === key
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:text-ink",
                                            ].join(" ")}
                                        >
                                            {BANNER_PLACE_LABEL[key]}
                                        </button>
                                    ))}
                                </div>

                                {banner.is_active && !banner.image_url && (
                                    <p className="mt-2 rounded-md bg-[var(--color-amber-tint)] px-2.5 py-1.5 text-[10px] text-ink">
                                        画像がないので、題名だけが出ます。
                                    </p>
                                )}

                                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                                    <input
                                        id={`banner-${banner.id}`}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const shrunk = await shrinkImage(file, true);
                                            const ref = await putImage(shrunk);
                                            if (banner.image_url) {
                                                await deleteImage(banner.image_url);
                                            }
                                            await patch(banner.id, { image_url: ref });
                                        }}
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor={`banner-${banner.id}`}
                                        className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                                    >
                                        {banner.image_url ? "差し替える" : "画像を選ぶ"}
                                    </label>

                                    <label className="flex items-center gap-1.5 text-[11px] text-ink">
                                        <input
                                            type="checkbox"
                                            checked={banner.is_active}
                                            onChange={(e) =>
                                                void patch(banner.id, {
                                                    is_active: e.target.checked,
                                                })
                                            }
                                            className="accent-[var(--color-forest)]"
                                        />
                                        出す
                                    </label>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (banner.image_url) {
                                                await deleteImage(banner.image_url);
                                            }
                                            await getRepository().deleteBanner(banner.id);
                                            await reload();
                                        }}
                                        className="ml-auto text-[11px] text-faint hover:text-[var(--color-danger)]"
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </AdminShell>
    );
}
