/**
 * ============================================================
 * 原石航路 Studio
 * ShareButtons — 「シェア（X）」と「リンクをコピー」
 *
 * ★ X へは、ふつうのリンク（<a target="_blank">）で開く。
 *
 *   前は作品の頁だけ、押したときに window.open で開いていた。
 *   Firefox で「押しても反応しない」という声があった。
 *   広告よけの拡張や、窓を開くのを止める設定があると、
 *   window.open で開く窓は止められることがある。
 *   ふつうのリンクなら、止められにくい。
 *
 * ★ 住所は x.com にする。twitter.com は x.com へ回される一手間があり、
 *   その回り道で止められることもある。
 *
 * ★ 「リンクをコピー」を横に置く。
 *   X が開けない端末でも、LINE やほかの SNS に貼って宣伝できる。
 * ============================================================
 */

"use client";

import { useState } from "react";

interface Props {
    /** 投稿の文（題名やハッシュタグ）。末尾に改行を入れておくと、URL が次の行になる */
    text: string;
    /** 共有する住所（https://…） */
    url: string;
    /** 大きさ。作品の頁は md、話の頁の下は sm */
    size?: "md" | "sm";
}

/** 住所に ?from= を付ける。付けられない住所はそのまま */
function withFrom(url: string, from: string): string {
    try {
        const u = new URL(url);
        u.searchParams.set("from", from);
        return u.toString();
    } catch {
        return url;
    }
}

export default function ShareButtons({ text, url, size = "md" }: Props) {
    const [copied, setCopied] = useState<"" | "ok" | "ng">("");

    /*
     * ★ X に貼る住所には ?from=x を付ける。
     *   X のアプリの中で開くと送り元が消え、「直接」来たように見える。
     *   印があれば、X から来たと数えられる（ダッシュボードの「入り口」）。
     */
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(withFrom(url, "x"))}`;

    async function copy() {
        const value = `${text}${url}`;
        let ok = false;
        try {
            await navigator.clipboard.writeText(value);
            ok = true;
        } catch {
            /*
             * ★ clipboard が使えない端末の備え。
             *   古い書き方で写す。これも駄目なら、写せなかったと伝える。
             */
            try {
                const area = document.createElement("textarea");
                area.value = value;
                area.setAttribute("readonly", "");
                area.style.position = "fixed";
                area.style.opacity = "0";
                document.body.appendChild(area);
                area.select();
                ok = document.execCommand("copy");
                document.body.removeChild(area);
            } catch {
                ok = false;
            }
        }
        setCopied(ok ? "ok" : "ng");
        window.setTimeout(() => setCopied(""), 2200);
    }

    const pad = size === "sm" ? "8px 14px" : "11px 14px";
    const font = size === "sm" ? 12 : 13;
    const base: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: pad,
        borderRadius: 20,
        border: "1.5px solid #e2e8f0",
        background: "var(--color-bg-card)",
        color: "#374151",
        fontSize: font,
        fontWeight: 500,
        cursor: "pointer",
        textDecoration: "none",
        transition: "all .15s",
        fontFamily: "inherit",
    };

    return (
        <>
            <a href={intent} target="_blank" rel="noopener noreferrer" style={base} aria-label="X でシェア">
                <svg width={size === "sm" ? 12 : 12} height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                シェア
            </a>
            <button
                type="button"
                onClick={() => void copy()}
                style={{
                    ...base,
                    color: copied === "ok" ? "var(--color-brand)" : copied === "ng" ? "var(--color-danger)" : "#374151",
                    borderColor: copied === "ok" ? "var(--color-brand)" : "#e2e8f0",
                }}
                aria-live="polite"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {copied === "ok" ? "コピーしました" : copied === "ng" ? "コピーできませんでした" : "リンクをコピー"}
            </button>
        </>
    );
}
