/**
 * ============================================================
 * 原石航路 Studio
 * /writing-rooms — 執筆室の一覧（別の住所）
 *
 * 中身は /rooms/list とまったく同じ。
 * お知らせに貼る URL が /rooms（コミュニティー）と
 * 紛れないよう、執筆室だけを指す住所を増やした。
 * 頁の設定はいじらない。住所が増えただけ。
 * ============================================================
 */

import type { Metadata } from "next";

import RoomsListClient from "@/components/community/rooms-list-client";

/*
 * ★ 検索と広告の審査には載せない。
 *   ここは入っている人が自分の作品を扱う場所で、
 *   見回りの機械が開くと、中身の無い「読み込んでいます」だけの頁になる。
 *   それを拾われると「中身の薄いサイト」と見なされる。
 */
export const metadata: Metadata = { robots: { index: false, follow: true } };


export default function WritingRoomsPage() {
    return <RoomsListClient />;
}
