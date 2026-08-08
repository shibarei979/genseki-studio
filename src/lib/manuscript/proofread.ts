/**
 * ============================================================
 * 原石航路 Studio
 * 推敲チェック
 *
 * 日本語の書き手が投稿前に必ずやる作業を機械にやらせる。
 * ただし直すかどうかは書き手が決める。
 *
 * 「間違い」ではなく「揃っていない」を拾うのが基本。
 * 三点リーダを 1 つ使う流儀もあるし、字下げをしない作品もある。
 * だから既定では知らせるだけで、直すのは押されたときだけにする。
 * ============================================================
 */

import { stripNotation } from "@/lib/manuscript/notation";

export type IssueSeverity = "warn" | "hint";

export interface ProofreadIssue {
    id: string;
    ruleKey: string;
    ruleLabel: string;
    severity: IssueSeverity;
    line: number;
    /** 行の中の位置 */
    column: number;
    length: number;
    message: string;
    /** その行の抜き出し */
    excerpt: string;
    /** 機械的に直せるか */
    fixable: boolean;
}

export interface RuleToggle {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
}

export const DEFAULT_RULES: RuleToggle[] = [
    { key: "ellipsis", label: "三点リーダ", description: "…… のように偶数個で揃えます。", enabled: true },
    { key: "dash", label: "ダッシュ", description: "—— のように偶数個で揃えます。", enabled: true },
    { key: "indent", label: "行頭の字下げ", description: "「」で始まる行以外に全角スペースを入れます。", enabled: true },
    { key: "halfwidth", label: "半角文字", description: "本文中の半角英数字・半角カナを見つけます。", enabled: true },
    { key: "exclamation", label: "感嘆符のあと", description: "！？のあとに全角スペースを入れます。", enabled: true },
    { key: "repeat", label: "同じ文末の連続", description: "「〜た。」が3回続くと知らせます。", enabled: true },
    { key: "notation", label: "ルビの記法", description: "《 》の閉じ忘れを見つけます。", enabled: true },
    { key: "ng-words", label: "使わない言葉", description: "運営が登録した言葉を知らせます。", enabled: true },
];

/**
 * 運営が登録した「使わない言葉」。
 *
 * 書けなくはしない。気づかせるだけにする。
 * 言葉を禁じると、書き手は書きたいものを書けなくなる。
 */
export interface NgWordRule {
    word: string;
    reason: string;
    suggestion: string;
}

