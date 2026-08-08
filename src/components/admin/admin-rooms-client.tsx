/**
 * ============================================================
 * 原石航路 Studio
 * AdminRoomsClient — 公式の部屋
 *
 * 誰でも入れる執筆室を、運営が用意する。
 *
 * 書き手も「オープン」な部屋は立てられるが、
 * 「公式」の印が付くのは運営が立てたものだけ。
 * 誰でも名乗れると、目印の意味が無くなる。
 *
 * ------------------------------------------------------------
 * 決められること
 *
 * 書き手向けの作成画面（/rooms/new）と同じだけ決められるようにした。
 * 運営だけ設定が少ないと、立てたあとに
 * 「発言を止めた部屋にしたい」となっても直せない。
 *
 * 内装（図書館・喫茶店・書斎）の選択は外した。
 * 部屋の見た目は入室できる人数で決まるようになったので、
 * 選んでも何も変わらない。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import { backgroundFor } from "@/lib/room/room-backgrounds";
import type { WritingRoom } from "@/types";

const NAME_MAX = 20;
const DESC_MAX = 100;
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 50;

export default function AdminRoomsClient() {
    const [rooms, setRooms] = useState<WritingRoom[] | null>(null);
    const [editing, setEditing] = useState<WritingRoom | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [capacity, setCapacity] = useState(20);
    const [allowChat, setAllowChat] = useState(true);
    const [allowStamps, setAllowStamps] = useState(true);
    const [allowVoice, setAllowVoice] = useState(false);
    const [limitCount, setLimitCount] = useState(10);
    const [limitMinutes, setLimitMinutes] = useState(10);

    const reload = useCallback(async () => {
        const all = await getRepository().listRooms();
        setRooms(all.filter((room) => room.is_official));
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    function clearForm() {
        setEditing(null);
        setName("");
        setDescription("");
        setCapacity(20);
        setAllowChat(true);
        setAllowStamps(true);
        setAllowVoice(false);
        setLimitCount(10);
        setLimitMinutes(10);
    }

    /** 直す部屋を読み込む。立てるのと同じ欄を使い回す */
    function startEdit(room: WritingRoom) {
        setEditing(room);
        setName(room.name);
        setDescription(room.description ?? "");
        setCapacity(room.capacity);
        setAllowChat(room.allow_chat);
        setAllowStamps(room.allow_stamps);
        setAllowVoice(room.allow_host_voice);
        setLimitCount(room.chat_limit_count);
        setLimitMinutes(room.chat_limit_minutes);
    }

    async function save() {
        if (!name.trim()) return;

        const patch = {
            name: name.trim(),
            description: description.trim(),
            capacity,
            allow_chat: allowChat,
            allow_stamps: allowStamps,
            allow_host_voice: allowVoice,
            chat_limit_count: limitCount,
            chat_limit_minutes: limitMinutes,
        };

        if (editing) {
            await getRepository().updateRoom(editing.id, patch);
        } else {
            await getRepository().createRoom({
                ...patch,
                visibility: "open",
                is_official: true,
                /*
                 * 公式の部屋に立てた個人はいない。
                 * host_id を入れると、その人にだけ設定が出てしまう。
                 */
                host_id: null,
            });
        }

        clearForm();
        await reload();
    }

    const background = backgroundFor(capacity);

    return (
        <AdminShell
            title="公式の部屋"
            description="誰でも入れる執筆室。運営だけが立てられます。"
        >
            <div className="rounded-xl border border-line bg-surface px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[13px] font-semibold text-ink">
                        {editing ? `「${editing.name}」を直す` : "部屋を立てる"}
                    </h2>
                    {editing && (
                        <button
                            type="button"
                            onClick={clearForm}
                            className="text-[11px] text-muted hover:text-ink"
                        >
                            やめて新しく立てる
                        </button>
                    )}
                </div>

                {/* 名前と説明 */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-medium text-ink">
                            部屋の名前
                            <span className="ml-1.5 font-normal text-faint">
                                {name.length} / {NAME_MAX}
                            </span>
                        </span>
                        <input
                            type="text"
                            value={name}
                            maxLength={NAME_MAX}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="静かな図書室"
                            className={inputClass}
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-medium text-ink">
                            説明
                            <span className="ml-1.5 font-normal text-faint">
                                {description.length} / {DESC_MAX}
                            </span>
                        </span>
                        <input
                            type="text"
                            value={description}
                            maxLength={DESC_MAX}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="ひとことで"
                            className={inputClass}
                        />
                    </label>
                </div>

                {/* 人数と、それで決まる部屋 */}
                <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
                    <label className="block">
                        <span className="text-xs font-medium text-ink">最大入室人数</span>
                        <input
                            type="number"
                            min={CAPACITY_MIN}
                            max={CAPACITY_MAX}
                            value={capacity}
                            onChange={(e) =>
                                setCapacity(
                                    Math.min(
                                        CAPACITY_MAX,
                                        Math.max(CAPACITY_MIN, Number(e.target.value) || 1),
                                    ),
                                )
                            }
                            className={`${inputClass} w-28 tabular-nums`}
                        />
                    </label>

                    {/*
                     * 人数で部屋の間取りが決まる。
                     * 立ててから「思っていた広さと違う」となると、
                     * 中の人を追い出して立て直すことになる。
                     */}
                    <div className="flex items-center gap-2.5 rounded-lg bg-canvas px-3 py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={background.src}
                            alt=""
                            className="h-11 w-16 rounded object-cover"
                            style={{ objectPosition: "center 38%" }}
                        />
                        <span className="text-[11px] leading-relaxed text-muted">
                            この人数だと
                            <span className="text-ink">「{background.label}」</span>
                            の間取りになります
                            <br />
                            （{background.seats.length}席）
                        </span>
                    </div>
                </div>

                {/* 発言 */}
                <div className="mt-4 border-t border-line pt-4">
                    <p className="text-xs font-medium text-ink">発言</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                        <Toggle
                            label="文字で話せる"
                            checked={allowChat}
                            onChange={setAllowChat}
                        />
                        <Toggle
                            label="スタンプを使える"
                            checked={allowStamps}
                            onChange={setAllowStamps}
                        />
                        <Toggle
                            label="部屋主のマイク（準備中）"
                            checked={allowVoice}
                            onChange={setAllowVoice}
                        />
                    </div>

                    {allowChat && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                            <input
                                type="number"
                                min={1}
                                max={60}
                                value={limitMinutes}
                                onChange={(e) =>
                                    setLimitMinutes(Number(e.target.value) || 1)
                                }
                                aria-label="発言回数を数える時間（分）"
                                className="w-16 rounded-md border border-line px-2 py-1 text-center tabular-nums outline-none focus:border-forest"
                            />
                            分あたり
                            <input
                                type="number"
                                min={1}
                                max={99}
                                value={limitCount}
                                onChange={(e) =>
                                    setLimitCount(Number(e.target.value) || 1)
                                }
                                aria-label="発言できる回数"
                                className="w-16 rounded-md border border-line px-2 py-1 text-center tabular-nums outline-none focus:border-forest"
                            />
                            回まで
                            <span className="text-faint">
                                （スタンプは数えません）
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-end border-t border-line pt-3">
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={name.trim().length === 0}
                        className="rounded-full bg-forest-dark px-6 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                        {editing ? "この内容で直す" : "立てる"}
                    </button>
                </div>
            </div>

            {/* 一覧 */}
            {rooms === null ? (
                <p className="py-16 text-center text-sm text-faint">読み込んでいます</p>
            ) : rooms.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line py-16 text-center text-sm text-faint">
                    まだ公式の部屋がありません。
                </p>
            ) : (
                <ul className="mt-4 space-y-1.5">
                    {rooms.map((room) => (
                        <li
                            key={room.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                        >
                            <span className="rounded-full bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                                公式
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-ink">
                                    {room.name}
                                </p>
                                <p className="mt-0.5 truncate text-[10px] text-faint">
                                    {backgroundFor(room.capacity).label}　上限
                                    {room.capacity}人　
                                    {room.allow_chat ? "文字で話せる" : "スタンプのみ"}
                                    {room.description && `　${room.description}`}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => startEdit(room)}
                                className="shrink-0 rounded-md border border-line px-3 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                            >
                                直す
                            </button>

                            <Link
                                href={`/rooms/${room.id}`}
                                className="shrink-0 rounded-md border border-line px-3 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                            >
                                開く
                            </Link>

                            <button
                                type="button"
                                onClick={async () => {
                                    await getRepository().deleteRoom(room.id);
                                    if (editing?.id === room.id) clearForm();
                                    await reload();
                                }}
                                className="shrink-0 px-2 text-[11px] text-faint hover:text-[var(--color-danger)]"
                            >
                                閉じる
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </AdminShell>
    );
}

/** 入り切りの札。数が少ないので、切り替えではなく押した状態で示す */
function Toggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            className={[
                "rounded-full border px-3.5 py-1.5 text-[11px]",
                checked
                    ? "border-forest bg-forest-tint text-forest"
                    : "border-line text-muted hover:text-ink",
            ].join(" ")}
        >
            {label}
        </button>
    );
}

const inputClass =
    "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest";
