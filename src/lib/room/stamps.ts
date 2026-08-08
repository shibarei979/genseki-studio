/**
 * ============================================================
 * 原石航路 Studio
 * スタンプ
 *
 * 執筆室での発言はスタンプを中心にする。
 * 文字で話し始めると雑談の場になり、書く手が止まる。
 * 決まった言葉しか出せなければ、伝わるものは伝わり、
 * 会話には発展しない。それがちょうどよい。
 *
 * 図案は用意していない。いまは文字と印だけで出す。
 * 絵が入ったらこの表の image を埋めれば差し替わる。
 * ============================================================
 */

export type StampGroup = "cheer" | "room";

export interface Stamp {
    id: string;
    label: string;
    group: StampGroup;
    /** 印の形。絵が用意できるまでの代わり */
    mark: "thumb" | "star" | "search" | "flag" | "loop" | "castle" | "pen" | "fist" | "tear" | "gift" | "clock" | "coffee" | "door" | "hand";
    tone: string;
}

export const STAMP_GROUP_LABEL: Record<StampGroup, string> = {
    cheer: "応援",
    room: "部屋",
};

/** 作品や書き手に向けたもの */
const CHEER_STAMPS: Stamp[] = [
    { id: "nice", label: "この作品いいね！", group: "cheer", mark: "thumb", tone: "#c0568a" },
    { id: "best", label: "最高！", group: "cheer", mark: "star", tone: "#c0568a" },
    { id: "next", label: "続きが気になる！", group: "cheer", mark: "search", tone: "#3a7d9a" },
    { id: "support", label: "応援してます！", group: "cheer", mark: "flag", tone: "#2f6b3d" },
    { id: "reread", label: "何回も読み返したい！", group: "cheer", mark: "loop", tone: "#3a7d9a" },
    { id: "world", label: "世界観が最高！", group: "cheer", mark: "castle", tone: "#7d5f99" },
    { id: "writing", label: "現在作成中！", group: "cheer", mark: "pen", tone: "#c07a2e" },
    { id: "ganbare", label: "頑張って！", group: "cheer", mark: "fist", tone: "#c0568a" },
    { id: "cried", label: "泣けた…", group: "cheer", mark: "tear", tone: "#3a7d9a" },
    { id: "waited", label: "新作待ってました！", group: "cheer", mark: "gift", tone: "#c0568a" },
];

/** 部屋の中での合図 */
const ROOM_STAMPS: Stamp[] = [
    { id: "start", label: "はじめます", group: "room", mark: "clock", tone: "#2f6b3d" },
    { id: "break", label: "少し休憩", group: "room", mark: "coffee", tone: "#c07a2e" },
    { id: "back", label: "戻りました", group: "room", mark: "door", tone: "#2f6b3d" },
    { id: "otsu", label: "おつかれさま", group: "room", mark: "hand", tone: "#7d5f99" },
];

export const STAMPS: Stamp[] = [...CHEER_STAMPS, ...ROOM_STAMPS];

export function findStamp(id: string): Stamp | undefined {
    return STAMPS.find((stamp) => stamp.id === id);
}
