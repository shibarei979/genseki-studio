/**
 * ============================================================
 * 原石航路 Studio
 * バックアップの形式
 *
 * 保存先がブラウザの中だけである以上、
 * 端末を変えたりデータを消したりすれば作品は失われる。
 * 書いたものが消えるのは、機能が足りないより重い問題なので、
 * 取り出しと戻しは早い段階で用意しておく。
 *
 * 中身は保存の実装（localStorage / Supabase）に依存しない形にする。
 * 保存先を変えたときに古いバックアップが読めなくなっては意味がない。
 * ============================================================
 */

/** 形式が変わったら上げる。読み込み時に確認する */
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupMeta {
    app: "genseki-studio";
    format_version: number;
    exported_at: string;
    /** 数え上げ。中身を開かなくても規模が分かるように */
    counts: Record<string, number>;
}

export interface BackupFile {
    meta: BackupMeta;
    /** テーブル名 → 行の配列 */
    tables: Record<string, unknown[]>;
}

export interface BackupSummary {
    /** 実際に入った件数 */
    imported: Record<string, number>;
    /** すでにあったので飛ばした件数 */
    skipped: number;
}

/** バックアップに含めるテーブル。増やしたらここへ足す */
export const BACKUP_TABLES = [
    "profile",
    "works",
    "episodes",
    "episode-versions",
    "display-settings",
    "publish-settings",
    "ai-settings",
    "resource-pages",
    "resource-entries",
    "resource-relations",
    "plot-stages",
    "plot-scenes",
    "entry-mentions",
    "work-preferences",
    "writing-logs",
    "writing-rooms",
    "quick-memos",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_TABLE_LABEL: Record<string, string> = {
    profile: "プロフィール",
    works: "作品",
    episodes: "話",
    "episode-versions": "バージョン履歴",
    "display-settings": "表示設定",
    "publish-settings": "公開設定",
    "ai-settings": "AI補助設定",
    "resource-pages": "資料ページ",
    "resource-entries": "資料の項目",
    "resource-relations": "関係",
    "plot-stages": "プロットの段",
    "plot-scenes": "プロットの場面",
    "entry-mentions": "本文リンク",
    "work-preferences": "作品ごとの設定",
    "writing-logs": "執筆の記録",
    "writing-rooms": "執筆室",
    "quick-memos": "執筆メモ",
};

/** 読み込んだものがバックアップとして扱える形かを見る */
export function validateBackup(
    value: unknown,
): { ok: true; file: BackupFile } | { ok: false; reason: string } {
    if (typeof value !== "object" || value === null) {
        return { ok: false, reason: "ファイルの中身を読み取れませんでした。" };
    }

    const candidate = value as Partial<BackupFile>;
    if (candidate.meta?.app !== "genseki-studio") {
        return { ok: false, reason: "原石航路のバックアップではないようです。" };
    }
    if (typeof candidate.meta.format_version !== "number") {
        return { ok: false, reason: "形式の番号が入っていません。" };
    }
    if (candidate.meta.format_version > BACKUP_FORMAT_VERSION) {
        return {
            ok: false,
            reason: "新しい形式のバックアップです。アプリを更新してから読み込んでください。",
        };
    }
    if (typeof candidate.tables !== "object" || candidate.tables === null) {
        return { ok: false, reason: "データが入っていません。" };
    }

    return { ok: true, file: candidate as BackupFile };
}
