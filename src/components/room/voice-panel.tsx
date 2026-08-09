/**
 * ============================================================
 * 原石航路 Studio
 * VoicePanel — 声
 *
 * 話せるのは、部屋主と許された人だけ。
 * それ以外の人には、誰が話しているかだけを見せる。
 *
 * 中継のサーバーを使わないので、話す人は 4 人まで。
 * 増やすと繋ぎが急に増え、回線が持たない。
 * ============================================================
 */

"use client";

import AvatarSprite from "@/components/room/avatar-sprite";
import { MAX_SPEAKERS } from "@/lib/room/voice";
import type { VoiceMember } from "@/lib/room/voice";
import type { RoomMember } from "@/types";

interface Props {
    /** 声をつなげる状態か。繋がっていなければ false */
    canUseVoice: boolean;
    /** 自分が話してよいか */
    canSpeak: boolean;
    isMicOn: boolean;
    error: string;
    voiceMembers: VoiceMember[];
    members: RoomMember[];
    selfId: string;
    onToggle: () => void;
}

export default function VoicePanel({
    canUseVoice,
    canSpeak,
    isMicOn,
    error,
    voiceMembers,
    members,
    selfId,
    onToggle,
}: Props) {
    const connected = voiceMembers.filter((row) => row.isConnected);
    const isSelfSpeaking = voiceMembers.some(
        (row) => row.id === selfId && row.isSpeaking,
    );
    const isFull = !isMicOn && connected.length >= MAX_SPEAKERS;

    /** 声の相手を、部屋にいる人と突き合わせる */
    function nameOf(id: string): RoomMember | undefined {
        return members.find((row) => row.id === id);
    }

    return (
        <section className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-ink">声</h2>
                <span className="text-[10px] text-faint">
                    {connected.length} / {MAX_SPEAKERS}人
                </span>
            </div>

            {/* 話している人 */}
            {connected.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-faint">
                    まだ誰も話していません。
                </p>
            ) : (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                    {connected.map((voice) => {
                        const member = nameOf(voice.id);
                        const isSelf = voice.id === selfId;

                        return (
                            <li
                                key={voice.id}
                                className="flex flex-col items-center"
                                style={{ width: 52 }}
                            >
                                <span
                                    className="relative flex h-12 w-full items-end justify-center overflow-hidden rounded-lg bg-canvas transition-shadow"
                                    style={{
                                        /*
                                         * 話しているあいだ、縁を光らせる。
                                         * 誰の声か分からないと、会話が追えない。
                                         */
                                        boxShadow: voice.isSpeaking
                                            ? "0 0 0 2px var(--color-forest)"
                                            : "none",
                                    }}
                                >
                                    <AvatarSprite
                                        seed={
                                            member?.avatar_seed ??
                                            member?.display_name ??
                                            voice.id
                                        }
                                        size={26}
                                    />
                                </span>

                                <span className="mt-1 w-full truncate text-center text-[10px] leading-tight text-ink">
                                    {isSelf
                                        ? "自分"
                                        : (member?.display_name ?? "誰か")}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {error && (
                <p className="mt-2 rounded-md bg-[var(--color-danger-tint)] px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--color-danger)]">
                    {error}
                </p>
            )}

            {/* 操作 */}
            {!canUseVoice ? (
                <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-[10px] leading-relaxed text-faint">
                    声をつなぐには、ほかの端末とつながっている必要があります。
                </p>
            ) : !canSpeak ? (
                <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-[10px] leading-relaxed text-faint">
                    話せるのは部屋主と、許された人だけです。
                    聞くことはできます。
                </p>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onToggle}
                        disabled={isFull}
                        className={[
                            "mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium transition-all disabled:opacity-40",
                            isMicOn
                                ? "bg-forest text-white hover:bg-forest-dark"
                                : "border border-line text-ink hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                        style={
                            isSelfSpeaking
                                ? { boxShadow: "0 0 0 3px rgba(31,78,107,0.3)" }
                                : undefined
                        }
                    >
                        <MicIcon isOn={isMicOn} level={isSelfSpeaking} />
                        {isMicOn ? "マイクを切る" : "マイクを入れる"}
                    </button>

                    {isFull && (
                        <p className="mt-1.5 text-center text-[10px] text-faint">
                            いま {MAX_SPEAKERS} 人が話しています。
                            誰かが切るまで待ってください。
                        </p>
                    )}
                </>
            )}
        </section>
    );
}

function MicIcon({ isOn, level = false }: { isOn: boolean; level?: boolean }) {
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

            {level && (
                <>
                    <path d="M2.5 9.5v5" />
                    <path d="M21.5 9.5v5" />
                </>
            )}
        </svg>
    );
}
