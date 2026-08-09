/**
 * ============================================================
 * 原石航路 Studio
 * AdminNoticesClient — お知らせ
 *
 * ヘッダーのベルに出るもの。
 *
 * 表に出す日を持たせてある。
 * 先に書いておいて、その日が来たら出す使い方ができる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import { deleteImage, putImage, shrinkImage } from "@/lib/storage/image-store";
import type { AdminNotice, NoticeType } from "@/types";
import {
    NOTICE_TYPE_COLOR,
    NOTICE_TYPE_LABEL,
    noticeColor,
    noticeLabel,
} from "@/types";

export default function AdminNoticesClient() {
    const [notices, setNotices] = useState<AdminNotice[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setNotices(await getRepository().listNotices());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    /*
     * 直したことを伝える。
     *
     * 黙って保存すると、書けたのか分からない。
     * 失敗しても何も出ないと、打ち直すことになる。
     */
    const [notice2, setNotice2] = useState("");

    async function patch(id: string, next: Partial<AdminNotice>) {
        try {
            await getRepository().updateNotice(id, next);
            await reload();

            setNotice2("保存しました");
            window.setTimeout(() => setNotice2(""), 2000);
        } catch (caught) {
            setNotice2(
                caught instanceof Error
                    ? caught.message
                    : "保存できませんでした",
            );
        }
    }

    return (
        <AdminShell
            title="お知らせ"
            description="ヘッダーのベルに出ます。表に出す日を先に決められます。"
            action={
                <button
                    type="button"
                    onClick={async () => {
                        const created = await getRepository().createNotice();
                        await reload();
                        setOpenId(created.id);
                    }}
                    className="rounded-full bg-forest px-5 py-2 text-xs text-white hover:bg-forest-dark"
                >
                    ＋ 新しいお知らせ
                </button>
            }
        >
            {notice2 && (
                <p className="mb-3 rounded-lg bg-forest-tint px-4 py-2.5 text-[12px] text-forest">
                    {notice2}
                </p>
            )}

            {notices.length === 0 ? (
                <Empty>まだお知らせがありません。</Empty>
            ) : (
                <ul className="space-y-2">
                    {notices.map((notice) => {
                        const isOpen = openId === notice.id;
                        const tone = noticeColor(notice.type);

                        return (
                            <li
                                key={notice.id}
                                className="overflow-hidden rounded-xl border border-line bg-surface"
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenId(isOpen ? null : notice.id)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                                >
                                    <span
                                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                        style={{ background: tone.bg, color: tone.text }}
                                    >
                                        {noticeLabel(notice.type)}
                                    </span>

                                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                        {notice.title || "（題名なし）"}
                                    </span>

                                    <span className="shrink-0 text-[10px] text-faint">
                                        {notice.published_at}
                                    </span>

                                    <span
                                        className={[
                                            "shrink-0 rounded px-2 py-0.5 text-[10px]",
                                            notice.is_published
                                                ? "bg-forest-tint text-forest"
                                                : "bg-canvas text-faint",
                                        ].join(" ")}
                                    >
                                        {notice.is_published ? "公開" : "下書き"}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="border-t border-line px-4 py-4">
                                        <Field label="種類">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(
                                                    Object.keys(
                                                        NOTICE_TYPE_LABEL,
                                                    ) as NoticeType[]
                                                ).map((key) => {
                                                    const color = NOTICE_TYPE_COLOR[key];
                                                    const isCurrent = notice.type === key;
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() =>
                                                                void patch(notice.id, {
                                                                    type: key,
                                                                })
                                                            }
                                                            className="rounded-full border px-3 py-1 text-[11px]"
                                                            style={{
                                                                background: isCurrent
                                                                    ? color.bg
                                                                    : "transparent",
                                                                color: isCurrent
                                                                    ? color.text
                                                                    : "#7d867f",
                                                                borderColor: isCurrent
                                                                    ? color.text
                                                                    : "var(--color-line)",
                                                            }}
                                                        >
                                                            {NOTICE_TYPE_LABEL[key]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </Field>

                                        <Field label="題名">
                                            <input
                                                type="text"
                                                defaultValue={notice.title}
                                                maxLength={60}
                                                onBlur={(e) =>
                                                    void patch(notice.id, {
                                                        title: e.target.value.trim(),
                                                    })
                                                }
                                                className={inputClass}
                                            />
                                        </Field>

                                        <Field label="本文">
                                            <textarea
                                                defaultValue={notice.body}
                                                rows={3}
                                                onBlur={(e) =>
                                                    void patch(notice.id, {
                                                        body: e.target.value.trim(),
                                                    })
                                                }
                                                className={inputClass}
                                            />
                                        </Field>

                                        <Field label="画像（任意）">
                                            <div className="mt-1 flex items-start gap-3">
                                                <EntryImage
                                                    src={notice.image_url}
                                                    className="aspect-video w-32 shrink-0 rounded-lg border border-line object-cover"
                                                    fallback="画像なし"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <input
                                                        id={`notice-image-${notice.id}`}
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        onChange={async (e) => {
                                                            const file =
                                                                e.target.files?.[0];
                                                            if (!file) return;
                                                            const shrunk =
                                                                await shrinkImage(file);
                                                            const ref =
                                                                await putImage(shrunk);
                                                            if (notice.image_url) {
                                                                await deleteImage(
                                                                    notice.image_url,
                                                                );
                                                            }
                                                            await patch(notice.id, {
                                                                image_url: ref,
                                                            });
                                                        }}
                                                        className="hidden"
                                                    />
                                                    <label
                                                        htmlFor={`notice-image-${notice.id}`}
                                                        className="block cursor-pointer rounded-md border border-line py-1.5 text-center text-[11px] text-ink hover:border-forest-line hover:text-forest"
                                                    >
                                                        {notice.image_url
                                                            ? "差し替える"
                                                            : "画像を選ぶ"}
                                                    </label>

                                                    {notice.image_url && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                await deleteImage(
                                                                    notice.image_url as string,
                                                                );
                                                                await patch(notice.id, {
                                                                    image_url: null,
                                                                });
                                                            }}
                                                            className="mt-1 w-full rounded py-1 text-[10px] text-faint hover:text-ink"
                                                        >
                                                            外す
                                                        </button>
                                                    )}

                                                    <p className="mt-1 text-[10px] leading-relaxed text-faint">
                                                        ベルの中では小さく出ます。
                                                    </p>
                                                </div>
                                            </div>
                                        </Field>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Field label="行き先（任意）">
                                                <input
                                                    type="text"
                                                    defaultValue={notice.link}
                                                    onBlur={(e) =>
                                                        void patch(notice.id, {
                                                            link: e.target.value.trim(),
                                                        })
                                                    }
                                                    placeholder="/contest"
                                                    className={inputClass}
                                                />
                                            </Field>

                                            <Field label="表に出す日">
                                                <input
                                                    type="date"
                                                    value={notice.published_at}
                                                    onChange={(e) =>
                                                        void patch(notice.id, {
                                                            published_at: e.target.value,
                                                        })
                                                    }
                                                    className={inputClass}
                                                />
                                            </Field>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                                            <div className="flex items-center gap-2">
                                                <Toggle
                                                    on={notice.is_published}
                                                    label="公開する"
                                                    onChange={(next) =>
                                                        void patch(notice.id, {
                                                            is_published: next,
                                                        })
                                                    }
                                                />
                                                <span className="text-xs text-ink">
                                                    公開する
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await getRepository().deleteNotice(
                                                        notice.id,
                                                    );
                                                    setOpenId(null);
                                                    await reload();
                                                }}
                                                className="text-[11px] text-[var(--color-danger)] hover:underline"
                                            >
                                                削除する
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </AdminShell>
    );
}

const inputClass =
    "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3 last:mb-0">
            <span className="text-xs font-medium text-ink">{label}</span>
            {children}
        </div>
    );
}

function Toggle({
    on,
    onChange,
    label,
}: {
    on: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={() => onChange(!on)}
            className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                on ? "bg-forest" : "bg-[#d1d5db]",
            ].join(" ")}
        >
            <span
                className={[
                    "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
                    on ? "left-[23px]" : "left-[3px]",
                ].join(" ")}
            />
        </button>
    );
}

export function Empty({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
            {children}
        </p>
    );
}
