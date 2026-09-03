/**
 * ============================================================
 * 原石航路 Studio
 * 挿絵の位置を、本文の直しに追いかけさせる
 *
 * ★ 場所は「何文目の後ろか」で持っている。
 *
 *   前のほうに文を足すと、後ろの番号が全部ずれる。
 *   何もしないと、絵だけが元の番号の所に残り、
 *   まったく違う場面に出てしまう。
 *
 * ★ 置いたときの文（anchor_text）を控えてある。
 *
 *   新しい本文から、その文をもう一度探して番号を付け直す。
 *
 *   見つからない  … 作者がその文ごと消したということ。
 *                    番号は動かさない。勝手に別の場所へ移さない。
 *   同じ文が何度もある … 元の番号にいちばん近いものを選ぶ。
 * ============================================================
 */

import { getRepository } from "@/lib/repository";
import { splitIntoSentences } from "@/lib/utils/sentences";

/** 比べるときは、前後の空白と改行を落とす */
function normalize(text: string): string {
    return text.replace(/\s+/g, "").trim();
}

/**
 * 本文を保存したあとに呼ぶ。
 *
 * 動かす必要のあるものだけ書き換える。
 * 変わっていなければ、何も送らない。
 */
export async function realignIllusts(
    episodeId: string,
    body: string,
): Promise<number> {
    const repository = getRepository();

    let illusts;
    try {
        illusts = await repository.listEpisodeIllusts(episodeId);
    } catch {
        return 0;
    }

    if (illusts.length === 0) return 0;

    const sentences = splitIntoSentences(body).map(normalize);
    let moved = 0;

    for (const illust of illusts) {
        /* 本文の頭に置いたものは、いつでも頭のまま */
        if (illust.after_sentence === 0) continue;

        const anchor = normalize(illust.anchor_text ?? "");
        if (!anchor) continue;

        /* 元の番号に近いものから探す */
        let best = -1;
        let bestGap = Number.MAX_SAFE_INTEGER;

        sentences.forEach((one, idx) => {
            if (one !== anchor) return;

            const gap = Math.abs(idx + 1 - illust.after_sentence);
            if (gap < bestGap) {
                bestGap = gap;
                best = idx + 1;
            }
        });

        /* 見つからない、または動いていない */
        if (best < 0 || best === illust.after_sentence) continue;

        try {
            await repository.moveEpisodeIllust(
                illust.id,
                best,
                illust.anchor_text ?? "",
            );
            moved += 1;
        } catch {
            /* 1 枚失敗しても、残りは続ける */
        }
    }

    return moved;
}
