/**
 * ============================================================
 * 原石航路 Studio
 * コンテスト
 *
 * 運営が立てて、書き手が作品を出す。
 *
 * いまは自分の端末の中だけで作れる。
 * 本当に他人へ見せるには、ログインと保存先が要る。
 * それでも先に作っておくのは、
 * 「何を決める必要があるか」が形になっていないと、
 * 保存先を用意するときに迷うため。
 * ============================================================
 */

/** コンテストの進み具合 */
export type ContestStatus = "draft" | "open" | "judging" | "closed";

export const CONTEST_STATUS_LABEL: Record<ContestStatus, string> = {
    draft: "準備中",
    open: "募集中",
    judging: "審査中",
    closed: "結果発表",
};

/**
 * 状態ごとの色。
 *
 * 募集中は青、審査中は緑、結果発表は黄。
 * 一覧を眺めたとき、色だけで今どこか分かるようにする。
 * 準備中は運営しか見ないので、目立たない灰にしておく。
 */
export const CONTEST_STATUS_COLOR: Record<
    ContestStatus,
    { chip: string; text: string; bg: string; border: string }
> = {
    draft: {
        chip: "#8a8a8a",
        text: "#55605a",
        bg: "#eeeeec",
        border: "#d6d6d2",
    },
    open: {
        chip: "#2b6183",
        text: "#2b6183",
        bg: "#e6f0f6",
        border: "#b6d2e2",
    },
    judging: {
        chip: "#2a5c39",
        text: "#2a5c39",
        bg: "#e8efe8",
        border: "#b9d0bd",
    },
    closed: {
        chip: "#b08319",
        text: "#8a6410",
        bg: "#fbf2dc",
        border: "#e6d3a0",
    },
};

export const CONTEST_STATUS_DESCRIPTION: Record<ContestStatus, string> = {
    draft: "まだ誰にも見えません",
    open: "作品を出せます",
    judging: "締め切り、選んでいるところ",
    closed: "結果が出ました",
};

export interface Contest {
    id: string;
    title: string;
    /** 一言で言うと何か */
    catchphrase: string;
    description: string;
    status: ContestStatus;
    /** 表示順。小さいものが上。空なら今までどおりの順 */
    sort_order?: number | null;

    /** 主催。誰が開いているか */
    organizer: string;

    /**
     * 賞。何がもらえるか。
     * 「金賞（1名）：賞金10万円」のように 1 行ずつ持つ。
     * 1 つの文章にすると、並べて見せられない。
     */
    prizes: { label: string; detail: string }[];

    /** 募集テーマ。何を書いてほしいか */
    theme: string;
    /** 読者層 */
    audience: string;
    /** 見るところ。編集部が何を見るか */
    checkpoints: { title: string; body: string }[];

    /** 出せる期間 */
    starts_at: string;
    ends_at: string;
    /** 結果を出す日 */
    result_at: string;

    /** 出せる作品の決まり */
    min_chars: number;
    max_chars: number;
    /** 何も入れなければ、どの分類でも出せる */
    genres: string[];
    /** 一人が出せる数。0 で制限なし */
    entry_limit: number;
    /** 他所に出したものでも出せるか */
    allow_published: boolean;

    /** 誰が出せるか */
    eligibility: string;
    /** 本文のほかに要るもの */
    required_materials: string;
    /** 完結していなくてよいか */
    allow_unfinished: boolean;
    /** AI を使ってよい範囲 */
    ai_policy: string;

    /** 出し方の手順。1 行ずつ */
    steps: string[];
    /** 気をつけること。1 行ずつ */
    notices: string[];
    /** 応募規約。長いので折りたたむ */
    terms: string;

    /** 表に出す画像。横長（16:9） */
    banner_url: string | null;
    /**
     * 画像の見せ方。
     * 元の絵を切らずに済ませたいので、
     * どこを見せるかと寄せ具合をここで決める。
     */
    banner_fit: "cover" | "contain";
    /** 縦の位置。0 で上、50 で中央、100 で下 */
    banner_y: number;
    /** 横の位置 */
    banner_x: number;
    /** 拡大率（％）。100 で等倍 */
    banner_zoom: number;

    created_at: string;
    updated_at: string;
}

/** 応募 */
export interface ContestEntry {
    id: string;
    contest_id: string;
    work_id: string;
    /** 出した人。ログインができるまでは端末ごとの目印 */
    author_id: string;
    author_name: string;
    work_title: string;
    char_count: number;
    entered_at: string;
    /** 選考の印。運営だけが見る */
    is_shortlisted: boolean;
    is_awarded: boolean;
    award_label: string;
    note: string;
}

export function defaultContest(id: string): Contest {
    const now = new Date();
    const timestamp = now.toISOString();

    // 締め切りは 1 か月後、結果はその 2 週間後を初期値にする
    const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const result = new Date(ends.getTime() + 14 * 24 * 60 * 60 * 1000);

    return {
        id,
        title: "",
        catchphrase: "",
        description: "",
        status: "draft",
        organizer: "",
        prizes: [],
        theme: "",
        audience: "",
        checkpoints: [],
        eligibility: "プロ・アマ、年齢を問いません",
        required_materials: "",
        allow_unfinished: true,
        ai_policy: "",
        steps: [],
        notices: [],
        terms: "",
        starts_at: timestamp.slice(0, 10),
        ends_at: ends.toISOString().slice(0, 10),
        result_at: result.toISOString().slice(0, 10),
        min_chars: 0,
        max_chars: 0,
        genres: [],
        entry_limit: 1,
        allow_published: true,
        banner_url: null,
        banner_fit: "cover",
        banner_y: 50,
        banner_x: 50,
        banner_zoom: 100,
        created_at: timestamp,
        updated_at: timestamp,
    };
}

/**
 * 状態の色と名前を安全に取り出す。
 *
 * 保存先から来た値が、決めた 4 つのどれでもないことがある。
 * 直に添字で引くと undefined が返り、その先で落ちる。
 * ここで受け止めて「準備中」の扱いにする。
 */
export function toStatus(value: unknown): ContestStatus {
    return value === "open" || value === "judging" || value === "closed"
        ? value
        : "draft";
}

export function statusColor(value: unknown) {
    return CONTEST_STATUS_COLOR[toStatus(value)];
}

export function statusLabel(value: unknown): string {
    return CONTEST_STATUS_LABEL[toStatus(value)];
}

/**
 * 日付の並べ替え。
 *
 * 欠けている日付を後ろへ回す。
 * 直に localeCompare を呼ぶと、値が無いときに落ちる。
 * 保存先によっては列が空のことがあるので、ここで受け止める。
 */
export function compareDate(a: string | null | undefined, b: string | null | undefined): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
}

/** 締め切りまであと何日か。過ぎていたら負の数 */
export function daysUntil(dateText: string | null | undefined): number {
    if (!dateText) return 0;

    /*
     * 時刻まで決めてあれば、その時刻まで。
     * 日にちだけなら、その日の終わりまで。
     *
     * 「T」で見分ける。時刻に 23:59 を足すと壊れる。
     */
    const target = new Date(
        dateText.includes("T") ? dateText : `${dateText}T23:59:59`,
    );
    if (Number.isNaN(target.getTime())) return 0;

    const diff = target.getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
