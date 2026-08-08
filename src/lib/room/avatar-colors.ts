/**
 * ============================================================
 * 原石航路 Studio
 * 人形のテーマカラー
 *
 * 部屋の上限が 20 人なので 20 色。
 * 同じ部屋の中では色が被らないようにする。
 * 色が被ると、遠目に見たとき誰が誰か分からなくなる。
 *
 * ------------------------------------------------------------
 * 色の選び方
 *
 * 部屋の絵が茶と暖色でできているので、
 * 彩度を上げすぎると人形だけが浮いて絵から剥がれる。
 * 明度を揃え、彩度を中くらいに抑えた。
 *
 * 隣り合う番号どうしは色相を離してある。
 * 番号順に配られたとき、似た色が並ばないようにするため。
 *
 * 名前は色そのものではなく、物に寄せている。
 * 「青2」と「青3」では、口で伝えるときに区別できない。
 * ============================================================
 */

/**
 * 被り物。
 *
 * 色だけで 20 人を分けると、隣り合う色が似て見える人には
 * 半分しか区別できない。頭の形を変えると、
 * 色が分からなくても輪郭で見分けられる。
 *
 * bare … 髪のまま（名前ごとに髪型が変わる）
 * beanie … ニット帽
 * cap … つば付き
 * hood … フード
 */
export type Headwear = "bare" | "beanie" | "cap" | "hood";

export interface AvatarColor {
    id: number;
    label: string;
    /** 服の地色 */
    base: string;
    /** 頭の形 */
    headwear: Headwear;
}

/*
 * 被り物は 4 種を順に配る。
 * 番号が近い人どうしは色も頭も違うので、
 * 続けて入ってきた人を取り違えにくい。
 */
export const AVATAR_COLORS: AvatarColor[] = [
    { id: 0, label: "藍", base: "#3f5f8a", headwear: "bare" },
    { id: 1, label: "煉瓦", base: "#a0503f", headwear: "beanie" },
    { id: 2, label: "苔", base: "#4f7a4a", headwear: "cap" },
    { id: 3, label: "山吹", base: "#c08a2e", headwear: "hood" },
    { id: 4, label: "葡萄", base: "#6b4a80", headwear: "bare" },
    { id: 5, label: "水", base: "#3f8a92", headwear: "beanie" },
    { id: 6, label: "珊瑚", base: "#c2695f", headwear: "cap" },
    { id: 7, label: "若草", base: "#7a9440", headwear: "hood" },
    { id: 8, label: "群青", base: "#3a4a90", headwear: "bare" },
    { id: 9, label: "小豆", base: "#8a3f52", headwear: "beanie" },
    { id: 10, label: "常盤", base: "#2f7060", headwear: "cap" },
    { id: 11, label: "琥珀", base: "#b06a25", headwear: "hood" },
    { id: 12, label: "藤", base: "#8a7ab0", headwear: "bare" },
    { id: 13, label: "空", base: "#5f92c4", headwear: "beanie" },
    { id: 14, label: "桃", base: "#c47a92", headwear: "cap" },
    { id: 15, label: "橄欖", base: "#6b7038", headwear: "hood" },
    { id: 16, label: "褐", base: "#7a5230", headwear: "bare" },
    { id: 17, label: "菫", base: "#5a4a9a", headwear: "beanie" },
    { id: 18, label: "浅葱", base: "#4a9a8a", headwear: "cap" },
    { id: 19, label: "鉛", base: "#5f6470", headwear: "hood" },
];

export function colorOf(id: number | undefined): AvatarColor {
    if (id === undefined) return AVATAR_COLORS[0];
    return AVATAR_COLORS[((id % AVATAR_COLORS.length) + AVATAR_COLORS.length) %
        AVATAR_COLORS.length];
}

/**
 * 部屋の中で色が被らないように配り直す。
 *
 * 本人が選んだ色を第一希望として、先に入った人から順に確定させる。
 * 埋まっていたら次の番号へずらす。
 *
 * 誰の画面で計算しても同じ結果になるように、
 * 入った順（同じなら id 順）で並べてから配る。
 * 見る人によって色が違うと、色で呼び合えなくなる。
 *
 * 選んでいない人は id から決める。
 * 番号順に配ると、先に入った 3 人が藍・煉瓦・苔で固まってしまう。
 */
export function assignColors<
    T extends { id: string; color_id?: number; joined_at: string },
>(members: T[]): Map<string, number> {
    const ordered = [...members].sort((a, b) => {
        const byTime = a.joined_at.localeCompare(b.joined_at);
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });

    const taken = new Set<number>();
    const result = new Map<string, number>();

    for (const member of ordered) {
        const wish =
            member.color_id ?? hashOf(member.id) % AVATAR_COLORS.length;

        let picked = wish;
        for (let step = 0; step < AVATAR_COLORS.length; step += 1) {
            const candidate = (wish + step) % AVATAR_COLORS.length;
            if (!taken.has(candidate)) {
                picked = candidate;
                break;
            }
        }

        taken.add(picked);
        result.set(member.id, picked);
    }

    return result;
}

/** その部屋で誰かが使っている色 */
export function takenColors<
    T extends { id: string; color_id?: number; joined_at: string },
>(members: T[], exceptId?: string): Set<number> {
    const assigned = assignColors(members);
    const taken = new Set<number>();
    assigned.forEach((color, id) => {
        if (id !== exceptId) taken.add(color);
    });
    return taken;
}

function hashOf(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}
