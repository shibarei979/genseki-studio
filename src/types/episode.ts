/**
 * ============================================================
 * 原石航路 Studio
 * Episode Types（話）
 * ============================================================
 */

/**
 * 話の執筆ステータス。
 * 執筆画面の一覧に出る 3 種のマーク（○ / 半月 / ✓）に対応する。
 * 「公開済みかどうか」はここではなく公開設定側で持つ（v2 で追加）。
 */
export type EpisodeStatus = "todo" | "writing" | "done";

export interface Episode {
    id: string;
    work_id: string;
    /** 表示順。1 始まりの連番。並び替え時に振り直す */
    ep_number: number;
    /**
     * どの章に属するか。
     *
     * 章を作らずに書き始められるよう、null を許す。
     * 長くなってから章を切りたくなることのほうが多い。
     */
    chapter_id?: string | null;

    /**
     * この話が公開されているか。
     *
     * 作品全体の公開範囲とは別。
     * 「作品は公開だが、第5話はまだ下書き」ということがある。
     */
    is_published?: boolean;
    /** 冒頭のプレビュー文。一覧に出る導入 */
    preface?: string | null;
    /** この話のあらすじ */
    episode_summary?: string | null;

    /** 後書き。本文のあとに置く短い言葉 */
    afterword?: string | null;
    /**
     * 公開する日時。
     * 決めておくと、その時刻に公開になる。
     */
    publish_at?: string | null;
    title: string;
    body: string;
    status: EpisodeStatus;
    /**
     * 本文の文字数（改行を除く）。
     * 一覧表示のたびに全本文を読むのを避けるため保存時に確定させる。
     */
    char_count: number;
    /**
     * AI補助が最後に読んだ本文の長さ。
     * 次に読むときは、ここから先だけを送る。
     * 同じ本文を何度も送ると、そのぶん費用がかかる。
     */
    scanned_length?: number;
    /** ゴミ箱に入った日時。null なら生きている */
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface EpisodeCreateInput {
    /** 省略時は空。タイトルは書きながら決めるものなので既定値を入れない */
    title?: string;
    body?: string;
}

export type EpisodeUpdateInput = Partial<
    Pick<
        Episode,
        | "title"
        | "body"
        | "status"
        | "ep_number"
        | "scanned_length"
        | "chapter_id"
        | "is_published"
        | "preface"
        | "episode_summary"
        | "afterword"
        | "publish_at"
    >
>;

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
    todo: "未着手",
    writing: "執筆中",
    done: "完成",
};

/**
 * 一覧やダイアログに出す話の名前。
 * タイトルは未入力のままでも構わないので、
 * 空のときは「第3話」だけを返す。
 */
export function formatEpisodeLabel(episode: Pick<Episode, "ep_number" | "title">): string {
    const title = episode.title.trim();
    return title ? `第${episode.ep_number}話　${title}` : `第${episode.ep_number}話`;
}

/** 次のステータスへ循環させる（一覧のマークをクリックしたとき） */
export function nextEpisodeStatus(status: EpisodeStatus): EpisodeStatus {
    if (status === "todo") return "writing";
    if (status === "writing") return "done";
    return "todo";
}

/**
 * ============================================================
 * 章
 *
 * 話をまとめる入れ物。
 * 長くなるほど、話だけの並びでは目当ての場所を探せない。
 * ============================================================
 */

export interface Chapter {
    id: string;
    work_id: string;
    title: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export function defaultChapter(id: string, workId: string, order: number): Chapter {
    const timestamp = new Date().toISOString();
    return {
        id,
        work_id: workId,
        title: "",
        sort_order: order,
        created_at: timestamp,
        updated_at: timestamp,
    };
}

/** 「第一章」のような見出し。番号は漢数字で出す */
export function formatChapterLabel(chapter: Chapter, index: number): string {
    const number = toKanji(index + 1);
    return chapter.title ? `第${number}章　${chapter.title}` : `第${number}章`;
}

/** 1〜99 を漢数字に。章立てでこれ以上は使わない */
function toKanji(value: number): string {
    const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (value < 10) return digits[value];

    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${tens > 1 ? digits[tens] : ""}十${digits[ones]}`;
}
