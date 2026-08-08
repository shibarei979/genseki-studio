/**
 * ============================================================
 * 原石航路 Studio
 * 拾った項目を、ページの入力欄へ振り分ける
 *
 * モデルは「役割」「立場」「肩書き」のように、
 * 同じことを違う言い方で返してくる。
 * ページ側の入力欄と突き合わせて、収まるところへ入れる。
 *
 * どこにも収まらないものは捨てずに、説明の末尾へ回す。
 * 拾ったものを黙って失うと、書き手には何が起きたか分からない。
 * ============================================================
 */

import type { ResourceField } from "@/types";

/** 入力欄の見出しに対する、別の言い方 */
const SYNONYMS: Record<string, string[]> = {
    読み: ["読み", "よみ", "かな", "ふりがな", "読み方"],
    役割: ["役割", "立場", "肩書き", "肩書", "職業", "職", "身分", "役職"],
    人物像: [
        "人物像", "性格", "人柄", "特徴", "見た目", "外見", "容姿",
        "口調", "話し方", "年齢", "年代", "背景", "経歴", "生い立ち",
    ],
    所属: ["所属", "所属先", "組織", "団体", "勤務先", "学校"],
    所在: ["所在", "場所", "位置", "所在地", "立地"],
    様子: ["様子", "雰囲気", "風景", "景観", "描写", "規模", "広さ"],
    意味: ["意味", "定義", "内容", "説明"],
    使われ方: ["使われ方", "用途", "使い方", "働き", "効果", "能力"],
    由来: ["由来", "起源", "成り立ち", "歴史", "経緯"],
    種類: ["種類", "分類", "型"],
};

/**
 * 拾った項目を、ページの入力欄へ振り分ける。
 *
 * @returns values … 入力欄へ入れる値
 *          leftover … 収まらなかったぶん（説明へ回す）
 */
export function mapAttributes(
    attributes: Record<string, string>,
    fields: ResourceField[],
): { values: Record<string, string>; leftover: string[] } {
    const values: Record<string, string> = {};
    const leftover: string[] = [];

    /** 入力欄の見出しから、その欄の鍵を引けるようにする */
    const byLabel = new Map<string, ResourceField>();
    for (const field of fields) {
        /*
         * 他の項目や話を指す欄には入れない。
         * ここには id が入る決まりなので、文章を入れると壊れる。
         */
        if (field.type === "relation_entry" || field.type === "relation_episode") {
            continue;
        }
        if (field.type === "checkbox" || field.type === "number") continue;
        byLabel.set(field.label, field);
        for (const alias of SYNONYMS[field.label] ?? []) {
            if (!byLabel.has(alias)) byLabel.set(alias, field);
        }
    }

    for (const [label, value] of Object.entries(attributes)) {
        const field = byLabel.get(label) ?? findLoose(label, byLabel);

        if (!field) {
            leftover.push(`${label}：${value}`);
            continue;
        }

        const key = field.key;
        if (values[key]) {
            /*
             * 同じ欄に 2 つ来たら繋ぐ。
             * 「性格」と「口調」が両方とも人物像に来る、といったことが起きる。
             */
            values[key] = `${values[key]}\n${label}：${value}`;
            continue;
        }

        // 複数行を入れられない欄には、1 行に収まるものだけ入れる
        if (field.type === "text" && value.includes("\n")) {
            leftover.push(`${label}：${value}`);
            continue;
        }

        values[key] = field.type === "tags" ? value.replace(/[、,]\s*/g, ",") : value;
    }

    return { values, leftover };
}

/** 見出しが部分的に一致するものを探す。「髪の色」→「見た目」など */
function findLoose(
    label: string,
    byLabel: Map<string, ResourceField>,
): ResourceField | undefined {
    for (const [known, field] of Array.from(byLabel.entries())) {
        if (label.includes(known) || known.includes(label)) return field;
    }
    return undefined;
}

/** 収まらなかったぶんを、説明へ足す形にする */
export function appendLeftover(summary: string, leftover: string[]): string {
    if (leftover.length === 0) return summary;
    const extra = leftover.join("\n");
    return summary ? `${summary}\n${extra}` : extra;
}
