/**
 * ============================================================
 * 原石航路 Studio
 * Supabase 版の保存先
 *
 * localStorage 版と同じ形（Repository）で作ってある。
 * 画面はどちらが動いているかを知らない。
 *
 * 名前の対応:
 *   works    → novels
 *   work_id  → novel_id
 * GENSEKIKORO（投稿サイト）と同じテーブルを使うので、
 * ここで書いた原稿がそのまま投稿できる。
 * ============================================================
 */

import type { BackupFile, BackupSummary } from "@/lib/backup/format";
import type { Repository, StudioCounts } from "@/lib/repository/types";
import { createClient } from "@/lib/supabase/client";
import { defaultContest } from "@/types";
import type {
    AiSettings,
    NovelComment,
    Report,
    ReportCreateInput,
    RoomLayout,
    PlacedFurniture,
    RoomDoor,
    AdminBanner,
    AdminNotice,
    AdminUser,
    Chapter,
    Contest,
    ContestEntry,
    DisplaySettings,
    Episode,
    EpisodeVersion,
    FeatureFlag,
    NgWord,
    Project,
    ProjectInput,
    PlotScene,
    PlotStage,
    Profile,
    PublishSettings,
    ResourceEntry,
    ResourcePage,
    ResourceRelation,
    Work,
    WorkPreferences,
    WorkWithStats,
    WritingLog,
    WritingRoom,
} from "@/types";
import {
    calcStreak,
    emptyLayout,
    defaultAiSettings,
    defaultDisplaySettings,
    defaultFeatureFlags,
    defaultProfile,
    defaultPublishSettings,
    defaultRoom,
    defaultWorkPreferences,
} from "@/types";

/**
 * ============================================================
 * 下ごしらえ
 * ============================================================
 */

function db() {
    return createClient();
}

/**
 * Supabase の返事を、何をすればよいか分かる言い方にする。
 *
 * 英語のまま出すと、
 * 「壊れた」のか「用意が足りない」のか判断できない。
 */
function describeError(message: string): string {
    if (message.includes("schema cache")) {
        /*
         * 何が足りないのかを、元の文言から拾う。
         * 拾えなかったときは、元の文言をそのまま添える。
         * 「列がありません」とだけ言われても、どこを直せばよいか分からない。
         */
        const table = message.match(/table '([^']+)'/)?.[1];
        const column = message.match(/'([^']+)' column/)?.[1];

        const what = table
            ? `テーブル ${table}`
            : column
              ? `列 ${column}`
              : message;

        return (
            `${what} がまだ用意されていません。\n` +
            "Supabase の SQL Editor で supabase/migrations/002_studio_schema.sql を実行してください。\n" +
            `（元の文言: ${message}）`
        );
    }
    if (message.includes("permission denied")) {
        const table = message.match(/for table ([a-z_]+)/)?.[1] ?? "テーブル";
        return (
            `${table} に触れる権限がありません。\n` +
            "Supabase の SQL Editor で次を流してください。\n" +
            "grant all on all tables in schema public to anon, authenticated;"
        );
    }
    if (message.includes("violates row-level security")) {
        return (
            "この行を書き換える権限がありません。\n" +
            "ログインし直すか、自分のものかどうか確かめてください。"
        );
    }
    if (message.includes("duplicate key")) {
        return "同じものがすでにあります。";
    }
    return message;
}

/** 何も無いときの数え上げ */
function emptyCounts(): StudioCounts {
    return {
        works: 0, episodes: 0, doneEpisodes: 0, chars: 0,
        entries: 0, entriesFromBody: 0, pendingEntries: 0,
        relations: 0, plotStages: 0, streak: 0,
        monthChars: 0, monthCharsPrev: 0, monthDays: 0,
        monthDaysPrev: 0, monthDaily: [],
    };
}

/**
 * いま入っている人。ログインしていなければ null。
 *
 * 読むときはこちらを使う。
 * ログイン前でも画面は開くので、そこで投げると全部が落ちる。
 */
async function currentUser(): Promise<string | null> {
    const { data } = await db().auth.getUser();
    return data.user?.id ?? null;
}

/**
 * 書くときはこちら。ログインしていなければ投げる。
 *
 * 投げるのは、黙って失敗するより気づけるため。
 * 画面側は AuthGate で先に止めるので、ここまで来ることは少ない。
 */
async function requireUser(): Promise<string> {
    const userId = await currentUser();
    if (!userId) throw new Error("ログインが必要です");
    return userId;
}

/**
 * 返ってきた行をそのまま使う。
 * 列名が同じものは、この関数を通すだけで型が合う。
 */
/**
 * announcements から来たお知らせに付ける印。
 *
 * 2 つの表が混ざるので、id だけでは
 * どちらへ書き戻せばよいか分からない。
 */
const ANNOUNCE_PREFIX = "an:";

function rows<T>(data: unknown): T[] {
    return Array.isArray(data) ? (data as T[]) : [];
}

