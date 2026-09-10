import { CORES, PLACES, WORKS, type Core, type Place, type Work } from "@/lib/game/works-100";
/**
 * ============================================================
 * 原石航路
 * 作家人生ゲーム — 出来事と、点の付け方
 *
 * ★ 軸は 6 つ。6 角形の頂点が、そのまま 6 つの結果になる。
 *
 *     chara   キャラクター    ライトノベル作家
 *     world   世界観・場面    コミカライズ原作者
 *     text    文章・余韻      文芸作家
 *     story   物語の流れ      映像・シナリオ原作者
 *     reach   届ける力        WEBヒット作家
 *     heat    熱量・続ける力  （どれにも要る。大吉の土台）
 *
 *   heat だけは、単独では結果にしない。
 *   続ける力は「何になるか」ではなく「行けるところまで行けるか」なので。
 *
 * ★ 札は、型が透けないように書く。
 *
 *   「文章を大事にする」と書けば、文芸を選ぶ人が選ぶ。
 *   それでは占いにならない。
 *   その人が実際にしそうな行いを書いて、裏で点を振る。
 *
 * ★ 選んだら、すぐ次へ。
 *
 *   一度は「あなたはこういう人だ」と挟んでいた。
 *   1 問ごとに待たされるのは、10 問続くと重い。
 *   遊ぶ手を止めない。読ませるのは、最後だけでいい。
 * ============================================================
 */

export type Axis = "chara" | "world" | "text" | "story" | "reach" | "heat";

export type Score = Record<Axis, number>;

export interface Choice {
    label: string;
    add: Partial<Score>;
    /**
     * この札が入れる票。
     *
     * ★ 6 つの角（書き方）とは別に、
     *   舞台（どこの話か）と芯（何の話か）に票を入れる。
     *   その二つで、書ける一作が決まる。
     */
    place?: Place;
    core?: Core;
    /** 本の背として出すときの色 */
    cover?: { base: string; ink: string };
}

export interface Stage {
    tag: string;
    title: string;
    lines: string[];
    ask: string;
    choices: Choice[];
    look?: "note" | "book" | "comment" | "plain";
    meter?: { to: number; unit: string; sub?: string };
}

