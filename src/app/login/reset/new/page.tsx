"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * 原石航路 Studio
 * /login/reset/new  新しいパスワードを決める
 *
 * メールのリンクから開く。
 *
 * ★ リンクを踏んだ時点で、Supabase が一時的に入った状態にする。
 *   その状態でだけ、パスワードを変えられる。
 *
 * ★ 入っていない状態で直接開かれたら、断る。
 *   誰でも開けると、他人のパスワードを変えられてしまう。
 * ============================================================
 */

export default function ResetNewPage() {
    const router = useRouter();

    const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState("");
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        void (async () => {
            /*
             * リンクから来たかを確かめる。
             *
             * Supabase はリンクを踏んだ時点で入った状態にする。
             * 入っていなければ、直接開かれたということ。
             */
            const { data } = await createClient().auth.getUser();
            setReady(data.user ? "ok" : "invalid");
        })();
    }, []);

    async function submit() {
        if (password.length < 6) {
            setError("パスワードは6文字以上にしてください。");
            return;
        }
        if (password !== confirm) {
            setError("2つのパスワードが違います。");
            return;
        }

        setIsBusy(true);
        setError("");

        const { error: caught } = await createClient().auth.updateUser({ password });

        setIsBusy(false);

        if (caught) {
            setError("変えられませんでした。時間をおいて試してください。");
            return;
        }

        setIsDone(true);
    }

    const inputClass =
        "mt-2 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-forest";

    return (
        <div className="page-with-footer bg-canvas">
            <Header breadcrumbs={[{ label: "新しいパスワード" }]} />

            <main className="mx-auto w-full max-w-[420px] px-6 py-14">
                <h1 className="font-serif text-[20px] font-bold tracking-wide text-ink">
                    新しいパスワード
                </h1>

                {ready === "checking" && (
                    <p className="mt-5 text-[12.5px] text-muted">確かめています…</p>
                )}

                {ready === "invalid" && (
                    <div className="mt-6 rounded-xl border border-line bg-surface px-5 py-6">
                        <p className="text-[13px] font-bold text-ink">
                            このページは、メールのリンクから開いてください
                        </p>
                        <p className="mt-3 text-[12.5px] leading-[2] text-muted">
                            リンクの有効期限が切れている可能性もあります。
                            もう一度お送りします。
                        </p>
                        <Link
                            href="/login/reset"
                            className="mt-4 inline-block text-[12.5px] text-forest hover:underline"
                        >
                            リンクを送り直す
                        </Link>
                    </div>
                )}

                {ready === "ok" && isDone && (
                    <div className="mt-6 rounded-xl border border-line bg-surface px-5 py-6">
                        <p className="text-[13px] font-bold text-ink">
                            変えました
                        </p>
                        <p className="mt-3 text-[12.5px] leading-[2] text-muted">
                            新しいパスワードで入れるようになりました。
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="mt-5 w-full rounded-lg bg-forest py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                        >
                            ホームへ
                        </button>
                    </div>
                )}

                {ready === "ok" && !isDone && (
                    <>
                        <p className="mt-3 text-[12.5px] leading-[2] text-muted">
                            新しいパスワードを決めてください。
                        </p>

                        <div className="mt-6 space-y-5">
                            <div>
                                <label
                                    htmlFor="new-password"
                                    className="text-xs font-medium text-ink"
                                >
                                    新しいパスワード（6文字以上）
                                </label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={password}
                                    autoComplete="new-password"
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="new-password-confirm"
                                    className="text-xs font-medium text-ink"
                                >
                                    もう一度入力
                                </label>
                                <input
                                    id="new-password-confirm"
                                    type="password"
                                    value={confirm}
                                    autoComplete="new-password"
                                    onChange={(e) => setConfirm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") void submit();
                                    }}
                                    className={inputClass}
                                />
                            </div>
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
                            {isBusy ? "変えています…" : "このパスワードにする"}
                        </button>
                    </>
                )}
            </main>

            <Footer tight />
        </div>
    );
}
