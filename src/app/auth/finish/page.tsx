/**
 * ============================================================
 * 原石航路 Studio
 * /auth/finish — 合鍵を拾って中へ通す
 *
 * X（OAuth 1.0a）は、合鍵を住所の # から後ろに付けて返す。
 * # から後ろはサーバーまで届かないので、
 * server 側の /auth/callback では受け取れない。
 *
 * ここは client。ブラウザの中でなら # の中身が読める。
 * Supabase の道具が住所から合鍵を拾って座らせてくれるので、
 * 座れたのを見届けて、行き先へ送るだけ。
 * ============================================================
 */

"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

export default function AuthFinishPage() {
    useEffect(() => {
        void (async () => {
            const supabase = createClient();

            /* 住所から合鍵が拾われるまで、少しだけ待つ */
            const { data } = await supabase.auth.getSession();

            /*
             * 行き先。
             *
             * 住所に付いていても「/」なら、控えのほうを優先する。
             * callback は行き先を知らないので「/」を付けてくるが、
             * 本当の行き先は、ログインの前に端末へ控えてある。
             */
            const fromUrl =
                new URLSearchParams(window.location.search).get("next") || "";
            let next = fromUrl === "/" ? "" : fromUrl;
            if (!next) {
                try {
                    next = window.sessionStorage.getItem("genseki:login-next") || "/";
                    window.sessionStorage.removeItem("genseki:login-next");
                } catch {
                    next = "/";
                }
            }

            if (data.session) {
                window.location.replace(next);
                return;
            }

            /*
             * 座れていなければ、座った合図を待つ。
             * それでも来なければログインへ戻す。
             */
            const { data: watcher } = supabase.auth.onAuthStateChange(
                (_event, session) => {
                    if (session) {
                        watcher.subscription.unsubscribe();
                        window.location.replace(next);
                    }
                },
            );

            window.setTimeout(() => {
                watcher.subscription.unsubscribe();
                void supabase.auth.getSession().then(({ data: again }) => {
                    if (again.session) {
                        window.location.replace(next);
                        return;
                    }
                    /*
                     * 座れなかった理由を持ったままログインへ戻す。
                     * 黙って戻すと、次に直すときの手がかりが無くなる。
                     */
                    const reason =
                        new URLSearchParams(window.location.search).get(
                            "reason",
                        ) ?? "no-session";
                    window.location.replace(
                        `/login?error=callback&reason=${encodeURIComponent(reason)}`,
                    );
                });
            }, 4000);
        })();
    }, []);

    return (
        <div
            style={{
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "var(--color-muted)",
            }}
        >
            ログインしています…
        </div>
    );
}
