/**
 * ============================================================
 * 原石航路 Studio
 * PDF 書き出し
 *
 * PDF 生成ライブラリを使わず、印刷用のページを開いて
 * ブラウザの「PDF として保存」に渡す方式にしている。
 *
 * 理由は日本語。jsPDF などは日本語フォントを自前で埋め込む必要があり、
 * ファイルが数 MB 増えるうえ縦書きに対応できない。
 * ブラウザの印刷はどちらも標準で扱える。
 * ============================================================
 */

import { parseNotation } from "@/lib/manuscript/notation";
import type { DisplaySettings } from "@/types";
import { LINE_HEIGHT_VALUE } from "@/types";

export interface PrintEpisode {
    ep_number: number;
    title: string;
    body: string;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * ルビと傍点を組んだ HTML にする。
 * PDF は印刷経由なので、ブラウザが <ruby> と text-emphasis を
 * そのまま扱ってくれる。
 */
function toRichHtml(text: string): string {
    return parseNotation(text)
        .map((segment) => {
            if (segment.type === "ruby") {
                return `<ruby>${escapeHtml(segment.base)}<rt>${escapeHtml(segment.ruby)}</rt></ruby>`;
            }
            if (segment.type === "emphasis") {
                return `<em class="bouten">${escapeHtml(segment.text)}</em>`;
            }
            return escapeHtml(segment.text);
        })
        .join("");
}

/**
 * 印刷用のウィンドウを開く。
 * 開けなかった場合（ポップアップ拒否）は false を返す。
 */
export function openPrintView(
    workTitle: string,
    episodes: PrintEpisode[],
    settings: DisplaySettings,
): boolean {
    const isVertical = settings.writing_mode === "vertical";

    const chapters = episodes
        .map((episode) => {
            const heading = episode.title.trim()
                /* 書き出しも、書き手の題名をそのまま使う */
                ? episode.title
                : `${episode.ep_number}話`;
            return `
                <section class="chapter">
                    <h2>${escapeHtml(heading)}</h2>
                    <div class="body">${toRichHtml(episode.body)}</div>
                </section>`;
        })
        .join("");

    const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(workTitle)}</title>
<style>
    @page { margin: 20mm; }
    body {
        font-family: "Noto Serif JP", "Yu Mincho", "YuMincho", serif;
        font-size: ${settings.font_size}px;
        line-height: ${LINE_HEIGHT_VALUE[settings.line_height]};
        color: #000;
        margin: 0;
        ${isVertical ? "writing-mode: vertical-rl;" : ""}
    }
    h1 {
        font-size: 1.6em;
        margin: 0 0 2em;
    }
    h2 {
        font-size: 1.15em;
        margin: 0 0 1.2em;
        page-break-before: always;
        break-before: page;
    }
    .chapter:first-of-type h2 {
        page-break-before: auto;
        break-before: auto;
    }
    .body { white-space: pre-wrap; }
    ruby > rt { font-size: 0.5em; }
    em.bouten {
        font-style: normal;
        text-emphasis: filled dot;
        -webkit-text-emphasis: filled dot;
        text-emphasis-position: over right;
        -webkit-text-emphasis-position: over right;
    }
</style>
</head>
<body>
    <h1>${escapeHtml(workTitle)}</h1>
    ${chapters}
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return false;

    printWindow.document.write(html);
    printWindow.document.close();
    // 書体の読み込みを待ってから印刷ダイアログを出す
    printWindow.addEventListener("load", () => {
        printWindow.focus();
        printWindow.print();
    });
    return true;
}
