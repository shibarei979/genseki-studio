/**
 * ============================================================
 * 原石航路 Studio
 * Repository Interface
 *
 * データの保存先を抽象化する層。
 * v1 は localStorage 実装だけを使い、
 * v2 で Supabase 実装に差し替える。
 *
 * 【重要】
 * 画面・フックからは必ずこのインターフェース経由で読み書きすること。
 * localStorage を直接触るコードを画面側に書くと、
 * Supabase 移行時に全画面を書き直すことになる。
 *
 * すべて Promise を返す（同期実装でも）。
 * 非同期前提にしておけば、実装差し替え時に呼び出し側が無変更で済むため。
 * ============================================================
 */

import type { BackupFile, BackupSummary } from "@/lib/backup/format";
import type {
    AdminBanner,
    NovelComment,
    AdminNotice,
    AdminUser,
    Chapter,
    Contest,
    ContestEntry,
    FeatureFlag,
    NgWord,
    Report,
    ReportCreateInput,
    RoomLayout,
} from "@/types";

/** マイページに出す数え上げ */
export interface StudioCounts {
    works: number;
    episodes: number;
    doneEpisodes: number;
    chars: number;
    entries: number;
    entriesFromBody: number;
    pendingEntries: number;
    relations: number;
    plotStages: number;
    streak: number;
    /** 今月と先月の書いた文字数・日数 */
    monthChars: number;
    monthCharsPrev: number;
    monthDays: number;
    monthDaysPrev: number;
    /** 今月の日ごとの文字数。カレンダー用 */
    monthDaily: { date: string; delta: number }[];
}
import type {
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

export interface Repository {
    /**
     * ==========================================================
     * Works（作品）
     * ==========================================================
     */

    /** 更新日時の新しい順で全作品を返す */
    listWorks(): Promise<WorkWithStats[]>;

    getWork(workId: string): Promise<Work | null>;

    createWork(input: WorkCreateInput): Promise<Work>;

    updateWork(workId: string, patch: WorkUpdateInput): Promise<Work>;

    /** 作品と、それに属する話をまとめて削除する */
    deleteWork(workId: string): Promise<void>;

    /**
     * ==========================================================
     * Episodes（話）
     * ==========================================================
     */

    /** ep_number の昇順で返す */
    listEpisodes(workId: string): Promise<Episode[]>;

    getEpisode(episodeId: string): Promise<Episode | null>;

    /** 末尾に追加する。ep_number は自動採番 */
    createEpisode(workId: string, input?: EpisodeCreateInput): Promise<Episode>;

    updateEpisode(episodeId: string, patch: EpisodeUpdateInput): Promise<Episode>;

    /** 削除後、残りの ep_number を 1 から振り直す */
    deleteEpisode(episodeId: string): Promise<void>;

    /** orderedIds の並び順で ep_number を 1 から振り直す */
    reorderEpisodes(workId: string, orderedIds: string[]): Promise<void>;

    /**
     * 章。話をまとめる入れ物。
     * 章を作らずに書き始められるので、無い作品もある。
     */
    listChapters(workId: string): Promise<Chapter[]>;
    createChapter(workId: string, title?: string): Promise<Chapter>;
    updateChapter(chapterId: string, patch: Partial<Chapter>): Promise<Chapter>;
    deleteChapter(chapterId: string): Promise<void>;
    reorderChapters(workId: string, orderedIds: string[]): Promise<void>;

    /** 一括取り込み。末尾にまとめて追加する */
    createEpisodes(
        workId: string,
        items: { title: string; body: string }[],
    ): Promise<Episode[]>;

    /**
     * ==========================================================
     * DisplaySettings（表示設定）
     * ==========================================================
     */

    /** 未保存なら既定値を返す */
    getDisplaySettings(workId: string): Promise<DisplaySettings>;

    saveDisplaySettings(
        workId: string,
        patch: Partial<Omit<DisplaySettings, "work_id">>,
    ): Promise<DisplaySettings>;

    /**
     * ==========================================================
     * EpisodeVersion（バージョン履歴）
     * ==========================================================
     */

    /** 新しい順に返す */
    listVersions(episodeId: string): Promise<EpisodeVersion[]>;

    /**
     * 現在の本文を控える。
     * 直前の版と本文が同じなら何もせず null を返す。
     */
    createVersion(
        episodeId: string,
        trigger: "auto" | "manual" | "restore",
    ): Promise<EpisodeVersion | null>;

    /** 指定の版の本文を話へ書き戻す。書き戻す前の状態も控える */
    restoreVersion(versionId: string): Promise<Episode>;

    /**
     * ==========================================================
     * PublishSettings（公開設定）
     * ==========================================================
     */

    getPublishSettings(workId: string): Promise<PublishSettings>;

    savePublishSettings(
        workId: string,
        patch: Partial<Omit<PublishSettings, "work_id">>,
    ): Promise<PublishSettings>;

    /**
     * ==========================================================
     * ResourcePage（資料ページ）
     * ==========================================================
     */

    /** sort_order の昇順。無ければ常設ページを作ってから返す */
    listPages(workId: string): Promise<ResourcePage[]>;

    /** テンプレートに沿って常設＋指定ページを用意する */
    setupPages(workId: string, extraPageKeys: string[]): Promise<ResourcePage[]>;

    /** 組み込みページを足す */
    addBuiltinPage(workId: string, builtinKey: string): Promise<ResourcePage>;

    /** 自作の資料ページを作る */
    createCustomPage(
        workId: string,
        input: Pick<ResourcePage, "label" | "description" | "fields">,
    ): Promise<ResourcePage>;

    updatePage(pageId: string, patch: Partial<ResourcePage>): Promise<ResourcePage>;

    /** 常設ページは消せない。項目もまとめて消える */
    deletePage(pageId: string): Promise<void>;

    /**
     * ==========================================================
     * ResourceEntry（資料の項目）
     * ==========================================================
     */

    listEntries(workId: string, pageId?: string): Promise<ResourceEntry[]>;

    createEntry(
        workId: string,
        pageId: string,
        input?: Partial<ResourceEntry>,
    ): Promise<ResourceEntry>;

    updateEntry(entryId: string, patch: Partial<ResourceEntry>): Promise<ResourceEntry>;

    deleteEntry(entryId: string): Promise<void>;

    /**
     * 2 つの項目を 1 つにまとめる。
     * 消えるほうの名前と別名は残るほうの別名に移し、
     * 関係と本文リンクの向き先も付け替える。
     */
    mergeEntries(keepId: string, mergeId: string): Promise<ResourceEntry>;

    /**
     * ==========================================================
     * ResourceRelation（関係）
     * ==========================================================
     */

    listRelations(workId: string): Promise<ResourceRelation[]>;

    createRelation(
        workId: string,
        input: Pick<ResourceRelation, "from_entry_id" | "to_entry_id" | "label">,
    ): Promise<ResourceRelation>;

    updateRelation(
        relationId: string,
        patch: Partial<ResourceRelation>,
    ): Promise<ResourceRelation>;

    deleteRelation(relationId: string): Promise<void>;

    /**
     * ==========================================================
     * PlotStage（プロット・構成）
     * ==========================================================
     */

    listPlotStages(workId: string): Promise<PlotStage[]>;

    createPlotStage(workId: string): Promise<PlotStage>;

    updatePlotStage(stageId: string, patch: Partial<PlotStage>): Promise<PlotStage>;

    deletePlotStage(stageId: string): Promise<void>;

    reorderPlotStages(workId: string, orderedIds: string[]): Promise<void>;

    listPlotScenes(workId: string): Promise<PlotScene[]>;

    createPlotScene(workId: string, stageId: string): Promise<PlotScene>;

    updatePlotScene(sceneId: string, patch: Partial<PlotScene>): Promise<PlotScene>;

    deletePlotScene(sceneId: string): Promise<void>;

    /**
     * ==========================================================
     * EntryMention（本文からのリンク）
     * ==========================================================
     */

    listMentions(workId: string, episodeId?: string): Promise<EntryMention[]>;

    createMention(
        workId: string,
        episodeId: string,
        entryId: string,
        surface: string,
    ): Promise<EntryMention>;

    deleteMention(mentionId: string): Promise<void>;

    /**
     * ==========================================================
     * AiSettings（AI補助設定）
     * ==========================================================
     */

    getAiSettings(workId: string): Promise<AiSettings>;

    saveAiSettings(
        workId: string,
        patch: Partial<Omit<AiSettings, "work_id">>,
    ): Promise<AiSettings>;

    /**
     * ==========================================================
     * バックアップ
     * ==========================================================
     */

    /** 保存されているすべてのデータを取り出す */
    exportAll(): Promise<BackupFile>;

    /**
     * バックアップから戻す。
     * replace … いまのデータを消してから入れる
     * merge   … いまのデータを残し、無いものだけ足す
     */
    importAll(backup: BackupFile, mode: "replace" | "merge"): Promise<BackupSummary>;

    /**
     * ==========================================================
     * 執筆の記録
     * ==========================================================
     */

    getPreferences(workId: string): Promise<WorkPreferences>;

    savePreferences(
        workId: string,
        patch: Partial<Omit<WorkPreferences, "work_id">>,
    ): Promise<WorkPreferences>;

    /** 古い順 */
    listWritingLogs(workId: string): Promise<WritingLog[]>;

    /** その日の総文字数を書き込む。記録が切られていれば何もしない */
    recordProgress(workId: string, totalChars: number): Promise<void>;

    /**
     * ==========================================================
     * 執筆室
     * ==========================================================
     */

    /** 自分が立てた部屋。公式の部屋は別に用意されている */
    listRooms(): Promise<WritingRoom[]>;

    getRoom(roomId: string): Promise<WritingRoom | null>;

    createRoom(input: Partial<WritingRoom>): Promise<WritingRoom>;

    updateRoom(roomId: string, patch: Partial<WritingRoom>): Promise<WritingRoom>;

    /**
     * 部屋の模様の控え。
     * 一度作った間取りを取っておき、次の部屋で使い回す。
     */

    /**
     * ==========================================================
     * コンテスト
     *
     * 運営が立てて、書き手が作品を出す。
     * ==========================================================
     */
    listContests(): Promise<Contest[]>;
    getContest(contestId: string): Promise<Contest | null>;
    createContest(): Promise<Contest>;
    updateContest(contestId: string, patch: Partial<Contest>): Promise<Contest>;
    deleteContest(contestId: string): Promise<void>;

    /**
     * ==========================================================
     * 運営が扱うもの
     *
     * お知らせ・バナー・使わない言葉・機能の入切。
     * ==========================================================
     */
    /**
     * 利用者。運営だけが使える。
     * ログインしていないときは空の配列を返す。
     */
    listUsers(): Promise<AdminUser[]>;
    updateUser(userId: string, patch: Partial<AdminUser>): Promise<AdminUser>;

    listNotices(): Promise<AdminNotice[]>;
    createNotice(): Promise<AdminNotice>;
    updateNotice(noticeId: string, patch: Partial<AdminNotice>): Promise<AdminNotice>;
    deleteNotice(noticeId: string): Promise<void>;

    listBanners(): Promise<AdminBanner[]>;
    createBanner(): Promise<AdminBanner>;
    updateBanner(bannerId: string, patch: Partial<AdminBanner>): Promise<AdminBanner>;
    deleteBanner(bannerId: string): Promise<void>;

    listNgWords(): Promise<NgWord[]>;
    createNgWord(word: string): Promise<NgWord>;
    updateNgWord(wordId: string, patch: Partial<NgWord>): Promise<NgWord>;
    deleteNgWord(wordId: string): Promise<void>;

    listFeatureFlags(): Promise<FeatureFlag[]>;
    updateFeatureFlag(key: string, status: FeatureFlag["status"]): Promise<FeatureFlag>;

    listContestEntries(contestId: string): Promise<ContestEntry[]>;
    /**
     * 自分の応募だけ。
     * 応募の画面は取り消しの押し具を並べるので、
     * 全員分を渡すと他人の応募に押し具が付く。
     */
    listMyContestEntries(contestId: string): Promise<ContestEntry[]>;
    createContestEntry(
        contestId: string,
        input: Omit<ContestEntry, "id" | "contest_id" | "entered_at">,
    ): Promise<ContestEntry>;
    updateContestEntry(
        entryId: string,
        patch: Partial<ContestEntry>,
    ): Promise<ContestEntry>;
    deleteContestEntry(entryId: string): Promise<void>;

    deleteRoom(roomId: string): Promise<void>;
    /** 部屋にいることを知らせる。主が去ったのを測るため */
    touchRoomHost(roomId: string): Promise<void>;
    /** 主が去って 5 分たった部屋を畳む。畳んだ数を返す */
    closeStaleRooms(): Promise<number>;

    /**
     * ==========================================================
     * プロフィール
     * ==========================================================
     */

    getProfile(): Promise<Profile>;
    saveProfile(patch: Partial<Omit<Profile, "id">>): Promise<Profile>;

    /** 数え上げ。管理画面で使う */
    countAll(): Promise<StudioCounts>;

    /**
     * ==========================================================
     * 走り書き
     * ==========================================================
     */

    listQuickMemos(): Promise<QuickMemo[]>;
    createQuickMemo(input?: Partial<QuickMemo>): Promise<QuickMemo>;
    updateQuickMemo(memoId: string, patch: Partial<QuickMemo>): Promise<QuickMemo>;
    deleteQuickMemo(memoId: string): Promise<void>;

    /**
     * ==========================================================
     * 通報
     * ==========================================================
     */

    listReports(): Promise<Report[]>;
    createReport(input: ReportCreateInput): Promise<Report>;
    updateReport(reportId: string, patch: Partial<Report>): Promise<Report>;
    deleteReport(reportId: string): Promise<void>;

    /**
     * ==========================================================
     * 読者からの反応
     *
     * 列の名前は、すでに動いている表に合わせてある。
     * 執筆室で同じ部屋にいる人の作品を読むために使う。
     * ==========================================================
     */

    /** その人が公開している作品 */
    listPublicNovels(authorId: string): Promise<Work[]>;
    /** 投稿済みの話だけ */
    listPublishedEpisodes(workId: string): Promise<Episode[]>;
    /** 書き手の名前 */
    getAuthorName(authorId: string): Promise<string>;

    /** 作品への好き */
    toggleNovelLike(workId: string): Promise<boolean>;
    countNovelLikes(workId: string): Promise<number>;
    hasNovelLiked(workId: string): Promise<boolean>;

    /** 話への好き */
    toggleEpisodeLike(episodeId: string): Promise<boolean>;
    countEpisodeLikes(episodeId: string): Promise<number>;
    hasEpisodeLiked(episodeId: string): Promise<boolean>;

    /** 保存 */
    toggleBookmark(workId: string): Promise<boolean>;
    hasBookmarked(workId: string): Promise<boolean>;
    countBookmarks(workId: string): Promise<number>;

    /** フォロー */
    toggleFollow(authorId: string): Promise<boolean>;
    isFollowing(authorId: string): Promise<boolean>;
    countFollowers(authorId: string): Promise<number>;

    /** コメント。episode_id が空なら作品へのもの */
    listNovelComments(
        workId: string,
        episodeId?: string | null,
    ): Promise<NovelComment[]>;
    createNovelComment(input: {
        novel_id: string;
        episode_id?: string | null;
        body: string;
        rating?: number | null;
    }): Promise<NovelComment>;
    deleteNovelComment(commentId: string): Promise<void>;

    /** 読んだ話を控える */
    recordRead(workId: string, episodeId: string): Promise<void>;
}
