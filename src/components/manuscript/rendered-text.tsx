/**
 * ============================================================
 * 原石航路 Studio
 * RenderedText — ルビと傍点を組んで表示する
 *
 * 縦書きでは <ruby> がそのまま効く。
 * 傍点は文字の上（縦書きでは右）に点を置くので text-emphasis を使う。
 * CSS 1 行で済み、本文の文字が増えない。
 * ============================================================
 */

"use client";

import { parseNotation } from "@/lib/manuscript/notation";
import { markAnnotations, splitNoteTokens } from "@/lib/utils/annotation";

interface Props {
    text: string;
}

export default function RenderedText({ text }: Props) {
    /*
     * ★ 注釈の記法（［＃注：…］）は、書く側の確かめ用に「※」だけ添えて出す。
     *   説明の文は出さない（読む画面では押すと出る）。
     */
    const segments = parseNotation(markAnnotations(text));

    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === "ruby") {
                    return (
                        <ruby key={index}>
                            {segment.base}
                            <rt>{segment.ruby}</rt>
                        </ruby>
                    );
                }
                if (segment.type === "emphasis") {
                    return (
                        <span key={index} className="manuscript-emphasis">
                            {segment.text}
                        </span>
                    );
                }
                if (/[\uE000\uE001]/.test(segment.text)) {
                    return (
                        <span key={index}>
                            {splitNoteTokens(segment.text).map((part, i) =>
                                part.type === "text" ? (
                                    <span key={i}>{part.body}</span>
                                ) : part.type === "end" ? (
                                    <sup key={i} style={{ fontSize: "0.55em", color: "var(--color-forest)" }}>
                                        ※{part.n}
                                    </sup>
                                ) : null,
                            )}
                        </span>
                    );
                }
                return <span key={index}>{segment.text}</span>;
            })}
        </>
    );
}
