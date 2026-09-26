/**
 * ============================================================
 * 原石航路 Studio
 * 語彙集と、チェックで見つけたものの形
 *
 * 語彙集は「正しい書き方」と「使わない書き方」の組。
 *   正：魔導士　　使わない：魔道士、魔導師
 *   正：〜ください　使わない：〜下さい
 *
 * ★ 語彙集に載せた揺れは、AI を通さずにここで探す。
 *   確実に見つかり、費用もかからない。
 *   AI には「語彙集に無い」誤字・脱字・揺れを探してもらう。
 * ============================================================
 */

export interface GlossaryTerm {
    id: string;
    novel_id: string;
    /** 正しい書き方 */
    correct: string;
    /** 使わない書き方 */
    variants: string[];
    note: string;
    created_at?: string;
}

export type CheckKind = "typo" | "omission" | "variant" | "glossary";

export const CHECK_KIND_LABEL: Record<CheckKind, string> = {
    typo: "誤字",
    omission: "脱字",
    variant: "表記揺れ",
    glossary: "語彙集",
};

export interface CheckIssue {
    kind: CheckKind;
    /** 1 から数えた行番号 */
    line: number;
    /** 本文から抜いた前後（見せる用） */
    quote: string;
    /** 直す対象の言葉だけ（「魔道士」など） */
    word: string;
    /** 提案。本文は書き換えない */
    suggestion: string;
    reason: string;
}

/** 行番号。0 から数えた位置を 1 から数えた行に */
export function lineAt(text: string, at: number): number {
    return text.slice(0, at).split("\n").length;
}

/** 当たった所の前後を切り出す。長い行は前後だけ */
export function around(text: string, at: number, length: number): string {
    const lineStart = text.lastIndexOf("\n", at - 1) + 1;
    const lineEndRaw = text.indexOf("\n", at + length);
    const lineEnd = lineEndRaw < 0 ? text.length : lineEndRaw;

    const start = Math.max(lineStart, at - 16);
    const end = Math.min(lineEnd, at + length + 24);

    return (
        (start > lineStart ? "…" : "") +
        text.slice(start, end).trim() +
        (end < lineEnd ? "…" : "")
    );
}

/**
 * 語彙集の「使わない書き方」を本文から探す。
 *
 * ★ 正しい書き方の一部として出てくるものは数えない。
 *   正「魔導師団」・使わない「魔導師」のとき、
 *   「魔導師団」の中の「魔導師」まで拾うと、正しい所に印が付いてしまう。
 */
export function findGlossaryIssues(text: string, terms: GlossaryTerm[]): CheckIssue[] {
    const issues: CheckIssue[] = [];

    for (const term of terms) {
        const correct = term.correct.trim();

        for (const raw of term.variants) {
            const variant = raw.trim();
            if (!variant || variant === correct) continue;

            let from = 0;
            while (from < text.length) {
                const at = text.indexOf(variant, from);
                if (at < 0) break;
                from = at + variant.length;

                /* 正しい書き方の中に含まれているなら飛ばす */
                if (correct.includes(variant)) {
                    const offset = correct.indexOf(variant);
                    if (text.slice(at - offset, at - offset + correct.length) === correct) continue;
                }

                issues.push({
                    kind: "glossary",
                    line: lineAt(text, at),
                    quote: around(text, at, variant.length),
                    word: variant,
                    suggestion: correct,
                    reason: term.note ? `語彙集：${term.note}` : "語彙集で使わない書き方にしています",
                });
            }
        }
    }

    return issues.sort((a, b) => a.line - b.line);
}
