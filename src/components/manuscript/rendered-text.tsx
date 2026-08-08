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
                if (segment.type === "highlight") {
                    /*
                     * 蛍光ペン。
                     * 書き手の目印なので、読者には出さない。
                     * ここは執筆中の見え方だけを受け持つ。
                     */
                    return (
                        <span
                            key={index}
                            style={{
                                background: "var(--color-amber-tint)",
                                boxShadow: "0 -0.35em 0 var(--color-amber-tint) inset",
                            }}
                        >
                            {segment.text}
                        </span>
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
