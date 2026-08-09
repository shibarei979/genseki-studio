/**
 * ============================================================
 * 原石航路 Studio
 * RoomManagePanel — 部屋の管理
 *
 * 部屋を立てた人だけが開ける。
 *
 * 部屋には管理する人が要る、という前提で作っている。
 * 名前を変える、公開の範囲を決める、発言を許す、入れない人を決める、
 * そして部屋を閉じる。ここが無いと、立てたあと何もできない。
 * ============================================================
 */

"use client";

import { useState } from "react";

import AvatarSprite from "@/components/room/avatar-sprite";
import type { RoomMember, RoomVisibility, WritingRoom } from "@/types";
import {
    ROOM_VISIBILITY_DESCRIPTION,
    ROOM_VISIBILITY_LABEL,
    SELECTABLE_VISIBILITY,
} from "@/types";

interface Props {
    room: WritingRoom;
    members: RoomMember[];
    onChange: (patch: Partial<WritingRoom>) => void;
    onClose: () => void;
    onBack: () => void;
}

export default function RoomManagePanel({
    room,
    members,
    onChange,
    onClose,
    onBack,
}: Props) {
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(room.name);
    const [description, setDescription] = useState(room.description);

    const speakers = room.speakers ?? [];
    const banned = room.banned ?? [];

    return (
        <div>
            <div className="mb-4 flex items-center gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
                >
                    ← 部屋へ戻る
                </button>
                <h1 className="text-base font-semibold text-ink">部屋の管理</h1>
            </div>

            {/*
             * 2 列に分ける。
             * 縦一列だと下へ長く伸び、後ろの項目に辿り着けない。
             * 左は部屋そのもの、右は人にまつわること。
             */}
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
            <div className="space-y-4">

            {/* 部屋の情報 */}
            <Section title="部屋の情報">
                <Labeled label="部屋の名前">
                    <input
                        type="text"
                        value={name}
                        maxLength={30}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => onChange({ name: name.trim() })}
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="説明">
                    <textarea
                        value={description}
                        rows={2}
                        maxLength={140}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => onChange({ description: description.trim() })}
                        placeholder="どんな部屋かを一言で"
                        className={inputClass}
                    />
                </Labeled>

                <Labeled label="入れる人数">
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={room.capacity}
                        onChange={(e) =>
                            onChange({
                                capacity: Math.min(
                                    100,
                                    Math.max(1, Number(e.target.value) || 1),
                                ),
                            })
                        }
                        className={`${inputClass} w-28`}
                    />
                </Labeled>
            </Section>

            {/* 公開の範囲 */}
            <Section title="公開の範囲">
                <ul className="space-y-1.5">
                    {SELECTABLE_VISIBILITY.map((key) => (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => onChange({ visibility: key })}
                                    aria-pressed={room.visibility === key}
                                    className={[
                                        "w-full rounded-lg border px-4 py-2.5 text-left",
                                        room.visibility === key
                                            ? "border-forest bg-forest-tint/50"
                                            : "border-line hover:border-forest-line",
                                    ].join(" ")}
                                >
                                    <span className="text-[13px] font-medium text-ink">
                                        {ROOM_VISIBILITY_LABEL[key]}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                        {ROOM_VISIBILITY_DESCRIPTION[key]}
                                    </span>
                                </button>
                            </li>
                    ))}
                </ul>
            </Section>
            </div>

            {/* ===== 右 ===== */}
            <div className="space-y-4">

            {/* 発言 */}
            <Section title="発言">
                <Toggle
                    label="文字での発言を許す"
                    note="切ると、スタンプだけになります。"
                    on={room.allow_chat}
                    onChange={(next) => onChange({ allow_chat: next })}
                />

                {/*
                 * 発言の回数。
                 * 文字を許しているときだけ意味があるので、そのときだけ出す。
                 */}
                {room.allow_chat && (
                    <div className="border-b border-line py-2.5">
                        <p className="text-[13px] text-ink">10分あたりの発言回数</p>
                        <p className="mt-0.5 text-[11px] text-faint">
                            書く手が止まらないよう、上限を決めておきます。
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {[5, 10, 20, 30, 0].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() =>
                                        onChange({ chat_limit_count: count })
                                    }
                                    aria-pressed={room.chat_limit_count === count}
                                    className={[
                                        "rounded-full border px-3.5 py-1 text-[11px]",
                                        room.chat_limit_count === count
                                            ? "border-forest bg-forest-tint text-forest"
                                            : "border-line text-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    {count === 0 ? "制限なし" : `${count}回`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/*
                 * スタンプは数を絞らない。
                 * ひとことの合図なので、書く手を止めるほどではない。
                 */}
                <Toggle
                    label="スタンプを使えるようにする"
                    note="回数の制限はありません。"
                    on={room.allow_stamps}
                    onChange={(next) => onChange({ allow_stamps: next })}
                />

                {/* マイク */}
                <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] text-ink">
                            部屋主のマイクを使う
                            <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-faint">
                                準備中
                            </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-faint">
                            声を流す仕組みは調整中です。設定だけ残せます。
                        </p>
                    </div>

                    <Toggle
                        on={room.allow_host_voice}
                        label="部屋主のマイクを使う"
                        onChange={(next) => onChange({ allow_host_voice: next })}
                    />
                </div>

                <p className="mt-3 mb-2 text-xs font-medium text-ink">
                    発言を許す人
                    <span className="ml-1.5 font-normal text-muted">
                        {speakers.length}人
                    </span>
                </p>

                {members.length === 0 ? (
                    <p className="text-[11px] text-faint">いま部屋に誰もいません。</p>
                ) : (
                    <ul className="thin-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
                        {members.map((member) => {
                            const canSpeak = speakers.includes(member.id);
                            const isBanned = banned.includes(member.id);

                            return (
                                <li
                                    key={member.id}
                                    className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-end justify-center overflow-hidden rounded-md bg-canvas">
                                        <AvatarSprite
                                            seed={member.avatar_seed || member.display_name}
                                            size={20}
                                        />
                                    </span>

                                    <span className="min-w-0 flex-1 truncate text-xs text-ink">
                                        {member.display_name}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                speakers: canSpeak
                                                    ? speakers.filter(
                                                          (id) => id !== member.id,
                                                      )
                                                    : [...speakers, member.id],
                                            })
                                        }
                                        className={[
                                            "shrink-0 rounded-md border px-2.5 py-1 text-[11px]",
                                            canSpeak
                                                ? "border-forest bg-forest text-white"
                                                : "border-line text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {canSpeak ? "発言できる" : "発言を許す"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                banned: isBanned
                                                    ? banned.filter(
                                                          (id) => id !== member.id,
                                                      )
                                                    : [...banned, member.id],
                                            })
                                        }
                                        className={[
                                            "shrink-0 rounded-md px-2.5 py-1 text-[11px]",
                                            isBanned
                                                ? "bg-[var(--color-danger)] text-white"
                                                : "text-faint hover:text-[var(--color-danger)]",
                                        ].join(" ")}
                                    >
                                        {isBanned ? "出入り禁止" : "禁止"}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            {/* 閉じる */}
            {isClosing ? (
                <section className="rounded-xl border border-[var(--color-danger)] bg-surface px-5 py-4">
                    <p className="text-sm text-ink">
                        「{room.name || "この部屋"}」を閉じますか
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                        家具も発言もすべて消えます。元に戻せません。
                    </p>

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsClosing(false)}
                            className="flex-1 rounded-lg border border-line py-2 text-xs text-muted hover:text-ink"
                        >
                            やめる
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-lg bg-[var(--color-danger)] py-2 text-xs font-medium text-white hover:opacity-90"
                        >
                            閉じる
                        </button>
                    </div>
                </section>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsClosing(true)}
                    className="w-full rounded-xl bg-[var(--color-danger)] py-3 text-sm font-medium text-white hover:opacity-90"
                >
                    この部屋を閉じる
                </button>
            )}
            </div>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

const inputClass =
    "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">{title}</h2>
            {children}
        </section>
    );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3 last:mb-0">
            <span className="text-xs font-medium text-ink">{label}</span>
            {children}
        </div>
    );
}

function Toggle({
    label,
    note,
    on,
    onChange,
}: {
    label: string;
    note?: string;
    on: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
            <div className="min-w-0">
                <p className="text-[13px] text-ink">{label}</p>
                {note && <p className="mt-0.5 text-[11px] text-faint">{note}</p>}
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                onClick={() => onChange(!on)}
                className={[
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    on ? "bg-forest" : "bg-[#d1d5db]",
                ].join(" ")}
            >
                <span
                    className={[
                        "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
                        on ? "left-[23px]" : "left-[3px]",
                    ].join(" ")}
                />
            </button>
        </div>
    );
}
