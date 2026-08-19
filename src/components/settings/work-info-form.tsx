/**
 * ============================================================
 * 原石航路 Studio
 * WorkInfoForm — 設定 / 作品情報
 * ============================================================
 */

"use client";

import Link from "next/link";
import { shrinkImage } from "@/lib/storage/image-store";
import { uploadImage } from "@/lib/storage/remote-image";
import { useRouter, useSearchParams } from "next/navigation";

import { useState } from "react";

import { getRepository } from "@/lib/repository";
import {
    AI_USAGE_DESCRIPTION,
    AI_USAGE_LABEL,
    WORK_FORMAT_DESCRIPTION,
    WORK_FORMAT_LABEL,
} from "@/types";
import TagInput from "@/components/works/tag-input";
import {
    CATCHPHRASE_MAX_LENGTH,
    SUMMARY_MAX_LENGTH,
    TITLE_MAX_LENGTH,
} from "@/config";
import type {
    AiUsage,
    WorkFormat, AgeRating, Work } from "@/types";
import {
    AGE_RATING_DESCRIPTION,
    AGE_RATING_LABEL,
    GENRES_SELECTABLE,
} from "@/types";

interface Props {
    work: Work;
    onSave: (patch: Partial<Work>) => Promise<void>;
}

export default function WorkInfoForm({ work, onSave }: Props) {
    const [title, setTitle] = useState(work.title);
    const [catchphrase, setCatchphrase] = useState(work.catchphrase ?? "");
    const [genre, setGenre] = useState(work.genre);
    const [format, setFormat] = useState<WorkFormat | null>(work.format ?? null);

    /* 表紙。あらすじの横に出る */
    const [coverUrl, setCoverUrl] = useState<string | null>(work.cover_url ?? null);
    const [coverBusy, setCoverBusy] = useState(false);
    const [coverError, setCoverError] = useState("");
    const [aiUsage, setAiUsage] = useState<AiUsage>(work.ai_usage ?? "none");
    const [tags, setTags] = useState<string[]>(work.tags);
    const [summary, setSummary] = useState(work.summary ?? "");
    /*
     * 作者メモは画面から外したが、値は残す。
     * すでに書いた人のものが、開いただけで消えるのは困る。
     */
    const [authorNote] = useState(work.author_note ?? "");
    const [ageRating, setAgeRating] = useState<AgeRating>(work.age_rating);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState("");

    /*
     * 作ったばかりか。
     * 「新しい作品を作る」からここへ来ると ?new=1 が付く。
     */
    const router = useRouter();
    const params = useSearchParams();
    const isNew = params.get("new") === "1";

    const [isDeleting, setIsDeleting] = useState(false);

    async function handleDelete() {
        await getRepository().deleteWork(work.id);
        router.push("/works");
    }

    const titleError = title.trim().length === 0 ? "タイトルを入れてください。" : "";
    const summaryError = summary.trim().length === 0 ? "あらすじを入れてください。" : "";

    /*
     * まだ決まっていないもの。
     *
     * 3 つだけは早めに決めてほしいので、色で目立たせる。
     * ただし書かせはしない。書き始めてからでないと
     * 決まらないこともある。
     */
    const isBlank = {
        title: title.trim().length === 0,
        genre: genre.trim().length === 0,
        summary: summary.trim().length === 0,
    };
    const blankCount = Object.values(isBlank).filter(Boolean).length;

    /** 未記入の欄の枠 */
    const blankClass =
        "border-[var(--color-amber)] bg-[var(--color-amber-tint)]/40";
    const canSave = !titleError && !summaryError && !isSaving;

    async function handleSave() {
        if (!canSave) return;
        setIsSaving(true);
        await onSave({
            title: title.trim(),
            catchphrase: catchphrase.trim() || null,
            genre,
            format,
            ai_usage: aiUsage,
            tags,
            summary: summary.trim(),
            author_note: authorNote.trim() || null,
            age_rating: ageRating,
            cover_url: coverUrl,
        });
        setIsSaving(false);
        setSavedMessage("保存しました");
        window.setTimeout(() => setSavedMessage(""), 2500);
    }

    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-5">
                <h2 className="text-base font-medium text-ink">作品情報</h2>
                <p className="mt-1 text-sm text-muted">作品の基本情報を編集します。</p>

                {blankCount > 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-md bg-[var(--color-amber-tint)] px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
                        <span className="mt-0.5 shrink-0 text-[var(--color-amber)]">
                            ●
                        </span>
                        <span>
                            <span className="font-medium">
                                タイトル・ジャンル・あらすじ
                            </span>
                            はまだ決まっていません。
                            あとから変えられますが、
                            早めに決めておくと作品を探しやすくなります。
                        </span>
                    </p>
                )}
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
                <div className="space-y-5">
                    <Field label="タイトル" htmlFor="info-title" error={titleError}>
                        <input
                            id="info-title"
                            type="text"
                            value={title}
                            maxLength={TITLE_MAX_LENGTH}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="作品の名前"
                            className={[
                                "w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-forest",
                                isBlank.title ? blankClass : "border-line",
                            ].join(" ")}
                        />
                        <Counter current={title.length} max={TITLE_MAX_LENGTH} />
                    </Field>

                    <Field label="キャッチコピー（任意）" htmlFor="info-catch">
                        <input
                            id="info-catch"
                            type="text"
                            value={catchphrase}
                            maxLength={CATCHPHRASE_MAX_LENGTH}
                            onChange={(e) => setCatchphrase(e.target.value)}
                            placeholder="見えない粒が織りなす、もうひとつの魔法世界。"
                            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                        />
                        <Counter current={catchphrase.length} max={CATCHPHRASE_MAX_LENGTH} />
                    </Field>

                    <Field label="ジャンル" htmlFor="info-genre">
                        <select
                            id="info-genre"
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            className={[
                                "w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:border-forest",
                                isBlank.genre ? blankClass : "border-line",
                            ].join(" ")}
                        >
                            {/* まだ決めていない状態を選べるようにする */}
                            <option value="">選んでください</option>
                            {/*
                             * 昔のジャンルは出さない。
                             * 既にそれで出している作品はそのままだが、
                             * これから選ぶ人には新しい分け方で選んでもらう。
                             */}
                            {GENRES_SELECTABLE.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {/*
                     * 表紙。
                     *
                     * 作品ページで、あらすじの横に出る。
                     * AI で作った絵は置けない。見分けは付かないので、
                     * ここに書いて約束してもらう。
                     */}
                    <Field label="表紙" htmlFor="info-cover">
                        <div className="flex items-start gap-3">
                            {coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={coverUrl}
                                    alt="表紙"
                                    className="w-24 shrink-0 rounded-md border border-line object-cover"
                                />
                            ) : (
                                <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-line text-[10px] text-faint">
                                    まだ無し
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <input
                                    id="info-cover"
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    disabled={coverBusy}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (!file) return;

                                        /* jpeg と png だけ。ほかは受け取らない */
                                        if (
                                            file.type !== "image/jpeg" &&
                                            file.type !== "image/png"
                                        ) {
                                            setCoverError(
                                                "JPEG か PNG の画像を選んでください。",
                                            );
                                            return;
                                        }

                                        setCoverBusy(true);
                                        setCoverError("");
                                        try {
                                            /* 表紙は大きく出すので、縮める加減を緩める */
                                            const shrunk = await shrinkImage(file, true);
                                            const url = await uploadImage(shrunk, "cover");
                                            setCoverUrl(url);
                                        } catch (caught) {
                                            setCoverError(
                                                caught instanceof Error
                                                    ? caught.message
                                                    : "画像を置けませんでした。",
                                            );
                                        }
                                        setCoverBusy(false);
                                    }}
                                    className="block w-full text-xs text-muted file:mr-2 file:rounded file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-xs file:text-ink"
                                />

                                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                                    JPEG または PNG。作品ページで、あらすじの横に出ます。
                                </p>

                                <p className="mt-1.5 rounded-md border border-amber bg-amber-tint/30 px-2.5 py-2 text-[11px] leading-relaxed text-ink">
                                    <strong>AIで生成した画像は使えません。</strong>
                                    <br />
                                    自分で描いた絵、または権利者から許可を得た絵だけを
                                    置いてください。ほかの人の絵を無断で使うことも
                                    できません。違反が見つかった場合は、
                                    画像の削除や作品の非公開などの対応をとることがあります。
                                </p>

                                {coverError && (
                                    <p className="mt-1.5 text-[11px] text-[var(--color-danger)]">
                                        {coverError}
                                    </p>
                                )}

                                {coverUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setCoverUrl(null)}
                                        className="mt-2 text-[11px] text-faint hover:text-[var(--color-danger)]"
                                    >
                                        表紙を外す
                                    </button>
                                )}
                            </div>
                        </div>
                    </Field>

                    <Field label="作品の形" htmlFor="info-format">
                        <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(WORK_FORMAT_LABEL) as WorkFormat[]).map(
                                (key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFormat(key)}
                                        aria-pressed={format === key}
                                        title={WORK_FORMAT_DESCRIPTION[key]}
                                        className={[
                                            "rounded-full border px-4 py-1.5 text-xs",
                                            format === key
                                                ? "border-forest bg-forest-tint text-forest"
                                                : "border-line text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {WORK_FORMAT_LABEL[key]}
                                    </button>
                                ),
                            )}
                        </div>
                    </Field>

                    <Field label="タグ" htmlFor="info-tags">
                        <TagInput id="info-tags" tags={tags} onChange={setTags} />
                        {/*
                         * 自分で作れることを書いておく。
                         * 候補から選ぶ欄に見えるので、
                         * 打ち込めると気づかれない。
                         */}
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                            ※ 候補から選ぶほか、自由に打ち込んで作ることもできます
                            （入力して Enter）。
                        </p>
                    </Field>

                    <Field label="あらすじ" htmlFor="info-summary" error={summaryError}>
                        <textarea
                            id="info-summary"
                            value={summary}
                            rows={5}
                            maxLength={SUMMARY_MAX_LENGTH}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="どんな物語か、ひとことでも"
                            className={[
                                "w-full resize-y rounded-md border px-3 py-2 text-sm leading-relaxed outline-none focus:border-forest",
                                isBlank.summary ? blankClass : "border-line",
                            ].join(" ")}
                        />
                        <Counter current={summary.length} max={SUMMARY_MAX_LENGTH} />
                    </Field>
                </div>

                <div className="space-y-5">
                    <Field label="年齢区分">
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(AGE_RATING_LABEL) as AgeRating[]).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setAgeRating(key)}
                                    className={[
                                        "rounded-md border px-3 py-2 text-sm",
                                        ageRating === key
                                            ? "border-forest bg-forest-tint text-forest"
                                            : "border-line text-muted hover:bg-canvas",
                                    ].join(" ")}
                                >
                                    {AGE_RATING_LABEL[key]}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1.5 text-xs text-muted">
                            {AGE_RATING_DESCRIPTION[ageRating]}
                        </p>
                    </Field>

                    <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
                        <p className="text-xs text-muted">
                            公開するかどうか、連載中か完結かは
                            <span className="text-ink">「公開設定」</span>
                            にまとめました。同じことを2か所で持つと必ず食い違うためです。
                        </p>
                    </div>

                    {/*
                     * AI をどう使ったか。
                     *
                     * 読者が知りたいことなので、はじめから示せるようにする。
                     * 隠すためではなく、申告のため。
                     */}
                    <Field label="AIの使用" htmlFor="info-ai">
                        <ul className="space-y-1.5">
                            {(Object.keys(AI_USAGE_LABEL) as AiUsage[]).map((key) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        onClick={() => setAiUsage(key)}
                                        aria-pressed={aiUsage === key}
                                        className={[
                                            "w-full rounded-lg border px-3.5 py-2.5 text-left",
                                            aiUsage === key
                                                ? "border-forest bg-forest-tint/50"
                                                : "border-line hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        <span className="block text-[13px] text-ink">
                                            {AI_USAGE_LABEL[key]}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                            {AI_USAGE_DESCRIPTION[key]}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Field>

                    {/*
                     * 作品を消す。
                     *
                     * 公開の設定とは別物なので、基本情報の一番下に置く。
                     * 「公開をやめる」と「消す」は取り返しが違う。
                     */}
                    <div className="rounded-lg border border-line px-5 py-4">
                        <p className="text-[13px] font-medium text-ink">
                            この作品を消す
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            話も資料も、まとめて消えます。元には戻せません。
                        </p>

                        {isDeleting ? (
                            <div className="mt-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-tint)] px-4 py-3.5">
                                <p className="text-sm text-ink">
                                    本当に「{work.title || "名前のない作品"}」を消しますか
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                                    残しておきたいものがあれば、
                                    先に「原稿・バックアップ」から書き出してください。
                                </p>

                                <div className="mt-3.5 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsDeleting(false)}
                                        className="rounded-md border border-line bg-surface px-4 py-2 text-xs text-ink"
                                    >
                                        やめる
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete()}
                                        className="rounded-md bg-[var(--color-danger)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                                    >
                                        消す
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsDeleting(true)}
                                className="mt-3 rounded-md border border-[var(--color-danger)] px-4 py-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                            >
                                この作品を消す
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
                {savedMessage && (
                    <span className="text-sm text-forest">{savedMessage}</span>
                )}

                {/*
                 * 作ったばかりのときは、書きに行く道も出す。
                 * 設定を終えたあと、自分で探させるのは手数が多い。
                 */}
                {isNew && (
                    <Link
                        href={`/workspace/${work.id}`}
                        className="mr-auto text-sm text-muted hover:text-forest"
                    >
                        あとで決めて、先に書く →
                    </Link>
                )}

                <button
                    type="button"
                    onClick={async () => {
                        await handleSave();
                        if (isNew) router.push(`/workspace/${work.id}`);
                    }}
                    disabled={!canSave}
                    className="rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isNew ? "決めて書きはじめる" : "変更を保存"}
                </button>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 小さな部品
 * ============================================================
 */

function Field({
    label,
    htmlFor,
    error,
    children,
}: {
    label: string;
    htmlFor?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
                {label}
            </label>
            <div className="mt-1.5">{children}</div>
            {error && <p className="mt-1 text-xs text-[var(--color-amber)]">{error}</p>}
        </div>
    );
}

function Counter({ current, max }: { current: number; max: number }) {
    return (
        <p className="mt-1 text-right text-xs text-faint">
            {current} / {max}
        </p>
    );
}
