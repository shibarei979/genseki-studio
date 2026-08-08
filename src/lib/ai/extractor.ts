/**
 * ============================================================
 * 原石航路 Studio
 * AI補助：本文から資料の候補を拾う
 *
 * 【この機能の位置づけ】
 * 作者が資料を手で打ち込む作業を無くすためのもの。
 * 本文に書いたことは自動で候補として並び、
 * 作者は「承認・訂正・拒否」の三択だけを行う。
 *
 * ただしプロットとメモは対象外。
 * あれは本文の外側で組み立てるものなので、拾いようがない。
 *
 * 【できないこと】
 * 本文を書かない。表紙も作らない。
 * 指示文そのものが存在しない（src/lib/ai/prompts.ts を参照）。
 *
 * 【二段構え】
 * サーバーに鍵があればモデルへ、無ければ手元の簡易版へ。
 * どちらでも呼び出し側の書き方は同じ。
 * ============================================================
 */

export type CandidateKind =
    | "character"
    | "place"
    | "organization"
    | "term"
    | "item"
    | "event";

export interface ExtractionCandidate {
    name: string;
    kind: CandidateKind;
    /** 本文だけを根拠にした短い説明 */
    summary: string;
    /** 根拠になった本文の一文 */
    context: string;
    /** 本文中に現れた回数。簡易版でのみ意味を持つ */
    count: number;
    /**
     * 本文から読み取れた項目。「役割」「人物像」など。
     * 名前だけ拾っても資料にならないので、書きぶりから言えることを持たせる。
     */
    attributes?: Record<string, string>;
    /** 本文から言える関わり。相手の名前と、関係の呼び名 */
    relations?: { to: string; label: string }[];
    /** 根拠がどこにあるか。「第3話 12行目」の形 */
    sourceRef?: string;
}

export interface ExtractionResult {
    candidates: ExtractionCandidate[];
    /** 実際にモデルを使ったか。使えなかった理由も返す */
    usedModel: boolean;
    fallbackReason?: string;
}

export interface Extractor {
    extract(
        text: string,
        knownNames: string[],
        targets: CandidateKind[],
    ): Promise<ExtractionCandidate[]>;

    /** 何が起きたかも知りたいとき */
    extractWithMeta?(
        text: string,
        knownNames: string[],
        targets: CandidateKind[],
    ): Promise<ExtractionResult>;
}

export const CANDIDATE_KIND_TO_PAGE: Record<CandidateKind, string> = {
    character: "character",
    place: "place",
    organization: "organization",
    term: "term",
    item: "item",
    event: "timeline",
};

/**
 * 行き先のページが無いときの代わり。
 * 「アイテム」ページを作っていない作品でも、
 * 拾ったものを捨てずに用語へ回す。
 */
export const KIND_FALLBACK_PAGE: Record<CandidateKind, string> = {
    character: "character",
    place: "place",
    organization: "term",
    term: "term",
    item: "term",
    event: "timeline",
};

/**
 * ============================================================
 * 手元の簡易版
 *
 * 日本語には英語の大文字のような固有名詞の目印がない。
 * 取りこぼしも、要らないものを拾うこともある。
 * 精度を上げようとするより、作者が捨てやすい形で並べるほうを優先する。
 * ============================================================
 */

const PLACE_SUFFIXES = [
    "村", "町", "市", "国", "王国", "帝国", "島", "山", "森", "湖", "海",
    "城", "塔", "駅", "港", "谷", "川", "橋", "通り", "街",
    "学校", "学院", "学園", "教室", "病院", "公園", "喫茶店", "図書館", "神殿", "遺跡",
];

const ORGANIZATION_SUFFIXES = [
    "団", "会", "組合", "協会", "教団", "騎士団", "軍", "隊", "社", "商会",
    "部", "同好会", "サークル", "一家", "派",
];

const PERSON_SUFFIXES = ["さん", "くん", "ちゃん", "様", "先生", "先輩", "殿", "氏"];

const STOP_WORDS = new Set([
    "ソレ", "コレ", "アレ", "ドレ", "ナニ", "ドコ", "イツ", "ダレ",
    "ハイ", "イイエ", "ウン", "アア", "エエ", "ハア", "ドウ", "ソウ",
]);

