/**
 * ============================================================
 * 原石航路 Studio
 * RoomPresenceBar — 入室中の帯（全ページ共通）
 *
 * 部屋を離れて資料や執筆の画面へ移っても、まだ部屋にいる。
 * それが見えていないと、一緒に書いている前提が切れる。
 *
 * ただし部屋の画面そのものでは出さない。
 * 部屋の名前も、在室者も、マイクも、退室も、
 * すぐ下の画面に同じものが並んでいる。
 * 同じ操作が上下に 2 つあると、どちらが効くのか迷う。
 *
 * サイトを閉じたら退室する。
 * localStorage ではなく sessionStorage に持つのは、
 * 「閉じたら消える」を保存の仕組みに任せるため。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import AvatarSprite from "@/components/room/avatar-sprite";
import { assignColors } from "@/lib/room/avatar-colors";
import { useRoomSession } from "@/hooks/use-room-session";
import { getRepository } from "@/lib/repository";
import { createPresence, loadIdentity } from "@/lib/room/presence";
import type { RoomState } from "@/lib/room/presence";
import type { WritingRoom } from "@/types";

export default function RoomPresenceBar() {
    const pathname = usePathname();
    const { session, leave, toggleMic } = useRoomSession();

    const [room, setRoom] = useState<WritingRoom | null>(null);
    const [state, setState] = useState<RoomState>({ members: [], messages: [], isClosed: false });

    const roomId = session?.roomId ?? null;

    // 部屋の中身を読む
    useEffect(() => {
        if (!roomId) {
            setRoom(null);
            return;
        }
        void (async () => {
            setRoom(await getRepository().getRoom(roomId));
        })();
    }, [roomId]);

    /*
     * 在室者を見張る。
     * 部屋の画面と同じ経路を使うので、人数はどこで見ても揃う。
     */
    useEffect(() => {
        if (!roomId) return;
        const presence = createPresence(roomId);
        const unsubscribe = presence.subscribe(setState);
        return () => {
            unsubscribe();
            presence.dispose();
        };
    }, [roomId]);

    if (!session || !room) return null;

    /* いまその部屋の画面にいるなら、帯は要らない */
    if (pathname === `/rooms/${room.id}`) return null;

    const identity = loadIdentity();
    const colors = assignColors(state.members);
    const writing = state.members.filter((row) => row.status === "writing").length;

    return (
        <div className="sticky top-20 z-20 border-b border-forest-line/70 bg-[#eef3ec]/85 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-8 py-2 sm:px-12">
                {/* どこにいるか */}
                <Link
                    href={`/rooms/${room.id}`}
                    className="group flex min-w-0 items-center gap-2.5"
                >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-forest ring-2 ring-[#eef3ec]" />
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-ink group-hover:text-forest">
                            {room.name || "名前のない部屋"}
                        </span>
                        <span className="block text-[10px] leading-tight text-muted">
                            入室中
                        </span>
                    </span>
                </Link>

                <span className="h-6 w-px bg-forest-line/60" />

                {/* 誰がいるか */}
                <span className="flex min-w-0 items-center gap-2">
                    <span className="flex -space-x-1.5">
                        {state.members.slice(0, 6).map((member) => (
                            <span
                                key={member.id}
                                title={member.display_name}
                                className="relative block h-7 w-7 overflow-hidden rounded-full bg-surface ring-2 ring-[#eef3ec]"
                            >
                                <span className="absolute left-1/2 top-0.5 block -translate-x-1/2 scale-[0.66] origin-top">
                                    <AvatarSprite
                                        seed={member.avatar_seed || member.display_name}
                                        colorId={colors.get(member.id)}
                                        size={28}
                                        isWriting={member.status === "writing"}
                                    />
                                </span>
                            </span>
                        ))}
                    </span>

                    {state.members.length > 6 && (
                        <span className="text-[11px] text-muted">
                            ＋{state.members.length - 6}
                        </span>
                    )}

                    <span className="whitespace-nowrap text-[11px] text-muted">
                        <span className="font-medium text-ink">{state.members.length}</span>
                        人
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
                        onClick={toggleMic}
                        aria-pressed={session.isMicOn}
                        aria-label={`マイク${session.isMicOn ? "オン" : "オフ"}`}
                        className={[
                            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                            session.isMicOn
                                ? "border-forest bg-forest text-white"
                                : "border-forest-line bg-surface text-faint hover:text-ink",
                        ].join(" ")}
                    >
                        <MicIcon isOn={session.isMicOn} />
                    </button>

                    <Link
                        href={`/rooms/${room.id}`}
                        className="rounded-full border border-forest-line bg-surface px-3.5 py-1.5 text-[11px] font-medium text-forest hover:bg-forest-tint"
                    >
                        部屋を見る
                    </Link>

                    <button
                        type="button"
                        onClick={leave}
                        className="rounded-full px-3 py-1.5 text-[11px] text-faint hover:bg-surface hover:text-ink"
                    >
                        退室
                    </button>

                    {identity && (
                        <span className="sr-only">{identity.name}として入室中</span>
                    )}
                </span>
            </div>
        </div>
    );
}

function MicIcon({ isOn }: { isOn: boolean }) {
    return (
        <svg
            width="14"
            height="14"
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
            {!isOn && <path d="M4 4l16 16" />}
        </svg>
    );
}
