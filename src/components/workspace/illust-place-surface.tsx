"use client";

import { useState } from "react";

import { stripRuby } from "@/lib/utils/ruby";
import { splitIntoSentences } from "@/lib/utils/sentences";

/**
 * ============================================================
 * 原石航路 Studio
 * IllustPlaceSurface — 本文の中に挿絵を置く場所を選ぶ
 *
 * ★ 蛍光ペンと同じ触り心地にする。
 *
 *   小窓の中に本文を写して選ばせていたが、
 *   本文とは別物に見えて分かりにくかった。
 *   執筆画面の本文そのものへ行き、そこで押す。
 *
 * ★ 押すのは「文」。
 *
 *   文と文のあいだの細い線は、携帯では狙えない。
 *   文を押したら「この文の後ろに入れますか」と聞く。
 *   触れているあいだは、入る場所に線が出る。
 *
 * ★ そのあいだ、本文は打てない。
 *   置き場所を選びに来ているので、困らない。
 * ============================================================
 */


export default function IllustPlaceSurface({
    body,
    illustUrl,
    onPlace,
    onClose,
}: {
    body: string;
    /** いま置こうとしている絵。何を置くのか見えないまま押させない */
    illustUrl?: string | null;
    /** 何文目の後ろに置くか（0 は本文の頭）と、その文を渡す */
    onPlace: (afterSentence: number, anchorText: string) => Promise<void>;
    onClose: () => void;
}) {
    const sentences = splitIntoSentences(body);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [asking, setAsking] = useState<{ at: number; text: string } | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    async function confirm() {
        if (!asking || isBusy) return;

        setIsBusy(true);
        try {
            await onPlace(asking.at, asking.text);
            setAsking(null);
        } catch {
            window.alert("置けませんでした。時間をおいて試してください。");
        }
        setIsBusy(false);
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-surface">
            {/* 上の帯。何をしているかと、抜ける道を常に見せる */}
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
                {illustUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={illustUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded border border-line object-cover"
                    />
                )}

                <span className="truncate text-[12px] text-forest">
                    この絵を入れる場所の
                    <strong className="font-bold">文を押してください</strong>
                </span>

                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto shrink-0 rounded-md border border-line px-3 py-1.5 text-[11.5px] text-muted hover:text-ink"
                >
                    やめる
                </button>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {/* 本文の頭に入れる */}
                <button
                    type="button"
                    onClick={() => setAsking({ at: 0, text: "" })}
                    className="mb-4 flex w-full items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[11.5px] text-muted hover:border-forest hover:text-forest"
                >
                    本文の頭に入れる
                </button>

                <div className="text-[15px] leading-[2.1] text-ink">
                    {sentences.map((raw, idx) => {
                        if (raw === "\n") return <br key={idx} />;

                        const isHover = hoverIdx === idx;

                        return (
                            <span
                                key={idx}
                                onMouseEnter={() => setHoverIdx(idx)}
                                onMouseLeave={() =>
                                    setHoverIdx((prev) => (prev === idx ? null : prev))
                                }
                                onClick={() =>
                                    setAsking({
                                        at: idx + 1,
                                        text: stripRuby(raw).replace(/\n/g, "").trim(),
                                    })
                                }
                                style={{
                                    borderRadius: 3,
                                    cursor: "pointer",
                                    transition: "background .15s ease",
                                    background: isHover
                                        ? "color-mix(in srgb, var(--color-brand) 12%, transparent)"
                                        : "transparent",
                                    /* 触れているあいだ、絵が入る場所に線を出す */
                                    boxShadow: isHover
                                        ? "0 2px 0 0 var(--color-forest)"
                                        : "none",
                                }}
                            >
                                {stripRuby(raw)}
                            </span>
                        );
                    })}
                </div>

                {sentences.length === 0 && (
                    <p className="rounded-md border border-line bg-canvas px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
                        この話には、まだ本文がありません。
                        <br />
                        本文を書いて保存すると、置く場所を選べます。
                    </p>
                )}
            </div>

            {/* 置くかどうかを聞く小窓 */}
            {asking && (
                <div
                    onClick={() => setAsking(null)}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-6"
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        className="w-full max-w-[400px] rounded-xl bg-surface p-5 shadow-xl"
                    >
                        <p className="text-[13px] font-bold text-ink">
                            {asking.at === 0
                                ? "本文の頭に入れますか"
                                : "この文の後ろに入れますか"}
                        </p>

                        {asking.at > 0 && (
                            <p className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-canvas px-3.5 py-3 text-[12.5px] leading-[1.9] text-muted">
                                {asking.text}
                            </p>
                        )}

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setAsking(null)}
                                className="rounded-lg border border-line px-4 py-2 text-[12.5px] text-muted hover:text-ink"
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirm()}
                                disabled={isBusy}
                                className="rounded-lg bg-forest px-4 py-2 text-[12.5px] text-white disabled:opacity-40"
                            >
                                {isBusy ? "置いています…" : "ここに入れる"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
