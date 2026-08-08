/**
 * ============================================================
 * 原石航路 Studio
 * LoginRequired — ログインを求める
 *
 * 部屋を開くのも、部屋に入るのもログインが要る。
 * 誰が誰か分からないと、管理も出入りの制限も成り立たない。
 *
 * ログインの仕組みはまだ無い（Supabase が要る）。
 * いまは何が要るかを伝えるだけにして、
 * 動く場所と動かない場所をはっきりさせておく。
 * ============================================================
 */

"use client";

interface Props {
    /** 何をしようとしたか。「部屋を開く」「部屋に入る」など */
    action: string;
}

export default function LoginRequired({ action }: Props) {
    return (
        <div className="rounded-xl border border-line bg-surface px-6 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest-tint">
                <KeyIcon />
            </span>

            <p className="mt-3 text-sm font-medium text-ink">
                {action}にはログインが必要です
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
                部屋には管理する人がいて、出入りや発言を決められます。
                そのため、誰が誰かが分かっている必要があります。
            </p>

            <p className="mt-4 inline-block rounded-md bg-canvas px-4 py-2 text-[11px] text-faint">
                ログインの仕組みは準備中です。
                いまは自分の端末の中だけで部屋を作れます。
            </p>
        </div>
    );
}

function KeyIcon() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="8" cy="12" r="4" />
            <path d="M12 12h9M18 12v3.5M15.5 12v2.5" />
        </svg>
    );
}
