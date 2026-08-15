/**
 * ============================================================
 * 原石航路 Studio
 * AdminUsersClient — 利用者
 *
 * 権限を変える。使えなくする。
 *
 * 停止しても書いたものは消さない。
 * 消してしまうと、間違いだったときに戻せない。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import { isConnected } from "@/lib/repository";
import { getRepository } from "@/lib/repository";
import type { AdminUser, UserRole } from "@/types";
import { ROOT_ADMIN_EMAIL, USER_ROLE_LABEL } from "@/types";

type Filter = "all" | "admin" | "suspended";

/** 何で登録したかの見せ方。twitter は X の昔の名前 */
const PROVIDER_LABEL: Record<string, string> = {
    google: "Google",
    twitter: "X",
    github: "GitHub",
    email: "メール",
};

export default function AdminUsersClient() {
    const [users, setUsers] = useState<AdminUser[] | null>(null);
    const [keyword, setKeyword] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    /* 確かめの窓で、BAN と削除のどちらを尋ねているか */
    const [mode, setMode] = useState<"ban" | "delete">("ban");
    const [isWorking, setIsWorking] = useState(false);
    const [target, setTarget] = useState<AdminUser | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    const reload = useCallback(async () => {
        try {
            setUsers(await getRepository().listUsers());
            setError("");
        } catch (caught) {
            setUsers([]);
            setError(
                caught instanceof Error ? caught.message : "読み込めませんでした",
            );
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function patch(userId: string, next: Partial<AdminUser>) {
        setError("");
        try {
            await getRepository().updateUser(userId, next);
            await reload();
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "うまくいきませんでした",
            );
        }
    }

    const shown = (users ?? []).filter((user) => {
        if (filter === "admin" && user.role !== "admin") return false;
        if (filter === "suspended" && !user.suspended_at) return false;
        if (keyword && !user.display_name.includes(keyword)) return false;
        return true;
    });

    /* 繋いでいなければ、何もできないことを伝える */
    if (!isConnected()) {
        return (
            <AdminShell title="利用者" description="権限を変える。使えなくする。">
                <div className="rounded-xl border border-dashed border-line py-20 text-center">
                    <p className="text-sm text-ink">接続先が必要です</p>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                        いまは自分の端末の中だけで動いているので、
                        利用者という考えがありません。
                        Supabase に繋ぐと、ここに一覧が出ます。
                    </p>
                </div>
            </AdminShell>
        );
    }

    return (
        <AdminShell title="利用者" description="権限を変える。使えなくする。">
            {/* 絞り込み */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="名前で探す"
                    aria-label="名前で探す"
                    className="w-56 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none focus:border-forest"
                />

                <div className="flex gap-1">
                    {(
                        [
                            { value: "all", label: "すべて" },
                            { value: "admin", label: "運営" },
                            { value: "suspended", label: "停止中" },
                        ] as const
                    ).map((row) => (
                        <button
                            key={row.value}
                            type="button"
                            onClick={() => setFilter(row.value)}
                            aria-pressed={filter === row.value}
                            className={[
                                "rounded-full border px-3.5 py-1.5 text-[11px]",
                                filter === row.value
                                    ? "border-forest bg-forest-tint text-forest"
                                    : "border-line text-muted hover:text-ink",
                            ].join(" ")}
                        >
                            {row.label}
                        </button>
                    ))}
                </div>

                <span className="ml-auto text-[11px] text-muted">
                    {shown.length}人
                </span>
            </div>

            {error && (
                <p className="mb-3 rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
                    {error}
                </p>
            )}

            {/*
             * 誰も運営になっていないときの案内。
             * 最初の 1 人は SQL で作るしかないので、そこだけ手順を出す。
             */}
            {users !== null &&
                users.length > 0 &&
                !users.some((row) => row.role === "admin") && (
                    <div className="mb-4 rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-tint)] px-4 py-3">
                        <p className="text-[13px] font-medium text-ink">
                            まだ運営がいません
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            <span className="text-ink">{ROOT_ADMIN_EMAIL}</span> で
                            登録すると、自動で運営になります。
                            移行SQLを流したあとに登録してください。
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                            すでに登録している場合は、移行SQLを流し直すと運営になります。
                        </p>
                    </div>
                )}

            {users === null ? (
                <p className="py-20 text-center text-sm text-faint">読み込んでいます</p>
            ) : shown.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line py-20 text-center text-sm text-faint">
                    {users.length === 0
                        ? "まだ誰も登録していません。"
                        : "見つかりませんでした。"}
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {shown.map((user) => {
                        /*
                         * 最上位の運営は変えられない。
                         * 押せるボタンを出して弾かれるより、出さないほうがよい。
                         */
                        const isRoot =
                            user.email.toLowerCase() === ROOT_ADMIN_EMAIL;

                        return (
                        <li
                            key={user.user_id}
                            className={[
                                "flex flex-wrap items-center gap-3 rounded-xl border bg-surface px-4 py-3",
                                user.suspended_at
                                    ? "border-[var(--color-danger)]"
                                    : "border-line",
                            ].join(" ")}
                        >
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                                style={{
                                    background: `hsl(${hashHue(user.user_id)} 34% 90%)`,
                                    color: `hsl(${hashHue(user.user_id)} 44% 28%)`,
                                }}
                            >
                                {Array.from(user.display_name)[0] ?? "？"}
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate text-[13px] font-medium text-ink">
                                        {user.display_name}
                                    </span>

                                    {user.role === "admin" && (
                                        <span className="rounded-full bg-forest-tint px-2 py-0.5 text-[10px] text-forest">
                                            {isRoot ? "運営（固定）" : "運営"}
                                        </span>
                                    )}

                                    {user.suspended_at && (
                                        <span className="rounded-full bg-[var(--color-danger-tint)] px-2 py-0.5 text-[10px] text-[var(--color-danger)]">
                                            停止中
                                        </span>
                                    )}
                                </p>

                                <p className="mt-0.5 text-[10px] text-faint">
                                    作品 {user.work_count}　
                                    {user.created_at.slice(0, 10)} から　
                                    {/* 何で登録したか。問い合わせのとき手がかりになる */}
                                    {PROVIDER_LABEL[user.login_provider ?? "email"] ??
                                        user.login_provider}
                                    {user.mission_stats && (
                                        <>
                                            {"　"}
                                            公開{user.mission_stats.works}・話
                                            {user.mission_stats.episodes}・感想
                                            {user.mission_stats.comments}・いいね
                                            {user.mission_stats.likes}
                                        </>
                                    )}
                                    {user.suspend_reason && `　理由：${user.suspend_reason}`}
                                </p>
                            </div>

                            {/* 権限 */}
                            {isRoot ? (
                                <span
                                    className="shrink-0 text-[10px] text-faint"
                                    title="この利用者は変えられません"
                                >
                                    変更できません
                                </span>
                            ) : (
                            <div className="flex shrink-0 gap-1">
                                {(Object.keys(USER_ROLE_LABEL) as UserRole[]).map(
                                    (key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() =>
                                                void patch(user.user_id, { role: key })
                                            }
                                            aria-pressed={user.role === key}
                                            className={[
                                                "rounded-md border px-2.5 py-1 text-[10px]",
                                                user.role === key
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:text-ink",
                                            ].join(" ")}
                                        >
                                            {USER_ROLE_LABEL[key]}
                                        </button>
                                    ),
                                )}
                            </div>
                            )}

                            {/*
                             * BAN と削除。
                             *   BAN    ログインごと止める。同じ住所では入り直せない
                             *   削除    記録を消すだけ。同じ住所でまた登録できる
                             * どちらも確かめてから行う。戻せないため。
                             */}
                            {isRoot ? null : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMode("ban");
                                            setTarget(user);
                                            setReason("");
                                        }}
                                        className="shrink-0 rounded-md px-3 py-1 text-[10px] text-faint hover:text-[var(--color-danger)]"
                                    >
                                        BAN
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMode("delete");
                                            setTarget(user);
                                            setReason("");
                                        }}
                                        className="shrink-0 rounded-md px-3 py-1 text-[10px] text-faint hover:text-ink"
                                    >
                                        削除
                                    </button>
                                </>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}

            {/* 停止の確かめ */}
            {target && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
                    <div className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl">
                        <p className="text-sm text-ink">
                            「{target.display_name}」を
                            {mode === "ban" ? "BAN" : "削除"}しますか
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                            {mode === "ban" ? (
                                <>
                                    ログインごと止めます。
                                    このメールアドレスでは、作り直しても
                                    入れなくなります。
                                    書いたものは消えません。
                                </>
                            ) : (
                                <>
                                    アカウントの記録を消します。
                                    同じメールアドレスで、また登録できます。
                                    書いたものは消えません。
                                </>
                            )}
                        </p>

                        {mode === "ban" && (
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="理由（本人には出ません）"
                                aria-label="理由"
                                className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                        )}

                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setTarget(null)}
                                className="flex-1 rounded-lg border border-line py-2 text-xs text-muted hover:text-ink"
                            >
                                やめる
                            </button>
                            <button
                                type="button"
                                disabled={isWorking}
                                onClick={async () => {
                                    setIsWorking(true);
                                    try {
                                        const response = await fetch(
                                            "/api/admin/user",
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                },
                                                body: JSON.stringify({
                                                    action: mode,
                                                    userId: target.user_id,
                                                    reason: reason.trim(),
                                                }),
                                            },
                                        );
                                        const data = await response.json();
                                        if (!response.ok) {
                                            throw new Error(
                                                data?.error ??
                                                    "うまくいきませんでした",
                                            );
                                        }
                                        setTarget(null);
                                        await reload();
                                    } catch (caught) {
                                        window.alert(
                                            caught instanceof Error
                                                ? caught.message
                                                : "うまくいきませんでした",
                                        );
                                    }
                                    setIsWorking(false);
                                }}
                                className="flex-1 rounded-lg bg-[var(--color-danger)] py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                                {isWorking
                                    ? "しています…"
                                    : mode === "ban"
                                      ? "BANする"
                                      : "削除する"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}

function hashHue(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(hash) % 360;
}
