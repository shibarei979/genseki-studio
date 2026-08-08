/**
 * ============================================================
 * 原石航路 Studio
 * プロットの見本
 *
 * 白紙から始めると、何を書けばよいか分からない。
 * 型を選べば、埋めるだけで組み立てが進む。
 *
 * 中身は空にしておく。
 * 例文を入れると、それを消す手間が増える。
 * 見出しだけ置いて、書く場所を示す。
 * ============================================================
 */

export interface PlotTemplate {
    key: string;
    label: string;
    note: string;
    stages: {
        title: string;
        description: string;
        scenes: string[];
    }[];
}

export const PLOT_TEMPLATES: PlotTemplate[] = [
    {
        key: "kishotenketsu",
        label: "起承転結",
        note: "4つの段。短編から長編まで、いちばん使われる型",
        stages: [
            {
                title: "起",
                description: "誰の話か、どんな世界かを見せる。",
                scenes: ["主人公の登場", "日常のすがた", "物語が動き出す出来事"],
            },
            {
                title: "承",
                description: "目的に向かって進み、壁にぶつかる。",
                scenes: ["目的が定まる", "仲間や敵との出会い", "うまくいかない出来事"],
            },
            {
                title: "転",
                description: "流れが変わる。いちばん苦しいところ。",
                scenes: ["予想外の出来事", "いちばん低いところ", "立ち上がるきっかけ"],
            },
            {
                title: "結",
                description: "決着をつけ、そのあとを見せる。",
                scenes: ["最後の対決", "決着", "そのあとの日々"],
            },
        ],
    },
    {
        key: "three-act",
        label: "三幕構成",
        note: "映画や長編で使われる型。転換点がはっきりする",
        stages: [
            {
                title: "第一幕　始まり",
                description: "世界と主人公を見せ、旅立ちまで。",
                scenes: ["日常", "きっかけ", "旅立ちの決意"],
            },
            {
                title: "第二幕　試練",
                description: "進むほど難しくなり、いちど折れる。",
                scenes: [
                    "新しい世界",
                    "仲間と敵",
                    "つかのまの成功",
                    "すべてを失う",
                ],
            },
            {
                title: "第三幕　決着",
                description: "立ち上がり、決着をつける。",
                scenes: ["立ち直る", "最後の戦い", "帰還"],
            },
        ],
    },
    {
        key: "romance",
        label: "恋愛もの",
        note: "出会いから結ばれるまで",
        stages: [
            {
                title: "出会い",
                description: "ふたりが出会い、意識し始める。",
                scenes: ["出会いの場面", "第一印象", "気になり始める"],
            },
            {
                title: "近づく",
                description: "距離が縮まり、気持ちが育つ。",
                scenes: ["ふたりで過ごす時間", "相手の知らない一面", "自覚"],
            },
            {
                title: "すれちがい",
                description: "誤解や障害で離れる。",
                scenes: ["誤解が生まれる", "離れる", "後悔"],
            },
            {
                title: "結ばれる",
                description: "気持ちを伝え、答えが出る。",
                scenes: ["向き合う", "告白", "その後"],
            },
        ],
    },
    {
        key: "mystery",
        label: "謎解き",
        note: "事件から解決まで",
        stages: [
            {
                title: "事件",
                description: "何が起きたかを示す。",
                scenes: ["日常", "事件の発生", "調べ始める"],
            },
            {
                title: "捜査",
                description: "手がかりを集め、容疑者が浮かぶ。",
                scenes: ["最初の手がかり", "関係者への聞き込み", "疑わしい人物"],
            },
            {
                title: "行き詰まり",
                description: "筋が通らなくなる。",
                scenes: ["二つめの事件", "推理が崩れる", "見落としに気づく"],
            },
            {
                title: "解決",
                description: "真相を明かし、決着させる。",
                scenes: ["真相", "対決", "動機"],
            },
        ],
    },
];
