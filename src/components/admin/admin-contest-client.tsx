/**
 * ============================================================
 * 原石航路 Studio
 * AdminContestClient — コンテストを立てて回す
 *
 * 運営が使う場所。
 *   立てる → 募集する → 締め切る → 選ぶ → 結果を出す
 * この流れがそのまま画面の並びになっている。
 *
 * ログインはまだ無いので、誰でも開ける。
 * 保存先ができたら、ここへ入れるのは運営だけにする。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import ContestBanner from "@/components/common/contest-banner";
import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import { deleteImage, putImage, shrinkImage } from "@/lib/storage/image-store";
import { formatNumber } from "@/lib/utils/text";
import {
    CONTEST_STATUS_COLOR,
    CONTEST_STATUS_DESCRIPTION,
    CONTEST_STATUS_LABEL,
    daysUntil,
    statusColor,
    statusLabel,
} from "@/types";
import type { Contest, ContestEntry, ContestStatus } from "@/types";

export default function AdminContestClient() {
    const [contests, setContests] = useState<Contest[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [entries, setEntries] = useState<ContestEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        const repository = getRepository();
        const rows = await repository.listContests();
        setContests(rows);
        setIsLoading(false);
        return rows;
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (!selectedId) {
            setEntries([]);
            return;
        }
        void (async () => {
            setEntries(await getRepository().listContestEntries(selectedId));
        })();
    }, [selectedId, contests]);

    const selected = contests.find((row) => row.id === selectedId) ?? null;

    async function patch(contestId: string, next: Partial<Contest>) {
        await getRepository().updateContest(contestId, next);
        await reload();
    }

    return (
        <AdminShell
            title="コンテスト"
            description="立てて、募集して、選んで、結果を出すまで。"
            action={
                <button
                    type="button"
                    onClick={async () => {
                        const created = await getRepository().createContest();
                        await reload();
                        setSelectedId(created.id);
                    }}
                    className="rounded-full bg-forest px-5 py-2 text-xs text-white hover:bg-forest-dark"
                >
                    ＋ 新しいコンテスト
                </button>
            }
        >

                {isLoading ? (
                    <p className="py-20 text-center text-sm text-faint">
                        読み込んでいます
                    </p>
                ) : contests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line py-20 text-center">
                        <p className="text-sm text-muted">
                            まだコンテストがありません。
                        </p>
                        <p className="mt-1 text-xs text-faint">
                            右上の「新しいコンテスト」から立てられます。
                        </p>
                    </div>
                ) : (
                    <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                        {/* 一覧 */}
                        <ul className="space-y-2">
                            {contests.map((contest) => (
                                <li key={contest.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(contest.id)}
                                        className={[
                                            "w-full rounded-xl border bg-surface px-4 py-3 text-left",
                                            contest.id === selectedId
                                                ? "border-forest"
                                                : "border-line hover:border-forest-line",
                                        ].join(" ")}
                                        style={{
                                            // 左端に状態の色を出す。一覧で並べたとき目印になる
                                            borderLeft: `4px solid ${statusColor(contest.status).chip}`,
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <StatusChip status={contest.status} />
                                            {contest.status === "open" && (
                                                <span
                                                    className="text-[10px] font-medium"
                                                    style={{
                                                        color: CONTEST_STATUS_COLOR.open
                                                            .text,
                                                    }}
                                                >
                                                    あと{daysUntil(contest.ends_at)}日
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1.5 flex gap-2.5">
                                            <ContestBanner
                                                contest={contest}
                                                className="aspect-video w-16 shrink-0 rounded"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] font-medium text-ink">
                                                    {contest.title || "名前のないコンテスト"}
                                                </p>
                                                <p className="mt-0.5 text-[10px] text-faint">
                                                    {formatWhen(contest.starts_at)}
                                                    <br />〜 {formatWhen(contest.ends_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {/* 中身 */}
                        {selected ? (
                            <ContestEditor
                                contest={selected}
                                entries={entries}
                                onChange={(next) => void patch(selected.id, next)}
                                onDelete={async () => {
                                    await getRepository().deleteContest(selected.id);
                                    setSelectedId(null);
                                    await reload();
                                }}
                                onUpdateEntry={async (entryId, next) => {
                                    await getRepository().updateContestEntry(
                                        entryId,
                                        next,
                                    );
                                    setEntries(
                                        await getRepository().listContestEntries(
                                            selected.id,
                                        ),
                                    );
                                }}
                            />
                        ) : (
                            <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                                左から選んでください。
                            </p>
                        )}
                    </div>
                )}
        </AdminShell>
    );
}

/**
 * ============================================================
 * 中身
 * ============================================================
 */

function ContestEditor({
    contest,
    entries,
    onChange,
    onDelete,
    onUpdateEntry,
}: {
    contest: Contest;
    entries: ContestEntry[];
    onChange: (patch: Partial<Contest>) => void;
    onDelete: () => void;
    onUpdateEntry: (entryId: string, patch: Partial<ContestEntry>) => void;
}) {
    const [isClosing, setIsClosing] = useState(false);

    return (
        <div className="space-y-4">
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
                <div className="space-y-4">
                    <Section title="内容">
                        <Labeled label="いまの状態">
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {(
                                    Object.keys(CONTEST_STATUS_LABEL) as ContestStatus[]
                                ).map((key) => {
                                    const tone = statusColor(key);
                                    const isCurrent = contest.status === key;

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => onChange({ status: key })}
                                            aria-pressed={isCurrent}
                                            title={CONTEST_STATUS_DESCRIPTION[key]}
                                            className="rounded-full border px-3 py-1 text-[11px] font-medium"
                                            style={{
                                                background: isCurrent
                                                    ? tone.bg
                                                    : "transparent",
                                                color: isCurrent ? tone.text : "#7d867f",
                                                borderColor: isCurrent
                                                    ? tone.border
                                                    : "var(--color-line)",
                                            }}
                                        >
                                            {statusLabel(key)}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1 text-[10px] text-faint">
                                {CONTEST_STATUS_DESCRIPTION[contest.status]}
                            </p>
                        </Labeled>

                        <Labeled label="名前">
                            <input
                                type="text"
                                defaultValue={contest.title}
                                maxLength={60}
                                onBlur={(e) => onChange({ title: e.target.value.trim() })}
                                placeholder="第1回 原石航路大賞"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="ひとこと">
                            <input
                                type="text"
                                defaultValue={contest.catchphrase}
                                maxLength={60}
                                onBlur={(e) =>
                                    onChange({ catchphrase: e.target.value.trim() })
                                }
                                placeholder="受賞作は書籍化"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="くわしく">
                            <textarea
                                defaultValue={contest.description}
                                rows={4}
                                onBlur={(e) =>
                                    onChange({ description: e.target.value.trim() })
                                }
                                placeholder="どんな作品を求めているか、選び方、注意など"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="表に出す画像">
                            <BannerField contest={contest} onChange={onChange} />
                        </Labeled>

                        <Labeled label="主催">
                            <input
                                type="text"
                                defaultValue={contest.organizer}
                                maxLength={60}
                                onBlur={(e) =>
                                    onChange({ organizer: e.target.value.trim() })
                                }
                                placeholder="株式会社◯◯"
                                className={inputClass}
                            />
                        </Labeled>
                    </Section>

                    <Section title="求めるもの">
                        <Labeled label="募集テーマ">
                            <textarea
                                defaultValue={contest.theme}
                                rows={3}
                                onBlur={(e) => onChange({ theme: e.target.value.trim() })}
                                placeholder="どんな作品を探しているか"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="読者層">
                            <input
                                type="text"
                                defaultValue={contest.audience}
                                maxLength={60}
                                onBlur={(e) =>
                                    onChange({ audience: e.target.value.trim() })
                                }
                                placeholder="30代〜50代 女性"
                                className={inputClass}
                            />
                        </Labeled>

                        <PairList
                            label="選考で見るところ"
                            rows={(contest.checkpoints ?? []).map((row) => ({
                                a: row.title,
                                b: row.body,
                            }))}
                            placeholderA="魅力的な人物と設定"
                            placeholderB="どこを見るか"
                            isLong
                            onChange={(rows) =>
                                onChange({
                                    checkpoints: rows.map((row) => ({
                                        title: row.a,
                                        body: row.b,
                                    })),
                                })
                            }
                        />
                    </Section>

                    <Section title="賞">
                        <PairList
                            label="賞の内訳"
                            rows={(contest.prizes ?? []).map((row) => ({
                                a: row.label,
                                b: row.detail,
                            }))}
                            placeholderA="金賞（1名）"
                            placeholderB="賞金10万円＋書籍化"
                            onChange={(rows) =>
                                onChange({
                                    prizes: rows.map((row) => ({
                                        label: row.a,
                                        detail: row.b,
                                    })),
                                })
                            }
                        />
                    </Section>

                    <Section title="日どり">
                        {/*
                         * 時刻まで決められるようにする。
                         *
                         * 締め切りは「その日のいつまでか」で意味が変わる。
                         * 日にちだけだと、23:59 なのか正午なのか分からず、
                         * 出す側も受ける側も困る。
                         */}
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Labeled label="始まり">
                                <input
                                    type="datetime-local"
                                    value={toLocalInput(contest.starts_at)}
                                    onChange={(e) =>
                                        onChange({ starts_at: e.target.value })
                                    }
                                    className={inputClass}
                                />
                            </Labeled>
                            <Labeled label="締め切り">
                                <input
                                    type="datetime-local"
                                    value={toLocalInput(contest.ends_at)}
                                    onChange={(e) => onChange({ ends_at: e.target.value })}
                                    className={inputClass}
                                />
                            </Labeled>
                            <Labeled label="結果">
                                <input
                                    type="datetime-local"
                                    value={toLocalInput(contest.result_at)}
                                    onChange={(e) =>
                                        onChange({ result_at: e.target.value })
                                    }
                                    className={inputClass}
                                />
                            </Labeled>
                        </div>

                        {contest.status === "open" && (
                            <p
                                className="mt-2 rounded-md border px-3 py-2 text-[11px]"
                                style={{
                                    background: CONTEST_STATUS_COLOR.open.bg,
                                    color: CONTEST_STATUS_COLOR.open.text,
                                    borderColor: CONTEST_STATUS_COLOR.open.border,
                                }}
                            >
                                締め切りまであと {daysUntil(contest.ends_at)} 日
                            </p>
                        )}
                    </Section>
                </div>

                <div className="space-y-4">
                    <Section title="出せる作品の決まり">
                        <div className="grid grid-cols-2 gap-2">
                            <Labeled label="下限の文字数">
                                <input
                                    type="number"
                                    min={0}
                                    value={contest.min_chars}
                                    onChange={(e) =>
                                        onChange({ min_chars: Number(e.target.value) || 0 })
                                    }
                                    className={inputClass}
                                />
                            </Labeled>
                            <Labeled label="上限の文字数">
                                <input
                                    type="number"
                                    min={0}
                                    value={contest.max_chars}
                                    onChange={(e) =>
                                        onChange({ max_chars: Number(e.target.value) || 0 })
                                    }
                                    className={inputClass}
                                />
                            </Labeled>
                        </div>
                        <p className="-mt-1 mb-3 text-[10px] text-faint">
                            0 にすると、その向きの制限はありません。
                        </p>

                        <Labeled label="一人が出せる数">
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={contest.entry_limit}
                                onChange={(e) =>
                                    onChange({
                                        entry_limit: Math.max(
                                            1,
                                            Number(e.target.value) || 1,
                                        ),
                                    })
                                }
                                className={`${inputClass} w-28`}
                            />
                        </Labeled>

                        <Labeled label="参加資格">
                            <input
                                type="text"
                                defaultValue={contest.eligibility}
                                maxLength={80}
                                onBlur={(e) =>
                                    onChange({ eligibility: e.target.value.trim() })
                                }
                                placeholder="プロ・アマ、年齢を問いません"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="本文以外に要るもの">
                            <input
                                type="text"
                                defaultValue={contest.required_materials}
                                maxLength={80}
                                onBlur={(e) =>
                                    onChange({
                                        required_materials: e.target.value.trim(),
                                    })
                                }
                                placeholder="あらすじ（400字以内）"
                                className={inputClass}
                            />
                        </Labeled>

                        <Labeled label="AIの扱い">
                            <textarea
                                defaultValue={contest.ai_policy}
                                rows={2}
                                onBlur={(e) =>
                                    onChange({ ai_policy: e.target.value.trim() })
                                }
                                placeholder="思いつきや誤字の確認に使うのは構いません"
                                className={inputClass}
                            />
                        </Labeled>

                        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                            <div>
                                <p className="text-[13px] text-ink">
                                    他所で公開した作品も出せる
                                </p>
                                <p className="mt-0.5 text-[11px] text-faint">
                                    切ると、未公開の作品だけになります。
                                </p>
                            </div>
                            <Toggle
                                on={contest.allow_published}
                                label="他所で公開した作品も出せる"
                                onChange={(next) => onChange({ allow_published: next })}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                            <p className="text-[13px] text-ink">未完結でも出せる</p>
                            <Toggle
                                on={contest.allow_unfinished}
                                label="未完結でも出せる"
                                onChange={(next) => onChange({ allow_unfinished: next })}
                            />
                        </div>
                    </Section>

                    <Section title="出し方と注意">
                        <LineList
                            label="応募のしかた"
                            rows={contest.steps ?? []}
                            placeholder="作品を書く／タグを付けて投稿する など"
                            onChange={(steps) => onChange({ steps })}
                        />

                        <LineList
                            label="注意すること"
                            rows={contest.notices ?? []}
                            placeholder="選考についてのお答えはできません など"
                            onChange={(notices) => onChange({ notices })}
                        />

                        <Labeled label="応募規約">
                            <textarea
                                defaultValue={contest.terms}
                                rows={5}
                                onBlur={(e) => onChange({ terms: e.target.value })}
                                placeholder="長くなる場合はここへ。書き手の画面では折りたたまれます"
                                className={inputClass}
                            />
                        </Labeled>
                    </Section>

                    {/* 応募 */}
                    <Section title={`応募 ${entries.length}件`}>
                        {entries.length === 0 ? (
                            <p className="py-6 text-center text-[11px] text-faint">
                                まだ応募がありません。
                            </p>
                        ) : (
                            <ul className="thin-scroll max-h-80 space-y-1.5 overflow-y-auto">
                                {entries.map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="rounded-lg border border-line px-3 py-2.5"
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] text-ink">
                                                    {entry.work_title}
                                                </p>
                                                <p className="mt-0.5 text-[10px] text-faint">
                                                    {entry.author_name} ·{" "}
                                                    {formatNumber(entry.char_count)}字 ·{" "}
                                                    {entry.entered_at.slice(0, 10)}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onUpdateEntry(entry.id, {
                                                            is_shortlisted:
                                                                !entry.is_shortlisted,
                                                        })
                                                    }
                                                    className={[
                                                        "rounded-md border px-2 py-1 text-[10px]",
                                                        entry.is_shortlisted
                                                            ? "border-forest bg-forest-tint text-forest"
                                                            : "border-line text-muted hover:text-ink",
                                                    ].join(" ")}
                                                >
                                                    候補
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onUpdateEntry(entry.id, {
                                                            is_awarded: !entry.is_awarded,
                                                        })
                                                    }
                                                    className={[
                                                        "rounded-md border px-2 py-1 text-[10px]",
                                                        entry.is_awarded
                                                            ? "border-[var(--color-amber)] bg-[var(--color-amber-tint)] text-[var(--color-amber)]"
                                                            : "border-line text-muted hover:text-ink",
                                                    ].join(" ")}
                                                >
                                                    受賞
                                                </button>
                                            </div>
                                        </div>

                                        {entry.is_awarded && (
                                            <input
                                                type="text"
                                                defaultValue={entry.award_label}
                                                onBlur={(e) =>
                                                    onUpdateEntry(entry.id, {
                                                        award_label: e.target.value.trim(),
                                                    })
                                                }
                                                placeholder="大賞 / 佳作 など"
                                                className="mt-2 w-full rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>

                    {/* 消す */}
                    {isClosing ? (
                        <section className="rounded-xl border border-[var(--color-danger)] bg-surface px-5 py-4">
                            <p className="text-sm text-ink">
                                「{contest.title || "このコンテスト"}」を削除しますか
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                                応募もすべて消えます。元に戻せません。
                            </p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsClosing(false)}
                                    className="flex-1 rounded-lg border border-line py-2 text-xs text-muted hover:text-ink"
                                >
                                    やめる
                                </button>
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="flex-1 rounded-lg bg-[var(--color-danger)] py-2 text-xs font-medium text-white hover:opacity-90"
                                >
                                    削除する
                                </button>
                            </div>
                        </section>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsClosing(true)}
                            className="w-full rounded-xl border border-[var(--color-danger)] py-2.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                        >
                            このコンテストを削除する
                        </button>
                    )}
                </div>
            </div>

            <p className="rounded-lg bg-surface px-4 py-3 text-[11px] leading-relaxed text-faint">
                いまは自分の端末の中にだけ残ります。
                書き手に見せるには、保存先とログインが必要です。
                <Link
                    href={`/contest/${contest.id}`}
                    className="ml-1.5 text-forest hover:underline"
                >
                    書き手から見える画面を確かめる
                </Link>
            </p>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

const inputClass =
    "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">{title}</h2>
            {children}
        </section>
    );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3 last:mb-0">
            <span className="text-xs font-medium text-ink">{label}</span>
            {children}
        </div>
    );
}

function StatusChip({ status }: { status: ContestStatus }) {
    const tone = statusColor(status);

    return (
        <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={{
                background: tone.bg,
                color: tone.text,
                borderColor: tone.border,
            }}
        >
            {statusLabel(status)}
        </span>
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

/**
 * ============================================================
 * 部品
 * ============================================================
 */
function BannerField({
    contest,
    onChange,
}: {
    contest: Contest;
    onChange: (patch: Partial<Contest>) => void;
}) {
    const [isBusy, setIsBusy] = useState(false);
    const [notice, setNotice] = useState("");

    async function handleUpload(file: File | undefined) {
        if (!file) return;
        setIsBusy(true);
        setNotice("");
        try {
            // 帯は幅いっぱいに出るので、大きめに残す
            const shrunk = await shrinkImage(file, true);
            const ref = await putImage(shrunk);
            if (contest.banner_url) await deleteImage(contest.banner_url);
            onChange({ banner_url: ref });
        } catch {
            setNotice("この画像は読み込めませんでした。");
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <div className="mt-1">
            <div className="space-y-2">
                {/* 出来上がりの見え方 */}
                <ContestBanner
                    contest={contest}
                    className="aspect-video w-full rounded-lg border border-line"
                    fallback="画像なし"
                />

                <div className="min-w-0">
                    <input
                        id="contest-banner"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => void handleUpload(e.target.files?.[0])}
                        className="hidden"
                    />
                    <label
                        htmlFor="contest-banner"
                        className="block cursor-pointer rounded-md border border-line py-1.5 text-center text-xs text-ink hover:border-forest-line hover:text-forest"
                    >
                        {isBusy
                            ? "取り込んでいます…"
                            : contest.banner_url
                              ? "差し替える"
                              : "画像を選ぶ"}
                    </label>

                    {contest.banner_url && (
                        <>
                            {/* 収め方 */}
                            <div className="mt-2 flex gap-1">
                                {(
                                    [
                                        { value: "cover", label: "枠に合わせる" },
                                        { value: "contain", label: "全体を見せる" },
                                    ] as const
                                ).map((row) => (
                                    <button
                                        key={row.value}
                                        type="button"
                                        onClick={() => onChange({ banner_fit: row.value })}
                                        aria-pressed={contest.banner_fit === row.value}
                                        className={[
                                            "flex-1 rounded border py-1 text-[10px]",
                                            contest.banner_fit === row.value
                                                ? "border-forest bg-forest-tint text-forest"
                                                : "border-line text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {row.label}
                                    </button>
                                ))}
                            </div>

                            {contest.banner_fit === "cover" && (
                                <>
                                    <Slider
                                        label="大きさ"
                                        min={100}
                                        max={260}
                                        value={contest.banner_zoom}
                                        onChange={(banner_zoom) => onChange({ banner_zoom })}
                                    />
                                    <Slider
                                        label="よこ"
                                        min={0}
                                        max={100}
                                        value={contest.banner_x}
                                        onChange={(banner_x) => onChange({ banner_x })}
                                    />
                                    <Slider
                                        label="たて"
                                        min={0}
                                        max={100}
                                        value={contest.banner_y}
                                        onChange={(banner_y) => onChange({ banner_y })}
                                    />
                                </>
                            )}

                            <button
                                type="button"
                                onClick={async () => {
                                    if (contest.banner_url) {
                                        await deleteImage(contest.banner_url);
                                    }
                                    onChange({ banner_url: null });
                                }}
                                className="mt-1.5 w-full rounded py-1 text-[10px] text-faint hover:text-ink"
                            >
                                画像を外す
                            </button>
                        </>
                    )}
                </div>
            </div>

            <p className="mt-1.5 text-[10px] text-faint">
                横長（16:9）で並びます。長辺1200pxまで残します。
            </p>

            {notice && (
                <p className="mt-1 text-[11px] text-[var(--color-amber)]">{notice}</p>
            )}
        </div>
    );
}

function Slider({
    label,
    min,
    max,
    value,
    onChange,
}: {
    label: string;
    min: number;
    max: number;
    value: number;
    onChange: (next: number) => void;
}) {
    return (
        <label className="mt-1.5 flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] text-faint">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="min-w-0 flex-1 accent-[var(--color-forest)]"
            />
        </label>
    );
}

/**
 * ============================================================
 * 行を足し引きする欄
 *
 * 賞や手順は、いくつあるか決まっていない。
 * 1 つの文章にまとめると、書き手の画面で並べて見せられない。
 * ============================================================
 */

/** 「名前」と「中身」の組を並べる */
function PairList({
    label,
    rows,
    placeholderA,
    placeholderB,
    isLong = false,
    onChange,
}: {
    label: string;
    rows: { a: string; b: string }[];
    placeholderA: string;
    placeholderB: string;
    /** 中身が長くなるものは複数行にする */
    isLong?: boolean;
    onChange: (rows: { a: string; b: string }[]) => void;
}) {
    function update(index: number, patch: Partial<{ a: string; b: string }>) {
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    }

    return (
        <div className="mb-3 last:mb-0">
            <span className="text-xs font-medium text-ink">{label}</span>

            <ul className="mt-1 space-y-2">
                {rows.map((row, index) => (
                    <li
                        key={index}
                        className="rounded-md border border-line px-2.5 py-2"
                    >
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                defaultValue={row.a}
                                onBlur={(e) => update(index, { a: e.target.value })}
                                placeholder={placeholderA}
                                className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-xs outline-none focus:border-forest"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    onChange(rows.filter((_, i) => i !== index))
                                }
                                aria-label="この行を消す"
                                className="shrink-0 px-1.5 text-xs text-faint hover:text-[var(--color-danger)]"
                            >
                                ✕
                            </button>
                        </div>

                        {isLong ? (
                            <textarea
                                defaultValue={row.b}
                                rows={2}
                                onBlur={(e) => update(index, { b: e.target.value })}
                                placeholder={placeholderB}
                                className="mt-1.5 w-full rounded border border-line px-2 py-1 text-xs outline-none focus:border-forest"
                            />
                        ) : (
                            <input
                                type="text"
                                defaultValue={row.b}
                                onBlur={(e) => update(index, { b: e.target.value })}
                                placeholder={placeholderB}
                                className="mt-1.5 w-full rounded border border-line px-2 py-1 text-xs outline-none focus:border-forest"
                            />
                        )}
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={() => onChange([...rows, { a: "", b: "" }])}
                className="mt-1.5 w-full rounded-md border border-dashed border-line py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
            >
                ＋ 追加
            </button>
        </div>
    );
}

/** 1 行ずつの箇条書き */
function LineList({
    label,
    rows,
    placeholder,
    onChange,
}: {
    label: string;
    rows: string[];
    placeholder: string;
    onChange: (rows: string[]) => void;
}) {
    return (
        <div className="mb-3 last:mb-0">
            <span className="text-xs font-medium text-ink">{label}</span>

            <ul className="mt-1 space-y-1.5">
                {rows.map((row, index) => (
                    <li key={index} className="flex gap-1.5">
                        <span className="mt-1.5 shrink-0 text-[11px] text-faint">
                            {index + 1}
                        </span>
                        <textarea
                            defaultValue={row}
                            rows={1}
                            onBlur={(e) =>
                                onChange(
                                    rows.map((value, i) =>
                                        i === index ? e.target.value : value,
                                    ),
                                )
                            }
                            placeholder={placeholder}
                            className="min-w-0 flex-1 resize-y rounded border border-line px-2 py-1 text-xs outline-none focus:border-forest"
                        />
                        <button
                            type="button"
                            onClick={() => onChange(rows.filter((_, i) => i !== index))}
                            aria-label="この行を消す"
                            className="shrink-0 px-1 text-xs text-faint hover:text-[var(--color-danger)]"
                        >
                            ✕
                        </button>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={() => onChange([...rows, ""])}
                className="mt-1.5 w-full rounded-md border border-dashed border-line py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
            >
                ＋ 追加
            </button>
        </div>
    );
}

/**
 * 日どりの欄に渡す形にする。
 *
 * 日にちだけで持っていたものは、その日の 0 時として扱う。
 * 締め切りだけは、書き手が直すまで 23:59 のほうが親切だが、
 * こちらで決めると意図と違う時刻になる。
 */
function toLocalInput(value: string | null | undefined): string {
    if (!value) return "";

    /* すでに時刻まで入っている */
    if (value.includes("T")) return value.slice(0, 16);

    /* 日にちだけ */
    return `${value}T00:00`;
}

/**
 * 「8月20日 20:00」の形にする。
 *
 * 0 時ちょうどのときは時刻を出さない。
 * 決めていないのか、その時刻なのか紛らわしい。
 */
function formatWhen(value: string | null | undefined): string {
    if (!value) return "—";

    const at = new Date(value.includes("T") ? value : `${value}T00:00`);
    if (Number.isNaN(at.getTime())) return value;

    const pad = (n: number) => String(n).padStart(2, "0");
    const day = `${at.getFullYear()}/${at.getMonth() + 1}/${at.getDate()}`;

    if (at.getHours() === 0 && at.getMinutes() === 0) return day;
    return `${day} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
