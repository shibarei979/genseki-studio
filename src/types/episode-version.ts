/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeVersion Types（バージョン履歴）
 *
 * 差分ではなく全文をそのまま控える。
 * 復元処理が単純になり、履歴が壊れても他の版に影響しないため。
 * 容量が問題になってから差分方式を検討する。
 * ============================================================
 */

/** 誰の操作で残った版か */
export type VersionTrigger = "auto" | "manual" | "restore";

export interface EpisodeVersion {
    id: string;
    episode_id: string;
    work_id: string;
    /** 保存時点の本文の全文 */
    body: string;
    char_count: number;
    trigger: VersionTrigger;
    /** 一覧に出す名前。"v12" など */
    label: string;
    created_at: string;
}

export const VERSION_TRIGGER_LABEL: Record<VersionTrigger, string> = {
    auto: "自動保存",
    manual: "手動保存",
    restore: "復元前の控え",
};
