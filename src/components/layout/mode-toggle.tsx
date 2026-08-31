"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * 原石航路 Studio
 * ModeToggle — 作家向けと読書向けを入れ替える
 *
 * ベルの横に置く。
 *
 * ★ 押すとすぐ入れ替わる。確認は出さない。
 *   設定なので、もう一度押せば戻る。
 *   一手ごとに聞かれると、試すのが億劫になる。
 *
 * ★ 「執筆に集中」のときは出さない。
 *   入り切りの形は 2 つしか表せない。
 *   3 つ目を混ぜると、押すたびに何になるか分からない。
 *   集中を解くのはマイページから。
 * ============================================================
 */

export default function ModeToggle({
    mode,
    userId,
}: {
    /** いまの向き。'read' / 'write' / 'focus' */
    mode: string | null | undefined;
    userId: string | null;
}) {
    const router = useRouter();
    const [isBusy, setIsBusy] = useState(false);
    const [now, setNow] = useState(mode === "read" ? "read" : "write");

    /*
     * 誰が入っているか。
     *
     * ★ 渡された userId をあてにしない。
     *   profile に user_id が入っていないことがあり、
     *   そのとき押し具そのものが出なくなっていた。
     *
     * 自分で確かめる。
     */
    const [me, setMe] = useState<string | null>(userId);

    useEffect(() => {
        if (userId) { setMe(userId); return }
        void (async () => {
            const { data } = await createClient().auth.getUser();
            setMe(data.user?.id ?? null);
        })();
    }, [userId]);

    useEffect(() => {
        setNow(mode === "read" ? "read" : "write");
    }, [mode]);

    /* 集中しているときと、入っていないときは出さない */
    if (!me || mode === "focus") return null;

    const isRead = now === "read";

    async function toggle() {
        if (isBusy || !me) return;

        const next = isRead ? "write" : "read";

        setIsBusy(true);
        /*
         * 見た目を先に動かす。
         * 保存を待たせると、押しても反応が無いように見える。
         */
        setNow(next);

        const { error } = await createClient()
            .from("profiles")
            .update({ home_mode: next })
            .eq("user_id", me);

        if (error) {
            setNow(isRead ? "read" : "write");
            window.alert("切り替えられませんでした。時間をおいて試してください。");
        } else {
            /*
             * 頁を作り直す。
             *
             * ホームの中身も、行き先の並びも向きで変わる。
             * 押し具だけ動いて中身が古いままだと、
             * 効いていないように見える。
             */
            router.refresh();
        }

        setIsBusy(false);
    }

    return (
        <button
            type="button"
            onClick={() => void toggle()}
            disabled={isBusy}
            aria-label={isRead ? "作家向けに切り替える" : "読書向けに切り替える"}
            title={isRead ? "いまは読書向け。押すと作家向けになります" : "いまは作家向け。押すと読書向けになります"}
            className="mode-toggle"
            data-on={isRead ? "read" : "write"}
        >
            {/*
              * 絵は、いまの向きのものを出す。
              * つまみは、その向きの側に寄る。
              */}
            <span className="mode-toggle_icon">
                {isRead ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 20c6-1 10-4 13-9 1.5-2.5 2-4.5 2-7-3 .5-5.5 1.5-8 3.5C7 10.5 5 14.5 4 20Z" />
                        <path d="M4 20c2.5-2.5 5-4.5 8-6" />
                    </svg>
                )}
            </span>

            <span className="mode-toggle_knob" aria-hidden="true" />
        </button>
    );
}
