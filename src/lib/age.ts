/**
 * ============================================================
 * 原石航路 Studio
 * 年齢と、見られる作品
 *
 * 生年月日から年齢を出し、
 * その人にどこまで見せるかを決める。
 *
 * 生年月日を入れていない人には、
 * R15 も R18 も見せない。
 * 「たぶん大人だろう」で通すと、
 * 通した側が責を負うことになる。
 * ============================================================
 */

/** 作品の年齢区分 */
export type AgeRatingValue = "all" | "r15" | "r18";

/**
 * 生年月日から、いまの年齢を出す。
 *
 * 入っていなければ null。
 * 0 を返すと「0 歳」と区別が付かない。
 */
export function ageFromBirthdate(
    birthdate: string | null | undefined,
    today = new Date(),
): number | null {
    if (!birthdate) return null;

    const born = new Date(birthdate);
    if (Number.isNaN(born.getTime())) return null;

    let age = today.getFullYear() - born.getFullYear();

    /* 誕生日がまだ来ていなければ 1 引く */
    const month = today.getMonth() - born.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < born.getDate())) {
        age -= 1;
    }

    return age;
}

/**
 * その人が見てよい区分。
 *
 * 一覧を絞り込むときに使う。
 */
export function allowedRatings(age: number | null): AgeRatingValue[] {
    /*
     * ★ R15 は、生年月日を入れていなくても読める。
     *
     *   R15 には、R18 のような明確な決まりが無い。
     *   ほかの投稿サイトでも「15 歳以上に勧める」という
     *   目安であって、禁止ではない。
     *
     *   入っていない人に読ませないと、
     *   ほかのサイトから来た人が「読めない」と戸惑う。
     *
     * ★ R18 だけは、これまでどおり生年月日で確かめる。
     *   こちらは明確な決まりがある。
     */
    if (age === null) return ["all", "r15"];
    if (age >= 18) return ["all", "r15", "r18"];
    return ["all", "r15"];
}

/** 生年月日を入れていないか */
export function needsBirthdate(birthdate: string | null | undefined): boolean {
    return !birthdate;
}
