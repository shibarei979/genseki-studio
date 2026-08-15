/**
 * ============================================================
 * 原石航路 Studio
 * /login — ログイン
 * ============================================================
 */

import LoginClient from "@/components/auth/login-client";

/*
 * /login?mode=signup で登録側を開く。
 * 「無料で始める」「はじめての方は」からはこちらへ送る。
 */
export default function LoginPage({
    searchParams,
}: {
    searchParams: { mode?: string };
}) {
    return (
        <LoginClient
            initialMode={searchParams.mode === "signup" ? "signup" : "signin"}
        />
    );
}
