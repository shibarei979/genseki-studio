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
    /**
     * 話ごとの挿絵。
     *
     * 作品の表紙（novels.cover_url）とは別のもの。
     * 読む画面で、本文の前に出る。
     */
    illust_url?: string | null;
    /**
     * 挿絵を AI で作ったか。
     *
     * 表紙の cover_is_ai と同じ扱い。
     * 読む画面で、絵の隅に印を出す。
     */
    illust_is_ai?: boolean | null;
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
/**
 * 話の見出し。
 *
 * 番号は付けない。書き手の付けた題名をそのまま出す。
 *
 * 「序章」「プロローグ」「第一章」を自分で書く人にとって、
 * 「第1話　序章」と番号が重なるのは邪魔になる。
 * 話の数え方は書き手のもので、こちらが決めるものではない。
 *
 * 題名が空のときだけ、見分けが付くように番号で補う。
 */
export function formatEpisodeLabel(episode: Pick<Episode, "ep_number" | "title">): string {
        const title = episode.title.trim();

    /*
     * ★ 題名が無いとき、「第◯話」と出さない。
     *
     *   話の順番を表す数字なので、
     *   作者が付けた題名と見分けがつかない。
     *   「第8話」という題名の話と、
     *   8 番目の題名なし、が同じに見える。
     *
     * 「題名なし」と出せば、付け忘れに気づける。
     */
    return title || `（題名なし・${episode.ep_number}番目）`;
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
    /**
     * 親の章。
     *
     * 無ければ大きい章、あれば小さい章（節）。
     * 「第一部 → 第一章」のように 2 段で束ねられる。
     */
    parent_id?: string | null;
    /**
     * 部かどうかの印。
     *
     * 子を持つかどうかで決めていたころは、
     * 中の章が空になると部が消えた。
     * 作者にとって部は入れ物なので、印で持つ。
     */
    is_part?: boolean;
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

/**
 * 章の見出し。
 *
 * ★ 名前が付いていれば、名前だけを出す。
 *
 *   前は「第一章　序章」と番号を頭に足していた。
 *   作者が「序章」と名付けたのに「第一章」が消えず、
 *   直したつもりが変わらないように見えていた。
 *
 *   名前が無いときだけ、番号で代わりを務める。
 */
export function formatChapterLabel(chapter: Chapter, index: number): string {
    return chapter.title || `第${toKanji(index + 1)}章`;
}

/** 1〜99 を漢数字に。章立てでこれ以上は使わない */
function toKanji(value: number): string {
    const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (value < 10) return digits[value];

    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${tens > 1 ? digits[tens] : ""}十${digits[ones]}`;
}
