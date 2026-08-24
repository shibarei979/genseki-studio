/**
 * ============================================================
 * 原石航路 Studio
 * Google の読み上げ（WaveNet）
 *
 * 文章を送ると、音声（MP3）が返る。
 *
 * 費用がかかるので、呼ぶ前に必ず歯止めを通すこと。
 *   ・同じ話・同じ声が保存済みなら、作らない
 *   ・1 人 1 日 3 回まで
 *   ・全体で 1 か月 80 万字まで
 *
 * 鍵はサーバーでだけ使う。ブラウザへは渡さない。
 * ============================================================
 */

import { serverEnv } from "@/config/env.server";

/** 選べる声 */
export const VOICES = [
    { id: "ja-JP-Wavenet-A", label: "女性A", gender: "女性" },
    { id: "ja-JP-Wavenet-B", label: "女性B", gender: "女性" },
    { id: "ja-JP-Wavenet-C", label: "男性A", gender: "男性" },
    { id: "ja-JP-Wavenet-D", label: "男性B", gender: "男性" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

/** その声が使えるか */
export function isValidVoice(value: string): value is VoiceId {
    return VOICES.some((voice) => voice.id === value);
}

/**
 * 一度に送れる字数。
 *
 * Google の上限は 5,000 バイト。
 * 日本語は 1 文字 3 バイトなので、1,500 文字ほどで頭打ちになる。
 * 長い話は分けて送り、あとでつなぐ。
 */
const CHUNK_CHARS = 1200;

/**
 * 鍵で署名して、使う許可（アクセストークン）を得る。
 *
 * ライブラリを入れずに済ませる。
 * 依存を増やすと、動かなくなったときに調べる先が増える。
 */
async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
        iss: serverEnv.googleTtsClientEmail,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };

    const encode = (value: object) =>
        Buffer.from(JSON.stringify(value))
            .toString("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

    const unsigned = `${encode(header)}.${encode(claim)}`;

    /* 鍵で署名する */
    const crypto = await import("node:crypto");
    const signature = crypto
        .createSign("RSA-SHA256")
        .update(unsigned)
        .sign(serverEnv.googleTtsPrivateKey, "base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: `${unsigned}.${signature}`,
        }),
    });

    if (!response.ok) {
        throw new Error("読み上げの鍵が使えませんでした");
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("読み上げの鍵が使えませんでした");

    return data.access_token;
}

/**
 * 文章を音声にする。
 *
 * 返るのは MP3 のかたまり。
 * 長い文章は分けて送り、つないで返す。
 */
export async function synthesize(
    text: string,
    voice: VoiceId,
): Promise<Buffer> {
    const token = await getAccessToken();

    /*
     * 分ける。
     *
     * 途中で切ると読みが不自然になるので、
     * 句点・改行のあとで切る。
     */
    const chunks: string[] = [];
    let rest = text;

    while (rest.length > 0) {
        if (rest.length <= CHUNK_CHARS) {
            chunks.push(rest);
            break;
        }

        const head = rest.slice(0, CHUNK_CHARS);
        /* 後ろから、切ってよい所を探す */
        const at = Math.max(
            head.lastIndexOf("。"),
            head.lastIndexOf("\n"),
            head.lastIndexOf("」"),
        );

        const cut = at > CHUNK_CHARS / 2 ? at + 1 : CHUNK_CHARS;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }

    const parts: Buffer[] = [];

    for (const chunk of chunks) {
        const response = await fetch(
            "https://texttospeech.googleapis.com/v1/text:synthesize",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    input: { text: chunk },
                    voice: { languageCode: "ja-JP", name: voice },
                    audioConfig: {
                        audioEncoding: "MP3",
                        /*
                         * 読む速さ。
                         *
                         * 既定の 1.0 は小説にはやや速い。
                         * 少し落として、間を取りやすくする。
                         */
                        speakingRate: 0.95,
                    },
                }),
            },
        );

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`読み上げを作れませんでした: ${detail.slice(0, 200)}`);
        }

        const data = (await response.json()) as { audioContent?: string };
        if (!data.audioContent) throw new Error("読み上げを作れませんでした");

        parts.push(Buffer.from(data.audioContent, "base64"));
    }

    return Buffer.concat(parts);
}
