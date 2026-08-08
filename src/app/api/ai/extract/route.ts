/**
 * ============================================================
 * 原石航路 Studio
 * POST /api/ai/extract
 *
 * 本文から資料の候補を拾う。
 *
 * 鍵をブラウザへ出さないため、モデルの呼び出しは必ずここを通す。
 * 鍵が未設定なら 501 を返し、呼び出し側は手元の簡易版へ切り替える。
 * ============================================================
 */

import { NextResponse } from "next/server";

import { hasModelAccess, serverEnv } from "@/config/env.server";
import { buildExtractUserPrompt, EXTRACT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

/**
 * 一度に送る本文の上限。
 * 超えた分は後ろ（新しい話）を優先して残す。
 * 頭から切ると、いま書いている場面が落ちる。
 */
const MAX_TEXT_LENGTH = 40000;

/** モデルの返答を待つ上限 */
const TIMEOUT_MS = 60000;

interface RequestBody {
    text?: string;
    knownNames?: string[];
    targets?: string[];
}

export async function POST(request: Request) {
    if (!hasModelAccess()) {
        return NextResponse.json(
            {
                error: "model_unavailable",
                message: "OPENAI_API_KEY が設定されていません。",
            },
            { status: 501 },
        );
    }

    let body: RequestBody;
    try {
        body = (await request.json()) as RequestBody;
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const raw = body.text ?? "";
    const text = raw.length > MAX_TEXT_LENGTH ? raw.slice(-MAX_TEXT_LENGTH) : raw;
    if (text.trim().length === 0) {
        return NextResponse.json({ candidates: [] });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serverEnv.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: serverEnv.textModel,
                /*
                 * JSON 以外が返らないようにする。
                 * これがあるので、返答から括弧を探して切り出す処理が要らない。
                 */
                response_format: { type: "json_object" },
                temperature: 0.2,
                messages: [
                    { role: "system", content: EXTRACT_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: buildExtractUserPrompt(
                            text,
                            body.knownNames ?? [],
                            body.targets ?? ["人物", "場所", "組織", "用語"],
                        ),
                    },
                ],
            }),
        });

        if (!response.ok) {
            // 何が起きたかを画面へ伝える。黙って簡易版へ落ちると原因が分からない
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
            choices?: { message?: { content?: string } }[];
        };

        const answer = data.choices?.[0]?.message?.content ?? "";
        const candidates = parseCandidates(answer);

        if (candidates === null) {
            return NextResponse.json(
                { error: "parse_error", message: "モデルの返答を読み取れませんでした。" },
                { status: 502 },
            );
        }

        return NextResponse.json({ candidates });
    } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                error: isAbort ? "timeout" : "request_failed",
                message: isAbort
                    ? "モデルの返答が時間内に返りませんでした。"
                    : "モデルへ繋げませんでした。",
            },
            { status: 502 },
        );
    } finally {
        clearTimeout(timer);
    }
}

/**
 * ============================================================
 * 返答の読み取り
 * ============================================================
 */

/**
 * JSON から候補の配列を取り出す。
 *
 * response_format を指定しているので必ず JSON が返るが、
 * 「配列そのもの」は返せない決まりなので、
 * { candidates: [...] } の形を頼む。名前が違っても拾えるようにしておく。
 */
function parseCandidates(answer: string): unknown[] | null {
    try {
        const parsed: unknown = JSON.parse(answer);
        if (Array.isArray(parsed)) return parsed;

        if (typeof parsed === "object" && parsed !== null) {
            const record = parsed as Record<string, unknown>;
            for (const key of ["candidates", "items", "results", "data"]) {
                if (Array.isArray(record[key])) return record[key] as unknown[];
            }
            // 唯一の配列があればそれを使う
            const arrays = Object.values(record).filter(Array.isArray);
            if (arrays.length === 1) return arrays[0] as unknown[];
        }
        return null;
    } catch {
        return null;
    }
}

/** 上流の応答をそのまま出さず、対処が分かる言い方にする */
function describeUpstream(status: number): string {
    if (status === 401) return "鍵が正しくありません。";
    if (status === 429) return "回数の上限に達しました。しばらく待ってください。";
    if (status === 402) return "残高が足りません。";
    if (status >= 500) return "モデル側で問題が起きています。";
    return "モデルへの要求が受け付けられませんでした。";
}
