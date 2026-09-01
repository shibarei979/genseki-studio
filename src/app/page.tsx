import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/home/home-client";
import ReaderHome from "@/components/home/reader-home";
import { cookies } from "next/headers";

/**
 * ホーム。
 *
 * 表示設定によって、読む人向けと書く人向けを切り替える。
 * 同じ場所で切り替えるのは、行き先を覚え直さずに済むため。
 */
/* 読者向けホームの一覧は 30 秒ごとに作り直す */
export const revalidate = 30;

export default async function HomePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        /*
         * 照合は user_id。
         *
         * profiles の主キーは id だが、ログインした人と結びつくのは
         * user_id のほう。id で引くと、いつまでも見つからない。
         */
        const { data: profile } = await supabase
            .from("profiles")
            .select("home_mode")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profile?.home_mode === "read") return <ReaderHome />;

        return <HomeClient />;
    }

    /*
     * 入っていない人には、読者向けを出す。
     *
     * ★ はじめて来た人は、まず読む人。
     *
     *   執筆向けは「書いた本」「執筆室」など、
     *   入っていないと何も出ない枠が多い。
     *   空の棚を見せても、何ができる場所か伝わらない。
     *
     *   作品が並んでいるほうが、伝わる。
     *
     * ヘッダーの切り替えで、その場で執筆向きにも移れる。
     */
    /*
     * 入っていない人。
     *
     * ★ 端末に覚えた向きを、クッキーから読む。
     *
     *   前は 'use client' の部品で localStorage を読んでいたが、
     *   ReaderHome はサーバー側の部品なので、
     *   client の中からは呼べない（組み立てが失敗する）。
     *
     *   クッキーならサーバー側で読める。
     */
    const saved = cookies().get("genseki-home-mode")?.value;

    if (saved === "write") return <HomeClient />;

    /*
     * 既定は読者向け。
     *
     * はじめて来た人は、まず読む人。
     * 執筆向けは「書いた本」「執筆室」など、
     * 入っていないと空の枠が多く、
     * 何ができる場所か伝わらない。
     */
    return <ReaderHome />;
}
