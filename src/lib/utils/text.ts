/**
 * ============================================================
 * 原石航路 Studio
 * テキストユーティリティ
 * ============================================================
 */

import { stripNotation } from "@/lib/manuscript/notation";

/**
 * 本文の文字数を数える。
 *
 * 改行は数えない（投稿サイトの慣習）。
 * ルビと傍点の記法も数えない。ルビは読みであって本文ではないし、
 * 記号まで数えると、ルビを振るたびに文字数が増えてしまう。
 * サロゲートペア（絵文字・異体字）は 1 文字として数える。
 */
export function countChars(text: string): number {
    return Array.from(stripNotation(text).replace(/\r?\n/g, "")).length;
}

/**
 * 3 桁区切り。1234 → "1,234"
 *
 * 値が無いときは 0 として扱う。
 * 保存先によっては列が空のことがあり、
 * そのたびに画面が落ちるのは割に合わない。
 */
export function formatNumber(value: number | null | undefined): string {
    if (typeof value !== "number" || Number.isNaN(value)) return "0";
    return value.toLocaleString("ja-JP");
}

/** ISO 文字列 → "2025/05/20 21:47" */
export function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO 文字列 → "12:34:56" */
export function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
