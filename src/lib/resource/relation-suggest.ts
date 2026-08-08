/**
 * ============================================================
 * 原石航路 Studio
 * 関係の提案
 *
 * 本文の中で近くに出てくる名前どうしは、関係がある見込みが高い。
 * 同じ段落に並んでいれば、話しているか、居合わせているか、
 * どちらかである場合がほとんど。
 *
 * ここで決めるのは「関係がありそう」までで、
 * それが何の関係かは書き手が決める。
 * 機械が「親子」「敵対」まで当てにいくと、
 * 外れたときに直す手間のほうが大きくなる。
 * ============================================================
 */

import type { ResourceEntry } from "@/types";

export interface RelationSuggestion {
    fromId: string;
    toId: string;
    fromName: string;
    toName: string;
    /** 同じ段落に出た回数 */
    count: number;
    /** 根拠になった一文 */
    excerpt: string;
    /**
     * 本文から読み取れた関係の呼び名。
     * 分からなければ空。空欄のまま結んで、書き手に決めてもらう。
     */
    label: string;
    /** どの話のどこか */
    sourceRef: string;
}

/**
 * これ以上同居していたら提案する。
 *
 * 2 回を下限にしていたが、短い作品では 1 度きりの場面が多く、
 * 何も出ないことがあった。1 回でも出し、回数順に並べる。
 * 要らないものは「違う」で消せるので、出ないより出るほうがよい。
 */
const MIN_COUNT = 1;

/**
 * 一区切りとみなす行数。
 *
 * 日本語の小説は行間に空行を入れないことが多く、
 * 空行で割ると本文全体が 1 かたまりになってしまう。
 * それでは「同じ場面に居合わせた」が意味を持たない。
 * 空行があればそこで割り、無ければ数行ずつ見る。
 */
const WINDOW_LINES = 6;

/** 提案する数の上限 */
const MAX_SUGGESTIONS = 12;

/**
 * 本文と資料から、結ばれていない組み合わせを探す。
 *
 * @param bodies    話ごとの本文
 * @param entries   資料の項目（確定済みのもの）
 * @param existing  すでにある関係。「from-to」の組で渡す
 */
export function suggestRelations(
    bodies: string[],
    entries: ResourceEntry[],
    existing: Set<string>,
    /** 話の見出し。「第1話」など。行番号を出すのに使う */
    episodeLabels: string[] = [],
): RelationSuggestion[] {
    const named = entries.filter((entry) => entry.name.trim().length >= 2);
    if (named.length < 2) return [];

    /** 名前と別名から、項目を引けるようにする */
    const lookup: { id: string; name: string; surface: string }[] = [];
    for (const entry of named) {
        lookup.push({ id: entry.id, name: entry.name, surface: entry.name });
        for (const alias of entry.aliases ?? []) {
            if (alias.trim().length >= 2) {
                lookup.push({ id: entry.id, name: entry.name, surface: alias });
            }
        }
    }

    const pairs = new Map<string, RelationSuggestion>();

    for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
        const body = bodies[bodyIndex];
        const episodeLabel = episodeLabels[bodyIndex] ?? "";
        const allLines = body.split("\n");

        for (const paragraph of splitIntoScenes(body)) {
            /*
             * その場面が本文の何行目から始まるか。
             * 資料の根拠と同じ形で示せば、本文を探しに行ける。
             */
            const head = paragraph.split("\n")[0] ?? "";
            const lineIndex = allLines.findIndex((line) => line === head);
            const sourceRef =
                episodeLabel && lineIndex >= 0
                    ? `${episodeLabel} ${lineIndex + 1}行目`
                    : episodeLabel;
            // その段落に出てくる項目を集める
            const present = new Map<string, string>();
            for (const row of lookup) {
                if (paragraph.includes(row.surface)) present.set(row.id, row.name);
            }
            if (present.size < 2) continue;

            const ids = Array.from(present.keys());
            for (let i = 0; i < ids.length; i += 1) {
                for (let j = i + 1; j < ids.length; j += 1) {
                    const [a, b] = [ids[i], ids[j]].sort();
                    const key = `${a}-${b}`;
                    if (existing.has(key)) continue;

                    const found = pairs.get(key);
                    if (found) {
                        found.count += 1;
                        continue;
                    }

                    pairs.set(key, {
                        fromId: a,
                        toId: b,
                        fromName: present.get(a) ?? "",
                        toName: present.get(b) ?? "",
                        count: 1,
                        excerpt: firstSentence(paragraph),
                        label: guessLabel(paragraph, present.get(a) ?? "", present.get(b) ?? ""),
                        sourceRef,
                    });
                }
            }
        }
    }

    return Array.from(pairs.values())
        .filter((pair) => pair.count >= MIN_COUNT)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_SUGGESTIONS);
}

/**
 * 本文を場面ごとに割る。
 *
 * 空行があればそれを区切りとして使う。書き手が意図した切れ目なので。
 * 空行が無い（日本語の小説では普通）ときは、数行ずつの窓で見る。
 * 窓は半分ずつ重ねる。区切りをまたいで会話している組を
 * 取りこぼさないため。
 */
function splitIntoScenes(body: string): string[] {
    const blocks = body
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0);

    const scenes: string[] = [];

    for (const block of blocks) {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);

        if (lines.length <= WINDOW_LINES) {
            scenes.push(block);
            continue;
        }

        const step = Math.max(1, Math.floor(WINDOW_LINES / 2));
        for (let start = 0; start < lines.length; start += step) {
            const window = lines.slice(start, start + WINDOW_LINES);
            if (window.length === 0) break;
            scenes.push(window.join("\n"));
            if (start + WINDOW_LINES >= lines.length) break;
        }
    }

    return scenes;
}

/** 根拠として出す一文。長すぎると読まれない */
function firstSentence(paragraph: string): string {
    const sentence = paragraph.split(/(?<=[。！？])/)[0] ?? paragraph;
    return sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence;
}

/** 関係の組を表す鍵。順番を揃えて、逆向きを同じものとして扱う */
export function pairKey(fromId: string, toId: string): string {
    return [fromId, toId].sort().join("-");
}

/**
 * ============================================================
 * 関係の呼び名を当てる
 *
 * 本文にはっきり書かれている続柄だけを拾う。
 * 「よく一緒にいる」から「恋人」と決めるようなことはしない。
 * 外れた関係を直す手間は、空欄を埋める手間より大きい。
 * ============================================================
 */

/** 本文にそのまま出てくる続柄 */
const KINSHIP = [
    "父", "母", "兄", "姉", "弟", "妹", "祖父", "祖母", "息子", "娘",
    "夫", "妻", "叔父", "叔母", "従兄", "従姉", "親", "子",
    "師匠", "弟子", "先生", "生徒", "上司", "部下", "同僚",
    "幼なじみ", "友人", "仲間", "相棒", "婚約者",
];

function guessLabel(paragraph: string, nameA: string, nameB: string): string {
    /*
     * 「AのB」「AはBの」という形を探す。
     * 「リオの弟」なら、リオから見た相手は弟。
     */
    for (const word of KINSHIP) {
        for (const [self, other] of [
            [nameA, nameB],
            [nameB, nameA],
        ]) {
            if (paragraph.includes(`${self}の${word}`)) return word;
            if (paragraph.includes(`${other}は${self}の${word}`)) return word;
        }
    }
    return "";
}
