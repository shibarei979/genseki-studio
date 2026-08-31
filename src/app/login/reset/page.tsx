"use client";

import Link from "next/link";
import { useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * 原石航路 Studio
 * /login/reset  パスワードを忘れた方
 *
 * 登録したメールを入れると、作り直すリンクが届く。
 *
 * ★ 「そのメールは登録されていません」とは言わない。
 *
 *   誰が登録しているかを、外から調べられてしまう。
 *   登録があってもなくても、同じ言葉を返す。
 *   届かないのは、登録が無かったということ。
 * ============================================================
 */

export default function ResetRequestPage() {
    const [email, setEmail] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        const address = email.trim();

        if (!address) {
            setError("メールアドレスを入力してください。");
            return;
        }

        setIsBusy(true);
        setError("");

        const { error: caught } = await createClient().auth.resetPasswordForEmail(
            address,
            {
                /*
                 * 押したあとに開く画面。
                 * Supabase の Redirect URLs に入っている必要がある。
                 */
                redirectTo: `${window.location.origin}/login/reset/new`,
            },
        );

        setIsBusy(false);

        if (caught) {
            /*
             * ★ 中身は見せない。
             *   「そのメールは登録されていません」などが混ざると、
             *   誰が登録しているかを外から調べられる。
             */
            setError("送信できませんでした。時間をおいて試してください。");
            return;
        }

        setIsSent(true);
    }

    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: "パスワードを忘れた方" }]} />

            <main className="mx-auto w-full max-w-[420px] px-6 py-14">
                <h1 className="font-serif text-[20px] font-bold tracking-wide text-ink">
                    パスワードを忘れた方
                </h1>

                {isSent ? (
                    <div className="mt-6 rounded-xl border border-line bg-surface px-5 py-6">
                        <p className="text-[13px] font-bold text-ink">
                            メールを送りました
                        </p>
                        <p className="mt-3 text-[12.5px] leading-[2] text-muted">
                            {email} 宛にお送りしました。
                            <br />
                            メールの中のリンクから、新しいパスワードを決めてください。
                        </p>
                        <p className="mt-4 text-[11.5px] leading-[1.9] text-faint">
                            届かないときは、迷惑メールに入っていないか確かめてください。
                            それでも見つからない場合、そのメールアドレスは
                            登録されていない可能性があります。
                        </p>

                        <Link
                            href="/login"
                            className="mt-5 inline-block text-[12.5px] text-forest hover:underline"
                        >
                            ログイン画面へ戻る
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mt-3 text-[12.5px] leading-[2] text-muted">
                            登録したメールアドレスを入れてください。
                            パスワードを作り直すためのリンクをお送りします。
                        </p>

                        <div className="mt-6">
                            <label
                                htmlFor="reset-email"
                                className="text-xs font-medium text-ink"
                            >
                                メールアドレス
                            </label>
                            <input
                                id="reset-email"
                                type="email"
                                value={email}
                                autoComplete="email"
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void submit();
                                }}
                                placeholder="your@email.com"
                                className="mt-2 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-forest"
                            />
                        </div>

                        {error && (
                            <p className="mt-3 text-[12px] text-[var(--color-danger)]">
                                {error}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={isBusy}
                            className="mt-5 w-full rounded-lg bg-forest py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            {isBusy ? "送っています…" : "リンクを送る"}
                        </button>

                        <Link
                            href="/login"
                            className="mt-5 block text-center text-[12.5px] text-muted hover:text-forest"
                        >
                            ログイン画面へ戻る
                        </Link>
                    </>
                )}
            </main>

            <Footer tight />
        </div>
    );
}
