/**
 * ============================================================
 * 原石航路 Studio
 * 本文の中の登場を拾う
 *
 * 「このキャラ、こんなこと言ってたな」を後から辿れるようにする。
 *
 * AI には投げない。名前を探すだけの仕事に費用をかける必要はないし、
 * 本文を書き換えるたびに数え直したいので、手元で済ませる。
 *
 * 台詞・行動・言及の 3 つに分ける。
 * まとめて並べると量が多すぎて、探しているものに辿り着けない。
 * ============================================================
 */

import type { Episode, ResourceEntry } from "@/types";

export type MentionKind = "speech" | "action" | "mention";

export interface Mention {
    episodeId: string;
    epNumber: number;
    episodeTitle: string;
    /** 1 から数えた行番号。本文へ飛ぶときに使う */
    line: number;
    text: string;
    kind: MentionKind;
    /** 台詞のとき、鉤括弧の中身だけ */
    speech?: string;
}

export const MENTION_KIND_LABEL: Record<MentionKind, string> = {
    speech: "台詞",
    action: "行動",
    mention: "言及",
};

/** 行動を表す助詞。名前のすぐ後ろにあれば、その人が動いている */
const ACTOR_PARTICLES = ["は", "が", "も", "を", "に"];

/**
 * ある項目が本文のどこに出てくるかを集める。
 *
 * @param entry    調べたい項目
 * @param episodes 話（本文つき）
 */
export function scanMentions(entry: ResourceEntry, episodes: Episode[]): Mention[] {
    const names = [entry.name, ...(entry.aliases ?? [])]
        .map((name) => name.trim())
        .filter((name) => name.length >= 2);

    if (names.length === 0) return [];

    const found: Mention[] = [];

    for (const episode of episodes) {
        const lines = episode.body.split("\n");

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const matched = names.find((name) => line.includes(name));
            if (!matched) continue;

            found.push({
                episodeId: episode.id,
                epNumber: episode.ep_number,
                episodeTitle: episode.title,
                line: index + 1,
                text: line.trim(),
                kind: classify(line, matched),
                speech: extractSpeech(line),
            });
        }

        /*
         * 直前の行に名前があり、次の行が台詞だけの場合。
         * 「リオは立ち上がった。／「行こう」」という書き方は多い。
         * 名前の無い台詞を、直前の人物のものとして拾う。
         */
        for (let index = 1; index < lines.length; index += 1) {
            const line = lines[index];
            const speech = extractSpeech(line);
            if (!speech) continue;
            // その行に名前があるなら、上の走査で拾えている
            if (names.some((name) => line.includes(name))) continue;

            const previous = lines[index - 1];
            if (!names.some((name) => previous.includes(name))) continue;
            // 直前が別の誰かの台詞なら、話者が入れ替わっている見込みが高い
            if (extractSpeech(previous)) continue;

            found.push({
                episodeId: episode.id,
                epNumber: episode.ep_number,
                episodeTitle: episode.title,
                line: index + 1,
                text: line.trim(),
                kind: "speech",
                speech,
            });
        }
    }

    return found.sort(
        (a, b) => a.epNumber - b.epNumber || a.line - b.line,
    );
}

/** その行で、その項目が何をしているか */
function classify(line: string, name: string): MentionKind {
    const speech = extractSpeech(line);

    if (speech) {
        /*
         * 鉤括弧の外に名前があれば、その人の台詞。
         * 中にしかないなら、誰かがその名前を口にしただけ。
         */
        const outside = line.replace(/[「『].*?[」』]/g, "");
        return outside.includes(name) ? "speech" : "mention";
    }

    const at = line.indexOf(name);
    const after = line.slice(at + name.length);
    if (ACTOR_PARTICLES.some((particle) => after.startsWith(particle))) {
        return "action";
    }

    return "mention";
}

/** 鉤括弧の中身を取り出す */
function extractSpeech(line: string): string | undefined {
    const match = line.match(/[「『]([^」』]*)[」』]/);
    if (!match) return undefined;
    const inner = match[1].trim();
    return inner.length > 0 ? inner : undefined;
}

/**
 * ============================================================
 * まとめ
 * ============================================================
 */

export interface MentionSummary {
    total: number;
    speech: number;
    action: number;
    firstAppearance?: Mention;
    lastAppearance?: Mention;
    /** 出てくる話の数 */
    episodeCount: number;
}

export function summarizeMentions(mentions: Mention[]): MentionSummary {
    return {
        total: mentions.length,
        speech: mentions.filter((row) => row.kind === "speech").length,
        action: mentions.filter((row) => row.kind === "action").length,
        firstAppearance: mentions[0],
        lastAppearance: mentions[mentions.length - 1],
        episodeCount: new Set(mentions.map((row) => row.episodeId)).size,
    };
}
