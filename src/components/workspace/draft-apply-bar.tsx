/**
 * ============================================================
 * 原石航路 Studio
 * DraftApplyBar — 公開している話の「直し」を、読者の本文へ反映する帯
 *
 * ★ 公開済みの話は、書く画面で直しても読者の本文はすぐには変わらない。
 *   自動保存は「書きかけの直し」へ（lib/repository の as_draft）。
 *   この帯の「反映する」を押したときだけ、読者の本文が新しくなり、目次に改稿日が付く。
 *
 *   前は空白を 1 つ打っただけで読者の本文が書き換わり、
 *   「改稿」の日付が付いて消せなかった。
 *
 * ★ 選ぶのは「反映する」か「まだ反映しない」かだけ。
 *   「まだ反映しない」は帯を細くたたむだけ。直しは控えたまま、書き続けられる。
 *   たたんでも細い帯は残す（反映し忘れないように）。押せばまた開く。
 * ============================================================
 */

"use client";

import { useState } from "react";

export default function DraftApplyBar({
    savedAt,
    busy,
    onApply,
}: {
    /** 直しを最後に保存した時刻（表示用。無ければ出さない） */
    savedAt?: string | null;
    /** 保存中など、押せないとき */
    busy?: boolean;
    onApply: () => Promise<void>;
}) {
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /* 「まだ反映しない」でたたんだか */
    const [folded, setFolded] = useState(false);

    const time = savedAt
        ? new Date(savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
        : null;

    async function apply() {
        setWorking(true);
        setError(null);
        try {
            await onApply();
        } catch (e) {
            setError(e instanceof Error ? e.message : "反映できませんでした");
        } finally {
            setWorking(false);
        }
    }

    /* たたんだとき：細い 1 行だけ。押せば開く */
    if (folded) {
        return (
            <button
                type="button"
                onClick={() => setFolded(false)}
                className="flex w-full items-center gap-2 border-b border-[#efd8ae] bg-[var(--color-amber-tint)] px-3 py-1 text-left text-[11px] text-[#7a4e08] hover:bg-[#f8e8c9] sm:px-5"
            >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rotate-45 bg-[#e8b769]" />
                <span className="min-w-0 truncate">
                    未反映の直しがあります{time && `（${time} 保存）`}
                </span>
                <span className="ml-auto shrink-0 font-semibold underline underline-offset-2">開く</span>
            </button>
        );
    }

    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#efd8ae] bg-[var(--color-amber-tint)] px-3 py-2 text-[12px] sm:px-5"
        >
            <span className="flex min-w-0 items-center gap-2 text-[#7a4e08]">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-[#e8b769]" />
                <span className="min-w-0">
                    <b className="font-semibold">直しは保存しました。読者にはまだ出ていません。</b>
                    {time && <span className="ml-1 text-[11px] text-[#8a6420]">（{time}）</span>}
                    <span className="block text-[11px] text-[#8a6420]">反映すると、目次に改稿日が付きます。</span>
                </span>
            </span>

            <span className="ml-auto flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    disabled={working}
                    onClick={() => setFolded(true)}
                    className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-muted hover:text-ink disabled:opacity-50"
                >
                    まだ反映しない
                </button>
                <button
                    type="button"
                    disabled={busy || working}
                    onClick={() => void apply()}
                    className="rounded-md bg-forest px-3 py-1 text-[12px] font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
                >
                    {working ? "反映中…" : "反映する"}
                </button>
            </span>

            {error && <span className="w-full text-[11px] text-[var(--color-danger)]">{error}</span>}
        </div>
    );
}
