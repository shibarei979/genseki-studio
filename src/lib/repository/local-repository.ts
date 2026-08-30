/**
 * ============================================================
 * 原石航路 Studio
 * Repository 実装：localStorage
 *
 * v1 専用。ブラウザ 1 台に閉じた保存先。
 * Supabase 実装（supabase-repository.ts）を追加したら
 * repository/index.ts の切り替えだけで置き換わる。
 *
 * 保存キーには必ず SCHEMA_VERSION を含める。
 * 型を変更したときに、古いデータを読んで壊れるのを防ぐため。
 * ============================================================
 */

import type { Repository } from "@/lib/repository/types";
import {
    normalizeAiSettings,
    normalizeEntry,
    normalizeBanner,
    normalizeContest,
    normalizeNotice,
    normalizeRoom,
    normalizeEpisode,
    normalizePage,
    normalizePlotScene,
    normalizePlotStage,
    normalizeProfile,
    normalizeRelation,
    normalizeWork,
} from "@/lib/repository/migrations";
import { createId } from "@/lib/utils/id";
import { countChars } from "@/lib/utils/text";
import type { BackupFile, BackupSummary } from "@/lib/backup/format";
import type { StudioCounts } from "@/lib/repository/types";
import { BACKUP_FORMAT_VERSION, BACKUP_TABLES } from "@/lib/backup/format";
import type {
    AdminBanner,
    NovelComment,
    ReadEpisode,
    Report,
    ReportCreateInput,
    Chapter,
    RoomLayout,
    AdminNotice,
    AdminUser,
    Contest,
    ContestEntry,
    FeatureFlag,
    NgWord,
    Project,
    ProjectInput,
    AiSettings,
    DisplaySettings,
    Episode,
    EpisodeCreateInput,
    EpisodeVersion,
    PublishSettings,
    EpisodeUpdateInput,
    Work,
    WorkCreateInput,
    EntryMention,
    PlotScene,
    Profile,
    QuickMemo,
    PlotStage,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
    WorkPreferences,
    WorkUpdateInput,
    WorkWithStats,
    WritingLog,
    WritingRoom,
} from "@/types";
import { VERSION_MAX_PER_EPISODE } from "@/config";
import {
    ALL_BUILTIN_PAGES,
    PINNED_PAGES,
} from "@/lib/resource/builtin-pages";
import {
    defaultAiSettings,
    defaultProfile,
    defaultRoom,
    defaultWorkPreferences,
    defaultDisplaySettings,
    defaultPublishSettings,
    formatWorkState,
    GENRES,
    calcStreak,
    defaultChapter,
    defaultContest,
    defaultFeatureFlags,
    todayKey,
} from "@/types";

/**
 * 保存キーごとに、読み込んだ行の形を揃える。
 * 欄を足したときの取りこぼしをここ 1 か所で吸収する。
 */
const NORMALIZERS: Record<string, (row: any) => any> = {};

const SCHEMA_VERSION = "v1";
const WORKS_KEY = `genseki:${SCHEMA_VERSION}:works`;
const EPISODES_KEY = `genseki:${SCHEMA_VERSION}:episodes`;
const DISPLAY_KEY = `genseki:${SCHEMA_VERSION}:display-settings`;
const VERSIONS_KEY = `genseki:${SCHEMA_VERSION}:episode-versions`;
const PUBLISH_KEY = `genseki:${SCHEMA_VERSION}:publish-settings`;
const PAGES_KEY = `genseki:${SCHEMA_VERSION}:resource-pages`;
const ENTRIES_KEY = `genseki:${SCHEMA_VERSION}:resource-entries`;
const RELATIONS_KEY = `genseki:${SCHEMA_VERSION}:resource-relations`;
const PLOT_KEY = `genseki:${SCHEMA_VERSION}:plot-stages`;
const MENTIONS_KEY = `genseki:${SCHEMA_VERSION}:entry-mentions`;
const AI_KEY = `genseki:${SCHEMA_VERSION}:ai-settings`;
const PREFERENCES_KEY = `genseki:${SCHEMA_VERSION}:work-preferences`;
const WRITING_LOG_KEY = `genseki:${SCHEMA_VERSION}:writing-logs`;
const SCENES_KEY = `genseki:${SCHEMA_VERSION}:plot-scenes`;
const CHAPTERS_KEY = `genseki:${SCHEMA_VERSION}:chapters`;
const NOVEL_LIKES_KEY = `genseki:${SCHEMA_VERSION}:novel-likes`;
const EPISODE_LIKES_KEY = `genseki:${SCHEMA_VERSION}:episode-likes`;
const BOOKMARKS_KEY = `genseki:${SCHEMA_VERSION}:bookmarks`;
const FOLLOWS_KEY = `genseki:${SCHEMA_VERSION}:follows`;
const NOVEL_COMMENTS_KEY = `genseki:${SCHEMA_VERSION}:novel-comments`;
const READ_KEY = `genseki:${SCHEMA_VERSION}:read-episodes`;
const REPORTS_KEY = `genseki:${SCHEMA_VERSION}:reports`;
const NOTICES_KEY = `genseki:${SCHEMA_VERSION}:admin-notices`;
const BANNERS_KEY = `genseki:${SCHEMA_VERSION}:admin-banners`;
const NG_WORDS_KEY = `genseki:${SCHEMA_VERSION}:admin-ng-words`;
const FEATURES_KEY = `genseki:${SCHEMA_VERSION}:admin-features`;
const CONTESTS_KEY = `genseki:${SCHEMA_VERSION}:contests`;
const PROJECTS_KEY = `genseki:${SCHEMA_VERSION}:projects`;
const CONTEST_ENTRIES_KEY = `genseki:${SCHEMA_VERSION}:contest-entries`;
const ROOM_PRESETS_KEY = `genseki:${SCHEMA_VERSION}:room-presets`;
const ROOMS_KEY = `genseki:${SCHEMA_VERSION}:writing-rooms`;
const PROFILE_KEY = `genseki:${SCHEMA_VERSION}:profile`;
const QUICK_MEMO_KEY = `genseki:${SCHEMA_VERSION}:quick-memos`;

NORMALIZERS[WORKS_KEY] = normalizeWork;
NORMALIZERS[EPISODES_KEY] = normalizeEpisode;
NORMALIZERS[PAGES_KEY] = normalizePage;
NORMALIZERS[ENTRIES_KEY] = normalizeEntry;
NORMALIZERS[RELATIONS_KEY] = normalizeRelation;
NORMALIZERS[PLOT_KEY] = normalizePlotStage;
NORMALIZERS[SCENES_KEY] = normalizePlotScene;
NORMALIZERS[PROFILE_KEY] = normalizeProfile;
NORMALIZERS[AI_KEY] = normalizeAiSettings;
NORMALIZERS[ROOMS_KEY] = normalizeRoom;
NORMALIZERS[CONTESTS_KEY] = normalizeContest;
NORMALIZERS[NOTICES_KEY] = normalizeNotice;
NORMALIZERS[BANNERS_KEY] = normalizeBanner;
const META_KEY = `genseki:${SCHEMA_VERSION}:meta`;

/**
 * ============================================================
 * 低レベル入出力
 * ============================================================
 */

function readAll<T>(key: string): T[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        /*
         * 読むたびに形を揃える。
         *
         * 項目を後から足すと、古いデータにはその項目が無い。
         * 無いまま画面へ渡すと、配列を数えようとして落ちる。
         * ここを通しておけば、どの経路で読んでも形が揃う。
         */
        const normalize = NORMALIZERS[key];
        if (!normalize) return parsed as T[];

        return parsed.map((row) =>
            typeof row === "object" && row !== null
                ? (normalize(row as Record<string, unknown>) as T)
                : (row as T),
        );
    } catch {
        // 壊れたデータは握りつぶして空扱いにする。
        // 起動不能になるより、空の状態から再開できるほうがよい。
        return [];
    }
}

/**
 * 書き込みが上限に当たったときは、握りつぶさずに投げる。
 *
 * 黙って失敗すると、書いたつもりのものが消える。
 * 画面側で受け止めて、何をすればよいかを伝えるほうがまし。
 */
export class StorageFullError extends Error {
    constructor() {
        super(
            "保存できる量の上限に達しました。" +
                "画像を減らすか、使っていない作品を削除してください。",
        );
        this.name = "StorageFullError";
    }
}

