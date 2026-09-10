/**
 * ============================================================
 * 原石航路
 * 作家人生ゲーム — 設問と、点の付け方
 *
 * ★ 画面と中身を分ける。
 *
 *   設問を足す・言葉を直すのは、こちらだけを触る。
 *   画面の作りに手を入れずに済む。
 *
 * ★ 点は 5 つの軸に振る。
 *
 *     light    ライトノベル寄り。キャラが立つ
 *     comic    絵で見せたい。場面が強い
 *     bunge    文芸寄り。文と余韻
 *     screen   映像寄り。画と流れ
 *     web      WEB で伸ばす力。続ける・届ける
 *
 *   選んだ札ごとに、いくつかの軸へ点を足す。
 *   1 つの札で 1 つの軸、とは限らない。
 *   人は、そんなにきれいに分かれない。
 *
 * ★ 点は見せない。
 *
 *   途中で「いま文芸 12 点」と出ると、
 *   そこから先は答えではなく点を選び始める。
 * ============================================================
 */

export type Axis = "light" | "comic" | "bunge" | "screen" | "web";

export type Score = Record<Axis, number>;

export interface Choice {
    /** 札に出す言葉 */
    label: string;
    /** 添える一言。無くてもよい */
    note?: string;
    /** その札を選んだときに足す点 */
    add: Partial<Score>;
    /** 本の背として出すときの色 */
    cover?: { base: string; ink: string };
}

export interface Stage {
    /** 画面の上に出す小さな見出し */
    tag: string;
    /** 出来事 */
    title: string;
    /** 状況の説明。改行は配列で分ける */
    lines: string[];
    /** 問い */
    ask: string;
    choices: Choice[];
    /** 札の見せ方 */
    look?: "note" | "book" | "comment" | "plain";
    /**
     * 数字が伸びる見せ場。
     *
     * 初投稿とバズの 2 か所。
     * 数を出しておいてから問うと、
     * 同じ問いでも「自分に起きたこと」になる。
     */
    meter?: { to: number; unit: string; sub?: string };
}

