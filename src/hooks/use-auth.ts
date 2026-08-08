/**
 * ============================================================
 * 原石航路 Studio
 * ログインしている人
 *
 * Supabase に繋いでいないときは、常に「ログインしていない」を返す。
 * 端末の中だけで動かしているぶんには、それで困らない。
 * ============================================================
 */

"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { hasSupabase } from "@/config/env.client";
import { createClient } from "@/lib/supabase/client";

export interface AuthState {
    user: User | null;
    /** まだ調べ終わっていない */
    isLoading: boolean;
    /** Supabase に繋いでいるか */
    isConnected: boolean;
}

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: hasSupabase(),
        isConnected: hasSupabase(),
    });

    useEffect(() => {
        if (!hasSupabase()) return;

        const supabase = createClient();

        void (async () => {
            const { data } = await supabase.auth.getUser();
            setState({
                user: data.user,
                isLoading: false,
                isConnected: true,
            });
        })();

        /*
         * ログイン・ログアウトを見張る。
         * 別のタブで出入りしても、こちらの画面が追いつく。
         */
        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setState({
                    user: session?.user ?? null,
                    isLoading: false,
                    isConnected: true,
                });
            },
        );

        return () => listener.subscription.unsubscribe();
    }, []);

    const signOut = useCallback(async () => {
        if (!hasSupabase()) return;
        await createClient().auth.signOut();
    }, []);

    return { ...state, signOut };
}
