"use client";

import { useState } from "react";

import { stripRuby } from "@/lib/utils/ruby";
import { splitIntoSentences } from "@/lib/utils/sentences";

/**
 * ============================================================
 * 原石航路 Studio
 * IllustPlaceSurface — 本文の中に挿絵を置く場所を選ぶ
 *
 * ★ 選ぶ単位は「段落」。
 *
 *   前は 1 文ずつ選ばせていた。
 *   だが挿絵は、文の途中ではなく段落の切れ目に入る。
 *   文の数だけ選び所があると、狙いが定まらない。
 *
 *   段落と段落のあいだに線を出し、そこを押してもらう。
 *
 * ★ 持ち方は変えない。
 *
 *   表には「何文目の後ろか」で入れている。
 *   段落を選んだら、その段落の終わりが何文目かを数えて渡す。
 *   読む画面は今までどおりで動く。
 *
 * ★ そのあいだ、本文は打てない。
 *   置き場所を選びに来ているので、困らない。
 * ============================================================
 */

interface Block {
    /** 表示する本文 */
    text: string;
    /** この段落の終わりが、何文目にあたるか（1 から数える） */
    endsAt: number;
}

/**
 * 本文を段落に分ける。
 *
 * 文に分けたものを、改行のところで束ね直す。
 * 「何文目か」の数え方は、読む画面と同じものを使う。
 */
function toBlocks(body: string): Block[] {
    const sentences = splitIntoSentences(body);
    const blocks: Block[] = [];

    let buf = "";

    sentences.forEach((raw, idx) => {
        if (raw === "\n") {
            /* 段落の終わり。空行はそのまま捨てる */
            if (buf.trim()) blocks.push({ text: buf.trim(), endsAt: idx + 1 });
            buf = "";
            return;
        }

        buf += raw;

        /* 最後の文で終わっているときも、ひと束にする */
        if (idx === sentences.length - 1 && buf.trim()) {
            blocks.push({ text: buf.trim(), endsAt: idx + 1 });
            buf = "";
        }
    });

    return blocks;
}

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
    const blocks = toBlocks(body);

    const [asking, setAsking] = useState<{
        at: number;
        anchor: string;
        label: string;
    } | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    async function confirm() {
        if (!asking || isBusy) return;

        setIsBusy(true);
        try {
            await onPlace(asking.at, asking.anchor);
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
                    この絵を入れる
                    <strong className="font-bold">段落の切れ目を押してください</strong>
                </span>

                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto shrink-0 rounded-md border border-line px-3 py-1.5 text-[11.5px] text-muted hover:text-ink"
                >
                    やめる
                </button>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {blocks.length === 0 ? (
                    <p className="rounded-md border border-line bg-canvas px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
                        この話には、まだ本文がありません。
                        <br />
                        本文を書いて保存すると、置く場所を選べます。
                    </p>
                ) : (
                    <>
                        {/* 本文の頭 */}
                        <Gap
                            label="本文の頭に入れる"
                            onPick={() =>
                                setAsking({ at: 0, anchor: "", label: "本文の頭" })
                            }
                        />

                        {blocks.map((block, idx) => (
                            <div key={idx}>
                                {/*
                                  * ★ 本文はいつもどおり左から。
                                  *   中央に寄せると行の頭が揃わず、読みにくい。
                                  */}
                                <p className="whitespace-pre-wrap text-[15px] leading-[2] text-ink">
                                    {stripRuby(block.text)}
                                </p>

                                <Gap
                                    label="ここに入れる"
                                    onPick={() =>
                                        setAsking({
                                            at: block.endsAt,
                                            anchor: lastSentenceOf(block.text),
                                            label: shorten(block.text),
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </>
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
                        className="w-full max-w-[420px] rounded-xl bg-surface p-5 shadow-xl"
                    >
                        <p className="text-[13px] font-bold text-ink">
                            {asking.at === 0
                                ? "本文の頭に入れますか"
                                : "この段落の後ろに入れますか"}
                        </p>

                        {asking.at > 0 && (
                            <p className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-canvas px-3.5 py-3 text-[12.5px] leading-[1.9] text-muted">
                                {asking.label}
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

/** その段落の最後の文。本文を直したとき、場所を追いかけるのに使う */
function lastSentenceOf(text: string): string {
    const parts = splitIntoSentences(text).filter((one) => one !== "\n");
    const last = parts[parts.length - 1] ?? text;
    return stripRuby(last).replace(/\n/g, "").trim();
}

/** 小窓に出すための、短い見出し */
function shorten(text: string): string {
    const clean = stripRuby(text).replace(/\n/g, "");
    return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

/**
 * 段落と段落のあいだ。
 *
 * ★ 線はいつも薄く出しておく。
 *   触れたときだけ出す形にすると、携帯ではどこを押せばよいか分からない。
 */
function Gap({ label, onPick }: { label: string; onPick: () => void }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="group my-2 flex w-full items-center gap-3 py-2"
        >
            <span className="h-[2px] flex-1 rounded bg-line group-hover:bg-forest" />
            <span className="shrink-0 rounded-full border border-line px-3 py-1 text-[11px] text-faint group-hover:border-forest group-hover:text-forest">
                {label}
            </span>
            <span className="h-[2px] flex-1 rounded bg-line group-hover:bg-forest" />
        </button>
    );
}
