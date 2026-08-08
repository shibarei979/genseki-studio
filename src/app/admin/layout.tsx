/**
 * ============================================================
 * 原石航路 Studio
 * /admin — 運営だけが入れる
 *
 * ログインができたので、ここを閉じる。
 *
 * 画面ごとに確かめると、必ずどこかで書き忘れる。
 * 入口を 1 つにして、そこで止める。
 * ============================================================
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    /* ログインしていなければ、入口へ */
    if (!user) redirect("/auth?next=/admin");

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, user_role")
        .eq("user_id", user.id)
        .maybeSingle();

    /*
     * 運営かどうか。
     *
     * is_admin が本筋。user_role は古い持ち方で、
     * どちらかが立っていれば通す。
     */
    const isAdmin =
        profile?.is_admin === true || profile?.user_role === "admin";

    if (!isAdmin) redirect("/");

    return <>{children}</>;
}
