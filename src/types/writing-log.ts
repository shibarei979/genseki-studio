/**
 * ============================================================
 * 原石航路 Studio
 * WritingLog Types（執筆の記録）
 *
 * 日ごとの文字数と、書いた日の連なりを残す。
 *
 * 【始めた日以降しか集計できない】
 * 過去の原稿から遡って「いつ書いたか」は分からない。
 * だから既定でオンにしている。あとから欲しくなっても取り返せないため。
 * 数えられたくない人のために、切ることもできるようにしてある。
 * ============================================================
 */

export interface WritingLog {
    work_id: string;
    /** "YYYY-MM-DD"。現地時刻の日付で持つ */
    date: string;
    /** その日の終わりの総文字数 */
    total_chars: number;
    /** その日に増えた文字数。減った日は負になる */
    delta: number;
    updated_at: string;
}

export interface WorkPreferences {
    work_id: string;
    /** 執筆の記録を残す */
    record_progress: boolean;
    /** 1日の目標文字数。0 なら目標なし */
    daily_goal: number;
}

export function defaultWorkPreferences(workId: string): WorkPreferences {
    return { work_id: workId, record_progress: true, daily_goal: 0 };
}

/** 現地時刻での "YYYY-MM-DD" */
export function todayKey(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 連続して書いた日数。
 * 今日まだ書いていなくても、昨日書いていれば途切れていないものとする。
 * 日付が変わった瞬間に「0日」と出るのは、記録として意地が悪い。
 */
export function calcStreak(logs: WritingLog[], today = new Date()): number {
    const written = new Set(logs.filter((log) => log.delta > 0).map((log) => log.date));
    if (written.size === 0) return 0;

    const cursor = new Date(today);
    if (!written.has(todayKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
        if (!written.has(todayKey(cursor))) return 0;
    }

    let streak = 0;
    while (written.has(todayKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}
