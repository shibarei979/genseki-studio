/**
 * ============================================================
 * 原石航路 Studio
 * HomeRoomStrip — 執筆室に参加
 *
 * 左端に「自分の部屋を作る」を固定で置き、その右から
 * 運営や他の人の部屋が横に流れ出す形にした。
 *
 * 作る入口を一覧の中に混ぜると、部屋が増えたときに
 * 右へ押し出されて見えなくなる。作る側の入口は
 * 部屋の数に関係なく同じ場所にあってほしい。
 *
 * 絵は写真ではなく、内装の種類ごとの図案を置く。
 * 写真は 1 枚ごとに用意しなければならず、部屋が増えるたびに
 * 絵の手当てが要る。図案なら種類が決まれば自動で付いてくる。
 * 小さく並べたときも、写真より図案のほうが何の部屋か分かる。
 *
 * ホームの主役は「あなたの作品」なので、
 * 一段ぶんの高さに収まるところまで縦を詰めてある。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRef } from "react";

import { ROOM_THEME_LABEL } from "@/types";
import type { WritingRoom } from "@/types";

/** 札 1 枚の横幅。作る入口と部屋で揃える */
const CARD_WIDTH = 156;

/** 図案を置く帯の高さ */
const ART_HEIGHT = 62;

interface Props {
    rooms: WritingRoom[];
}

/**
 * 内装の種類ごとの地色。
 *
 * 図書館は古い革表紙、喫茶店は焙煎の色、書斎は苔と木。
 * どれも温かい側に寄せて、地の紙色と喧嘩しないようにしている。
 * 部屋ごとの写真が入ったら、この背景だけ差し替えれば済む。
 */
const THEME_ART: Record<WritingRoom["theme"], string> = {
    library: "linear-gradient(150deg, #6b4526, #2f2118)",
    cafe: "linear-gradient(150deg, #8a4d1c, #33200f)",
    study: "linear-gradient(150deg, #4e5233, #262a1a)",
};

export default function HomeRoomStrip({ rooms }: Props) {
    const trackRef = useRef<HTMLUListElement>(null);

    function scrollNext() {
        /* 2 枚ぶん送る。1 枚では動いた感じがしない */
        trackRef.current?.scrollBy({
            left: (CARD_WIDTH + 10) * 2,
            behavior: "smooth",
        });
    }

    return (
        <section className="rounded-xl border border-line bg-surface px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                    <h2 className="shrink-0 text-[15px] font-semibold tracking-wide text-ink">
                        執筆室に参加
                    </h2>
                    <p className="hidden truncate text-[11px] text-muted sm:block">
                        気分に合わせて、好きな場所で書こう。
                    </p>
                </div>

                <Link
                    href="/rooms"
                    className="shrink-0 text-[11px] text-muted hover:text-forest"
                >
                    すべての執筆室を見る <span aria-hidden="true">›</span>
                </Link>
            </div>

            <div className="mt-2.5 flex gap-2.5">
                {/* 作る入口。ここだけ位置が動かない */}
                <Link
                    href="/rooms/new"
                    style={{ width: CARD_WIDTH }}
                    className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-forest-dark px-3 py-3 text-center hover:opacity-95"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-4 ring-white/10">
                        <PlusIcon />
                    </span>
                    <span className="text-[12px] font-semibold text-white">
                        自分の部屋を作る
                    </span>
                    <span className="text-[10px] leading-relaxed text-white/70">
                        家具を置いて
                        <br />
                        自分だけの場所にできます
                    </span>
                </Link>

                {/* 部屋 */}
                <div className="relative min-w-0 flex-1">
                    {rooms.length === 0 ? (
                        <p className="flex h-full items-center rounded-lg border border-line px-5 text-[11px] leading-relaxed text-muted">
                            まだ他の部屋がありません。
                            <br />
                            最初の一部屋を立てると、ここに並びます。
                        </p>
                    ) : (
                        <>
                            <ul
                                ref={trackRef}
                                className="thin-scroll flex gap-2.5 overflow-x-auto pb-1"
                            >
                                {rooms.map((room) => (
                                    <li
                                        key={room.id}
                                        style={{ width: CARD_WIDTH }}
                                        className="shrink-0"
                                    >
                                        <Link
                                            href={`/rooms/${room.id}`}
                                            className="block overflow-hidden rounded-lg border border-line hover:border-forest-line"
                                        >
                                            <span
                                                className="relative flex items-center justify-center"
                                                style={{
                                                    height: ART_HEIGHT,
                                                    background:
                                                        THEME_ART[room.theme] ??
                                                        THEME_ART.library,
                                                }}
                                            >
                                                <ThemeIcon theme={room.theme} />
                                                <span className="absolute left-2 top-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-white">
                                                    {ROOM_THEME_LABEL[room.theme] ?? "書斎"}
                                                </span>
                                            </span>

                                            <span className="block px-3 py-2.5">
                                                <span className="block truncate text-[13px] font-semibold text-ink">
                                                    {room.name || "名前のない部屋"}
                                                </span>
                                                <span className="mt-1 line-clamp-2 block h-[28px] text-[10px] leading-relaxed text-muted">
                                                    {room.description ||
                                                        "説明はまだありません。"}
                                                </span>
                                                <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-faint">
                                                    <PeopleIcon />
                                                    定員 {room.capacity} 人
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            {/* 送り。指で払えない環境のために置く */}
                            <button
                                type="button"
                                onClick={scrollNext}
                                aria-label="次の部屋を見る"
                                style={{ top: ART_HEIGHT / 2 }}
                                className="absolute -right-3 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-md hover:border-forest-line hover:text-forest sm:flex"
                            >
                                <span aria-hidden="true">›</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 図案
 *
 * 部屋の絵。線を太めにして、白 1 色で置く。
 * 小さく出すので、細い線や多色にすると潰れて読めない。
 * ============================================================
 */

function ThemeIcon({ theme }: { theme: WritingRoom["theme"] }) {
    const common = {
        width: 26,
        height: 26,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "rgba(255,255,255,0.92)",
        strokeWidth: 1.6,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };

    /* 図書館。並んだ背表紙 */
    if (theme === "library") {
        return (
            <svg {...common}>
                <path d="M4 4.5h3.4v15H4zM9.4 4.5h3.4v15H9.4z" />
                <path d="m15.2 5.4 3.3.9-3.9 14.1-3.3-.9z" />
                <path d="M3 20.5h18" />
            </svg>
        );
    }

    /* 喫茶店。湯気の立つ器 */
    if (theme === "cafe") {
        return (
            <svg {...common}>
                <path d="M4.5 10h12v4.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5Z" />
                <path d="M16.5 11.2h1.8a2.4 2.4 0 0 1 0 4.8h-1.8" />
                <path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3" />
                <path d="M3 21h15" />
            </svg>
        );
    }

    /* 書斎。机の上の灯り */
    return (
        <svg {...common}>
            <path d="M8.5 10.5 12 4l6 2.5-2.6 5.6z" />
            <path d="M12.4 12.1 9.6 19M6 19h9" />
            <path d="M3 21h18" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M12 5.5v13M5.5 12h13" />
        </svg>
    );
}

function PeopleIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
            <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 14.9c2 .6 3.5 2.3 3.5 4.6" />
        </svg>
    );
}
