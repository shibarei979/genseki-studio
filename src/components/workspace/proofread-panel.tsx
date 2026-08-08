/**
 * ============================================================
 * 原石航路 Studio
 * ProofreadPanel — 推敲チェック
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import type { NgWordRule, ProofreadIssue } from "@/lib/manuscript/proofread";
import { autoFix, DEFAULT_RULES, proofread } from "@/lib/manuscript/proofread";
import { getRepository } from "@/lib/repository";

interface Props {
    body: string;
    onApplyFix: (nextBody: string) => void;
    onClose: () => void;
}

export default function ProofreadPanel({ body, onApplyFix, onClose }: Props) {
    const [rules, setRules] = useState(DEFAULT_RULES);
    const [lastFixed, setLastFixed] = useState<number | null>(null);

    const enabled = useMemo(
        () => new Set(rules.filter((rule) => rule.enabled).map((rule) => rule.key)),
        [rules],
    );

    /*
     * 運営が登録した「使わない言葉」を読む。
     * 一度読んだら覚えておく。書くたびに読み直す必要はない。
     */
    const [ngWords, setNgWords] = useState<NgWordRule[]>([]);

    useEffect(() => {
        void (async () => {
            const rows = await getRepository().listNgWords();
            setNgWords(
                rows.map((row) => ({
                    word: row.word,
                    reason: row.reason,
                    suggestion: row.suggestion,
                })),
            );
        })();
    }, []);

    const issues = useMemo(
        () => proofread(body, enabled, ngWords),
        [body, enabled, ngWords],
    );

    const byRule = useMemo(() => {
        const map = new Map<string, ProofreadIssue[]>();
        for (const issue of issues) {
            const list = map.get(issue.ruleKey) ?? [];
            list.push(issue);
            map.set(issue.ruleKey, list);
        }
        return map;
    }, [issues]);

    const fixableCount = issues.filter((issue) => issue.fixable).length;

    function handleAutoFix() {
        const result = autoFix(body, enabled);
        onApplyFix(result.text);
        setLastFixed(result.fixed);
        window.setTimeout(() => setLastFixed(null), 4000);
    }

    return (
        <div className="flex h-full w-[340px] shrink-0 flex-col rounded-lg border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-medium text-ink">推敲チェック</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="px-1 text-sm text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            <div className="border-b border-line px-4 py-3">
                <p className="text-sm text-ink">
                    {issues.length === 0
                        ? "気になるところはありません。"
                        : `${issues.length}件見つかりました`}
                </p>
                {fixableCount > 0 && (
                    <>
                        <button
                            type="button"
                            onClick={handleAutoFix}
                            className="mt-2 w-full rounded-md bg-forest px-3 py-2 text-sm text-white hover:bg-forest-dark"
                        >
                            機械的に直せる{fixableCount}件を直す
                        </button>
                        <p className="mt-1.5 text-xs text-faint">
                            判断が要るものは直しません。直したあとは元に戻せないので、
                            気になるときは先に履歴へ残してください。
                        </p>
                    </>
                )}
                {lastFixed !== null && (
                    <p className="mt-2 text-xs text-forest">{lastFixed}箇所を直しました。</p>
                )}
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                {Array.from(byRule.entries()).map(([ruleKey, list]) => {
                    const rule = rules.find((row) => row.key === ruleKey);
                    return (
                        <div key={ruleKey} className="border-b border-line px-4 py-3">
                            <p className="flex items-center gap-2 text-xs">
                                <span className="text-ink">{rule?.label ?? ruleKey}</span>
                                <span className="text-faint">{list.length}件</span>
                            </p>
                            <ul className="mt-1.5 space-y-1.5">
                                {list.slice(0, 6).map((issue) => (
                                    <li key={issue.id} className="text-xs">
                                        <span className="text-forest">{issue.line}行目</span>
                                        <span className="ml-1.5 text-muted">
                                            {issue.message}
                                        </span>
                                        {issue.excerpt && (
                                            <span className="mt-0.5 block truncate text-faint">
                                                {issue.excerpt}
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {list.length > 6 && (
                                    <li className="text-xs text-faint">
                                        ほか{list.length - 6}件
                                    </li>
                                )}
                            </ul>
                        </div>
                    );
                })}
            </div>

            <details className="border-t border-line px-4 py-3">
                <summary className="cursor-pointer text-xs text-muted">
                    チェックする項目
                </summary>
                <ul className="mt-2 space-y-2">
                    {rules.map((rule) => (
                        <li key={rule.key}>
                            <label className="flex cursor-pointer items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={(e) =>
                                        setRules((current) =>
                                            current.map((row) =>
                                                row.key === rule.key
                                                    ? { ...row, enabled: e.target.checked }
                                                    : row,
                                            ),
                                        )
                                    }
                                    className="mt-0.5 accent-[var(--color-forest)]"
                                />
                                <span>
                                    <span className="block text-xs text-ink">{rule.label}</span>
                                    <span className="block text-xs text-faint">
                                        {rule.description}
                                    </span>
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}
