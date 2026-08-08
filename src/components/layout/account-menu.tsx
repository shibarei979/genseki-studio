/**
 * ============================================================
 * 原石航路 Studio
 * AccountMenu — ヘッダーの人のアイコン
 *
 * 押すと開く。マイページ・運営・ログアウトへの入口。
 *
 * ログインしていなければ「ログイン」だけを出す。
 * Supabase に繋いでいないときは、これまで通りマイページへ直行する。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { getRepository } from "@/lib/repository";
import type { Profile } from "@/types";

export default function AccountMenu({ isCurrent }: { isCurrent: boolean }) {
    const router = useRouter();
    const { user, isConnected, signOut } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void (async () => {
            try {
                setProfile(await getRepository().getProfile());
            } catch {
                // ログインしていないときは読めない。それでよい
                setProfile(null);
            }
        })();
    }, [user]);

    /* 運営かどうか。ログインしていないときは調べない */
    useEffect(() => {
        if (!isConnected || !user) {
            setIsAdmin(false);
            return;
        }
        void (async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const { data } = await createClient()
                .from("profiles")
                .select("user_role")
                .eq("user_id", user.id)
                .maybeSingle();
            setIsAdmin(data?.user_role === "admin");
        })();
    }, [isConnected, user]);

    // 外を押したら閉じる
    useEffect(() => {
        if (!isOpen) return;
        function onDown(event: MouseEvent) {
            if (!boxRef.current?.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [isOpen]);

    /*
     * 繋いでいないときは、押したらそのままマイページへ。
     * ログインという考えがないので、選ばせる意味がない。
     */
    if (!isConnected) {
        return (
            <Link href="/mypage" aria-label="マイページ" className={buttonClass(isCurrent)}>
                <Face profile={profile} />
            </Link>
        );
    }

    return (
        <div ref={boxRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label="アカウント"
                aria-expanded={isOpen}
                className={buttonClass(isCurrent)}
                style={
                    profile
                        ? {
                              background: `hsl(${profile.avatar_hue} 38% 90%)`,
                              color: `hsl(${profile.avatar_hue} 48% 28%)`,
                          }
                        : undefined
                }
            >
                <Face profile={profile} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                    {user ? (
                        <>
                            <div className="border-b border-line px-4 py-3">
                                <p className="truncate text-[13px] font-medium text-ink">
                                    {profile?.display_name ?? "名無しの書き手"}
                                </p>
                                <p className="mt-0.5 truncate text-[10px] text-faint">
                                    {user.email}
                                </p>
                            </div>

                            <MenuLink href="/mypage" onClick={() => setIsOpen(false)}>
                                マイページ
                            </MenuLink>

                            {/*
                             * 上の段から「作品投稿」を外したぶん、ここに置く。
                             * ホーム以外の画面からも書きはじめられるようにするため。
                             */}
                            <MenuLink href="/post" onClick={() => setIsOpen(false)}>
                                作品を描く
                            </MenuLink>

                            {isAdmin && (
                                <MenuLink href="/admin" onClick={() => setIsOpen(false)}>
                                    運営の画面
                                </MenuLink>
                            )}

                            <button
                                type="button"
                                onClick={async () => {
                                    setIsOpen(false);
                                    await signOut();
                                    router.push("/");
                                    router.refresh();
                                }}
                                className="block w-full border-t border-line px-4 py-2.5 text-left text-[13px] text-muted hover:bg-canvas hover:text-ink"
                            >
                                ログアウト
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="border-b border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
                                ログインすると、書いたものを
                                どの端末からでも開けます。
                            </p>

                            <MenuLink href="/login" onClick={() => setIsOpen(false)}>
                                ログイン・登録
                            </MenuLink>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function buttonClass(isCurrent: boolean): string {
    return [
        "flex h-8 w-8 items-center justify-center rounded-full border",
        isCurrent ? "border-2 border-forest" : "border-line hover:border-forest-line",
    ].join(" ");
}

function Face({ profile }: { profile: Profile | null }) {
    if (!profile) return <UserIcon />;
    return (
        <span className="text-sm font-semibold">
            {Array.from(profile.display_name)[0] ?? "？"}
        </span>
    );
}

function MenuLink({
    href,
    onClick,
    children,
}: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block px-4 py-2.5 text-[13px] text-ink hover:bg-canvas"
        >
            {children}
        </Link>
    );
}

function UserIcon() {
    return (
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </svg>
    );
}
