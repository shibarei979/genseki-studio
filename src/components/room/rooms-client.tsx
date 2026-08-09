/**
 * ============================================================
 * 原石航路 Studio
 * RoomsClient — 執筆室の入口
 *
 * ここは「どの部屋へ入るか」を決めるだけの場所。
 * 立てる操作は /rooms/new が持つ。
 *
 * 上から順に、
 *   何をする場所かの説明 → オープンな部屋 → 自分の部屋 → 心得
 *
 * 説明を最初に置くのは、初めて来た人が
 * 「部屋」という言葉から何を想像すればいいか分からないため。
 * 通話をする場所だと思われると、入った瞬間に戸惑わせる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AvatarSprite from "@/components/room/avatar-sprite";
import DeleteButton from "@/components/common/delete-button";
import Header from "@/components/layout/header";
import { getRepository } from "@/lib/repository";
import { backgroundFor } from "@/lib/room/room-backgrounds";
import { loadIdentity } from "@/lib/room/presence";
import type { WritingRoom } from "@/types";
import { ROOM_THEME_LABEL, ROOM_VISIBILITY_LABEL } from "@/types";

export default function RoomsClient() {
    const [rooms, setRooms] = useState<WritingRoom[]>([]);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    async function reload() {
        setRooms(await getRepository().listRooms());
    }

    /*
     * 誰でも入れる部屋と、自分が立てた部屋に分ける。
     *
     * 「公式」ではなく「オープン」で分ける。
     * 運営が立てたかどうかは、入る側にはどうでもいい。
     * 知りたいのは「いま入れるか」だけ。
     *
     * 運営が立てた部屋も、オープンにしてあればここに並ぶ。
     * 公式の印はカードの中に残す。誰が用意したかは分かってよい。
     */
    const openRooms = rooms.filter((room) => room.visibility === "open");
    const myRooms = rooms.filter(
        (room) => room.host_id === loadIdentity().id && room.visibility !== "open",
    );

    useEffect(() => {
        void reload();
    }, []);

    return (
        <div className="min-h-screen bg-page">
            <Header breadcrumbs={[{ label: "執筆室" }]} />

            <main className="mx-auto max-w-6xl px-6 py-6">
                {/* ===== 何をする場所か ===== */}
                <section className="relative overflow-hidden rounded-2xl border border-line bg-surface">
                    {/*
                     * 右に部屋の絵を薄く敷く。
                     * 文字が乗る左側は白で伏せる。
                     * 絵の上に直に文字を置くと、絵の濃淡で読みにくさが変わる。
                     */}
                    <div
                        className="absolute inset-y-0 right-0 hidden w-[52%] bg-cover opacity-70 md:block"
                        style={{
                            backgroundImage: "url('/images/rooms/room-small.png')",
                            /* 奥の壁ぎわを残す。下は床が広いだけで部屋らしさが出ない */
                            backgroundPosition: "center 34%",
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute inset-0 hidden md:block"
                        style={{
                            background:
                                "linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface) 44%, rgba(255,255,255,0.85) 58%, rgba(255,255,255,0.35) 78%, rgba(255,255,255,0.15) 100%)",
                        }}
                        aria-hidden="true"
                    />

                    <div className="relative px-7 py-7">
                        <div className="flex items-start gap-3.5">
                            <DoorIcon />
                            <div className="min-w-0">
                                <h1 className="text-[22px] font-semibold tracking-wide text-ink">
                                    執筆室
                                </h1>
                                <p className="mt-1.5 max-w-[34em] text-[12px] leading-[1.9] text-muted">
                                    ひとりで書く作業を、誰かがいる空間でやるための場所です。
                                    <br />
                                    話しかけるためではなく、「ほかにも書いている人がいる」と分かるためにあります。
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2.5">
                            <Link
                                href="/rooms/new"
                                className="flex items-center gap-2 rounded-lg bg-forest-dark px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                <PlusIcon />
                                部屋を立てる
                            </Link>

                            {/*
                             * 使い方はその場で開く。
                             * 別のページへ飛ばすと、読んだあと
                             * ここへ戻ってくるとは限らない。
                             */}
                            <button
                                type="button"
                                onClick={() => setIsGuideOpen((open) => !open)}
                                aria-expanded={isGuideOpen}
                                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-2.5 text-[13px] text-ink hover:border-forest-line hover:text-forest"
                            >
                                <HelpIcon />
                                使い方ガイド
                            </button>
                        </div>

                        {isGuideOpen && (
                            <ol className="relative mt-4 max-w-[36em] space-y-2 rounded-xl bg-canvas px-5 py-4">
                                {GUIDE.map((step, index) => (
                                    <li key={step.title} className="flex gap-3">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-dark text-[11px] font-semibold text-white">
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-medium text-ink">
                                                {step.title}
                                            </span>
                                            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                                {step.body}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>

                {/* ===== オープンな部屋 ===== */}
                <SectionHead
                    icon={<StarIcon />}
                    title="オープンな部屋"
                    count={openRooms.length}
                />

                {openRooms.length === 0 ? (
                    <p className="mt-3 rounded-2xl border border-dashed border-line bg-surface px-6 py-9 text-center text-[12px] leading-relaxed text-muted">
                        いま開いている部屋はありません。
                        <br />
                        誰かが「オープン」で立てたら、ここに並びます。
                    </p>
                ) : (
                    <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {openRooms.map((room) => (
                            <li key={room.id}>
                                <RoomCard room={room} />
                            </li>
                        ))}
                    </ul>
                )}

                {/* ===== 自分が立てた部屋 ===== */}
                <SectionHead
                    icon={<CaseIcon />}
                    title="自分の部屋"
                    count={myRooms.length}
                />

                {myRooms.length === 0 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-5 rounded-2xl border border-dashed border-forest-line bg-surface px-6 py-9 text-center">
                        <AvatarSprite seed="empty-room" size={54} />
                        <div>
                            <p className="text-[14px] font-semibold text-ink">
                                まだ部屋がありません
                            </p>
                            <p className="mt-1 text-[12px] text-muted">
                                「部屋を立てる」から、自分だけの執筆室を作りましょう。
                            </p>
                            <Link
                                href="/rooms/new"
                                className="mt-3.5 inline-flex items-center gap-2 rounded-lg bg-forest-dark px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                <PlusIcon />
                                部屋を立てる
                            </Link>
                        </div>
                    </div>
                ) : (
                    <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {myRooms.map((room) => (
                            <li key={room.id}>
                                <RoomCard
                                    room={room}
                                    onDelete={async () => {
                                        await getRepository().deleteRoom(room.id);
                                        await reload();
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {/* ===== 心得 ===== */}
                <ul className="mt-6 grid gap-4 rounded-2xl border border-line bg-surface px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
                    {MANNERS.map((row) => (
                        <li key={row.title} className="flex gap-2.5">
                            <span className="mt-0.5 shrink-0 text-forest">{row.icon}</span>
                            <span className="min-w-0">
                                <span className="block text-[12px] font-medium text-ink">
                                    {row.title}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                    {row.body}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>

                <p className="mt-5 text-[11px] leading-relaxed text-faint">
                    いまは同じブラウザの別タブどうしでのみ繋がります。
                    タブを 2 つ開くと、人形が 2 つ現れて実際に動きます。
                    別の端末の人と繋がるにはサーバーが必要で、
                    その差し替えは通信部分の 1 ファイルだけで済むように作ってあります。
                </p>
            </main>
        </div>
    );
}

/**
 * ============================================================
 * 中身
 * ============================================================
 */

const GUIDE = [
    {
        title: "部屋に入る",
        body: "オープンな部屋は誰でも入れます。入るとすぐ、あなたの人形が部屋に現れます。",
    },
    {
        title: "好きな席へ座る",
        body: "床を押すとそこまで歩きます。椅子を押すと座ります。席に意味はないので、落ち着く場所を選んでください。",
    },
    {
        title: "集中モードで閉じる",
        body: "話しかけられたくないときは集中モードに入ります。15分のあいだ、チャットが伏せられます。",
    },
    {
        title: "出るときは扉へ",
        body: "下の扉まで歩くか、退出を押します。書いたものは部屋には残りません。",
    },
];

const MANNERS = [
    {
        icon: <BookIcon />,
        title: "集中して書こう",
        body: "静かな環境で作品と向き合いましょう。",
    },
    {
        icon: <HeartIcon />,
        title: "思いやりを大切に",
        body: "他の人の集中を妨げないようにしましょう。",
    },
    {
        icon: <TimerIcon />,
        title: "長時間の離席は一言",
        body: "みんなが気持ちよく使えます。",
    },
    {
        icon: <SproutIcon />,
        title: "自分のペースで",
        body: "無理せず、自分らしく書きましょう。",
    },
];

function SectionHead({
    icon,
    title,
    count,
}: {
    icon: React.ReactNode;
    title: string;
    /** 何部屋あるか。0 のときは出さない */
    count?: number;
}) {
    return (
        <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-wide text-ink">
                <span className="text-forest">{icon}</span>
                {title}
            </h2>

            {/*
             * 見本では右に「すべての部屋を見る →」がある。
             * いまは全部この画面に出ているので、行き先が無い。
             * 代わりに数だけ置く。押せない案内を出すより、
             * 何部屋あるかが分かるほうが役に立つ。
             */}
            {count !== undefined && count > 0 && (
                <span className="shrink-0 text-[11px] text-faint">{count}部屋</span>
            )}
        </div>
    );
}

/**
 * 部屋のカード。
 *
 * 上に部屋の絵を載せる。
 * 名前と説明だけでは、どんな場所なのかが伝わらない。
 *
 * 絵は、入ったときに実際に見える部屋そのもの。
 * 一覧用に別の絵を用意すると、入った瞬間に
 * 「思っていた部屋と違う」となる。
 *
 * 縦長の絵を 16:9 に切るので、中央より少し上を残す。
 * 下は床が広いだけで、部屋らしさは奥の壁ぎわに出る。
 *
 * 左上に開いているかどうか、右上に発言の決まりを置く。
 * 入る前に知りたいのはこの 2 つで、
 * 名前や説明を読んでからでは遅い。
 */
function RoomCard({ room, onDelete }: { room: WritingRoom; onDelete?: () => void }) {
    return (
        <div className="group relative h-full">
            <Link
                href={`/rooms/${room.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-forest-line hover:shadow-md"
            >
                <span className="relative block aspect-[16/9] w-full overflow-hidden bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={backgroundFor(room.capacity).src}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                        style={{ objectPosition: "center 38%" }}
                    />

                    <span className="absolute left-2.5 top-2.5 rounded-md bg-[var(--color-leaf)] px-2 py-0.5 text-[10px] font-medium text-white">
                        開放中
                    </span>

                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/45 px-2 py-0.5 text-[10px] text-white">
                        {room.allow_chat ? (
                            <>
                                <ChatIcon />
                                文字で話せる
                            </>
                        ) : (
                            <>
                                <StampIcon />
                                スタンプのみ
                            </>
                        )}
                    </span>

                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[var(--color-surface)]/85 px-2 py-0.5 text-[10px] text-muted">
                        {ROOM_THEME_LABEL[room.theme]}
                    </span>
                </span>

                <span className="flex flex-1 flex-col px-4 py-3.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14px] font-semibold text-ink">
                            {room.name}
                        </span>
                        <span className="rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                            {ROOM_VISIBILITY_LABEL[room.visibility]}
                        </span>
                        {room.is_official && (
                            <span className="rounded bg-amber-tint px-1.5 py-0.5 text-[10px] text-amber">
                                公式
                            </span>
                        )}
                    </span>

                    <span className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted">
                        {room.description || "説明はありません"}
                    </span>

                    <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-faint">
                        <span className="flex items-center gap-1.5">
                            <PeopleIcon />
                            上限 {room.capacity}人
                        </span>

                        {/*
                         * 見本では顔が数人ぶん並び「+28」と出ている。
                         * いまは在室数を外から数える手段が無い。
                         * 同じブラウザの中でしか繋がっていないので、
                         * 別の部屋に誰がいるかは分からない。
                         *
                         * 数を偽って出すと、入った瞬間に誰もいなくて
                         * 「壊れている」と受け取られる。ここは席の数だけ出す。
                         */}
                        <span className="flex items-center gap-1 text-forest">
                            <span>入る</span>
                            <span aria-hidden="true">›</span>
                        </span>
                    </span>
                </span>
            </Link>

            {onDelete && (
                <span className="absolute right-2 top-2">
                    <DeleteButton
                        label={room.name}
                        note="この部屋を閉じます。中の発言も残りません。"
                        onDelete={onDelete}
                        isFloating
                        size="small"
                    />
                </span>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function stroke(width = 1.9) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

/** 扉。この画面の顔になるので、他より大きく描く */
function DoorIcon() {
    return (
        <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            className="shrink-0 text-forest"
            {...stroke(1.5)}
        >
            <path d="M6 21V8a6 6 0 0 1 12 0v13" />
            <path d="M3.5 21h17" />
            <circle cx="14.6" cy="13.4" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2.2)}>
            <path d="M12 5.5v13M5.5 12h13" />
        </svg>
    );
}

function HelpIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M9.7 9.4a2.4 2.4 0 1 1 2.9 2.6v1.4M12.5 16.6v.3" />
        </svg>
    );
}

function StarIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8Z" />
        </svg>
    );
}

function CaseIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" {...stroke(1.9)}>
            <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
            <path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5" />
        </svg>
    );
}

function PeopleIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
            <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 14.9c2 .6 3.5 2.3 3.5 4.6" />
        </svg>
    );
}

function ChatIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" {...stroke(2.2)}>
            <path d="M20.5 12c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.3L4.5 20.5l1.3-3.6A6.9 6.9 0 0 1 3.5 12c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
        </svg>
    );
}

function StampIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" {...stroke(2.2)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0M9.2 9.6v.3M14.8 9.6v.3" />
        </svg>
    );
}

function BookIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
            <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
        </svg>
    );
}

function HeartIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M12 19.5s-7-4.3-7-9a3.8 3.8 0 0 1 7-2.1 3.8 3.8 0 0 1 7 2.1c0 4.7-7 9-7 9Z" />
        </svg>
    );
}

function TimerIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <circle cx="12" cy="13.5" r="7.5" />
            <path d="M12 9.5v4l2.5 1.5M9.5 3h5" />
        </svg>
    );
}

function SproutIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M12 20.5v-7" />
            <path d="M12 13.5C12 10.7 9.8 8.5 7 8.5c0 2.8 2.2 5 5 5Z" />
            <path d="M12 13.5c0-2.8 2.2-5 5-5 0 2.8-2.2 5-5 5Z" />
            <path d="M8 20.5h8" />
        </svg>
    );
}
