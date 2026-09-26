import { NextResponse } from "next/server";

import { hasModelAccess, serverEnv } from "@/config/env.server";
import type { CheckIssue, CheckKind, GlossaryTerm } from "@/lib/manuscript/glossary";
import { around, findGlossaryIssues, lineAt } from "@/lib/manuscript/glossary";
import { checkLeft, countCheck } from "@/lib/subscription/ai-check-quota";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * 原石航路 Studio
 * /api/ai/check — AI 誤字脱字・表記揺れチェック（Pro）
 *
 * GET   今月あと何回使えるか
 * POST  { work, text }  開いている 1 話の本文を見て、気になる所を返す
 *
 * ★ 見つけるだけ。本文は書き換えない。
 *   直すかどうかは作者が決める。勝手に直すと、
 *   わざと崩した台詞や方言まで「正しく」されてしまう。
 *
 * ★ 2 段で探す。
 *   1. 語彙集に載せた「使わない書き方」… AI を通さずに探す（確実・費用なし）
 *   2. それ以外の誤字・脱字・表記揺れ … AI に探してもらう
 *
 * ★ AI の返事は、本文に本当にある所だけ残す。
 *   AI は本文に無い文を「引用」してしまうことがある。
 *   本文から見つからないものは捨てる。
 * ============================================================
 */

export const dynamic = "force-dynamic";

/** 1 回に見る字数。1 話ぶんとして十分な量。これを超えたら前から */
const MAX_CHARS = 20000;

/** AI の返事を待つ上限 */
const TIMEOUT_MS = 90000;

/** 返す数の上限。多すぎると読まれない */
const MAX_ISSUES = 60;

const SYSTEM_PROMPT = `あなたは日本語の小説の校正者です。与えられた本文から、次の 3 種類だけを探してください。

- typo（誤字）：変換の誤り、打ち間違い、明らかな誤用（例：「以外と」→「意外と」、「確率」と「確立」の取り違え）
- omission（脱字）：助詞や文字が抜けている所（例：「彼走り出した」→「彼は走り出した」）
- variant（表記揺れ）：同じ言葉が本文の中で違う書き方をされている所（例：「ひとり」と「一人」、「メール」と「メイル」の混在）。揺れている側（少ないほう）を指摘し、多いほうへ揃える提案をする

次のものは指摘しないでください。
- 文体・言い回し・読点の好み、文の長さ
- 台詞の中の口語、方言、わざと崩した言葉、擬音
- 「作品固有の言葉」として渡した名前や用語
- 確信の持てないもの

返事は必ず次の JSON だけにしてください。
{"issues":[{"type":"typo|omission|variant","quote":"本文からそのまま写した10〜30字","word":"直す対象の言葉だけ","suggestion":"直した形の言葉","reason":"20字以内の理由"}]}
quote は本文の文字をそのまま写し、一字も変えないこと。見つからなければ {"issues":[]}。`;

export async function GET() {
    const gate = await checkLeft();
    return NextResponse.json({
        allowed: gate.allowed,
        limit: gate.limit,
        used: gate.used,
        left: gate.left,
        signedIn: Boolean(gate.userId),
    });
}