export const STAGES: Stage[] = [
    {
        tag: "STAGE 1",
        title: "最初の原石",
        lines: [
            "深夜。机の上に、書きかけのメモが4枚。",
            "どれも、いつか書こうと思って置いたままのもの。",
        ],
        ask: "今夜、どれから手を伸ばしますか。",
        look: "note",
        choices: [
            {
                label: "この主人公、絶対に面白い",
                core: "成長",
                add: { chara: 4, heat: 1 },
            },
            {
                label: "誰も知らない世界を作りたい",
                core: "発見",
                add: { world: 4, story: 1 },
            },
            {
                label: "このラストだけは絶対に書きたい",
                core: "喪失",
                add: { story: 4, text: 1 },
            },
            {
                label: "この一文から始めたい",
                core: "恋",
                add: { text: 4, chara: 1 },
            },
        ],
    },

    {
        tag: "STAGE 2",
        title: "本屋で一冊だけ",
        lines: ["中身は分かりません。", "表紙と題名だけで、一冊だけ買えます。"],
        ask: "",
        look: "book",
        choices: [
            {
                label: "魔王を倒した俺は、今日から喫茶店を始めます",
                place: "異世界",
                add: { chara: 3, reach: 2 },
                cover: { base: "#f0e2c4", ink: "#6a4a1e" },
            },
            {
                label: "夏の終わり、君の名前を忘れる",
                place: "現代",
                add: { text: 3, story: 1 },
                cover: { base: "#dfe9ef", ink: "#2d4a5e" },
            },
            {
                label: "月面都市第七埠頭",
                place: "近未来",
                add: { world: 4 },
                cover: { base: "#23303f", ink: "#dfe6ee" },
            },
            {
                label: "彼女が死んだ日のことを、僕だけが覚えている",
                place: "都市",
                add: { story: 3, text: 1 },
                cover: { base: "#efe4e6", ink: "#5e3a40" },
            },
        ],
    },

    {
        tag: "STAGE 3",
        title: "はじめての投稿",
        lines: ["書き上げた第1話を、思いきって出しました。", "24時間後——"],
        meter: { to: 47, unit: "PV", sub: "♡ 3　感想 1" },
        ask: "さて、どうしますか。",
        choices: [
            {
                label: "題名とあらすじを、書き直す",
                place: "異世界",
                add: { reach: 4 },
            },
            {
                label: "とにかく、次の話を書く",
                place: "学園",
                add: { heat: 4 },
            },
            {
                label: "第1話を、もう一度書き直す",
                place: "幻想",
                add: { text: 3, heat: 1 },
            },
            {
                label: "読んでくれた3人のことを、考える",
                place: "田舎",
                add: { chara: 2, reach: 1, text: 1 },
            },
        ],
    },

    {
        tag: "STAGE 4",
        title: "はじめての感想",
        lines: ["通知が4つ。", "どれも嬉しいけれど、ひとつだけ選ぶなら。"],
        ask: "",
        look: "comment",
        choices: [
            {
                label: "この主人公、めっちゃ好きです",
                core: "恋",
                add: { chara: 4 },
            },
            {
                label: "続きまだですか？",
                core: "冒険",
                add: { reach: 3, heat: 2 },
            },
            {
                label: "最後の一文が、ずっと頭に残っています",
                core: "喪失",
                add: { text: 4 },
            },
            {
                label: "頭の中で、映像が流れました",
                core: "謎",
                add: { world: 3, story: 2 },
            },
        ],
    },

    /* STAGE 5 は 100 の振り分け。画面の側で受け持つ */

    {
        tag: "STAGE 6",
        title: "書けない夜",
        lines: [
            "3週間、一行も書けていません。",
            "更新は止まり、読者の数も少しずつ減っていく。",
        ],
        ask: "この夜、あなたは何をしますか。",
        choices: [
            {
                label: "書けなくても、机には座る",
                core: "再生",
                add: { heat: 5 },
            },
            {
                label: "他の人の作品を、片っ端から読む",
                core: "発見",
                add: { text: 2, world: 2 },
            },
            {
                label: "読者に「少し休みます」と伝える",
                core: "日常",
                add: { reach: 3, chara: 1 },
            },
            {
                label: "この物語のラストを、もう一度思い出す",
                core: "復讐",
                add: { story: 4 },
            },
        ],
    },

    {
        tag: "STAGE 7",
        title: "予想外のキャラが人気に",
        lines: [
            "主人公ではなく、3話だけ出した脇役が人気になりました。",
            "感想欄が、その子の話でいっぱいです。",
        ],
        ask: "次の話、どうしますか。",
        choices: [
            {
                label: "その子の出番を増やす",
                core: "成長",
                add: { chara: 3, reach: 2 },
            },
            {
                label: "予定どおり進める",
                core: "対立",
                add: { story: 3, text: 2 },
            },
            {
                label: "その子の物語を、別に立てる",
                core: "冒険",
                add: { world: 4 },
            },
            {
                label: "なぜ人気が出たのか、考えてみる",
                core: "謎",
                add: { reach: 3, chara: 1 },
            },
        ],
    },

    {
        tag: "STAGE 8",
        title: "誰にも、見つからない",
        lines: [
            "3か月、書き続けました。",
            "話数は増え、文章もよくなっている。",
            "それでも——",
        ],
        meter: { to: 31, unit: "PV", sub: "♡ 0　感想 0" },
        ask: "この作品を、どうしますか。",
        choices: [
            {
                label: "書き方を変えず、出し続ける",
                core: "再生",
                add: { heat: 4, text: 1 },
            },
            {
                label: "誰かに読んでくださいと、声をかける",
                core: "日常",
                add: { reach: 4 },
            },
            {
                label: "第1話だけ、もう一度作り直す",
                core: "復讐",
                add: { text: 2, story: 2 },
            },
            {
                label: "この話を面白いと思う人が、どこかにいると信じる",
                core: "対立",
                add: { heat: 3, chara: 2 },
            },
        ],
    },

    {
        tag: "STAGE 9",
        title: "誰かと組むことになった",
        lines: [
            "あなたの物語を、別の人が形にすることになりました。",
            "絵になるか、映像になるかは、まだ分かりません。",
        ],
        ask: "絶対に変えてほしくないものを、ひとつ。",
        choices: [
            {
                label: "キャラクター",
                place: "現代",
                add: { chara: 4 },
            },
            {
                label: "ストーリー",
                place: "歴史",
                add: { story: 4 },
            },
            {
                label: "世界観",
                place: "職場",
                add: { world: 4 },
            },
            {
                label: "この作品が伝えたいこと",
                place: "辺境",
                add: { text: 4 },
            },
        ],
    },

    {
        tag: "STAGE 10",
        title: "数年後",
        lines: ["あなたの作品について、誰かが話しています。"],
        ask: "いちばん言われたいのは、どれですか。",
        look: "comment",
        choices: [
            {
                label: "このキャラ、一生推す",
                place: "学園",
                add: { chara: 4, heat: 1 },
            },
            {
                label: "人生でいちばん、続きを待った作品",
                place: "都市",
                add: { reach: 3, heat: 2 },
            },
            {
                label: "何年経っても、忘れられない",
                place: "田舎",
                add: { text: 4, story: 1 },
            },
            {
                label: "この作品から、全部が始まった",
                place: "歴史",
                add: { world: 3, story: 2 },
            },
        ],
    },
];

