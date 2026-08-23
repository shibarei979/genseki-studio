/**
 * ============================================================
 * 原石航路 Studio
 * Header — 全画面共通のヘッダー
 *
 * 左からロゴ、行き先、右端に通知とアイコン。
 * 行き先はロゴから離し、右の 2 つは互いに離す。
 * 詰めて並べると、どれが別の役目のものか分からなくなる。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import AccountMenu from "@/components/layout/account-menu";
import RoomPresenceBar from "@/components/room/room-presence-bar";
import { getRepository } from "@/lib/repository";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { NOTICES } from "@/types";

/** 読んだお知らせの記録。ここより新しいものに点をつける */
/** 「何分前」の言い方。時刻が読めなければ何も出さない */
function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";

    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}か月前`;
    return `${Math.floor(months / 12)}年前`;
}

const SEEN_KEY = "genseki:notices-seen-at";

/*
 * 行き先。
 *
 * 「作品を書く」をホームの隣に置く。
 * このサイトで真っ先にする用なので、
 * アカウントの一覧に隠れていると毎回探すことになる。
 *
 * 「ランキング」は外した。
 * 並べ方が決まっておらず、中身も無い。
 * 押せる場所が用意だけされていると、
 * 何度か押して空振りしたあと、二度と押されなくなる。
 */
const NAV_ITEMS: {
    href: string;
    label: string;
    /** 運営が入切する機能。切っていれば出さない */
    feature?: string;
    /**
     * 執筆集中モードでは出さないもの。
     *
     * 数を見ずに書きたい人に、順位の並びを見せない。
     */
    hideInFocus?: boolean;
    /** 読者向けのときだけ出す。執筆向けには出さない */
    readerOnly?: boolean;
    /** 執筆向けのときだけ出す。読者向けには出さない */
    writerOnly?: boolean;
}[] = [
    { href: "/", label: "ホーム" },
    /*
     * 「作品を書く」。
     * 読者向けモードでは出さない。
     * 読む人に執筆への入口を見せる必要はない。
     */
    { href: "/post", label: "作品を書く", writerOnly: true },
    /*
     * 「作品を探す」。
     * 中身（絞り込みと並べ替え）が入ったので出した。
     */
    { href: "/search", label: "作品を探す" },
    /*
     * 「ランキング」は「作品を探す」の隣。
     * どちらも作品を見つけるための道なので、並べて置く。
     */
    { href: "/ranking", label: "ランキング", hideInFocus: true },
    /*
     * 「おすすめ」。
     * 読む人だけの道なので、執筆向けには出さない。
     */
    { href: "/recommend", label: "おすすめ", readerOnly: true },
    { href: "/rooms", label: "コミュニティー", feature: "rooms" },
    /*
     * 「コンテスト」。
     * 読者向けモードでは出さない。
     * 賞に応募するのは書く側の用なので、読む人の道には置かない。
     */
    { href: "/contest", label: "コンテスト", feature: "contest", writerOnly: true },
];

interface Props {
    /** パンくず（左から順に並べる）。最後の要素が現在地 */
    breadcrumbs?: { label: string; href?: string }[];
    /**
     * 画面の上に貼り付けるか。
     *
     * 画面の高さちょうどに収める画面（執筆など）では切る。
     * 浮いたままだと場所を取らず、下段が押し出される。
     */
    sticky?: boolean;
}

export default function Header({ breadcrumbs = [], sticky = true }: Props) {
    const pathname = usePathname();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isNoticeOpen, setIsNoticeOpen] = useState(false);

    /*
     * 運営が切った機能。
     *
     * 切っているのに帯に出ていると、押しても何も無い所へ着く。
     * 出さないほうがよい。
     *
     * 読めるまでは全部出す。
     * 一瞬消えて出直すと、ちらついて見える。
     */
    const [offKeys, setOffKeys] = useState<string[]>([]);

    useEffect(() => {
        void (async () => {
            const flags = await getRepository().listFeatureFlags();

            setOffKeys(
                flags
                    .filter((flag) => flag.status !== "on")
                    .map((flag) => flag.key),
            );
        })();
    }, []);

    /*
     * 出す行き先。
     *
     * 運営が切った機能は出さない。
     * それに加えて「執筆に集中」の間は、
     * コミュニティーへの入口も出さない。
     * 消すのではなく、モードの間だけ隠す。
     */
    const isFocusWriting = profile?.home_mode === "focus";

    const isReaderMode = profile?.home_mode === "read";

    const shownNav = NAV_ITEMS.filter(
        (item) =>
            (!item.feature || !offKeys.includes(item.feature)) &&
            /* 集中モードでは、コミュニティーと順位を出さない */
            !(isFocusWriting && (item.href === "/rooms" || item.hideInFocus)) &&
            /* 読者向けのときだけ出す項目（執筆向けには出さない） */
            !(item.readerOnly && !isReaderMode) &&
            /* 執筆向けのときだけ出す項目（読者向けには出さない） */
            !(item.writerOnly && isReaderMode),
    );
    const [seenAt, setSeenAt] = useState<string | null>(null);
    /** 運営が立てたお知らせ。無ければ既定のものを出す */
    const [notices, setNotices] = useState<
        {
            id: string;
            date: string;
            label: string;
            /** 作られた時刻。「何分前」に使う */
            at: string;
            kind: string;
            body?: string;
            image?: string | null;
            link?: string;
        }[]
    >([]);
    /** 自分あての未読の便り。ベルに混ぜる */
    const [letters, setLetters] = useState<
        { id: string; subject: string; at: string }[]
    >([]);
    const noticeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void (async () => {
            const repository = getRepository();
            setProfile(await repository.getProfile());

            /*
             * 運営が立てたお知らせを読む。
             * 公開されていて、表に出す日が来たものだけ。
             */
            const today = new Date().toISOString().slice(0, 10);
            const rows = (await repository.listNotices()).filter(
                (row) => row.is_published && row.published_at <= today,
            );
            setNotices(
                rows.map((row) => ({
                    id: row.id,
                    date: row.published_at,
                    label: row.title,
                    at: row.created_at,
                    kind:
                        row.type === "release"
                            ? "release"
                            : row.type === "maintenance"
                              ? "maintenance"
                              : "info",
                    body: row.body,
                    image: row.image_url,
                    link: row.link,
                })),
            );

            /*
             * 自分あての個別の便りも、ベルに混ぜる。
             *
             * 届いたことに気づく場所はベルしかない。
             * 押すと、その便りが開いている状態で頁へ行く。
             * 運営からの返信も同じ道で届く。
             */
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (user) {
                    const { data: letters } = await supabase
                        .from("admin_messages")
                        .select("id, subject, created_at, is_read, from_user_id")
                        .eq("to_user_id", user.id)
                        .is("from_user_id", null)
                        .eq("is_read", false)
                        .order("created_at", { ascending: false })
                        .limit(20);

                    setLetters(
                        (letters ?? []).map((row) => ({
                            id: row.id as string,
                            subject: (row.subject as string) || "運営からの便り",
                            at: (row.created_at as string) ?? "",
                        })),
                    );
                }
            } catch {
                /* 読めなくても、お知らせだけは出す */
            }
        })();
        setSeenAt(window.localStorage.getItem(SEEN_KEY));
    }, []);

    // 外側を押したら閉じる
    useEffect(() => {
        if (!isNoticeOpen) return;
        function handleOutside(event: MouseEvent) {
            if (!noticeRef.current?.contains(event.target as Node)) setIsNoticeOpen(false);
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [isNoticeOpen]);

    useEffect(() => {
        setIsNoticeOpen(false);
    }, [pathname]);

    /** 読んでいないお知らせ。日付が記録より新しいもの */
    /*
     * 運営のものが無ければ、組み込みの案内を出す。
     * どちらも同じ形にして扱う。
     */
    const shown: {
        id: string;
        date: string;
        label: string;
        /** 作られた時刻。「何分前」に使う。既定のものは日付しか無い */
        at: string;
        kind: string;
        body?: string;
        image?: string | null;
        link?: string;
    }[] =
        notices.length > 0
            ? notices
            : NOTICES.map((row) => ({
                  id: row.id,
                  date: row.date,
                  label: row.label,
                  at: row.date,
                  kind: row.kind,
              }));
    const unread = shown.filter((notice) => !seenAt || notice.date > seenAt);
    /* ベルの印。お知らせの未読と、届いた便りを合わせて数える */
    const badgeCount = unread.length + letters.length;

    function handleOpenNotice() {
        const next = !isNoticeOpen;
        setIsNoticeOpen(next);
        if (next && shown.length > 0) {
            // 開いた時点で読んだことにする
            window.localStorage.setItem(SEEN_KEY, shown[0].date);
            setSeenAt(shown[0].date);
        }
    }

    /** 「/」だけは完全一致で見る。前方一致だと常に現在地になってしまう */
    const isCurrent = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <header
            className={[
                /*
                 * 貼り付き。
                 *
                 * ふだんは画面の上に留める。
                 * ただし執筆画面は「画面の高さちょうど」に収める作りで、
                 * ここで浮くと場所を取らず、下段がその分だけ
                 * 押し下げられて画面の外へ出る。
                 * （上の帯や本文の頭が見えなくなる原因）
                 */
                sticky ? "sticky top-0" : "shrink-0",
                "z-30 border-b border-line bg-surface",
            ].join(" ")}
        >
            {/*
             * 左右の余白。
             *
             * 中くらいの画面では詰めて、真ん中の行き先が
             * 収まる幅を空ける。
             */}
            <div className="relative flex h-[72px] items-center px-4 sm:px-6 xl:px-10">
                {/*
                 * ロゴはヘッダーの高さより少し大きく見せたいので、
                 * 高さを固定したまま overflow を許して外へはみ出させる。
                 * ヘッダー自体の高さ（72px）は変えない。
                 */}
                <Link
                    href="/"
                    className="relative z-10 shrink-0"
                    aria-label="原石航路 ホームへ"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.svg"
                        alt="原石航路"
                        className="h-[64px] w-auto"
                    />
                </Link>

                {/*
                 * 行き先はヘッダーの中央に置く。
                 * ロゴの隣に寄せると、右上の通知やアカウントとの間が
                 * 大きく空いて、ヘッダーが左に傾いて見える。
                 *
                 * 中央に固定するため absolute にしてある。
                 * flex で寄せるとロゴの幅で中心がずれる。
                 *
                 * lg 未満では下段の横送りに渡す。
                 * ロゴ・5 項目・右上の 3 つは、それより狭いと重なる。
                 */}
                <nav
                    aria-label="主なページ"
                    className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch gap-0.5 lg:flex"
                >
                    {shownNav.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isCurrent(item.href) ? "page" : undefined}
                            className={[
                                /*
                                 * 中くらいの画面では、字と余白を詰める。
                                 *
                                 * 項目が増えたぶん、1024〜1280px あたりで
                                 * 入りきらず 2 行に折り返していた。
                                 * 詰めれば 1 行に収まる。
                                 */
                                "relative flex items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px]",
                                "xl:gap-2 xl:px-4 xl:text-[15px]",
                                isCurrent(item.href)
                                    ? "font-semibold text-forest"
                                    : "text-muted hover:text-ink",
                            ].join(" ")}
                        >
                            {/*
                             * 絵は出さない。
                             *
                             * 行き先が 6 つ並ぶと、絵のほうが先に目に入り、
                             * 字が読みにくくなる。名前だけで足りる。
                             */}
                            {item.label}
                            {isCurrent(item.href) && (
                                <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-forest" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* 右端。通知とアイコンのあいだを空ける */}
                <div className="ml-auto flex shrink-0 items-center gap-3.5">
                    <div ref={noticeRef} className="relative">
                        <button
                            type="button"
                            onClick={handleOpenNotice}
                            aria-label={`通知${badgeCount > 0 ? `（未読${badgeCount}件）` : ""}`}
                            aria-expanded={isNoticeOpen}
                            className={[
                                "relative flex h-8 w-8 items-center justify-center rounded-full border",
                                isNoticeOpen
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:border-forest-line hover:text-forest",
                            ].join(" ")}
                        >
                            <BellIcon />
                            {badgeCount > 0 && (
                                <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-forest ring-2 ring-[var(--color-surface)]" />
                            )}
                        </button>

                        {isNoticeOpen && (
                            <div className="absolute right-0 top-full z-40 mt-2 w-[360px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                                    <p className="text-sm font-semibold text-ink">お知らせ</p>
                                    <span className="text-xs text-faint">
                                        {shown.length}件
                                    </span>
                                </div>

                                <ul className="thin-scroll max-h-80 divide-y divide-line overflow-y-auto">
                                    {/*
                                     * 自分あての便りを先に出す。
                                     * みんな向けのお知らせより、
                                     * 自分に宛てられたものが先。
                                     */}
                                    {letters.map((letter) => (
                                        <li key={`letter:${letter.id}`}>
                                            <Link
                                                href={`/messages?open=${letter.id}`}
                                                onClick={() => setIsNoticeOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas"
                                            >
                                                <span className="shrink-0 rounded-full bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                                                    便り
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                                    {letter.subject}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-faint">
                                                    {timeAgo(letter.at)}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}

                                    {shown.slice(0, 5).map((notice) => {
                                        const isUnread = unread.some(
                                            (row) => row.id === notice.id,
                                        );
                                        /*
                                         * 出すのは内容と「何分前」だけ。
                                         * 日付・本文・画像は枠を太らせるのでやめた。
                                         * 収まらない内容は後半を…で切る。
                                         */
                                        const inner = (
                                            <>
                                                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                                    {notice.label}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-faint">
                                                    {timeAgo(notice.at)}
                                                </span>
                                            </>
                                        );

                                        return (
                                            <li
                                                key={notice.id}
                                                className={
                                                    isUnread ? "bg-forest-tint/40" : ""
                                                }
                                            >
                                                {notice.link ? (
                                                    <Link
                                                        href={notice.link}
                                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas"
                                                    >
                                                        {inner}
                                                    </Link>
                                                ) : (
                                                    <span className="flex items-center gap-3 px-4 py-2.5">
                                                        {inner}
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                {/* すべて読む場所へ */}
                                <Link
                                    href="/notices"
                                    className="flex items-center justify-center gap-1 border-t border-line px-4 py-2.5 text-xs text-forest hover:bg-canvas"
                                >
                                    もっと見る
                                    <span aria-hidden="true">›</span>
                                </Link>
                            </div>
                        )}
                    </div>

                    <AccountMenu isCurrent={isCurrent("/mypage")} />
                </div>
            </div>

            {/* 幅が狭いときは行き先を下の段に出す */}
            <nav
                aria-label="主なページ"
                /*
                 * 中央寄せにしない。
                 *
                 * 横に送れる並びで justify-center にすると、
                 * 入りきらないぶんが左右に均等にはみ出し、
                 * 左端（ホーム）が画面の外に出て戻せなくなる。
                 * 左から詰めれば、頭が必ず見える。
                 */
                className="thin-scroll flex items-center gap-1 overflow-x-auto border-t border-line px-4 py-1.5 sm:px-8 lg:hidden"
            >
                {shownNav.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isCurrent(item.href) ? "page" : undefined}
                        className={[
                            "flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px]",
                            isCurrent(item.href)
                                ? "bg-forest-tint font-semibold text-forest"
                                : "text-muted hover:text-ink",
                        ].join(" ")}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/*
             * 入室中の帯。
             * 部屋を離れても、原石航路にいるあいだは出し続ける。
             */}
            <RoomPresenceBar />

            {breadcrumbs.length > 0 && (
                <nav
                    aria-label="パンくず"
                    /*
                     * 狭い画面では出さない。
                     *
                     * 「作品一覧 › ワークスペース › 執筆」は
                     * 携帯の幅に収まらず、全体を押し広げていた。
                     * 戻る道はヘッダーの行き先にあるので、
                     * ここに無くても困らない。
                     *
                     * 640px 以上では今までどおり出す。
                     */
                    className="thin-scroll hidden items-center gap-2 overflow-x-auto whitespace-nowrap border-t border-line px-4 py-2 text-[12px] sm:flex sm:px-8 sm:text-sm lg:px-12"
                >
                    {breadcrumbs.map((crumb, index) => (
                        <span key={crumb.label} className="flex items-center gap-2">
                            {index > 0 && <span className="text-faint">›</span>}
                            {crumb.href ? (
                                <Link href={crumb.href} className="text-forest hover:underline">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-muted">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}
        </header>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */


function MailIcon() {
    return (
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="3" y="5.5" width="18" height="13" rx="2" />
            <path d="m3.8 7 8.2 6 8.2-6" />
        </svg>
    );
}

function BellIcon() {
    return (
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
            <path d="M13.7 20a2 2 0 0 1-3.4 0" />
        </svg>
    );
}

function UserIcon() {
    return (
        <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
        </svg>
    );
}
