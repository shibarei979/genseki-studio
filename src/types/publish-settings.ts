/**
 * ============================================================
 * 原石航路 Studio
 * PublishSettings Types（公開設定）
 *
 * works.status（執筆の段階）とは別に、
 * 「読者にどう見えるか」だけをここに集めている。
 * ============================================================
 */

/** 公開範囲 */
export type Visibility = "draft" | "limited" | "public";

/** 連載の状態 */
export type SerialStatus = "ongoing" | "completed" | "paused";

/** 更新通知を送る間隔 */
export type NotifyTiming = "immediate" | "batched";

export interface PublishSettings {
    work_id: string;
    /**
     * 作品全体の公開範囲。
     *
     * 話ごとの公開は、話の側で決める。
     * ここは「作品そのものを外へ出すか」だけ。
     */
    visibility: Visibility;

    /** 予約投稿を使う */
    is_scheduled: boolean;
    /**
     * 予約する日時。datetime-local と同じ "YYYY-MM-DDTHH:mm" 形式で持つ。
     * ISO の UTC ではなく現地時刻のまま保存する。
     * 書き手が入力した「9時」は、時差の計算結果ではなく 9 時であってほしいため。
     */
    scheduled_at: string | null;

    /** 話ごとのコメントを受け取るか */
    allow_comments: boolean;
    /** コメントを承認してから公開する */
    moderate_comments: boolean;

    /** いいねを受け取るか */
    allow_likes: boolean;
    /** 本棚への保存を許すか */
    allow_bookmarks: boolean;
    /** SNSなどへの共有を許すか */
    allow_shares: boolean;
    allow_reviews: boolean;

    serial_status: SerialStatus;
    /** 完結済みの話だけを公開する */
    publish_completed_only: boolean;

    notify_followers: boolean;
    notify_timing: NotifyTiming;
    /** 話を投稿したとき、読んでいる人に知らせるか */
    notify_on_publish: boolean;
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
    draft: "下書き",
    limited: "限定公開",
    public: "公開",
};

export const VISIBILITY_DESCRIPTION: Record<Visibility, string> = {
    draft: "自分のみ閲覧できます。",
    limited: "URLを知っている人だけが読めます。",
    public: "すべての人に公開されます。",
};

export const SERIAL_STATUS_LABEL: Record<SerialStatus, string> = {
    ongoing: "連載中",
    completed: "完結済み",
    paused: "休載中",
};

export const NOTIFY_TIMING_LABEL: Record<NotifyTiming, string> = {
    immediate: "公開と同時に通知する",
    batched: "まとまった話数を公開したときに通知する",
};

export function defaultPublishSettings(workId: string): PublishSettings {
    return {
        work_id: workId,
        visibility: "draft",
        is_scheduled: false,
        scheduled_at: null,
        allow_comments: true,
        moderate_comments: false,
        allow_likes: true,
        allow_bookmarks: true,
        allow_shares: true,
        allow_reviews: true,
        serial_status: "ongoing",
        publish_completed_only: false,
        notify_followers: true,
        notify_timing: "immediate",
        notify_on_publish: true,
    };
}

/**
 * 予約日時が使える値かを調べる。
 * 問題なければ空文字を返す。
 */
export function validateSchedule(settings: PublishSettings, now = new Date()): string {
    if (!settings.is_scheduled) return "";
    if (!settings.scheduled_at) return "公開する日時を選んでください。";

    const target = new Date(settings.scheduled_at);
    if (Number.isNaN(target.getTime())) return "日時の形式が正しくありません。";
    if (target.getTime() <= now.getTime()) return "過去の日時は指定できません。";
    if (settings.visibility === "draft") {
        return "下書きのままでは予約できません。公開または限定公開を選んでください。";
    }
    return "";
}
