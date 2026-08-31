/**
 * ============================================================
 * 原石航路 Studio
 * CommunityClient — コミュニティー
 *
 * 書き手どうしが交わる場所を、ここ 1 つにまとめる。
 *
 *   左  … どこを見るかを選ぶ柱
 *   中央 … タイムライン、または執筆室の一覧
 *   右  … 執筆室への入口と、いま起きていること
 *
 * ------------------------------------------------------------
 * 3 列にした理由
 *
 * つぶやきと執筆室は、どちらも「人がいる」ことを見せるもの。
 * 頁を分けると、どちらも人が居合わせない場所になる。
 * 同じ画面に並べて、片方を見に来た人が
 * もう片方に気づくようにする。
 *
 * 狭い画面では 1 列に積む。
 * 左の柱は上のタブに、右は中央の下に回す。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Header from "@/components/layout/header";
import TweetSection from "@/components/tweet-section";
import RoomsPanel from "@/components/community/rooms-panel";
import RoomCodeEntry from "@/components/community/room-code-entry";
import {
    DirectPanel,
    NoticePanel,
    ProfilePanel,
} from "@/components/community/panels";
import { createClient } from "@/lib/supabase/client";
import { getRepository } from "@/lib/repository";
import { backgroundFor } from "@/lib/room/room-backgrounds";
import { hasSupabase } from "@/config/env.client";
import type { WritingRoom } from "@/types";

/**
 * 左の柱に並べる、この画面の中の行き先。
 *
 * 押すと中央が替わる。頁は移らない。
 */
