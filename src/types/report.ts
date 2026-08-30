/**
 * ============================================================
 * 原石航路 Studio
 * 通報
 *
 * 執筆室で見かけた発言や人を、運営へ知らせる。
 *
 * ------------------------------------------------------------
 * 何を残すか
 *
 * 通報された発言の本文をそのまま控える。
 * 「誰々がひどいことを言った」だけでは、
 * 運営が見に行ったときには消えていて確かめようがない。
 *
 * 通報した人の名前も残す。
 * 誰が出したか分からないと、同じ人が繰り返し出しているのか、
 * 大勢が同じ相手を挙げているのかが区別できない。
 * ただし通報された側には見せない。
 * ============================================================
 */

/** 何について出したか */
export type ReportTarget =
    /* 執筆室。前からある分 */
    | "message"
    | "member"
    /* 作品まわり。あとから足した分 */
    | "novel"
    | "episode"
    | "comment"
    | "tweet"
    | "user";

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
    message: "部屋の書き込み",
    member: "部屋の参加者",
    novel: "作品",
    episode: "話",
    comment: "感想",
    tweet: "つぶやき",
    user: "利用者",
};

/** 通報の理由 */
export type ReportReason =
    | "abuse"
    | "harassment"
    | "spam"
    | "sexual"
    | "danger"
    /* 作品まわりで足した分 */
    | "copyright"
    | "rating"
    | "other";

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
    abuse: "誹謗中傷",
    harassment: "嫌がらせ",
    spam: "宣伝・迷惑",
    sexual: "性的な内容",
    danger: "危険な内容",
    copyright: "無断転載",
    rating: "年齢区分が合っていない",
    other: "その他",
};

/**
 * 対応の段階。
 *
 * 「見た」と「対応した」を分ける。
 * 一覧を開いただけで消えてしまうと、
 * 誰かが見たのに何もしていない通報が埋もれる。
 */
export type ReportStatus = "open" | "checking" | "done" | "dismissed";

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
    open: "受け取ったまま",
    checking: "見ている",
    done: "対応した",
    dismissed: "問題なし",
};

export interface Report {
    id: string;
    target: ReportTarget;
    reason: ReportReason;
    /** 通報した人が書き添えた説明 */
    note: string;

    /** どの部屋で起きたか */
    /** 通報されたものの id。利用者への通報では空 */
    target_id: string | null;

    room_id: string;
    room_name: string;

    /** 通報された人 */
    accused_id: string;
    accused_name: string;

    /**
     * 通報された発言の本文。
     * 人そのものへの通報のときは空。
     */
    quoted_body: string;

    /** 通報した人 */
    reporter_id: string;
    reporter_name: string;

    status: ReportStatus;
    /** 運営が残す覚え書き */
    memo: string;

    created_at: string;
    updated_at: string;
}

export interface ReportCreateInput {
    target: ReportTarget;
    reason: ReportReason;
    note?: string;
    /** 通報されたものの id */
    target_id?: string | null;
    /** 執筆室からの通報のときだけ */
    room_id?: string | null;
    room_name?: string;
    accused_id: string;
    accused_name: string;
    quoted_body?: string;
    reporter_id: string;
    reporter_name: string;
}
