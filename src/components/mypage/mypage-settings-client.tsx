/**
 * ============================================================
 * 原石航路 Studio
 * MypageSettingsClient — 設定
 *
 * 名乗り・知らせ・AI・遮った人。
 * どれも自分のことだけなので、作品や履歴は要らない。
 * ============================================================
 */

"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

interface Props {
    profile: any;
    blocks: any[];
    mutes: any[];
}

/** 知らせの入切 */
const NOTIFY_ROWS = [
    { key: "notify_like", label: "いいねされたとき" },
    { key: "notify_comment", label: "コメントがついたとき" },
    { key: "notify_follow", label: "フォローされたとき" },
    { key: "notify_new_episode", label: "追っている作品が更新されたとき" },
    { key: "notify_new_work", label: "追っている書き手が新作を出したとき" },
];

export default function MypageSettingsClient({ profile, blocks, mutes }: Props) {
    const supabase = createClient();

    const [values, setValues] = useState(profile);
    const [saving, setSaving] = useState("");

    async function save(patch: Record<string, unknown>) {
        setValues({ ...values, ...patch });
        setSaving("保存中…");

        await supabase.from("profiles").update(patch).eq("user_id", profile.user_id);

        setSaving("保存しました");
        window.setTimeout(() => setSaving(""), 2000);
    }

    return (
        <div className="space-y-4">
            {saving && (
                <p className="text-right text-[11px] text-forest">{saving}</p>
            )}

            {/* 名乗り */}
            <Card title="プロフィール">
                <Field label="ペンネーム">
                    <input
                        type="text"
                        defaultValue={values.display_name ?? ""}
                        onBlur={(e) => void save({ display_name: e.target.value })}
                        className={inputClass}
                    />
                </Field>

                <Field label="自己紹介">
                    <textarea
                        defaultValue={values.bio ?? ""}
                        rows={3}
                        onBlur={(e) => void save({ bio: e.target.value })}
                        className={inputClass}
                    />
                </Field>

                <Field label="X（旧Twitter）">
                    <input
                        type="text"
                        defaultValue={values.x_account ?? ""}
                        onBlur={(e) => void save({ x_account: e.target.value })}
                        placeholder="@なしで入力"
                        className={inputClass}
                    />
                </Field>
            </Card>

            {/* 知らせ */}
            <Card title="通知">
                {NOTIFY_ROWS.map((row) => (
                    <Toggle
                        key={row.key}
                        label={row.label}
                        checked={values[row.key] !== false}
                        onChange={(next) => void save({ [row.key]: next })}
                    />
                ))}
            </Card>

            {/* 読者からの反応 */}
            <Card title="読者からの反応">
                <Toggle
                    label="コメントを受け付ける"
                    checked={values.allow_comments !== false}
                    onChange={(next) => void save({ allow_comments: next })}
                />
            </Card>

            {/* AI */}
            <Card title="AI">
                <Toggle
                    label="AIを使った作品も表示する"
                    note="切ると、AIを使った作品が一覧に出なくなります。"
                    checked={values.show_ai_works !== false}
                    onChange={(next) => void save({ show_ai_works: next })}
                />
            </Card>

            {/* 遮った人 */}
            {(blocks.length > 0 || mutes.length > 0) && (
                <Card title="遮っている人">
                    {blocks.length > 0 && (
                        <div className="mb-3">
                            <p className="mb-1.5 text-[11px] text-faint">ブロック</p>
                            <ul className="space-y-1">
                                {blocks.map((row: any) => (
                                    <li
                                        key={row.blocked_id}
                                        className="text-[12px] text-ink"
                                    >
                                        {row.profiles?.display_name ?? "名無し"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {mutes.length > 0 && (
                        <div>
                            <p className="mb-1.5 text-[11px] text-faint">ミュート</p>
                            <ul className="space-y-1">
                                {mutes.map((row: any) => (
                                    <li
                                        key={row.muted_id}
                                        className="text-[12px] text-ink"
                                    >
                                        {row.profiles?.display_name ?? "名無し"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="mb-3.5 text-sm font-medium text-ink">{title}</h2>
            {children}
        </section>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="mb-3.5 block last:mb-0">
            <span className="mb-1.5 block text-xs text-muted">{label}</span>
            {children}
        </label>
    );
}

function Toggle({
    label,
    note,
    checked,
    onChange,
}: {
    label: string;
    note?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="mb-3 flex cursor-pointer items-start justify-between gap-4 last:mb-0">
            <span className="min-w-0">
                <span className="block text-[13px] text-ink">{label}</span>
                {note && (
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                        {note}
                    </span>
                )}
            </span>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={[
                    "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
                    checked ? "bg-forest" : "bg-line",
                ].join(" ")}
            >
                <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: checked ? 18 : 2 }}
                />
            </button>
        </label>
    );
}

const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-forest";
