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
 * ★ 選んだあと、一言返す。
 *
 *   押して次へ進むだけだと、手ごたえがない。
 *   「あなたはそういう人だ」と短く返されると、
 *   自分がどういう人なのかを考え始める。
 *   それが最後の問い（あなたは何作家か）へ効く。
 * ============================================================
 */

export type Axis = "chara" | "world" | "text" | "story" | "reach" | "heat";

export type Score = Record<Axis, number>;

export interface Choice {
    label: string;
    /** 選んだあとに返す一言 */
    echo: string;
    add: Partial<Score>;
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
                echo: "あなたは、人から書き始める。",
                add: { chara: 4, heat: 1 },
            },
            {
                label: "誰も知らない世界を作りたい",
                echo: "あなたは、地図から書き始める。",
                add: { world: 4, story: 1 },
            },
            {
                label: "このラストだけは絶対に書きたい",
                echo: "あなたは、終わりから逆算する。",
                add: { story: 4, text: 1 },
            },
            {
                label: "この一文から始めたい",
                echo: "あなたは、言葉のほうを信じている。",
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
                echo: "続きが読みたくなる題名を、あなたは選んだ。",
                add: { chara: 3, reach: 2 },
                cover: { base: "#f0e2c4", ink: "#6a4a1e" },
            },
            {
                label: "夏の終わり、君の名前を忘れる",
                echo: "余韻の残る題名を、あなたは選んだ。",
                add: { text: 3, story: 1 },
                cover: { base: "#dfe9ef", ink: "#2d4a5e" },
            },
            {
                label: "月面都市第七埠頭",
                echo: "説明のない題名を、あなたは選んだ。",
                add: { world: 4 },
                cover: { base: "#23303f", ink: "#dfe6ee" },
            },
            {
                label: "彼女が死んだ日のことを、僕だけが覚えている",
                echo: "謎から入る題名を、あなたは選んだ。",
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
                echo: "中身より先に、入口を疑えるのは強い。",
                add: { reach: 4 },
            },
            {
                label: "とにかく、次の話を書く",
                echo: "止まらないことが、あなたの武器になる。",
                add: { heat: 4 },
            },
            {
                label: "第1話を、もう一度書き直す",
                echo: "納得しないものを出しておけない人だ。",
                add: { text: 3, heat: 1 },
            },
            {
                label: "読んでくれた3人のことを、考える",
                echo: "数ではなく、人として見ている。",
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
                echo: "人が残る物語を、あなたは書いている。",
                add: { chara: 4 },
            },
            {
                label: "続きまだですか？",
                echo: "待たせる物語を、あなたは書いている。",
                add: { reach: 3, heat: 2 },
            },
            {
                label: "最後の一文が、ずっと頭に残っています",
                echo: "読み終えたあとに効く物語を、書いている。",
                add: { text: 4 },
            },
            {
                label: "頭の中で、映像が流れました",
                echo: "文字の外側に、もう一つの物語がある。",
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
                echo: "続ける人は、たいてい、こうしている。",
                add: { heat: 5 },
            },
            {
                label: "他の人の作品を、片っ端から読む",
                echo: "入れないと出ない、と知っている。",
                add: { text: 2, world: 2 },
            },
            {
                label: "読者に「少し休みます」と伝える",
                echo: "待っている人を、置き去りにしない。",
                add: { reach: 3, chara: 1 },
            },
            {
                label: "この物語のラストを、もう一度思い出す",
                echo: "あなたを動かしているのは、終わりの一場面だ。",
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
                echo: "読者の熱を、そのまま燃やせる人だ。",
                add: { chara: 3, reach: 2 },
            },
            {
                label: "予定どおり進める",
                echo: "物語のほうを、あなたは信じている。",
                add: { story: 3, text: 2 },
            },
            {
                label: "その子の物語を、別に立てる",
                echo: "広げることを恐れない。世界が伸びていく。",
                add: { world: 4 },
            },
            {
                label: "なぜ人気が出たのか、考えてみる",
                echo: "当たった理由を、次に使える人だ。",
                add: { reach: 3, chara: 1 },
            },
        ],
    },

    {
        tag: "STAGE 8",
        title: "作品が、突然読まれた",
        lines: ["朝、起きたら。"],
        meter: { to: 12491, unit: "PV", sub: "いま、30分だけ自由に動けます" },
        ask: "何をしますか。",
        choices: [
            {
                label: "すぐ次の話を書く",
                echo: "波が来たときに走れる。これは才能だ。",
                add: { heat: 3, reach: 2 },
            },
            {
                label: "SNSで知らせる",
                echo: "届けるところまでを、創作だと思っている。",
                add: { reach: 4 },
            },
            {
                label: "感想を、全部読む",
                echo: "読者の顔を見てから、次を決める人だ。",
                add: { chara: 3, heat: 1 },
            },
            {
                label: "この先の展開を、練り直す",
                echo: "波のあとを見ている。落ち着いている。",
                add: { story: 3, text: 1 },
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
                echo: "この人たちさえ生きていれば、物語は残る。",
                add: { chara: 4 },
            },
            {
                label: "ストーリー",
                echo: "筋が通っていることが、あなたの譲れない線だ。",
                add: { story: 4 },
            },
            {
                label: "世界観",
                echo: "この世界の空気だけは、誰にも触らせない。",
                add: { world: 4 },
            },
            {
                label: "この作品が伝えたいこと",
                echo: "形は変わってもいい。芯だけは動かせない。",
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
                echo: "",
                add: { chara: 4, heat: 1 },
            },
            {
                label: "人生でいちばん、続きを待った作品",
                echo: "",
                add: { reach: 3, heat: 2 },
            },
            {
                label: "何年経っても、忘れられない",
                echo: "",
                add: { text: 4, story: 1 },
            },
            {
                label: "この作品から、全部が始まった",
                echo: "",
                add: { world: 3, story: 2 },
            },
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
    /** 一行で言い切る。ここが share されるところ */
    catch: string;
    lines: string[];
    hint: string;
    genre: string;
}

export const RESULTS: Record<string, Result> = {
    chara: {
        key: "chara",
        emoji: "📚",
        name: "ライトノベル作家タイプ",
        catch: "あなたの物語は、人から立ち上がる。",
        lines: [
            "読者はまず「この人をもっと見ていたい」と思う。",
            "筋よりも先に、誰かが立っている。",
            "その引力は、作ろうとして作れるものではありません。",
        ],
        hint: "章の切れ目より、その人が何を言うかで場面を決めてみてください。",
        genre: "異世界ファンタジー",
    },
    world: {
        key: "world",
        emoji: "🎨",
        name: "コミカライズ原作者タイプ",
        catch: "あなたの物語には、まだ見ぬ絵がある。",
        lines: [
            "一枚の絵で伝わる場面を、無意識に選んでいる。",
            "説明していないところに、世界がある。",
            "文字の外側に、もう一つの物語を持っている人です。",
        ],
        hint: "見せ場の前後を、あえて言葉少なに書いてみてください。",
        genre: "ハイファンタジー",
    },
    text: {
        key: "text",
        emoji: "✒️",
        name: "文芸作家タイプ",
        catch: "あなたの物語は、読み終えたあとに始まる。",
        lines: [
            "急がず、削り、残す。その手つきが文に出ている。",
            "数字が伸びるのに時間がかかる代わりに、長く残ります。",
            "十年後に読み返される側の作家です。",
        ],
        hint: "最後の一行を先に決めて、そこへ向かって書いてみてください。",
        genre: "文芸",
    },
    story: {
        key: "story",
        emoji: "🎬",
        name: "映像・シナリオ原作者タイプ",
        catch: "あなたの物語は、頭の中で動いている。",
        lines: [
            "場面が切り替わる速さ、間の取り方に、それが出ている。",
            "読者は文章を読みながら、画を見ています。",
            "終わりから逆算できる人は、そう多くありません。",
        ],
        hint: "説明したくなったところを、動きに置き換えてみてください。",
        genre: "ミステリー",
    },
    reach: {
        key: "reach",
        emoji: "🔥",
        name: "WEBヒット作家タイプ",
        catch: "あなたは、届けるところまでを創作だと思っている。",
        lines: [
            "続ける力と、読者との距離の取り方が、そのまま武器になる。",
            "才能というより、習慣に近い強さです。",
            "この強さを持つ人が、いちばん先に見つかります。",
        ],
        hint: "次の一話を、いつ出すか決めてから書いてみてください。",
        genre: "恋愛",
    },
    daikichi: {
        key: "daikichi",
        emoji: "🌟",
        name: "次世代トップヒット作家タイプ",
        catch: "どれか一つに、寄らなかった。",
        lines: [
            "人も、筋も、文も、世界も、届け方も、同じ強さで持っている。",
            "6つの角が、どれも欠けていません。",
            "こういう形の人が、いちばん遠くまで行きます。",
        ],
        hint: "一つに絞らないでください。それが、あなたの形です。",
        genre: "オールジャンル",
    },
};

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
 * 点から、結果を決める。
 *
 * ★ 大吉は「どれか一つが高い」ではなく「どれも欠けていない」。
 *
 *   6 角形が、まるいまま大きい人。
 *   偶然そうなる人は少ない。だから大吉。
 *
 * ★ heat は単独では結果にしない。
 *   続ける力は「何になるか」ではなく
 *   「行けるところまで行けるか」なので。
 *
 * ★ 同点のときは、珍しいほうを返す。
 *   多いほうを出すと、みな同じ結果になる。
 */
const RARITY: Axis[] = ["text", "story", "world", "reach", "chara"];

export function judge(score: Score): Result {
    /* 大吉は 6 つ全部で見る */
    const all = AXIS_ORDER.map((axis) => score[axis]);
    const high = Math.max(...all);
    const low = Math.min(...all);
    const total = all.reduce((sum, one) => sum + one, 0);

    if (total >= 46 && high - low <= 7) return RESULTS.daikichi;

    /* 型は heat を除いた 5 つで決める */
    let best: Axis = "chara";
    for (const axis of RARITY) {
        if (score[axis] > score[best]) best = axis;
        else if (
            score[axis] === score[best] &&
            RARITY.indexOf(axis) < RARITY.indexOf(best)
        ) {
            best = axis;
        }
    }

    return RESULTS[best];
}