export const STAGES: Stage[] = [
    {
        tag: "STAGE 1",
        title: "最初の原石",
        lines: ["机の上に、書きかけのメモが4枚。", "どれから手を伸ばしますか。"],
        ask: "",
        look: "note",
        choices: [
            {
                label: "この主人公、絶対に面白い",
                add: { light: 3, comic: 1 },
            },
            {
                label: "誰も知らない世界を作りたい",
                add: { light: 2, screen: 2 },
            },
            {
                label: "このラストだけは絶対に書きたい",
                add: { bunge: 2, screen: 2 },
            },
            {
                label: "この一文から始めたい",
                add: { bunge: 3, comic: 1 },
            },
        ],
    },

    {
        tag: "STAGE 2",
        title: "本屋で一冊だけ",
        lines: ["中身は分かりません。", "表紙と題名だけで、一冊選んでください。"],
        ask: "",
        look: "book",
        choices: [
            {
                label: "魔王を倒した俺は、今日から喫茶店を始めます",
                add: { light: 3, web: 2 },
                cover: { base: "#f0e2c4", ink: "#6a4a1e" },
            },
            {
                label: "夏の終わり、君の名前を忘れる",
                add: { bunge: 2, screen: 2 },
                cover: { base: "#dfe9ef", ink: "#2d4a5e" },
            },
            {
                label: "月面都市第七埠頭",
                add: { screen: 2, comic: 2 },
                cover: { base: "#23303f", ink: "#dfe6ee" },
            },
            {
                label: "彼女が死んだ日のことを、僕だけが覚えている",
                add: { bunge: 3, screen: 1 },
                cover: { base: "#efe4e6", ink: "#5e3a40" },
            },
        ],
    },

    {
        tag: "STAGE 3",
        title: "初投稿",
        lines: ["投稿しました。", "24時間後——"],
        meter: { to: 47, unit: "PV", sub: "♡ 3　感想 1" },
        ask: "さて、どうしますか。",
        choices: [
            {
                label: "題名とあらすじを変えてみる",
                add: { web: 3 },
            },
            {
                label: "とりあえず次の話を書く",
                add: { web: 2, light: 2 },
            },
            {
                label: "第1話を、もう一度作り直す",
                add: { bunge: 3 },
            },
            {
                label: "読んでくれた3人について考える",
                add: { bunge: 1, web: 1, screen: 1, comic: 1, light: 1 },
                note: "",
            },
        ],
    },

    {
        tag: "STAGE 4",
        title: "初めての感想",
        lines: ["通知が4つ、届いています。", "いちばん嬉しいものを選んでください。"],
        ask: "",
        look: "comment",
        choices: [
            {
                label: "この主人公、めっちゃ好きです",
                add: { light: 3, comic: 1 },
            },
            {
                label: "続きまだですか？",
                add: { web: 3, light: 1 },
            },
            {
                label: "最後の一文が、ずっと頭に残っています",
                add: { bunge: 3 },
            },
            {
                label: "頭の中で映像が流れました",
                add: { screen: 3, comic: 1 },
            },
        ],
    },

    /* STAGE 5 は札ではなく、100 を振り分ける。画面の側で受け持つ */

    {
        tag: "STAGE 6",
        title: "予想外のキャラが人気に",
        lines: ["主人公よりも、脇役のほうが人気になりました。", "次の話、どうしますか。"],
        ask: "",
        choices: [
            {
                label: "そのキャラの出番を増やす",
                add: { light: 2, web: 2 },
            },
            {
                label: "あくまで予定どおり進める",
                add: { bunge: 3 },
            },
            {
                label: "その人気を使って、新しい展開を作る",
                add: { web: 2, screen: 2 },
            },
            {
                label: "なぜ人気が出たのか、考えてみる",
                add: { bunge: 1, web: 1, screen: 1, comic: 1, light: 1 },
            },
        ],
    },

    {
        tag: "STAGE 7",
        title: "編集者からの便り",
        lines: [
            "新着メッセージ",
            "「作品を読ませていただきました。」",
            "「一か所だけ直すとしたら、どこを直しますか？」",
        ],
        ask: "",
        choices: [
            { label: "主人公", add: { light: 3, comic: 1 } },
            { label: "最初の3ページ", add: { web: 3 } },
            { label: "ラスト", add: { screen: 2, bunge: 2 } },
            { label: "全体の文章", add: { bunge: 3 } },
        ],
    },

    {
        tag: "STAGE 8",
        title: "作品が、突然読まれた",
        lines: ["朝、起きたら。"],
        meter: { to: 12491, unit: "PV", sub: "いま、30分だけ自由に動けます" },
        ask: "何をしますか。",
        choices: [
            { label: "次の話を書く", add: { web: 3, light: 1 } },
            { label: "SNSで知らせる", add: { web: 3 } },
            { label: "感想を読みに行く", add: { comic: 1, light: 2, bunge: 1 } },
            { label: "この先の展開を練り直す", add: { bunge: 2, screen: 2 } },
        ],
    },

    {
        tag: "STAGE 9",
        title: "誰かと組むことになった",
        lines: [
            "あなたの物語を、別の人が形にすることになりました。",
            "絶対に変えてほしくないものを、ひとつ。",
        ],
        ask: "",
        choices: [
            { label: "キャラクター", add: { comic: 3, light: 2 } },
            { label: "ストーリー", add: { screen: 3 } },
            { label: "世界観", add: { screen: 2, comic: 2 } },
            { label: "この作品が伝えたいこと", add: { bunge: 3 } },
        ],
    },

    {
        tag: "STAGE 10",
        title: "数年後",
        lines: ["あなたの作品について、誰かが話しています。"],
        ask: "",
        look: "comment",
        choices: [
            { label: "このキャラ、一生推す", add: { light: 3, comic: 2 } },
            { label: "人生でいちばん、続きを待った作品", add: { web: 3, light: 1 } },
            { label: "何年経っても忘れられない", add: { bunge: 3, screen: 1 } },
            { label: "この作品から、全部が始まった", add: { screen: 2, comic: 2, bunge: 1 } },
        ],
    },
];

/* ============================================================
 * 結果
 * ============================================================ */

export interface Result {
    key: string;
    emoji: string;
    name: string;
    /** 結果の頁で読ませる文 */
    lines: string[];
    /** その人に向く読み方・書き方 */
    hint: string;
    /** 同じ手ざわりの作品を探すための行き先 */
    genre: string;
}

