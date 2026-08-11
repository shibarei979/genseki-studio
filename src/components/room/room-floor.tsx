/**
 * ============================================================
 * 原石航路 Studio
 * RoomFloor — 執筆室の中
 *
 * 部屋を 1 枚の絵として敷き、その上に人のアイコンを置く。
 * 押した場所へ自分が移動する。
 *
 * 席の意味はこちらで決めない。
 * 「窓際が好き」「中央は落ち着かない」は人それぞれで、
 * 座る場所そのものが、その人の今日の気分になる。
 *
 * ------------------------------------------------------------
 * 位置の持ち方
 *
 * 人の位置は 0〜1 の割合。画面の大きさに依らない。
 * 置き場所は割合のまま CSS に渡すので、
 * 枠が伸び縮みしても同じ場所を指し続ける。
 *
 * 人の大きさだけは割合にできないので、
 * 絵の原寸に対する倍率を測って掛ける。
 * これをしないと、狭い画面で人が部屋より大きくなる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import AvatarSprite from "@/components/room/avatar-sprite";
import {
    backgroundFor,
    clampToFloor,
    findPath,
    isAtRoomDoor,
    seatNear,
} from "@/lib/room/room-backgrounds";
import { assignColors } from "@/lib/room/avatar-colors";
import { findStamp } from "@/lib/room/stamps";
import type { RoomMember, RoomMessage } from "@/types";
import { MEMBER_STATUS_LABEL } from "@/types";

/** スタンプを頭の上に出しておく時間 */
const BUBBLE_MS = 6000;

/**
 * 1 区間を歩くのにかける時間（ミリ秒）。
 *
 * これより速いと瞬間移動に見え、遅いと待たされる。
 * 絵の動きもこの長さに合わせるので、
 * 変えるときは両方が同じ値を見ていることに注意。
 */
const STEP_MS = 620;

/**
 * 位置が変わってから、歩いている扱いを続ける時間。
 *
 * 1 区間ぶんより少しだけ長くする。
 * ちょうどにすると、次の区間へ移る一瞬だけ足が止まって、
 * 歩きが途切れて見える。
 */
const WALK_HOLD_MS = STEP_MS + 160;

interface Props {
    /** 扉まで歩いたときに尋ねる */
    onReachDoor?: () => void;
    /**
     * 縦にこれ以上大きくしない（px）。
     *
     * 部屋の絵は縦長なので、幅に合わせるだけだと
     * 画面からはみ出して、下の操作がスクロールしないと見えなくなる。
     * 幅と高さの両方に収まる大きさを、こちらで割り出す。
     */
    maxHeight?: number;
    /** どの部屋の絵を敷くか。入れる人数で決まる */
    capacity: number;
    members: RoomMember[];
    messages: RoomMessage[];
    selfId: string;
    onMove: (x: number, y: number) => void;
    /** 名札から通報を開く。自分自身には出さない */
    onReport?: (member: RoomMember) => void;
    /**
     * いま声が出ている人。
     *
     * 名札の周りを光らせる。
     * 誰の声か分からないと、返事のしようがない。
     */
    speakingIds?: string[];
    /**
     * マイクを入れている人。
     *
     * 話しているかとは別に持つ。
     * 黙っていても、入っていることは見えていてほしい。
     * 切り忘れたまま席を立つのを防ぐ。
     */
    micOnIds?: string[];
}

