/**
 * ============================================================
 * 原石航路 Studio
 * 共有定数
 * ============================================================
 */

/** 自動保存を走らせるまでの入力停止時間（ミリ秒） */
export const AUTOSAVE_DELAY_MS = 1500;

/** タイトルの最大文字数 */
export const TITLE_MAX_LENGTH = 100;

/** キャッチコピーの最大文字数 */
export const CATCHPHRASE_MAX_LENGTH = 100;

/** あらすじの最大文字数 */
export const SUMMARY_MAX_LENGTH = 5000;

/** タグの最大個数 */
export const TAG_MAX_COUNT = 30;

/** タグ 1 個あたりの最大文字数 */
export const TAG_MAX_LENGTH = 20;

/** 作者メモの最大文字数 */
export const AUTHOR_NOTE_MAX_LENGTH = 2000;

/** 1 話あたりに残すバージョンの上限。超えた分は古いものから消す */
export const VERSION_MAX_PER_EPISODE = 30;

/** 自動でバージョンを残す最短間隔（ミリ秒）。既定は 5 分 */
export const VERSION_AUTO_INTERVAL_MS = 5 * 60 * 1000;

/** 本文保存後に自動で候補を拾う最短間隔（ミリ秒）。既定は10分 */
export const AUTO_EXTRACT_INTERVAL_MS = 10 * 60 * 1000;
