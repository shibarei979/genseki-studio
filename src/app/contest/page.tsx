import { notFound } from "next/navigation";

import ContestClient from "@/components/home/contest-client";
import { createClient } from "@/lib/supabase/server";
import Footer from "@/components/layout/footer";

/**
 * コンテスト。
 *
 * 読者向けモードでは出さない。
 * 賞に応募するのは書く側の用なので、読む人の道には置かない。
 */
export default async function ContestPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("home_mode")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profile?.home_mode === "read") notFound();
    }

    return (
        <>
            {/*
              * どのページからでも、決まりや問い合わせへ行けるようにする。
              * 下まで読んだ人が、そこで行き止まりにならない。
              */}
            <ContestClient />
            <Footer />
        </>
    );
}
