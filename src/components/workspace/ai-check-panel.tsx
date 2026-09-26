/**
 * ============================================================
 * 原石航路 Studio
 * AiCheckPanel — 誤字脱字チェックと語彙集（Pro）
 *
 * ★ 画面では「AI」と言わない。「誤字脱字」「システム」と呼ぶ（運営の決まり）。
 *
 * ★ 回数の上限は無い（運営の決まり）。
 *
 * ★ 見つけるだけ。本文は書き換えない（運営の決まり）。
 *   候補を見せ、押すと本文のその行へ飛ぶ。直すのは作家自身の手で。
 *   一括で直す押し具・候補をそのまま当てはめる押し具は作らない。
 *
 * ★ タブは 2 つ。
 *   チェック：開いている 1 話を見る
 *   語彙集　：その作品の「正しい書き方」と「使わない書き方」
 *             ほかの作品の語彙集を写して使える
 *
 * ★ 語彙集に載せた揺れは、AI を通さず確実に見つかる。
 *   チェックで出た表記揺れは、その場で語彙集に登録できる。
 *   使うほど、その作品に合ったチェックになる。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import ProBadge from "@/components/common/pro-badge";
import type { CheckIssue, CheckKind, GlossaryTerm } from "@/lib/manuscript/glossary";
import { CHECK_KIND_LABEL } from "@/lib/manuscript/glossary";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";

interface Props {
    workId: string;
    episodeId: string;
    /** いま画面にある本文（保存前の書きかけも含む） */
    body: string;
    onJump?: (line: number) => void;
    onClose: () => void;
}

type Tab = "check" | "glossary";

/** 種類ごとの色。誤字・脱字は目立たせ、語彙集は落ち着いた色 */
const KIND_STYLE: Record<CheckKind, { background: string; color: string }> = {
    typo: { background: "var(--color-danger-tint, #fbeceb)", color: "var(--color-danger, #b3372c)" },
    omission: { background: "var(--color-danger-tint, #fbeceb)", color: "var(--color-danger, #b3372c)" },
    variant: { background: "var(--color-amber-tint, #fbf0dd)", color: "var(--color-amber, #99610a)" },
    glossary: { background: "var(--color-forest-tint, #e6eef4)", color: "var(--color-forest, #1f4e6b)" },
};