export async function POST(request: Request) {
    const gate = await checkLeft();
    if (!gate.userId) {
        return NextResponse.json({ error: "unauthorized", message: "ログインすると使えます。" }, { status: 401 });
    }
    if (!gate.allowed) {
        return NextResponse.json({ error: "pro", message: "AIチェックは Pro の機能です。" }, { status: 403 });
    }
    if (!gate.ok) {
        return NextResponse.json({ error: "quota", message: gate.message }, { status: 429 });
    }
    if (!hasModelAccess()) {
        return NextResponse.json({ error: "model_unavailable", message: "AIに繋がっていません。" }, { status: 501 });
    }

    let body: { work?: string; text?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const work = String(body.work ?? "");
    const full = String(body.text ?? "");
    const text = full.length > MAX_CHARS ? full.slice(0, MAX_CHARS) : full;
    if (!work || !text.trim()) {
        return NextResponse.json({ issues: [], truncated: false });
    }

    const supabase = await createClient();

    /* 自分の作品か。本人の鍵で読めなければ、ほかの人の作品 */
    const { data: novel } = await supabase
        .from("novels")
        .select("id, author_id")
        .eq("id", work)
        .maybeSingle();
    if (!novel || novel.author_id !== gate.userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [{ data: termRows }, { data: entryRows }] = await Promise.all([
        supabase.from("work_terms").select("id, novel_id, correct, variants, note").eq("novel_id", work),
        supabase
            .from("resource_entries")
            .select("name, aliases")
            .eq("novel_id", work)
            .eq("candidate_status", "none")
            .limit(300),
    ]);

    const terms = (termRows ?? []) as GlossaryTerm[];

    /* 1. 語彙集。AI を通さない */
    const glossaryIssues = findGlossaryIssues(text, terms);

    /* 2. AI。作品固有の言葉と、語彙集の正しい書き方は「直さない言葉」として渡す */
    const keep = new Set<string>();
    for (const row of entryRows ?? []) {
        if (row.name) keep.add(String(row.name));
        for (const alias of (row.aliases as string[] | null) ?? []) keep.add(alias);
    }
    for (const term of terms) keep.add(term.correct);

    const userPrompt = [
        keep.size > 0 ? `作品固有の言葉（直さない）：${Array.from(keep).slice(0, 300).join("、")}` : "",
        terms.length > 0
            ? `語彙集（左が正しい書き方）：\n${terms
                  .map((term) => `${term.correct}（使わない：${term.variants.join("、") || "なし"}）`)
                  .join("\n")}`
            : "",
        `本文：\n${text}`,
    ]
        .filter(Boolean)
        .join("\n\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let aiIssues: CheckIssue[] = [];
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
                response_format: { type: "json_object" },
                temperature: 0.1,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
            }),
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "upstream_error", message: "AIの返事を受け取れませんでした。少し待ってからもう一度押してください。" },
                { status: 502 },
            );
        }

        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        aiIssues = parseIssues(data.choices?.[0]?.message?.content ?? "", text, keep);
    } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                error: isAbort ? "timeout" : "request_failed",
                message: isAbort ? "時間内に終わりませんでした。" : "AIに繋げませんでした。",
            },
            { status: 502 },
        );
    } finally {
        clearTimeout(timer);
    }

    /* 返事が返ったので 1 回ぶん数える */
    await countCheck(gate.userId, gate.limit);

    /* 同じ行・同じ言葉は 1 つに。語彙集のほうを残す */
    const seen = new Set<string>();
    const issues = [...glossaryIssues, ...aiIssues]
        .filter((issue) => {
            const key = `${issue.line}:${issue.word}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => a.line - b.line)
        .slice(0, MAX_ISSUES);

    return NextResponse.json({
        issues,
        truncated: full.length > MAX_CHARS,
        left: gate.left === null ? null : Math.max(0, gate.left - 1),
    });
}

/** AI の返事を読み、本文に本当にあるものだけ残す */
function parseIssues(answer: string, text: string, keep: Set<string>): CheckIssue[] {
    let parsed: { issues?: unknown[] };
    try {
        parsed = JSON.parse(answer);
    } catch {
        return [];
    }

    const kinds: CheckKind[] = ["typo", "omission", "variant"];
    const found: CheckIssue[] = [];

    for (const raw of parsed.issues ?? []) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;

        const kind = String(row.type ?? "") as CheckKind;
        const quote = String(row.quote ?? "").trim();
        const word = String(row.word ?? "").trim();
        const suggestion = String(row.suggestion ?? "").trim();
        if (!kinds.includes(kind) || !quote || !suggestion) continue;

        /* 作品固有の言葉を直そうとしていたら捨てる */
        if (word && keep.has(word)) continue;

        const at = text.indexOf(quote);
        if (at < 0) continue;

        /* 言葉の位置が分かれば、そこを中心に見せる */
        const wordAt = word ? text.indexOf(word, at) : -1;
        const center = wordAt >= 0 && wordAt < at + quote.length ? wordAt : at;
        const length = wordAt >= 0 ? word.length : quote.length;

        found.push({
            kind,
            line: lineAt(text, center),
            quote: around(text, center, length),
            word: word || quote,
            suggestion,
            reason: String(row.reason ?? "").trim().slice(0, 40),
        });
    }

    return found;
}
