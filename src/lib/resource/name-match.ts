/**
 * ============================================================
 * 原石航路 Studio
 * 表記ゆれの突き合わせ
 *
 * 同じものが別名で並ぶのは、資料が壊れる一番の原因。
 *   リオ / リオ・アルセイン / リオくん
 *   王都アルセイン / アルセイン王都
 * これらが別項目として増え続けると、どれが本物か分からなくなる。
 *
 * 機械が勝手に統合はしない。「同じでは」と並べるところまで。
 * 別人の「田中」と「田中」を勝手にまとめられたら取り返しがつかない。
 * ============================================================
 */

/**
 * 比べるための形に均す。
 *   カタカナ → ひらがな
 *   全角英数 → 半角
 *   中黒・長音・空白・記号を落とす
 */
export function normalizeName(name: string): string {
    return name
        .trim()
        .replace(/[\uff01-\uff5e]/g, (char) =>
            String.fromCharCode(char.charCodeAt(0) - 0xfee0),
        )
        .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
        .replace(/[・･ー\-—–\s　'"’”]/g, "")
        .toLowerCase();
}

/** 敬称・呼び方を落とす。「リオくん」と「リオ」を同じ側に寄せる */
const HONORIFICS = ["さん", "くん", "ちゃん", "さま", "様", "せんせい", "先生", "せんぱい", "先輩", "どの", "殿", "し", "氏"];

export function stripHonorific(normalized: string): string {
    for (const honorific of HONORIFICS) {
        const key = normalizeName(honorific);
        if (normalized.length > key.length + 1 && normalized.endsWith(key)) {
            return normalized.slice(0, -key.length);
        }
    }
    return normalized;
}

/**
 * 2 つの名前がどれくらい近いか。0〜1。
 *
 * 完全一致だけを見ると「リオ」と「リオ・アルセイン」を拾えない。
 * 編集距離だけを見ると短い名前どうしが何でも近くなる。
 * そこで「片方がもう片方を含むか」を先に見て、
 * 残りを編集距離で測る。
 */
export function similarity(a: string, b: string): number {
    const left = stripHonorific(normalizeName(a));
    const right = stripHonorific(normalizeName(b));
    if (!left || !right) return 0;
    if (left === right) return 1;

    // 短いほうが 2 文字未満のときは、含んでいても偶然の可能性が高い
    const shorter = left.length <= right.length ? left : right;
    const longer = left.length <= right.length ? right : left;
    if (shorter.length < 2) return 0;

    if (longer.startsWith(shorter) || longer.endsWith(shorter)) {
        // 名前の一部を切り出した呼び方とみなす。長さの差が大きいほど確度は下がる
        return 0.7 + 0.25 * (shorter.length / longer.length);
    }
    if (longer.includes(shorter)) return 0.6 + 0.2 * (shorter.length / longer.length);

    const distance = levenshtein(left, right);
    const score = 1 - distance / Math.max(left.length, right.length);
    return score > 0.75 ? score : 0;
}

function levenshtein(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    let previous = Array.from({ length: cols }, (_, i) => i);

    for (let i = 1; i < rows; i += 1) {
        const current = [i];
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost,
            );
        }
        previous = current;
    }
    return previous[cols - 1];
}

/**
 * ============================================================
 * 重複の見つけ方
 * ============================================================
 */

export interface NameLike {
    id: string;
    name: string;
    /** 古い保存データには無いことがある */
    aliases?: string[] | null;
    page_id: string;
}

/**
 * 別名を必ず配列にする。
 *
 * 読み込み側（repository）でも形を揃えているが、
 * ここは外から何を渡されても落ちてはいけない純粋な関数なので、
 * 二重に守っておく。落ちると資料の画面全体が開かなくなる。
 */
function aliasesOf(entry: NameLike): string[] {
    return Array.isArray(entry.aliases) ? entry.aliases : [];
}

export interface DuplicateGroup {
    /** 残す候補（別名がいちばん多い、または名前が長いもの） */
    keep: NameLike;
    others: { entry: NameLike; score: number }[];
}

const THRESHOLD = 0.78;

/**
 * 同じページの中だけで突き合わせる。
 * 人物の「アルセイン」と場所の「アルセイン」は別物なので、
 * ページをまたいだ統合は提案しない。
 */
export function findDuplicateGroups(entries: NameLike[]): DuplicateGroup[] {
    const used = new Set<string>();
    const groups: DuplicateGroup[] = [];

    for (const entry of entries) {
        if (used.has(entry.id)) continue;
        if (!entry.name) continue;

        const matches: { entry: NameLike; score: number }[] = [];
        for (const other of entries) {
            if (other.id === entry.id || used.has(other.id)) continue;
            if (other.page_id !== entry.page_id) continue;

            const names = [entry.name, ...aliasesOf(entry)];
            const otherNames = [other.name, ...aliasesOf(other)];
            let best = 0;
            for (const left of names) {
                for (const right of otherNames) {
                    best = Math.max(best, similarity(left, right));
                }
            }
            if (best >= THRESHOLD) matches.push({ entry: other, score: best });
        }

        if (matches.length === 0) continue;

        // いちばん詳しそうなものを残す側にする
        const candidates = [entry, ...matches.map((match) => match.entry)];
        const keep = candidates.reduce((best, current) =>
            current.name.length > best.name.length ? current : best,
        );
        const others = candidates
            .filter((candidate) => candidate.id !== keep.id)
            .map((candidate) => ({
                entry: candidate,
                score:
                    matches.find((match) => match.entry.id === candidate.id)?.score ?? 1,
            }));

        groups.push({ keep, others });
        used.add(keep.id);
        for (const other of others) used.add(other.entry.id);
    }

    return groups;
}
