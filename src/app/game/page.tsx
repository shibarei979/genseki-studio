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
/*
 * ★ 結果を貼ったときの絵を、その場で描く。
 *
 *   ?p=現代&c=再生 が付いていれば、その二語を焼き込む。
 *   付いていなければ、遊びの表紙を出す。
 *
 *   文字だけの共有は流れない。
 *   広まっている診断は、結果が絵として貼られている。
 */
export function generateMetadata({
    searchParams,
}: {
    searchParams: { p?: string; c?: string; t?: string };
}): Metadata {
    const place = searchParams.p ?? "";
    const core = searchParams.c ?? "";
    const title = searchParams.t ?? "";

    const hasResult = Boolean(place && core);

    const og = new URLSearchParams();
    if (hasResult) {
        og.set("p", place);
        og.set("c", core);
        if (title) og.set("t", title);
    }

    const image = `https://gensekikoro.com/game/og?${og.toString()}`;

    const head = hasResult
        ? `私が書けるのは「${place} × ${core}」でした`
        : "無名作家から、はじまる10の選択";

    const body = hasResult
        ? `${title ? `『${title}』　` : ""}あなたは何を書ける？　全100通り・1分・登録なし`
        : "10の選択で、あなたが本当に書ける一作が決まります。全100通り・1分・登録なし。";

    return {
        title: head,
        description: body,
        openGraph: {
            title: head,
            description: body,
            url: "https://gensekikoro.com/game",
            siteName: "原石航路",
            type: "website",
            images: [{ url: image, width: 1200, height: 630 }],
        },
        twitter: {
            card: "summary_large_image",
            title: head,
            description: body,
            images: [image],
        },
    };
}

export default function Page() {
    return <WriterGame />;
}
