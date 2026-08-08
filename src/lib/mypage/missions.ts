/**
 * ============================================================
 * 原石航路 Studio
 * ミッション
 *
 * GENSEKIKORO には読者向けと書き手向けのミッションがある。
 * こちらは制作の道具なので、書き手向けだけを置く。
 *
 * 【数えられるものしか出さない】
 * 閲覧数やいいね数を条件にしたミッションは作らない。
 * このアプリにその数字は存在しないので、
 * 出しても永遠に 0 のままになる。
 *
 * 【急かさない】
 * 「毎日書け」ではなく「書いたら記録が残る」という置き方にする。
 * 達成できない項目が並ぶ画面を開くのは、書く前の気分によくない。
 * ============================================================
 */

/**
 * ミッションの判定に使う数え上げ。
 *
 * 以前は本文や資料の中身をすべて渡していたが、
 * 作品が増えるほどマイページが重くなった。
 * 判定に要るのは数だけなので、数だけを持つ。
 */
export interface MissionStats {
    works: number;
    episodes: number;
    doneEpisodes: number;
    chars: number;
    entries: number;
    entriesFromBody: number;
    relations: number;
    plotStages: number;
    streak: number;
    hasBio: boolean;
    hasBackup: boolean;
}

/**
 * ミッションの分類。
 * GENSEKIKORO は読み手向けと書き手向けの両方を持つが、
 * こちらは制作の道具なので書き手向けだけを置く。
 */
export type MissionCategory = "start" | "keep" | "world" | "guard";

export interface CategoryInfo {
    label: string;
    color: string;
    bg: string;
}

export const CATEGORY_INFO: Record<MissionCategory, CategoryInfo> = {
    start: { label: "はじめの一歩", color: "#1f4e6b", bg: "#e6eef4" },
    keep: { label: "書き続ける", color: "#99610a", bg: "#fbf0dd" },
    world: { label: "世界をつくる", color: "#6a4d92", bg: "#f1ecf8" },
    guard: { label: "そなえる", color: "#2b6183", bg: "#e9f1f6" },
};

export const MISSION_CATEGORY_LABEL: Record<MissionCategory, string> = {
    start: CATEGORY_INFO.start.label,
    keep: CATEGORY_INFO.keep.label,
    world: CATEGORY_INFO.world.label,
    guard: CATEGORY_INFO.guard.label,
};

/** 分類ごとの図案 */
export const CATEGORY_PATH: Record<MissionCategory, string> = {
    start: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    keep: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586",
    world: "M2 12h20 M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
    guard: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

/** 報酬の区切り。ここに届くと知らせる */
export const REWARD_STEPS = [4, 8, 12];

export interface Mission {
    id: string;
    label: string;
    /** 何をすれば達成できるか */
    description: string;
    /** 達成の助けになる補足 */
    hint: string;
    category: MissionCategory;
    target: number;
    current: (stats: MissionStats) => number;
}

export const MISSIONS: Mission[] = [
    {
        id: "first-work",
        label: "はじめての作品",
        description: "作品を1つ作る",
        hint: "ホームの「新しい作品を作る」から。タイトルとあらすじだけで始められます。",
        category: "start",
        target: 1,
        current: (stats) => stats.works,
    },
    {
        id: "profile-bio",
        label: "自己紹介を書く",
        description: "プロフィールに自己紹介を入れる",
        hint: "マイページの「設定」→「自己紹介を編集」から書けます。",
        category: "start",
        target: 1,
        current: (stats) => (stats.hasBio ? 1 : 0),
    },
    {
        id: "first-episode",
        label: "第1話を書き上げる",
        description: "話を1つ「完成」にする",
        hint: "執筆画面の左の一覧で、話の右にある丸印を押すと状態が変わります。",
        category: "start",
        target: 1,
        current: (stats) => stats.doneEpisodes,
    },
    {
        id: "episodes-10",
        label: "10話まで書く",
        description: "話を10作る（下書きも数えます）",
        hint: "執筆画面の「＋新規作成」で話を足せます。",
        category: "keep",
        target: 10,
        current: (stats) => stats.episodes,
    },
    {
        id: "chars-10k",
        label: "1万文字書く",
        description: "すべての作品を合わせて1万文字",
        hint: "ルビと記号は数えません。本文の文字だけを数えています。",
        category: "keep",
        target: 10000,
        current: (stats) => stats.chars,
    },
    {
        id: "streak-3",
        label: "3日続けて書く",
        description: "3日つづけて本文を書く",
        hint: "作品の設定で「執筆の記録」をオンにしていると数えられます。",
        category: "keep",
        target: 3,
        current: (stats) => stats.streak,
    },
    {
        id: "streak-7",
        label: "1週間続けて書く",
        description: "7日つづけて本文を書く",
        hint: "1日でも空くと最初から数え直しになります。",
        category: "keep",
        target: 7,
        current: (stats) => stats.streak,
    },
    {
        id: "resource-10",
        label: "資料を10件そろえる",
        description: "人物や場所などの資料を10件登録する",
        hint: "資料ページの「＋追加」か、本文から拾った候補の承認で増えます。",
        category: "world",
        target: 10,
        current: (stats) => stats.entries,
    },
    {
        id: "from-body-5",
        label: "本文から資料を育てる",
        description: "本文から拾われた候補を5件承認する",
        hint: "作品の設定でAI補助をオンにすると、書いた本文から候補が並びます。",
        category: "world",
        target: 5,
        current: (stats) => stats.entriesFromBody,
    },
    {
        id: "relations-3",
        label: "関係を3つ結ぶ",
        description: "資料どうしのつながりを3つ登録する",
        hint: "資料の「関係図」で、出発点と到達点を選んで結べます。",
        category: "world",
        target: 3,
        current: (stats) => stats.relations,
    },
    {
        id: "plot-stage",
        label: "物語の骨組みを置く",
        description: "プロットの段を3つ作る",
        hint: "資料の「プロット・構成」から。「起・承・転」でもかまいません。",
        category: "world",
        target: 3,
        current: (stats) => stats.plotStages,
    },
    {
        id: "backup",
        label: "バックアップを取る",
        description: "全体を書き出してファイルに残す",
        hint: "設定の「データ」から書き出せます。書いたものを失わないための備えです。",
        category: "guard",
        target: 1,
        current: (stats) => (stats.hasBackup ? 1 : 0),
    },
];



export interface MissionProgress {
    mission: Mission;
    current: number;
    isDone: boolean;
    ratio: number;
}

export function evaluateMissions(stats: MissionStats): MissionProgress[] {
    return MISSIONS.map((mission) => {
        const current = Math.min(mission.target, mission.current(stats));
        return {
            mission,
            current,
            isDone: current >= mission.target,
            ratio: mission.target === 0 ? 1 : current / mission.target,
        };
    });
}
