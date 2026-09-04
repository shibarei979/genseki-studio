/**
 * ============================================================
 * 原石航路 Studio
 * IllustRecommendEditor — すすめる見せ方を決める
 *
 * ★ 本文に重ねた見本を出す。
 *
 *   数字だけ決めさせても、収まりは分からない。
 *   置いた場所の前後の本文を出し、そこへ絵を挟んで見せる。
 *
 * ★ 幅は 1px ごと。左右の寄せは割合で持つ。
 *
 *   px で位置を持つと、読む画面の幅が変わったときに
 *   端からはみ出す。割合なら、どの幅でも同じ寄り方になる。
 *
 * ★ 決めない、も選べる。
 *   取り消すと読者側の押し具が消え、読む人の設定に戻る。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { splitIntoSentences } from "@/lib/utils/sentences";
import { stripRuby } from "@/lib/utils/ruby";

/** 幅の下限と上限。SQL の決まりと合わせる */
const MIN_WIDTH = 80;
const MAX_WIDTH = 1200;

/*
 * ★ 元の絵より広げない。
 *
 *   広げると引き伸ばしになり、輪郭がぼやける。
 *   注意を出すだけにしていたが、それでも広げてしまい
 *   「荒くなる」という声が届いた。
 *   はじめから、そこまでしか動かせないようにする。
 */

/** 読む画面の本文の幅。ここに合わせて見本を出す */
const READING_WIDTH = 840;

interface Props {
    url: string;
    /** いまの本文。前後を見本に出す */
    body: string;
    /** 何文目の後ろに置いてあるか */
    afterSentence: number;
    /** いまの決め。無ければ null */
    value: { width: number; align: number } | null;
    onSave: (rec: { width: number; align: number } | null) => Promise<void>;
    onClose: () => void;
}

