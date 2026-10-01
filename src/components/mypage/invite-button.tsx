"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * InviteButton — 友だち招待キャンペーンの入り口
 *
 *   マイページのミッションの横に札で置く。押すと小窓で、
 *   招待リンク・コピー・X / LINE で共有・招待した人数を出す。
 *
 * ★ 招待された人がどれか 1 話を読むと、両者に 100pt（今だけ）。
 * ★ 1 人 10 人まで。
 * ============================================================
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Summary {
    code: string | null;
    points: number;
    max: number;
    joined: number;
    rewarded: number;
    rewardedNow?: boolean;
    /** 招待された側として、コードを入れられるか */
    canEnter?: boolean;
}

export default function InviteButton() {
    const [data, setData] = useState<Summary | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [entry, setEntry] = useState("");
    const [entryMsg, setEntryMsg] = useState("");
    const [entryBusy, setEntryBusy] = useState(false);
    /** 読み込めなかったときの理由（札は出したまま、中で知らせる） */
    const [failed, setFailed] = useState("");
    const [tries, setTries] = useState(0);

    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const response = await fetch("/api/invite", { cache: "no-store" });
                if (response.status === 401) return; /* 入っていない人には出さない */
                const next = (await response.json().catch(() => null)) as (Summary & { error?: string }) | null;
                if (!alive) return;
                if (!response.ok || !next || !next.code) {
                    setFailed(next?.error ?? `読み込めませんでした（${response.status}）`);
                    return;
                }
                setFailed("");
                setData(next);
                if (next.rewardedNow) window.dispatchEvent(new Event("gk-points-changed"));
            } catch {
                if (alive) setFailed("繋がりませんでした");
            }
        })();
        return () => {
            alive = false;
        };
    }, [tries]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    /* 読み込めなかったとき：札は出して、押すと読み直す */
    if (!data || !data.code) {
        if (!failed) return null;
        return (
            <button type="button" className="lsb inv-b" onClick={() => setTries((n) => n + 1)} title={failed}>
                <span className="inv-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="8" r="3.2" />
                        <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
                        <path d="M18 8v6M15 11h6" />
                    </svg>
                </span>
                <span className="lsb-t">
                    <b>友だち招待</b>
                    <small>{failed}（押すと読み直す）</small>
                </span>
            </button>
        );
    }

    const url = `${window.location.origin}/?invite=${data.code}`;
    const text = `原石航路で小説を読んだり書いたりしています。このリンクから登録して1話読むと、招待した人と登録した人の両者に無料ポイント${data.points}ptずつ届きます。`;
    const full = data.joined >= data.max;

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            /* 古い端末：選んでコピー */
            const box = document.createElement("textarea");
            box.value = url;
            document.body.appendChild(box);
            box.select();
            document.execCommand("copy");
            box.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    async function shareNative() {
        try {
            await navigator.share({ title: "原石航路", text, url });
        } catch {
            /* やめたときも何もしない */
        }
    }

    async function enterCode() {
        if (!entry.trim() || entryBusy) return;
        setEntryBusy(true);
        setEntryMsg("");
        try {
            const response = await fetch("/api/invite/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: entry.trim() }),
            });
            const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (response.ok && result.ok) {
                setEntryMsg("受け付けました。どれか 1 話を読むと、両者にポイントが届きます。");
                setData((prev) => (prev ? { ...prev, canEnter: false } : prev));
            } else {
                setEntryMsg(result.error ?? "受け付けられませんでした。");
            }
        } catch {
            setEntryMsg("繋がりませんでした。");
        } finally {
            setEntryBusy(false);
        }
    }

    const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

    return (
        <>
            <button type="button" className="lsb inv-b" onClick={() => setIsOpen(true)} aria-haspopup="dialog">
                <span className="inv-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="8" r="3.2" />
                        <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
                        <path d="M18 8v6M15 11h6" />
                    </svg>
                </span>
                <span className="lsb-t">
                    <b>友だち招待</b>
                    <small>今だけ 両者に {data.points}pt</small>
                </span>
                <span className="lsb-n">
                    <strong className="inv-n">{data.joined}</strong>/{data.max}
                </span>
            </button>

            {isOpen && createPortal(
                <div className="lpop-dim" onClick={() => setIsOpen(false)}>
                    <div className="inv-modal" role="dialog" aria-modal="true" aria-label="友だち招待" onClick={(event) => event.stopPropagation()}>
                        <p className="inv-camp">今だけのキャンペーン</p>
                        <h3 className="inv-t">友だちを招待して、両者に {data.points}pt</h3>
                        <p className="inv-code">あなたの招待コード <b>{data.code}</b></p>

                        <ol className="inv-steps">
                            <li><b>1</b>下のリンクを友だちに送る</li>
                            <li><b>2</b>友だちがリンクから登録する</li>
                            <li><b>3</b>友だちがどれか 1 話を読む</li>
                        </ol>
                        <p className="inv-get">
                            <span className="mc-coin">P</span>
                            あなたにも友だちにも <strong>{data.points}pt</strong> ずつ届きます
                        </p>

                        <div className="inv-link">
                            <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} aria-label="招待リンク" />
                            <button type="button" onClick={() => void copy()} disabled={full}>
                                {copied ? "コピーしました" : "コピー"}
                            </button>
                        </div>

                        <div className="inv-share">
                            <a
                                className="inv-x"
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-disabled={full}
                            >
                                X で送る
                            </a>
                            <a
                                className="inv-line"
                                href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-disabled={full}
                            >
                                LINE で送る
                            </a>
                            {canNative && (
                                <button type="button" className="inv-more" onClick={() => void shareNative()} disabled={full}>
                                    ほかで送る
                                </button>
                            )}
                        </div>

                        <div className="inv-count">
                            <p>
                                招待した人 <strong>{data.joined}</strong> / {data.max} 人
                                <span>（そのうち読んでポイントが届いた人 {data.rewarded} 人）</span>
                            </p>
                            <span className="inv-bar" aria-hidden="true">
                                <i style={{ width: `${Math.min(100, (data.joined / data.max) * 100)}%` }} />
                            </span>
                            {full && <p className="inv-full">招待できる人数（{data.max} 人）に達しました。ありがとうございます。</p>}
                        </div>

                        {/* ★ 招待リンクを別のブラウザで開いて登録した人も、あとからコードを入れられる */}
                        {data.canEnter && (
                            <div className="inv-enter">
                                <p>招待された方は、ここに招待コードを</p>
                                <div className="inv-link">
                                    <input
                                        value={entry}
                                        onChange={(event) => setEntry(event.target.value)}
                                        placeholder="例：K7QX2M9A"
                                        aria-label="招待コード"
                                        maxLength={16}
                                    />
                                    <button type="button" onClick={() => void enterCode()} disabled={entryBusy || !entry.trim()}>
                                        入れる
                                    </button>
                                </div>
                                {entryMsg && <p className="inv-enter-msg">{entryMsg}</p>}
                            </div>
                        )}

                        <p className="inv-small">
                            ・はじめて登録した方だけが対象です（登録から 14 日以内。自分の招待は使えません）
                            <br />
                            ・ポイントは、招待された方がどれか 1 話を読んだとき（10 秒以上・3 割以上読み進めたとき）に届きます
                            <br />
                            ・同じ端末で作った別のアカウントどうしでは届きません
                            <br />
                            ・キャンペーンの内容は、予告なく変わることがあります
                        </p>

                        <button type="button" className="lpop-close" onClick={() => setIsOpen(false)}>
                            とじる
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
