/**
 * ============================================================
 * 原石航路 Studio
 * RoomClient — 執筆室の中
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Header from "@/components/layout/header";
import RoomFloor from "@/components/room/room-floor";
import RoomChatCard from "@/components/room/room-chat-card";
import RoomMembersCard from "@/components/room/room-members-card";
import ReportDialog from "@/components/room/report-dialog";
import RoomManagePanel from "@/components/room/room-manage-panel";
import { useRoomSession } from "@/hooks/use-room-session";
import { useAuth } from "@/hooks/use-auth";
import { getRepository } from "@/lib/repository";
import { createPresence, loadIdentity, saveIdentity } from "@/lib/room/presence";
import { AVATAR_COLORS, assignColors, takenColors } from "@/lib/room/avatar-colors";
import { loadLastSpot, saveLastSpot } from "@/lib/room/last-spot";
import { backgroundFor, clampToFloor } from "@/lib/room/room-backgrounds";
import type { Presence, RoomState } from "@/lib/room/presence";
import type { Profile, RoomMember, WritingRoom } from "@/types";
import { ROOM_VISIBILITY_LABEL } from "@/types";

/**
 * 表示する版。
 *
 * 不具合を伝えてもらうとき、どの版で起きたのかが分かる。
 * package.json から読めるようにすると、
 * この画面のためだけに設定が増えるので、ここに書く。
 */
const APP_VERSION = "1.0.0";

interface Props {
    roomId: string;
}

