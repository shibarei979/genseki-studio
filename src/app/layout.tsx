import AuthGate from "@/components/auth/auth-gate";
import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";

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

export const metadata: Metadata = {
    title: appConfig.title,
    description: appConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja" className={`${notoSans.variable} ${notoSerif.variable}`}>
            <body>
                <AuthGate>{children}</AuthGate>
            </body>
        </html>
    );
}
