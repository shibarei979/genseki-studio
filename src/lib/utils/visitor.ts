/**
 * ============================================================
 * 原石航路 Studio
 * 訪れた人に、意味の無い札を 1 つ配る
 *
 * ★ 名前も、機械の型番も、住所も取らない。
 *
 *   その場で作る、でたらめな並びを 1 つ持つだけ。
 *   「同じ機械から来た」ということしか分からない。
 *   機械の覚えを消せば、次から別の札になる。
 *
 * ★ 2 種類ある。
 *
 *   visitor   長く残る。何人が来たかを数える
 *   session   窓を閉じると変わる。1 回の訪問を追う
 *
 * ★ 覚えられないときは、その場かぎりの札にする。
 *   覚えを止めている人でも、1 回の訪問ぶんは数えられる。
 * ============================================================
 */

const VISITOR_KEY = "gk-visitor";
const SESSION_KEY = "gk-session";

/** でたらめな並び。意味は持たない */
function makeToken(): string {
    try {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    } catch {
        return (
            Math.random().toString(36).slice(2) + Date.now().toString(36)
        ).slice(0, 20);
    }
}

/** その機械の札。無ければ作る */
export function visitorToken(): string {
    try {
        const saved = window.localStorage.getItem(VISITOR_KEY);
        if (saved) return saved;

        const made = makeToken();
        window.localStorage.setItem(VISITOR_KEY, made);
        return made;
    } catch {
        /* 覚えられない設定の人。その場かぎりの札で数える */
        return sessionToken();
    }
}

/** 今回の訪問の札。窓を閉じると変わる */
export function sessionToken(): string {
    try {
        const saved = window.sessionStorage.getItem(SESSION_KEY);
        if (saved) return saved;

        const made = makeToken();
        window.sessionStorage.setItem(SESSION_KEY, made);
        return made;
    } catch {
        return makeToken();
    }
}
