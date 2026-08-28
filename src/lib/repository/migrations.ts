/**
 * ============================================================
 * 原石航路 Studio
 * 読み込み時の形の揃え
 *
 * 保存済みのデータは、その時点の型で書き込まれている。
 * あとから欄を足すと、古い行にはその欄が無い。
 * 「aliases が undefined」で画面が落ちたのはこれが原因だった。
 *
 * 各画面で `?? []` を書いて回るのは間違い。
 * 書き忘れた 1 か所で同じことが起きるし、
 * 型が「必ずある」と言っているのに実際は無い状態が続く。
 *
 * 読み込む場所は 1 つしかないので、そこで形を揃える。
 * ============================================================
 */


type Row = Record<string, any>;

/** 資料の項目 */
export function normalizeEntry(row: Row): Row {
    return {
        ...row,
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        values: typeof row.values === "object" && row.values !== null ? row.values : {},
        summary: typeof row.summary === "string" ? row.summary : "",
        name: typeof row.name === "string" ? row.name : "",
        is_major: row.is_major === true,
        /*
         * 画像そのものが入っている古いデータは捨てる。
         * localStorage に画像を置くと、数枚で上限に当たって
         * 原稿ごと書き込めなくなる。作り直せばよい。
         */
        image_url:
            typeof row.image_url === "string" && !row.image_url.startsWith("data:")
                ? row.image_url
                : null,
        candidate_source:
            typeof row.candidate_source === "string" ? row.candidate_source : null,
        source_ref: typeof row.source_ref === "string" ? row.source_ref : null,
        // 旧 is_candidate（真偽値）から candidate_status（3値）へ
        candidate_status:
            row.candidate_status ?? (row.is_candidate === true ? "pending" : "none"),
    };
}

/** 資料ページ */
export function normalizePage(row: Row): Row {
    return {
        ...row,
        graph_layout:
            typeof row.graph_layout === "object" && row.graph_layout !== null
                ? row.graph_layout
                : {},
        fields: Array.isArray(row.fields) ? row.fields : [],
        layout: row.layout ?? "list",
        image_style: row.image_style ?? null,
        timeline_mode: row.timeline_mode ?? "order",
        is_pinned: row.is_pinned === true,
        sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    };
}

/** 関係 */
export function normalizeRelation(row: Row): Row {
    return {
        ...row,
        changes: Array.isArray(row.changes) ? row.changes : [],
        note: typeof row.note === "string" ? row.note : "",
        label: typeof row.label === "string" ? row.label : "",
    };
}

/** 作品 */
export function normalizeWork(row: Row): Row {
    return {
        ...row,
        tags: Array.isArray(row.tags) ? row.tags : [],
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
        catchphrase: typeof row.catchphrase === "string" ? row.catchphrase : null,
        summary: typeof row.summary === "string" ? row.summary : null,
        author_note: typeof row.author_note === "string" ? row.author_note : null,
        age_rating: row.age_rating ?? "all",
        cover_url: typeof row.cover_url === "string" ? row.cover_url : null,
        cover_is_ai: row.cover_is_ai === true,
    };
}

/** 話 */
export function normalizeEpisode(row: Row): Row {
    return {
        ...row,
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        status: row.status ?? "todo",
        char_count: typeof row.char_count === "number" ? row.char_count : 0,
        ep_number: typeof row.ep_number === "number" ? row.ep_number : 1,
        scanned_length: typeof row.scanned_length === "number" ? row.scanned_length : 0,
    };
}

/** プロットの段 */
export function normalizePlotStage(row: Row): Row {
    return {
        ...row,
        title: typeof row.title === "string" ? row.title : "",
        description: typeof row.description === "string" ? row.description : "",
        episode_range: typeof row.episode_range === "string" ? row.episode_range : "",
        sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    };
}

/** プロットの場面 */
export function normalizePlotScene(row: Row): Row {
    return {
        ...row,
        title: typeof row.title === "string" ? row.title : "",
        description: typeof row.description === "string" ? row.description : "",
        episode_range: typeof row.episode_range === "string" ? row.episode_range : "",
        entry_ids: Array.isArray(row.entry_ids) ? row.entry_ids : [],
        is_done: row.is_done === true,
        sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    };
}

/** プロフィール */
export function normalizeProfile(row: Row): Row {
    return {
        ...row,
        display_name: typeof row.display_name === "string" ? row.display_name : "名無しの書き手",
        name_reading: typeof row.name_reading === "string" ? row.name_reading : "",
        bio: typeof row.bio === "string" ? row.bio : "",
        x_account: typeof row.x_account === "string" ? row.x_account : "",
        website: typeof row.website === "string" ? row.website : "",
        avatar_hue: typeof row.avatar_hue === "number" ? row.avatar_hue : 150,
        claimed_missions: Array.isArray(row.claimed_missions) ? row.claimed_missions : [],
    };
}

/** AI補助の設定 */
export function normalizeAiSettings(row: Row): Row {
    return {
        ...row,
        generated_image_count:
            typeof row.generated_image_count === "number" ? row.generated_image_count : 0,
    };
}

import { DOOR_WIDTH, ROOM_COLS } from "@/types/room-layout";

