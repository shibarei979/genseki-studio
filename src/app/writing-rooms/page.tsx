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

import RoomsListClient from "@/components/community/rooms-list-client";

export default function WritingRoomsPage() {
    return <RoomsListClient />;
}
