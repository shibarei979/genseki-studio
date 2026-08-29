/**
 * ============================================================
 * 原石航路 Studio
 * コミュニティーの中央に差し込む面
 *
 *   NoticePanel  … 通知
 *   DirectPanel  … DM
 *   ProfilePanel … 自分のこと
 *
 * どれも頁の枠は持たない。中身だけ。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { hasSupabase } from "@/config/env.client";
import { createClient } from "@/lib/supabase/client";
import { loadBlockedIds } from "@/lib/social/blocks";

/**
 * ============================================================
 * 通知
 *
 * 自分あてに届いたものを、新しい順に並べる。
 * 開いた時点で読んだことにする。
 *
 * 1 件ずつ「読んだ」を押させると、
 * 押し忘れた通知がいつまでも溜まって、印が消えなくなる。
 * ============================================================
 */

interface Notice {
    id: string;
    type: string;
    message: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
}

const NOTICE_LABEL: Record<string, string> = {
    announcement: "お知らせ",
    like: "いいね",
    comment: "感想",
    follow: "フォロー",
};

export function NoticePanel({ userId }: { userId: string | null }) {
    const [rows, setRows] = useState<Notice[] | null>(null);

    useEffect(() => {
        if (!userId || !hasSupabase()) {
            setRows([]);
            return;
        }

        void (async () => {
            const supabase = createClient();

            const { data } = await supabase
                .from("notifications")
                .select("id, type, message, link, is_read, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(50);

            setRows(data ?? []);

            /* 開いたら読んだことにする */
            const unread = (data ?? []).filter((row) => !row.is_read);
            if (unread.length === 0) return;

            await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("is_read", false);
        })();
    }, [userId]);

    if (!userId) return <NeedLogin what="通知" />;
    if (rows === null) return <Loading />;

    if (rows.length === 0) {
        return (
            <Empty
                title="通知はありません"
                body="いいねや感想、フォローが届くと、ここに出ます。"
            />
        );
    }

    return (
        <ul className="space-y-2">
            {rows.map((row) => {
                const inner = (
                    <>
                        <span className="flex items-center gap-2">
                            <span className="rounded bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                                {NOTICE_LABEL[row.type] ?? "お知らせ"}
                            </span>
                            {!row.is_read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
                            )}
                            <span className="ml-auto text-[10px] tabular-nums text-faint">
                                {formatWhen(row.created_at)}
                            </span>
                        </span>
                        <span className="mt-2 block text-[13px] leading-relaxed text-ink">
                            {row.message}
                        </span>
                    </>
                );

                return (
                    <li key={row.id}>
                        {row.link ? (
                            <Link
                                href={row.link}
                                className="block rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-forest-line"
                            >
                                {inner}
                            </Link>
                        ) : (
                            <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
                                {inner}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * ============================================================
 * DM
 *
 * 左に相手の一覧、右にやりとり……にはしない。
 * ここは中央の 1 列なので、一覧と会話を行き来する形にする。
 *
 * 3 列の中にさらに 2 列を作ると、
 * 1 列あたりが狭くなって、どちらも読めなくなる。
 * ============================================================
 */

interface Conversation {
    id: string;
    other_id: string;
    other_name: string;
    other_icon: string | null;
    last_at: string;
    unread: number;
}

interface Direct {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
}

export function DirectPanel({ userId }: { userId: string | null }) {
    const [rows, setRows] = useState<Conversation[] | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Direct[]>([]);
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    const loadList = useCallback(async () => {
        if (!userId || !hasSupabase()) {
            setRows([]);
            return;
        }

        const supabase = createClient();

        const { data: convs } = await supabase
            .from("conversations")
            .select("id, user_a, user_b, last_at")
            .or(`user_a.eq.${userId},user_b.eq.${userId}`)
            .order("last_at", { ascending: false })
            .limit(50);

        if (!convs || convs.length === 0) {
            setRows([]);
            return;
        }

        /*
         * ブロックした相手との会話は、一覧に出さない。
         *
         * 会話そのものは消さない。
         * ブロックを外したときに、やりとりが戻るようにする。
         */
        const blocked = await loadBlockedIds(supabase, userId);

        const visible = convs.filter((c: { user_a: string; user_b: string }) => {
            const other = c.user_a === userId ? c.user_b : c.user_a;
            return !blocked.has(other);
        });

        if (visible.length === 0) {
            setRows([]);
            return;
        }

        /* 相手の名前と絵をまとめて引く */
        const otherIds = visible.map((c: { user_a: string; user_b: string }) =>
            c.user_a === userId ? c.user_b : c.user_a,
        );

        const { data: people } = await supabase
            .from("public_profiles")
            .select("user_id, display_name, icon_url")
            .in("user_id", otherIds);

        const byId = new Map(
            (people ?? []).map((p: { user_id: string }) => [p.user_id, p]),
        );

        /* 未読の数 */
        const { data: unreadRows } = await supabase
            .from("direct_messages")
            .select("conversation_id, sender_id, is_read")
            .in(
                "conversation_id",
                visible.map((c: { id: string }) => c.id),
            )
            .eq("is_read", false);

        const unreadBy: Record<string, number> = {};
        for (const row of unreadRows ?? []) {
            if (row.sender_id === userId) continue;
            unreadBy[row.conversation_id] = (unreadBy[row.conversation_id] ?? 0) + 1;
        }

        setRows(
            visible.map(
                (c: { id: string; user_a: string; user_b: string; last_at: string }) => {
                    const otherId = c.user_a === userId ? c.user_b : c.user_a;
                    const person = byId.get(otherId) as
                        | { display_name?: string; icon_url?: string | null }
                        | undefined;

                    return {
                        id: c.id,
                        other_id: otherId,
                        other_name: person?.display_name ?? "名前のない書き手",
                        other_icon: person?.icon_url ?? null,
                        last_at: c.last_at,
                        unread: unreadBy[c.id] ?? 0,
                    };
                },
            ),
        );
    }, [userId]);

    useEffect(() => {
        void loadList();
    }, [loadList]);

    /** 会話を開く */
    async function open(conversationId: string) {
        setOpenId(conversationId);
        if (!hasSupabase()) return;

        const supabase = createClient();

        const { data } = await supabase
            .from("direct_messages")
            .select("id, sender_id, body, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at");

        setMessages(data ?? []);

        /* 相手から届いたものを読んだことにする */
        await supabase
            .from("direct_messages")
            .update({ is_read: true })
            .eq("conversation_id", conversationId)
            .neq("sender_id", userId ?? "")
            .eq("is_read", false);

        await loadList();
    }

    async function send() {
        if (!userId || !openId || !body.trim() || isSending) return;
        setIsSending(true);

        const supabase = createClient();
        const text = body.trim();

        const { data } = await supabase
            .from("direct_messages")
            .insert({ conversation_id: openId, sender_id: userId, body: text })
            .select("id, sender_id, body, created_at")
            .single();

        /* 一覧の並び替えに使うので、会話の側も触っておく */
        await supabase
            .from("conversations")
            .update({ last_at: new Date().toISOString() })
            .eq("id", openId);

        if (data) setMessages((prev) => [...prev, data]);
        setBody("");
        setIsSending(false);
    }

    if (!userId) return <NeedLogin what="DM" />;
    if (rows === null) return <Loading />;

    /* 会話を開いている */
    if (openId) {
        const conv = rows.find((row) => row.id === openId);

        return (
            <div className="flex h-[70vh] flex-col rounded-xl border border-line bg-surface">
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="text-[12px] text-muted hover:text-ink"
                    >
                        ‹ 戻る
                    </button>
                    <span className="text-[13px] font-medium text-ink">
                        {conv?.other_name ?? ""}
                    </span>
                </div>

                <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {messages.length === 0 ? (
                        <p className="py-10 text-center text-[12px] text-muted">
                            まだやりとりがありません。
                        </p>
                    ) : (
                        messages.map((row) => {
                            const isMine = row.sender_id === userId;
                            return (
                                <div
                                    key={row.id}
                                    className={isMine ? "text-right" : "text-left"}
                                >
                                    <span
                                        className={[
                                            "inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-[13px] leading-relaxed",
                                            isMine
                                                ? "bg-forest-dark text-white"
                                                : "bg-canvas text-ink",
                                        ].join(" ")}
                                    >
                                        {row.body}
                                    </span>
                                    <span className="mt-1 block text-[10px] text-faint">
                                        {formatWhen(row.created_at)}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex gap-2 border-t border-line px-3 py-3">
                    <input
                        type="text"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                void send();
                            }
                        }}
                        placeholder="メッセージを入力"
                        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13px] outline-none focus:border-forest focus:bg-surface"
                    />
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={isSending || !body.trim()}
                        className="shrink-0 rounded-lg bg-forest-dark px-5 py-2.5 text-[12px] font-medium text-white disabled:opacity-40"
                    >
                        送る
                    </button>
                </div>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <Empty
                title="やりとりはありません"
                body="作者のページから「メッセージを送る」で始められます。"
            />
        );
    }

    return (
        <ul className="space-y-2">
            {rows.map((row) => (
                <li key={row.id}>
                    <button
                        type="button"
                        onClick={() => void open(row.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-forest-line"
                    >
                        <Face name={row.other_name} icon={row.other_icon} />

                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">
                                {row.other_name}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-faint">
                                {formatWhen(row.last_at)}
                            </span>
                        </span>

                        {row.unread > 0 && (
                            <span className="shrink-0 rounded-full bg-[var(--color-danger)] px-2 py-0.5 text-[10px] text-white">
                                {row.unread}
                            </span>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    );
}

/**
 * ============================================================
 * プロフィール
 *
 * ここでは直さない。読むだけにして、直すのはマイページへ送る。
 * 同じものを 2 か所で直せると、
 * どちらが最新か分からなくなる。
 * ============================================================
 */

export function ProfilePanel({
    userId,
    name,
    icon,
}: {
    userId: string | null;
    name: string | null;
    icon: string | null;
}) {
    if (!userId) return <NeedLogin what="プロフィール" />;

    return (
        <div className="rounded-xl border border-line bg-surface px-6 py-6">
            <div className="flex items-center gap-4">
                <Face name={name ?? ""} icon={icon} size={64} />

                <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-ink">
                        {name ?? "名前のない書き手"}
                    </p>
                    <p className="mt-1 text-[11px] text-faint">あなたのプロフィール</p>
                </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link
                    href={`/author/${userId}`}
                    className="rounded-lg bg-forest-dark py-2.5 text-center text-[12px] font-medium text-white hover:opacity-90"
                >
                    公開ページを見る
                </Link>
                <Link
                    href="/mypage"
                    className="rounded-lg border border-line py-2.5 text-center text-[12px] text-muted hover:border-forest-line hover:text-forest"
                >
                    プロフィールを編集
                </Link>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 共通の小物
 * ============================================================
 */

function Face({
    name,
    icon,
    size = 40,
}: {
    name: string;
    icon: string | null;
    size?: number;
}) {
    if (icon) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={icon}
                alt=""
                style={{ width: size, height: size }}
                className="shrink-0 rounded-full object-cover"
            />
        );
    }

    return (
        <span
            style={{ width: size, height: size, fontSize: size * 0.36 }}
            className="flex shrink-0 items-center justify-center rounded-full bg-forest-tint font-semibold text-forest"
        >
            {name.slice(0, 1) || "?"}
        </span>
    );
}

function Loading() {
    return <p className="py-16 text-center text-[12px] text-faint">読み込んでいます</p>;
}

function Empty({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-[13px] text-ink">{title}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{body}</p>
        </div>
    );
}

function NeedLogin({ what }: { what: string }) {
    return (
        <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
            <p className="text-[13px] text-ink">{what}を見るにはログインが要ります</p>
            <Link
                href="/login"
                className="mt-4 inline-block rounded-lg bg-forest-dark px-6 py-2.5 text-[12px] font-medium text-white hover:opacity-90"
            >
                ログインする
            </Link>
        </div>
    );
}

/** 「たった今」「3分前」「08/10 21:30」 */
function formatWhen(value: string): string {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();

    if (diff < 60_000) return "たった今";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;

    const stamp = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate(),
    ).padStart(2, "0")}`;

    return date.getFullYear() === new Date().getFullYear()
        ? stamp
        : `${date.getFullYear()}/${stamp}`;
}
