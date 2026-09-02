/**
 * ============================================================
 * 原石航路 Studio
 * /genre/[name] — 分類ごとの入口
 *
 * ★ 中身は持たない。「作品を探す」へ送るだけ。
 *
 *   この道筋は前から作品ページの上の並びが指していたのに、
 *   頁そのものが無かった。押した人は空の画面に落ちていた。
 *
 *   外に出回った行き先や、検索に拾われたものが残っているので、
 *   道筋は残したまま、絞り込み付きの一覧へ送る。
 * ============================================================
 */

import { redirect } from "next/navigation";

export default function GenrePage({ params }: { params: { name: string } }) {
    redirect(`/search?genre=${encodeURIComponent(decodeURIComponent(params.name))}`);
}
