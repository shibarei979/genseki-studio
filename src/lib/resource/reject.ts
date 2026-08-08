/**
 * ============================================================
 * 原石航路 Studio
 * 資料の候補から、名前でないものを弾く
 *
 * AI は本文から名前らしきものを拾うが、
 * 「わたし」「あなた」のような代名詞まで人物にしてしまう。
 *
 * 中身の無い項目が並ぶと、資料そのものが信用されなくなる。
 * 拾う前に落とす。
 * ============================================================
 */

/** 人物として扱わない語 */
const NOT_A_NAME = new Set([
    // 自分を指す
    "わたし", "私", "あたし", "僕", "ぼく", "俺", "おれ", "自分",
    "われ", "我", "小生", "拙者", "余", "朕", "うち",
    // 相手を指す
    "あなた", "貴方", "君", "きみ", "お前", "おまえ", "あんた",
    "そなた", "汝", "なんじ", "貴様", "きさま", "お主", "おぬし",
    // その人を指す
    "彼", "かれ", "彼女", "かのじょ", "あの人", "その人", "この人",
    "誰", "だれ", "誰か", "みんな", "みな", "皆",
    // まとまりを指す
    "私たち", "わたしたち", "僕たち", "ぼくたち", "俺たち", "おれたち",
    "彼ら", "かれら", "彼女たち", "あなたたち", "君たち", "きみたち",
    // 名前ではなく、その場の指し方
    "人", "人々", "人間", "者", "もの", "方", "かた",
    "みなさん", "皆さん",
]);

/**
 * 役どころ。
 *
 * 名前ではないが、物語には出てくる。
 * 「少年」と呼ばれる人物が本当にいるので、落とさない。
 *
 * 同じ呼び名が別人を指すことがあるので、
 * 2 人目からは「少年B」のように分ける。
 */
const ROLE_NAMES = new Set([
    // 役どころ
    "男", "女", "少年", "少女", "青年", "老人", "老婆", "老爺",
    "旅人", "商人", "兵士", "衛兵", "店主", "主人", "客",
    "村人", "町人", "医者",

    /*
     * 続柄。
     *
     * 「母さん」と呼ばれる人物が物語にいる。
     * 名前が明かされないまま最後まで進むこともある。
     */
    "母", "父", "兄", "姉", "弟", "妹", "祖父", "祖母",
    "お母さん", "お父さん", "お兄さん", "お姉さん",
    "母さん", "父さん", "兄さん", "姉さん",
    "ママ", "パパ", "息子", "娘", "夫", "妻", "子供", "子ども",
]);

export function isRoleName(raw: string): boolean {
    return ROLE_NAMES.has(raw.trim());
}

/**
 * 役どころの呼び名に、区別の印を足す。
 *
 *   少年 → 少年B → 少年C
 *
 * すでにある名前と見比べて、空いている印を返す。
 */
export function nextRoleName(base: string, existing: string[]): string {
    if (!existing.includes(base)) return base;

    /* B から始める。1 人目は印を付けない */
    for (let i = 1; i < 26; i += 1) {
        const suffix = String.fromCharCode(65 + i);
        const candidate = `${base}${suffix}`;
        if (!existing.includes(candidate)) return candidate;
    }

    return `${base}${existing.length + 1}`;
}

/**
 * 人物の名前として扱ってよいか。
 *
 * 落とすのは、はっきり名前でないものだけ。
 * 迷うものは通す。拾い漏らすより、
 * 後から消せるほうがよい。
 */
export function isPersonName(raw: string): boolean {
    const name = raw.trim();

    if (name.length === 0) return false;

    /*
     * 1 文字でも、漢字なら名前のことがある（律、澪、灯）。
     * 仮名 1 文字は助詞や感嘆なので落とす。
     */
    if (name.length === 1 && !/^[\u4e00-\u9fff]$/.test(name)) return false;
    /* 長すぎるものは文の切れ端 */
    if (name.length > 20) return false;

    if (NOT_A_NAME.has(name)) return false;

    /*
     * 「〜の」「〜は」で終わるものは、
     * 助詞を巻き込んだ切れ端。
     */
    if (/[はがのをにでとへもや]$/.test(name)) return false;

    /* 句読点や括弧が混ざるものは文 */
    if (/[。、！？「」『』（）]/.test(name)) return false;

    /* 数字だけ、記号だけ */
    if (/^[\d\s\-–—・.,]+$/.test(name)) return false;

    return true;
}

/**
 * 中身があるか。
 *
 * 名前しか無い項目は、資料として役に立たない。
 * 出来事なら「いつ」「何があったか」が要る。
 */
export function hasSubstance(entry: {
    summary?: string;
    values?: Record<string, unknown>;
}): boolean {
    if (entry.summary && entry.summary.trim().length > 0) return true;

    const values = entry.values ?? {};
    return Object.values(values).some((value) => {
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined;
    });
}
