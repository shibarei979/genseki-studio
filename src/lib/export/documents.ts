/**
 * ============================================================
 * 原石航路 Studio
 * Word と EPUB の書き出し
 *
 * どちらも中身は決まった形の XML。
 * 部品を入れずに、必要なぶんだけ組み立てる。
 *
 * Word は .docx ではなく、Word が読める HTML で出す。
 * 本物の .docx は zip を組む必要があり、
 * そのために部品を足すほどの用ではない。
 * 拡張子を .doc にしておけば Word で開ける。
 * ============================================================
 */

import type { Episode, Work } from "@/types";

/** 記法を外して、そのまま読める形にする */
function plain(body: string): string {
    return body
        // ルビ： ｜親文字《よみ》 → 親文字（よみ）
        .replace(/[|｜]([^《]+)《([^》]+)》/g, "$1（$2）")
        // 傍点は落とす。文字だけ残す
        .replace(/《《([^》]+)》》/g, "$1");
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** 話ごとの中身を組む */
function buildSections(
    episodes: Episode[],
    wrap: (title: string, paragraphs: string) => string,
    emptyLine: string,
): string {
    return episodes
        .map((episode) => {
            const title = escapeHtml(episode.title || `${episode.ep_number}話`);

            const paragraphs = plain(episode.body)
                .split("\n")
                .map((line) =>
                    line.trim() === "" ? emptyLine : `<p>${escapeHtml(line)}</p>`,
                )
                .join("\n");

            return wrap(title, paragraphs);
        })
        .join("\n");
}

/**
 * ------------------------------------------------------------
 * Word
 * ------------------------------------------------------------
 */

export function buildWord(work: Work, episodes: Episode[]): string {
    const body = buildSections(
        episodes,
        (title, paragraphs) =>
            `<h2>${title}</h2>\n${paragraphs}\n<p style="page-break-before:always">&nbsp;</p>`,
        "<p>&nbsp;</p>",
    );

    /*
     * Word が読む HTML。
     * xmlns の指定があると、Word が自分の形式として開く。
     */
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(work.title)}</title>
<style>
  body { font-family: "Yu Mincho", "MS Mincho", serif; font-size: 10.5pt; line-height: 1.8; }
  h1 { font-size: 18pt; }
  h2 { font-size: 13pt; margin-top: 2em; }
  p { margin: 0 0 0.2em; text-indent: 1em; }
</style>
</head>
<body>
<h1>${escapeHtml(work.title)}</h1>
${body}
</body>
</html>`;
}

/**
 * ------------------------------------------------------------
 * EPUB
 *
 * 決まった形の zip。中身は次の通り。
 *
 *   mimetype              … 中身の種類。圧縮せず先頭に置く決まり
 *   META-INF/container.xml … どこに目次があるか
 *   OEBPS/content.opf     … 書名・著者・話の並び
 *   OEBPS/nav.xhtml       … 目次
 *   OEBPS/text/*.xhtml    … 話ごとの本文
 *
 * 1 枚の XHTML で済ませていたが、
 * それは EPUB ではないので読める道具が限られる。
 * ------------------------------------------------------------
 */

export async function buildEpub(
    work: Work,
    episodes: Episode[],
    authorName: string,
    isVertical: boolean,
): Promise<Blob> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const bookId = `urn:uuid:${work.id}`;
    const title = escapeHtml(work.title || "名前のない作品");
    const author = escapeHtml(authorName || "名無しの書き手");

    /*
     * mimetype は圧縮しない。
     * 圧縮すると、読む側が EPUB と見なさないことがある。
     */
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    zip.file(
        "META-INF/container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    );

    /* 縦書きの指定。読む道具がこれを見て組み方を決める */
    const direction = isVertical ? "rtl" : "ltr";
    const writingMode = isVertical ? "vertical-rl" : "horizontal-tb";

    zip.file(
        "OEBPS/style.css",
        `html, body {
  writing-mode: ${writingMode};
  -epub-writing-mode: ${writingMode};
  line-height: 1.8;
  font-family: serif;
}
h1 { font-size: 1.5em; }
h2 { font-size: 1.15em; margin: 2.5em 0 1em; }
p { margin: 0 0 0.3em; text-indent: 1em; }
.note { margin: 2em 0; padding: 1em; background: #f4f5f2; }`,
    );

    /* 話ごとの本文 */
    const items: { id: string; href: string; title: string }[] = [];

    episodes.forEach((episode, index) => {
        const id = `ep${index + 1}`;
        const href = `text/${id}.xhtml`;
        const epTitle = escapeHtml(episode.title || `${episode.ep_number}話`);

        const paragraphs = plain(episode.body)
            .split("\n")
            .map((line) =>
                line.trim() === "" ? "<p><br/></p>" : `<p>${escapeHtml(line)}</p>`,
            )
            .join("\n");

        const preface = episode.preface
            ? `<div class="note">${escapeHtml(episode.preface).replace(/\n/g, "<br/>")}</div>`
            : "";
        const afterword = episode.afterword
            ? `<div class="note">${escapeHtml(episode.afterword).replace(/\n/g, "<br/>")}</div>`
            : "";

        zip.file(
            `OEBPS/${href}`,
            `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
<head>
  <meta charset="utf-8"/>
  <title>${epTitle}</title>
  <link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
  <h2>${epTitle}</h2>
${preface}
${paragraphs}
${afterword}
</body>
</html>`,
        );

        items.push({ id, href, title: epTitle });
    });

    /* 目次 */
    zip.file(
        "OEBPS/nav.xhtml",
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="ja" lang="ja">
<head><meta charset="utf-8"/><title>目次</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目次</h1>
    <ol>
${items.map((item) => `      <li><a href="${item.href}">${item.title}</a></li>`).join("\n")}
    </ol>
  </nav>
</body>
</html>`,
    );

    /* 書名・著者・話の並び */
    zip.file(
        "OEBPS/content.opf",
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0"
         unique-identifier="bookid" xml:lang="ja"
         prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
    <meta property="rendition:layout">reflowable</meta>
    <meta property="rendition:spread">auto</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${items.map((item) => `    <item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`).join("\n")}
  </manifest>
  <spine page-progression-direction="${direction}">
${items.map((item) => `    <itemref idref="${item.id}"/>`).join("\n")}
  </spine>
</package>`,
    );

    return zip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
    });
}
