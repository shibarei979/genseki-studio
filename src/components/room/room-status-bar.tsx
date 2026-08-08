/**
 * ============================================================
 * 原石航路 Studio
 * RoomStatusBar — 在室中の帯
 *
 * ヘッダーのすぐ下に貼り付けておく。
 * どこの部屋にいて、誰がいて、声が入っているか。
 *
 * 部屋の画面から離れても付いてくる。
 * 執筆に移ったとき「まだ部屋にいる」ことが分からないと、
 * 一緒に書いている感覚が切れる。
 * ============================================================
 */

"use client";

import Link from "next/link";

import AvatarSprite from "@/components/room/avatar-sprite";
import type { RoomMember, WritingRoom } from "@/types";

interface Props {
    room: WritingRoom;
    members: RoomMember[];
    selfId: string;
    isMicOn: boolean;
    onToggleMic: () => void;
    onLeave: () => void;
    /** 部屋の画面から離れているとき、戻る道を出す */
    showBackLink?: boolean;
}

export default function RoomStatusBar({
    room,
    members,
    selfId,
    isMicOn,
    onToggleMic,
    onLeave,
    showBackLink = false,
}: Props) {
    const writing = members.filter((row) => row.status === "writing").length;

    return (
        <div className="sticky top-20 z-20 border-b border-forest-line/70 bg-[#eef3ec]/85 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-8 py-2 sm:px-12">
                {/* どこにいるか */}
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-forest ring-2 ring-[#eef3ec]" />
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-ink">
                            {room.name || "名前のない部屋"}
                        </span>
                        <span className="block text-[10px] leading-tight text-muted">
                            入室中
                        </span>
                    </span>
                </span>

                <span className="h-6 w-px bg-forest-line/60" />

                {/* 誰がいるか */}
                <span className="flex min-w-0 items-center gap-2">
                    <span className="flex -space-x-1.5">
                        {members.slice(0, 6).map((member) => (
                            <span
                                key={member.id}
                                title={member.display_name}
                                className="relative block h-7 w-7 overflow-hidden rounded-full bg-surface ring-2 ring-[#eef3ec]"
                            >
                                <span className="absolute left-1/2 top-0.5 block -translate-x-1/2 scale-[0.66] origin-top">
                                    <AvatarSprite
                                        seed={member.avatar_seed || member.display_name}
                                        size={28}
                                        isWriting={member.status === "writing"}
                                    />
                                </span>
                            </span>
                        ))}
                    </span>

                    {members.length > 6 && (
                        <span className="text-[11px] text-muted">
                            ＋{members.length - 6}
                        </span>
                    )}

                    <span className="whitespace-nowrap text-[11px] text-muted">
                        <span className="font-medium text-ink">{members.length}</span>人
                        {writing > 0 && (
                            <>
                                <span className="mx-1 text-faint">/</span>
                                <span className="font-medium text-forest">{writing}</span>
                                人が執筆中
                            </>
                        )}
                    </span>
                </span>

                {/* 操作 */}
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onToggleMic}
                        aria-pressed={isMicOn}
                        aria-label={`マイク${isMicOn ? "オン" : "オフ"}`}
                        className={[
                            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                            isMicOn
                                ? "border-forest bg-forest text-white"
                                : "border-forest-line bg-surface text-faint hover:text-ink",
                        ].join(" ")}
                    >
                        <MicIcon isOn={isMicOn} />
                    </button>

                    {showBackLink && (
                        <Link
                            href={`/rooms/${room.id}`}
                            className="rounded-full border border-forest-line bg-surface px-3.5 py-1.5 text-[11px] font-medium text-forest hover:bg-forest-tint"
                        >
                            部屋に戻る
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={onLeave}
                        className="rounded-full px-3 py-1.5 text-[11px] text-faint hover:bg-surface hover:text-ink"
                    >
                        退室
                    </button>
                </span>
            </div>
        </div>
    );
}

function MicIcon({ isOn }: { isOn: boolean }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="9" y="2.5" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            {/* 切っているときは斜線を引く */}
            {!isOn && <path d="M4 4l16 16" />}
        </svg>
    );
}
