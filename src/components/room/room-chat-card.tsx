/**
 * ============================================================
 * 原石航路 Studio
 * RoomChatCard — チャット
 *
 * 発言できるのは、部屋を立てた人と、その人が許した人だけ。
 * 誰でも喋れると、書く場所として成り立たなくなる。
 *
 * 許されていない人にも読めるようにはしておく。
 * 何が起きているか分からない場所には居づらい。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { STAMPS } from "@/lib/room/stamps";
import type { RoomMessage } from "@/types";

interface Props {
    messages: RoomMessage[];
    selfId: string;
    /** 文字で発言できるか */
    canSpeak: boolean;
    /** スタンプを送れるか */
    canStamp: boolean;
    onSendText: (body: string) => void;
    onSendStamp: (stampId: string) => void;
    /** 発言を通報する。自分の発言には出さない */
    onReport?: (message: RoomMessage) => void;
}

export default function RoomChatCard({
    onReport,
    messages,
    selfId,
    canSpeak,
    canStamp,
    onSendText,
    onSendStamp,
}: Props) {
    const [draft, setDraft] = useState("");
    const [isStampOpen, setIsStampOpen] = useState(false);
    const listRef = useRef<HTMLUListElement>(null);

    // 新しい発言が来たら下まで送る
    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages.length]);

    function send() {
        const body = draft.trim();
        if (!body) return;
        onSendText(body);
        setDraft("");
    }

    return (
        <section className="flex min-h-0 flex-col rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">
                チャット
            </h2>

            <ul
                ref={listRef}
                className="thin-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
            >
                {messages.length === 0 ? (
                    <li className="py-6 text-center text-[11px] text-faint">
                        まだ発言がありません。
                    </li>
                ) : (
                    messages.slice(-60).map((message) => (
                        <li key={message.id} className="flex gap-2">
                            <span
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                                style={{
                                    background: `hsl(${hashHue(message.member_name)} 42% 88%)`,
                                    color: `hsl(${hashHue(message.member_name)} 48% 26%)`,
                                }}
                            >
                                {Array.from(message.member_name)[0] ?? "？"}
                            </span>

                            <span className="group/message min-w-0 flex-1">
                                <span className="flex items-baseline gap-1.5">
                                    <span className="truncate text-[11px] font-medium text-ink">
                                        {message.member_name}
                                        {message.member_id === selfId && (
                                            <span className="text-faint">（自分）</span>
                                        )}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-faint">
                                        {formatTime(message.created_at)}
                                    </span>

                                    {/*
                                     * 通報。
                                     * 触れたときだけ出す。常に並べると、
                                     * 会話のたびに「通報」の字が目に入る。
                                     */}
                                    {onReport &&
                                        message.member_id !== selfId &&
                                        message.kind !== "stamp" && (
                                            <button
                                                type="button"
                                                onClick={() => onReport(message)}
                                                aria-label="この発言を通報する"
                                                title="この発言を通報する"
                                                className="ml-auto shrink-0 text-[10px] text-faint opacity-0 transition-opacity hover:text-[var(--color-danger)] focus-visible:opacity-100 group-hover/message:opacity-100"
                                            >
                                                通報
                                            </button>
                                        )}
                                </span>

                                {/*
                                 * 発言は吹き出しに入れる。
                                 * 名前の下に地の文で置くと、
                                 * 誰の言葉がどこで切れるのか読み取りにくい。
                                 */}
                                <span
                                    className={[
                                        "mt-1 inline-block max-w-full rounded-lg px-3 py-1.5 text-[11px] leading-relaxed",
                                        message.member_id === selfId
                                            ? "bg-forest-tint text-ink"
                                            : "bg-canvas text-ink",
                                    ].join(" ")}
                                >
                                    {message.kind === "stamp"
                                        ? (STAMPS.find((row) => row.id === message.body)
                                              ?.label ?? message.body)
                                        : message.body}
                                </span>
                            </span>
                        </li>
                    ))
                )}
            </ul>

            {/* 送る */}
            <div className="border-t border-line p-2.5">
                {isStampOpen && canStamp && (
                    <ul className="mb-2 flex flex-wrap gap-1">
                        {STAMPS.map((stamp) => (
                            <li key={stamp.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSendStamp(stamp.id);
                                        setIsStampOpen(false);
                                    }}
                                    className="rounded-full border border-line px-2.5 py-1 text-[11px] hover:border-forest-line"
                                    style={{ color: stamp.tone }}
                                >
                                    {stamp.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {canSpeak ? (
                    <div className="flex gap-1.5">
                        {canStamp && (
                            <button
                                type="button"
                                onClick={() => setIsStampOpen((open) => !open)}
                                aria-label="スタンプ"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:border-forest-line hover:text-forest"
                            >
                                <SmileIcon />
                            </button>
                        )}

                        <input
                            type="text"
                            value={draft}
                            maxLength={120}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                            placeholder="メッセージを入力…"
                            aria-label="メッセージ"
                            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3.5 py-2 text-[12px] outline-none focus:border-forest focus:bg-surface"
                        />

                        <button
                            type="button"
                            onClick={send}
                            disabled={draft.trim().length === 0}
                            aria-label="送る"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-dark text-white hover:opacity-90 disabled:opacity-40"
                        >
                            <SendIcon />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-1.5">
                        {canStamp && (
                            <button
                                type="button"
                                onClick={() => setIsStampOpen((open) => !open)}
                                className="flex-1 rounded-md border border-line py-1.5 text-xs text-muted hover:border-forest-line hover:text-forest"
                            >
                                スタンプを送る
                            </button>
                        )}
                        <p className="flex-1 rounded-md bg-canvas px-3 py-1.5 text-center text-[11px] text-faint">
                            発言は部屋主の許可制です
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function SendIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20.5 3.5 10.5 13.5" />
            <path d="M20.5 3.5 14 20.5l-3.5-7-7-3.5Z" />
        </svg>
    );
}

function SmileIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 14c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
            <path d="M9 9.5v.4M15 9.5v.4" />
        </svg>
    );
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function hashHue(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(hash) % 360;
}
