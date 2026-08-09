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

interface Props {
    text: string;
}

export default function RenderedText({ text }: Props) {
    const segments = parseNotation(text);

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
                return <span key={index}>{segment.text}</span>;
            })}
        </>
    );
}