function splitSentences(text: string): string[] {
    return text
        .replace(/\r\n/g, "\n")
        .split(/(?<=[。！？!?])|\n/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
}

/** 道具を表しやすい語尾 */
const ITEM_SUFFIXES = [
    "剣", "刀", "杖", "弓", "槍", "鎧", "盾", "指輪", "首飾り", "鍵",
    "手紙", "書", "本", "地図", "石", "玉", "薬", "瓶", "札", "笛",
];

function guessKind(word: string): CandidateKind {
    if (ITEM_SUFFIXES.some((suffix) => word.endsWith(suffix))) return "item";
    if (PLACE_SUFFIXES.some((suffix) => word.endsWith(suffix))) return "place";
    if (ORGANIZATION_SUFFIXES.some((suffix) => word.endsWith(suffix))) return "organization";
    if (PERSON_SUFFIXES.some((suffix) => word.endsWith(suffix))) return "character";
    if (/^[ァ-ヴー・]+$/.test(word)) return "character";
    return "term";
}

export const heuristicExtractor: Extractor = {
    async extract(text, knownNames, targets) {
        const known = new Set(knownNames.map((name) => name.trim()).filter(Boolean));
        const wanted = new Set(targets);
        const found = new Map<string, { count: number; context: string }>();

        for (const sentence of splitSentences(text)) {
            const matches = sentence.match(
                /[ァ-ヴー・]{3,}|[一-龥ぁ-んァ-ヴー]{2,8}(?=[はがをにへとのやもで、。])/g,
            );
            if (!matches) continue;

            for (const raw of matches) {
                const word = raw.replace(/[・ー]+$/, "").trim();
                if (word.length < 2 || STOP_WORDS.has(word) || known.has(word)) continue;

                const existing = found.get(word);
                if (existing) existing.count += 1;
                else found.set(word, { count: 1, context: sentence.slice(0, 80) });
            }
        }

        const candidates: ExtractionCandidate[] = [];
        for (const [name, info] of Array.from(found.entries())) {
            /*
             * 1 回しか出ない語も拾う。
             * 取りこぼすより、要らないものが混じるほうがまし。
             * 捨てるのは一瞬だが、拾われなかったものは目に触れない。
             */
            if (info.count < 1) continue;

            const kind = guessKind(name);
            if (!wanted.has(kind)) continue;

            candidates.push({
                name,
                kind,
                summary: "",
                context: info.context,
                count: info.count,
            });
        }

        return candidates.sort((a, b) => b.count - a.count).slice(0, 80);
    },
};

/**
 * ============================================================
 * モデル版
 * ============================================================
 */

const TARGET_LABEL: Record<CandidateKind, string> = {
    character: "人物",
    place: "場所",
    organization: "組織",
    term: "用語",
    item: "道具・持ち物",
    event: "出来事",
};

export const apiExtractor: Extractor = {
    async extract(text, knownNames, targets) {
        const result = await apiExtractWithMeta(text, knownNames, targets);
        return result.candidates;
    },

    extractWithMeta: apiExtractWithMeta,
};

async function apiExtractWithMeta(
    text: string,
    knownNames: string[],
    targets: CandidateKind[],
): Promise<ExtractionResult> {
    let response: Response;
    try {
        response = await fetch("/api/ai/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text,
                knownNames,
                targets: targets.map((target) => TARGET_LABEL[target]),
            }),
        });
    } catch {
        return {
            candidates: await heuristicExtractor.extract(text, knownNames, targets),
            usedModel: false,
            fallbackReason: "サーバーへ繋げませんでした。",
        };
    }

    /*
     * 失敗しても簡易版へ落として候補は出す。
     * 資料づくりが止まるより、粗くても並ぶほうがよい。
     * ただし理由は返す。黙って質が落ちると原因が分からない。
     */
    if (!response.ok) {
        let reason = "モデルを使えませんでした。";
        try {
            const error = (await response.json()) as { message?: string };
            if (error.message) reason = error.message;
        } catch {
            // 読めなくてもそのまま進む
        }
        return {
            candidates: await heuristicExtractor.extract(text, knownNames, targets),
            usedModel: false,
            fallbackReason: reason,
        };
    }

    const data = (await response.json()) as {
        candidates?: {
            name?: string;
            kind?: string;
            summary?: string;
            context?: string;
            attributes?: unknown;
            relations?: unknown;
            source?: unknown;
        }[];
    };

    const wanted = new Set(targets);
    const candidates = (data.candidates ?? [])
        .map((row) => ({
            name: (row.name ?? "").trim(),
            kind: (row.kind ?? "term") as CandidateKind,
            summary: (row.summary ?? "").trim(),
            context: (row.context ?? "").trim(),
            count: 1,
            attributes: cleanAttributes(row.attributes),
            relations: cleanRelations(row.relations),
            sourceRef: typeof row.source === "string" ? row.source.trim() : "",
        }))
        .filter((row) => row.name.length > 0 && wanted.has(row.kind));

    return { candidates, usedModel: true };
}

/** モデルを使う設定なら API 経由、そうでなければ手元の簡易版 */
export function getExtractor(useModel: boolean): Extractor {
    return useModel ? apiExtractor : heuristicExtractor;
}

/**
 * ============================================================
 * 返ってきた項目を整える
 *
 * モデルは形を守るが、空文字や入れ子が混ざることがある。
 * 画面に出す前にここで落としておく。
 * ============================================================
 */

/** 項目名と値の組だけを残す */
function cleanAttributes(raw: unknown): Record<string, string> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const label = key.trim();
        if (!label || label.length > 20) continue;

        // 配列で返ってきたら、読点で繋いで 1 つの値にする
        const text = Array.isArray(value)
            ? value.filter((row) => typeof row === "string").join("、")
            : typeof value === "string"
              ? value
              : "";

        const trimmed = text.trim();
        if (!trimmed || trimmed === "不明" || trimmed === "なし") continue;
        out[label] = trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
    }
    return out;
}

/** 関わりの組だけを残す */
function cleanRelations(raw: unknown): { to: string; label: string }[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((row) => {
            if (typeof row !== "object" || row === null) return null;
            const record = row as Record<string, unknown>;
            const to = typeof record.to === "string" ? record.to.trim() : "";
            const label = typeof record.label === "string" ? record.label.trim() : "";
            if (!to) return null;
            return { to, label: label.slice(0, 20) };
        })
        .filter((row): row is { to: string; label: string } => row !== null)
        .slice(0, 6);
}