export default function AiCheckPanel({ workId, episodeId, body, onJump, onClose }: Props) {
    const { aiCheck } = useMemberFeatures();
    const [tab, setTab] = useState<Tab>("check");

    /* ---------- 語彙集 ---------- */
    const [terms, setTerms] = useState<GlossaryTerm[]>([]);
    const [otherWorks, setOtherWorks] = useState<{ id: string; title: string; count: number }[]>([]);
    const [termsLoaded, setTermsLoaded] = useState(false);

    const readTerms = useCallback(async () => {
        try {
            const res = await fetch(`/api/glossary?work=${encodeURIComponent(workId)}`);
            if (!res.ok) return;
            const data = await res.json();
            setTerms(data.terms ?? []);
            setOtherWorks(data.works ?? []);
        } finally {
            setTermsLoaded(true);
        }
    }, [workId]);

    useEffect(() => {
        if (!aiCheck) return;
        void readTerms();
    }, [aiCheck, readTerms]);

    /* ---------- チェック ---------- */
    const [issues, setIssues] = useState<CheckIssue[] | null>(null);
    const [checkedEpisode, setCheckedEpisode] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [truncated, setTruncated] = useState(false);
    const [filter, setFilter] = useState<CheckKind | "all">("all");
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    /* 別の話に移ったら、前の話の結果は出さない */
    useEffect(() => {
        if (checkedEpisode && checkedEpisode !== episodeId) {
            setIssues(null);
            setNotice("");
            setDismissed(new Set());
        }
    }, [episodeId, checkedEpisode]);

    async function runCheck() {
        if (busy) return;
        setBusy(true);
        setNotice("");
        try {
            const res = await fetch("/api/ai/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ work: workId, text: body }),
            });
            const data = await res.json();
            if (!res.ok) {
                setNotice(data.message ?? "チェックできませんでした。");
                return;
            }
            setIssues(data.issues ?? []);
            setTruncated(Boolean(data.truncated));
            setCheckedEpisode(episodeId);
            setDismissed(new Set());
            setFilter("all");
        } catch {
            setNotice("チェックできませんでした。少し待ってからもう一度押してください。");
        } finally {
            setBusy(false);
        }
    }

    async function addTerm(correct: string, variants: string, note: string): Promise<boolean> {
        const res = await fetch("/api/glossary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ work: workId, correct, variants, note }),
        });
        if (!res.ok) return false;
        await readTerms();
        return true;
    }

    async function removeTerm(id: string) {
        setTerms((list) => list.filter((term) => term.id !== id));
        await fetch(`/api/glossary?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    }

    async function importFrom(from: string) {
        const res = await fetch("/api/glossary/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: workId }),
        });
        const data = await res.json().catch(() => ({}));
        await readTerms();
        return data as { added?: number; merged?: number };
    }

    const keyOf = (issue: CheckIssue) => `${issue.line}:${issue.word}:${issue.kind}`;
    const shown = (issues ?? []).filter(
        (issue) => !dismissed.has(keyOf(issue)) && (filter === "all" || issue.kind === filter),
    );
    const counts = (issues ?? [])
        .filter((issue) => !dismissed.has(keyOf(issue)))
        .reduce<Record<string, number>>((acc, issue) => {
            acc[issue.kind] = (acc[issue.kind] ?? 0) + 1;
            return acc;
        }, {});
    const totalShown = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <div className="flex h-full w-full shrink-0 flex-col rounded-lg border border-line bg-surface lg:w-[380px]">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    誤字脱字
                    <ProBadge />
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="px-1 text-[13px] text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            {!aiCheck ? (
                <Locked />
            ) : (
                <>
                    {/* タブ */}
                    <div className="flex border-b border-line px-2">
                        {(
                            [
                                ["check", "チェック"],
                                ["glossary", `語彙集${termsLoaded ? `（${terms.length}）` : ""}`],
                            ] as [Tab, string][]
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                aria-pressed={tab === key}
                                className={[
                                    "-mb-px border-b-2 px-3 py-2 text-[12px]",
                                    tab === key
                                        ? "border-forest font-medium text-forest"
                                        : "border-transparent text-muted hover:text-ink",
                                ].join(" ")}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
                        {tab === "check" ? (
                            <div className="px-3.5 py-3">
                                <p className="text-[11.5px] leading-relaxed text-muted">
                                    開いている話から、誤字・脱字・表記揺れの候補を探します。
                                    <span className="text-ink">本文は書き換えません。候補を見て、ご自身で直してください。</span>
                                    保存前の書きかけも含めて見ます。
                                </p>

                                <div className="mt-2.5 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void runCheck()}
                                        disabled={busy || !body.trim()}
                                        className="rounded-md bg-forest px-4 py-1.5 text-[12.5px] text-white hover:bg-forest-dark disabled:opacity-40"
                                    >
                                        {busy ? "見ています…（数十秒）" : issues ? "もう一度チェック" : "この話をチェック"}
                                    </button>
                                </div>

                                {notice && (
                                    <p className="mt-2.5 rounded-md bg-[var(--color-amber-tint)] px-3 py-2 text-[11.5px] text-ink">
                                        {notice}
                                    </p>
                                )}

                                {issues && (
                                    <div className="mt-3.5">
                                        {truncated && (
                                            <p className="mb-2 text-[11px] text-faint">
                                                長い話なので、前から2万字までを見ました。
                                            </p>
                                        )}

                                        {totalShown === 0 ? (
                                            <p className="rounded-md bg-canvas px-3 py-4 text-center text-[12px] text-muted">
                                                気になる所は見つかりませんでした。
                                            </p>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap gap-1">
                                                    {(["all", "typo", "omission", "variant", "glossary"] as const).map((key) => {
                                                        const n = key === "all" ? totalShown : counts[key] ?? 0;
                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => setFilter(key)}
                                                                disabled={n === 0}
                                                                aria-pressed={filter === key}
                                                                className={[
                                                                    "rounded-full px-2.5 py-0.5 text-[11px]",
                                                                    filter === key
                                                                        ? "bg-forest text-white"
                                                                        : "border border-line text-muted hover:text-ink",
                                                                    n === 0 ? "opacity-40" : "",
                                                                ].join(" ")}
                                                            >
                                                                {key === "all" ? "すべて" : CHECK_KIND_LABEL[key]} {n}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <ul className="mt-2.5 space-y-2">
                                                    {shown.map((issue) => (
                                                        <IssueRow
                                                            key={keyOf(issue)}
                                                            issue={issue}
                                                            onJump={onJump}
                                                            onDismiss={() =>
                                                                setDismissed((prev) => new Set(prev).add(keyOf(issue)))
                                                            }
                                                            onRegister={
                                                                issue.kind === "variant" || issue.kind === "typo"
                                                                    ? async () => {
                                                                          const ok = await addTerm(
                                                                              issue.suggestion,
                                                                              issue.word,
                                                                              "",
                                                                          );
                                                                          if (ok) {
                                                                              setDismissed((prev) =>
                                                                                  new Set(prev).add(keyOf(issue)),
                                                                              );
                                                                          }
                                                                          return ok;
                                                                      }
                                                                    : undefined
                                                            }
                                                        />
                                                    ))}
                                                </ul>
                                                <p className="mt-2.5 text-[10.5px] leading-relaxed text-faint">
                                                    システムの候補は外れることもあります。わざと崩した台詞や方言は、そのままで大丈夫です。直すかどうかは、ご自身で決めてください。
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <GlossaryTab
                                terms={terms}
                                loaded={termsLoaded}
                                otherWorks={otherWorks}
                                onAdd={addTerm}
                                onRemove={removeTerm}
                                onImport={importFrom}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

/** 会員でない人に見せる案内 */
function Locked() {
    return (
        <div className="px-4 py-5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <ProBadge />
                の機能です
            </p>
            <ul className="mt-2.5 space-y-1.5 text-[12px] leading-relaxed text-muted">
                <li>・開いている話から、誤字・脱字・表記揺れをシステムが探します（回数の制限はありません）</li>
                <li>・本文は書き換えません。見つけた所へ飛んで、ご自身で直します</li>
                <li>・作品ごとの語彙集に「正しい書き方」を登録すると、揺れを確実に見つけます</li>
                <li>・ほかの作品の語彙集を写して使えます</li>
            </ul>
        </div>
    );
}

function IssueRow({
    issue,
    onJump,
    onDismiss,
    onRegister,
}: {
    issue: CheckIssue;
    onJump?: (line: number) => void;
    onDismiss: () => void;
    onRegister?: () => Promise<boolean>;
}) {
    const [registering, setRegistering] = useState(false);

    /* 引用の中で、直す対象の言葉に色を付ける */
    const at = issue.word ? issue.quote.indexOf(issue.word) : -1;

    return (
        <li className="rounded-lg border border-line">
            <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-2.5 py-1.5">
                <span className="rounded px-1.5 py-px text-[10px] font-medium" style={KIND_STYLE[issue.kind]}>
                    {CHECK_KIND_LABEL[issue.kind]}
                </span>
                <button
                    type="button"
                    onClick={() => onJump?.(issue.line)}
                    disabled={!onJump}
                    title="本文のこの行へ移動して、ご自身で直します"
                    className="rounded border border-forest-line bg-surface px-1.5 py-px text-[10px] text-forest hover:bg-forest-tint"
                >
                    {issue.line}行目
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="ml-auto text-[10.5px] text-faint hover:text-ink"
                >
                    このままでよい
                </button>
            </div>

            <div className="px-2.5 py-2">
                <p className="text-[12.5px] leading-relaxed text-ink">
                    {at >= 0 ? (
                        <>
                            {issue.quote.slice(0, at)}
                            <mark
                                className="rounded-sm px-0.5 font-medium"
                                style={{ background: KIND_STYLE[issue.kind].background, color: KIND_STYLE[issue.kind].color }}
                            >
                                {issue.word}
                            </mark>
                            {issue.quote.slice(at + issue.word.length)}
                        </>
                    ) : (
                        issue.quote
                    )}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12px]">
                    <span className="text-faint line-through">{issue.word}</span>
                    <span className="text-faint">→ 候補</span>
                    <span className="font-medium text-forest">{issue.suggestion}</span>
                    {issue.reason && <span className="text-[11px] text-muted">　{issue.reason}</span>}
                </p>

                {onRegister && (
                    <button
                        type="button"
                        disabled={registering}
                        onClick={async () => {
                            setRegistering(true);
                            await onRegister();
                            setRegistering(false);
                        }}
                        className="mt-1.5 text-[11px] text-forest hover:underline disabled:opacity-40"
                    >
                        語彙集に登録（正：{issue.suggestion}／使わない：{issue.word}）
                    </button>
                )}
            </div>
        </li>
    );
}

function GlossaryTab({
    terms,
    loaded,
    otherWorks,
    onAdd,
    onRemove,
    onImport,
}: {
    terms: GlossaryTerm[];
    loaded: boolean;
    otherWorks: { id: string; title: string; count: number }[];
    onAdd: (correct: string, variants: string, note: string) => Promise<boolean>;
    onRemove: (id: string) => Promise<void>;
    onImport: (from: string) => Promise<{ added?: number; merged?: number }>;
}) {
    const [correct, setCorrect] = useState("");
    const [variants, setVariants] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [from, setFrom] = useState("");
    const [importNote, setImportNote] = useState("");

    async function submit() {
        if (!correct.trim() || saving) return;
        setSaving(true);
        const ok = await onAdd(correct.trim(), variants, note.trim());
        setSaving(false);
        if (ok) {
            setCorrect("");
            setVariants("");
            setNote("");
        }
    }

    /*
     * ほかの作品の語彙集を使う。
     * ★ 新しい作品で語彙集が空のときは、いちばん上に大きく出す。
     */
    const importBox = otherWorks.length > 0 && (
        <div className={terms.length === 0 ? "rounded-lg border border-forest-line bg-forest-tint px-3 py-2.5" : "border-t border-line px-3.5 py-3"}>
            <p className="text-[12px] font-medium text-ink">ほかの作品の語彙集を使う</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                選んだ作品の語彙集を、この作品に写します。写したあとは別々に直せます。
            </p>
            <div className="mt-2 flex gap-1.5">
                <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-forest"
                >
                    <option value="">作品を選ぶ</option>
                    {otherWorks.map((work) => (
                        <option key={work.id} value={work.id}>
                            {work.title}（{work.count}語）
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    disabled={!from}
                    onClick={async () => {
                        const result = await onImport(from);
                        setImportNote(`${result.added ?? 0}語を写しました${result.merged ? `（${result.merged}語は使わない書き方を足しました）` : ""}。`);
                        setFrom("");
                    }}
                    className="shrink-0 rounded-md bg-forest px-3 py-1.5 text-[12px] text-white hover:bg-forest-dark disabled:opacity-40"
                >
                    写す
                </button>
            </div>
            {importNote && <p className="mt-1.5 text-[11px] text-forest">{importNote}</p>}
        </div>
    );

    return (
        <div>
            {terms.length === 0 && importBox && <div className="px-3.5 pt-3">{importBox}</div>}

            {/* 足す */}
            <div className="px-3.5 py-3">
                <p className="text-[11.5px] leading-relaxed text-muted">
                    正しい書き方と、使わない書き方を登録します。登録した揺れは、チェックのときに必ず見つかります。
                </p>
                <div className="mt-2 space-y-1.5">
                    <input
                        value={correct}
                        onChange={(e) => setCorrect(e.target.value)}
                        placeholder="正しい書き方（例：魔導士）"
                        className="w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-forest"
                    />
                    <input
                        value={variants}
                        onChange={(e) => setVariants(e.target.value)}
                        placeholder="使わない書き方（、で区切る。例：魔道士、魔導師）"
                        className="w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-forest"
                    />
                    <div className="flex gap-1.5">
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="メモ（任意）"
                            className="min-w-0 flex-1 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-forest"
                        />
                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={!correct.trim() || saving}
                            className="shrink-0 rounded-md bg-forest px-4 py-1.5 text-[12.5px] text-white hover:bg-forest-dark disabled:opacity-40"
                        >
                            登録
                        </button>
                    </div>
                </div>
            </div>

            {/* 一覧 */}
            <div className="border-t border-line">
                {!loaded ? (
                    <p className="px-3.5 py-4 text-[12px] text-faint">読み込んでいます…</p>
                ) : terms.length === 0 ? (
                    <p className="px-3.5 py-4 text-[12px] text-faint">まだ登録がありません。</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {terms.map((term) => (
                            <li key={term.id} className="group flex items-start gap-2 px-3.5 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-ink">{term.correct}</p>
                                    {term.variants.length > 0 && (
                                        <p className="mt-0.5 flex flex-wrap items-center gap-1">
                                            <span className="text-[10.5px] text-faint">使わない：</span>
                                            {term.variants.map((variant) => (
                                                <span
                                                    key={variant}
                                                    className="rounded bg-canvas px-1.5 py-px text-[11px] text-faint line-through"
                                                >
                                                    {variant}
                                                </span>
                                            ))}
                                        </p>
                                    )}
                                    {term.note && <p className="mt-0.5 text-[11px] text-muted">{term.note}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void onRemove(term.id)}
                                    aria-label={`${term.correct}を語彙集から消す`}
                                    className="shrink-0 text-[11px] text-faint hover:text-[var(--color-danger)]"
                                >
                                    消す
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {terms.length > 0 && importBox}
        </div>
    );
}
