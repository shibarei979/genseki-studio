/**
 * ============================================================
 * 原石航路 Studio
 * ThemeToggle — 昼と夜を切り替える
 *
 * ★ 押した通りにする。端末の設定には合わせない。
 *
 *   端末に合わせると、押したのに変わらない場面が出る。
 *   夜の端末で昼にしたい人もいる。決めるのは読む人。
 *
 * ★ 機械と帳の両方に覚える。
 *
 *   機械だけだと、別の機械でまた昼から始まる。
 *   帳だけだと、開いた瞬間だけ昼が見えて、あとで暗くなる。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const KEY = "site-theme";

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    /*
     * 押し具を出すかどうか。
     *
     * ★ いまは運営だけに出す。
     *
     *   夜の色は、色の名前で呼んでいる所にしか効いていない。
     *   直に色を書いてある所（1,000 か所ほど）は白いまま残る。
     *   その状態で誰にでも出すと、壊れて見える画面が出る。
     *
     *   白い所を潰し終えたら、この囲いを外す。
     */
    const [canUse, setCanUse] = useState(false);

    /* いまの見た目を、画面に当てる */
    useEffect(() => {
        const saved = readSaved();
        apply(saved === "dark");
        setIsDark(saved === "dark");

        /* 帳の覚えは、少し遅れて届く */
        void (async () => {
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                /* 入っていない人は、必ず昼 */
                if (!user) {
                    apply(false);
                    setIsDark(false);
                    try {
                        window.localStorage.removeItem(KEY);
                    } catch {
                        /* 消せなくても、見え方は昼のまま */
                    }
                    return;
                }

                const { data } = await supabase
                    .from("profiles")
                    .select("theme, is_admin")
                    .eq("user_id", user.id)
                    .maybeSingle();

                setCanUse(data?.is_admin === true);

                /* 運営でない人は、昼に戻す */
                if (data?.is_admin !== true) {
                    apply(false);
                    setIsDark(false);
                    try {
                        window.localStorage.removeItem(KEY);
                    } catch {
                        /* 消せなくても、見え方は昼のまま */
                    }
                    return;
                }

                const theme = data?.theme;
                if (theme === "dark" || theme === "light") {
                    apply(theme === "dark");
                    setIsDark(theme === "dark");
                    window.localStorage.setItem(KEY, theme);
                }
            } catch {
                /* 取れなくても、機械の覚えで動く */
            }
        })();
    }, []);

    function change(next: boolean) {
        apply(next);
        setIsDark(next);

        try {
            window.localStorage.setItem(KEY, next ? "dark" : "light");
        } catch {
            /* 覚えられなくても、その場では変わる */
        }

        void (async () => {
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) return;

                await supabase
                    .from("profiles")
                    .update({ theme: next ? "dark" : "light" })
                    .eq("user_id", user.id);
            } catch {
                /* 残せなくても、機械の覚えは効く */
            }
        })();
    }

    if (!canUse) return null;

    return (
        <button
            type="button"
            onClick={() => change(!isDark)}
            aria-label={isDark ? "昼の見た目にする" : "夜の見た目にする"}
            title={isDark ? "いまは夜。押すと昼になります" : "いまは昼。押すと夜になります"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:border-forest-line hover:text-forest"
        >
            {isDark ? (
                /* 太陽 */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
                </svg>
            ) : (
                /* 月 */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
                </svg>
            )}
        </button>
    );
}

/** 覚えてある見た目。無ければ昼 */
function readSaved(): "light" | "dark" {
    try {
        const saved = window.localStorage.getItem(KEY);
        return saved === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
}

/** 画面に当てる。html の印を見て、色の中身が入れ替わる */
function apply(dark: boolean) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}
