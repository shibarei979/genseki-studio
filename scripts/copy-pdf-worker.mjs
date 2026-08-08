/**
 * ============================================================
 * 原石航路 Studio
 * PDF を読む部品を public へ写す
 *
 * pdfjs-dist の中にあるものを、そのまま public に置く。
 *
 * import で読み込むと、立てるときの圧縮にかけられて落ちる。
 * 新しい書き方（ES Module）で書かれていて、
 * 圧縮の道具がそれを読めない。
 *
 * 道筋で指せば圧縮を通らないので、そのまま動く。
 * 手で写すと忘れるので、立てる前に必ず走らせる。
 * ============================================================
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const FROM = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const TO = join(root, "public/pdf.worker.min.mjs");

if (!existsSync(FROM)) {
    /*
     * pdfjs-dist が入っていないことがある。
     * PDF の取り込みが使えないだけなので、止めない。
     */
    console.log("pdfjs-dist が見つかりません。PDF の取り込みは使えません。");
    process.exit(0);
}

mkdirSync(dirname(TO), { recursive: true });
copyFileSync(FROM, TO);
console.log("PDF を読む部品を public に写しました。");
