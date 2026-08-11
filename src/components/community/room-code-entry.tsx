/**
 * ============================================================
 * 原石航路 Studio
 * RoomCodeEntry — 鍵部屋コードで執筆室に入る
 *
 * URL を渡す代わりに、6 桁のコードで入れるようにする。
 *
 * ------------------------------------------------------------
 * なぜコードか
 *
 * URL は長く、口では伝えられない。
 * 打ち間違えても、どこが違うのか分からない。
 *
 * 6 桁なら声でも伝えられ、
 * 打ち間違えたときは「そのコードの部屋はありません」で済む。
 *
 * ------------------------------------------------------------
 * 「合言葉」と呼ばない
 *
 * 何を入れる欄なのかが伝わらない。
 * 文字なのか数字なのか、そもそも入力するものなのかが読めない。
 * 「コード」なら、打ち込むものだと分かる。
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { hasSupabase } from "@/config/env.client";
import { createClient } from "@/lib/supabase/client";

function KeyIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="8.5" cy="8.5" r="4.2" />
            <path d="m11.5 11.5 8 8M16.5 16.5l-2 2M19 19l-1.5 1.5" />
        </svg>
    );
}

export default function RoomCodeEntry() {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState("");

    /* 見た目だけ 3 桁で区切る。中身は数字だけ持つ */
    const pretty =
        code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

    async function enter() {
        const digits = code.replace(/[^0-9]/g, "");

        if (digits.length !== 6) {
            setError("6桁のコードを入れてください");
            return;
        }

        if (!hasSupabase()) {
            setError("コードで入るにはサーバーへの接続が要ります");
            return;
        }

        setIsSearching(true);
        setError("");

        const { data, error: failed } = await createClient()
            .from("writing_rooms")
            .select("id")
            .eq("room_code", digits)
            .maybeSingle();

        setIsSearching(false);

        if (failed) {
            /*
             * 列がまだ無いときもここへ来る。
             * 「見つからない」と書くと、番号を疑わせてしまう。
             */
            setError("コードで探せませんでした。設定がまだ済んでいないようです。");
            return;
        }

        if (!data) {
            setError("そのコードの部屋は見つかりませんでした");
            return;
        }

        router.push(`/rooms/${data.id}`);
    }

    return (
        <section className="rounded-xl border border-line bg-surface px-4 py-4">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <span className="text-forest">
                    <KeyIcon />
                </span>
                鍵部屋コード
            </h2>

            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                コードを入れると、一覧に出ない部屋へ入れます。
            </p>

            {/*
             * 入力欄。
             *
             * 3 桁ずつに分けず、1 つの欄にする。
             * 分けると、貼り付けたときに前半しか入らない。
             *
             * 見た目だけ 3 桁で区切って、
             * 打ちながら桁を数えられるようにする。
             */}
            <div className="mt-3">
                <input
                    type="text"
                    inputMode="numeric"
                    value={pretty}
                    maxLength={7}
                    onChange={(event) => {
                        /* 数字だけを残す。「123-456」で渡されても通す */
                        setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                        setError("");
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") void enter();
                    }}
                    placeholder="123 456"
                    aria-label="鍵部屋コード（6桁）"
                    className="w-full rounded-lg border-2 border-line bg-canvas px-3 py-3 text-center text-[22px] font-semibold tracking-[0.28em] tabular-nums outline-none placeholder:font-normal placeholder:text-faint focus:border-forest focus:bg-surface"
                />

                {/* 何桁入ったか。数えなくても分かるようにする */}
                <div
                    className="mt-2 flex justify-center gap-1.5"
                    aria-hidden="true"
                >
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <span
                            key={index}
                            className="h-1.5 w-5 rounded-full transition-colors"
                            style={{
                                background:
                                    index < code.length
                                        ? "var(--color-forest)"
                                        : "var(--color-line)",
                            }}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => void enter()}
                    disabled={isSearching || code.length !== 6}
                    className="mt-3 w-full rounded-lg bg-forest-dark py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                    {isSearching
                        ? "探しています"
                        : code.length === 6
                          ? "この部屋に入る"
                          : `あと ${6 - code.length} 桁`}
                </button>
            </div>

            {error && (
                <p className="mt-2 rounded-md bg-[var(--color-danger-tint)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--color-danger)]">
                    {error}
                </p>
            )}

            {/*
             * どこで手に入るかを書く。
             *
             * 番号を入れる場所だけあっても、
             * その番号をどこから貰うのかが分からない。
             */}
            <p className="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-faint">
                コードは、部屋を立てた人が伝えてくれます。
                <br />
                自分の部屋のコードは、その部屋に入ると左側に出ます。
            </p>
        </section>
    );
}
