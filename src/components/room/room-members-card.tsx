/**
 * ============================================================
 * 原石航路 Studio
 * RoomMembersCard — この部屋にいる人
 *
 * 縦に 1 人ずつ並べる。
 *
 * 格子に並べると顔は多く載るが、名前が入らない。
 * 部屋の中で「誰がいま書いているか」を知りたいのだから、
 * 名前と状態が読めることを優先する。
 *
 * 自分は先頭に固定する。
 * 探す対象ではなく、目印として置いておくもの。
 * ============================================================
 */

"use client";

import Link from "next/link";

import { useState } from "react";

import AvatarSprite from "@/components/room/avatar-sprite";
import { assignColors } from "@/lib/room/avatar-colors";
import type { MemberStatus, RoomMember } from "@/types";
import { MEMBER_STATUS_LABEL } from "@/types";

/** 何人までそのまま出すか。これを超えたら畳む */
const SHOWN_MAX = 8;

/**
 * 状態の色。
 *
 * 書いている人だけがはっきり分かればよいので、
 * 執筆中を主色、ほかは弱い色にしてある。
 */
const STATUS_TONE: Record<MemberStatus, string> = {
    writing: "var(--color-forest)",
    break: "var(--color-amber)",
    thinking: "var(--color-muted)",
    away: "var(--color-faint)",
};

interface Props {
    members: RoomMember[];
    selfId: string;
}

export default function RoomMembersCard({ members, selfId }: Props) {
    const [isOpen, setIsOpen] = useState(false);

    /* 床と同じ配り方にする。一覧と部屋で色が違うと探せない */
    const colors = assignColors(members);

    /* 自分を先頭へ。並びは入った順のまま */
    const sorted = [...members].sort((a, b) => {
        if (a.id === selfId) return -1;
        if (b.id === selfId) return 1;
        return 0;
    });
    const shown = isOpen ? sorted : sorted.slice(0, SHOWN_MAX);

    return (
        <section className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-ink">この部屋にいる人</h2>
                <span className="text-[12px] text-muted">
                    <span className="font-medium text-ink">{members.length}</span>人
                </span>
            </div>

            {members.length === 0 ? (
                <p className="mt-3 text-[11px] text-faint">まだ誰もいません。</p>
            ) : (
                <ul className="mt-2.5 space-y-0.5">
                    {shown.map((member) => {
                        const isSelf = member.id === selfId;
                        const tone = STATUS_TONE[member.status] ?? STATUS_TONE.thinking;

                        return (
                            <li
                                key={member.id}
                                className={[
                                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
                                    isSelf ? "bg-canvas" : "",
                                ].join(" ")}
                            >
                                {/*
                                 * 顔。
                                 * 部屋の中に立っている姿と同じ絵にする。
                                 * 別の絵にすると、一覧の誰が床のどれか分からない。
                                 */}
                                <span
                                    className="flex h-9 w-9 shrink-0 items-end justify-center overflow-hidden rounded-full"
                                    style={{ background: "var(--color-canvas)" }}
                                >
                                    <AvatarSprite
                                        seed={member.avatar_seed || member.display_name}
                                colorId={colors.get(member.id)}
                                        size={26}
                                        isWriting={member.status === "writing"}
                                    />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] text-ink">
                                        {member.display_name}
                                        {isSelf && (
                                            <span className="ml-1 text-[11px] text-muted">
                                                （あなた）
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-1.5">
                                        <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ background: tone }}
                                        />
                                        <span
                                            className="text-[11px]"
                                            style={{ color: tone }}
                                        >
                                            {MEMBER_STATUS_LABEL[member.status]}
                                        </span>
                                        {member.written_chars > 0 && (
                                            <span className="text-[11px] tabular-nums text-faint">
                                                {member.written_chars.toLocaleString("ja-JP")}字
                                            </span>
                                        )}
                                    </span>
                                </span>

                                {/*
                                 * その人の作品へ。
                                 *
                                 * 隣で書いている人が何を書いているのか、
                                 * 気になっても訊きにくい。
                                 * 押せば読みに行ける。
                                 *
                                 * 自分のぶんは出さない。執筆から見られる。
                                 */}
                                {!isSelf && (
                                    <Link
                                        href={`/author/${member.id}`}
                                        title={`${member.display_name}さんの作品`}
                                        className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        作品
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {members.length > SHOWN_MAX && (
                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    className="mt-2.5 w-full rounded-lg border border-line py-2 text-[12px] text-muted hover:border-forest-line hover:text-forest"
                >
                    {isOpen
                        ? "たたむ"
                        : `のこり${members.length - SHOWN_MAX}人を見る`}
                </button>
            )}
        </section>
    );
}
