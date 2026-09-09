"use client";

import { useState } from "react";

import { getRepository } from "@/lib/repository";
import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * 原石航路
 * BookInfoPopup — 作品情報の見開き（器）
 *
 * 中身の流し込みと開け閉めは home.js が受け持つ。
 * ここは、その入れ物と、こちらで足す押し具だけ。
 * ============================================================
 */
export default function BookInfoPopup() {
    /*
     * 「次から出さない」の印。
     *
     * ★ 押したら、その場で控える。
     *   戻す先（マイページの設定）は、押したあとに書く。
     *
     * ★ 頁は読み直さない。
     *
     *   読み直すと、いま開いている見開きが消える。
     *   読もうとしていた作品を見失う。
     *
     *   出すかどうかは画面が組み上がるときに読むので、
     *   効き始めるのは次に開いたときから。
     *   「次回からは」と書いてあるとおりの動きになる。
     */
    const [isChecked, setIsChecked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    function turnOff() {
        if (isChecked) return;
        setIsChecked(true);

        void (async () => {
            try {
                const me = await getRepository().getProfile();
                const userId = (me as { user_id?: string } | null)?.user_id;

                if (userId) {
                    await createClient()
                        .from("profiles")
                        .update({ work_popup_style: "none" })
                        .eq("user_id", userId);
                    setIsSaved(true);
                    return;
                }
            } catch {
                /* 落ちても、見開きは開いたまま */
            }

            /* 控えられなかったときは、印を戻す */
            setIsChecked(false);
        })();
    }

    return (
        <div className="book_info" aria-hidden="true">
            <div className="bi_overlay"></div>
            <div className="bi_book" role="dialog" aria-modal="true" aria-label="作品情報">
                <button className="bi_close oct_fill" aria-label="閉じる"><span className="icn icn_close"></span></button>
                <div className="bi_page bi_left">
                    <p className="bi_head"></p>
                    <div className="bi_quote">
                        <p className="bi_excerpt"></p>
                        <p className="bi_comment"></p>
                    </div>
                </div>
                <div className="bi_page bi_right">
                    <div className="bi_v">
                        <p className="bi_title"></p>
                        <p className="bi_author"></p>
                    </div>
                    <ul className="bi_tags"></ul>
                    <p className="bi_likes">0</p>
                    <a className="bi_read oct_fill" href="#">この本を読む　→</a>

                    {/*
                      * ★ 本の下に置く。
                      *   読む押し具より小さく、薄い色にする。
                      *
                      * ★ 丸を押すと色が付く。
                      *   何が起きたかが、色だけで分かる。
                      */}
                    <button
                        type="button"
                        onClick={turnOff}
                        aria-pressed={isChecked}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: "14px auto 0",
                            padding: "4px 6px",
                            border: "none",
                            background: "none",
                            cursor: isChecked ? "default" : "pointer",
                            color: "var(--color-text-faint)",
                            fontSize: 11.5,
                            lineHeight: 1.6,
                            textAlign: "left",
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                flexShrink: 0,
                                border: isChecked
                                    ? "1px solid var(--color-brand)"
                                    : "1px solid var(--color-brand-border)",
                                background: isChecked
                                    ? "var(--color-brand)"
                                    : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: 10,
                                lineHeight: 1,
                            }}
                        >
                            {isChecked ? "✓" : ""}
                        </span>

                        <span>
                            {isSaved
                                ? "次に開いたときから、この小窓は出しません（マイページの設定で戻せます）"
                                : "次回からは小窓表示を非公開にしますか？"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