export default function IllustRecommendEditor({
    url,
    body,
    afterSentence,
    value,
    onSave,
    onClose,
}: Props) {
    const [width, setWidth] = useState(value?.width ?? 400);
    const [align, setAlign] = useState(value?.align ?? 0);
    const [isBusy, setIsBusy] = useState(false);
    const [natural, setNatural] = useState<number | null>(null);

    const boxRef = useRef<HTMLDivElement>(null);

    /* 元の絵の幅。ここが上限になる */
    useEffect(() => {
        const image = new Image();
        image.onload = () => {
            setNatural(image.naturalWidth);
            /* いまの指定が元より広ければ、そこまで戻す */
            setWidth((prev) => Math.min(prev, image.naturalWidth));
        };
        image.src = url;
    }, [url]);

    /* 動かせる上限。元の絵の幅まで */
    const limit = Math.min(MAX_WIDTH, natural ?? MAX_WIDTH);

    /* 見本に出す本文。置いた場所の前後だけ */
    const sentences = splitIntoSentences(body);
    const before = sentences
        .slice(Math.max(0, afterSentence - 4), afterSentence)
        .join("");
    const after = sentences.slice(afterSentence, afterSentence + 4).join("");

    async function save(rec: { width: number; align: number } | null) {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await onSave(rec);
            onClose();
        } catch {
            window.alert("決められませんでした。時間をおいて試してください。");
        }
        setIsBusy(false);
    }

    /* 見本の幅は本物より狭いので、同じ割合に縮めて見せる */
    const scale = (boxRef.current?.clientWidth ?? READING_WIDTH) / READING_WIDTH;
    const shownWidth = Math.round(width * Math.min(1, scale));

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4"
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[92vh] w-[min(760px,100%)] flex-col overflow-hidden rounded-xl border border-line bg-surface"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
                    <p className="text-[13px] font-medium text-ink">
                        すすめる見せ方を決める
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[12px] text-faint hover:text-ink"
                    >
                        閉じる
                    </button>
                </div>

                {/* ---- 見本 ---- */}
                <div
                    ref={boxRef}
                    className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-canvas px-6 py-5"
                >
                    <p className="whitespace-pre-wrap text-[14px] leading-[2] text-ink">
                        {stripRuby(before)}
                    </p>

                    <div
                        style={{
                            margin: "24px 0",
                            display: "flex",
                            /* 左右の寄せ。-100 で左、0 で中央、100 で右 */
                            justifyContent:
                                align <= -50
                                    ? "flex-start"
                                    : align >= 50
                                      ? "flex-end"
                                      : "center",
                        }}
                    >
                        <span
                            style={{
                                display: "block",
                                width: shownWidth,
                                maxWidth: "100%",
                                /* 中間の寄せは、余白で細かく合わせる */
                                transform: `translateX(${align / 4}%)`,
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt="挿絵"
                                style={{
                                    width: "100%",
                                    height: "auto",
                                    borderRadius: 8,
                                    display: "block",
                                }}
                            />
                        </span>
                    </div>

                    <p className="whitespace-pre-wrap text-[14px] leading-[2] text-ink">
                        {stripRuby(after)}
                    </p>
                </div>

                {/* ---- 決める ---- */}
                <div className="shrink-0 border-t border-line px-5 py-4">
                    <label className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[11.5px] text-muted">
                            大きさ
                        </span>
                        <input
                            type="range"
                            min={MIN_WIDTH}
                            max={limit}
                            step={1}
                            value={Math.min(width, limit)}
                            onChange={(event) => setWidth(Number(event.target.value))}
                            className="flex-1"
                        />
                        <input
                            type="number"
                            min={MIN_WIDTH}
                            max={limit}
                            value={Math.min(width, limit)}
                            onChange={(event) =>
                                setWidth(
                                    Math.min(
                                        limit,
                                        Math.max(MIN_WIDTH, Number(event.target.value) || MIN_WIDTH),
                                    ),
                                )
                            }
                            className="w-20 rounded border border-line bg-canvas px-2 py-1 text-right text-[12px] text-ink"
                        />
                        <span className="text-[11px] text-faint">px</span>
                    </label>

                    <label className="mt-3 flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[11.5px] text-muted">
                            左右
                        </span>
                        <input
                            type="range"
                            min={-100}
                            max={100}
                            step={1}
                            value={align}
                            onChange={(event) => setAlign(Number(event.target.value))}
                            className="flex-1"
                        />
                        <span className="w-20 text-right text-[12px] text-ink">
                            {align === 0 ? "中央" : align < 0 ? `左へ ${-align}` : `右へ ${align}`}
                        </span>
                    </label>

                    {natural && (
                        <p className="mt-2 text-[11px] text-faint">
                            元の絵は {natural}px です。これより大きくすると輪郭がぼやけるので、
                            ここまでしか広げられません。
                            {natural < 400 && (
                                <>
                                    <br />
                                    大きく見せたいときは、もっと大きい絵を上げ直してください。
                                </>
                            )}
                        </p>
                    )}

                    <p className="mt-2 text-[11px] leading-relaxed text-faint">
                        縦書きでは、左右の寄せは使われません（中央のまま）。
                        <br />
                        決めると、読む人の画面に「推奨」の押し具が出ます。
                    </p>

                    <div className="mt-4 flex items-center justify-end gap-2">
                        {value && (
                            <button
                                type="button"
                                onClick={() => void save(null)}
                                disabled={isBusy}
                                className="mr-auto rounded-lg border border-line px-3 py-2 text-[12px] text-[var(--color-danger)] disabled:opacity-40"
                            >
                                すすめるのをやめる
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-line px-4 py-2 text-[12.5px] text-muted hover:text-ink"
                        >
                            やめる
                        </button>
                        <button
                            type="button"
                            onClick={() => void save({ width, align })}
                            disabled={isBusy}
                            className="rounded-lg bg-forest px-4 py-2 text-[12.5px] text-white disabled:opacity-40"
                        >
                            {isBusy ? "決めています…" : "これですすめる"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
