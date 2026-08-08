/**
 * ============================================================
 * 原石航路 Studio
 * RoomProfileCard — 部屋主
 *
 * 誰の部屋なのかを最初に出す。
 * 執筆室は「誰かと一緒に書く場所」なので、
 * 入ってすぐ分かるべきなのは、そこに誰がいるか。
 * ============================================================
 */

"use client";

import Link from "next/link";

import type { Profile, WritingRoom } from "@/types";

interface Props {
    room: WritingRoom;
    profile: Profile | null;
    /** 自分の部屋か */
    isOwner: boolean;
}

export default function RoomProfileCard({ room, profile, isOwner }: Props) {
    return (
        <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
                <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
                    style={{
                        background: `hsl(${profile?.avatar_hue ?? 205} 38% 90%)`,
                        color: `hsl(${profile?.avatar_hue ?? 205} 48% 28%)`,
                    }}
                >
                    {Array.from(profile?.display_name ?? "？")[0]}
                </span>

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[15px] font-semibold leading-snug text-ink">
                        {room.name || "名前のない部屋"}
                    </h1>
                    <p className="mt-1 truncate text-xs text-muted">
                        {profile?.display_name ?? "名無しの書き手"}
                        {isOwner && <span className="ml-1 text-faint">（自分）</span>}
                    </p>

                    {/* 作風の目印。画像と同じく名前の下に並べる */}
                    {profile?.bio && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                            {profile.bio}
                        </p>
                    )}
                </div>
            </div>

            {room.description && (
                <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[11px] leading-relaxed text-muted">
                    {room.description}
                </p>
            )}

            {/* 部屋の決まり。入る前に分かるようにしておく */}
            <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-[var(--color-line)]">
                {[
                    { label: "上限", value: `${room.capacity}人` },
                    { label: "発言", value: room.allow_chat ? "許可制" : "不可" },
                    { label: "スタンプ", value: room.allow_stamps ? "可" : "不可" },
                ].map((row) => (
                    <div key={row.label} className="bg-surface px-2 py-1.5 text-center">
                        <dt className="text-[10px] text-faint">{row.label}</dt>
                        <dd className="mt-0.5 text-[11px] font-medium text-ink">
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <Link
                href="/mypage"
                className="mt-3 block rounded-lg border border-line py-2 text-center text-xs text-muted hover:border-forest-line hover:text-forest"
            >
                プロフィールを見る
            </Link>
        </section>
    );
}