export const RESULTS: Record<string, Result> = {
    light: {
        key: "light",
        emoji: "📚",
        name: "ライトノベル作家タイプ",
        lines: [
            "あなたの物語は、まずキャラクターから立ち上がります。",
            "読者は筋よりも先に「この人をもっと見ていたい」と思う。",
            "その引力は、作ろうとして作れるものではありません。",
        ],
        hint: "章の切れ目より、その人が何を言うかで場面を決めてみてください。",
        genre: "異世界ファンタジー",
    },
    comic: {
        key: "comic",
        emoji: "🎨",
        name: "コミカライズ原作者タイプ",
        lines: [
            "あなたの物語は、絵に置き換えたときにいちばん強くなります。",
            "一枚の絵で伝わる場面を、無意識に選んでいる。",
            "文字の外側に、もう一つの物語を持っている人です。",
        ],
        hint: "見せ場の前後を、あえて言葉少なに書いてみてください。",
        genre: "ハイファンタジー",
    },
    bunge: {
        key: "bunge",
        emoji: "✒️",
        name: "文芸作家タイプ",
        lines: [
            "あなたの物語は、読み終えたあとに始まります。",
            "急がず、削り、残す。その手つきが文に出ている。",
            "数字が伸びるのに時間がかかる代わりに、長く残ります。",
        ],
        hint: "最後の一行を先に決めて、そこへ向かって書いてみてください。",
        genre: "文芸",
    },
    screen: {
        key: "screen",
        emoji: "🎬",
        name: "映像・シナリオ原作者タイプ",
        lines: [
            "あなたの物語は、頭の中で動いています。",
            "場面が切り替わる速さ、間の取り方に、それが出ている。",
            "読者は文章を読みながら、画を見ています。",
        ],
        hint: "説明したくなったところを、動きに置き換えてみてください。",
        genre: "ミステリー",
    },
    web: {
        key: "web",
        emoji: "🔥",
        name: "WEBヒット作家タイプ",
        lines: [
            "あなたは、届けるところまでを創作だと思っている。",
            "続ける力と、読者との距離の取り方が、そのまま武器になります。",
            "才能というより、習慣に近い強さです。",
        ],
        hint: "次の一話を、いつ出すか決めてから書いてみてください。",
        genre: "恋愛",
    },
    daikichi: {
        key: "daikichi",
        emoji: "🌟",
        name: "大吉：次世代トップヒット作家タイプ",
        lines: [
            "どれか一つに寄りませんでした。",
            "キャラも、筋も、文も、届け方も、同じ強さで持っている。",
            "こういう人が、いちばん遠くまで行きます。",
        ],
        hint: "一つに絞らないでください。それがあなたの形です。",
        genre: "オールジャンル",
    },
};

/** 軸の名前。結果の頁で内訳として出す */
export const AXIS_NAME: Record<Axis, string> = {
    light: "キャラクター",
    comic: "場面の強さ",
    bunge: "文と余韻",
    screen: "物語の流れ",
    web: "届ける力",
};

/**
 * 点から、結果を決める。
 *
 * ★ 大吉は「どれか一つが高い」ではなく、「どれも低くない」。
 *
 *   いちばん高い軸と、いちばん低い軸の差が小さく、
 *   なおかつ全体が高いときだけ。
 *   偶然そうなる人は少ない。だから大吉。
 *
 * ★ 同点のときは、より珍しいほうを返す。
 *   ライトノベルと文芸が並んだら、文芸を出す。
 *   多いほうを出すと、みな同じ結果になる。
 */
const RARITY: Axis[] = ["bunge", "screen", "comic", "web", "light"];

export function judge(score: Score): Result {
    const values = Object.values(score);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const total = values.reduce((sum, one) => sum + one, 0);

    /* 大吉。どれも低くなく、差が小さい */
    if (total >= 40 && high - low <= 6) return RESULTS.daikichi;

    let best: Axis = "light";
    for (const axis of RARITY) {
        if (score[axis] > score[best]) best = axis;
        else if (score[axis] === score[best]) {
            /* 同じなら、珍しいほう（RARITY の先にあるほう）を残す */
            if (RARITY.indexOf(axis) < RARITY.indexOf(best)) best = axis;
        }
    }

    return RESULTS[best];
}
