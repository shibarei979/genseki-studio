/**
 * ============================================================
 * 原石航路 Studio
 * LoadError — 読み込めなかったとき
 *
 * 空の画面を見せない。
 *
 * 「何も無い」のか「読めていない」のかは、
 * 見た目が同じでも意味が全く違う。
 * 前者は放っておけるが、後者は直さないといけない。
 * ============================================================
 */

"use client";

interface Props {
    message: string;
    onRetry?: () => void;
}

export default function LoadError({ message, onRetry }: Props) {
    return (
        <div className="rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-tint)] px-5 py-4">
            <p className="text-[13px] font-medium text-ink">読み込めませんでした</p>

            <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                {message}
            </p>

            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 rounded-md border border-line bg-surface px-4 py-1.5 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                >
                    もう一度読む
                </button>
            )}
        </div>
    );
}
