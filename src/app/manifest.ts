import type { MetadataRoute } from "next";

import { appConfig } from "@/config";

/**
 * ============================================================
 * 原石航路 Studio
 * manifest — 端末に入れるための書き
 *
 * 「ホーム画面に追加」で入れたとき、
 * 名前と絵をどうするかを書いておく。
 *
 * ★ これが無いと、入れても絵が出ない。
 *   入れたつもりで、開く場所が見つからなくなる。
 *   実際にそういう問い合わせが来た。
 * ============================================================
 */

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "原石航路",
        /*
         * 絵の下に出る短い名前。
         * 長いと途中で切れるので、12 文字までに収める。
         */
        short_name: "原石航路",

        description: appConfig.description,

        /* 押したときに開く場所 */
        start_url: "/",

        /*
         * 見え方。
         *
         *   standalone  ブラウザの枠を出さない。アプリのように見える
         *   browser     いつものブラウザで開く
         *
         * 入れた人は「アプリとして使いたい」はずなので standalone。
         */
        display: "standalone",

        background_color: "#f4f5f3",
        theme_color: "#1f4e6b",

        lang: "ja",
        dir: "ltr",

        icons: [
            /*
             * ★ 192 と 512 の両方が要る。
             *
             *   192  ホーム画面に置く絵
             *   512  入れるときの案内や、切り替え画面で使う
             *
             *   どちらか片方だと、端末によっては
             *   絵が無いものとして扱われる。
             */
            {
                src: "/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            /*
             * maskable。
             *
             * 端末が絵を丸や角丸に切り抜くとき用。
             * これが無いと、周りに白い枠が付いて浮いて見える。
             */
            {
                src: "/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
