"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * InviteCatcher — 招待リンク（?invite=コード）で来た人を覚えておく
 *
 *   どの頁に来ても、住所の invite= を端末に控える。
 *   ログイン（登録）した時点で /api/invite/claim に送り、招待された人として控えてもらう。
 *
 * ★ 何も描かない。
 * ★ 送り終えたら（受けられなかった理由が決まったときも）控えを消す。
 * ============================================================
 */

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const KEY = "gk-invite";

function read(): string | null {
    try {
        return window.localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

function forget() {
    try {
        window.localStorage.removeItem(KEY);
    } catch {
        /* 消せなくても困らない（サーバー側で二度は受けない） */
    }
}

export default function InviteCatcher() {
    useEffect(() => {
        /* 1) 住所に invite= があれば控える */
        try {
            const url = new URL(window.location.href);
            const code = url.searchParams.get("invite");
            if (code && /^[A-Za-z0-9]{4,16}$/.test(code)) {
                window.localStorage.setItem(KEY, code.toUpperCase());
                /* 住所からは消す（そのまま共有されて、別の人のコードが回らないように） */
                url.searchParams.delete("invite");
                window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
            }
        } catch {
            /* 控えられなくても、頁は動く */
        }

        /* 2) ログインしていたら送る */
        let sending = false;
        const send = async () => {
            const code = read();
            if (!code || sending) return;
            sending = true;
            try {
                const response = await fetch("/api/invite/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code }),
                });
                if (response.status === 401) return; /* まだ入っていない。入ったらまた送る */
                const data = (await response.json().catch(() => ({}))) as { final?: boolean };
                if (response.ok || data.final) forget();
            } catch {
                /* 繋がらなければ、次に来たときにまた送る */
            } finally {
                sending = false;
            }
        };

        if (!read()) return;
        const supabase = createClient();
        void supabase.auth.getUser().then(({ data }) => {
            if (data.user) void send();
        });
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) void send();
        });
        return () => data.subscription.unsubscribe();
    }, []);

    return null;
}
