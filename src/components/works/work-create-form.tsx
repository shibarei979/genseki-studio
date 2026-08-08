/**
 * ============================================================
 * 原石航路 Studio
 * WorkCreateForm — 新しい作品を作る
 * ============================================================
 */

"use client";

import { useState } from "react";

import TagInput from "@/components/works/tag-input";
import { WORK_TEMPLATES } from "@/lib/resource/builtin-pages";
import { SUMMARY_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/config";
import type { WorkCreateInput } from "@/types";
import { GENRES } from "@/types";

interface Props {
    onCreate: (input: WorkCreateInput, templateKey: string) => Promise<void>;
    onCancel: () => void;
}

export default function WorkCreateForm({ onCreate, onCancel }: Props) {
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState<string>(GENRES[0]);
    const [tags, setTags] = useState<string[]>([]);
    const [summary, setSummary] = useState("");
    const [templateKey, setTemplateKey] = useState("simple");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canSubmit = title.trim().length > 0 && summary.trim().length > 0 && !isSubmitting;

    async function handleSubmit() {
        if (!canSubmit) return;
        setIsSubmitting(true);
        await onCreate({ title, genre, tags, summary }, templateKey);
        setIsSubmitting(false);
    }

    return (
        <div className="rounded-lg border border-line bg-surface p-6">
            <h2 className="text-base font-medium text-ink">新しい作品を作る</h2>
            <p className="mt-1 text-sm text-muted">
                タイトルだけ決まっていれば始められます。あとから変更できます。
            </p>

            <div className="mt-5 space-y-4">
                <div>
                    <label htmlFor="work-title" className="block text-sm font-medium text-ink">
                        タイトル
                    </label>
                    <input
                        id="work-title"
                        type="text"
                        value={title}
                        maxLength={TITLE_MAX_LENGTH}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="魔法粒子論"
                        className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                    />
                    <p className="mt-1 text-right text-xs text-faint">
                        {title.length} / {TITLE_MAX_LENGTH}
                    </p>
                </div>

                <div>
                    <label htmlFor="work-genre" className="block text-sm font-medium text-ink">
                        ジャンル
                    </label>
                    <select
                        id="work-genre"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-forest"
                    >
                        {GENRES.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="work-tags" className="block text-sm font-medium text-ink">
                        タグ（任意）
                    </label>
                    <div className="mt-1.5">
                        <TagInput id="work-tags" tags={tags} onChange={setTags} />
                    </div>
                </div>

                <div>
                    <label htmlFor="work-summary" className="block text-sm font-medium text-ink">
                        あらすじ
                    </label>
                    <textarea
                        id="work-summary"
                        value={summary}
                        maxLength={SUMMARY_MAX_LENGTH}
                        rows={4}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="風が、研究室の書類を揺らしていた。"
                        className="mt-1.5 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-forest"
                    />
                    <p className="mt-1 text-right text-xs text-faint">
                        {summary.length} / {SUMMARY_MAX_LENGTH}
                    </p>
                </div>
            </div>

            <div className="mt-6">
                <span className="block text-sm font-medium text-ink">資料テンプレート</span>
                <p className="mt-1 text-xs text-muted">
                    最初から出しておく資料ページを選びます。あとから足しても外してもかまいません。
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {WORK_TEMPLATES.map((template) => (
                        <li key={template.key}>
                            <button
                                type="button"
                                onClick={() => setTemplateKey(template.key)}
                                aria-pressed={templateKey === template.key}
                                className={[
                                    "w-full rounded-md border px-3 py-2.5 text-left",
                                    templateKey === template.key
                                        ? "border-forest bg-forest-tint"
                                        : "border-line hover:bg-canvas",
                                ].join(" ")}
                            >
                                <span className="block text-sm text-ink">{template.label}</span>
                                <span className="mt-0.5 block text-xs text-muted">
                                    {template.description}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:bg-canvas"
                >
                    やめる
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-md bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                    作品を作る
                </button>
            </div>
        </div>
    );
}
