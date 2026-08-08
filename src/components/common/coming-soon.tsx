/**
 * ============================================================
 * 原石航路 Studio
 * ComingSoon — まだ中身の無い画面
 *
 * 「準備中」とだけ出すのは避ける。
 * 何を作っているのか、いまはどこへ行けばいいのかまで書く。
 * ============================================================
 */

"use client";

import Link from "next/link";

import Header from "@/components/layout/header";

interface Props {
    title: string;
    body: string;
}

export default function ComingSoon({ title, body }: Props) {
    return (
        <div className="min-h-screen bg-canvas">
            <Header />

            <main className="mx-auto max-w-[560px] px-6 py-24 text-center">
                <h1 className="text-[20px] font-semibold tracking-wide text-ink">
                    {title}
                </h1>
                <p className="mt-4 text-[13px] leading-[2] text-muted">{body}</p>

                <Link
                    href="/"
                    className="mt-8 inline-block rounded-lg border border-line bg-surface px-5 py-2.5 text-[13px] text-ink hover:border-forest-line hover:text-forest"
                >
                    ホームへ戻る
                </Link>
            </main>
        </div>
    );
}
