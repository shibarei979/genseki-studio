import AuthGate from "@/components/auth/auth-gate";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import Script from "next/script";

import { appConfig } from "@/config";

import "./globals.css";

const notoSans = Noto_Sans_JP({
    subsets: ["latin"],
    /* 450・600 を足す。既定を少し太くし、見出しに中間の太さを使えるようにする */
    weight: ["400", "500", "600", "700"],
    variable: "--font-sans",
    display: "swap",
});

const notoSerif = Noto_Serif_JP({
    subsets: ["latin"],
    weight: ["400", "500"],
    variable: "--font-serif",
    display: "swap",
});

/*
 * 検索と共有のための名札。
 *
 * head に直接書く代わりに、Next はここから作る。
 * metadataBase を決めておくと、OGP の絵などの相対の道が
 * 本番の URL に組み立てられる（NEXT_PUBLIC_SITE_URL）。
 */
export const metadata: Metadata = {
    metadataBase: new URL(appConfig.siteUrl),
    title: {
        default: appConfig.title,
        template: "%s | 原石航路",
    },
    description: appConfig.description,
    keywords: [
        "小説投稿",
        "執筆",
        "創作",
        "Web小説",
        "縦書き",
        "執筆室",
        "コンテスト",
        "原石航路",
    ],
    authors: [{ name: "原石航路" }],
    // 電話番号や住所を勝手にリンクにしない
    formatDetection: { telephone: false, email: false, address: false },
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        url: "/",
        siteName: "原石航路",
        title: appConfig.title,
        description: appConfig.description,
        locale: "ja_JP",
        images: [
            {
                // LP の一番上と同じ構図で作った共有カード用の1枚
                url: "/og.jpg",
                width: 1200,
                height: 630,
                alt: "原石航路 — 物語を生み出すすべての人のための、創作活動プラットフォーム",
            },
        ],
    },
    /*
     * X 向け。名札の名前は今も「twitter:」。
     * 「x:」に替えると読まれないので注意。
     */
    twitter: {
        card: "summary_large_image",
        title: appConfig.title,
        description: appConfig.description,
        images: ["/og.jpg"],
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
};

/*
 * Google タグマネージャー。
 *
 * 入れ物だけ用意しておき、番号（GTM-XXXX）は環境変数で渡す。
 * 番号が無ければ何も出さない。開発中や手元で計測しないため。
 * NEXT_PUBLIC_ の付いた変数は、足したら Redeploy が要る。
 */
const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja" className={`${notoSans.variable} ${notoSerif.variable}`}>
            <body>
                {gtmId && (
                    <>
                        <Script id="gtm" strategy="afterInteractive">
                            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
                        </Script>
                        <noscript>
                            {/* JS を切っている人の計測。GTM の決まりの形 */}
                            <iframe
                                src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                                height="0"
                                width="0"
                                style={{ display: "none", visibility: "hidden" }}
                            />
                        </noscript>
                    </>
                )}
                <AuthGate>{children}</AuthGate>
            </body>
        </html>
    );
}
