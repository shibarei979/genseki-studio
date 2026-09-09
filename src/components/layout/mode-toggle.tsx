"use client";

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

/**
 * 切り替えたことを、読み直したあとの頁へ伝える札。
 *
 * ★ 読み直すと、ブラウザは前の場所まで巻き戻す。
 *
 *   読者の画面の途中で切り替えると、
 *   新しい頁もその高さから始まる。
 *   本棚の途中や、一覧の下から見え始める。
 *
 *   向きを変えたのだから、いちばん上から見せる。
 */
const JUMP_TOP_KEY = "genseki:mode-jump-top";

/**
 * 読み直したあと、いちばん上から始めるようにする。
 *
 * ★ 二重に手を打つ。
 *
 *   1  ブラウザの巻き戻しそのものを止める（scrollRestoration）
 *   2  それでも戻される端末のために、札を置いて上へ動かす
 *
 *   1 だけだと効かない端末があり、
 *   2 だけだと巻き戻しと競って、一瞬下が見える。
 */
function jumpTopAfterReload() {
    try {
        if (window.history.scrollRestoration) {
            window.history.scrollRestoration = "manual";
        }
        window.sessionStorage.setItem(JUMP_TOP_KEY, "1");
        window.scrollTo(0, 0);
    } catch {
        /* 覚えられなくても、切り替えそのものは進める */
    }
}

export default function ModeToggle({
    mode,
    userId,
}: {
    /** いまの向き。'read' / 'write' / 'focus' */
    mode: string | null | undefined;
    userId: string | null;
}) {
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

    /*
     * 切り替えで来たときは、いちばん上まで戻す。
     *
     * ★ 巻き戻しはブラウザが描いたあとに走る。
     *   すぐ動かすと、そのあと元へ戻される。
     *   一度描き終えるのを待ってから動かす。
     */
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.sessionStorage.getItem(JUMP_TOP_KEY)) return;

        window.sessionStorage.removeItem(JUMP_TOP_KEY);
        window.requestAnimationFrame(() => window.scrollTo(0, 0));
    }, []);

    useEffect(() => {
        if (userId) { setMe(userId); return }
        void (async () => {
            const { data } = await createClient().auth.getUser();
            setMe(data.user?.id ?? null);
        })();
    }, [userId]);

    useEffect(() => {
        if (mode) {
            setNow(mode === "read" ? "read" : "write");
            return;
        }

        /* 入っていない人は、この端末に覚えたものを使う */
        const saved = document.cookie
            .split("; ")
            .find((one) => one.startsWith("genseki-home-mode="))
            ?.split("=")[1];

        setNow(saved === "write" ? "write" : "read");
    }, [mode]);

    /*
     * 集中しているときは出さない。
     *
     * ★ 入っていない人にも出す。
     *
     *   はじめて来た人は読者向けから始まる。
     *   そこから執筆向きを覗けないと、
     *   何を書ける場所なのかが伝わらない。
     *
     *   入っていない人の向きは、この端末に覚える。
     *   誰のものでもないので、表に書けない。
     */
    if (mode === "focus") return null;

    const isRead = now === "read";

    async function toggle() {
        if (isBusy) return;

        const next = isRead ? "write" : "read";

        setIsBusy(true);

        /*
         * 入っていない人。
         *
         * 表に書けないので、この端末に覚える。
         * 次に来たときも、選んだ向きで開く。
         */
        if (!me) {
            setNow(next);
            /*
             * ★ クッキーに書く。
             *
             *   localStorage はブラウザの中だけのもので、
             *   サーバー側からは読めない。
             *   ホームはサーバー側で向きを決めるので、
             *   そちらから読める場所に置く。
             *
             * 1 年で消える。Lax は、よそから来たときも読める設定。
             */
            document.cookie =
                `genseki-home-mode=${next}; path=/; max-age=31536000; samesite=lax`;
            jumpTopAfterReload();
            window.location.reload();
            return;
        }

        /*
         * 見た目を先に動かす。
         * 保存を待たせると、押しても反応が無いように見える。
         */
        setNow(next);

        /*
         * 入っている人にも、この端末に向きを覚えさせる。
         *
         * ★ 表を読むのは通信なので、頁を読み直したあと
         *   少し遅れて届く。それまで柱と下の帯は
         *   前の向きのまま出ていた。切り替えたのに
         *   一瞬だけ元の並びが見えるのは、これ。
         *
         *   クッキーなら、読み直した直後にすぐ読める。
         *   表の値が届いたら、そちらで上書きされる。
         */
        document.cookie =
            `genseki-home-mode=${next}; path=/; max-age=31536000; samesite=lax`;

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
             * ★ router.refresh() だけでは足りない。
             *
             *   ホームは向きによって別の部品を出す。
             *   ヘッダーの行き先も、下の帯の中身も変わる。
             *   作り直しだけだと、古い部品が残ることがある。
             *
             *   読み込み直すのが確実。
             *   切り替えは何度も押すものではないので、
             *   一瞬の待ちより、確実に変わるほうがよい。
             */
            jumpTopAfterReload();
            window.location.reload();
        }

        setIsBusy(false);
    }

    return (
        <>
        {/*
          * 切り替えているあいだ、画面を覆う。
          *
          * ★ 切り替えは頁を丸ごと読み直す。
          *
          *   ホームは向きによって別の部品を出すので、
          *   作り直しだけでは古い部品が残る。
          *   読み直す以上、前の画面が一瞬見えるのは避けられない。
          *
          *   見えないように覆う。地の色で塗るだけなので、
          *   切り替わったことは分かり、途中は見えない。
          *
          * ★ 消すのは、こちらではなく読み直しのほう。
          *   新しい頁が描かれた時点で、この覆いごと消える。
          */}
        {isBusy && (
            <div
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'var(--color-canvas, #f4f5f3)',
                }}
            />
        )}

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
                    /*
                      * ペン。
                      *
                      * ★ 前は葉の形だった。
                      *   「書く」を表すなら、ペンのほうが伝わる。
                      */
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15.5 4.5 4 4" />
                        <path d="M17.5 2.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4.5 1.5 1.5-4.5Z" />
                    </svg>
                )}
            </span>

            <span className="mode-toggle_knob" aria-hidden="true" />
        </button>
        </>
    );
}