function writeAll<T>(key: string, rows: T[]): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, JSON.stringify(rows));
    } catch (error) {
        const isQuota =
            error instanceof DOMException &&
            (error.name === "QuotaExceededError" ||
                error.name === "NS_ERROR_DOM_QUOTA_REACHED");
        if (isQuota) throw new StorageFullError();
        throw error;
    }
}

function now(): string {
    return new Date().toISOString();
}

/**
 * ============================================================
 * Repository 実装
 * ============================================================
 */

export const localRepository: Repository = {
    /**
     * ==========================================================
     * Works
     * ==========================================================
     */

    async listWorks(): Promise<WorkWithStats[]> {
        const works = readAll<Work>(WORKS_KEY).filter((work) => !work.deleted_at);
        const episodes = readAll<Episode>(EPISODES_KEY).filter((ep) => !ep.deleted_at);
        const publishRows = readAll<PublishSettings>(PUBLISH_KEY);

        return works
            .map((work) => {
                const own = episodes.filter((ep) => ep.work_id === work.id);
                // 表示用の状態は公開設定から作る。works 側には持たない
                const publish = publishRows.find((row) => row.work_id === work.id);
                return {
                    ...work,
                    episode_count: own.length,
                    total_char_count: own.reduce((sum, ep) => sum + ep.char_count, 0),
                    state_label: formatWorkState(
                        publish?.visibility ?? "draft",
                        publish?.serial_status ?? "ongoing",
                    ),
                    visibility: publish?.visibility ?? "draft",
                    serial_status: publish?.serial_status ?? "ongoing",
                };
            })
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async getWork(workId: string): Promise<Work | null> {
        return (
            readAll<Work>(WORKS_KEY).find((w) => w.id === workId && !w.deleted_at) ?? null
        );
    },

    async createWork(input: WorkCreateInput): Promise<Work> {
        const works = readAll<Work>(WORKS_KEY);
        const timestamp = now();

        const work: Work = {
            id: createId(),
            title: input.title.trim(),
            catchphrase: null,
            genre: input.genre || GENRES[0],
            tags: input.tags ?? [],
            summary: input.summary?.trim() || null,
            author_note: null,
            age_rating: "all",
            keywords: [],
            cover_url: null,
            cover_is_ai: false,
            genre_changed_at: null,
            deleted_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(WORKS_KEY, [...works, work]);
        return work;
    },

    async updateWork(workId: string, patch: WorkUpdateInput): Promise<Work> {
        const works = readAll<Work>(WORKS_KEY);
        const index = works.findIndex((w) => w.id === workId);
        if (index === -1) throw new Error(`作品が見つかりません: ${workId}`);

        const updated: Work = { ...works[index], ...patch, updated_at: now() };
        works[index] = updated;
        writeAll(WORKS_KEY, works);
        return updated;
    },

    /**
     * 作品をゴミ箱へ入れる。
     * 本当に消すのは purgeTrash から。
     * 資料や設定はそのまま残しておく。戻したときに全部揃っていてほしいため。
     */
    async deleteWork(workId: string): Promise<void> {
        const timestamp = now();
        writeAll(
            WORKS_KEY,
            readAll<Work>(WORKS_KEY).map((work) =>
                work.id === workId ? { ...work, deleted_at: timestamp } : work,
            ),
        );
    },

    /**
     * ==========================================================
     * Episodes
     * ==========================================================
     */

    async listEpisodes(workId: string): Promise<Episode[]> {
        return readAll<Episode>(EPISODES_KEY)
            .filter((ep) => ep.work_id === workId && !ep.deleted_at)
            .sort((a, b) => a.ep_number - b.ep_number);
    },

    async getEpisode(episodeId: string): Promise<Episode | null> {
        return readAll<Episode>(EPISODES_KEY).find((ep) => ep.id === episodeId) ?? null;
    },

    async createEpisode(workId: string, input: EpisodeCreateInput = {}): Promise<Episode> {
        const all = readAll<Episode>(EPISODES_KEY);
        const own = all.filter((ep) => ep.work_id === workId);
        const nextNumber = own.length + 1;
        // タイトルは空のまま作る。「第3話」という表示は ep_number から作れるので、
        // 既定値を入れると「まだ決めていない」と「そう名づけた」の区別がつかなくなる。
        const body = input.body ?? "";
        const timestamp = now();

        const episode: Episode = {
            id: createId(),
            work_id: workId,
            ep_number: nextNumber,
            title: input.title?.trim() ?? "",
            body,
            status: "todo",
            char_count: countChars(body),
            deleted_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(EPISODES_KEY, [...all, episode]);
        await touchWork(workId);
        return episode;
    },

    async updateEpisode(episodeId: string, patch: EpisodeUpdateInput): Promise<Episode> {
        const all = readAll<Episode>(EPISODES_KEY);
        const index = all.findIndex((ep) => ep.id === episodeId);
        if (index === -1) throw new Error(`話が見つかりません: ${episodeId}`);

        const merged: Episode = { ...all[index], ...patch, updated_at: now() };
        // 本文が変わったときだけ文字数を数え直す
        if (patch.body !== undefined) merged.char_count = countChars(patch.body);

        /*
         * 本文が縮んだら、読んだ位置も戻す。
         * 書き直された箇所を「読み終わった」ままにすると、
         * 新しい内容が二度と読まれなくなる。
         */
        if (patch.body !== undefined && patch.scanned_length === undefined) {
            const read = merged.scanned_length ?? 0;
            if (patch.body.length < read) merged.scanned_length = 0;
        }

        all[index] = merged;
        writeAll(EPISODES_KEY, all);
        await touchWork(merged.work_id);
        return merged;
    },

    /** 話をゴミ箱へ入れ、残りの番号を詰め直す */
    async deleteEpisode(episodeId: string): Promise<void> {
        const all = readAll<Episode>(EPISODES_KEY);
        const target = all.find((ep) => ep.id === episodeId);
        if (!target) return;

        const marked = all.map((ep) =>
            ep.id === episodeId ? { ...ep, deleted_at: now() } : ep,
        );
        writeAll(EPISODES_KEY, renumber(marked, target.work_id));
        await touchWork(target.work_id);
    },

    async deleteAllEpisodes(workId: string): Promise<void> {
        writeAll(
            EPISODES_KEY,
            readAll<Episode>(EPISODES_KEY).filter((ep) => ep.work_id !== workId),
        );
    },

    async deleteEpisodes(episodeIds: string[]): Promise<void> {
        const gone = new Set(episodeIds);
        writeAll(
            EPISODES_KEY,
            readAll<Episode>(EPISODES_KEY).filter((ep) => !gone.has(ep.id)),
        );
    },

    async reorderEpisodes(workId: string, orderedIds: string[]): Promise<void> {
        const all = readAll<Episode>(EPISODES_KEY);
        const rank = new Map(orderedIds.map((id, i) => [id, i]));

        const next = all.map((ep) => {
            if (ep.work_id !== workId) return ep;
            const position = rank.get(ep.id);
            if (position === undefined) return ep;
            return { ...ep, ep_number: position + 1 };
        });

        writeAll(EPISODES_KEY, next);
        await touchWork(workId);
    },

    async createEpisodes(
        workId: string,
        items: { title: string; body: string }[],
    ): Promise<Episode[]> {
        const all = readAll<Episode>(EPISODES_KEY);
        const startNumber = all.filter((ep) => ep.work_id === workId).length + 1;
        const timestamp = now();

        const created: Episode[] = items.map((item, index) => ({
            id: createId(),
            work_id: workId,
            ep_number: startNumber + index,
            title: item.title.trim(),
            body: item.body,
            status: "todo",
            char_count: countChars(item.body),
            deleted_at: null,
            created_at: timestamp,
            updated_at: timestamp,
        }));

        writeAll(EPISODES_KEY, [...all, ...created]);
        await touchWork(workId);
        return created;
    },

    /**
     * ==========================================================
     * DisplaySettings
     * ==========================================================
     */

    async getDisplaySettings(workId: string): Promise<DisplaySettings> {
        const rows = readAll<DisplaySettings>(DISPLAY_KEY);
        return rows.find((row) => row.work_id === workId) ?? defaultDisplaySettings(workId);
    },

    async saveDisplaySettings(
        workId: string,
        patch: Partial<Omit<DisplaySettings, "work_id">>,
    ): Promise<DisplaySettings> {
        const rows = readAll<DisplaySettings>(DISPLAY_KEY);
        const index = rows.findIndex((row) => row.work_id === workId);
        const base = index === -1 ? defaultDisplaySettings(workId) : rows[index];
        const merged: DisplaySettings = { ...base, ...patch, work_id: workId };

        if (index === -1) rows.push(merged);
        else rows[index] = merged;

        writeAll(DISPLAY_KEY, rows);
        return merged;
    },

    /**
     * ==========================================================
     * EpisodeVersion
     * ==========================================================
     */

    async listVersions(episodeId: string): Promise<EpisodeVersion[]> {
        return readAll<EpisodeVersion>(VERSIONS_KEY)
            .filter((version) => version.episode_id === episodeId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async createVersion(
        episodeId: string,
        trigger: "auto" | "manual" | "restore",
    ): Promise<EpisodeVersion | null> {
        const episode = readAll<Episode>(EPISODES_KEY).find((ep) => ep.id === episodeId);
        if (!episode) return null;

        const all = readAll<EpisodeVersion>(VERSIONS_KEY);
        const own = all
            .filter((version) => version.episode_id === episodeId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));

        // 本文が前の版と同じなら残さない。同じ内容の版が並ぶと履歴が読めなくなる
        if (own.length > 0 && own[0].body === episode.body) return null;

        const version: EpisodeVersion = {
            id: createId(),
            episode_id: episodeId,
            work_id: episode.work_id,
            body: episode.body,
            char_count: episode.char_count,
            trigger,
            label: `v${own.length + 1}`,
            created_at: now(),
        };

        // 上限を超えた古い版から消す
        const keepIds = new Set(
            [version, ...own].slice(0, VERSION_MAX_PER_EPISODE).map((row) => row.id),
        );
        const next = [...all, version].filter(
            (row) => row.episode_id !== episodeId || keepIds.has(row.id),
        );

        writeAll(VERSIONS_KEY, next);
        return version;
    },

    async restoreVersion(versionId: string): Promise<Episode> {
        const versions = readAll<EpisodeVersion>(VERSIONS_KEY);
        const version = versions.find((row) => row.id === versionId);
        if (!version) throw new Error(`バージョンが見つかりません: ${versionId}`);

        // 書き戻す前の状態を先に控える。復元の取り消しができるようにするため
        await localRepository.createVersion(version.episode_id, "restore");

        const all = readAll<Episode>(EPISODES_KEY);
        const index = all.findIndex((ep) => ep.id === version.episode_id);
        if (index === -1) throw new Error(`話が見つかりません: ${version.episode_id}`);

        const restored: Episode = {
            ...all[index],
            body: version.body,
            char_count: countChars(version.body),
            updated_at: now(),
        };
        all[index] = restored;
        writeAll(EPISODES_KEY, all);
        await touchWork(restored.work_id);
        return restored;
    },

    /**
     * ==========================================================
     * PublishSettings
     * ==========================================================
     */

    async getPublishSettings(workId: string): Promise<PublishSettings> {
        const rows = readAll<PublishSettings>(PUBLISH_KEY);
        return rows.find((row) => row.work_id === workId) ?? defaultPublishSettings(workId);
    },

    async savePublishSettings(
        workId: string,
        patch: Partial<Omit<PublishSettings, "work_id">>,
    ): Promise<PublishSettings> {
        const rows = readAll<PublishSettings>(PUBLISH_KEY);
        const index = rows.findIndex((row) => row.work_id === workId);
        const base = index === -1 ? defaultPublishSettings(workId) : rows[index];
        const merged: PublishSettings = { ...base, ...patch, work_id: workId };

        if (index === -1) rows.push(merged);
        else rows[index] = merged;

        writeAll(PUBLISH_KEY, rows);
        await touchWork(workId);
        return merged;
    },

    /**
     * ==========================================================
     * ResourcePage
     * ==========================================================
     */

    async listPages(workId: string): Promise<ResourcePage[]> {
        const rows = readAll<ResourcePage>(PAGES_KEY).filter((page) => page.work_id === workId);
        // まだ用意されていなければ常設ページだけ作る
        if (rows.length === 0) return localRepository.setupPages(workId, []);
        return rows.sort((a, b) => a.sort_order - b.sort_order);
    },

    async setupPages(workId: string, extraPageKeys: string[]): Promise<ResourcePage[]> {
        const all = readAll<ResourcePage>(PAGES_KEY);
        const existingKeys = new Set(
            all.filter((page) => page.work_id === workId).map((page) => page.builtin_key),
        );

        const wanted = [
            ...PINNED_PAGES,
            ...extraPageKeys
                .map((key) => ALL_BUILTIN_PAGES.find((page) => page.key === key))
                .filter((page): page is (typeof ALL_BUILTIN_PAGES)[number] => Boolean(page)),
        ];

        const timestamp = now();
        const created: ResourcePage[] = [];
        let order = all.filter((page) => page.work_id === workId).length;

        for (const definition of wanted) {
            if (existingKeys.has(definition.key)) continue;
            created.push({
                id: createId(),
                work_id: workId,
                builtin_key: definition.key,
                label: definition.label,
                description: definition.description,
                kind: definition.kind,
                fields: definition.fields,
                is_pinned: definition.isPinned,
                sort_order: order,
                layout: definition.layout,
                image_style: definition.imageStyle,
                timeline_mode: definition.timelineMode ?? "order",
                created_at: timestamp,
                updated_at: timestamp,
            });
            order += 1;
        }

        writeAll(PAGES_KEY, [...all, ...created]);
        return readAll<ResourcePage>(PAGES_KEY)
            .filter((page) => page.work_id === workId)
            .sort((a, b) => a.sort_order - b.sort_order);
    },

    async addBuiltinPage(workId: string, builtinKey: string): Promise<ResourcePage> {
        const pages = await localRepository.setupPages(workId, [builtinKey]);
        const page = pages.find((row) => row.builtin_key === builtinKey);
        if (!page) throw new Error(`ページを作れませんでした: ${builtinKey}`);
        return page;
    },

    async createCustomPage(
        workId: string,
        input: Pick<ResourcePage, "label" | "description" | "fields">,
    ): Promise<ResourcePage> {
        const all = readAll<ResourcePage>(PAGES_KEY);
        const timestamp = now();

        const page: ResourcePage = {
            id: createId(),
            work_id: workId,
            builtin_key: null,
            label: input.label.trim(),
            description: input.description.trim(),
            kind: "entries",
            fields: input.fields,
            is_pinned: false,
            sort_order: all.filter((row) => row.work_id === workId).length,
            layout: "list",
            image_style: "icon",
            timeline_mode: "order",
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(PAGES_KEY, [...all, page]);
        await touchWork(workId);
        return page;
    },

    async updatePage(pageId: string, patch: Partial<ResourcePage>): Promise<ResourcePage> {
        const all = readAll<ResourcePage>(PAGES_KEY);
        const index = all.findIndex((page) => page.id === pageId);
        if (index === -1) throw new Error(`ページが見つかりません: ${pageId}`);

        const updated: ResourcePage = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(PAGES_KEY, all);
        return updated;
    },

    async deletePage(pageId: string): Promise<void> {
        const all = readAll<ResourcePage>(PAGES_KEY);
        const target = all.find((page) => page.id === pageId);
        if (!target || target.is_pinned) return;

        writeAll(PAGES_KEY, all.filter((page) => page.id !== pageId));
        writeAll(
            ENTRIES_KEY,
            readAll<ResourceEntry>(ENTRIES_KEY).filter((entry) => entry.page_id !== pageId),
        );
    },

    /**
     * ==========================================================
     * ResourceEntry
     * ==========================================================
     */

    async listEntries(workId: string, pageId?: string): Promise<ResourceEntry[]> {
        return readAll<ResourceEntry>(ENTRIES_KEY)
            .filter((entry) => entry.work_id === workId)
            .filter((entry) => (pageId ? entry.page_id === pageId : true))
            .sort((a, b) => {
                // 承認済み → 候補 → 拒否済み の順に並べる
                const rank = (entry: ResourceEntry) =>
                    entry.candidate_status === "none"
                        ? 0
                        : entry.candidate_status === "pending"
                          ? 1
                          : 2;
                if (rank(a) !== rank(b)) return rank(a) - rank(b);
                if (a.is_major !== b.is_major) return a.is_major ? -1 : 1;
                return a.created_at.localeCompare(b.created_at);
            });
    },

    async createEntry(
        workId: string,
        pageId: string,
        input: Partial<ResourceEntry> = {},
    ): Promise<ResourceEntry> {
        const all = readAll<ResourceEntry>(ENTRIES_KEY);
        const timestamp = now();

        const entry: ResourceEntry = {
            id: createId(),
            work_id: workId,
            page_id: pageId,
            name: input.name ?? "",
            aliases: input.aliases ?? [],
            summary: input.summary ?? "",
            values: input.values ?? {},
            is_major: input.is_major ?? false,
            candidate_status: input.candidate_status ?? "none",
            candidate_source: input.candidate_source ?? null,
            image_url: input.image_url ?? null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(ENTRIES_KEY, [...all, entry]);
        await touchWork(workId);
        return entry;
    },

    async updateEntry(entryId: string, patch: Partial<ResourceEntry>): Promise<ResourceEntry> {
        const all = readAll<ResourceEntry>(ENTRIES_KEY);
        const index = all.findIndex((entry) => entry.id === entryId);
        if (index === -1) throw new Error(`項目が見つかりません: ${entryId}`);

        const updated: ResourceEntry = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(ENTRIES_KEY, all);
        return updated;
    },

    async deleteEntry(entryId: string): Promise<void> {
        writeAll(
            ENTRIES_KEY,
            readAll<ResourceEntry>(ENTRIES_KEY).filter((entry) => entry.id !== entryId),
        );
        // ぶら下がっていた関係とリンクも消す
        writeAll(
            RELATIONS_KEY,
            readAll<ResourceRelation>(RELATIONS_KEY).filter(
                (relation) =>
                    relation.from_entry_id !== entryId && relation.to_entry_id !== entryId,
            ),
        );
        writeAll(
            MENTIONS_KEY,
            readAll<EntryMention>(MENTIONS_KEY).filter(
                (mention) => mention.entry_id !== entryId,
            ),
        );
    },

    async mergeEntries(keepId: string, mergeId: string): Promise<ResourceEntry> {
        const all = readAll<ResourceEntry>(ENTRIES_KEY);
        const keep = all.find((entry) => entry.id === keepId);
        const merge = all.find((entry) => entry.id === mergeId);
        if (!keep || !merge) throw new Error("統合する項目が見つかりません");

        // 消えるほうの名前と別名を、残るほうの別名へ移す
        const aliases = Array.from(
            new Set([...keep.aliases, merge.name, ...merge.aliases]),
        ).filter((alias) => alias && alias !== keep.name);

        const merged: ResourceEntry = {
            ...keep,
            aliases,
            // 空いている欄だけを埋める。書いてあるものは上書きしない
            summary: keep.summary || merge.summary,
            image_url: keep.image_url ?? merge.image_url,
            is_major: keep.is_major || merge.is_major,
            values: { ...merge.values, ...keep.values },
            updated_at: now(),
        };

        writeAll(
            ENTRIES_KEY,
            all
                .filter((entry) => entry.id !== mergeId)
                .map((entry) => (entry.id === keepId ? merged : entry)),
        );

        // 関係の向き先を付け替える。自分自身を指す関係になったら捨てる
        writeAll(
            RELATIONS_KEY,
            readAll<ResourceRelation>(RELATIONS_KEY)
                .map((relation) => ({
                    ...relation,
                    from_entry_id:
                        relation.from_entry_id === mergeId ? keepId : relation.from_entry_id,
                    to_entry_id:
                        relation.to_entry_id === mergeId ? keepId : relation.to_entry_id,
                }))
                .filter((relation) => relation.from_entry_id !== relation.to_entry_id),
        );

        writeAll(
            MENTIONS_KEY,
            readAll<EntryMention>(MENTIONS_KEY).map((mention) =>
                mention.entry_id === mergeId ? { ...mention, entry_id: keepId } : mention,
            ),
        );

        await touchWork(keep.work_id);
        return merged;
    },

    /**
     * ==========================================================
     * ResourceRelation
     * ==========================================================
     */

    async listRelations(workId: string): Promise<ResourceRelation[]> {
        return readAll<ResourceRelation>(RELATIONS_KEY).filter(
            (relation) => relation.work_id === workId,
        );
    },

    async createRelation(
        workId: string,
        input: Pick<ResourceRelation, "from_entry_id" | "to_entry_id" | "label">,
    ): Promise<ResourceRelation> {
        const all = readAll<ResourceRelation>(RELATIONS_KEY);
        const timestamp = now();

        const relation: ResourceRelation = {
            id: createId(),
            work_id: workId,
            from_entry_id: input.from_entry_id,
            to_entry_id: input.to_entry_id,
            label: input.label,
            note: "",
            changes: [],
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(RELATIONS_KEY, [...all, relation]);
        await touchWork(workId);
        return relation;
    },

    async updateRelation(
        relationId: string,
        patch: Partial<ResourceRelation>,
    ): Promise<ResourceRelation> {
        const all = readAll<ResourceRelation>(RELATIONS_KEY);
        const index = all.findIndex((relation) => relation.id === relationId);
        if (index === -1) throw new Error(`関係が見つかりません: ${relationId}`);

        const updated: ResourceRelation = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(RELATIONS_KEY, all);
        return updated;
    },

    async deleteRelation(relationId: string): Promise<void> {
        writeAll(
            RELATIONS_KEY,
            readAll<ResourceRelation>(RELATIONS_KEY).filter(
                (relation) => relation.id !== relationId,
            ),
        );
    },

    /**
     * ==========================================================
     * PlotStage
     * ==========================================================
     */

    async listPlotStages(workId: string): Promise<PlotStage[]> {
        return readAll<PlotStage>(PLOT_KEY)
            .filter((stage) => stage.work_id === workId)
            .sort((a, b) => a.sort_order - b.sort_order);
    },

    async createPlotStage(workId: string): Promise<PlotStage> {
        const all = readAll<PlotStage>(PLOT_KEY);
        const timestamp = now();

        const stage: PlotStage = {
            id: createId(),
            work_id: workId,
            title: "",
            description: "",
            episode_range: "",
            sort_order: all.filter((row) => row.work_id === workId).length,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(PLOT_KEY, [...all, stage]);
        await touchWork(workId);
        return stage;
    },

    async updatePlotStage(stageId: string, patch: Partial<PlotStage>): Promise<PlotStage> {
        const all = readAll<PlotStage>(PLOT_KEY);
        const index = all.findIndex((stage) => stage.id === stageId);
        if (index === -1) throw new Error(`段が見つかりません: ${stageId}`);

        const updated: PlotStage = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(PLOT_KEY, all);
        return updated;
    },

    async deletePlotStage(stageId: string): Promise<void> {
        writeAll(
            PLOT_KEY,
            readAll<PlotStage>(PLOT_KEY).filter((stage) => stage.id !== stageId),
        );
        // 段の中の場面も一緒に消す。行き場のない場面が残ると数が合わなくなる
        writeAll(
            SCENES_KEY,
            readAll<PlotScene>(SCENES_KEY).filter((scene) => scene.stage_id !== stageId),
        );
    },

    async reorderPlotStages(workId: string, orderedIds: string[]): Promise<void> {
        const all = readAll<PlotStage>(PLOT_KEY);
        const rank = new Map(orderedIds.map((id, i) => [id, i]));

        writeAll(
            PLOT_KEY,
            all.map((stage) => {
                if (stage.work_id !== workId) return stage;
                const position = rank.get(stage.id);
                return position === undefined ? stage : { ...stage, sort_order: position };
            }),
        );
    },

    async listPlotScenes(workId: string): Promise<PlotScene[]> {
        return readAll<PlotScene>(SCENES_KEY)
            .filter((scene) => scene.work_id === workId)
            .sort((a, b) => a.sort_order - b.sort_order);
    },

    async createPlotScene(workId: string, stageId: string): Promise<PlotScene> {
        const all = readAll<PlotScene>(SCENES_KEY);
        const timestamp = now();

        const scene: PlotScene = {
            id: createId(),
            work_id: workId,
            stage_id: stageId,
            title: "",
            description: "",
            episode_range: "",
            entry_ids: [],
            is_done: false,
            sort_order: all.filter((row) => row.stage_id === stageId).length,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(SCENES_KEY, [...all, scene]);
        await touchWork(workId);
        return scene;
    },

    async updatePlotScene(sceneId: string, patch: Partial<PlotScene>): Promise<PlotScene> {
        const all = readAll<PlotScene>(SCENES_KEY);
        const index = all.findIndex((scene) => scene.id === sceneId);
        if (index === -1) throw new Error(`場面が見つかりません: ${sceneId}`);

        const updated: PlotScene = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(SCENES_KEY, all);
        return updated;
    },

    async deletePlotScene(sceneId: string): Promise<void> {
        writeAll(
            SCENES_KEY,
            readAll<PlotScene>(SCENES_KEY).filter((scene) => scene.id !== sceneId),
        );
    },

    /**
     * ==========================================================
     * EntryMention
     * ==========================================================
     */

    async listMentions(workId: string, episodeId?: string): Promise<EntryMention[]> {
        return readAll<EntryMention>(MENTIONS_KEY)
            .filter((mention) => mention.work_id === workId)
            .filter((mention) => (episodeId ? mention.episode_id === episodeId : true));
    },

    async createMention(
        workId: string,
        episodeId: string,
        entryId: string,
        surface: string,
    ): Promise<EntryMention> {
        const all = readAll<EntryMention>(MENTIONS_KEY);

        // 同じ話・同じ項目・同じ表記のリンクは 1 つだけにする
        const existing = all.find(
            (mention) =>
                mention.episode_id === episodeId &&
                mention.entry_id === entryId &&
                mention.surface === surface,
        );
        if (existing) return existing;

        const mention: EntryMention = {
            id: createId(),
            work_id: workId,
            episode_id: episodeId,
            entry_id: entryId,
            surface,
            created_at: now(),
        };

        writeAll(MENTIONS_KEY, [...all, mention]);
        return mention;
    },

    async deleteMention(mentionId: string): Promise<void> {
        writeAll(
            MENTIONS_KEY,
            readAll<EntryMention>(MENTIONS_KEY).filter((mention) => mention.id !== mentionId),
        );
    },

    /**
     * ==========================================================
     * AiSettings
     * ==========================================================
     */

    async getAiSettings(workId: string): Promise<AiSettings> {
        const rows = readAll<AiSettings>(AI_KEY);
        return rows.find((row) => row.work_id === workId) ?? defaultAiSettings(workId);
    },

    async saveAiSettings(
        workId: string,
        patch: Partial<Omit<AiSettings, "work_id">>,
    ): Promise<AiSettings> {
        const rows = readAll<AiSettings>(AI_KEY);
        const index = rows.findIndex((row) => row.work_id === workId);
        const base = index === -1 ? defaultAiSettings(workId) : rows[index];
        const merged: AiSettings = { ...base, ...patch, work_id: workId };

        if (index === -1) rows.push(merged);
        else rows[index] = merged;

        writeAll(AI_KEY, rows);
        return merged;
    },

    /**
     * ==========================================================
     * バックアップ
     * ==========================================================
     */

    async exportAll(): Promise<BackupFile> {
        // 取り出した日時を控える。次に開いたとき「前回いつ取ったか」を出すため
        const meta = readAll<{ key: string; value: string }>(META_KEY).filter(
            (row) => row.key !== "last_backup_at",
        );
        writeAll(META_KEY, [...meta, { key: "last_backup_at", value: now() }]);

        const tables: Record<string, unknown[]> = {};
        const counts: Record<string, number> = {};

        for (const table of BACKUP_TABLES) {
            const rows = readAll<unknown>(`genseki:${SCHEMA_VERSION}:${table}`);
            tables[table] = rows;
            counts[table] = rows.length;
        }

        return {
            meta: {
                app: "genseki-studio",
                format_version: BACKUP_FORMAT_VERSION,
                exported_at: now(),
                counts,
            },
            tables,
        };
    },

    async importAll(
        backup: BackupFile,
        mode: "replace" | "merge",
    ): Promise<BackupSummary> {
        const imported: Record<string, number> = {};
        let skipped = 0;

        for (const table of BACKUP_TABLES) {
            const key = `genseki:${SCHEMA_VERSION}:${table}`;
            const incoming = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];

            if (mode === "replace") {
                writeAll(key, incoming);
                imported[table] = incoming.length;
                continue;
            }

            // merge のときは id が同じものを飛ばす。
            // 上書きすると、戻したつもりが今の原稿を潰すことになる
            const current = readAll<{ id?: string; work_id?: string }>(key);
            const existingIds = new Set(
                current.map((row) => row.id ?? row.work_id).filter(Boolean),
            );

            const added = incoming.filter((row) => {
                const candidate = row as { id?: string; work_id?: string };
                const rowId = candidate.id ?? candidate.work_id;
                if (rowId && existingIds.has(rowId)) {
                    skipped += 1;
                    return false;
                }
                return true;
            });

            writeAll(key, [...current, ...added]);
            imported[table] = added.length;
        }

        return { imported, skipped };
    },

    /**
     * ==========================================================
     * 執筆の記録
     * ==========================================================
     */

    async getPreferences(workId: string): Promise<WorkPreferences> {
        const rows = readAll<WorkPreferences>(PREFERENCES_KEY);
        return rows.find((row) => row.work_id === workId) ?? defaultWorkPreferences(workId);
    },

    async savePreferences(
        workId: string,
        patch: Partial<Omit<WorkPreferences, "work_id">>,
    ): Promise<WorkPreferences> {
        const rows = readAll<WorkPreferences>(PREFERENCES_KEY);
        const index = rows.findIndex((row) => row.work_id === workId);
        const base = index === -1 ? defaultWorkPreferences(workId) : rows[index];
        const merged: WorkPreferences = { ...base, ...patch, work_id: workId };

        if (index === -1) rows.push(merged);
        else rows[index] = merged;

        writeAll(PREFERENCES_KEY, rows);
        return merged;
    },

    async listWritingLogs(workId: string): Promise<WritingLog[]> {
        return readAll<WritingLog>(WRITING_LOG_KEY)
            .filter((log) => log.work_id === workId)
            .sort((a, b) => a.date.localeCompare(b.date));
    },

    async recordProgress(workId: string, totalChars: number): Promise<void> {
        const preferences = await localRepository.getPreferences(workId);
        if (!preferences.record_progress) return;

        const all = readAll<WritingLog>(WRITING_LOG_KEY);
        const date = todayKey();
        const index = all.findIndex(
            (log) => log.work_id === workId && log.date === date,
        );

        if (index === -1) {
            // その日の最初の記録。前の日の総文字数との差を増えた量とする
            const previous = all
                .filter((log) => log.work_id === workId && log.date < date)
                .sort((a, b) => b.date.localeCompare(a.date))[0];
            const base = previous?.total_chars ?? totalChars;

            all.push({
                work_id: workId,
                date,
                total_chars: totalChars,
                delta: totalChars - base,
                updated_at: now(),
            });
        } else {
            // 同じ日の 2 回目以降。その日の起点は変えずに差を取り直す
            const base = all[index].total_chars - all[index].delta;
            all[index] = {
                ...all[index],
                total_chars: totalChars,
                delta: totalChars - base,
                updated_at: now(),
            };
        }

        writeAll(WRITING_LOG_KEY, all);
    },

    /**
     * ==========================================================
     * 執筆室
     * ==========================================================
     */

    async listRooms(): Promise<WritingRoom[]> {
        return readAll<WritingRoom>(ROOMS_KEY).sort((a, b) =>
            b.updated_at.localeCompare(a.updated_at),
        );
    },

    async getRoom(roomId: string): Promise<WritingRoom | null> {
        return readAll<WritingRoom>(ROOMS_KEY).find((room) => room.id === roomId) ?? null;
    },

    async createRoom(input: Partial<WritingRoom>): Promise<WritingRoom> {
        const all = readAll<WritingRoom>(ROOMS_KEY);
        const room: WritingRoom = {
            ...defaultRoom(createId(), input.host_id ?? null),
            ...input,
        };
        writeAll(ROOMS_KEY, [...all, room]);
        return room;
    },

    /**
     * ==========================================================
     * コンテスト
     * ==========================================================
     */

    async listContests(): Promise<Contest[]> {
        return readAll<Contest>(CONTESTS_KEY).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
        );
    },

    /**
     * ==========================================================
     * Project（自主企画）
     * ==========================================================
     */

    async listProjects(): Promise<Project[]> {
        return readAll<Project>(PROJECTS_KEY)
            .filter((row) => row.is_published)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getProject(projectId: string): Promise<Project | null> {
        return readAll<Project>(PROJECTS_KEY).find((row) => row.id === projectId) ?? null;
    },

    async listMyProjects(): Promise<Project[]> {
        return readAll<Project>(PROJECTS_KEY).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
        );
    },

    async isProjectTagTaken(tag: string): Promise<boolean> {
        const needle = tag.trim().toLowerCase();
        if (!needle) return false;
        return readAll<Project>(PROJECTS_KEY).some(
            (row) => row.tag.toLowerCase() === needle,
        );
    },

    async createProject(input: ProjectInput): Promise<Project> {
        if (await this.isProjectTagTaken(input.tag)) {
            throw new Error("その合言葉は、すでに使われています");
        }

        const timestamp = new Date().toISOString();
        const project: Project = {
            id: crypto.randomUUID(),
            owner_id: "local",
            title: input.title.trim(),
            description: input.description.trim(),
            tag: input.tag.trim(),
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            banner_url: input.banner_url ?? null,
            is_published: true,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(PROJECTS_KEY, [...readAll<Project>(PROJECTS_KEY), project]);
        return project;
    },

    async updateProject(
        projectId: string,
        patch: Partial<ProjectInput>,
    ): Promise<Project> {
        const list = readAll<Project>(PROJECTS_KEY);
        const at = list.findIndex((row) => row.id === projectId);
        if (at < 0) throw new Error("その企画は見つかりませんでした");

        const next: Project = {
            ...list[at],
            ...patch,
            updated_at: new Date().toISOString(),
        };
        list[at] = next;
        writeAll(PROJECTS_KEY, list);
        return next;
    },

    async deleteProject(projectId: string): Promise<void> {
        writeAll(
            PROJECTS_KEY,
            readAll<Project>(PROJECTS_KEY).filter((row) => row.id !== projectId),
        );
    },

    async getContest(contestId: string): Promise<Contest | null> {
        return (
            readAll<Contest>(CONTESTS_KEY).find((row) => row.id === contestId) ?? null
        );
    },

    async createContest(): Promise<Contest> {
        const contest = defaultContest(createId());
        writeAll(CONTESTS_KEY, [...readAll<Contest>(CONTESTS_KEY), contest]);
        return contest;
    },

    async updateContest(contestId: string, patch: Partial<Contest>): Promise<Contest> {
        const all = readAll<Contest>(CONTESTS_KEY);
        const index = all.findIndex((row) => row.id === contestId);
        if (index === -1) throw new Error("コンテストが見つかりません");

        const merged: Contest = { ...all[index], ...patch, updated_at: now() };
        all[index] = merged;
        writeAll(CONTESTS_KEY, all);
        return merged;
    },

    async deleteContest(contestId: string): Promise<void> {
        writeAll(
            CONTESTS_KEY,
            readAll<Contest>(CONTESTS_KEY).filter((row) => row.id !== contestId),
        );
        // 応募も一緒に消す。行き先の無い応募が残ると数が合わなくなる
        writeAll(
            CONTEST_ENTRIES_KEY,
            readAll<ContestEntry>(CONTEST_ENTRIES_KEY).filter(
                (row) => row.contest_id !== contestId,
            ),
        );
    },

    /**
     * ==========================================================
     * 運営が扱うもの
     * ==========================================================
     */

    /**
     * 利用者。
     *
     * 端末の中だけで動いているときは、自分しかいない。
     * 空を返して、画面側に「繋いでいない」と伝えてもらう。
     */
    async listUsers(): Promise<AdminUser[]> {
        return [];
    },

    async updateUser(): Promise<AdminUser> {
        throw new Error("利用者の管理には接続先が必要です");
    },

    /**
     * ==========================================================
     * 部屋の模様の控え
     * ==========================================================
     */




    async listChapters(workId: string): Promise<Chapter[]> {
        return readAll<Chapter>(CHAPTERS_KEY)
            .filter((row) => row.work_id === workId)
            .sort((a, b) => a.sort_order - b.sort_order);
    },

    async createChapter(workId: string, title = ""): Promise<Chapter> {
        const all = readAll<Chapter>(CHAPTERS_KEY);
        const own = all.filter((row) => row.work_id === workId);

        const chapter = { ...defaultChapter(createId(), workId, own.length), title };
        writeAll(CHAPTERS_KEY, [...all, chapter]);
        return chapter;
    },

    async updateChapter(chapterId: string, patch: Partial<Chapter>): Promise<Chapter> {
        const all = readAll<Chapter>(CHAPTERS_KEY);
        const index = all.findIndex((row) => row.id === chapterId);
        if (index === -1) throw new Error("章が見つかりません");

        all[index] = { ...all[index], ...patch, updated_at: now() };
        writeAll(CHAPTERS_KEY, all);
        return all[index];
    },

    async deleteChapter(chapterId: string): Promise<void> {
        writeAll(
            CHAPTERS_KEY,
            readAll<Chapter>(CHAPTERS_KEY).filter((row) => row.id !== chapterId),
        );

        /*
         * 中の話は消さない。章から外すだけ。
         * 章を消したつもりで原稿ごと消えるのは、取り返しがつかない。
         */
        const episodes = readAll<Episode>(EPISODES_KEY);
        writeAll(
            EPISODES_KEY,
            episodes.map((row) =>
                row.chapter_id === chapterId ? { ...row, chapter_id: null } : row,
            ),
        );
    },

    async reorderChapters(workId: string, orderedIds: string[]): Promise<void> {
        const all = readAll<Chapter>(CHAPTERS_KEY);
        writeAll(
            CHAPTERS_KEY,
            all.map((row) => {
                const at = orderedIds.indexOf(row.id);
                return at === -1 ? row : { ...row, sort_order: at };
            }),
        );
    },




    async listNotices(): Promise<AdminNotice[]> {
        return readAll<AdminNotice>(NOTICES_KEY).sort((a, b) =>
            b.published_at.localeCompare(a.published_at),
        );
    },

    async createNotice(): Promise<AdminNotice> {
        const timestamp = now();
        const notice: AdminNotice = {
            id: createId(),
            type: "info",
            title: "",
            body: "",
            link: "",
            image_url: null,
            is_published: false,
            published_at: timestamp.slice(0, 10),
            created_at: timestamp,
            updated_at: timestamp,
        };
        writeAll(NOTICES_KEY, [...readAll<AdminNotice>(NOTICES_KEY), notice]);
        return notice;
    },

    async updateNotice(
        noticeId: string,
        patch: Partial<AdminNotice>,
    ): Promise<AdminNotice> {
        const all = readAll<AdminNotice>(NOTICES_KEY);
        const index = all.findIndex((row) => row.id === noticeId);
        if (index === -1) throw new Error("お知らせが見つかりません");

        all[index] = { ...all[index], ...patch, updated_at: now() };
        writeAll(NOTICES_KEY, all);
        return all[index];
    },

    async deleteNotice(noticeId: string): Promise<void> {
        writeAll(
            NOTICES_KEY,
            readAll<AdminNotice>(NOTICES_KEY).filter((row) => row.id !== noticeId),
        );
    },

    async listBanners(): Promise<AdminBanner[]> {
        return readAll<AdminBanner>(BANNERS_KEY).sort(
            (a, b) => a.sort_order - b.sort_order,
        );
    },

    async createBanner(): Promise<AdminBanner> {
        const all = readAll<AdminBanner>(BANNERS_KEY);
        const banner: AdminBanner = {
            id: createId(),
            title: "",
            image_url: null,
            link_url: "",
            place: "home-side",
            is_active: false,
            sort_order: all.length,
            created_at: now(),
        };
        writeAll(BANNERS_KEY, [...all, banner]);
        return banner;
    },

    async updateBanner(
        bannerId: string,
        patch: Partial<AdminBanner>,
    ): Promise<AdminBanner> {
        const all = readAll<AdminBanner>(BANNERS_KEY);
        const index = all.findIndex((row) => row.id === bannerId);
        if (index === -1) throw new Error("バナーが見つかりません");

        all[index] = { ...all[index], ...patch };
        writeAll(BANNERS_KEY, all);
        return all[index];
    },

    async deleteBanner(bannerId: string): Promise<void> {
        writeAll(
            BANNERS_KEY,
            readAll<AdminBanner>(BANNERS_KEY).filter((row) => row.id !== bannerId),
        );
    },

    async listNgWords(): Promise<NgWord[]> {
        return readAll<NgWord>(NG_WORDS_KEY).sort((a, b) =>
            a.word.localeCompare(b.word, "ja"),
        );
    },

    async createNgWord(word: string): Promise<NgWord> {
        const row: NgWord = {
            id: createId(),
            word: word.trim(),
            reason: "",
            suggestion: "",
            created_at: now(),
        };
        writeAll(NG_WORDS_KEY, [...readAll<NgWord>(NG_WORDS_KEY), row]);
        return row;
    },

    async updateNgWord(wordId: string, patch: Partial<NgWord>): Promise<NgWord> {
        const all = readAll<NgWord>(NG_WORDS_KEY);
        const index = all.findIndex((row) => row.id === wordId);
        if (index === -1) throw new Error("見つかりません");

        all[index] = { ...all[index], ...patch };
        writeAll(NG_WORDS_KEY, all);
        return all[index];
    },

    async deleteNgWord(wordId: string): Promise<void> {
        writeAll(
            NG_WORDS_KEY,
            readAll<NgWord>(NG_WORDS_KEY).filter((row) => row.id !== wordId),
        );
    },

    async listFeatureFlags(): Promise<FeatureFlag[]> {
        const saved = readAll<FeatureFlag>(FEATURES_KEY);

        /*
         * 決められた機能の並びを基準にする。
         * 保存されている状態を上書きで乗せる。
         * こうしないと、機能を足したとき一覧に出てこない。
         */
        return defaultFeatureFlags().map((row) => {
            const found = saved.find((item) => item.key === row.key);
            return found ? { ...row, status: found.status, updated_at: found.updated_at } : row;
        });
    },

    async updateFeatureFlag(
        key: string,
        status: FeatureFlag["status"],
    ): Promise<FeatureFlag> {
        const all = readAll<FeatureFlag>(FEATURES_KEY);
        const base = defaultFeatureFlags().find((row) => row.key === key);
        if (!base) throw new Error("その機能はありません");

        const merged: FeatureFlag = { ...base, status, updated_at: now() };
        const index = all.findIndex((row) => row.key === key);
        if (index === -1) all.push(merged);
        else all[index] = merged;

        writeAll(FEATURES_KEY, all);
        return merged;
    },

    async listContestEntries(contestId: string): Promise<ContestEntry[]> {
        return readAll<ContestEntry>(CONTEST_ENTRIES_KEY)
            .filter((row) => row.contest_id === contestId)
            .sort((a, b) => a.entered_at.localeCompare(b.entered_at));
    },

    /* 端末の中だけで動くときは、応募も自分のものしかない */
    async listMyContestEntries(contestId: string): Promise<ContestEntry[]> {
        return this.listContestEntries(contestId);
    },

    async createContestEntry(
        contestId: string,
        input: Omit<ContestEntry, "id" | "contest_id" | "entered_at">,
    ): Promise<ContestEntry> {
        const entry: ContestEntry = {
            ...input,
            id: createId(),
            contest_id: contestId,
            entered_at: now(),
        };
        writeAll(CONTEST_ENTRIES_KEY, [
            ...readAll<ContestEntry>(CONTEST_ENTRIES_KEY),
            entry,
        ]);
        return entry;
    },

    async updateContestEntry(
        entryId: string,
        patch: Partial<ContestEntry>,
    ): Promise<ContestEntry> {
        const all = readAll<ContestEntry>(CONTEST_ENTRIES_KEY);
        const index = all.findIndex((row) => row.id === entryId);
        if (index === -1) throw new Error("応募が見つかりません");

        all[index] = { ...all[index], ...patch };
        writeAll(CONTEST_ENTRIES_KEY, all);
        return all[index];
    },

    async deleteContestEntry(entryId: string): Promise<void> {
        writeAll(
            CONTEST_ENTRIES_KEY,
            readAll<ContestEntry>(CONTEST_ENTRIES_KEY).filter(
                (row) => row.id !== entryId,
            ),
        );
    },

    async updateRoom(roomId: string, patch: Partial<WritingRoom>): Promise<WritingRoom> {
        const all = readAll<WritingRoom>(ROOMS_KEY);
        const index = all.findIndex((room) => room.id === roomId);
        if (index === -1) throw new Error(`部屋が見つかりません: ${roomId}`);

        const updated: WritingRoom = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(ROOMS_KEY, all);
        return updated;
    },

    async deleteRoom(roomId: string): Promise<void> {
        writeAll(
            ROOMS_KEY,
            readAll<WritingRoom>(ROOMS_KEY).filter((room) => room.id !== roomId),
        );
    },

    /*
     * 端末の中だけで動くときの部屋の見張り。
     *
     * ここでは部屋も自分の端末にしかないので、
     * 主が去る＝この端末で閉じる、ということ。
     * 時刻を残し、5 分たったものを畳む。
     */
    async touchRoomHost(roomId: string): Promise<void> {
        writeAll(
            ROOMS_KEY,
            readAll<WritingRoom>(ROOMS_KEY).map((room) =>
                room.id === roomId
                    ? { ...room, host_seen_at: new Date().toISOString() }
                    : room,
            ),
        );
    },

    async closeStaleRooms(): Promise<number> {
        const limit = Date.now() - 5 * 60 * 1000;
        const rooms = readAll<WritingRoom>(ROOMS_KEY);

        const alive = rooms.filter((room) => {
            if (!room.host_seen_at) return true;
            return new Date(room.host_seen_at).getTime() >= limit;
        });

        if (alive.length !== rooms.length) writeAll(ROOMS_KEY, alive);
        return rooms.length - alive.length;
    },

    /**
     * ==========================================================
     * プロフィール
     *
     * 1 件しかないが、配列で持つ。
     * バックアップの形（テーブル名 → 行の配列）を揃えるため。
     * ==========================================================
     */

    /**
     * 数え上げだけを返す。
     * 本文そのものは読まないので、作品が増えても重くならない。
     */
    async countAll(): Promise<StudioCounts> {
        const episodes = readAll<Episode>(EPISODES_KEY);
        const entries = readAll<ResourceEntry>(ENTRIES_KEY);
        const logs = readAll<WritingLog>(WRITING_LOG_KEY);

        const confirmed = entries.filter((entry) => entry.candidate_status === "none");
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;

        const written = logs.filter((log) => log.delta > 0);
        const inMonth = (key: string) =>
            written.filter((log) => log.date.slice(0, 7) === key);

        // 日ごとに合わせる。作品をまたいで同じ日に書いた分を足す
        const daily = new Map<string, number>();
        for (const log of inMonth(thisMonth)) {
            daily.set(log.date, (daily.get(log.date) ?? 0) + log.delta);
        }

        return {
            works: readAll<Work>(WORKS_KEY).length,
            episodes: episodes.length,
            doneEpisodes: episodes.filter((ep) => ep.status === "done").length,
            chars: episodes.reduce((sum, ep) => sum + ep.char_count, 0),
            entries: confirmed.length,
            entriesFromBody: confirmed.filter((entry) => entry.candidate_source).length,
            pendingEntries: entries.filter(
                (entry) => entry.candidate_status === "pending",
            ).length,
            relations: readAll<ResourceRelation>(RELATIONS_KEY).length,
            plotStages: readAll<PlotStage>(PLOT_KEY).length,
            streak: calcStreak(logs),
            monthChars: inMonth(thisMonth).reduce((sum, log) => sum + log.delta, 0),
            monthCharsPrev: inMonth(lastMonth).reduce((sum, log) => sum + log.delta, 0),
            monthDays: new Set(inMonth(thisMonth).map((log) => log.date)).size,
            monthDaysPrev: new Set(inMonth(lastMonth).map((log) => log.date)).size,
            monthDaily: Array.from(daily.entries())
                .map(([date, delta]) => ({ date, delta }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    },

    async getProfile(): Promise<Profile> {
        return readAll<Profile>(PROFILE_KEY)[0] ?? defaultProfile();
    },

    async saveProfile(patch: Partial<Omit<Profile, "id">>): Promise<Profile> {
        const current = readAll<Profile>(PROFILE_KEY)[0] ?? defaultProfile();
        const merged: Profile = { ...current, ...patch, id: "self", updated_at: now() };
        writeAll(PROFILE_KEY, [merged]);
        return merged;
    },

    /**
     * ==========================================================
     * 執筆メモ
     * ==========================================================
     */

    async listQuickMemos(): Promise<QuickMemo[]> {
        return readAll<QuickMemo>(QUICK_MEMO_KEY).sort((a, b) =>
            b.updated_at.localeCompare(a.updated_at),
        );
    },

    async createQuickMemo(input: Partial<QuickMemo> = {}): Promise<QuickMemo> {
        const all = readAll<QuickMemo>(QUICK_MEMO_KEY);
        const timestamp = now();

        const memo: QuickMemo = {
            id: createId(),
            title: input.title ?? "",
            body: input.body ?? "",
            work_id: input.work_id ?? null,
            created_at: timestamp,
            updated_at: timestamp,
        };

        writeAll(QUICK_MEMO_KEY, [...all, memo]);
        return memo;
    },

    async updateQuickMemo(memoId: string, patch: Partial<QuickMemo>): Promise<QuickMemo> {
        const all = readAll<QuickMemo>(QUICK_MEMO_KEY);
        const index = all.findIndex((memo) => memo.id === memoId);
        if (index === -1) throw new Error(`メモが見つかりません: ${memoId}`);

        const updated: QuickMemo = { ...all[index], ...patch, updated_at: now() };
        all[index] = updated;
        writeAll(QUICK_MEMO_KEY, all);
        return updated;
    },

    async deleteQuickMemo(memoId: string): Promise<void> {
        writeAll(
            QUICK_MEMO_KEY,
            readAll<QuickMemo>(QUICK_MEMO_KEY).filter((memo) => memo.id !== memoId),
        );
    },
    async listReports(): Promise<Report[]> {
        /* 新しいものを上に。古い通報から順に消化する運用ではない */
        return readAll<Report>(REPORTS_KEY).sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
        );
    },

    async createReport(input: ReportCreateInput): Promise<Report> {
        const timestamp = now();
        const report: Report = {
            id: createId(),
            target: input.target,
            reason: input.reason,
            note: input.note ?? "",
            target_id: input.target_id ?? null,
            room_id: input.room_id ?? "",
            room_name: input.room_name ?? "",
            accused_id: input.accused_id,
            accused_name: input.accused_name,
            quoted_body: input.quoted_body ?? "",
            reporter_id: input.reporter_id,
            reporter_name: input.reporter_name,
            status: "open",
            memo: "",
            created_at: timestamp,
            updated_at: timestamp,
        };
        writeAll(REPORTS_KEY, [...readAll<Report>(REPORTS_KEY), report]);
        return report;
    },

    async updateReport(reportId: string, patch: Partial<Report>): Promise<Report> {
        const rows = readAll<Report>(REPORTS_KEY);
        const index = rows.findIndex((row) => row.id === reportId);
        if (index < 0) throw new Error("その通報は見つかりませんでした");

        const next: Report = { ...rows[index], ...patch, updated_at: now() };
        rows[index] = next;
        writeAll(REPORTS_KEY, rows);
        return next;
    },
    async deleteReport(reportId: string): Promise<void> {
        writeAll(
            REPORTS_KEY,
            readAll<Report>(REPORTS_KEY).filter((row) => row.id !== reportId),
        );
    },
    /**
     * ============================================================
     * 読者からの反応
     *
     * 手元だけで動かすときは、自分ひとりしかいない。
     * それでも押した跡は残る。
     * ============================================================
     */

    async listPublicNovels(_authorId: string): Promise<Work[]> {
        const published = new Set(
            readAll<Episode>(EPISODES_KEY)
                .filter((row) => row.is_published)
                .map((row) => row.work_id),
        );

        return readAll<Work>(WORKS_KEY).filter((row) => published.has(row.id));
    },

    async listPublishedEpisodes(workId: string): Promise<Episode[]> {
        return readAll<Episode>(EPISODES_KEY)
            .filter((row) => row.work_id === workId && row.is_published)
            .sort((a, b) => a.ep_number - b.ep_number);
    },

    async getAuthorName(): Promise<string> {
        return (await this.getProfile()).display_name || "名無しの書き手";
    },

    async toggleNovelLike(workId: string): Promise<boolean> {
        return toggleRow(NOVEL_LIKES_KEY, "novel_id", workId);
    },

    async countNovelLikes(workId: string): Promise<number> {
        return countRows(NOVEL_LIKES_KEY, "novel_id", workId);
    },

    async hasNovelLiked(workId: string): Promise<boolean> {
        return countRows(NOVEL_LIKES_KEY, "novel_id", workId) > 0;
    },

    async toggleEpisodeLike(episodeId: string): Promise<boolean> {
        return toggleRow(EPISODE_LIKES_KEY, "episode_id", episodeId);
    },

    async countEpisodeLikes(episodeId: string): Promise<number> {
        return countRows(EPISODE_LIKES_KEY, "episode_id", episodeId);
    },

    async hasEpisodeLiked(episodeId: string): Promise<boolean> {
        return countRows(EPISODE_LIKES_KEY, "episode_id", episodeId) > 0;
    },

    async toggleBookmark(workId: string): Promise<boolean> {
        return toggleRow(BOOKMARKS_KEY, "novel_id", workId);
    },

    async hasBookmarked(workId: string): Promise<boolean> {
        return countRows(BOOKMARKS_KEY, "novel_id", workId) > 0;
    },

    async countBookmarks(workId: string): Promise<number> {
        return countRows(BOOKMARKS_KEY, "novel_id", workId);
    },

    async toggleFollow(authorId: string): Promise<boolean> {
        return toggleRow(FOLLOWS_KEY, "following_id", authorId);
    },

    async isFollowing(authorId: string): Promise<boolean> {
        return countRows(FOLLOWS_KEY, "following_id", authorId) > 0;
    },

    async countFollowers(authorId: string): Promise<number> {
        return countRows(FOLLOWS_KEY, "following_id", authorId);
    },

    async listNovelComments(
        workId: string,
        episodeId?: string | null,
    ): Promise<NovelComment[]> {
        return readAll<NovelComment>(NOVEL_COMMENTS_KEY)
            .filter(
                (row) =>
                    row.novel_id === workId &&
                    (episodeId
                        ? row.episode_id === episodeId
                        : row.episode_id === null),
            )
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async createNovelComment(input: {
        novel_id: string;
        episode_id?: string | null;
        body: string;
        rating?: number | null;
    }): Promise<NovelComment> {
        const created: NovelComment = {
            id: createId(),
            novel_id: input.novel_id,
            episode_id: input.episode_id ?? null,
            user_id: "local",
            body: input.body,
            is_pinned: false,
            parent_id: null,
            reply_to_id: null,
            reply_to_name: null,
            quoted_text: null,
            is_muted: false,
            rating: input.rating ?? null,
            created_at: new Date().toISOString(),
        };

        writeAll(NOVEL_COMMENTS_KEY, [
            ...readAll<NovelComment>(NOVEL_COMMENTS_KEY),
            created,
        ]);
        return created;
    },

    async deleteNovelComment(commentId: string): Promise<void> {
        writeAll(
            NOVEL_COMMENTS_KEY,
            readAll<NovelComment>(NOVEL_COMMENTS_KEY).filter(
                (row) => row.id !== commentId,
            ),
        );
    },

    async recordRead(workId: string, episodeId: string): Promise<void> {
        const rows = readAll<ReadEpisode>(READ_KEY);
        if (rows.some((row) => row.episode_id === episodeId)) return;

        writeAll(READ_KEY, [
            ...rows,
            {
                id: createId(),
                user_id: "local",
                novel_id: workId,
                episode_id: episodeId,
                created_at: new Date().toISOString(),
            },
        ]);
    },
};

/**
 * ============================================================
 * 内部ヘルパー
 * ============================================================
 */

/** 指定作品の話を ep_number 昇順で 1 から振り直す */
function renumber(rows: Episode[], workId: string): Episode[] {
    const own = rows
        .filter((ep) => ep.work_id === workId)
        .sort((a, b) => a.ep_number - b.ep_number);
    const numberById = new Map(own.map((ep, i) => [ep.id, i + 1]));

    return rows.map((ep) =>
        ep.work_id === workId ? { ...ep, ep_number: numberById.get(ep.id) ?? ep.ep_number } : ep,
    );
}

/** 話や資料を触ったら作品の updated_at も進める（一覧の並び順に効く） */
async function touchWork(workId: string): Promise<void> {
    const works = readAll<Work>(WORKS_KEY);
    const index = works.findIndex((w) => w.id === workId);
    if (index === -1) return;
    works[index] = { ...works[index], updated_at: now() };
    writeAll(WORKS_KEY, works);
}

/**
 * 押すと付き、もう一度押すと外れる。
 *
 * 手元だけで動かすときは自分ひとりなので、
 * 同じ相手の行が 1 つあるかどうかで決まる。
 */
function toggleRow(key: string, field: string, value: string): boolean {
    const rows = readAll<Record<string, unknown>>(key);
    const found = rows.find((row) => row[field] === value);

    if (found) {
        writeAll(
            key,
            rows.filter((row) => row[field] !== value),
        );
        return false;
    }

    writeAll(key, [
        ...rows,
        {
            id: createId(),
            [field]: value,
            user_id: "local",
            created_at: new Date().toISOString(),
        },
    ]);
    return true;
}

function countRows(key: string, field: string, value: string): number {
    return readAll<Record<string, unknown>>(key).filter(
        (row) => row[field] === value,
    ).length;
}
