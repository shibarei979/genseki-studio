"use client";

import { useEffect } from "react";

import Link from "next/link";

/**
 * ============================================================
 * 原石航路 Studio
 * error — 画面の組み立てに失敗したとき
 *
 * これが無いと、Next の素の画面が出る。
 * 英語で、開発用の言葉が並ぶ。
 * 初めて来た読者がそれを見ると、壊れた場所だと思う。
 *
 * "use client" が要る。
 * サーバー側で組み立てに失敗したものを、
 * ブラウザ側で受け止める作りのため。
 *
 * ★ ここでは、失敗の中身を画面に出さない。
 *
 *   どの表のどの列で落ちたかが出ると、
 *   仕組みの中身が外から見える。
 *   読む人にとっても、読んで分かるものではない。
 * ============================================================
 */

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        /*
         * 記録には残す。
         *
         * 画面に出さないぶん、ここが唯一の手がかりになる。
         * Vercel のログから追える。
         */
        console.error("画面の組み立てに失敗しました", error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
            <div className="text-center">
                <p className="text-sm text-ink">
                    うまく表示できませんでした。
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">
                    しばらく待ってから、もう一度お試しください。
                    <br />
                    何度も起きる場合は、お問い合わせからお知らせください。
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark"
                    >
                        もう一度読み込む
                    </button>
                    <Link
                        href="/"
                        className="rounded-md border border-line px-5 py-2 text-sm text-muted hover:text-ink"
                    >
                        ホームへ戻る
                    </Link>
                </div>

                {/*
                 * 問い合わせのときの手がかり。
                 *
                 * digest は失敗ごとに変わる短い印。
                 * これを伝えてもらえると、ログから該当のものを探せる。
                 */}
                {error.digest && (
                    <p className="mt-6 text-[11px] text-faint">
                        お問い合わせの際は、この番号をお伝えください
                        <br />
                        <span className="font-mono">{error.digest}</span>
                    </p>
                )}
            </div>
        </div>
    );
}
