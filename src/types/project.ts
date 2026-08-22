/**
 * ============================================================
 * 原石航路 Studio
 * Project Types（自主企画）
 *
 * 利用者が自分で立てる企画。
 * 運営のコンテストとは別で、賞も審査も無い。
 *
 * 参加はタグで決まる。
 * 企画ごとに決めた合言葉（タグ）を作品に付けると、
 * その企画のページに並ぶ。承認は要らない。
 * ============================================================
 */

export interface Project {
    id: string;
    /** 立てた人 */
    owner_id: string;
    title: string;
    description: string;
    /**
     * 合言葉。
     *
     * これを作品のタグに付けると参加になる。
     * 早い者勝ちで、同じものは作れない。
     */
    tag: string;
    /** 始まり。決めないこともある */
    starts_at: string | null;
    /** 終わり。決めないこともある */
    ends_at: string | null;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}

/** 企画を立てるとき・直すときに渡すもの */
export interface ProjectInput {
    title: string;
    description: string;
    tag: string;
    starts_at: string | null;
    ends_at: string | null;
}

/**
 * 合言葉に使える形か。
 *
 * 記号や空白が混ざると、作品のタグと突き合わせられない。
 * 日本語・英数字・長音・中黒だけを許す。
 */
export function isValidProjectTag(tag: string): boolean {
    const trimmed = tag.trim();
    if (trimmed.length === 0 || trimmed.length > 30) return false;
    /*
     * 使える字。
     *
     * ひらがな・カタカナ・漢字・英数字と、
     * 長音・中黒・下線・ハイフン。
     * 空白や記号が混ざると、作品のタグと突き合わせられない。
     */
    return /^[ぁ-んァ-ヶ一-龯a-zA-Z0-9ー・_-]+$/.test(trimmed);
}

/**
 * 企画が受付中か。
 *
 * 期間を決めていない企画は、いつでも受付中とみなす。
 */
export function isProjectOpen(project: Project, today = new Date()): boolean {
    const day = today.toISOString().slice(0, 10);
    if (project.starts_at && day < project.starts_at) return false;
    if (project.ends_at && day > project.ends_at) return false;
    return true;
}

/** 期間の言い方。「8/15 〜 8/31」「8/15 から」「いつでも」 */
export function formatProjectPeriod(project: Project): string {
    const slash = (value: string) => value.slice(5).replace("-", "/");

    if (project.starts_at && project.ends_at) {
        return `${slash(project.starts_at)} 〜 ${slash(project.ends_at)}`;
    }
    if (project.starts_at) return `${slash(project.starts_at)} から`;
    if (project.ends_at) return `${slash(project.ends_at)} まで`;
    return "いつでも";
}
