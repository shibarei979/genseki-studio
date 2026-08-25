'use client'

import Script from 'next/script'

import BookInfoPopup from '@/components/home/book-info-popup'

/**
 * ============================================================
 * 原石航路
 * BookInfoHost — 見開きの器を、どのページでも使えるようにする
 *
 * 見開きは本棚のために作られたもので、
 * 器も動かす仕組みも読者向けホームにしか無かった。
 *
 * そのため他のページでは別の見開きを作ることになり、
 * 見た目がずれていた。
 *
 * 器をここに置き、どのページからも同じものを開く。
 *
 * .reader-home で包むのは、見開きの見た目が
 * その中でだけ効くようにしてあるため。
 * 中身は器だけなので、他の見た目には影響しない。
 * ============================================================
 */

export default function BookInfoHost() {
    return (
        <div className="reader-home" data-theme="light">
            <BookInfoPopup />

            {/*
             * 開閉を受け持つ仕掛け。
             *
             * 読み込みが終わってから使えるようになる。
             * それまでに押された場合は、
             * 呼ぶ側が作品ページへ送る。
             */}
            <Script src="/home/home.js" strategy="lazyOnload" />
        </div>
    )
}