const OPENING_BRACKETS = /^[「『（〈《【〔"'“”]/;

/**
 * ============================================================
 * 検査
 * ============================================================
 */

export function proofread(
    text: string,
    enabled: Set<string>,
    /** 運営が登録した言葉。無ければ調べない */
    ngWords: NgWordRule[] = [],
): ProofreadIssue[] {
    const issues: ProofreadIssue[] = [];
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let counter = 0;

    const push = (issue: Omit<ProofreadIssue, "id">) => {
        counter += 1;
        issues.push({ ...issue, id: `i${counter}` });
    };

    let previousEndings: string[] = [];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const excerpt = line.slice(0, 60);
        const plain = stripNotation(line);

        if (line.trim().length === 0) {
            previousEndings = [];
            return;
        }


        // 三点リーダ
        if (enabled.has("ellipsis")) {
            for (const match of matchAll(line, /…+|\.{2,}|。{3,}/g)) {
                const isHalf = !match.value.startsWith("…");
                const count = match.value.length;
                if (isHalf || count % 2 === 1) {
                    push({
                        ruleKey: "ellipsis",
                        ruleLabel: "三点リーダ",
                        severity: "warn",
                        line: lineNumber,
                        column: match.index,
                        length: match.value.length,
                        message: isHalf
                            ? "半角のピリオドが使われています。…… に直せます。"
                            : "三点リーダが奇数個です。…… のように2つ重ねるのが慣習です。",
                        excerpt,
                        fixable: true,
                    });
                }
            }
        }

        // ダッシュ
        if (enabled.has("dash")) {
            for (const match of matchAll(line, /[—―–\-]{1,}/g)) {
                if (match.value.length % 2 === 1 || /[–\-]/.test(match.value)) {
                    push({
                        ruleKey: "dash",
                        ruleLabel: "ダッシュ",
                        severity: "hint",
                        line: lineNumber,
                        column: match.index,
                        length: match.value.length,
                        message: "ダッシュは —— のように2つ重ねるのが慣習です。",
                        excerpt,
                        fixable: true,
                    });
                }
            }
        }

        // 行頭の字下げ
        if (enabled.has("indent")) {
            const trimmed = plain.trimStart();
            if (
                trimmed.length > 0 &&
                !plain.startsWith("　") &&
                !OPENING_BRACKETS.test(trimmed)
            ) {
                push({
                    ruleKey: "indent",
                    ruleLabel: "行頭の字下げ",
                    severity: "hint",
                    line: lineNumber,
                    column: 0,
                    length: 0,
                    message: "行頭に全角スペースがありません。",
                    excerpt,
                    fixable: true,
                });
            }
        }

        // 半角文字
        if (enabled.has("halfwidth")) {
            for (const match of matchAll(line, /[0-9A-Za-z]{1,}|[｡-ﾟ]+/g)) {
                push({
                    ruleKey: "halfwidth",
                    ruleLabel: "半角文字",
                    severity: "hint",
                    line: lineNumber,
                    column: match.index,
                    length: match.value.length,
                    message: "半角文字は縦書きで横倒しになります。",
                    excerpt,
                    fixable: true,
                });
            }
        }

        // 感嘆符のあと
        if (enabled.has("exclamation")) {
            for (const match of matchAll(line, /[！？][^　」』）〉》】〕！？\s]/g)) {
                push({
                    ruleKey: "exclamation",
                    ruleLabel: "感嘆符のあと",
                    severity: "hint",
                    line: lineNumber,
                    column: match.index,
                    length: 1,
                    message: "！や？のあとは全角スペースを空けるのが慣習です。",
                    excerpt,
                    fixable: true,
                });
            }
        }

        // 同じ文末の連続
        if (enabled.has("repeat")) {
            const ending = plain.trim().slice(-3);
            if (/[たったるいだ]。$/.test(ending)) {
                previousEndings.push(ending.slice(-2));
                if (previousEndings.length >= 3) {
                    const last3 = previousEndings.slice(-3);
                    if (last3[0] === last3[1] && last3[1] === last3[2]) {
                        push({
                            ruleKey: "repeat",
                            ruleLabel: "同じ文末の連続",
                            severity: "hint",
                            line: lineNumber,
                            column: 0,
                            length: 0,
                            message: `「${last3[0]}」で終わる文が3つ続いています。`,
                            excerpt,
                            fixable: false,
                        });
                        previousEndings = [];
                    }
                }
            } else {
                previousEndings = [];
            }
        }

        // ルビの記法
        if (enabled.has("notation")) {
            const open = (line.match(/《/g) ?? []).length;
            const close = (line.match(/》/g) ?? []).length;
            if (open !== close) {
                push({
                    ruleKey: "notation",
                    ruleLabel: "ルビの記法",
                    severity: "warn",
                    line: lineNumber,
                    column: 0,
                    length: 0,
                    message: "《 と 》 の数が合っていません。",
                    excerpt,
                    fixable: false,
                });
            }
        }
    });

    /* 使わない言葉 */
    if (enabled.has("ng-words") && ngWords.length > 0) {
        lines.forEach((line, index) => {
            for (const rule of ngWords) {
                if (!rule.word) continue;

                let from = 0;
                for (;;) {
                    const at = line.indexOf(rule.word, from);
                    if (at === -1) break;

                    issues.push({
                        id: `ng-${index}-${at}-${rule.word}`,
                        ruleKey: "ng-words",
                        ruleLabel: "使わない言葉",
                        severity: "hint",
                        line: index + 1,
                        column: at,
                        length: rule.word.length,
                        message: rule.suggestion
                            ? `「${rule.word}」→「${rule.suggestion}」${rule.reason ? `（${rule.reason}）` : ""}`
                            : rule.reason || `「${rule.word}」に気をつけてください`,
                        excerpt: line.trim(),
                        // 言い換えが決まっているものだけ直せる
                        fixable: Boolean(rule.suggestion),
                    });

                    from = at + rule.word.length;
                }
            }
        });
    }

    return issues;
}

/**
 * ============================================================
 * 機械的に直す
 *
 * 直せるものだけを直す。判断が要るものは残す。
 * ============================================================
 */

export function autoFix(text: string, enabled: Set<string>): { text: string; fixed: number } {
    let fixed = 0;
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    const next = lines.map((line) => {
        let result = line;

        if (enabled.has("ellipsis")) {
            result = result.replace(/\.{2,}|。{3,}/g, () => {
                fixed += 1;
                return "……";
            });
            result = result.replace(/…+/g, (match) => {
                if (match.length % 2 === 0) return match;
                fixed += 1;
                return "…".repeat(match.length + 1);
            });
        }

        if (enabled.has("dash")) {
            result = result.replace(/[—―–\-]{1,}/g, (match) => {
                if (match.length % 2 === 0 && /^—+$/.test(match)) return match;
                fixed += 1;
                return "—".repeat(match.length % 2 === 0 ? match.length : match.length + 1);
            });
        }

        if (enabled.has("halfwidth")) {
            result = result.replace(/[0-9A-Za-z]/g, (char) => {
                fixed += 1;
                return String.fromCharCode(char.charCodeAt(0) + 0xfee0);
            });
        }

        if (enabled.has("exclamation")) {
            result = result.replace(/([！？])([^　」』）〉》】〕！？\s])/g, (_, mark, next2) => {
                fixed += 1;
                return `${mark}　${next2}`;
            });
        }

        // 字下げは最後。ほかの直しで行頭が変わるため
        if (enabled.has("indent")) {
            const plain = stripNotation(result);
            const trimmedStart = plain.trimStart();
            if (
                trimmedStart.length > 0 &&
                !plain.startsWith("　") &&
                !OPENING_BRACKETS.test(trimmedStart)
            ) {
                result = `　${result}`;
                fixed += 1;
            }
        }

        return result;
    });

    return { text: next.join("\n"), fixed };
}

/**
 * ============================================================
 * 内部
 * ============================================================
 */

function matchAll(text: string, pattern: RegExp): { value: string; index: number }[] {
    const results: { value: string; index: number }[] = [];
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        results.push({ value: match[0], index: match.index });
        if (match[0].length === 0) regex.lastIndex += 1;
    }
    return results;
}