export default function RoomClient({ roomId }: Props) {
    const [room, setRoom] = useState<WritingRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [state, setState] = useState<RoomState>({ members: [], messages: [], isClosed: false });
    const [identity, setIdentity] = useState(() => loadIdentity());
    const [isEditingName, setIsEditingName] = useState(false);
    const [copied, setCopied] = useState(false);

    const presenceRef = useRef<Presence | null>(null);

    /* 部屋が閉じられたか。閉じられていたら知らせて一覧へ戻す */
    const [isClosed, setIsClosed] = useState(false);
    const closeWatchRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (closeWatchRef.current !== null)
                window.clearInterval(closeWatchRef.current);
        },
        [],
    );

    useEffect(() => {
        void (async () => {
            const repository = getRepository();
            setRoom(await repository.getRoom(roomId));

            /*
             * 部屋が閉じられていないか、ときどき見に行く。
             *
             * 立てた人が閉じても、開いたままの画面には伝わらない。
             * 無くなった部屋の中で歩き続けることになるので、
             * 気づいたら一覧へ戻す。
             */

            const watch = window.setInterval(async () => {
                if ((await repository.getRoom(roomId)) === null) {
                    window.clearInterval(watch);
                    setIsClosed(true);
                }
            }, 8000);
            closeWatchRef.current = watch;

            // 部屋での名前はマイページの表示名に合わせる。
            // 2 か所で別々に持つと、どちらが本当か分からなくなる
            const profile = await repository.getProfile();
            setIdentity((current) => {
                if (current.name === profile.display_name) return current;
                const next = { ...current, name: profile.display_name };
                saveIdentity(next);
                return next;
            });

            setIsLoading(false);
        })();
    }, [roomId]);

    /** 部屋に入る */
    useEffect(() => {
        if (!room) return;

        const presence = createPresence(room.id);
        presenceRef.current = presence;

        /*
         * 入る場所。
         *
         * 扉のあたりから始める。
         * 部屋の真ん中にいきなり立っていると、入ってきた感じがしない。
         *
         * ただし扉の前に飾り棚が並ぶ部屋もあるので、
         * 立てる場所へ寄せてから置く。
         */
        const background = backgroundFor(room.capacity);

        /*
         * 前にいた場所へ戻す。
         *
         * 資料や執筆へ移って帰ってきたとき、
         * 別の場所に立っていると、隣にいた人と離れてしまう。
         * 席を選んだことも無かったことになる。
         */
        const last = loadLastSpot(room.id);

        const entrance = last
            ? (clampToFloor(background, last.x, last.y) ?? last)
            : (clampToFloor(
                  background,
                  0.44 + Math.random() * 0.12,
                  background.floor.top + 0.04,
              ) ?? { x: 0.5, y: background.floor.top + 0.04 });

        const member: RoomMember = {
            id: identity.id,
            room_id: room.id,
            display_name: identity.name,
            avatar_seed: identity.id,
            /*
             * 入るときの色。
             *
             * 以後の変更は setColor で伝えるので、
             * ここは入室時の初期値だけを見る。
             * 依存に入れると、色を変えるたびに入り直しになる。
             */
            color_id: loadIdentity().colorId,
            status: "thinking",
            x: entrance.x,
            y: entrance.y,
            written_chars: 0,
            joined_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
        };

        presence.join(member);
        const unsubscribe = presence.subscribe(setState);

        // タブを閉じたときにも抜けたことを伝える
        const handleUnload = () => presence.leave();
        window.addEventListener("beforeunload", handleUnload);

        return () => {
            window.removeEventListener("beforeunload", handleUnload);
            unsubscribe();
            presence.dispose();
            presenceRef.current = null;
        };
    }, [room, identity.id, identity.name]);

    /** この滞在で書いた文字数。集中の時間の記録に使う */
    const [isManaging, setIsManaging] = useState(false);

    /*
     * 部屋を立てた人が出ようとしているか。
     *
     * 立てた人が黙って出ると、残った人は
     * 名前も上限も変えられない部屋に取り残される。
     * 出る前に、誰に任せるか／閉じるかを決めてもらう。
     */
    const [isLeaving, setIsLeaving] = useState(false);
    /* 立てた人以外に出す、短い確かめ */
    const [isDoorAsking, setIsDoorAsking] = useState(false);

    /*
     * 通報の札。
     *
     * 発言を通報するときは本文も控える。
     * 相手が消したあとでは、運営が確かめようがない。
     */
    const [reporting, setReporting] = useState<{
        target: "message" | "member";
        accusedId: string;
        accusedName: string;
        quotedBody?: string;
    } | null>(null);
    const [handoverTo, setHandoverTo] = useState<string | null>(null);
    /*
     * 立てた人か。
     * ログインが入ったら host_id と自分の id を突き合わせる。
     * いまは端末ごとの目印で見ている。
     */
    /*
     * 立てた人か。
     *
     * host_id には、保存のときにログインの id が入る。
     * 端末ごとの目印とは別のものなので、両方で見比べる。
     *
     * 片方だけだと、ログインしている人が
     * 自分の部屋の部屋主として見なされない。
     */
    const { user } = useAuth();

    const isHost =
        room !== null &&
        (room.host_id === identity.id ||
            (user !== null && room.host_id === user.id));

    /* 部屋を閉じるか尋ねている最中か */
    const [isClosing, setIsClosing] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const router = useRouter();
    const { enter, leave } = useRoomSession();

    // 開いたら入室中として覚える。執筆へ移っても帯が残る
    useEffect(() => {
        enter(roomId);
    }, [roomId, enter]);

    useEffect(() => {
        void (async () => {
            setProfile(await getRepository().getProfile());
        })();
    }, []);

    /*
     * 文字で発言してよいか。
     * 部屋を立てた人と、その人が許した人だけ。
     *
     * いまはログインが無く、自分の端末の部屋しか開けないので、
     * 自分の立てた部屋では常に話せる扱いにしている。
     * ログインが入ったら host_id と突き合わせる。
     */
    const canSpeak =
        room !== null &&
        room.allow_chat &&
        (room.host_id !== null || (room.speakers ?? []).includes(identity.id));

    /*
     * いまの時刻。
     * 集中していると時間の感覚が飛ぶので、部屋の中でも見えるようにする。
     *
     * サーバーで描いた時刻をそのまま出すと、
     * 画面に出た瞬間から少しずつ狂う。開いてから数え始める。
     */
    const [clock, setClock] = useState("");

    /*
     * 集中モードの終わる時刻。null なら入っていない。
     *
     * 見本の「ヘッドホンミュート／自分だけの世界に入る」にあたる。
     * 音を消す機能はまだ無いので、代わりに
     * チャットと、床に浮かぶ吹き出しを伏せる。
     * 部屋にはいるが、話しかけられても気づかない状態になる。
     */
    const [focusUntil, setFocusUntil] = useState<number | null>(null);
    const [focusLeft, setFocusLeft] = useState(0);

    useEffect(() => {
        if (focusUntil === null) return;

        function tick() {
            const left = Math.max(0, Math.ceil((focusUntil! - Date.now()) / 1000));
            setFocusLeft(left);
            /* 終わったら自動で戻す。自分で解くのを忘れても閉じたままにしない */
            if (left === 0) setFocusUntil(null);
        }
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [focusUntil]);

    const isFocusing = focusUntil !== null;

    /** 自分以外で、いまこの部屋にいる人 */
    const others = state.members.filter((member) => member.id !== identity.id);

    /** ただ出る */
    function justLeave() {
        presenceRef.current?.leave();
        leave();
        router.push("/rooms");
    }

    /**
     * 出るかを尋ねる。
     *
     * 立てた人には引き継ぎの札を、
     * それ以外には短い確かめを出す。
     *
     * 扉まで歩いたときと、退出のボタンを押したときで
     * 同じ流れにしたいので、1 か所にまとめてある。
     */
    function askToLeave() {
        if (isHost) {
            setHandoverTo(others[0]?.id ?? null);
            setIsLeaving(true);
        } else {
            setIsDoorAsking(true);
        }
    }

    /**
     * 別の人に任せて出る。
     *
     * host_id を差し替えるだけ。
     * 任された人には、次に開いたときから設定が出る。
     */
    async function handOverAndLeave(memberId: string) {
        if (!room) return;
        await getRepository().updateRoom(room.id, { host_id: memberId });
        justLeave();
    }

    /** 部屋ごと閉じる */
    async function closeAndLeave() {
        if (!room) return;
        await getRepository().deleteRoom(room.id);
        /* 中にいる人へ先に伝える。伝えないと消えた部屋を歩き続ける */
        presenceRef.current?.announceClosed();
        justLeave();
    }

    /*
     * いま自分に割り当たっている色と、部屋で埋まっている色。
     *
     * 選んだ色が先客に取られていれば、ずらされた番号が返る。
     * 選んだつもりの色ではなく、実際に出ている色を光らせたいので、
     * 希望ではなく結果を見る。
     */
    const assignedColor = assignColors(state.members).get(identity.id);
    const usedColors = takenColors(state.members, identity.id);

    /*
     * 集中の時間（タイマー）を出しているか。
     *
     * 見本では下の帯に「タイマー」ボタンがあり、
     * 画面には時計が出ていない。押して出す作りだと読んだ。
     * ただし既定は開いた状態にする。
     * 閉じたまま始まると、時間を区切れることに気づかれない。
     */
    /*
     * 部屋の絵と右の柱に許す高さ（px）。
     *
     * 画面の高さから、上下の帯と余白のぶんを引く。
     * スクロールせずに全体が見えることを優先する。
     * 部屋・人・チャット・操作が同時に見えていないと、
     * 「一緒にいる」感じにならない。
     */
    const [paneHeight, setPaneHeight] = useState(560);

    useEffect(() => {
        function fit() {
            /* 上のヘッダー・パンくず・下の操作帯・余白の合計 */
            const chrome = 250;
            setPaneHeight(
                Math.max(360, Math.min(760, window.innerHeight - chrome)),
            );
        }
        fit();
        window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, []);

    useEffect(() => {
        function tick() {
            setClock(
                new Date().toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            );
        }
        tick();
        const id = window.setInterval(tick, 20 * 1000);
        return () => window.clearInterval(id);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <p className="py-24 text-center text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header breadcrumbs={[{ label: "執筆室", href: "/rooms" }]} />
                <div className="py-24 text-center">
                    <p className="text-sm text-ink">この部屋は見つかりませんでした。</p>
                    <Link
                        href="/rooms"
                        className="mt-6 inline-block rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                    >
                        執筆室の一覧へ
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-canvas">
            <Header
                breadcrumbs={[
                    { label: "執筆室", href: "/rooms" },
                    { label: room.name || "名前のない部屋" },
                ]}
            />

            <div className="mx-auto max-w-[1560px] space-y-3 px-4 py-4">
                {/*
                 * 部屋が無くなっていた。
                 *
                 * 黙って一覧へ飛ばさない。
                 * 何が起きたのか分からないまま画面が変わると、
                 * 不具合と受け取られる。
                 */}
                {isClosed && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
                        <div className="w-full max-w-[380px] rounded-2xl border border-line bg-surface px-6 py-6 text-center">
                            <h2 className="text-[16px] font-semibold text-ink">
                                この部屋は閉じられました
                            </h2>
                            <p className="mt-2 text-[12px] leading-relaxed text-muted">
                                部屋を立てた人が部屋を閉じました。
                                ほかの部屋は一覧から探せます。
                            </p>
                            <button
                                type="button"
                                onClick={justLeave}
                                className="mt-4 w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                執筆室の一覧へ
                            </button>
                        </div>
                    </div>
                )}

                {/*
                 * 立てた人が出るとき。
                 *
                 * 「任せる」を先に、「閉じる」を後に置く。
                 * 部屋の中に人が残っているのに閉じるのは、
                 * その人たちを追い出すことになるので、後から選ばせたい。
                 */}
                {/*
                 * 部屋が閉じられた。
                 *
                 * 消えた部屋の中を歩き続けさせない。
                 * 出るしかないので、選択肢は 1 つだけにする。
                 */}
                {state.isClosed && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
                        <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-6 py-6 text-center">
                            <h2 className="text-[16px] font-semibold text-ink">
                                この部屋は閉じられました
                            </h2>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                                立てた人が部屋を閉じました。
                                ほかの部屋へ移ってください。
                            </p>
                            <button
                                type="button"
                                onClick={justLeave}
                                className="mt-4 w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                執筆室の一覧へ
                            </button>
                        </div>
                    </div>
                )}

                {reporting && (
                    <ReportDialog
                        target={reporting.target}
                        roomId={room.id}
                        roomName={room.name}
                        accusedId={reporting.accusedId}
                        accusedName={reporting.accusedName}
                        quotedBody={reporting.quotedBody}
                        reporterId={identity.id}
                        reporterName={identity.name}
                        onClose={() => setReporting(null)}
                    />
                )}

                {isDoorAsking && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
                        <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-6 py-6">
                            <h2 className="text-[16px] font-semibold text-ink">
                                この部屋から出ますか
                            </h2>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                                また URL から入り直せます。
                                書いたものは部屋には残りません。
                            </p>

                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={justLeave}
                                    className="w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                                >
                                    退出する
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDoorAsking(false)}
                                    className="w-full py-1.5 text-[12px] text-muted hover:text-ink"
                                >
                                    まだいる
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLeaving && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
                        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface px-6 py-6">
                            <h2 className="text-[16px] font-semibold text-ink">
                                この部屋をどうしますか
                            </h2>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                                あなたはこの部屋を立てた人です。
                                このまま出ると、名前や上限を変えられる人が
                                いなくなります。
                            </p>

                            {others.length > 0 ? (
                                <div className="mt-4">
                                    <label
                                        htmlFor="handover"
                                        className="block text-[12px] text-ink"
                                    >
                                        誰に任せますか
                                    </label>
                                    <select
                                        id="handover"
                                        value={handoverTo ?? ""}
                                        onChange={(event) =>
                                            setHandoverTo(event.target.value)
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] outline-none focus:border-forest"
                                    >
                                        {others.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.display_name}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (handoverTo)
                                                void handOverAndLeave(handoverTo);
                                        }}
                                        className="mt-2.5 w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white hover:opacity-90"
                                    >
                                        任せて退出する
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-4 rounded-lg bg-canvas px-3.5 py-3 text-[12px] leading-relaxed text-muted">
                                    いま部屋にいるのはあなただけです。
                                    任せる相手がいないので、
                                    開けたままにするか、閉じるかを選んでください。
                                </p>
                            )}

                            <div className="mt-3 space-y-2 border-t border-line pt-3">
                                <button
                                    type="button"
                                    onClick={justLeave}
                                    className="w-full rounded-lg border border-line py-2.5 text-[13px] text-ink hover:border-forest-line hover:text-forest"
                                >
                                    開けたまま出る
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void closeAndLeave()}
                                    className="w-full rounded-lg border border-line py-2.5 text-[13px] text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                                >
                                    部屋を閉じる
                                    {others.length > 0 && (
                                        <span className="ml-1 text-[11px]">
                                            （{others.length}人が追い出されます）
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsLeaving(false)}
                                    className="w-full py-1.5 text-[12px] text-muted hover:text-ink"
                                >
                                    やめる
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isManaging ? (
                    <RoomManagePanel
                        room={room}
                        members={state.members}
                        onChange={async (patch) => {
                            setRoom(await getRepository().updateRoom(room.id, patch));
                        }}
                        onClose={() => void closeAndLeave()}
                        onBack={() => setIsManaging(false)}
                    />
                ) : (
                    /*
                     * 左に自分と人、中央に部屋、右に決まりごとと話。
                     * 部屋が主役なので中央に置き、幅も一番取る。
                     */
                    <div className="grid items-start gap-3 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
                        {/* ===== 左 ===== */}
                        <div className="flex flex-col gap-3">
                            {/*
                             * 自分と、いまいる部屋。
                             *
                             * 見本では 1 枚のカードに収まっている。
                             * 「誰として、どこにいるか」は続けて読むものなので、
                             * 分けると視線が 2 回止まる。
                             */}
                            <section className="rounded-xl border border-line bg-surface px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                    <span
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                                        style={{
                                            background: `hsl(${profile?.avatar_hue ?? 28} 38% 90%)`,
                                            color: `hsl(${profile?.avatar_hue ?? 28} 48% 28%)`,
                                        }}
                                    >
                                        {identity.name.slice(0, 1)}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-muted">ようこそ</p>
                                        {isEditingName ? (
                                            <input
                                                type="text"
                                                defaultValue={identity.name}
                                                autoFocus
                                                maxLength={16}
                                                onBlur={(e) => {
                                                    const name =
                                                        e.target.value.trim() ||
                                                        "名無しの書き手";
                                                    const next = { ...identity, name };
                                                    saveIdentity(next);
                                                    setIdentity(next);
                                                    setIsEditingName(false);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        e.currentTarget.blur();
                                                }}
                                                aria-label="部屋での表示名"
                                                className="mt-0.5 w-full rounded border border-line px-2 py-0.5 text-[13px] outline-none focus:border-forest"
                                            />
                                        ) : (
                                            <p className="mt-0.5 truncate text-[13px] font-medium text-ink">
                                                {identity.name} さん
                                            </p>
                                        )}
                                    </div>

                                    {!isEditingName && (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingName(true)}
                                            aria-label="部屋での表示名を変える"
                                            title="部屋での表示名を変える"
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-canvas hover:text-ink"
                                        >
                                            <PenIcon />
                                        </button>
                                    )}
                                </div>

                                {/*
                                 * テーマカラー。
                                 *
                                 * 遠目に人を見分けるのは服の色なので、
                                 * 名前のすぐ下に置く。
                                 * 誰かが使っている色は選べない。
                                 * 被ると、部屋の中で二人を取り違える。
                                 */}
                                <div className="mt-3">
                                    <p className="text-[11px] text-muted">
                                        テーマカラー
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {AVATAR_COLORS.map((color) => {
                                            const isUsed = usedColors.has(color.id);
                                            const isMine = assignedColor === color.id;

                                            return (
                                                <button
                                                    key={color.id}
                                                    type="button"
                                                    disabled={isUsed}
                                                    onClick={() => {
                                                        const next = {
                                                            ...identity,
                                                            colorId: color.id,
                                                        };
                                                        saveIdentity(next);
                                                        setIdentity(next);
                                                        presenceRef.current?.setColor(
                                                            color.id,
                                                        );
                                                    }}
                                                    aria-pressed={isMine}
                                                    aria-label={`${color.label}${
                                                        isUsed ? "（使用中）" : ""
                                                    }`}
                                                    title={`${color.label}${
                                                        isUsed ? "（ほかの人が使用中）" : ""
                                                    }`}
                                                    className={[
                                                        "h-6 w-6 rounded-md border-2 transition-transform",
                                                        isMine
                                                            ? "border-ink"
                                                            : "border-transparent hover:scale-110",
                                                        isUsed
                                                            ? "cursor-not-allowed opacity-25"
                                                            : "",
                                                    ].join(" ")}
                                                    style={{ background: color.base }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mb-3 mt-3.5 h-px bg-line" />

                                <p className="text-[11px] text-muted">現在の執筆室</p>

                                <div className="mt-1 flex items-center justify-between gap-2">
                                    <h2 className="min-w-0 truncate text-[15px] font-semibold text-ink">
                                        {room.name || "名前のない部屋"}
                                    </h2>
                                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                                        <PeopleIcon />
                                        {state.members.length}人が在室
                                    </span>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                                        {ROOM_VISIBILITY_LABEL[room.visibility]}
                                    </span>
                                    {room.is_official && (
                                        <span className="rounded bg-amber-tint px-2 py-0.5 text-[10px] text-amber">
                                            公式
                                        </span>
                                    )}
                                    <span className="rounded bg-canvas px-2 py-0.5 text-[10px] text-muted">
                                        上限 {room.capacity}人
                                    </span>
                                </div>

                                {room.description && (
                                    <p className="mt-2.5 line-clamp-3 text-[11px] leading-relaxed text-muted">
                                        {room.description}
                                    </p>
                                )}

                                {/*
                                 * 部屋を閉じるのも、人を誘うのも部屋主の仕事。
                                 * ほかの人には出さない。
                                 * 押せないものが並んでいても迷うだけ。
                                 */}
                                {isHost && (
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsClosing(true)}
                                        className="flex-1 rounded-lg border border-line py-2 text-center text-[12px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                    >
                                        部屋を閉じる
                                    </button>

                                    {/*
                                     * 誘う先は部屋そのものなので、
                                     * 部屋の説明のすぐ下に置く。
                                     * 下の帯は「いま何をするか」の場所で、
                                     * 人を呼ぶのはそれとは別の話。
                                     */}
                                    {room.visibility === "link" && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await navigator.clipboard.writeText(
                                                    window.location.href,
                                                );
                                                setCopied(true);
                                                window.setTimeout(
                                                    () => setCopied(false),
                                                    2000,
                                                );
                                            }}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[12px] text-muted hover:border-forest-line hover:text-forest"
                                        >
                                            <LinkIcon />
                                            {copied ? "コピーしました" : "URLをコピー"}
                                        </button>
                                    )}
                                </div>
                                )}
                            </section>

                            <RoomMembersCard
                                members={state.members}
                                selfId={identity.id}
                            />

                            {/*
                             * 繋がり方。
                             *
                             * 見本では「良好」とだけ出ているが、
                             * いまは同じブラウザの別タブとしか繋がらない。
                             * 良好と書くと、別の端末の人が見えないのを
                             * 不具合だと受け取られる。事実を書く。
                             */}
                            <section className="rounded-xl border border-line bg-surface px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted">接続状況</span>
                                    <span className="flex items-center gap-1.5 text-[11px] text-amber">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                                        この端末の中だけ
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
                                    <span className="flex items-center gap-1.5">
                                        <ClockIcon />
                                        <span className="tabular-nums">{clock}</span>
                                    </span>
                                    <span className="tabular-nums">ver {APP_VERSION}</span>
                                </div>

                                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                                    別の端末の人が見えるようにするにはサーバーが要ります。
                                </p>
                            </section>
                        </div>

                        {/* ===== 中央 ===== */}
                        <div className="flex min-w-0 flex-col gap-3">
                            <RoomFloor
                                maxHeight={paneHeight}
                                /*
                                 * 扉まで歩いたら、出るかを尋ねる。
                                 * 扉の前を通り抜けただけで出てしまうと、
                                 * 部屋の下側を歩けなくなる。
                                 */
                                onReachDoor={askToLeave}
                                onReport={(member) =>
                                    setReporting({
                                        target: "member",
                                        accusedId: member.id,
                                        accusedName: member.display_name,
                                    })
                                }
                                capacity={room.capacity}
                                members={state.members}
                                /* 集中モード中は床に吹き出しを出さない */
                                messages={isFocusing ? [] : state.messages}
                                selfId={identity.id}
                                onMove={(x, y) => {
                                    presenceRef.current?.move(x, y);
                                    /* 次に戻ってきたとき、ここに立っている */
                                    saveLastSpot(room.id, x, y);
                                }}
                            />

                            {/*
                             * 集中の時間は部屋のすぐ下に置く。
                             * 見本では画面の一番下に横帯として出ているが、
                             * そこは他の操作と並んでいて、
                             * 始めた時間が見えなくなる場所だった。
                             */}
                            {/*
                             * 操作の帯。
                             *
                             * 見本では画面のいちばん下に横一列で置かれている。
                             * 部屋を見ながら手が届く場所なので、そこへ寄せた。
                             * 上の帯と同じものは並べない。
                             * 同じボタンが 2 つあると、どちらが効くのか迷う。
                             */}
                            <div className="flex flex-wrap items-stretch justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3">
                                {/*
                                 * 声と画面共有。
                                 *
                                 * 見本にはあるが、まだ動かせない。
                                 * 端末どうしを直に繋ぐ仕組み（WebRTC）が要る。
                                 *
                                 * 消さずに、押せない状態で置いている。
                                 * 後から足すと帯の並びが変わり、
                                 * 指が覚えた位置がずれる。
                                 */}
                                <ActionButton
                                    icon={<MicIcon />}
                                    label="マイク"
                                    note="準備中"
                                    disabled
                                />

                                <ActionButton
                                    icon={<ScreenIcon />}
                                    label="画面共有"
                                    note="準備中"
                                    disabled
                                />

                                {/*
                                 * 集中モード。
                                 * 上のバーを外したので、入口はここだけになった。
                                 * 15 分で固定する。始める前に長さを選ぶと、
                                 * 決めるところで一度手が止まる。
                                 */}
                                <ActionButton
                                    icon={<HeadphoneIcon />}
                                    label="集中モード"
                                    note={
                                        isFocusing
                                            ? `${Math.floor(focusLeft / 60)}:${String(
                                                  focusLeft % 60,
                                              ).padStart(2, "0")}`
                                            : "OFF"
                                    }
                                    isOn={isFocusing}
                                    onClick={() =>
                                        setFocusUntil(
                                            isFocusing ? null : Date.now() + 15 * 60 * 1000,
                                        )
                                    }
                                />

                                <ActionButton
                                    icon={<PenIcon />}
                                    label="執筆しに行く"
                                    isPrimary
                                    onClick={() => router.push("/")}
                                />

                                {room.host_id && (
                                    <ActionButton
                                        icon={<GearIcon />}
                                        label="部屋の設定"
                                        onClick={() => setIsManaging(true)}
                                    />
                                )}

                                <ActionButton
                                    icon={<ExitIcon />}
                                    label="退出する"
                                    isDanger
                                    onClick={askToLeave}
                                />
                            </div>
                        </div>

                        {/* ===== 右 ===== */}
                        {/*
                         * 部屋の絵と同じ高さに収める。
                         * きまりごとを開いたぶんだけチャットが縮み、
                         * 柱全体の高さは変わらない。
                         */}
                        <div
                            className="flex flex-col gap-3"
                            style={{ height: paneHeight }}
                        >
                            <div className="shrink-0">
                                <RoomRulesCard />
                            </div>

                            {isFocusing ? (
                                /*
                                 * 集中モード中。
                                 *
                                 * チャットを隠すのではなく、覆って残り時間を出す。
                                 * 消してしまうと右の柱の高さが変わり、
                                 * 解除したときに画面が飛ぶ。
                                 */
                                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface px-6 text-center">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-tint text-forest">
                                        <HeadphoneIcon large />
                                    </span>
                                    <p className="text-[14px] font-semibold text-ink">
                                        集中モード
                                    </p>
                                    <p className="text-[24px] font-semibold tabular-nums text-forest">
                                        {Math.floor(focusLeft / 60)}:
                                        {String(focusLeft % 60).padStart(2, "0")}
                                    </p>
                                    <p className="max-w-[20em] text-[11px] leading-relaxed text-muted">
                                        話しかけられても気づかない状態です。
                                        届いた言葉は解除したときにまとめて読めます。
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setFocusUntil(null)}
                                        className="mt-1 rounded-lg border border-line px-5 py-2 text-[12px] text-muted hover:text-ink"
                                    >
                                        いま解除する
                                    </button>
                                </div>
                            ) : (
                            <div className="min-h-0 flex-1">
                                <RoomChatCard
                                    onReport={(message) =>
                                        setReporting({
                                            target: "message",
                                            accusedId: message.member_id,
                                            accusedName: message.member_name,
                                            quotedBody: message.body,
                                        })
                                    }
                                    messages={state.messages}
                                    selfId={identity.id}
                                    canSpeak={canSpeak}
                                    canStamp={room.allow_stamps}
                                    onSendText={(body) =>
                                        presenceRef.current?.send({
                                            room_id: room.id,
                                            member_id: identity.id,
                                            member_name: identity.name,
                                            kind: "text",
                                            body,
                                        })
                                    }
                                    onSendStamp={(stampId) =>
                                        presenceRef.current?.send({
                                            room_id: room.id,
                                            member_id: identity.id,
                                            member_name: identity.name,
                                            kind: "stamp",
                                            body: stampId,
                                        })
                                    }
                                />
                            </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/*
             * 部屋を閉じる。
             *
             * 中にいる人がいるので、押した瞬間には閉じない。
             * 何が起きるかを伝えてから尋ねる。
             */}
            {isClosing && room && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
                    <div className="w-full max-w-sm rounded-xl bg-surface px-6 py-5">
                        <p className="text-sm font-medium text-ink">
                            この部屋を閉じますか
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-muted">
                            いま入っている人は、部屋から出ることになります。
                            閉じた部屋には、もう誰も入れません。
                        </p>

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsClosing(false)}
                                className="flex-1 rounded-lg border border-line py-2.5 text-xs text-ink hover:bg-canvas"
                            >
                                やめる
                            </button>

                            <button
                                type="button"
                                onClick={async () => {
                                    await getRepository().deleteRoom(room.id);
                                    router.push("/rooms");
                                }}
                                className="flex-1 rounded-lg bg-[var(--color-danger)] py-2.5 text-xs font-medium text-white hover:opacity-90"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

/**
 * ============================================================
 * 下の帯のボタン
 *
 * 図案・名前・小さな添え書きを縦に積む。
 * 見本と同じ形にしてある。
 *
 * まだ動かせないものは押せない状態で置く。
 * 消してしまうと、後から足したときに並びが変わり、
 * 指が覚えた位置がずれる。
 * ============================================================
 */

function ActionButton({
    icon,
    label,
    note,
    onClick,
    disabled = false,
    isOn = false,
    isPrimary = false,
    isDanger = false,
}: {
    icon: React.ReactNode;
    label: string;
    note?: string;
    onClick?: () => void;
    disabled?: boolean;
    /** 入っている状態か。集中モードとタイマーで使う */
    isOn?: boolean;
    /** いちばん押してほしいものか */
    isPrimary?: boolean;
    /** 押すとこの画面から出るものか */
    isDanger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={onClick && !isPrimary ? isOn : undefined}
            title={disabled ? `${label}（準備中）` : label}
            className={[
                "flex min-w-[104px] flex-col items-center justify-center gap-1 rounded-lg border px-4 py-2.5",
                disabled
                    ? "cursor-not-allowed border-line text-faint opacity-60"
                    : isPrimary
                      ? "border-forest-dark bg-forest-dark text-white hover:opacity-90"
                      : isDanger
                        ? "border-line text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                        : isOn
                          ? "border-forest bg-forest-tint text-forest"
                          : "border-line text-muted hover:border-forest-line hover:text-forest",
            ].join(" ")}
        >
            {icon}
            <span className="text-[12px] font-medium">{label}</span>
            {note && (
                <span
                    className={[
                        "text-[10px]",
                        isPrimary ? "text-white/75" : "text-faint",
                    ].join(" ")}
                >
                    {note}
                </span>
            )}
        </button>
    );
}

/**
 * ============================================================
 * 執筆室のきまり
 *
 * 部屋に入っている人どうしの約束ごと。
 * 上から順に、守られないと困る度合いが強いものを並べる。
 * ============================================================
 */

const ROOM_RULES: {
    title: string;
    body: string;
    icon: RuleIconName;
    /** 「詳しく見る」で開く。ここでしか読めない中身にする */
    detail: string;
}[] = [
    {
        title: "互いに集中を尊重しましょう",
        body: "静かな環境で、作品と向き合いましょう。",
        icon: "quiet",
        detail:
            "打鍵音や独り言も、同じ部屋にいる人には届きます。書けない時間があってもいい場所なので、進み具合を互いに急かさないでください。",
    },
    {
        title: "誹謗中傷・迷惑行為は禁止です",
        body: "思いやりを持って利用しましょう。",
        icon: "ban",
        detail:
            "作品への感想と、書き手への攻撃は別のものです。読んでいないのに否定する、しつこく返事を求める、といった行為も含みます。見かけたら部屋を立てた人に伝えてください。",
    },
    {
        title: "宣伝・勧誘はご遠慮ください",
        body: "執筆の場を大切にしましょう。",
        icon: "megaphone",
        detail:
            "自分の作品の告知は、聞かれたときに答える程度に留めてください。外のサービスへの誘導や、繰り返しの宣伝は控えるようお願いします。",
    },
    {
        title: "長時間の離席は一言お知らせを",
        body: "みんなが気持ちよく使えます。",
        icon: "bell",
        detail:
            "状態を「離席中」にしておけば一言は要りません。上限のある部屋では、長く空けたままだと入れない人が出ます。",
    },
];

/**
 * きまりごと。
 *
 * 「詳しく見る」は別のページへ飛ばさず、その場で開く。
 * 部屋にいる間に読むものなので、
 * 画面を離れさせると戻ってこない。
 */
function RoomRulesCard() {
    const [isDetailed, setIsDetailed] = useState(false);

    return (
        <section className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <h2 className="text-[13px] font-semibold text-ink">執筆室のルール</h2>

            <ul className="mt-2 space-y-1.5">
                {ROOM_RULES.map((rule) => (
                    <li
                        key={rule.title}
                        className="flex gap-2.5 rounded-lg bg-canvas px-3 py-2"
                    >
                        {/*
                         * きまりごとに別の図案を置く。
                         * 全部が同じ印だと、上から順に読むしかない。
                         * 一度読んだあとは、印だけで思い出せるようにする。
                         */}
                        <span className="mt-0.5 shrink-0 text-forest">
                            <RuleIcon name={rule.icon} />
                        </span>
                        {/*
                         * 畳んでいるときは題だけにする。
                         *
                         * 4 つとも 2 行あると、右の柱の半分が
                         * きまりごとで埋まってチャットが押し出される。
                         * 一度読めば題だけで思い出せる。
                         */}
                        <span className="min-w-0">
                            <span className="block text-[12px] font-medium leading-snug text-ink">
                                {rule.title}
                            </span>
                            {isDetailed && (
                                <>
                                    <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                                        {rule.body}
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                                        {rule.detail}
                                    </span>
                                </>
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={() => setIsDetailed((open) => !open)}
                aria-expanded={isDetailed}
                className="mt-2 block w-full rounded-lg border border-line py-1.5 text-center text-[11px] text-muted hover:border-forest-line hover:text-forest"
            >
                {isDetailed ? "閉じる" : "ルールを詳しく見る"}
            </button>
        </section>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function stroke(width = 2) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

function BookIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...stroke(1.8)}>
            <path d="M3.5 5.2A1.7 1.7 0 0 1 5.2 3.5H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
            <path d="M20.5 5.2a1.7 1.7 0 0 0-1.7-1.7H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h5.2a1.7 1.7 0 0 0 1.7-1.7Z" />
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

type RuleIconName = "quiet" | "ban" | "megaphone" | "bell";

function RuleIcon({ name }: { name: RuleIconName }) {
    const common = { width: 15, height: 15, viewBox: "0 0 24 24", ...stroke(1.9) };

    /* 静けさ。口に指を当てた形は小さすぎて潰れるので、音を消した印にする */
    if (name === "quiet") {
        return (
            <svg {...common}>
                <path d="M11 5 6.5 8.5H3.5v7h3L11 19Z" />
                <path d="m16 9.5 5 5M21 9.5l-5 5" />
            </svg>
        );
    }
    if (name === "ban") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="8.5" />
                <path d="m6 6 12 12" />
            </svg>
        );
    }
    if (name === "megaphone") {
        return (
            <svg {...common}>
                <path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h1.5l7 4.5v-16l-7 4.5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
                <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 1.8" />
        </svg>
    );
}

function MicIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" {...stroke(1.9)}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
        </svg>
    );
}

function ScreenIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" {...stroke(1.9)}>
            <rect x="3" y="4.5" width="18" height="12" rx="2" />
            <path d="M8.5 20.5h7M12 16.5v4" />
        </svg>
    );
}

function ExitIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2)}>
            <path d="M14 20.5H6.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H14" />
            <path d="m15.5 8 4 4-4 4M19.5 12H9.5" />
        </svg>
    );
}

function PenIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2.2)}>
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}

function HeadphoneIcon({ large = false }: { large?: boolean }) {
    const size = large ? 24 : 18;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.9)}>
            <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
            <path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H17a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h.5A2.5 2.5 0 0 1 20 14.5Z" />
            <path d="M4 15.5A2.5 2.5 0 0 0 6.5 18H7a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-.5A2.5 2.5 0 0 0 4 14.5Z" />
        </svg>
    );
}

function LinkIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2)}>
            <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" />
            <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
        </svg>
    );
}

function GearIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" {...stroke(2.2)}>
            {/*
             * 歯車。中心から線を伸ばすと太陽に見えるので、
             * 外周に歯を並べた形にする。
             */}
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z" />
        </svg>
    );
}