/**
 * 執筆室。
 * 間取りが無い古いデータには、空の部屋を入れる。
 */
export function normalizeRoom(row: Row): Row {
    const layout =
        typeof row.layout === "object" && row.layout !== null
            ? (row.layout as Record<string, unknown>)
            : {};

    const surface =
        typeof layout.surface === "object" && layout.surface !== null
            ? (layout.surface as Record<string, unknown>)
            : {};

    return {
        ...row,
        speakers: Array.isArray(row.speakers) ? row.speakers : [],
        banned: Array.isArray(row.banned) ? row.banned : [],
        /*
         * 部屋の今。
         * 昔のデータには state が無い。
         * 閉じた印が無ければ開いているものとして扱う。
         */
        state:
            row.state === "draft" || row.state === "closed"
                ? row.state
                : row.closed_at
                  ? "closed"
                  : "open",
        opens_at: typeof row.opens_at === "string" ? row.opens_at : null,
        opened_at: typeof row.opened_at === "string" ? row.opened_at : null,
        closed_at: typeof row.closed_at === "string" ? row.closed_at : null,
        host_seen_at:
            typeof row.host_seen_at === "string" ? row.host_seen_at : null,
        layout: {
            surface: {
                floor: typeof surface.floor === "string" ? surface.floor : "wood",
                wall: typeof surface.wall === "string" ? surface.wall : "cream",
            },
            // 家具は配列でなければ捨てる。壊れた形のまま描くと画面ごと落ちる
            furniture: Array.isArray(layout.furniture) ? layout.furniture : [],
            /*
             * 出入口。古いデータには無いので、手前の真ん中に作る。
             * 入口の無い部屋は、閉じ込められた箱に見える。
             */
            door:
                typeof layout.door === "object" && layout.door !== null
                    ? layout.door
                    : { side: "bottom", offset: Math.floor((ROOM_COLS - DOOR_WIDTH) / 2) },
        },
    };
}

/**
 * コンテスト。
 * 画像の見せ方は後から足したので、古いデータには無い。
 */
export function normalizeContest(row: Row): Row {
    return {
        ...row,
        banner_fit: row.banner_fit === "contain" ? "contain" : "cover",
        banner_x: typeof row.banner_x === "number" ? row.banner_x : 50,
        banner_y: typeof row.banner_y === "number" ? row.banner_y : 50,
        banner_zoom: typeof row.banner_zoom === "number" ? row.banner_zoom : 100,
        genres: Array.isArray(row.genres) ? row.genres : [],
        /*
         * 日付。欠けていると並べ替えで落ちる。
         * 「今日」で埋めておけば、少なくとも画面は開ける。
         */
        starts_at: asDate(row.starts_at),
        ends_at: asDate(row.ends_at),
        result_at: asDate(row.result_at),
        title: typeof row.title === "string" ? row.title : "",
        catchphrase: typeof row.catchphrase === "string" ? row.catchphrase : "",
        description: typeof row.description === "string" ? row.description : "",
        status:
            row.status === "open" ||
            row.status === "judging" ||
            row.status === "closed"
                ? row.status
                : "draft",
        organizer: typeof row.organizer === "string" ? row.organizer : "",
        theme: typeof row.theme === "string" ? row.theme : "",
        audience: typeof row.audience === "string" ? row.audience : "",
        eligibility: typeof row.eligibility === "string" ? row.eligibility : "",
        required_materials:
            typeof row.required_materials === "string" ? row.required_materials : "",
        ai_policy: typeof row.ai_policy === "string" ? row.ai_policy : "",
        terms: typeof row.terms === "string" ? row.terms : "",
        allow_unfinished: row.allow_unfinished !== false,
        /*
         * 賞は 1 つの文字列だった。組の並びへ移す。
         * 中身を捨てると、書いたものが消える。
         */
        prizes: Array.isArray(row.prizes)
            ? row.prizes
            : typeof row.prize === "string" && row.prize.trim()
              ? [{ label: "賞", detail: row.prize }]
              : [],
        checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints : [],
        steps: Array.isArray(row.steps) ? row.steps : [],
        notices: Array.isArray(row.notices) ? row.notices : [],
    };
}

/** 日付を「YYYY-MM-DD」に揃える。読めなければ今日にする */
function asDate(value: unknown): string {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
}

/** お知らせ。画像は後から足したので、古いデータには無い */
export function normalizeNotice(row: Row): Row {
    return {
        ...row,
        image_url: typeof row.image_url === "string" ? row.image_url : null,
        link: typeof row.link === "string" ? row.link : "",
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        published_at: asDate(row.published_at),
        type:
            row.type === "release" ||
            row.type === "maintenance" ||
            row.type === "important"
                ? row.type
                : "info",
    };
}

/** バナー */
export function normalizeBanner(row: Row): Row {
    return {
        ...row,
        image_url: typeof row.image_url === "string" ? row.image_url : null,
        link_url: typeof row.link_url === "string" ? row.link_url : "",
        place: typeof row.place === "string" ? row.place : "home-side",
        sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    };
}

/** 本文の見え方。マス目は後から足したので、古いデータには無い */
export function normalizeDisplay(row: Row): Row {
    return {
        ...row,
        show_grid: row.show_grid === true,
    };
}
