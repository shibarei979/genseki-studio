/**
 * ============================================================
 * 原石航路 Studio
 * DeleteButton — 削除
 *
 * ゴミ箱を押すと、その場に赤い確かめが開く。
 *
 * window.confirm を使わない理由が 2 つある。
 *   ・何を消そうとしているのか、画面から目が離れる
 *   ・ブラウザごとに見た目が変わり、押し間違いが起きる
 *
 * 開いたまま他所を押せば閉じる。取り消しやすさを優先している。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
    /** 「◯◯を削除しますか」の◯◯ */
    label: string;
    /** 消えるものの補足。「中の話もすべて」など */
    note?: string;
    onDelete: () => void;
    /** 一覧の行に重ねるときは、押すまで隠す */
    isFloating?: boolean;
    size?: "small" | "normal";
}

export default function DeleteButton({
    label,
    note,
    onDelete,
    isFloating = false,
    size = "normal",
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // 外側を押したら閉じる
    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [isOpen]);

    const box = size === "small" ? "h-6 w-6" : "h-7 w-7";

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((open) => !open);
                }}
                aria-label={`${label}を削除`}
                aria-expanded={isOpen}
                className={[
                    box,
                    "flex items-center justify-center rounded-md transition-colors",
                    isOpen
                        ? "bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
                        : "text-faint hover:bg-canvas hover:text-[var(--color-danger)]",
                    isFloating && !isOpen ? "opacity-0 group-hover:opacity-100" : "",
                ].join(" ")}
            >
                <TrashIcon size={size === "small" ? 13 : 15} />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-lg border border-[var(--color-danger)] bg-surface shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3.5 py-3">
                        <p className="text-[13px] font-medium text-ink">
                            「{label}」を削除しますか
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            {note ?? "元に戻せません。"}
                        </p>
                    </div>

                    <div className="flex border-t border-line">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 border-r border-line py-2.5 text-xs text-muted hover:bg-canvas"
                        >
                            やめる
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onDelete();
                            }}
                            className="flex-1 bg-[var(--color-danger)] py-2.5 text-xs font-medium text-white hover:opacity-90"
                        >
                            削除する
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function TrashIcon({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 7h16" />
            <path d="M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
            <path d="M6.5 7v12.3a1.7 1.7 0 0 0 1.7 1.7h7.6a1.7 1.7 0 0 0 1.7-1.7V7" />
            <path d="M10.5 11v6M13.5 11v6" />
        </svg>
    );
}
