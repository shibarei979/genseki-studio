/**
 * ============================================================
 * 原石航路 Studio
 * WorkAudience — 作品を、誰に見せるか
 *
 * ★ 「作品の公開」と「話の投稿」を、別々に押させない。
 *
 *   前は作品に「下書き／限定公開／公開」があり、話にも「投稿」があった。
 *   作品を公開しても話が無ければ何も出ず、
 *   話を投稿しても作品が下書きなら出ない（出ることもある）。
 *   どちらを先に押せばよいのか分からない、の元だった。
 *
 *   いまの考え方
 *     ・話を 1 話投稿すると、作品も読者に出る（作品を公開する操作は無い）
 *     ・作品の側で決めるのは「見せる相手」だけ（みんな／URLを知っている人だけ）
 *     ・いったん全部しまいたいときだけ「作品ごと隠す」
 *
 *   表の値との対応
 *     public   みんなに見せる
 *     limited  URLを知っている人だけ
 *     draft    まだ 1 話も出していない → 「まだ投稿していません」
 *              1 話でも出している       → 「隠しています」
 * ============================================================
 */

"use client";

import { useState } from "react";

import HelpTip from "@/components/common/help-tip";

export type Audience = "public" | "limited" | "draft";

interface Props {
    visibility: Audience | undefined | null;
    /** 読者に出ている話の数。-1 は「まだ数えていない」 */
    postedCount: number;
    /** 予約の入っている話の数 */
    scheduledCount?: number;
    onChange: (next: Audience) => void;
    /** 狭い所（投稿画面の右の欄）向け */
    compact?: boolean;
}

export default function WorkAudience({ visibility, postedCount, scheduledCount = 0, onChange, compact = false }: Props) {
    const [askingHide, setAskingHide] = useState(false);

    const current: Audience = visibility ?? "draft";
    const neverPosted = postedCount === 0;
    const isHidden = current === "draft" && postedCount > 0;

    /* まだ 1 話も出していないときは、次に出したときの相手を選んでおく形にする */
    const picked: Audience | null = isHidden ? null : current === "limited" ? "limited" : "public";

    const text = compact ? "text-[12.5px]" : "text-sm";
    const note = compact ? "text-[11px]" : "text-xs";

    return (
        <div>
            {/* いまの見え方を、ひと言で */}
            <div
                className={[
                    "mb-3 rounded-md px-3 py-2.5",
                    isHidden
                        ? "border border-[var(--color-amber)] bg-[var(--color-amber-tint)]"
                        : neverPosted
                          ? "border border-line bg-canvas"
                          : "border border-forest-line bg-forest-tint",
                ].join(" ")}
            >
                <p className={`${text} font-medium text-ink`}>
                    {isHidden
                        ? "いま、作品を非公開にしています"
                        : neverPosted
                          ? "まだ1話も投稿していません"
                          : current === "limited"
                            ? "URLを知っている人に見えています"
                            : "みんなに見えています"}
                </p>
                <p className={`mt-1 ${note} leading-relaxed text-muted`}>
                    {isHidden
                        ? `作品も話も、読者には見えません。${scheduledCount > 0 ? `予約した話（${scheduledCount}話）も、非公開の間は出ません。` : ""}下で見せる相手を選ぶと、公開に戻ります。`
                        : neverPosted
                          ? "話を1話投稿すると、作品も一緒に読者に出ます。作品だけを公開する操作はありません。"
                          : `投稿した話（${postedCount < 0 ? "…" : postedCount}話）が読めます。`}
                </p>
            </div>

            <p className={`mb-1.5 flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"} font-medium text-ink`}>
                見せる相手
                <HelpTip topic="post-audience" />
            </p>

            <div className="space-y-1.5">
                {(
                    [
                        { value: "public", label: "みんなに見せる", sub: "だれでも読めます。検索やランキングにも出ます。" },
                        { value: "limited", label: "URLを知っている人だけ", sub: "URLを渡した人だけが読めます。" },
                    ] as const
                ).map((row) => (
                    <label
                        key={row.value}
                        className={[
                            "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2",
                            picked === row.value ? "border-forest bg-forest-tint/50" : "border-line hover:bg-canvas",
                        ].join(" ")}
                    >
                        <input
                            type="radio"
                            name="work-audience"
                            checked={picked === row.value}
                            /*
                             * ★ まだ 1 話も出していないときに「みんな」を選んでも、公開にはしない。
                             *   話の無い作品が一覧に出てしまう。下書きのまま置き、
                             *   初めて話を出したときに公開へ上げる（投稿の側がそうする）。
                             */
                            onChange={() => onChange(neverPosted && row.value === "public" ? "draft" : row.value)}
                            className="mt-0.5 accent-[var(--color-forest)]"
                        />
                        <span className="min-w-0">
                            <span className={`block ${text} text-ink`}>{row.label}</span>
                            <span className={`mt-0.5 block ${note} leading-relaxed text-muted`}>{row.sub}</span>
                        </span>
                    </label>
                ))}
            </div>

            {/* 作品ごと隠す。1 話でも出しているときだけ */}
            {!isHidden && postedCount > 0 && (
                <div className="mt-3">
                    {!askingHide ? (
                        <span className="inline-flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setAskingHide(true)}
                                className={`${note} text-muted underline hover:text-[var(--color-danger)]`}
                            >
                                作品を非公開にする
                            </button>
                            <HelpTip topic="post-hide" size={14} />
                        </span>
                    ) : (
                        <div className="rounded-md border border-line bg-surface px-3 py-2.5">
                            <p className={`${note} leading-relaxed text-ink`}>
                                作品と、投稿した話がすべて読者から見えなくなります。話やコメントは消えません。
                                {scheduledCount > 0 && `予約した話（${scheduledCount}話）も、非公開の間は出ません。`}
                            </p>
                            <div className="mt-2 flex gap-1.5">
                                <button
                                    type="button"
                                    autoFocus
                                    onClick={() => setAskingHide(false)}
                                    className="rounded border border-line px-3 py-1 text-[11px] text-muted hover:text-ink"
                                >
                                    やめる
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAskingHide(false);
                                        onChange("draft");
                                    }}
                                    className="flex-1 rounded bg-[var(--color-danger)] py-1 text-[11px] font-medium text-white hover:opacity-90"
                                >
                                    非公開にする
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
