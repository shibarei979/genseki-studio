/**
 * ============================================================
 * 原石航路 Studio
 * /admin/announcements — 引退した頁
 *
 * お知らせの運営画面は「お知らせ（ベル）」に一本化した。
 * ベルの一覧は 2 つの表（admin_notices と announcements）を
 * 混ぜて出すので、ここで書いていた古いものも
 * あちらから直せる・消せる（an: の印で行き先が分かれる）。
 *
 * 古いしおり（ブックマーク）で来た人のために、
 * 頁は消さず、ベルへ送るだけにしてある。
 * ============================================================
 */

import { redirect } from "next/navigation";

export default function RetiredAnnouncementsPage() {
    redirect("/admin/notices");
}
