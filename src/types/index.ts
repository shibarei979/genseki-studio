/**
 * ============================================================
 * 原石航路 Studio
 * Types Barrel Export
 * ============================================================
 */

export * from "./admin";
export * from "./contest";
export * from "./project";
export * from "./room-layout";

export type {
    AgeRating,
    AiUsage,
    CoverTile,
    Work,
    WorkFormat,
    WorkCreateInput,
    WorkUpdateInput,
    WorkWithStats,
} from "./work";
export {
    AGE_RATING_DESCRIPTION,
    AGE_RATING_LABEL,
    formatWorkState,
    GENRES,
    GENRES_SELECTABLE,
    GENRES_R18_ONLY,
    selectableGenres,
    GENRE_LEGACY_MATCH,
    GENRE_COLOR,
    genreColor,
    GENRE_SHORT,
    genreShort,
    SUGGESTED_TAGS,
    AI_USAGE_DESCRIPTION,
    AI_USAGE_LABEL,
    COVER_TILES,
    WORK_FORMAT_DESCRIPTION,
    WORK_FORMAT_LABEL,
    tileOf,
} from "./work";

export type {
    Chapter,
    Episode,
    EpisodeCreateInput,
    EpisodeIllust,
    EpisodeStatus,
    EpisodeUpdateInput,
} from "./episode";
export {
    defaultChapter,
    EPISODE_STATUS_LABEL,
    formatChapterLabel,
    formatEpisodeLabel,
    nextEpisodeStatus,
} from "./episode";

export type {
    DisplaySettings,
    LineHeightKey,
    PageMode,
    ThemeKey,
    FontKey,
    LetterSpacingKey,
    WritingMode,
} from "./display-settings";
export {
    defaultDisplaySettings,
    FONT_SIZES,
    LINE_HEIGHT_LABEL,
    LINE_HEIGHT_VALUE,
    READER_MODE_LABEL,
    LINE_HEIGHT_VALUE_VERTICAL,
    PAGE_MODE_LABEL,
    THEME_LABEL,
    FONT_DESCRIPTION,
    FONT_LABEL,
    FONT_SCALE,
    FONT_STACK,
    LETTER_SPACING_LABEL,
    LETTER_SPACING_VALUE,
    LETTER_SPACING_VALUE_VERTICAL,
    WRITING_MODE_DESCRIPTION,
    WRITING_MODE_LABEL,
} from "./display-settings";

export type { EpisodeVersion, VersionTrigger } from "./episode-version";
export { VERSION_TRIGGER_LABEL } from "./episode-version";

export type {
    NotifyTiming,
    PublishSettings,
    SerialStatus,
    Visibility,
} from "./publish-settings";
export {
    defaultPublishSettings,
    NOTIFY_TIMING_LABEL,
    SERIAL_STATUS_LABEL,
    validateSchedule,
    VISIBILITY_DESCRIPTION,
    VISIBILITY_LABEL,
} from "./publish-settings";



export type {
    CandidateStatus,
    EntryMention,
    FieldType,
    FieldValue,
    ImageStyle,
    PageKind,
    PageLayout,
    PlotScene,
    PlotStage,
    RelationChange,
    ResourceEntry,
    ResourceField,
    ResourcePage,
    ResourceRelation,
    TimelineMode,
} from "./resource";
export { TIMELINE_MODE_LABEL, TIMELINE_MODE_PLACEHOLDER } from "./resource";

export type { AiSettings, ApprovalMode } from "./ai-settings";
export {
    APPROVAL_MODE_DESCRIPTION,
    APPROVAL_MODE_LABEL,
    defaultAiSettings,
    IMAGE_QUOTA,
} from "./ai-settings";


export type { WorkPreferences, WritingLog } from "./writing-log";
export { calcStreak, defaultWorkPreferences, todayKey } from "./writing-log";

export type {
    MemberStatus,
    RoomMember,
    RoomMessage,
    RoomTheme,
    RoomVisibility,
    WritingRoom,
} from "./writing-room";
export {
    defaultRoom,
    MEMBER_STATUS_COLOR,
    MEMBER_STATUS_LABEL,
    MEMBER_TIMEOUT_MS,
    ROOM_THEME_LABEL,
    ROOM_VISIBILITY_DESCRIPTION,
    ROOM_VISIBILITY_LABEL,
    SELECTABLE_VISIBILITY,
} from "./writing-room";

export type { Profile } from "./profile";
export { daysSince, defaultProfile } from "./profile";

export type { QuickMemo } from "./quick-memo";

export type { Notice } from "./notice";
export { NOTICES } from "./notice";

export type {
    Report,
    ReportCreateInput,
    ReportReason,
    ReportStatus,
    ReportTarget,
} from "./report";
export {
    REPORT_REASON_LABEL,
    REPORT_STATUS_LABEL,
    REPORT_TARGET_LABEL,
} from "./report";



export type {
    Bookmark,
    Discover,
    EpisodeLike,
    Follow,
    Novel,
    NovelComment,
    NovelCounts,
    NovelLike,
    ReadEpisode,
    Series,
    SeriesNovel,
} from "./social";
