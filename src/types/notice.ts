/**
 * ============================================================
 * 原石航路 Studio
 * お知らせ
 *
 * いまは運営からの配信の仕組みが無いので、
 * このアプリ自身の更新履歴を出す。
 * 「何が新しくなったか」が分かる場所は、
 * 使い続けてもらううえで要る。
 * ============================================================
 */

export interface Notice {
    id: string;
    date: string;
    label: string;
    kind: "release" | "info" | "maintenance";
}

export const NOTICES: Notice[] = [
    {
        id: "n5",
        date: "2026/07/31",
        label: "マイページを追加しました",
        kind: "release",
    },
    {
        id: "n4",
        date: "2026/07/31",
        label: "執筆室（試作）を追加しました",
        kind: "release",
    },
    {
        id: "n3",
        date: "2026/07/30",
        label: "ルビ・傍点の記法に対応しました",
        kind: "release",
    },
    {
        id: "n2",
        date: "2026/07/30",
        label: "推敲チェックを追加しました",
        kind: "release",
    },
    {
        id: "n1",
        date: "2026/07/30",
        label: "全体バックアップに対応しました",
        kind: "info",
    },
];