/* ============================================================
 * 結果
 * ============================================================ */

export const AXIS_NAME: Record<Axis, string> = {
    chara: "キャラクター",
    world: "世界観",
    text: "文章",
    story: "物語",
    reach: "発信力",
    heat: "熱量",
};

/** 6角形に描く順。隣り合うものが近い意味になるように並べる */
export const AXIS_ORDER: Axis[] = [
    "chara",
    "world",
    "story",
    "text",
    "reach",
    "heat",
];

/**
 * 結果を決める。
 *
 * ★ 二つの物差しを、別々に見る。
 *
 *     6 つの角   どう書く人か（形として見せる）
 *     舞台 × 芯  何が書けるか（一作として見せる）
 *
 *   前は 6 つの角から題名まで決めていた。
 *   「余韻」と『雨の音』が、どう繋がるのか
 *   遊んだ人には分からなかった。
 *
 *   「異世界 × 冒険」なら、二つ並べるだけで伝わる。
 *
 * ★ 票が同じなら、先に出たほうを取る。
 *   珍しさで選び直すと、答えた札と食い違って見える。
 */
export interface Verdict {
    /** どこの話か */
    place: Place;
    /** 何の話か */
    core: Core;
    /** その組で書ける一作 */
    work: Work;
    /** いちばん高い角。書き方の言葉 */
    best: Axis;
    /** 同じ手ざわりの作品を探す行き先 */
    genre: string;
}

/** ジャンルの行き先。舞台から決める */
const GENRE_OF: Record<Place, string> = {
    異世界: "異世界ファンタジー",
    現代: "日常",
    学園: "学園",
    歴史: "歴史・時代",
    近未来: "SF",
    辺境: "ハイファンタジー",
    都市: "ミステリー",
    幻想: "ローファンタジー",
    職場: "文芸",
    田舎: "文芸",
};

/**
 * いちばん票の多いものを返す。
 *
 * ★ 同点のときは、答えた道筋で決める。
 *
 *   前は一覧の先頭を返していた。
 *   票は 3〜4 しかないので同点だらけになり、
 *   先頭の「異世界」「冒険」に吸い寄せられていた。
 *
 *   全部の組み合わせを数えたところ、
 *   異世界が 43.8%、幻想・職場・田舎は 0%。
 *   出る組は 100 のうち 63 通りしかなかった。
 *
 *   同じ答えなら、いつも同じ結果になる。
 *   でたらめではなく、道筋で決まる。
 */
function topOf<T extends string>(
    votes: Record<string, number>,
    all: readonly T[],
    salt: number,
): T {
    let most = 0;
    for (const one of all) most = Math.max(most, votes[one] ?? 0);

    const tied = all.filter((one) => (votes[one] ?? 0) === most);
    return tied[salt % tied.length];
}

export function judge(
    score: Score,
    placeVotes: Record<string, number>,
    coreVotes: Record<string, number>,
    /** 答えた道筋。同点のときの決め手にする */
    salt = 0,
): Verdict {
    const place = topOf(placeVotes, PLACES, salt);
    const core = topOf(coreVotes, CORES, salt + 3);

    let best: Axis = AXIS_ORDER[0];
    for (const axis of AXIS_ORDER) {
        if (score[axis] > score[best]) best = axis;
    }

    return {
        place,
        core,
        work: WORKS[`${place}-${core}`] ?? WORKS["現代-日常"],
        best,
        genre: GENRE_OF[place],
    };
}
