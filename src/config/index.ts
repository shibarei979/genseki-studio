/**
 * ============================================================
 * 原石航路 Studio
 * Config Barrel Export
 *
 * 注意: env.client / env.server は barrel に含めない。
 * Server 専用の環境変数が Client Bundle へ混入するのを防ぐため、
 * 利用側で直接 import すること。
 * ============================================================
 */

export { appConfig } from "./app";

export {
    AUTHOR_NOTE_MAX_LENGTH,
    AUTO_EXTRACT_INTERVAL_MS,
    AUTOSAVE_DELAY_MS,
    CATCHPHRASE_MAX_LENGTH,
    SUMMARY_MAX_LENGTH,
    TAG_MAX_COUNT,
    TAG_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    VERSION_AUTO_INTERVAL_MS,
    VERSION_MAX_PER_EPISODE,
} from "./constants";
