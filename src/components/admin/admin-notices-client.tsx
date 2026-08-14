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
import { useReorder } from "@/components/admin/use-reorder";
import EntryImage from "@/components/common/entry-image";
import { getRepository } from "@/lib/repository";
import { IDB_PREFIX, deleteImage, shrinkImage } from "@/lib/storage/image-store";
import { removeImage, uploadImage } from "@/lib/storage/remote-image";
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

    /*
     * 長押しで並べ替え。
     *
     * つかんで動かしている間は手元の並びだけを替え、
     * 離したときに、見えている順そのままを番号にして保存する。
     * お知らせは 2 つの表に分かれているが、保存は updateNotice が
     * an: の印で行き先を分けるので、ここでは並びだけ考えればよい。
     */
    const reorder = useReorder({
        onMove: (fromId, toId) => {
            setNotices((current) => {
                const next = [...current];
                const from = next.findIndex((row) => row.id === fromId);
                const to = next.findIndex((row) => row.id === toId);
                if (from < 0 || to < 0) return current;
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                return next;
            });
        },
        onCommit: () => {
            void (async () => {
                try {
                    await Promise.all(
                        notices.map((row, index) =>
                            row.sort_order === index
                                ? Promise.resolve()
                                : getRepository().updateNotice(row.id, {
                                      sort_order: index,
                                  }),
                        ),
                    );
                    setNotice2("並び順を保存しました");
                } catch (caught) {
                    setNotice2(
                        caught instanceof Error
                            ? caught.message
                            : "並び順を保存できませんでした",
                    );
                }
                window.setTimeout(() => setNotice2(""), 2500);
            })();
        },
    });

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
                <ul
                    ref={reorder.listRef}
                    {...reorder.listProps}
                    className="space-y-2"
                >
                    {notices.map((notice) => {
                        const isOpen = openId === notice.id;
                        const tone = noticeColor(notice.type);
                        const isHeld = reorder.heldId === notice.id;

                        return (
                            <li
                                key={notice.id}
                                {...reorder.itemProps(notice.id)}
                                title="長押しでつかんで、上下に動かすと並べ替えられます"
                                className={[
                                    "overflow-hidden rounded-xl border bg-surface",
                                    // つかんでいる行は浮かせて、どれを持っているか見せる
                                    isHeld
                                        ? "select-none border-forest shadow-lg"
                                        : "border-line",
                                ].join(" ")}
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
                                                            /*
                                                             * 失敗したら理由を画面に出す。
                                                             * 黙って止まると「一切反映されない」
                                                             * ようにしか見えず、原因を探させてしまう。
                                                             */
                                                            try {
                                                            /*
                                                             * 端末の中（IndexedDB）ではなく、
                                                             * 外の置き場（Storage）へ上げる。
                                                             * 端末の中に置くと、貼った本人にしか
                                                             * 見えず、帯にも出せない。
                                                             */
                                                            const shrunk =
                                                                await shrinkImage(
                                                                    file,
                                                                    true,
                                                                );
                                                            const url =
                                                                await uploadImage(
                                                                    shrunk,
                                                                    "notices",
                                                                );
                                                            /* 前の絵は置き場に応じて片づける */
                                                            if (notice.image_url) {
                                                                if (
                                                                    notice.image_url.startsWith(
                                                                        IDB_PREFIX,
                                                                    )
                                                                ) {
                                                                    await deleteImage(
                                                                        notice.image_url,
                                                                    );
                                                                } else {
                                                                    await removeImage(
                                                                        notice.image_url,
                                                                    );
                                                                }
                                                            }
                                                            await patch(notice.id, {
                                                                image_url: url,
                                                            });
                                                            } catch (caught) {
                                                                console.error(
                                                                    "[notice-image]",
                                                                    caught,
                                                                );
                                                                setNotice2(
                                                                    caught instanceof Error
                                                                        ? `画像を置けませんでした：${caught.message}`
                                                                        : "画像を置けませんでした",
                                                                );
                                                                window.setTimeout(
                                                                    () => setNotice2(""),
                                                                    8000,
                                                                );
                                                            }
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
                                                                const old =
                                                                    notice.image_url as string;
                                                                if (
                                                                    old.startsWith(
                                                                        IDB_PREFIX,
                                                                    )
                                                                ) {
                                                                    await deleteImage(old);
                                                                } else {
                                                                    await removeImage(old);
                                                                }
                                                                await patch(notice.id, {
                                                                    image_url: null,
                                                                });
                                                            }}
                                                            className="mt-1 w-full rounded py-1 text-[10px] text-faint hover:text-ink"
                                                        >
                                                            外す
                                                        </button>
                                                    )}

                                                    {/*
                                                     * 帯に出すかは運営が選ぶ。
                                                     * 知らせによっては、ベルだけで
                                                     * 済ませたいものもある。
                                                     */}
                                                    {notice.image_url && (
                                                        <label className="mt-2 flex items-center gap-2 text-[11px] text-ink">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    notice.show_on_home !==
                                                                    false
                                                                }
                                                                onChange={(e) =>
                                                                    void patch(
                                                                        notice.id,
                                                                        {
                                                                            show_on_home:
                                                                                e.target
                                                                                    .checked,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            ホームの流れる帯にも出す
                                                        </label>
                                                    )}

                                                    {/*
                                                     * 出ない理由は黙らずに書く。
                                                     * 黙って出さないと、壊れたと
                                                     * 思われて原因を探させてしまう。
                                                     */}
                                                    {notice.image_url?.startsWith(
                                                        IDB_PREFIX,
                                                    ) && (
                                                        <p className="mt-1 rounded bg-amber-tint px-2 py-1.5 text-[10px] leading-relaxed text-amber">
                                                            この画像はこの端末の中にしか
                                                            ありません。ホームの帯には
                                                            出ないので、「差し替える」で
                                                            同じ画像を選び直してください。
                                                        </p>
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
