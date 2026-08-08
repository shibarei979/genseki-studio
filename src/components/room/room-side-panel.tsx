/**
 * ============================================================
 * 原石航路 Studio
 * RoomSidePanel — スタンプと発言
 *
 * 文字の発言は回数を絞る。
 * 制限がないと雑談の場になり、書く手が止まる。
 * 「言いたいことはあるが、何度も言えるわけではない」くらいが、
 * 書く場所としてはちょうどよい。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import { findStamp, STAMP_GROUP_LABEL, STAMPS } from "@/lib/room/stamps";
import type { StampGroup } from "@/lib/room/stamps";
import { formatTime } from "@/lib/utils/text";
import type { RoomMessage, WritingRoom } from "@/types";

interface Props {
    room: WritingRoom;
    messages: RoomMessage[];
    selfId: string;
    onSendStamp: (stampId: string) => void;
    onSendText: (text: string) => void;
}

export default function RoomSidePanel({
    room,
    messages,
    selfId,
    onSendStamp,
    onSendText,
}: Props) {
    const [group, setGroup] = useState<StampGroup>("room");
    const [text, setText] = useState("");

    /** 制限のうち、いま何回残っているか */
    const remaining = useMemo(() => {
        const since = Date.now() - room.chat_limit_minutes * 60 * 1000;
        const used = messages.filter(
            (message) =>
                message.member_id === selfId &&
                message.kind === "text" &&
                new Date(message.created_at).getTime() >= since,
        ).length;
        return Math.max(0, room.chat_limit_count - used);
    }, [messages, selfId, room.chat_limit_count, room.chat_limit_minutes]);

    const shown = STAMPS.filter((stamp) => stamp.group === group);

    function handleSend() {
        const value = text.trim();
        if (!value || remaining === 0) return;
        onSendText(value.slice(0, 60));
        setText("");
    }

    return (
        <div className="flex h-full flex-col gap-3">
            {/* スタンプ */}
            {room.allow_stamps && (
                <div className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted">スタンプ</p>
                        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                            {(Object.keys(STAMP_GROUP_LABEL) as StampGroup[]).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setGroup(key)}
                                    aria-pressed={group === key}
                                    className={[
                                        "rounded px-2 py-0.5 text-[10px]",
                                        group === key
                                            ? "bg-forest text-white"
                                            : "text-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    {STAMP_GROUP_LABEL[key]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ul className="mt-2 grid grid-cols-2 gap-1.5">
                        {shown.map((stamp) => (
                            <li key={stamp.id}>
                                <button
                                    type="button"
                                    onClick={() => onSendStamp(stamp.id)}
                                    className="flex w-full items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-left text-[11px] hover:border-forest-line hover:bg-canvas"
                                >
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ background: stamp.tone }}
                                    />
                                    <span className="min-w-0 truncate text-ink">
                                        {stamp.label}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-[10px] text-faint">
                        スタンプは何度でも押せます。
                    </p>
                </div>
            )}

            {/* 発言 */}
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <p className="text-xs text-muted">やりとり</p>
                    {room.allow_chat && (
                        <p className="text-[10px] text-faint">
                            残り{remaining}回 / {room.chat_limit_minutes}分
                        </p>
                    )}
                </div>

                <ul className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
                    {messages.length === 0 ? (
                        <li className="py-6 text-center text-[11px] text-faint">
                            まだ何もありません。
                        </li>
                    ) : (
                        messages
                            .slice()
                            .reverse()
                            .map((message) => {
                                const stamp =
                                    message.kind === "stamp" ? findStamp(message.body) : undefined;
                                return (
                                    <li key={message.id} className="text-[11px]">
                                        <span className="text-faint">
                                            {formatTime(message.created_at)}
                                        </span>
                                        <span className="ml-1.5 text-muted">
                                            {message.member_name}
                                        </span>
                                        <span
                                            className="ml-1.5"
                                            style={{ color: stamp?.tone ?? "var(--color-ink)" }}
                                        >
                                            {stamp ? stamp.label : message.body}
                                        </span>
                                    </li>
                                );
                            })
                    )}
                </ul>

                {room.allow_chat ? (
                    <div className="border-t border-line p-2">
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={text}
                                maxLength={60}
                                disabled={remaining === 0}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={
                                    remaining === 0 ? "いまは送れません" : "ひとこと（60字まで）"
                                }
                                aria-label="ひとこと"
                                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-xs outline-none focus:border-forest disabled:bg-canvas"
                            />
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={remaining === 0 || text.trim().length === 0}
                                className="rounded-md bg-forest px-3 py-1.5 text-xs text-white hover:bg-forest-dark disabled:opacity-40"
                            >
                                送る
                            </button>
                        </div>
                        {remaining === 0 && (
                            <p className="mt-1 text-[10px] text-faint">
                                しばらくするとまた送れます。スタンプは制限なしで押せます。
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="border-t border-line px-3 py-2 text-[10px] text-faint">
                        この部屋は文字での発言を止めています。
                    </p>
                )}
            </div>
        </div>
    );
}
