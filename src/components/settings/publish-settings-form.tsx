/**
 * ============================================================
 * 原石航路 Studio
 * PublishSettingsForm — 設定 / 公開設定
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";

import { appConfig } from "@/config";
import { getRepository } from "@/lib/repository";
import type {
    NotifyTiming,
    PublishSettings,
    SerialStatus,
    Visibility,
    Work,
} from "@/types";
import {
    NOTIFY_TIMING_LABEL,
    SERIAL_STATUS_LABEL,
    validateSchedule,
    VISIBILITY_DESCRIPTION,
    VISIBILITY_LABEL,
} from "@/types";

interface Props {
    work: Work;
    /**
     * 公開されている話の数。
     *
     * 0 のとき、公開設定にしても誰にも読まれない。
     * そこを知らせるために受け取る。
     */
    livePisodeCount?: number;
    settings: PublishSettings;
    onChange: (patch: Partial<Omit<PublishSettings, "work_id">>) => void;}

export default function PublishSettingsForm({ work, settings, livePisodeCount = -1, onChange }: Props) {


    const [copied, setCopied] = useState(false);

    const scheduleError = validateSchedule(settings);
    /*
     * 読者へ渡す公開 URL。
     *
     * ★ ここは必ず appConfig.siteUrl から組み立てる。
     *
     *   以前は https://gensekikoro.jp/work/<id の先頭8文字> を直に書いていた。
     *   .jp は持っていない住所なので、押した人に証明書の警告が出て
     *   サイトへ入れなかった。道筋も /work/ ではなく /novel/ で、
     *   id を切ると当たらない。3つとも外れていた。
     */
    const publicUrl = `${appConfig.siteUrl}/novel/${work.id}`;

    async function handleCopyUrl() {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="space-y-4">
            {/*
              * 話が 1 つも公開されていないときの知らせ。
              *
              * ★ 作品を公開しても、話が無ければ誰にも読まれない。
              *
              *   実際、39 話書いて 1 つも公開されていない作品があった。
              *   作者は公開したつもりでいる。
              *
              * ★ -1 は「まだ数えていない」。そのときは出さない。
              */}
            {livePisodeCount === 0 && (
                <div className="rounded-lg border border-[var(--color-amber)] bg-[color-mix(in_srgb,var(--color-amber)_8%,transparent)] px-4 py-3.5">
                    <p className="text-[13px] font-bold text-ink">
                        話がまだ公開されていません
                    </p>
                    <p className="mt-2 text-[12px] leading-[1.9] text-muted">
                        作品を公開にしても、公開された話が 1 つも無いと、
                        読者には出てきません。
                        <br />
                        「投稿」の画面から、話を公開してください。
                    </p>
                </div>
            )}

            <Card
                title="作品の公開設定"
                description="作品そのものを、誰が読めるようにするかを決めます。"
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <section>
                        <h3 className="text-sm font-medium text-ink">公開状態</h3>
                        <div className="mt-2 space-y-2">
                            {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((key) => (
                                <label
                                    key={key}
                                    className={[
                                        "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                                        settings.visibility === key
                                            ? "border-forest bg-forest-tint"
                                            : "border-line hover:bg-canvas",
                                    ].join(" ")}
                                >
                                    <input
                                        type="radio"
                                        name="visibility"
                                        checked={settings.visibility === key}
                                        onChange={() => onChange({ visibility: key })}
                                        className="mt-0.5 accent-[var(--color-forest)]"
                                    />
                                    <span>
                                        <span className="block text-sm text-ink">
                                            {VISIBILITY_LABEL[key]}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-muted">
                                            {VISIBILITY_DESCRIPTION[key]}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>

                </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card
                    title="読者からの反応"
                    description="読者が作品に対してできることを決めます。"
                >
                    <ToggleRow
                        label="コメント"
                        note="各話に、読者がコメントを書けます。"
                        checked={settings.allow_comments}
                        onChange={(next) => onChange({ allow_comments: next })}
                    />

                    {settings.allow_comments && (
                        <div className="mb-4 mt-2 flex gap-2 pl-1">
                            <SmallChoice
                                label="すべて公開"
                                isSelected={!settings.moderate_comments}
                                onClick={() => onChange({ moderate_comments: false })}
                            />
                            <SmallChoice
                                label="承認してから公開"
                                isSelected={settings.moderate_comments}
                                onClick={() => onChange({ moderate_comments: true })}
                            />
                        </div>
                    )}

                    <ToggleRow
                        label="いいね"
                        note="読者が作品にいいねを付けられます。"
                        checked={settings.allow_likes ?? true}
                        onChange={(next) => onChange({ allow_likes: next })}
                    />

                    <ToggleRow
                        label="保存"
                        note="読者が本棚に保存できます。"
                        checked={settings.allow_bookmarks ?? true}
                        onChange={(next) => onChange({ allow_bookmarks: next })}
                    />

                    <ToggleRow
                        label="共有"
                        note="読者がSNSなどで作品を紹介できます。"
                        checked={settings.allow_shares ?? true}
                        onChange={(next) => onChange({ allow_shares: next })}
                    />

                    <p className="mt-3 text-[11px] leading-relaxed text-faint">
                        通知の設定は、マイページから変更できます。
                    </p>
                </Card>

                <Card title="連載の状態">
                    <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(SERIAL_STATUS_LABEL) as SerialStatus[]).map((key) => (
                            <SmallChoice
                                key={key}
                                label={SERIAL_STATUS_LABEL[key]}
                                isSelected={settings.serial_status === key}
                                onClick={() => onChange({ serial_status: key })}
                            />
                        ))}
                    </div>

                    {/*
                     * 「完成した話だけ公開」は外した。
                     * 話ごとに公開を決められるようになったので、
                     * 二重の決まりになって迷う。
                     */}
                    {/*
                     * 更新の知らせ。
                     * 連載の状態と地続きの話なので、同じ欄に置く。
                     */}
                    <div className="mt-4 border-t border-line pt-4">
                        <ToggleRow
                            label="更新を知らせる"
                            note="話を投稿したとき、読んでいる人に知らせます。"
                            checked={settings.notify_on_publish ?? true}
                            onChange={(next) =>
                                onChange({ notify_on_publish: next })
                            }
                        />
                    </div>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="更新通知">
                    <ToggleRow
                        label="新しい話を公開したら通知する"
                        checked={settings.notify_followers}
                        onChange={(next) => onChange({ notify_followers: next })}
                    />
                    {settings.notify_followers && (
                        <div className="mt-3 space-y-2">
                            {(Object.keys(NOTIFY_TIMING_LABEL) as NotifyTiming[]).map((key) => (
                                <label
                                    key={key}
                                    className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                                >
                                    <input
                                        type="radio"
                                        name="notify-timing"
                                        checked={settings.notify_timing === key}
                                        onChange={() => onChange({ notify_timing: key })}
                                        className="accent-[var(--color-forest)]"
                                    />
                                    {NOTIFY_TIMING_LABEL[key]}
                                </label>
                            ))}
                        </div>
                    )}
                </Card>

                <Card title="公開URL">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={publicUrl}
                            readOnly
                            aria-label="公開URL"
                            className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted"
                        />
                        <button
                            type="button"
                            onClick={() => void handleCopyUrl()}
                            className="shrink-0 rounded-md border border-line px-3 py-2 text-sm text-muted hover:border-forest-line hover:text-forest"
                        >
                            {copied ? "コピーしました" : "コピー"}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-faint">
                        まだ投稿サイト本体がないため、このURLは仮のものです。
                    </p>
                </Card>

            </div>
        </div>
    );
}

/**
 * ============================================================
 * 小さな部品
 * ============================================================
 */

function formatSchedule(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Card({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-4">
                <h2 className="text-base font-medium text-ink">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                checked ? "bg-forest" : "bg-[var(--color-line)]",
            ].join(" ")}
        >
            <span
                className={[
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    checked ? "left-[22px]" : "left-0.5",
                ].join(" ")}
            />
        </button>
    );
}

function ToggleRow({
    label,
    note,
    checked,
    onChange,
}: {
    label: string;
    /** 何が起きるかの一言。無ければ出さない */
    note?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="mb-4 flex items-start justify-between gap-4 last:mb-0">
            <span className="min-w-0">
                <span className="block text-sm text-ink">{label}</span>
                {note && (
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                        {note}
                    </span>
                )}
            </span>
            <Toggle checked={checked} onChange={onChange} label={label} />
        </div>
    );
}

function SmallChoice({
    label,
    isSelected,
    onClick,
}: {
    label: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isSelected}
            className={[
                "rounded-full border px-3 py-1.5 text-xs",
                isSelected
                    ? "border-forest bg-forest-tint text-forest"
                    : "border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
        </button>
    );
}
