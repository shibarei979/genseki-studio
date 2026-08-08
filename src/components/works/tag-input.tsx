/**
 * ============================================================
 * 原石航路 Studio
 * TagInput — タグの追加と削除
 *
 * 候補は常時出さず、下矢印で開く。
 * 30 個超を並べたままにすると、入力欄より候補のほうが大きくなり
 * 「自由に入れてよい」ことが伝わらなくなるため。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { TAG_MAX_COUNT, TAG_MAX_LENGTH } from "@/config";
import { SUGGESTED_TAGS } from "@/types";

interface Props {
    tags: string[];
    onChange: (tags: string[]) => void;
    /** input 要素と label を結びつけるための id */
    id?: string;
}

export default function TagInput({ tags, onChange, id = "tag-input" }: Props) {
    const [draft, setDraft] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const isFull = tags.length >= TAG_MAX_COUNT;

    // 外側を押したら候補を閉じる
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [isOpen]);

    function addTag(value: string) {
        const tag = value.trim();
        if (!tag || isFull || tags.includes(tag)) {
            setDraft("");
            return;
        }
        onChange([...tags, tag]);
        setDraft("");
    }

    function removeTag(target: string) {
        onChange(tags.filter((tag) => tag !== target));
    }

    const draftValue = draft.trim();
    const suggestions = draftValue
        ? SUGGESTED_TAGS.filter((tag) => tag.includes(draftValue))
        : SUGGESTED_TAGS;

    return (
        <div ref={rootRef} className="relative">
            <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                    <input
                        id={id}
                        type="text"
                        value={draft}
                        maxLength={TAG_MAX_LENGTH}
                        disabled={isFull}
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(e) => {
                            // 日本語変換の確定 Enter でタグが増えないようにする
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                addTag(draft);
                            }
                            if (e.key === "Escape") setIsOpen(false);
                            // 何も入力していないときの Backspace で末尾を消す
                            if (e.key === "Backspace" && draft === "" && tags.length > 0) {
                                removeTag(tags[tags.length - 1]);
                            }
                        }}
                        placeholder={isFull ? `タグは${TAG_MAX_COUNT}個までです` : "魔法"}
                        className="w-full rounded-md border border-line py-1.5 pl-3 pr-8 text-sm outline-none focus:border-forest disabled:bg-canvas disabled:text-faint"
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen((open) => !open)}
                        aria-label="候補のタグを開く"
                        aria-expanded={isOpen}
                        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-faint hover:text-forest"
                    >
                        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
                            <path
                                d="M1 1 L5 5 L9 1"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => addTag(draft)}
                    disabled={draftValue.length === 0 || isFull}
                    className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-forest-line hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
                >
                    追加
                </button>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-line bg-surface p-3 shadow-lg">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted">
                            {draftValue ? "候補" : "よく使われるタグ"}
                        </p>
                        <span className="text-xs text-faint">
                            {tags.length} / {TAG_MAX_COUNT}
                        </span>
                    </div>

                    {suggestions.length === 0 ? (
                        <p className="mt-2 text-xs text-faint">
                            候補にはありません。そのまま「追加」で登録できます。
                        </p>
                    ) : (
                        <ul className="thin-scroll mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                            {suggestions.map((tag) => {
                                const isSelected = tags.includes(tag);
                                return (
                                    <li key={tag}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                isSelected ? removeTag(tag) : addTag(tag)
                                            }
                                            disabled={!isSelected && isFull}
                                            aria-pressed={isSelected}
                                            className={[
                                                "rounded-full border px-2.5 py-1 text-xs",
                                                isSelected
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:border-forest-line hover:text-forest",
                                                !isSelected && isFull
                                                    ? "cursor-not-allowed opacity-40"
                                                    : "",
                                            ].join(" ")}
                                        >
                                            {tag}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {tags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <li
                            key={tag}
                            className="flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink"
                        >
                            <span>{tag}</span>
                            <button
                                type="button"
                                aria-label={`タグ「${tag}」を外す`}
                                onClick={() => removeTag(tag)}
                                className="text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
