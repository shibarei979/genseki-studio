/**
 * ============================================================
 * 原石航路 Studio
 * /post — 作品を書く
 * ============================================================
 */

import type { Metadata } from "next";

import PostClient from "@/components/post/post-client";

/*
 * ★ 検索と広告の審査には載せない。
 *   ここは入っている人が自分の作品を扱う場所で、
 *   見回りの機械が開くと、中身の無い「読み込んでいます」だけの頁になる。
 *   それを拾われると「中身の薄いサイト」と見なされる。
 */
export const metadata: Metadata = { robots: { index: false, follow: true } };


export default function PostPage() {
    return <PostClient />;
}
