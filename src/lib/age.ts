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
    if (age === null) return ["all"];
    if (age >= 18) return ["all", "r15", "r18"];
    if (age >= 15) return ["all", "r15"];
    return ["all"];
}

/** 生年月日を入れていないか */
export function needsBirthdate(birthdate: string | null | undefined): boolean {
    return !birthdate;
}