export default function RoomFloor({
    capacity,
    members,
    messages,
    selfId,
    onMove,
    onReachDoor,
    onReport,
    speakingIds = [],
    micOnIds = [],
    maxHeight = 620,
}: Props) {
    /** 幅を測るための外枠 */
    const boxRef = useRef<HTMLDivElement>(null);
    /** 実際に絵を敷く枠。押した場所はここを基準に出す */
    const frameRef = useRef<HTMLDivElement>(null);
    /** 名札を押して開いている人。もう一度押すと閉じる */
    const [openedId, setOpenedId] = useState<string | null>(null);
    /** 絵の原寸に対する倍率。人の大きさに掛ける */
    const [scale, setScale] = useState(1);
    /** 敷く大きさ（px）。幅と高さの両方に収まる値 */
    const [size, setSize] = useState({ width: 0, height: 0 });

    /*
     * 歩いている途中の道。
     *
     * 押した瞬間に道を全部決めてしまい、あとは順に送るだけにする。
     * 1 歩ごとに測り直すと、他の人が動いた拍子に道が変わって
     * 行き先が揺れる。
     */
    const walkRef = useRef<number | null>(null);
    /*
     * 絵が読めなかったか。
     *
     * 壊れた画像の記号だけが出ると、
     * 置き場所が違うのか名前が違うのか分からない。
     * 探しに行った先を画面に出しておく。
     */
    const [hasArtFailed, setHasArtFailed] = useState(false);

    const background = backgroundFor(capacity);

    /* 部屋の中で色が被らないように配り直す */
    const colors = assignColors(members);

    /*
     * いま歩いている人。
     *
     * 位置が変わった人を歩いている扱いにして、少ししたら戻す。
     * 「歩いています」という知らせは持っていないので、
     * 座標の変化から見分ける。
     */
    const [walkingIds, setWalkingIds] = useState<Set<string>>(new Set());
    const lastSpotRef = useRef(new Map<string, string>());
    const stopTimersRef = useRef(new Map<string, number>());

    useEffect(() => {
        const moved: string[] = [];

        for (const member of members) {
            const spot = `${member.x.toFixed(4)},${member.y.toFixed(4)}`;
            if (lastSpotRef.current.get(member.id) !== spot) {
                if (lastSpotRef.current.has(member.id)) moved.push(member.id);
                lastSpotRef.current.set(member.id, spot);
            }
        }
        if (moved.length === 0) return;

        setWalkingIds((current) => {
            const next = new Set(current);
            for (const id of moved) next.add(id);
            return next;
        });

        for (const id of moved) {
            const running = stopTimersRef.current.get(id);
            if (running !== undefined) window.clearTimeout(running);

            stopTimersRef.current.set(
                id,
                window.setTimeout(() => {
                    stopTimersRef.current.delete(id);
                    setWalkingIds((current) => {
                        if (!current.has(id)) return current;
                        const next = new Set(current);
                        next.delete(id);
                        return next;
                    });
                }, WALK_HOLD_MS),
            );
        }
    }, [members]);

    /* 画面を離れるときに、残っている待ちを片づける */
    useEffect(() => {
        const timers = stopTimersRef.current;
        return () => {
            timers.forEach((id) => window.clearTimeout(id));
            timers.clear();
        };
    }, []);

    /* 人数が変わって別の絵になったら、読み込みからやり直す */
    useEffect(() => {
        setHasArtFailed(false);
    }, [background.src]);

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        /*
         * 幅と高さの両方に収める。
         *
         * 幅だけに合わせると縦がはみ出し、
         * 高さだけに合わせると横に余る。
         * 小さいほうを採る。原寸より大きくはしない。
         * 引き伸ばすと絵の粗さがそのまま拡大される。
         */
        function fit() {
            const available = box?.clientWidth ?? 0;
            if (available === 0) return;

            const ratio = background.width / background.height;
            const width = Math.min(available, maxHeight * ratio, background.width);

            setSize({ width, height: width / ratio });
            setScale(width / background.width);
        }

        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(box);
        return () => observer.disconnect();
    }, [background.width, background.height, maxHeight]);

    /** 直近のスタンプを人ごとに 1 つだけ拾う */
    const bubbleByMember = new Map<string, RoomMessage>();
    const now = Date.now();
    for (const message of messages) {
        if (now - new Date(message.created_at).getTime() > BUBBLE_MS) continue;
        bubbleByMember.set(message.member_id, message);
    }

    /*
     * 扉の前に立ったら知らせる。
     * 自分が動いたときだけ見る。他の人が扉に立っても関係ない。
     */
    const self = members.find((member) => member.id === selfId);
    const wasAtDoor = useRef(false);

    useEffect(() => {
        if (!self) return;

        const atDoor = isAtRoomDoor(background, self.x, self.y);
        // 立った瞬間だけ尋ねる。留まっているあいだ繰り返さない
        if (atDoor && !wasAtDoor.current) onReachDoor?.();
        wasAtDoor.current = atDoor;
    }, [self?.x, self?.y, background, onReachDoor, self]);

    /* 画面を離れるときは歩くのをやめる */
    useEffect(
        () => () => {
            if (walkRef.current !== null) window.clearInterval(walkRef.current);
        },
        [],
    );

    /**
     * 押した場所まで歩く。
     *
     * 一直線に飛ばず、空いている所を辿る。
     * 椅子を押したときは、その手前まで歩いてから座る。
     */
    function handleClick(event: React.MouseEvent<HTMLDivElement>) {
        const frame = frameRef.current;
        if (!frame) return;

        setOpenedId(null);

        const rect = frame.getBoundingClientRect();
        const pressedX = (event.clientX - rect.left) / rect.width;
        const pressedY = (event.clientY - rect.top) / rect.height;

        const from = self ? { x: self.x, y: self.y } : null;
        if (!from) return;

        /*
         * 椅子か、床か。
         *
         * 椅子は机の当たり判定の中にあるので、先に見る。
         * 後から見ると「机の手前」へ押し出されてしまう。
         */
        const seat = seatNear(background, pressedX, pressedY);
        const goal = seat ?? clampToFloor(background, pressedX, pressedY);
        if (!goal) return;

        const route = findPath(background, from, goal);

        /*
         * 椅子は道の終わりに足す。
         * 机の中なので、道を探す格子には含まれていない。
         */
        const steps = seat ? [...route, seat] : route;
        if (steps.length === 0) return;

        if (walkRef.current !== null) window.clearInterval(walkRef.current);

        let index = 0;
        onMove(steps[0].x, steps[0].y);
        index += 1;

        walkRef.current = window.setInterval(() => {
            if (index >= steps.length) {
                if (walkRef.current !== null) window.clearInterval(walkRef.current);
                walkRef.current = null;
                return;
            }
            onMove(steps[index].x, steps[index].y);
            index += 1;
        }, STEP_MS);
    }

    return (
        <div ref={boxRef} className="flex w-full justify-center">
        <div
            ref={frameRef}
            onClick={handleClick}
            role="application"
            aria-label="執筆室の中。押した場所へ移動します"
            className="relative cursor-pointer select-none overflow-hidden rounded-2xl border border-line shadow-sm"
            style={{ width: size.width || undefined, height: size.height || undefined }}
        >
            {/*
             * 部屋の絵。
             *
             * object-contain で、切らずに枠へ収める。
             * cover だと枠と縦横比がずれたときに端が切れ、
             * 割合で決めている歩ける範囲と絵の位置がずれる。
             *
             * 枠の縦横比は絵の原寸から出しているので、
             * 通常は隙間なく収まる。
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={background.src}
                alt=""
                draggable={false}
                onError={() => setHasArtFailed(true)}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
            />

            {hasArtFailed && (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
                    <p className="text-[13px] text-ink">部屋の絵が読み込めませんでした</p>
                    <p className="text-[11px] leading-relaxed text-muted">
                        探した場所:
                        <br />
                        <code className="text-ink">{background.src}</code>
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted">
                        このアドレスをブラウザで直接開いて、絵が出るか確かめてください。
                        出ない場合は public/images/rooms/ にファイルが無いか、
                        開発サーバーの再起動が必要です。
                    </p>
                </div>
            )}

            {members.map((member) => {
                const isSelf = member.id === selfId;
                const bubble = bubbleByMember.get(member.id);
                const stamp =
                    bubble?.kind === "stamp" ? findStamp(bubble.body) : undefined;

                return (
                    <div
                        key={member.id}
                        className="absolute transition-all ease-linear"
                        style={{
                            left: `${member.x * 100}%`,
                            top: `${member.y * 100}%`,
                            /*
                             * 足元を位置に合わせる。
                             * 中心を合わせると、机の向こう側に立ったとき
                             * 体が机に埋まって見える。
                             */
                            transform: `translate(-50%, -100%) scale(${scale})`,
                            transformOrigin: "bottom center",
                            /* 歩く刻みと同じ長さで動かす。ずれると滑って見える */
                            transitionDuration: `${STEP_MS}ms`,
                            // 手前の人ほど上に描く
                            zIndex: 10 + Math.round(member.y * 100),
                        }}
                    >
                        {/* 吹き出し */}
                        {bubble && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 mb-9 -translate-x-1/2">
                                <span className="block whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] shadow-md">
                                    <span
                                        style={{ color: stamp?.tone ?? "var(--color-ink)" }}
                                    >
                                        {stamp ? stamp.label : bubble.body}
                                    </span>
                                </span>
                                <span
                                    className="mx-auto block h-0 w-0"
                                    style={{
                                        borderLeft: "5px solid transparent",
                                        borderRight: "5px solid transparent",
                                        borderTop: "5px solid var(--color-surface)",
                                        filter: "drop-shadow(0 1px 0 var(--color-line))",
                                    }}
                                />
                            </div>
                        )}

                        {/*
                         * 名札。
                         *
                         * 頭の上に置く。足元に置くと、
                         * 手前に立った人の名札が奥の人の顔に重なる。
                         *
                         * 押すと、その人のことが読める札が開く。
                         */}
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setOpenedId((current) =>
                                    current === member.id ? null : member.id,
                                );
                            }}
                            aria-expanded={openedId === member.id}
                            className={[
                                "absolute bottom-full left-1/2 mb-1 max-w-[120px] -translate-x-1/2 truncate rounded-full border px-2 py-0.5 text-[10px] shadow-sm transition-shadow",
                                isSelf
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line bg-surface text-ink hover:border-forest-line",
                            ].join(" ")}
                            style={
                                speakingIds.includes(member.id)
                                    ? {
                                          /* 話している人。緑の輪で囲む */
                                          borderColor: "var(--color-leaf)",
                                          boxShadow:
                                              "0 0 0 3px color-mix(in srgb, var(--color-leaf) 35%, transparent)",
                                      }
                                    : undefined
                            }
                        >
                            {member.display_name}
                        </button>

                        {/* 押したときに開く札 */}
                        {openedId === member.id && (
                            <div
                                onClick={(event) => event.stopPropagation()}
                                className="absolute bottom-full left-1/2 z-10 mb-8 w-[190px] -translate-x-1/2 cursor-default rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-lg"
                            >
                                <p className="truncate text-[13px] font-semibold text-ink">
                                    {member.display_name}
                                    {isSelf && (
                                        <span className="ml-1 text-[11px] font-normal text-muted">
                                            （あなた）
                                        </span>
                                    )}
                                </p>

                                <p className="mt-0.5 text-[11px] text-muted">
                                    {MEMBER_STATUS_LABEL[member.status]}
                                    {member.written_chars > 0 &&
                                        `・この滞在で${member.written_chars.toLocaleString("ja-JP")}文字`}
                                </p>

                                {/*
                                 * 作品へ。
                                 *
                                 * いまは自分の作品しか読めない。
                                 * 他の人の書いたものを開くには、
                                 * 作品を人と結びつけて公開する仕組みが要る。
                                 */}
                                {isSelf ? (
                                    <Link
                                        href="/mypage"
                                        className="mt-2.5 block rounded-lg border border-forest-line py-1.5 text-center text-[11px] text-forest hover:bg-forest-tint"
                                    >
                                        自分の作品を見る
                                    </Link>
                                ) : (
                                    <>
                                        <p className="mt-2.5 rounded-lg bg-canvas py-1.5 text-center text-[11px] text-faint">
                                            作品はまだ見られません
                                        </p>

                                        {/*
                                         * 通報。
                                         * 目立たせない。押しやすい場所に置くと、
                                         * 気に入らないだけで押されるようになる。
                                         */}
                                        {onReport && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpenedId(null);
                                                    onReport(member);
                                                }}
                                                className="mt-1.5 block w-full py-1 text-center text-[11px] text-faint hover:text-[var(--color-danger)]"
                                            >
                                                この人を通報する
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/*
                         * 書いている人の頭上に印。
                         * 名札の上に出す。
                         */}
                        {member.status === "writing" && !bubble && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 mb-8 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] text-ink shadow-md">
                                執筆中
                            </div>
                        )}

                        {/*
                         * マイクの印。
                         *
                         * 人の右肩に出す。
                         * 頭の真上は「執筆中」の札と吹き出しが使うので、
                         * そこへ置くと隠れる日が出る。
                         *
                         * 話している間は緑に変わる。
                         * 入れているだけの人と、いま声が出ている人を分ける。
                         */}
                        {micOnIds.includes(member.id) && (
                            <span
                                className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow"
                                style={{
                                    background: speakingIds.includes(member.id)
                                        ? "var(--color-leaf)"
                                        : "var(--color-forest-dark)",
                                }}
                                title={
                                    speakingIds.includes(member.id)
                                        ? "話しています"
                                        : "マイクが入っています"
                                }
                            >
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#fff"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <rect x="9" y="3" width="6" height="11" rx="3" />
                                    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                                </svg>
                            </span>
                        )}

                        {/* 人の姿 */}
                        <span className="relative block">
                            <AvatarSprite
                                seed={member.avatar_seed || member.display_name}
                                colorId={colors.get(member.id)}
                                isWriting={member.status === "writing"}
                                isWalking={walkingIds.has(member.id)}
                            />

                            {isSelf && (
                                <span className="pointer-events-none absolute -bottom-0.5 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full bg-forest opacity-70" />
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
        </div>
    );
}
