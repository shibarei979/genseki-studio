/**
 * ============================================================
 * 原石航路 Studio
 * AuthGate — ログインが要る画面を守る
 *
 * ログインしていない人に見せるのは、案内とログインだけ。
 *
 *   ホーム  → 案内をそのまま出す
 *   その他  → 案内へ送る
 *
 * 中身を出したうえで空にすると、
 * 「何も無い」のか「見えていない」のか分からない。
 * それなら、何ができるかを見てもらうほうが早い。
 * ============================================================
 */

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import LandingClient from "@/components/lp/landing-client";
import { useAuth } from "@/hooks/use-auth";

/**
 * ログインが要る場所。
 *
 * 考え方をひっくり返した。
 *
 * 以前は「ここだけ開ける」だったが、それだと
 * 登録する前に中身が一切見えない。
 * 何があるか分からないものに登録する人はいない。
 *
 * 読むだけなら誰でもできる。
 * 書く・つぶやく・部屋に入るときにログインを求める。
 */
const LOGIN_REQUIRED_PATHS = [
    "/workspace",
    "/post",
    "/mypage",
    "/messages",
    "/admin",
];

/** いまは使わないが、参照している所があるので残す */
const OPEN_PATHS = [
    "/lp",
    "/login",
    "/auth",

    /* 決まりごと */
    "/terms",
    "/privacy",
    "/guidelines",

    /* 使い方と困ったとき */
    "/guide",
    "/faq",
    "/help",
    "/contact",
    "/feedback",
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, isLoading, isConnected } = useAuth();

    /* 繋いでいないときは、これまで通り誰でも使える */
    if (!isConnected) return <>{children}</>;

    /*
     * ログインが要る場所かどうか。
     *
     * ここに挙げた場所だけ、入り口で止める。
     * ほかは誰でも入れる。
     * 個々の操作（つぶやく・いいね・部屋に入る）は、
     * 押した時点でログインを求める。
     */
    const needsLogin = LOGIN_REQUIRED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    const isOpen = !needsLogin;

    if (isLoading) {
        return (
            <div
                className="flex min-h-screen items-center justify-center"
                style={{ background: "var(--color-canvas)" }}
            >
                <p className="text-sm text-faint">読み込んでいます</p>
            </div>
        );
    }

    /* ログイン済み。ただし案内はもう見せない */
    if (user) {
        if (pathname === "/lp") return <Redirect to="/" />;
        return <>{children}</>;
    }

    /* ここから下はログインしていない人 */

    if (isOpen) return <>{children}</>;

    /*
     * ホームは案内をそのまま出す。
     * 「ログインしてください」と出すより、
     * 何ができるかを見てもらうほうが先。
     */
    if (pathname === "/") return <LandingClient />;

    /* それ以外は案内へ送る */
    return <Redirect to="/lp" />;
}

/**
 * 行き先を変える。
 *
 * 描いている最中に飛ばすと React が怒るので、
 * 描き終わってから動かす。
 */
function Redirect({ to }: { to: string }) {
    const router = useRouter();

    useEffect(() => {
        router.replace(to);
    }, [router, to]);

    return (
        <div
            className="flex min-h-screen items-center justify-center"
            style={{ background: "var(--color-canvas)" }}
        >
            <p className="text-sm text-faint">移動しています</p>
        </div>
    );
}
