/**
 * ============================================================
 * 原石航路 Studio
 * POST /api/ai/image
 *
 * 資料に添える図案を作る。
 * 本文や表紙は作らない。ここで作れるのは資料の図案だけ。
 *
 * 返すのは画像そのもの（base64）。
 * OpenAI の画像は数分で消える URL なので、そのまま渡すと後で開けなくなる。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { hasModelAccess, serverEnv } from "@/config/env.server";
import { buildImageUserPrompt, imageSizeFor } from "@/lib/ai/prompts";
import type { MapEra } from "@/lib/ai/real-places";

const ALLOWED_STYLES = new Set(["portrait", "scene", "crest", "icon", "map"]);

/** 図案は待たせすぎない。長引くなら手元の図で足りる */
const TIMEOUT_MS = 45000;

interface RequestBody {
    name?: string;
    style?: string;
    hint?: string;
    /** 地図のときだけ使う */
    era?: string;
}

export async function POST(request: Request) {
    if (!hasModelAccess()) {
        return NextResponse.json({ error: "model_unavailable" }, { status: 501 });
    }

    let body: RequestBody;
    try {
        body = (await request.json()) as RequestBody;
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const name = (body.name ?? "").trim().slice(0, 60);
    const style = body.style ?? "";

    /*
     * 決められた 4 種類以外は受け付けない。
     * ここを自由にすると、資料の図案という枠を越えた頼み方ができてしまう。
     */
    if (!name || !ALLOWED_STYLES.has(style)) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serverEnv.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: serverEnv.imageModel,
                prompt: buildImageUserPrompt(
                    name,
                    style,
                    body.hint?.slice(0, 200),
                    body.era as MapEra | undefined,
                ),
                size: imageSizeFor(style),
                quality: "low",
                n: 1,
            }),
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            return NextResponse.json(
                {
                    error: "upstream_error",
                    status: response.status,
                    message: describeUpstream(response.status),
                    detail: detail.slice(0, 300),
                },
                { status: 502 },
            );
        }

        const data = (await response.json()) as {
            data?: { b64_json?: string; url?: string }[];
        };

        const encoded = data.data?.[0]?.b64_json;
        if (!encoded) {
            return NextResponse.json(
                { error: "empty_result", message: "図案が返りませんでした。" },
                { status: 502 },
            );
        }

        // データURI にして返す。保存先ができるまではこの形で持つ
        return NextResponse.json({ image: `data:image/png;base64,${encoded}` });
    } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                error: isAbort ? "timeout" : "request_failed",
                message: isAbort
                    ? "図案づくりが時間内に終わりませんでした。"
                    : "モデルへ繋げませんでした。",
            },
            { status: 502 },
        );
    } finally {
        clearTimeout(timer);
    }
}

function describeUpstream(status: number): string {
    if (status === 401) return "鍵が正しくありません。";
    if (status === 429) return "回数の上限に達しました。しばらく待ってください。";
    if (status === 402) return "残高が足りません。";
    if (status >= 500) return "モデル側で問題が起きています。";
    return "図案づくりの要求が受け付けられませんでした。";
}