/** works ↔ novels の名前を合わせる */
function toWork(row: Record<string, unknown>): Work {
    return {
        id: row.id as string,
        title: (row.title as string) ?? "",
        catchphrase: (row.catchphrase as string) ?? "",
        summary: (row.summary as string) ?? "",
        genre: (row.genre as string) ?? "",
        tags: (row.tags as string[]) ?? [],
        keywords: (row.keywords as string[]) ?? [],
        age_rating: (row.age_rating as Work["age_rating"]) ?? "all",
        author_note: (row.author_note as string) ?? "",
        cover_url: (row.cover_url as string | null) ?? null,
        cover_tile: (row.cover_tile as Work["cover_tile"]) ?? null,
        /*
         * 作品の形。
         * format が空でも、投稿サイト側の novel_type があれば
         * そちらから読む。以前に向こうで作った作品のため。
         */
        format:
            (row.format as Work["format"]) ??
            (row.novel_type === "短編"
                ? "short"
                : row.novel_type === "長編"
                  ? "long"
                  : null),
        ai_usage: (row.ai_usage as Work["ai_usage"]) ?? "none",
        deleted_at: (row.deleted_at as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

function toEpisode(row: Record<string, unknown>): Episode {
    return {
        id: row.id as string,
        work_id: row.novel_id as string,
        title: (row.title as string) ?? "",
        body: (row.body as string) ?? "",
        status: (row.draft_status as Episode["status"]) ?? "todo",
        char_count: (row.char_count as number) ?? 0,
        ep_number: (row.ep_number as number) ?? 1,
        scanned_length: (row.scanned_length as number) ?? 0,
        chapter_id: (row.chapter_id as string | null) ?? null,
        is_published: row.is_published === true,
        publish_at: (row.publish_at as string | null) ?? null,
        preface: (row.preface as string | null) ?? null,
        episode_summary: (row.episode_summary as string | null) ?? null,
        afterword: (row.afterword as string | null) ?? null,
        deleted_at: (row.deleted_at as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
    };
}

function toVersion(row: Record<string, unknown>): EpisodeVersion {
    return {
        id: row.id as string,
        episode_id: row.episode_id as string,
        work_id: row.novel_id as string,
        body: (row.body as string) ?? "",
        char_count: (row.char_count as number) ?? 0,
        trigger: row.trigger as EpisodeVersion["trigger"],
        label: (row.label as string) ?? "",
        created_at: row.created_at as string,
    };
}

function toPage(row: Record<string, unknown>): ResourcePage {
    return {
        id: row.id as string,
        work_id: row.novel_id as string,
        builtin_key: (row.builtin_key as string | null) ?? null,
        label: (row.label as string) ?? "",
        description: (row.description as string) ?? "",
        kind: (row.kind as ResourcePage["kind"]) ?? "entries",
        fields: (row.fields as ResourcePage["fields"]) ?? [],
        is_pinned: (row.is_pinned as boolean) ?? false,
        sort_order: (row.sort_order as number) ?? 0,
        layout: (row.layout as ResourcePage["layout"]) ?? "list",
        image_style: (row.image_style as ResourcePage["image_style"]) ?? null,
        timeline_mode:
            (row.timeline_mode as ResourcePage["timeline_mode"]) ?? "story",
        created_at: row.created_at as string,
        updated_at: (row.updated_at as string) ?? (row.created_at as string),
    };
}

/**
 * 執筆室。
 *
 * layout は jsonb で、既定値が {} になっている。
 * そのまま渡すと furniture が undefined になり、
 * 家具を数えようとして落ちる。
 */
function toRoom(row: Record<string, unknown>): WritingRoom {
    const layout =
        typeof row.layout === "object" && row.layout !== null
            ? (row.layout as Record<string, unknown>)
            : {};

    const surface =
        typeof layout.surface === "object" && layout.surface !== null
            ? (layout.surface as Record<string, unknown>)
            : {};

    const base = emptyLayout();

    return {
        ...(row as unknown as WritingRoom),
        speakers: Array.isArray(row.speakers) ? (row.speakers as string[]) : [],
        banned: Array.isArray(row.banned) ? (row.banned as string[]) : [],
        layout: {
            surface: {
                floor:
                    typeof surface.floor === "string"
                        ? surface.floor
                        : base.surface.floor,
                wall:
                    typeof surface.wall === "string"
                        ? surface.wall
                        : base.surface.wall,
            },
            furniture: Array.isArray(layout.furniture)
                ? (layout.furniture as PlacedFurniture[])
                : [],
            door:
                typeof layout.door === "object" && layout.door !== null
                    ? (layout.door as RoomDoor)
                    : base.door,
        },
    };
}

/**
 * コンテスト。
 * 並びの項目と日付が欠けていると画面が落ちるので、ここで埋める。
 */
function toContest(row: Record<string, unknown>): Contest {
    const today = new Date().toISOString().slice(0, 10);

    /**
     * 日どりを、欄に渡せる形にする。
     *
     * 10 文字で切ると時刻が落ちる。
     * 決めた「20:00」が消えて、いつまでも変わらないように見える。
     *
     * Supabase から返るのは
     *   2026-08-20T20:00:00+00:00
     * の形。欄が受け取るのは
     *   2026-08-20T20:00
     * なので、そこまでで切る。
     */
    const asDate = (value: unknown) => {
        if (typeof value !== "string" || value.length < 10) return today;

        /* 時刻を持っていなければ、日にちのまま */
        if (!value.includes("T")) return value.slice(0, 10);

        /* 送られてきた時刻を、その土地の時刻に直す */
        const at = new Date(value);
        if (Number.isNaN(at.getTime())) return value.slice(0, 10);

        const pad = (n: number) => String(n).padStart(2, "0");
        return (
            `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
            `T${pad(at.getHours())}:${pad(at.getMinutes())}`
        );
    };

    return {
        ...(row as unknown as Contest),
        starts_at: asDate(row.starts_at),
        ends_at: asDate(row.ends_at),
        result_at: asDate(row.result_at),
        prizes: Array.isArray(row.prizes) ? (row.prizes as Contest["prizes"]) : [],
        checkpoints: Array.isArray(row.checkpoints)
            ? (row.checkpoints as Contest["checkpoints"])
            : [],
        steps: Array.isArray(row.steps) ? (row.steps as string[]) : [],
        notices: Array.isArray(row.notices) ? (row.notices as string[]) : [],
        genres: Array.isArray(row.genres) ? (row.genres as string[]) : [],
    };
}

/**
 * ============================================================
 * 本体
 * ============================================================
 */

export const supabaseRepository: Repository = {
    /**
     * ==========================================================
     * プロフィール
     * ==========================================================
     */

    async getProfile(): Promise<Profile> {
        const userId = await currentUser();
        // ログイン前は既定のプロフィールを返す。画面は開ける
        if (!userId) return defaultProfile();
        const { data } = await db()
            .from("profiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (!data) {
            /*
             * まだ行が無いときは作る。
             *
             * 本来は登録した瞬間に作られる（auth.users の引き金）。
             * ここは、その引き金を入れる前に登録した人のための保険。
             */
            const { data: auth } = await db().auth.getUser();
            const fresh = defaultProfile();

            await db()
                .from("profiles")
                .insert({
                    user_id: userId,
                    display_name: fresh.display_name,
                    email: auth.user?.email ?? "",
                    login_provider: "email",
                    bio: fresh.bio,
                });
            return fresh;
        }

        return {
            // 型としては常に "self"。誰のものかは接続先が持っている
            id: "self",
            display_name: (data.display_name as string) ?? "名無しの書き手",
            name_reading: (data.name_reading as string) ?? "",
            bio: (data.bio as string) ?? "",
            avatar_hue: (data.avatar_hue as number) ?? 120,
            x_account: (data.x_account as string) ?? "",
            home_mode: (data.home_mode as string | null) ?? null,
            /*
             * 作品を押したときの見せ方。
             *
             * 返し忘れていたので、設定を変えても
             * いつも札のままになっていた。
             */
            work_popup_style:
                (data.work_popup_style as "card" | "book" | null) ?? null,
            website: (data.website as string) ?? "",
            claimed_missions: (data.claimed_missions as string[]) ?? [],
            started_at: (data.created_at as string) ?? new Date().toISOString(),
            updated_at: (data.updated_at as string) ?? new Date().toISOString(),
        };
    },

    async saveProfile(patch: Partial<Omit<Profile, "id">>): Promise<Profile> {
        const userId = await requireUser();
        await db().from("profiles").update(patch).eq("user_id", userId);
        return this.getProfile();
    },

    async countAll(): Promise<StudioCounts> {
        const userId = await currentUser();
        if (!userId) return emptyCounts();

        const { data: novels, error } = await db()
            .from("novels")
            .select("id")
            .eq("author_id", userId);

        if (error) throw new Error(describeError(error.message));
        const novelIds = rows<{ id: string }>(novels).map((row) => row.id);

        if (novelIds.length === 0) return emptyCounts();

        const [episodes, entries, relations, stages, logs] = await Promise.all([
            db().from("episodes").select("draft_status, char_count").in("novel_id", novelIds),
            db().from("resource_entries").select("candidate_status, candidate_source").in("novel_id", novelIds),
            db().from("resource_relations").select("id").in("novel_id", novelIds),
            db().from("plot_stages").select("id").in("novel_id", novelIds),
            db().from("writing_logs").select("log_date, delta").in("novel_id", novelIds),
        ]);

        const episodeRows = rows<{ draft_status: string; char_count: number }>(episodes.data);
        const entryRows = rows<{ candidate_status: string; candidate_source: string | null }>(entries.data);
        const logRows = rows<{ log_date: string; delta: number }>(logs.data);

        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;

        const written = logRows.filter((row) => row.delta > 0);
        const inMonth = (key: string) => written.filter((row) => row.log_date.slice(0, 7) === key);

        const daily = new Map<string, number>();
        for (const row of inMonth(thisMonth)) {
            daily.set(row.log_date, (daily.get(row.log_date) ?? 0) + row.delta);
        }

        const confirmed = entryRows.filter((row) => row.candidate_status === "none");

        return {
            works: novelIds.length,
            episodes: episodeRows.length,
            doneEpisodes: episodeRows.filter((row) => row.draft_status === "done").length,
            chars: episodeRows.reduce((sum, row) => sum + (row.char_count ?? 0), 0),
            entries: confirmed.length,
            entriesFromBody: confirmed.filter((row) => row.candidate_source).length,
            pendingEntries: entryRows.filter((row) => row.candidate_status === "pending").length,
            relations: rows(relations.data).length,
            plotStages: rows(stages.data).length,
            streak: calcStreak(
                logRows.map((row) => ({
                    work_id: "",
                    date: row.log_date,
                    total_chars: 0,
                    delta: row.delta,
                })) as WritingLog[],
            ),
            monthChars: inMonth(thisMonth).reduce((sum, row) => sum + row.delta, 0),
            monthCharsPrev: inMonth(lastMonth).reduce((sum, row) => sum + row.delta, 0),
            monthDays: new Set(inMonth(thisMonth).map((row) => row.log_date)).size,
            monthDaysPrev: new Set(inMonth(lastMonth).map((row) => row.log_date)).size,
            monthDaily: Array.from(daily.entries())
                .map(([date, delta]) => ({ date, delta }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    },

    /**
     * ==========================================================
     * 作品
     * ==========================================================
     */

    async listWorks(): Promise<WorkWithStats[]> {
        const userId = await currentUser();
        if (!userId) return [];

        const { data, error } = await db()
            .from("novels")
            .select("*")
            .eq("author_id", userId)
            // ゴミ箱に入ったものは出さない
            .is("deleted_at", null)
            .order("updated_at", { ascending: false });

        /*
         * 読めなかったら投げる。
         *
         * 黙って空を返していたので、
         * 「作品が無い」のか「読めていない」のか分からなかった。
         * 用意が足りないときは、そう言うべき。
         */
        if (error) throw new Error(describeError(error.message));

        const works = rows<Record<string, unknown>>(data);
        if (works.length === 0) return [];

        /*
         * 話は別に読む。
         *
         * 一緒に引くと、繋がりが 2 本あるときに
         * どちらを辿ればよいか決められず落ちる。
         */
        const { data: episodeRows } = await db()
            .from("episodes")
            .select("novel_id, char_count, draft_status")
            .in(
                "novel_id",
                works.map((row) => row.id as string),
            )
            .is("deleted_at", null);

        const byWork = new Map<string, { char_count: number }[]>();
        for (const row of rows<{ novel_id: string; char_count: number }>(episodeRows)) {
            byWork.set(row.novel_id, [...(byWork.get(row.novel_id) ?? []), row]);
        }

        return works.map((row) => {
            const episodes = byWork.get(row.id as string) ?? [];

            return {
                ...toWork(row),
                episode_count: episodes.length,
                total_char_count: episodes.reduce(
                    (sum, ep) => sum + (ep.char_count ?? 0),
                    0,
                ),
                visibility: (row.visibility as WorkWithStats["visibility"]) ?? "draft",
                serial_status:
                    (row.serial_status as WorkWithStats["serial_status"]) ?? "ongoing",
                state_label: row.published ? "公開中" : "下書き",
            };
        });
    },

    async getWork(workId: string): Promise<Work | null> {
        const { data } = await db()
            .from("novels")
            .select("*")
            .eq("id", workId)
            .maybeSingle();
        return data ? toWork(data) : null;
    },

    async createWork(input: Partial<Work>): Promise<Work> {
        const userId = await requireUser();

        const { data, error } = await db()
            .from("novels")
            .insert({
                author_id: userId,
                title: input.title ?? "",
                summary: input.summary ?? "",
                genre: input.genre ?? "",
                tags: input.tags ?? [],
                keywords: input.keywords ?? [],
                catchphrase: input.catchphrase ?? "",
                age_rating: input.age_rating ?? "all",
                author_note: input.author_note ?? "",

                /*
                 * 作品の形。
                 *
                 * 送らずにいると、表の既定（長編・連載中）が入る。
                 * そのため短編のつもりで書いた作品まで
                 * すべて「長編」になっていた。
                 *
                 * 新しく作る時点では話が 1 つも無いので、
                 * ここでは短編として始める。
                 * 話が増えれば長編に変わる（下の見直しで）。
                 */
                novel_type: "短編",
                is_serial: true,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toWork(data);
    },

    async updateWork(workId: string, patch: Partial<Work>): Promise<Work> {
        /*
         * 作品の形を、投稿サイト側の名前にも写す。
         *
         * こちらは format（"long" / "short"）で持ち、
         * 投稿サイト側は novel_type（「長編」/「短編」）で持っている。
         * 繋いでいなかったので、基本情報で選んでも
         * 表には既定の「長編」が入ったままだった。
         *
         * format を送っていないときは、novel_type も触らない。
         * 触ると、他の項目を直しただけで形が書き換わる。
         */
        const next: Record<string, unknown> = { ...patch };

        if (patch.format === "short") next.novel_type = "短編";
        if (patch.format === "long") next.novel_type = "長編";

        const { data, error } = await db()
            .from("novels")
            .update(next)
            .eq("id", workId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toWork(data);
    },

    async deleteWork(workId: string): Promise<void> {
        // 話や資料は、外部キーの on delete cascade で一緒に消える
        await db().from("novels").delete().eq("id", workId);
    },

    /**
     * ==========================================================
     * 話
     * ==========================================================
     */

    async listEpisodes(workId: string): Promise<Episode[]> {
        /*
         * 分けて読む。
         *
         * 一度に読むと、返ってくる行数の上限（既定 1000）に当たり、
         * 2,200 話ある作品でも 1,000 話しか出てこない。
         * 端から順に、届かなくなるまで読む。
         */
        const PAGE = 500;
        const all: Record<string, unknown>[] = [];

        for (let from = 0; ; from += PAGE) {
            const { data } = await db()
                .from("episodes")
                .select("*")
                .eq("novel_id", workId)
                .is("deleted_at", null)
                /*
                 * 話も、並ぶ順を一つに決める。
                 * ep_number が同じものがあっても入れ替わらないように。
                 */
                .order("ep_number")
                .order("created_at")
                .order("id")
                .range(from, from + PAGE - 1);

            const part = rows<Record<string, unknown>>(data);
            all.push(...part);

            if (part.length < PAGE) break;
        }

        return all.map(toEpisode);
    },

    async getEpisode(episodeId: string): Promise<Episode | null> {
        const { data } = await db()
            .from("episodes")
            .select("*")
            .eq("id", episodeId)
            .maybeSingle();
        return data ? toEpisode(data) : null;
    },

    async createEpisode(workId: string): Promise<Episode> {
        const { data: last } = await db()
            .from("episodes")
            .select("ep_number")
            .eq("novel_id", workId)
            .order("ep_number", { ascending: false })
            .limit(1)
            .maybeSingle();

        const next = ((last?.ep_number as number) ?? 0) + 1;

        const { data, error } = await db()
            .from("episodes")
            .insert({ novel_id: workId, title: "", body: "", ep_number: next })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toEpisode(data);
    },

    async updateEpisode(
        episodeId: string,
        patch: Partial<Episode>,
    ): Promise<Episode> {
        const next: Record<string, unknown> = {};
        if (patch.title !== undefined) next.title = patch.title;
        if (patch.body !== undefined) {
            next.body = patch.body;
            // 文字数はここで数える。読むたびに数え直さずに済む
            next.char_count = patch.body.replace(/\s/g, "").length;
        }
        if (patch.status !== undefined) next.draft_status = patch.status;
        if (patch.ep_number !== undefined) next.ep_number = patch.ep_number;
        if (patch.scanned_length !== undefined) {
            next.scanned_length = patch.scanned_length;
        }
        if (patch.chapter_id !== undefined) next.chapter_id = patch.chapter_id;
        /*
         * 公開の印は表に 2 つある。
         *   is_published  こちらで使う印
         *   published     投稿サイト側の印。既定 true
         * 片方だけ立てると、表示と食い違う。
         */
        if (patch.is_published !== undefined) {
            next.is_published = patch.is_published;
            next.published = patch.is_published;
        }

        /*
         * 予約の時刻も 2 つある。
         *   publish_at    こちらで使う
         *   scheduled_at  投稿サイト側が見て、時間が来たら公開する
         *
         * 繋いでいなかったので、予約しても時間が過ぎて出なかった。
         * 両方に同じ時刻を入れる。
         */
        if (patch.publish_at !== undefined) {
            next.publish_at = patch.publish_at;
            next.scheduled_at = patch.publish_at;
        }
        if (patch.preface !== undefined) next.preface = patch.preface;
        if (patch.episode_summary !== undefined) {
            next.episode_summary = patch.episode_summary;
        }
        if (patch.afterword !== undefined) next.afterword = patch.afterword;
        if (patch.deleted_at !== undefined) next.deleted_at = patch.deleted_at;

        /*
         * 送るものが無ければ、いまの姿をそのまま返す。
         *
         * 空のまま送ると 1 件も当たらず、
         * 「1 つに絞れない」と言われて落ちる。
         */
        if (Object.keys(next).length === 0) {
            const current = await this.getEpisode(episodeId);
            if (!current) throw new Error("話が見つかりません");
            return current;
        }

        next.updated_at = new Date().toISOString();

        const { data, error } = await db()
            .from("episodes")
            .update(next)
            .eq("id", episodeId)
            .select()
            .maybeSingle();

        if (error) throw new Error(describeError(error.message));

        /*
         * 返ってこないのは、その行に触れていないとき。
         * 消えたのか、権限が無いのかを分けて伝える。
         */
        if (!data) {
            throw new Error(
                "この話を書き換えられませんでした。\n" +
                    "ほかの端末で消された可能性があります。",
            );
        }

        return toEpisode(data);
    },

    async deleteEpisode(episodeId: string): Promise<void> {
        await db().from("episodes").delete().eq("id", episodeId);
    },

    async deleteAllEpisodes(workId: string): Promise<void> {
        /*
         * まとめて消す。
         *
         * 1 話ずつ消していたので、5,000 話あると
         * 5,000 回のやり取りになり、終わらない。
         */
        const { error } = await db()
            .from("episodes")
            .delete()
            .eq("novel_id", workId);

        if (error) throw new Error(describeError(error.message));
    },

    async deleteEpisodes(episodeIds: string[]): Promise<void> {
        if (episodeIds.length === 0) return;

        /*
         * 小分けにして消す。
         * id を何百件も並べると、問い合わせが長くなりすぎる。
         */
        const CHUNK = 100;
        for (let at = 0; at < episodeIds.length; at += CHUNK) {
            const { error } = await db()
                .from("episodes")
                .delete()
                .in("id", episodeIds.slice(at, at + CHUNK));

            if (error) throw new Error(describeError(error.message));
        }
    },

    async reorderEpisodes(workId: string, orderedIds: string[]): Promise<void> {
        /*
         * 1 件ずつ更新する。
         * まとめて送る方法もあるが、話数はせいぜい数十なので
         * 分かりやすさを取る。
         */
        await Promise.all(
            orderedIds.map((id, index) =>
                db().from("episodes").update({ ep_number: index + 1 }).eq("id", id),
            ),
        );
    },

    async createEpisodes(
        workId: string,
        inputs: { title: string; body: string }[],
    ): Promise<Episode[]> {
        const { data: last } = await db()
            .from("episodes")
            .select("ep_number")
            .eq("novel_id", workId)
            .order("ep_number", { ascending: false })
            .limit(1)
            .maybeSingle();

        let next = ((last?.ep_number as number) ?? 0) + 1;

        /*
         * 小分けにして送る。
         *
         * 一度に全部送ると、返ってくる行数の上限（既定 1000）に当たり、
         * 2,200 話を入れても 1,000 話しか入らない。
         * 送るほうにも本文の重さがあるので、200 話ずつにする。
         */
        const CHUNK = 200;
        const created: Episode[] = [];

        for (let at = 0; at < inputs.length; at += CHUNK) {
            const part = inputs.slice(at, at + CHUNK);

            const { data, error } = await db()
                .from("episodes")
                .insert(
                    part.map((row) => ({
                        novel_id: workId,
                        title: row.title,
                        body: row.body,
                        char_count: row.body.replace(/\s/g, "").length,
                        ep_number: next++,
                    })),
                )
                .select();

            if (error) throw new Error(describeError(error.message));
            created.push(...rows<Record<string, unknown>>(data).map(toEpisode));
        }

        return created;
    },

    /**
     * ==========================================================
     * 作品ごとの設定
     *
     * どれも 1 作品に 1 行。無ければ既定値を返して、
     * 保存するときに作る（upsert）。
     * ==========================================================
     */

    async getDisplaySettings(workId: string): Promise<DisplaySettings> {
        const { data } = await db()
            .from("work_display_settings")
            .select("*")
            .eq("novel_id", workId)
            .maybeSingle();

        // 列は novel_id なので、こちらの呼び名に直す
        return { ...defaultDisplaySettings(workId), ...(data ?? {}), work_id: workId };
    },

    async saveDisplaySettings(
        workId: string,
        patch: Partial<DisplaySettings>,
    ): Promise<DisplaySettings> {
        const current = await this.getDisplaySettings(workId);
        const merged = { ...current, ...patch };

        /*
         * work_id は送らない。
         *
         * こちらの呼び名で、表の列は novel_id。
         * そのまま送ると「そんな列は無い」と言われて保存に失敗し、
         * 画面だけ元に戻る。
         */
        const { work_id: _ignored, ...columns } = merged;

        const { error } = await db()
            .from("work_display_settings")
            .upsert({ ...columns, novel_id: workId }, { onConflict: "novel_id" });

        if (error) throw new Error(describeError(error.message));
        return merged;
    },

    async getPublishSettings(workId: string): Promise<PublishSettings> {
        const { data } = await db()
            .from("novels")
            .select("visibility, serial_status, published, allow_comments")
            .eq("id", workId)
            .maybeSingle();

        return { ...defaultPublishSettings(workId), ...(data ?? {}) };
    },

    async savePublishSettings(
        workId: string,
        patch: Partial<PublishSettings>,
    ): Promise<PublishSettings> {
        const current = await this.getPublishSettings(workId);
        const merged = { ...current, ...patch };

        /*
         * 公開設定は novels の列に入っている。
         * 投稿サイトと同じ場所を使うので、別テーブルにしない。
         */
        await db()
            .from("novels")
            .update({
                visibility: merged.visibility,
                serial_status: merged.serial_status,
                published: merged.visibility === "public",
                /*
                 * 投稿サイト側は is_serial（連載中かどうか）を見ている。
                 * こちらの serial_status と揃えないと、
                 * 完結にしても「連載中」と出たままになる。
                 */
                is_serial: merged.serial_status === "ongoing",
            })
            .eq("id", workId);

        return merged;
    },

    async getAiSettings(workId: string): Promise<AiSettings> {
        const { data } = await db()
            .from("work_ai_settings")
            .select("*")
            .eq("novel_id", workId)
            .maybeSingle();
        return { ...defaultAiSettings(workId), ...(data ?? {}), work_id: workId };
    },

    async saveAiSettings(
        workId: string,
        patch: Partial<AiSettings>,
    ): Promise<AiSettings> {
        const current = await this.getAiSettings(workId);
        const merged = { ...current, ...patch };

        const { work_id: _ignored, ...columns } = merged;

        const { error } = await db()
            .from("work_ai_settings")
            .upsert({ ...columns, novel_id: workId }, { onConflict: "novel_id" });

        if (error) throw new Error(describeError(error.message));
        return merged;
    },

    async getPreferences(workId: string): Promise<WorkPreferences> {
        const { data } = await db()
            .from("work_preferences")
            .select("*")
            .eq("novel_id", workId)
            .maybeSingle();
        return { ...defaultWorkPreferences(workId), ...(data ?? {}), work_id: workId };
    },

    async savePreferences(
        workId: string,
        patch: Partial<WorkPreferences>,
    ): Promise<WorkPreferences> {
        const current = await this.getPreferences(workId);
        const merged = { ...current, ...patch };

        const { work_id: _ignored, ...columns } = merged;

        const { error } = await db()
            .from("work_preferences")
            .upsert({ ...columns, novel_id: workId }, { onConflict: "novel_id" });

        if (error) throw new Error(describeError(error.message));
        return merged;
    },

    /**
     * ==========================================================
     * 履歴
     *
     * 差分ではなく全文を控える。復元が単純になる。
     * ==========================================================
     */

    async listVersions(episodeId: string): Promise<EpisodeVersion[]> {
        const { data } = await db()
            .from("episode_versions")
            .select("*")
            .eq("episode_id", episodeId)
            .order("created_at", { ascending: false })
            .limit(30);
        return rows<Record<string, unknown>>(data).map(toVersion);
    },

    async createVersion(
        episodeId: string,
        trigger: "auto" | "manual" | "restore",
    ): Promise<EpisodeVersion | null> {
        const episode = await this.getEpisode(episodeId);
        if (!episode) return null;

        const versions = await this.listVersions(episodeId);

        /*
         * 中身が前と同じなら控えない。
         * 開いただけで履歴が増えると、探したい版が埋もれる。
         */
        if (trigger === "auto" && versions[0]?.body === episode.body) return null;

        const { data, error } = await db()
            .from("episode_versions")
            .insert({
                episode_id: episodeId,
                novel_id: episode.work_id,
                body: episode.body,
                char_count: episode.char_count,
                trigger,
                label: `v${versions.length + 1}`,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));

        /* 30 版を超えたら古いものから消す */
        if (versions.length >= 30) {
            const old = versions.slice(29).map((row) => row.id);
            if (old.length > 0) {
                await db().from("episode_versions").delete().in("id", old);
            }
        }

        return toVersion(data);
    },

    async restoreVersion(versionId: string): Promise<Episode> {
        const { data: version } = await db()
            .from("episode_versions")
            .select("*")
            .eq("id", versionId)
            .maybeSingle();

        if (!version) throw new Error("履歴が見つかりません");

        const episodeId = version.episode_id as string;

        /*
         * 戻す前に、いまの本文を控えておく。
         * 戻したこと自体を取り消せないと、間違えたときに詰む。
         */
        await this.createVersion(episodeId, "restore");

        return this.updateEpisode(episodeId, { body: version.body as string });
    },

    /**
     * ==========================================================
     * 資料のページ
     * ==========================================================
     */

    async listPages(workId: string): Promise<ResourcePage[]> {
        const { data } = await db()
            .from("resource_pages")
            .select("*")
            .eq("novel_id", workId)
            .order("sort_order");

        const all = rows<Record<string, unknown>>(data).map(toPage);

        /*
         * 同じ常設ページが二重にあれば、古いほうだけ残す。
         *
         * 一度できてしまった重複は、読むたびに消しておく。
         * 見張る仕組みを別に建てるほどのことではない。
         */
        const seen = new Set<string>();
        const keep: ResourcePage[] = [];
        const drop: string[] = [];

        for (const page of all) {
            if (!page.builtin_key) {
                keep.push(page);
                continue;
            }
            if (seen.has(page.builtin_key)) {
                drop.push(page.id);
                continue;
            }
            seen.add(page.builtin_key);
            keep.push(page);
        }

        if (drop.length > 0) {
            await db().from("resource_pages").delete().in("id", drop);
        }

        return keep;
    },

    async setupPages(
        workId: string,
        extraPageKeys: string[] = [],
    ): Promise<ResourcePage[]> {
        const existing = await this.listPages(workId);

        /*
         * 最初に開いたとき、決まった組み合わせのページを作る。
         * 空の資料画面を渡されても、何をすればよいか分からない。
         */
        const { PINNED_PAGES } = await import("@/lib/resource/builtin-pages");

        /*
         * すでにあるものは作らない。
         *
         * 画面が二度読み込むと、この処理も二度走る。
         * 「無ければ作る」だけでは、
         * 一度目が終わる前に二度目が始まって二重になる。
         */
        const already = new Set(existing.map((row) => row.builtin_key));
        const missing = PINNED_PAGES.filter((row) => !already.has(row.key));
        if (missing.length === 0) return existing;

        await db()
            .from("resource_pages")
            .insert(
                missing.map((row, index) => ({
                    novel_id: workId,
                    builtin_key: row.key,
                    label: row.label,
                    description: row.description,
                    kind: row.kind,
                    fields: row.fields,
                    is_pinned: true,
                    sort_order: index,
                    layout: row.layout,
                    image_style: row.imageStyle ?? null,
                    timeline_mode: row.timelineMode ?? "story",
                })),
            );

        /* 追加で頼まれたページも足す */
        for (const key of extraPageKeys) {
            try {
                await this.addBuiltinPage(workId, key);
            } catch {
                // 無い名前を渡されても、常設のぶんは作れている
            }
        }

        return this.listPages(workId);
    },

    async addBuiltinPage(workId: string, key: string): Promise<ResourcePage> {
        const { ALL_BUILTIN_PAGES } = await import("@/lib/resource/builtin-pages");
        const def = ALL_BUILTIN_PAGES.find((row) => row.key === key);
        if (!def) throw new Error("そのページはありません");

        const pages = await this.listPages(workId);

        const { data, error } = await db()
            .from("resource_pages")
            .insert({
                novel_id: workId,
                builtin_key: def.key,
                label: def.label,
                description: def.description,
                kind: def.kind,
                fields: def.fields,
                sort_order: pages.length,
                layout: def.layout,
                image_style: def.imageStyle ?? null,
                timeline_mode: def.timelineMode ?? "story",
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toPage(data);
    },

    async createCustomPage(
        workId: string,
        input: Partial<ResourcePage>,
    ): Promise<ResourcePage> {
        const pages = await this.listPages(workId);

        const { data, error } = await db()
            .from("resource_pages")
            .insert({
                novel_id: workId,
                builtin_key: null,
                label: input.label ?? "新しいページ",
                description: input.description ?? "",
                kind: input.kind ?? "entries",
                fields: input.fields ?? [],
                sort_order: pages.length,
                layout: input.layout ?? "list",
                image_style: input.image_style ?? null,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toPage(data);
    },

    async updatePage(
        pageId: string,
        patch: Partial<ResourcePage>,
    ): Promise<ResourcePage> {
        const { data, error } = await db()
            .from("resource_pages")
            .update(patch)
            .eq("id", pageId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toPage(data);
    },

    async deletePage(pageId: string): Promise<void> {
        await db().from("resource_pages").delete().eq("id", pageId);
    },

    /**
     * ==========================================================
     * 資料の項目
     * ==========================================================
     */

    async listEntries(workId: string): Promise<ResourceEntry[]> {
        const { data } = await db()
            .from("resource_entries")
            .select("*")
            .eq("novel_id", workId)
            .order("created_at");
        return rows<ResourceEntry>(data);
    },

    async createEntry(
        workId: string,
        pageId: string,
        input: Partial<ResourceEntry> = {},
    ): Promise<ResourceEntry> {
        const { data, error } = await db()
            .from("resource_entries")
            .insert({
                novel_id: workId,
                page_id: pageId,
                name: input.name ?? "",
                aliases: input.aliases ?? [],
                summary: input.summary ?? "",
                values: input.values ?? {},
                is_major: input.is_major ?? false,
                candidate_status: input.candidate_status ?? "none",
                candidate_source: input.candidate_source ?? null,
                source_ref: input.source_ref ?? null,
                image_url: input.image_url ?? null,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as ResourceEntry;
    },

    async updateEntry(
        entryId: string,
        patch: Partial<ResourceEntry>,
    ): Promise<ResourceEntry> {
        /*
         * 送る列を選ぶ。
         *
         * こちらの持ち物をそのまま渡すと、
         * 表に無い列が混ざって落ちる。
         */
        const next: Record<string, unknown> = {};
        if (patch.name !== undefined) next.name = patch.name;
        if (patch.aliases !== undefined) next.aliases = patch.aliases;
        if (patch.summary !== undefined) next.summary = patch.summary;
        if (patch.values !== undefined) next.values = patch.values;
        if (patch.is_major !== undefined) next.is_major = patch.is_major;
        if (patch.image_url !== undefined) next.image_url = patch.image_url;
        if (patch.page_id !== undefined) next.page_id = patch.page_id;
        if (patch.candidate_status !== undefined) {
            next.candidate_status = patch.candidate_status;
        }
        if (patch.candidate_source !== undefined) {
            next.candidate_source = patch.candidate_source;
        }

        /* 送るものが無ければ、いまの姿を返す */
        if (Object.keys(next).length === 0) {
            const { data: current } = await db()
                .from("resource_entries")
                .select("*")
                .eq("id", entryId)
                .maybeSingle();

            if (!current) throw new Error("この項目は見つかりませんでした。");
            return current as ResourceEntry;
        }

        next.updated_at = new Date().toISOString();

        const { data, error } = await db()
            .from("resource_entries")
            .update(next)
            .eq("id", entryId)
            .select()
            .maybeSingle();

        if (error) throw new Error(describeError(error.message));

        if (!data) {
            throw new Error(
                "この項目を書き換えられませんでした。\n" +
                    "ほかの端末で消された可能性があります。",
            );
        }

        return data as ResourceEntry;
    },

    async deleteEntry(entryId: string): Promise<void> {
        await db().from("resource_entries").delete().eq("id", entryId);
    },

    async mergeEntries(keepId: string, mergeId: string): Promise<ResourceEntry> {
        const { data: keep } = await db()
            .from("resource_entries")
            .select("*")
            .eq("id", keepId)
            .maybeSingle();
        if (!keep) throw new Error("項目が見つかりません");

        const { data: drops } = await db()
            .from("resource_entries")
            .select("*")
            .eq("id", mergeId);

        /*
         * 消すほうの名前と別名を、残すほうへ移す。
         * 先に消すと、書いた内容が失われる。
         */
        const aliases = new Set<string>((keep.aliases as string[]) ?? []);
        for (const row of rows<Record<string, unknown>>(drops)) {
            aliases.add(row.name as string);
            for (const alias of (row.aliases as string[]) ?? []) aliases.add(alias);
        }

        await db()
            .from("resource_entries")
            .update({ aliases: Array.from(aliases) })
            .eq("id", keepId);

        await db().from("resource_entries").delete().eq("id", mergeId);

        return this.updateEntry(keepId, {});
    },

    /**
     * ==========================================================
     * 関係
     * ==========================================================
     */

    async listRelations(workId: string): Promise<ResourceRelation[]> {
        const { data } = await db()
            .from("resource_relations")
            .select("*")
            .eq("novel_id", workId);
        return rows<ResourceRelation>(data);
    },

    async createRelation(
        workId: string,
        input: Partial<ResourceRelation>,
    ): Promise<ResourceRelation> {
        const { data, error } = await db()
            .from("resource_relations")
            .insert({
                novel_id: workId,
                from_entry_id: input.from_entry_id,
                to_entry_id: input.to_entry_id,
                label: input.label ?? "",
                note: input.note ?? "",
                changes: input.changes ?? [],
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as ResourceRelation;
    },

    async updateRelation(
        relationId: string,
        patch: Partial<ResourceRelation>,
    ): Promise<ResourceRelation> {
        const { data, error } = await db()
            .from("resource_relations")
            .update(patch)
            .eq("id", relationId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as ResourceRelation;
    },

    async deleteRelation(relationId: string): Promise<void> {
        await db().from("resource_relations").delete().eq("id", relationId);
    },

    /**
     * ==========================================================
     * プロット
     * ==========================================================
     */

    async listPlotStages(workId: string): Promise<PlotStage[]> {
        const { data } = await db()
            .from("plot_stages")
            .select("*")
            .eq("novel_id", workId)
            .order("sort_order");
        return rows<PlotStage>(data);
    },

    async createPlotStage(
        workId: string,
        input: Partial<PlotStage> = {},
    ): Promise<PlotStage> {
        const stages = await this.listPlotStages(workId);

        const { data, error } = await db()
            .from("plot_stages")
            .insert({
                novel_id: workId,
                title: input.title ?? "",
                description: input.description ?? "",
                episode_range: input.episode_range ?? "",
                sort_order: stages.length,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as PlotStage;
    },

    async updatePlotStage(
        stageId: string,
        patch: Partial<PlotStage>,
    ): Promise<PlotStage> {
        const { data, error } = await db()
            .from("plot_stages")
            .update(patch)
            .eq("id", stageId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as PlotStage;
    },

    async deletePlotStage(stageId: string): Promise<void> {
        await db().from("plot_stages").delete().eq("id", stageId);
    },

    async reorderPlotStages(workId: string, orderedIds: string[]): Promise<void> {
        await Promise.all(
            orderedIds.map((id, index) =>
                db().from("plot_stages").update({ sort_order: index }).eq("id", id),
            ),
        );
    },

    async listPlotScenes(workId: string): Promise<PlotScene[]> {
        const { data } = await db()
            .from("plot_scenes")
            .select("*")
            .eq("novel_id", workId)
            .order("sort_order");
        return rows<PlotScene>(data);
    },

    async createPlotScene(
        workId: string,
        stageId: string,
        input: Partial<PlotScene> = {},
    ): Promise<PlotScene> {
        const scenes = (await this.listPlotScenes(workId)).filter(
            (row) => row.stage_id === stageId,
        );

        const { data, error } = await db()
            .from("plot_scenes")
            .insert({
                novel_id: workId,
                stage_id: stageId,
                title: input.title ?? "",
                description: input.description ?? "",
                episode_range: input.episode_range ?? "",
                entry_ids: input.entry_ids ?? [],
                is_done: input.is_done ?? false,
                sort_order: scenes.length,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as PlotScene;
    },

    async updatePlotScene(
        sceneId: string,
        patch: Partial<PlotScene>,
    ): Promise<PlotScene> {
        const { data, error } = await db()
            .from("plot_scenes")
            .update(patch)
            .eq("id", sceneId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as PlotScene;
    },

    async deletePlotScene(sceneId: string): Promise<void> {
        await db().from("plot_scenes").delete().eq("id", sceneId);
    },

    /**
     * ==========================================================
     * 本文での登場
     * ==========================================================
     */

    async listMentions(workId: string, episodeId?: string) {
        let query = db().from("entry_mentions").select("*").eq("novel_id", workId);
        if (episodeId) query = query.eq("episode_id", episodeId);

        const { data } = await query;
        return rows<Record<string, unknown>>(data).map((row) => ({
            ...row,
            work_id: row.novel_id,
        })) as never;
    },

    async createMention(
        workId: string,
        episodeId: string,
        entryId: string,
        surface: string,
    ) {
        const { data, error } = await db()
            .from("entry_mentions")
            .insert({
                novel_id: workId,
                episode_id: episodeId,
                entry_id: entryId,
                surface,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return { ...data, work_id: data.novel_id } as never;
    },

    async deleteMention(mentionId: string): Promise<void> {
        await db().from("entry_mentions").delete().eq("id", mentionId);
    },

    /**
     * ==========================================================
     * 書き出しと読み込み
     *
     * 接続先があるので、控えを取る意味は薄い。
     * それでも残しておくのは、
     * 端末の中だけで書いていたものを持ち込めるようにするため。
     * ==========================================================
     */

    async exportAll(): Promise<BackupFile> {
        const works = await this.listWorks();

        const episodes: Episode[] = [];
        const pages: ResourcePage[] = [];
        const entries: ResourceEntry[] = [];
        const relations: ResourceRelation[] = [];

        for (const work of works) {
            episodes.push(...(await this.listEpisodes(work.id)));
            pages.push(...(await this.listPages(work.id)));
            entries.push(...(await this.listEntries(work.id)));
            relations.push(...(await this.listRelations(work.id)));
        }

        return {
            meta: {
                app: "genseki-studio",
                format_version: 1,
                exported_at: new Date().toISOString(),
                counts: {
                    works: works.length,
                    episodes: episodes.length,
                    pages: pages.length,
                    entries: entries.length,
                    relations: relations.length,
                },
            },
            tables: {
                profile: [await this.getProfile()],
                works,
                episodes,
                pages,
                entries,
                relations,
            },
        };
    },

    async importAll(
        backup: BackupFile,
        mode: "replace" | "merge",
    ): Promise<BackupSummary> {
        if (mode === "replace") {
            const existing = await this.listWorks();
            for (const work of existing) await this.deleteWork(work.id);
        }

        const backupWorks = (backup.tables.works ?? []) as Work[];
        const backupEpisodes = (backup.tables.episodes ?? []) as Episode[];

        const imported: Record<string, number> = { works: 0, episodes: 0 };

        /*
         * 作品ごとに作り直す。
         * id は付け替わるので、話は新しい id に繋ぎ直す。
         */
        for (const work of backupWorks) {
            const created = await this.createWork(work);
            imported.works += 1;

            const own = backupEpisodes.filter((row) => row.work_id === work.id);
            if (own.length > 0) {
                await this.createEpisodes(
                    created.id,
                    own.map((row) => ({ title: row.title, body: row.body })),
                );
                imported.episodes += own.length;
            }
        }

        return { imported, skipped: 0 };
    },

    /**
     * ==========================================================
     * 執筆の記録
     * ==========================================================
     */

    async listWritingLogs(workId: string): Promise<WritingLog[]> {
        const { data } = await db()
            .from("writing_logs")
            .select("*")
            .eq("novel_id", workId)
            .order("log_date");

        return rows<Record<string, unknown>>(data).map((row) => ({
            work_id: row.novel_id as string,
            date: row.log_date as string,
            total_chars: (row.total_chars as number) ?? 0,
            delta: (row.delta as number) ?? 0,
            updated_at: (row.updated_at as string) ?? (row.log_date as string),
        }));
    },

    async recordProgress(workId: string, totalChars: number): Promise<void> {
        const today = new Date().toISOString().slice(0, 10);

        const { data: existing } = await db()
            .from("writing_logs")
            .select("*")
            .eq("novel_id", workId)
            .eq("log_date", today)
            .maybeSingle();

        if (existing) {
            /*
             * その日の増分は「今の文字数 − その日の最初の文字数」。
             * 差分を足していくと、消した文字が二重に効いてしまう。
             */
            const base = (existing.total_chars as number) - (existing.delta as number);
            await db()
                .from("writing_logs")
                .update({ total_chars: totalChars, delta: Math.max(0, totalChars - base) })
                .eq("novel_id", workId)
                .eq("log_date", today);
            return;
        }

        /* その日の最初。前日までの合計との差を増分にする */
        const { data: last } = await db()
            .from("writing_logs")
            .select("total_chars")
            .eq("novel_id", workId)
            .lt("log_date", today)
            .order("log_date", { ascending: false })
            .limit(1)
            .maybeSingle();

        const previous = (last?.total_chars as number) ?? 0;

        await db().from("writing_logs").insert({
            novel_id: workId,
            log_date: today,
            total_chars: totalChars,
            delta: Math.max(0, totalChars - previous),
        });
    },

    /**
     * ==========================================================
     * 執筆室
     * ==========================================================
     */

    async touchRoomHost(roomId: string): Promise<void> {
        const userId = await currentUser();
        if (!userId) return;

        /*
         * 主のときだけ時刻を進める。
         * host_id で絞っているので、他の人が呼んでも何も起きない。
         */
        await db()
            .from("writing_rooms")
            .update({ host_seen_at: new Date().toISOString() })
            .eq("id", roomId)
            .eq("host_id", userId);
    },

    async closeStaleRooms(): Promise<number> {
        const { data, error } = await db().rpc("close_stale_rooms");
        if (error) return 0;
        return Number(data ?? 0);
    },

    async listRooms(): Promise<WritingRoom[]> {
        const userId = await currentUser();

        /*
         * 一覧を出すついでに、主の去った部屋を畳む。
         * 定時実行の仕掛けが無いので、人が来たときに掃除する。
         * 失敗しても一覧は出す（掃除は次の人に任せればよい）。
         */
        try {
            await this.closeStaleRooms();
        } catch {
            /* 掃除できなくても、一覧は見せる */
        }

        /*
         * 一覧に出すのは、誰でも入れる部屋だけ。
         *
         * URL 限定の部屋は、URL を渡された人だけが入れる。
         * 一覧に出したら「限定」の意味が無くなる。
         *
         * ただし自分の立てた部屋は、限定でも出す。
         * どこにも出ないと、自分で開けなくなる。
         */
        const { data } = await db()
            .from("writing_rooms")
            .select("*")
            .or(
                userId
                    ? `visibility.eq.open,host_id.eq.${userId}`
                    : "visibility.eq.open",
            )
            .order("created_at", { ascending: false });

        return rows<Record<string, unknown>>(data).map(toRoom);
    },

    async getRoom(roomId: string): Promise<WritingRoom | null> {
        const { data } = await db()
            .from("writing_rooms")
            .select("*")
            .eq("id", roomId)
            .maybeSingle();
        return data ? toRoom(data) : null;
    },

    async createRoom(input: Partial<WritingRoom>): Promise<WritingRoom> {
        const userId = await requireUser();
        const base = defaultRoom("", userId);

        /*
         * 人数は 20 まで。
         *
         * 画面の押し具でも止めているが、こちらでも押さえる。
         * 画面を通さずに作られたときに、際限なく増えないように。
         */
        const capacity = Math.min(
            20,
            Math.max(1, Number(input.capacity ?? base.capacity)),
        );

        const { data, error } = await db()
            .from("writing_rooms")
            .insert({
                ...base,
                ...input,
                capacity,
                id: undefined,
                host_id: userId,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toRoom(data);
    },

    async updateRoom(
        roomId: string,
        patch: Partial<WritingRoom>,
    ): Promise<WritingRoom> {
        const { data, error } = await db()
            .from("writing_rooms")
            .update(patch)
            .eq("id", roomId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toRoom(data);
    },




    async deleteRoom(roomId: string): Promise<void> {
        await db().from("writing_rooms").delete().eq("id", roomId);
    },

    /**
     * ==========================================================
     * コンテスト
     * ==========================================================
     */

    async listContests(): Promise<Contest[]> {
        const { data } = await db()
            .from("contests")
            .select("*")
            .order("created_at", { ascending: false });
        /*
         * 並びは JS 側で決める。
         * DB に order by sort_order と頼むと、列がまだ無い環境で
         * 1 行も返らなくなる（表の列が古い件と同じ穴）。
         * 番号のあるものが上、無いものは新しい順のまま後ろ。
         */
        return rows<Record<string, unknown>>(data)
            .map((row) => ({
                ...toContest(row),
                sort_order: (row.sort_order as number | null) ?? null,
            }))
            .sort(
                (a, b) =>
                    (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity),
            );
    },

    /**
     * ==========================================================
     * Project（自主企画）
     * ==========================================================
     */

    async listProjects(): Promise<Project[]> {
        const { data } = await db()
            .from("projects")
            .select("*")
            .eq("is_published", true)
            .order("created_at", { ascending: false })
            .limit(200);

        return rows<Record<string, unknown>>(data) as unknown as Project[];
    },

    async getProject(projectId: string): Promise<Project | null> {
        const { data } = await db()
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .maybeSingle();

        return (data as Project | null) ?? null;
    },

    async listMyProjects(): Promise<Project[]> {
        const userId = await currentUser();
        if (!userId) return [];

        const { data } = await db()
            .from("projects")
            .select("*")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false });

        return rows<Record<string, unknown>>(data) as unknown as Project[];
    },

    async isProjectTagTaken(tag: string): Promise<boolean> {
        const needle = tag.trim().toLowerCase();
        if (!needle) return false;

        /*
         * 合言葉は早い者勝ち。
         *
         * 大文字小文字だけ違うものも同じとみなす。
         * 「夏の恋」と「夏の恋」が別々に立つと、
         * どちらに参加したのか分からなくなる。
         */
        const { data } = await db()
            .from("projects")
            .select("id, tag")
            .ilike("tag", needle)
            .limit(1);

        return rows<Record<string, unknown>>(data).length > 0;
    },

    async createProject(input: ProjectInput): Promise<Project> {
        const userId = await currentUser();
        if (!userId) throw new Error("ログインしてください");

        const { data, error } = await db()
            .from("projects")
            .insert({
                owner_id: userId,
                title: input.title.trim(),
                description: input.description.trim(),
                tag: input.tag.trim(),
                starts_at: input.starts_at,
                ends_at: input.ends_at,
                banner_url: input.banner_url ?? null,
            })
            .select()
            .single();

        if (error) {
            /* 合言葉がぶつかったとき、そうと分かる言い方にする */
            if (error.message.includes("projects_tag_key")) {
                throw new Error("その合言葉は、すでに使われています");
            }
            throw new Error(describeError(error.message));
        }

        return data as Project;
    },

    async updateProject(
        projectId: string,
        patch: Partial<ProjectInput>,
    ): Promise<Project> {
        const { data, error } = await db()
            .from("projects")
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq("id", projectId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as Project;
    },

    async deleteProject(projectId: string): Promise<void> {
        const { error } = await db().from("projects").delete().eq("id", projectId);
        if (error) throw new Error(describeError(error.message));
    },


    async getContest(contestId: string): Promise<Contest | null> {
        const { data } = await db()
            .from("contests")
            .select("*")
            .eq("id", contestId)
            .maybeSingle();
        return data ? toContest(data) : null;
    },

    async createContest(): Promise<Contest> {
        /*
         * 空のまま入れると、題名が無いと言われて弾かれる。
         * 決まりのある列は、初めから埋めておく。
         *
         * 題名は「無題のコンテスト」。
         * 空文字だと一覧で行が消えたように見える。
         */
        const base = defaultContest("");

        const { data, error } = await db()
            .from("contests")
            .insert({
                title: "無題のコンテスト",
                catchphrase: base.catchphrase,
                description: base.description,
                status: base.status,
                organizer: base.organizer,
                theme: base.theme,
                audience: base.audience,
                eligibility: base.eligibility,
                required_materials: base.required_materials,
                starts_at: base.starts_at,
                ends_at: base.ends_at,
                result_at: base.result_at,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toContest(data);
    },

    async updateContest(contestId: string, patch: Partial<Contest>): Promise<Contest> {
        /*
         * 日どりの欄を空にすると、空文字で送られてくる。
         * 日付の列は空文字を受け取れないので、null に直す。
         *
         * 「まだ決めていない」と「1970年」は別のもの。
         */
        const next: Record<string, unknown> = { ...patch };

        for (const key of ["starts_at", "ends_at", "result_at"]) {
            const value = next[key];

            if (value === "" || value === undefined) {
                if (value === "") next[key] = null;
                continue;
            }

            /*
             * 欄から返るのは「2026-08-20T20:00」。
             * どこの時刻か書かれていないので、
             * その土地の時刻として送る。
             *
             * そのまま渡すと世界標準時として扱われ、
             * 日本なら 9 時間ずれる。
             */
            if (typeof value === "string" && value.includes("T")) {
                const at = new Date(value);
                if (!Number.isNaN(at.getTime())) next[key] = at.toISOString();
            }
        }

        const { data, error } = await db()
            .from("contests")
            .update(next)
            .eq("id", contestId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return toContest(data);
    },

    async deleteContest(contestId: string): Promise<void> {
        await db().from("contests").delete().eq("id", contestId);
    },

    async listContestEntries(contestId: string): Promise<ContestEntry[]> {
        /*
         * 並べ替えは created_at で。
         *
         * 古い表には entered_at が無い。
         * 無い列で並べ替えると、1 行も返ってこない。
         *
         * 出すときは entered_at という名前で渡す。
         * 画面の側はそちらを見ている。
         */
        const { data } = await db()
            .from("contest_entries")
            .select("*")
            .eq("contest_id", contestId)
            .order("created_at");

        return rows<Record<string, unknown>>(data).map((row) => ({
            ...row,
            work_id: row.novel_id,
            entered_at: row.entered_at ?? row.created_at,
        })) as ContestEntry[];
    },

    async listMyContestEntries(contestId: string): Promise<ContestEntry[]> {
        const userId = await currentUser();
        if (!userId) return [];

        /*
         * 出した人の列は、古い版が user_id、いまの版が author_id。
         * どちらで入っているか分からないので、
         * 全部読んでから自分のものを選ぶ。
         * 応募の数はたかが知れているので、これで足りる。
         */
        const all = await this.listContestEntries(contestId);
        return all.filter((row) => {
            const owner =
                ((row as unknown as Record<string, unknown>).author_id as
                    | string
                    | null) ??
                ((row as unknown as Record<string, unknown>).user_id as
                    | string
                    | null) ??
                null;
            return owner === userId;
        });
    },

    async createContestEntry(
        contestId: string,
        input: Omit<ContestEntry, "id" | "contest_id" | "entered_at">,
    ): Promise<ContestEntry> {
        const userId = await requireUser();

        const { data, error } = await db()
            .from("contest_entries")
            .insert({
                contest_id: contestId,
                novel_id: input.work_id,

                /*
                 * 出した人。
                 *
                 * 古い版の表は user_id、いまの版は author_id。
                 * どちらの列があっても通るよう、両方に入れる。
                 * 無い列は、送っても捨てられる。
                 */
                user_id: userId,
                author_id: userId,

                author_name: input.author_name,
                work_title: input.work_title,
                char_count: input.char_count,
                is_shortlisted: input.is_shortlisted,
                is_awarded: input.is_awarded,
                award_label: input.award_label,
                note: input.note,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));

        return {
            ...data,
            work_id: data.novel_id,
            /* 古い表は created_at。画面は entered_at を見ている */
            entered_at: data.entered_at ?? data.created_at,
        } as ContestEntry;
    },

    async updateContestEntry(
        entryId: string,
        patch: Partial<ContestEntry>,
    ): Promise<ContestEntry> {
        const { data, error } = await db()
            .from("contest_entries")
            .update(patch)
            .eq("id", entryId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return { ...data, work_id: data.novel_id } as ContestEntry;
    },

    async deleteContestEntry(entryId: string): Promise<void> {
        const userId = await requireUser();

        /*
         * 自分の応募か確かめてから消す。
         *
         * 以前は id だけで消していたので、
         * id さえ分かれば他人の応募も取り消せた。
         *
         * 出した人の列は、古い版が user_id、いまの版が author_id。
         * どちらで入っているか分からないので、
         * まず読んで、自分のものか目で確かめる。
         */
        const { data: entry } = await db()
            .from("contest_entries")
            .select("*")
            .eq("id", entryId)
            .maybeSingle();

        if (!entry) throw new Error("その応募は見つかりませんでした。");

        const owner =
            (entry.author_id as string | null) ??
            (entry.user_id as string | null) ??
            null;

        if (owner !== userId) {
            throw new Error("自分の応募だけ取り消せます。");
        }

        /*
         * 消すときも持ち主で絞る。
         * 読んでから消すまでの間に入れ替わっても、他人のものは消えない。
         */
        const query = db().from("contest_entries").delete().eq("id", entryId);

        const { error } =
            entry.author_id != null
                ? await query.eq("author_id", userId)
                : await query.eq("user_id", userId);

        /*
         * 弾かれても、Supabase は何も言わずに 0 件消したと返す。
         * error を見ないと、消えたつもりで終わる。
         */
        if (error) throw new Error(describeError(error.message));
    },

    /**
     * ==========================================================
     * 運営が扱うもの
     * ==========================================================
     */

    /**
     * ==========================================================
     * 利用者
     *
     * 運営だけが見える。RLS がそう決めているので、
     * 運営でなければ空が返る。ここで権限を確かめる必要はない。
     * ==========================================================
     */

    async listUsers(): Promise<AdminUser[]> {
        if (!(await currentUser())) return [];

        /*
         * 作品を一緒に引かない。
         *
         * profiles と novels のあいだに繋がりが 2 本あると、
         * どちらを辿ればよいか決められず落ちる。
         * 2 回に分けて読み、こちらで数える。
         */
        const { data, error } = await db()
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw new Error(describeError(error.message));

        const { data: novels } = await db().from("novels").select("author_id");

        const counts = new Map<string, number>();
        for (const row of rows<{ author_id: string }>(novels)) {
            counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
        }

        /*
         * ミッションの進み。
         *
         * 運営が「この人はどこまで来ているか」を掴むため。
         * 数えるだけなので、本文は引かない。
         * 読めなかった項目は 0 として扱い、一覧そのものは必ず出す。
         */
        const [publishedRes, episodesRes, commentsRes, likesRes] =
            await Promise.all([
                db().from("novels").select("author_id").eq("published", true),
                db().from("episodes").select("novel_id").eq("is_published", true),
                db().from("comments").select("user_id"),
                db().from("likes").select("user_id"),
            ]);

        /* 話は作品を経由して書き手に結びつける */
        const novelOwner = new Map<string, string>();
        for (const row of rows<{ id: string; author_id: string }>(
            (await db().from("novels").select("id, author_id")).data,
        )) {
            novelOwner.set(row.id, row.author_id);
        }

        function tally<T extends Record<string, unknown>>(
            list: T[] | null,
            key: keyof T,
        ) {
            const map = new Map<string, number>();
            for (const row of rows<T>(list)) {
                const id = String(row[key] ?? "");
                if (!id) continue;
                map.set(id, (map.get(id) ?? 0) + 1);
            }
            return map;
        }

        const publishedCounts = tally(publishedRes.data, "author_id");
        const commentCounts = tally(commentsRes.data, "user_id");
        const likeCounts = tally(likesRes.data, "user_id");

        const episodeCounts = new Map<string, number>();
        for (const row of rows<{ novel_id: string }>(episodesRes.data)) {
            const owner = novelOwner.get(row.novel_id);
            if (!owner) continue;
            episodeCounts.set(owner, (episodeCounts.get(owner) ?? 0) + 1);
        }

        return rows<Record<string, unknown>>(data).map((row) => ({
            user_id: row.user_id as string,
            email: (row.email as string) ?? "",
            display_name: (row.display_name as string) ?? "名無しの書き手",
            bio: (row.bio as string) ?? "",
            role: row.user_role === "admin" ? "admin" : "user",
            suspended_at: (row.suspended_at as string | null) ?? null,
            suspend_reason: (row.suspend_reason as string) ?? "",
            work_count: counts.get(row.user_id as string) ?? 0,
            login_provider: (row.login_provider as string | null) ?? null,
            mission_stats: {
                works: publishedCounts.get(row.user_id as string) ?? 0,
                episodes: episodeCounts.get(row.user_id as string) ?? 0,
                comments: commentCounts.get(row.user_id as string) ?? 0,
                likes: likeCounts.get(row.user_id as string) ?? 0,
            },
            created_at: (row.created_at as string) ?? "",
        }));
    },

    async updateUser(userId: string, patch: Partial<AdminUser>): Promise<AdminUser> {
        const next: Record<string, unknown> = {};
        if (patch.role !== undefined) next.user_role = patch.role;
        if (patch.suspended_at !== undefined) next.suspended_at = patch.suspended_at;
        if (patch.suspend_reason !== undefined) {
            next.suspend_reason = patch.suspend_reason;
        }

        // 送るものが無ければ、いまの姿を返すだけ
        if (Object.keys(next).length === 0) {
            const all = await this.listUsers();
            const found = all.find((row) => row.user_id === userId);
            if (!found) throw new Error("見つかりません");
            return found;
        }

        const { error } = await db()
            .from("profiles")
            .update(next)
            .eq("user_id", userId);

        if (error) throw new Error(describeError(error.message));

        const all = await this.listUsers();
        const found = all.find((row) => row.user_id === userId);
        if (!found) throw new Error("見つかりません");
        return found;
    },

    /**
     * ==========================================================
     * 部屋の模様の控え
     * ==========================================================
     */

    /**
     * ==========================================================
     * 章
     * ==========================================================
     */

    async listChapters(workId: string): Promise<Chapter[]> {
        /*
         * 並ぶ順は、必ず上から。
         *
         * sort_order だけで並べると、番号が同じ章があったときに
         * 順序が決まらず、開くたびに入れ替わる。
         * （報告のあった「音読みで前後が入れ替わる」がこれ）
         *
         * 作った時刻を二番目の物差しにして、
         * どんな場合でも順序が一つに決まるようにする。
         */
        const { data } = await db()
            .from("chapters")
            .select("*")
            .eq("novel_id", workId)
            .order("sort_order")
            .order("created_at")
            .order("id");

        return rows<Record<string, unknown>>(data).map((row) => ({
            ...(row as unknown as Chapter),
            work_id: row.novel_id as string,
        }));
    },

    async createChapter(workId: string, title = ""): Promise<Chapter> {
        const existing = await this.listChapters(workId);

        /*
         * 並び順は、いまの最後の次。
         *
         * 「章の数」を入れていたが、章を消すと番号が飛ぶので
         * （0,2,4 のように）、数と番号が食い違い、
         * 作った章が既にある章と同じ番号になることがあった。
         * 同じ番号どうしは並ぶ順が決まらず、入れ替わる。
         */
        const lastOrder = existing.reduce(
            (max, chapter) => Math.max(max, chapter.sort_order ?? 0),
            -1,
        );

        const { data, error } = await db()
            .from("chapters")
            .insert({ novel_id: workId, title, sort_order: lastOrder + 1 })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return { ...data, work_id: data.novel_id } as Chapter;
    },

    async updateChapter(chapterId: string, patch: Partial<Chapter>): Promise<Chapter> {
        const { work_id: _ignored, ...columns } = patch;

        const { data, error } = await db()
            .from("chapters")
            .update(columns)
            .eq("id", chapterId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return { ...data, work_id: data.novel_id } as Chapter;
    },

    async deleteChapter(chapterId: string): Promise<void> {
        /*
         * 中の話は消さない。章から外すだけ。
         * 章を消したつもりで原稿ごと消えるのは、取り返しがつかない。
         */
        await db()
            .from("episodes")
            .update({ chapter_id: null })
            .eq("chapter_id", chapterId);

        await db().from("chapters").delete().eq("id", chapterId);
    },

    async reorderChapters(workId: string, orderedIds: string[]): Promise<void> {
        await Promise.all(
            orderedIds.map((id, index) =>
                db().from("chapters").update({ sort_order: index }).eq("id", id),
            ),
        );
    },




    async listNotices(): Promise<AdminNotice[]> {
        /*
         * お知らせは 2 つの表に分かれている。
         *
         *   admin_notices  … Studio で作ったもの
         *   announcements  … 前の版から引き継いだもの
         *
         * 運営画面も 2 つあり、どちらに書いても
         * 出てくるようにしないと、書いたものが消えたように見える。
         *
         * 片方が無い環境でも止まらないよう、失敗は拾う。
         */
        const [noticeRes, announceRes] = await Promise.all([
            Promise.resolve(
                db()
                    .from("admin_notices")
                    .select("*")
                    .order("published_at", { ascending: false }),
            ).catch(() => ({ data: [] } as any)),

            Promise.resolve(
                db()
                    .from("announcements")
                    .select("*")
                    .order("created_at", { ascending: false }),
            ).catch(() => ({ data: [] } as any)),
        ]);

        /*
         * 日付は必ず 10 文字（YYYY-MM-DD）に切る。
         *
         * 本番の表が古い版だと、published_at が時刻付きの
         * 長い形で返る（表の列が古い件）。そのまま
         * 「今日以前か」を文字で比べると必ず落ち、
         * ベルのお知らせだけがどこにも出なくなる。
         * announcements 側は前から切っている。こちらも揃える。
         */
        const notices = rows<AdminNotice>(noticeRes.data).map((row) => ({
            ...row,
            published_at: String(row.published_at ?? "").slice(0, 10),
        }));

        /* announcements を、ベルの形に合わせる */
        const announcements = rows<Record<string, unknown>>(
            announceRes.data,
        ).map((row) => ({
            id: String(row.id),
            type: (row.type as AdminNotice["type"]) ?? "info",
            title: String(row.title ?? ""),
            body: String(row.body ?? row.content ?? ""),
            link: String(row.link ?? ""),
            image_url: (row.image_url as string) ?? null,
            is_published: row.is_published !== false,
            sort_order: (row.sort_order as number | null) ?? null,
            show_on_home: row.show_on_home !== false,
            published_at: String(
                row.published_at ?? row.created_at ?? "",
            ).slice(0, 10),
            /*
             * どの表から来たかを、id に持たせる。
             *
             * 直す・消すときに、行き先を間違えると
             * 「見つからない」と言われて落ちる。
             */
        })).map((row) => ({ ...row, id: `${ANNOUNCE_PREFIX}${row.id}` })) as AdminNotice[];

        /*
         * 混ぜて並べる。番号のあるものが上、無いものは新しい順。
         * 2 つの表をまたいでも、番号は 1 つの並びとして扱う。
         */
        return [...notices, ...announcements].sort(
            (a, b) =>
                (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) ||
                (b.published_at ?? "").localeCompare(a.published_at ?? ""),
        );
    },

    async createNotice(): Promise<AdminNotice> {
        /*
         * 空のまま作ると、必須の列で弾かれることがある。
         * 初めの値を明示しておく。
         */
        const { data, error } = await db()
            .from("admin_notices")
            .insert({
                type: "info",
                title: "",
                body: "",
                link: "",
                is_published: false,
                published_at: new Date().toISOString().slice(0, 10),
            })
            .select()
            .maybeSingle();

        if (error) throw new Error(describeError(error.message));
        if (!data) throw new Error("お知らせを作れませんでした");

        return data as AdminNotice;
    },

    async updateNotice(
        noticeId: string,
        patch: Partial<AdminNotice>,
    ): Promise<AdminNotice> {
        /* announcements のものは、そちらへ書き戻す */
        if (noticeId.startsWith(ANNOUNCE_PREFIX)) {
            const realId = noticeId.slice(ANNOUNCE_PREFIX.length);

            const { data, error } = await db()
                .from("announcements")
                .update(patch)
                .eq("id", realId)
                .select()
                .maybeSingle();

            if (error) throw new Error(describeError(error.message));
            return { ...(data as AdminNotice), id: noticeId };
        }

        const { data, error } = await db()
            .from("admin_notices")
            .update(patch)
            .eq("id", noticeId)
            .select()
            .maybeSingle();

        if (error) throw new Error(describeError(error.message));
        return data as AdminNotice;
    },

    async deleteNotice(noticeId: string): Promise<void> {
        /* announcements のものは、そちらから消す */
        if (noticeId.startsWith(ANNOUNCE_PREFIX)) {
            await db()
                .from("announcements")
                .delete()
                .eq("id", noticeId.slice(ANNOUNCE_PREFIX.length));
            return;
        }

        await db().from("admin_notices").delete().eq("id", noticeId);
    },

    async listBanners(): Promise<AdminBanner[]> {
        const { data } = await db()
            .from("admin_banners")
            .select("*")
            .order("sort_order");
        return rows<AdminBanner>(data);
    },

    async createBanner(): Promise<AdminBanner> {
        const existing = await this.listBanners();

        const { data, error } = await db()
            .from("admin_banners")
            .insert({ sort_order: existing.length })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as AdminBanner;
    },

    async updateBanner(
        bannerId: string,
        patch: Partial<AdminBanner>,
    ): Promise<AdminBanner> {
        const { data, error } = await db()
            .from("admin_banners")
            .update(patch)
            .eq("id", bannerId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as AdminBanner;
    },

    async deleteBanner(bannerId: string): Promise<void> {
        await db().from("admin_banners").delete().eq("id", bannerId);
    },

    async listNgWords(): Promise<NgWord[]> {
        const { data } = await db().from("admin_ng_words").select("*").order("word");
        return rows<NgWord>(data);
    },

    async createNgWord(word: string): Promise<NgWord> {
        const { data, error } = await db()
            .from("admin_ng_words")
            .insert({ word: word.trim() })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as NgWord;
    },

    async updateNgWord(wordId: string, patch: Partial<NgWord>): Promise<NgWord> {
        const { data, error } = await db()
            .from("admin_ng_words")
            .update(patch)
            .eq("id", wordId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as NgWord;
    },

    async deleteNgWord(wordId: string): Promise<void> {
        await db().from("admin_ng_words").delete().eq("id", wordId);
    },

    async listFeatureFlags(): Promise<FeatureFlag[]> {
        const { data } = await db().from("admin_feature_flags").select("*");
        const saved = rows<{ key: string; status: string; updated_at: string }>(data);

        /*
         * 決められた機能の並びを基準にする。
         * こうしないと、機能を足したとき一覧に出てこない。
         */
        return defaultFeatureFlags().map((row) => {
            const found = saved.find((item) => item.key === row.key);
            return found
                ? {
                      ...row,
                      status: found.status as FeatureFlag["status"],
                      updated_at: found.updated_at,
                  }
                : row;
        });
    },

    async updateFeatureFlag(
        key: string,
        status: FeatureFlag["status"],
    ): Promise<FeatureFlag> {
        await db()
            .from("admin_feature_flags")
            .upsert({ key, status, updated_at: new Date().toISOString() });

        const all = await this.listFeatureFlags();
        const found = all.find((row) => row.key === key);
        if (!found) throw new Error("その機能はありません");
        return found;
    },

    /**
     * ==========================================================
     * ふせん
     * ==========================================================
     */

    async listQuickMemos() {
        const userId = await currentUser();
        if (!userId) return [] as never;
        const { data } = await db()
            .from("quick_memos")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        return rows(data) as never;
    },

    async createQuickMemo(input = {}) {
        const userId = await requireUser();
        const { data, error } = await db()
            .from("quick_memos")
            .insert({ ...input, user_id: userId })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as never;
    },

    async updateQuickMemo(memoId: string, patch: Record<string, unknown>) {
        const { data, error } = await db()
            .from("quick_memos")
            .update(patch)
            .eq("id", memoId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as never;
    },

    async deleteQuickMemo(memoId: string): Promise<void> {
        await db().from("quick_memos").delete().eq("id", memoId);
    },
    async listReports(): Promise<Report[]> {
        const { data } = await db()
            .from("reports")
            .select("*")
            .order("created_at", { ascending: false });
        return rows<Report>(data);
    },

    async createReport(input: ReportCreateInput): Promise<Report> {
        const { data, error } = await db()
            .from("reports")
            .insert({
                target: input.target,
                reason: input.reason,
                note: input.note ?? "",
                room_id: input.room_id,
                room_name: input.room_name,
                accused_id: input.accused_id,
                accused_name: input.accused_name,
                quoted_body: input.quoted_body ?? "",
                reporter_id: input.reporter_id,
                reporter_name: input.reporter_name,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as Report;
    },

    async updateReport(reportId: string, patch: Partial<Report>): Promise<Report> {
        const { data, error } = await db()
            .from("reports")
            .update(patch)
            .eq("id", reportId)
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as Report;
    },
    async deleteReport(reportId: string): Promise<void> {
        await db().from("reports").delete().eq("id", reportId);
    },
    /**
     * ============================================================
     * 読者からの反応
     *
     * 列の名前は、すでに動いている表のもの。
     * こちらで付け替えない。
     * ============================================================
     */

    async listPublicNovels(authorId: string): Promise<Work[]> {
        const { data } = await db()
            .from("novels")
            .select("*")
            .eq("author_id", authorId)
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("updated_at", { ascending: false });

        return (data ?? []).map(toWork);
    },

    async listPublishedEpisodes(workId: string): Promise<Episode[]> {
        const { data } = await db()
            .from("episodes")
            .select("*")
            .eq("novel_id", workId)
            .eq("is_published", true)
            .is("deleted_at", null)
            .order("ep_number");

        return (data ?? []).map(toEpisode);
    },

    async getAuthorName(authorId: string): Promise<string> {
        const { data } = await db()
            .from("profiles")
            .select("display_name")
            .eq("user_id", authorId)
            .maybeSingle();

        return data?.display_name ?? "名無しの書き手";
    },

    /* ---- 作品への好き ---- */

    async toggleNovelLike(workId: string): Promise<boolean> {
        const userId = await requireUser();

        const { data: found } = await db()
            .from("likes")
            .select("user_id")
            .eq("novel_id", workId)
            .eq("user_id", userId)
            .maybeSingle();

        if (found) {
            await db()
                .from("likes")
                .delete()
                .eq("novel_id", workId)
                .eq("user_id", userId);
            return false;
        }

        await db().from("likes").insert({ novel_id: workId, user_id: userId });
        return true;
    },

    async countNovelLikes(workId: string): Promise<number> {
        const { count } = await db()
            .from("likes")
            .select("*", { count: "exact", head: true })
            .eq("novel_id", workId);

        return count ?? 0;
    },

    async hasNovelLiked(workId: string): Promise<boolean> {
        const userId = await currentUser();
        if (!userId) return false;

        const { data } = await db()
            .from("likes")
            .select("user_id")
            .eq("novel_id", workId)
            .eq("user_id", userId)
            .maybeSingle();

        return Boolean(data);
    },

    /* ---- 話への好き ---- */

    async toggleEpisodeLike(episodeId: string): Promise<boolean> {
        const userId = await requireUser();

        const { data: found } = await db()
            .from("episode_likes")
            .select("id")
            .eq("episode_id", episodeId)
            .eq("user_id", userId)
            .maybeSingle();

        if (found) {
            await db().from("episode_likes").delete().eq("id", found.id);
            return false;
        }

        await db()
            .from("episode_likes")
            .insert({ episode_id: episodeId, user_id: userId });
        return true;
    },

    async countEpisodeLikes(episodeId: string): Promise<number> {
        const { count } = await db()
            .from("episode_likes")
            .select("*", { count: "exact", head: true })
            .eq("episode_id", episodeId);

        return count ?? 0;
    },

    async hasEpisodeLiked(episodeId: string): Promise<boolean> {
        const userId = await currentUser();
        if (!userId) return false;

        const { data } = await db()
            .from("episode_likes")
            .select("id")
            .eq("episode_id", episodeId)
            .eq("user_id", userId)
            .maybeSingle();

        return Boolean(data);
    },

    /* ---- 保存 ---- */

    async toggleBookmark(workId: string): Promise<boolean> {
        const userId = await requireUser();

        const { data: found } = await db()
            .from("bookmarks")
            .select("user_id")
            .eq("novel_id", workId)
            .eq("user_id", userId)
            .maybeSingle();

        if (found) {
            await db()
                .from("bookmarks")
                .delete()
                .eq("novel_id", workId)
                .eq("user_id", userId);
            return false;
        }

        await db().from("bookmarks").insert({ novel_id: workId, user_id: userId });
        return true;
    },

    async hasBookmarked(workId: string): Promise<boolean> {
        const userId = await currentUser();
        if (!userId) return false;

        const { data } = await db()
            .from("bookmarks")
            .select("user_id")
            .eq("novel_id", workId)
            .eq("user_id", userId)
            .maybeSingle();

        return Boolean(data);
    },

    async countBookmarks(workId: string): Promise<number> {
        const { count } = await db()
            .from("bookmarks")
            .select("*", { count: "exact", head: true })
            .eq("novel_id", workId);

        return count ?? 0;
    },

    /* ---- フォロー ---- */

    async toggleFollow(authorId: string): Promise<boolean> {
        const userId = await requireUser();
        if (userId === authorId) return false;

        const { data: found } = await db()
            .from("follows")
            .select("id")
            .eq("follower_id", userId)
            .eq("following_id", authorId)
            .maybeSingle();

        if (found) {
            await db().from("follows").delete().eq("id", found.id);
            return false;
        }

        await db()
            .from("follows")
            .insert({ follower_id: userId, following_id: authorId });
        return true;
    },

    async isFollowing(authorId: string): Promise<boolean> {
        const userId = await currentUser();
        if (!userId) return false;

        const { data } = await db()
            .from("follows")
            .select("id")
            .eq("follower_id", userId)
            .eq("following_id", authorId)
            .maybeSingle();

        return Boolean(data);
    },

    async countFollowers(authorId: string): Promise<number> {
        const { count } = await db()
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", authorId);

        return count ?? 0;
    },

    /* ---- コメント ---- */

    async listNovelComments(
        workId: string,
        episodeId?: string | null,
    ): Promise<NovelComment[]> {
        let query = db()
            .from("comments")
            .select("*")
            .eq("novel_id", workId)
            .eq("is_muted", false);

        /* 話へのコメントか、作品へのものか */
        query = episodeId
            ? query.eq("episode_id", episodeId)
            : query.is("episode_id", null);

        const { data } = await query.order("created_at");
        return (data ?? []) as NovelComment[];
    },

    async createNovelComment(input: {
        novel_id: string;
        episode_id?: string | null;
        body: string;
        rating?: number | null;
    }): Promise<NovelComment> {
        const userId = await requireUser();

        const { data, error } = await db()
            .from("comments")
            .insert({
                novel_id: input.novel_id,
                episode_id: input.episode_id ?? null,
                user_id: userId,
                body: input.body,
                rating: input.rating ?? null,
            })
            .select()
            .single();

        if (error) throw new Error(describeError(error.message));
        return data as NovelComment;
    },

    async deleteNovelComment(commentId: string): Promise<void> {
        await db().from("comments").delete().eq("id", commentId);
    },

    async recordRead(workId: string, episodeId: string): Promise<void> {
        const userId = await currentUser();
        if (!userId) return;

        /* すでに読んでいれば足さない */
        const { data: found } = await db()
            .from("read_episodes")
            .select("id")
            .eq("user_id", userId)
            .eq("episode_id", episodeId)
            .maybeSingle();

        if (found) return;

        await db()
            .from("read_episodes")
            .insert({ user_id: userId, novel_id: workId, episode_id: episodeId });
    },
};