const VIEWS = [
    { key: "timeline", label: "タイムライン", icon: <HomeIcon /> },
    { key: "rooms", label: "執筆室", icon: <DoorIcon /> },
    { key: "mine", label: "自分のつぶやき", icon: <PenIcon /> },
    { key: "following", label: "フォロー中", icon: <PeopleIcon /> },
    { key: "notices", label: "お知らせ", icon: <BellIcon /> },
    { key: "bookmarks", label: "ブックマーク", icon: <BookmarkIcon /> },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export interface Topic {
    key: string;
    label: string;
    count: number;
}

export default function CommunityClient() {
    /*
     * どこを見ているか。
     *
     * ?view=dm のように渡されたら、そこを開く。
     * 作者ページの「メッセージ」から来た人を、
     * 一覧の先頭ではなく DM へ着地させる。
     */
    const [view, setView] = useState<ViewKey>("timeline");

    useEffect(() => {
        const asked = new URLSearchParams(window.location.search).get("view");
        if (asked && VIEWS.some((row) => row.key === asked)) {
            setView(asked as ViewKey);
        }
    }, []);
    const [topic, setTopic] = useState<string | null>(null);

    const [rooms, setRooms] = useState<WritingRoom[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    /*
     * 未読の数。
     *
     * 左の柱に印を出す。
     * 押して開くまで届いたことに気づけないと、
     * 通知も DM も見られないまま溜まる。
     */
    const [unread, setUnread] = useState({ notices: 0, dm: 0 });
    /* 運営が「お知らせ」のテーマで書いたつぶやき */
    const [official, setOfficial] = useState<{ id: string; body: string }[]>([]);
    /* 使い方の案内を出しているか */
    const [isHintOpen, setIsHintOpen] = useState(true);
    const [total, setTotal] = useState(0);

    const [me, setMe] = useState<{
        id: string | null;
        name: string | null;
        icon: string | null;
    }>({ id: null, name: null, icon: null });

    const reload = useCallback(async () => {
        setRooms(await getRepository().listRooms());

        /*
         * 自分が誰か。
         *
         * 認証から直接引く。
         * getProfile() は端末の中の設定も混ぜて返すので、
         * ログインしていても user_id が入らないことがある。
         * つぶやくには「本当にログインしているか」が要る。
         */
        if (!hasSupabase()) {
            setMe({ id: null, name: null, icon: null });
            return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setMe({ id: null, name: null, icon: null });
            return;
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, icon_url")
            .eq("user_id", user.id)
            .maybeSingle();

        setMe({
            id: user.id,
            name: profile?.display_name ?? "名前のない書き手",
            icon: profile?.icon_url ?? null,
        });
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    /* 未読を数える */
    useEffect(() => {
        if (!me.id || !hasSupabase()) return;

        void (async () => {
            const supabase = createClient();

            const { count: notices } = await supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("user_id", me.id)
                .eq("is_read", false);

            /*
             * DM は、自分の会話に届いた未読を数える。
             * 会話の id を先に引いてから数える。
             */
            const { data: convs } = await supabase
                .from("conversations")
                .select("id")
                .or(`user_a.eq.${me.id},user_b.eq.${me.id}`);

            let dm = 0;
            if (convs && convs.length > 0) {
                const { count } = await supabase
                    .from("direct_messages")
                    .select("id", { count: "exact", head: true })
                    .in("conversation_id", convs.map((c: { id: string }) => c.id))
                    .eq("is_read", false)
                    .neq("sender_id", me.id);
                dm = count ?? 0;
            }

            setUnread({ notices: notices ?? 0, dm });
        })();
    }, [me.id, view]);

    /*
     * テーマと、その件数。
     *
     * 件数を出すのは、賑わっている所が分かるようにするため。
     * 0 件のテーマだけが並ぶと、どこから読めばよいか分からない。
     */
    useEffect(() => {
        if (!hasSupabase()) return;

        void (async () => {
            const supabase = createClient();

            const [{ data: rows }, { count }] = await Promise.all([
                supabase
                    .from("tweet_topics")
                    .select("key, label, sort_order")
                    .order("sort_order"),
                supabase
                    .from("tweets")
                    .select("id", { count: "exact", head: true }),
            ]);

            setTotal(count ?? 0);

            /*
             * 表がまだ無ければ、決め打ちの一覧を使う。
             * テーマが 1 つも出ないと、絞り込みそのものが消える。
             */
            const list =
                rows && rows.length > 0
                    ? rows
                    : [
                          { key: "chat", label: "雑談" },
                          { key: "trouble", label: "創作の悩み" },
                          { key: "plot", label: "プロット・設定" },
                          { key: "technique", label: "執筆テクニック" },
                          { key: "favorite", label: "推し・感想" },
                          { key: "recruit", label: "企画・募集" },
                          { key: "other", label: "その他" },
                      ];

            /*
             * 件数はテーマごとに数える。
             * 1 回で取れると速いが、その書き方は集計の設定が要る。
             * テーマは 10 個ほどなので、並べて数えても支障はない。
             */
            const counted = await Promise.all(
                list.map(async (row: { key: string; label: string }) => {
                    const { count: n } = await supabase
                        .from("tweets")
                        .select("id", { count: "exact", head: true })
                        .eq("topic", row.key);
                    return { key: row.key, label: row.label, count: n ?? 0 };
                }),
            );

            setTopics(counted);

            /* 公式からのお知らせ */
            const { data: notices } = await supabase
                .from("tweets")
                .select("id, body")
                .eq("topic", "notice")
                .order("created_at", { ascending: false })
                .limit(3);

            setOfficial(notices ?? []);
        })();
    }, []);

    const openRooms = rooms.filter((room) => room.visibility === "open");
    const myRooms = rooms.filter((room) => room.visibility !== "open");

    return (
        <div className="min-h-screen bg-page">
            <Header breadcrumbs={[{ label: "コミュニティー" }]} />

            <main className="mx-auto max-w-[1400px] px-5 py-5 sm:px-6">
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
                    {/* ===== 左 ===== */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-20">
                            <Link
                                href="#compose"
                                onClick={() => setView("timeline")}
                                className="flex items-center justify-center gap-2 rounded-lg bg-forest-dark py-3 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                <PenIcon />
                                つぶやく
                            </Link>

                            <nav className="mt-4 space-y-0.5">
                                {VIEWS.map((row) => {
                                    const isOn = view === row.key;
                                    return (
                                        <button
                                            key={row.key}
                                            type="button"
                                            onClick={() => setView(row.key)}
                                            aria-current={isOn ? "page" : undefined}
                                            className={[
                                                "flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[13px]",
                                                isOn
                                                    ? "bg-forest-tint font-semibold text-forest"
                                                    : "text-muted hover:bg-canvas hover:text-ink",
                                            ].join(" ")}
                                        >
                                            <span className="shrink-0">{row.icon}</span>
                                            <span className="min-w-0 flex-1">
                                                {row.label}
                                            </span>

                                            {/* 未読の数 */}
                                            {row.key === "notices" && unread.notices > 0 && (
                                                <span className="shrink-0 rounded-full bg-[var(--color-danger)] px-2 py-0.5 text-[10px] text-white">
                                                    {unread.notices}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>

                            {/* テーマ */}
                            {topics.length > 0 && (
                                <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4">
                                    <p className="text-[12px] font-semibold text-ink">
                                        テーマで探す
                                    </p>

                                    <ul className="mt-2.5 space-y-1">
                                        <TopicRow
                                            label="すべて"
                                            count={total}
                                            isOn={topic === null}
                                            onClick={() => setTopic(null)}
                                        />
                                        {topics.map((row) => (
                                            <TopicRow
                                                key={row.key}
                                                label={row.label}
                                                count={row.count}
                                                isOn={topic === row.key}
                                                onClick={() => setTopic(row.key)}
                                            />
                                        ))}
                                    </ul>

                                    {/*
                                     * テーマの提案。
                                     *
                                     * 増やせるのは運営だけ。
                                     * 誰でも足せると、似たテーマが並んで
                                     * どこに書けばいいか分からなくなる。
                                     *
                                     * 送り先は問い合わせ。
                                     * 専用の窓口を作るほどの数は来ない。
                                     */}
                                    <Link
                                        href="/contact?about=topic"
                                        className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        <BulbIcon />
                                        テーマを提案する
                                    </Link>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ===== 中央 ===== */}
                    <div className="min-w-0">
                        {/*
                         * 狭い画面用の切り替え。
                         *
                         * 広い画面では左の柱に同じものが出ているので隠す。
                         * 同じ行き先が 2 か所にあると、
                         * どちらを押せばいいのか分からなくなる。
                         */}
                        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line lg:hidden">
                            {VIEWS.map((row) => (
                                <button
                                    key={row.key}
                                    type="button"
                                    onClick={() => setView(row.key)}
                                    className={[
                                        "relative shrink-0 px-4 py-2.5 text-[13px]",
                                        view === row.key
                                            ? "font-semibold text-forest"
                                            : "text-muted",
                                    ].join(" ")}
                                >
                                    {row.label}
                                    {view === row.key && (
                                        <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-t bg-forest" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {view === "rooms" ? (
                            <RoomsPanel
                                openRooms={openRooms}
                                myRooms={myRooms}
                                onChanged={reload}
                                isNarrow
                            />
                        ) : view === "notices" ? (
                            <NoticePanel userId={me.id} />
                        ) : (
                            <div>
                                <TweetSection
                                    /*
                                     * 何を出すか。
                                     *
                                     * 「つぶやき」は自分のもの、
                                     * 「フォロー中」は追っている人のもの、
                                     * 「ブックマーク」は控えたもの。
                                     * どれも並ぶのは同じつぶやきなので、
                                     * 部品は 1 つで、渡すものだけを変える。
                                     */
                                    authorId={view === "mine" ? me.id : null}
                                    scope={
                                        view === "bookmarks"
                                            ? "bookmarks"
                                            : view === "following"
                                              ? "following"
                                              : "all"
                                    }
                                    topic={topic}
                                    currentUserId={me.id}
                                    currentUserName={me.name}
                                    currentUserIconUrl={me.icon}
                                    isOwner={Boolean(me.id)}
                                />
                            </div>
                        )}
                    </div>

                    {/* ===== 右 ===== */}
                    <aside className="hidden space-y-4 xl:block">
                        <div className="sticky top-20 space-y-4">
                            {/* おすすめの執筆室 */}
                            <section className="rounded-xl border border-line bg-surface px-4 py-4">
                                <div className="flex items-baseline justify-between gap-2">
                                    <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                                        <span className="text-forest">
                                            <DoorIcon />
                                        </span>
                                        おすすめの執筆室
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setView("rooms")}
                                        className="shrink-0 text-[11px] text-muted hover:text-forest"
                                    >
                                        すべて見る ›
                                    </button>
                                </div>

                                {openRooms.length === 0 ? (
                                    <p className="mt-3 text-[11px] leading-relaxed text-muted">
                                        いま開いている部屋はありません。
                                    </p>
                                ) : (
                                    <ul className="thin-scroll mt-3 flex gap-2.5 overflow-x-auto pb-1">
                                        {openRooms.slice(0, 6).map((room) => (
                                            <li key={room.id} className="w-[128px] shrink-0">
                                                <Link
                                                    href={`/rooms/${room.id}`}
                                                    className="block overflow-hidden rounded-lg border border-line hover:border-forest-line"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={backgroundFor(room.capacity).src}
                                                        alt=""
                                                        className="block h-[70px] w-full object-cover"
                                                        style={{ objectPosition: "center 38%" }}
                                                    />

                                                    <span className="block px-2.5 py-2">
                                                        <span className="block truncate text-[12px] font-medium text-ink">
                                                            {room.name || "名前のない部屋"}
                                                        </span>
                                                        <span className="mt-1 flex items-center gap-1 text-[10px] text-faint">
                                                            <PeopleIcon />
                                                            上限 {room.capacity} 人
                                                        </span>
                                                        <span className="mt-1.5 line-clamp-2 block text-[10px] leading-relaxed text-muted">
                                                            {room.description || "説明はありません。"}
                                                        </span>
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <Link
                                        href="/rooms/new"
                                        className="flex items-center justify-center gap-1.5 rounded-lg bg-forest-dark py-2.5 text-[11.5px] font-medium text-white hover:opacity-90"
                                    >
                                        <PlusIcon />
                                        部屋を立てる
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setView("rooms")}
                                        className="flex items-center justify-center gap-1.5 rounded-lg border border-line py-2.5 text-[11.5px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        <SearchIcon />
                                        執筆室を探す
                                    </button>
                                </div>
                            </section>

                            {/*
                             * 番号で入る。
                             *
                             * おすすめの部屋のすぐ下に置く。
                             * 一覧に出ない部屋へ入る手段なので、
                             * 一覧を見て「無い」と分かった直後に目に入る場所がよい。
                             */}
                            <RoomCodeEntry />

                            {/* 自分の執筆室 */}
                            {myRooms.length > 0 && (
                                <section className="rounded-xl border border-line bg-surface px-4 py-4">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <h2 className="text-[13px] font-semibold text-ink">
                                            自分の執筆室
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => setView("rooms")}
                                            className="shrink-0 text-[11px] text-muted hover:text-forest"
                                        >
                                            すべて見る ›
                                        </button>
                                    </div>

                                    <ul className="mt-3 space-y-2.5">
                                        {myRooms.slice(0, 3).map((room) => (
                                            <li key={room.id} className="flex items-center gap-2.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={backgroundFor(room.capacity).src}
                                                    alt=""
                                                    className="h-10 w-14 shrink-0 rounded object-cover"
                                                    style={{ objectPosition: "center 38%" }}
                                                />

                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[12px] font-medium text-ink">
                                                        {room.name || "名前のない部屋"}
                                                    </span>
                                                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-faint">
                                                        <PeopleIcon />
                                                        上限 {room.capacity} 人
                                                    </span>
                                                </span>

                                                <Link
                                                    href={`/rooms/${room.id}`}
                                                    className="shrink-0 rounded-md bg-forest-dark px-3 py-1.5 text-[11px] text-white hover:opacity-90"
                                                >
                                                    入室する
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/*
                             * 使い方。
                             *
                             * 右の柱は、部屋が無いときに丸ごと空になる。
                             * 何を書けばいい場所なのかを、ここで補う。
                             *
                             * 押して閉じられるようにする。
                             * 分かった人に、毎回同じ文を見せない。
                             */}
                            {isHintOpen && (
                                <section className="rounded-xl border border-line bg-surface px-4 py-4">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <h2 className="text-[13px] font-semibold text-ink">
                                            コミュニティーの使い方
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => setIsHintOpen(false)}
                                            className="shrink-0 text-[11px] text-faint hover:text-ink"
                                        >
                                            閉じる
                                        </button>
                                    </div>

                                    <ul className="mt-3 space-y-3">
                                        {[
                                            {
                                                title: "つぶやく",
                                                body: "進み具合や、詰まっていることを短く。返事が来なくても構いません。",
                                            },
                                            {
                                                title: "執筆室に入る",
                                                body: "同じ時間に書いている人がいる、と分かるだけで続きます。",
                                            },
                                            {
                                                title: "アンケートを使う",
                                                body: "迷っている設定や題名を、選択肢にして聞けます。",
                                            },
                                        ].map((row) => (
                                            <li key={row.title}>
                                                <p className="text-[12px] font-medium text-ink">
                                                    {row.title}
                                                </p>
                                                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                                                    {row.body}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* 人気のテーマ */}
                            {topics.length > 0 && (
                                <section className="rounded-xl border border-line bg-surface px-4 py-4">
                                    <h2 className="text-[13px] font-semibold text-ink">
                                        人気のテーマ
                                    </h2>

                                    <ul className="mt-3 space-y-1">
                                        {[...topics]
                                            .sort((a, b) => b.count - a.count)
                                            .slice(0, 5)
                                            .map((row) => (
                                                <TopicRow
                                                    key={row.key}
                                                    label={row.label}
                                                    count={row.count}
                                                    isOn={topic === row.key}
                                                    onClick={() => {
                                                        setTopic(row.key);
                                                        setView("timeline");
                                                    }}
                                                />
                                            ))}
                                    </ul>
                                </section>
                            )}

                            {/*
                             * 公式からのお知らせ。
                             *
                             * 運営が「お知らせ」のテーマで書いたつぶやきを出す。
                             * 別の仕組みを作らず、同じ流れに乗せる。
                             */}
                            {official.length > 0 && (
                                <section className="rounded-xl border border-line bg-surface px-4 py-4">
                                    <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                                        <span className="text-forest">
                                            <MegaphoneIcon />
                                        </span>
                                        公式からのお知らせ
                                    </h2>

                                    <ul className="mt-3 space-y-2.5">
                                        {official.map((row) => (
                                            <li
                                                key={row.id}
                                                className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted"
                                            >
                                                {row.body}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                    </aside>

                </div>
            </main>

            {/*
              * 投稿する。
              *
              * ★ 携帯だけ。右下に浮かせる。
              *
              *   柱を出さない代わりに、投稿の入口が要る。
              *   上まで戻らないと書けないのでは、
              *   思いついたときに書き留められない。
              *
              *   view が「タイムライン」のときだけ出す。
              *   執筆室やお知らせでは、投稿する先が違う。
              */}
            {view === "timeline" && (
                <a href="#compose" className="cm-fab">
                    <span className="cm-fab-icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20c6-1 10-4 13-9 1.5-2.5 2-4.5 2-7-3 .5-5.5 1.5-8 3.5C7 10.5 5 14.5 4 20Z" />
                            <path d="M4 20c2.5-2.5 5-4.5 8-6" />
                        </svg>
                    </span>
                    <span className="cm-fab-label">投稿する</span>
                </a>
            )}
        </div>
    );
}

/**
 * テーマ 1 行。
 *
 * 件数を右に置く。
 * 数が揃っていると、賑わっている所がひと目で分かる。
 */
function TopicRow({
    label,
    count,
    isOn,
    onClick,
}: {
    label: string;
    count: number;
    isOn: boolean;
    onClick: () => void;
}) {
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                aria-pressed={isOn}
                className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
                    isOn
                        ? "bg-forest-tint font-medium text-forest"
                        : "text-muted hover:bg-canvas hover:text-ink",
                ].join(" ")}
            >
                <span className="shrink-0 text-faint">#</span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-faint">
                    {count}
                </span>
            </button>
        </li>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function stroke(width = 1.8) {
    return {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
}

function HomeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />
        </svg>
    );
}

function DoorIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
            <path d="M4 21h16M14.5 12.5v.01" />
        </svg>
    );
}

function PenIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M4.5 19.5h3.6L19.4 8.2a2.6 2.6 0 0 0-3.6-3.6L4.5 15.9Z" />
            <path d="m14.6 5.8 3.6 3.6" />
        </svg>
    );
}

function PeopleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <circle cx="9" cy="8.5" r="3" />
            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
            <path d="M16 6a3 3 0 0 1 0 5M17.5 14.5c2 .6 3.5 2.3 3.5 4.5" />
        </svg>
    );
}

function BellIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
        </svg>
    );
}

function MailIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <rect x="3" y="5.5" width="18" height="13" rx="2" />
            <path d="m3.8 7 8.2 6 8.2-6" />
        </svg>
    );
}

function PersonIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2.2)}>
            <path d="M12 5.5v13M5.5 12h13" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke(2)}>
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m15.5 15.5 4 4" />
        </svg>
    );
}

function MegaphoneIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" {...stroke()}>
            <path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h1.5l7 4.5v-16l-7 4.5H5a1.5 1.5 0 0 0-1.5 1.5Z" />
            <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
        </svg>
    );
}

function BulbIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" {...stroke()}>
            <path d="M9.5 17.5h5M10.5 20.5h3" />
            <path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6h-5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" />
        </svg>
    );
}

function BookmarkIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" {...stroke()}>
            <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" />
        </svg>
    );
}
