import { createClient } from "@/lib/supabase/server";
import HomeClient from "@/components/home/home-client";
import ReaderHome from "@/components/home/reader-home";
import { cookies } from "next/headers";

import { publishDueEpisodes } from "@/lib/publish-due";

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

        /*
         * ★ クッキーのほうを先に見る。
         *
         *   切り替えの押し具は、表へ書く前にクッキーを書く。
         *   表への書き込みは通信なので、待つと切り替えが遅い。
         *
         *   クッキーが先なら、押した直後に読み直しても
         *   もう新しい向きで組み立てられる。
         *   表のほうは、そのあと追いつけばよい。
         *   （別の端末で開いたときのために控えている）
         *
         * ★ 食い違ったときは、クッキーが新しい。
         *   その端末で、いま押したものだから。
         */
        const wanted =
            cookies().get("genseki-home-mode")?.value ?? profile?.home_mode;

        if (wanted === "read") return <ReaderHome />;

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
