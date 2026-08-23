"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getRepository } from "@/lib/repository";
import { isValidProjectTag } from "@/types";

/**
 * ============================================================
 * 原石航路
 * ProjectForm — 企画を立てる
 *
 * 合言葉は早い者勝ち。
 * 打っている間に使われているかを確かめ、
 * 使われていれば赤で知らせて、立てられないようにする。
 *
 * 送ってから「使われています」と言われるより、
 * 打っている最中に分かるほうが直しやすい。
 * ============================================================
 */

/** 合言葉を確かめるまでの待ち時間。1 文字ごとに問い合わせない */
const CHECK_DELAY = 400;

type TagState = "empty" | "checking" | "free" | "taken" | "invalid";

export default function ProjectForm() {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tag, setTag] = useState("");
    const [startsAt, setStartsAt] = useState("");
    const [endsAt, setEndsAt] = useState("");

    const [tagState, setTagState] = useState<TagState>("empty");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    /*
     * 合言葉を確かめる。
     *
     * 打つたびに問い合わせると回数が多くなるので、
     * 手が止まってから確かめる。
     */
    useEffect(() => {
        const trimmed = tag.trim();

        if (trimmed.length === 0) {
            setTagState("empty");
            return;
        }
        if (!isValidProjectTag(trimmed)) {
            setTagState("invalid");
            return;
        }

        setTagState("checking");
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    const taken = await getRepository().isProjectTagTaken(trimmed);
                    setTagState(taken ? "taken" : "free");
                } catch {
                    /* 確かめられなくても、送るときに弾かれる */
                    setTagState("free");
                }
            })();
        }, CHECK_DELAY);

        return () => window.clearTimeout(timer);
    }, [tag]);

    const canSubmit =
        title.trim().length > 0 && tagState === "free" && !isSaving;

    async function handleSubmit() {
        if (!canSubmit) return;

        setIsSaving(true);
        setError("");

        try {
            const project = await getRepository().createProject({
                title: title.trim(),
                description: description.trim(),
                tag: tag.trim(),
                starts_at: startsAt || null,
                ends_at: endsAt || null,
            });
            router.push(`/projects/${project.id}`);
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "立てられませんでした",
            );
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-5">
            <Field label="企画の名前" required>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="夏の恋を書く"
                    maxLength={60}
                    className="w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-forest"
                />
            </Field>

            <Field label="説明">
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="どんな作品を集めたいか、書いてください。"
                    rows={5}
                    maxLength={2000}
                    className="w-full resize-y rounded-lg border border-line px-3.5 py-2.5 text-[13px] leading-relaxed outline-none focus:border-forest"
                />
            </Field>

            {/*
             * 合言葉。
             *
             * これが企画の要。作品にこのタグを付けると参加になる。
             * 早い者勝ちなので、使われていれば赤で知らせる。
             */}
            <Field label="合言葉（タグ）" required>
                <div className="flex items-center gap-2">
                    <span className="text-[15px] text-muted">#</span>
                    <input
                        type="text"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="夏の恋2026"
                        maxLength={30}
                        className={[
                            "w-full rounded-lg border px-3.5 py-2.5 text-[14px] outline-none",
                            tagState === "taken" || tagState === "invalid"
                                ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                                : tagState === "free"
                                  ? "border-forest"
                                  : "border-line focus:border-forest",
                        ].join(" ")}
                    />
                </div>

                <p
                    className={[
                        "mt-1.5 text-[11px] leading-relaxed",
                        tagState === "taken" || tagState === "invalid"
                            ? "text-[var(--color-danger)]"
                            : tagState === "free"
                              ? "text-forest"
                              : "text-muted",
                    ].join(" ")}
                >
                    {tagState === "empty" &&
                        "参加する人が作品に付けるタグです。あとから変えられません。"}
                    {tagState === "checking" && "使われていないか確かめています…"}
                    {tagState === "free" && "この合言葉は使えます。"}
                    {tagState === "taken" &&
                        "この合言葉は、すでに使われています。別のものにしてください。"}
                    {tagState === "invalid" &&
                        "使えるのは、ひらがな・カタカナ・漢字・英数字と、ー ・ _ - です。空白や記号は入れられません。"}
                </p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="はじまり">
                    <input
                        type="date"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        className="w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-forest"
                    />
                </Field>

                <Field label="おわり">
                    <input
                        type="date"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="w-full rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-forest"
                    />
                </Field>
            </div>

            <p className="text-[11px] leading-relaxed text-faint">
                期間は決めなくても構いません。空のままにすると、いつでも参加できる企画になります。
            </p>

            {error && (
                <p className="rounded-lg border border-[var(--color-danger)] px-3.5 py-2.5 text-[12px] text-[var(--color-danger)]">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="w-full rounded-lg bg-forest py-3 text-[14px] font-medium text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
                {isSaving ? "立てています…" : "この企画を立てる"}
            </button>
        </div>
    );
}

function Field({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                {label}
                {required && (
                    <span className="text-[10px] text-[var(--color-danger)]">必須</span>
                )}
            </label>
            {children}
        </div>
    );
}
