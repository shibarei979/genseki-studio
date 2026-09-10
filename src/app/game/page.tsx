import type { Metadata } from "next";

import WriterGame from "@/components/game/writer-game";

/*
 * 見た目は、この頁でだけ読み込む。
 * 全体の layout に足すと、遊ばない人にも配られる。
 */
import "@/styles/game.css";

/**
 * ============================================================
 * 原石航路
 * /game — 作家人生ゲーム
 *
 * ★ どこからも案内しない、一枚の頁。
 *
 *   住所を直に叩いて来てもらう。
 *   サイトの案内も、下の帯も出さない（それぞれの側で外してある）。
 *
 * ★ 検索には載せる。
 *   案内から外すのは「サイトの中で迷わせない」ためで、
 *   外から来てもらう道は閉じない。
 *
 * ★ X に貼られたときの見え方を、ここで決める。
 *   遊びの入り口なので、原石航路の説明は書かない。
 * ============================================================
 */
export const metadata: Metadata = {
    title: "無名作家から、はじまる10の選択",
    description:
        "10の選択で、あなたが本当に書ける一作が決まります。異世界 × 冒険、現代 × 喪失、学園 × 発見——全100通り。1分・登録なし。",
    openGraph: {
        title: "無名作家から、はじまる10の選択",
        description:
            "最後に、あなたが本当に書ける一作が出ます。全100通り。1分・登録なし。",
        url: "https://gensekikoro.com/game",
        siteName: "原石航路",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "無名作家から、はじまる10の選択",
        description: "あなたが本当に書ける一作は？　全100通り。1分・登録なし。",
    },
};

export default function Page() {
    return <WriterGame />;
}
