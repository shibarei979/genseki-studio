/**
 * ============================================================
 * 原石航路 Studio
 * AiSettings Types（AI補助設定）
 *
 * 【できないこと（設定項目としても置かない）】
 *   本文の生成
 *   表紙・挿絵の生成
 *
 * 物語を書くのは作者。AI が本文を書けば、それは作者の作品ではなくなる。
 * だから「オフにできる機能」としてすら置かない。
 *
 * 【できること】
 *   本文に書かれたものを読み取って、資料の候補として並べる
 *   資料の項目に添える図案（紋章・肖像など）を作る
 *
 * 資料の図案を許しているのは、それが物語そのものではないから。
 * 王国が増えたときに紋章が並ぶのは、作品を読む助けになる。
 * ============================================================
 */

export type ApprovalMode = "manual" | "draft";

export interface AiSettings {
    work_id: string;
    is_enabled: boolean;

    /** 本文を保存したときに、自動で候補を拾いにいく */
    auto_extract: boolean;

    /**
     * 候補の扱い方。
     * manual … 候補として並べ、作者が承認するまで資料に入れない
     * draft  … 下書きとして資料に入れる（公開はされない）
     */
    approval_mode: ApprovalMode;

    /** 拾う対象 */
    extract_characters: boolean;
    extract_places: boolean;
    extract_organizations: boolean;
    extract_terms: boolean;
    extract_events: boolean;

    /** 本文と資料の紐づけ候補を出す */
    suggest_links: boolean;

    /** 資料の項目に図案を作る */
    generate_images: boolean;

    /**
     * これまでに作った図案の数。
     * 画像づくりは 1 枚ごとに費用がかかるので、
     * 1 作品あたりの上限を設けている。
     * 上限を超えたぶんは、書き手が自分で用意した画像を貼る。
     */
    generated_image_count: number;
}

/** 1 作品あたりに作れる図案の数 */
export const IMAGE_QUOTA = 3;

export const APPROVAL_MODE_LABEL: Record<ApprovalMode, string> = {
    manual: "承認してから資料に入れる（推奨）",
    draft: "下書きとして資料に入れる",
};

export const APPROVAL_MODE_DESCRIPTION: Record<ApprovalMode, string> = {
    manual: "候補を確認し、必要なものだけを反映します。",
    draft: "自動で下書きへ追加します。読者には表示されません。",
};

export function defaultAiSettings(workId: string): AiSettings {
    return {
        work_id: workId,
        is_enabled: true,
        auto_extract: true,
        approval_mode: "manual",
        extract_characters: true,
        extract_places: true,
        extract_organizations: true,
        extract_terms: true,
        extract_events: true,
        suggest_links: true,
        generate_images: true,
        generated_image_count: 0,
    };
}
