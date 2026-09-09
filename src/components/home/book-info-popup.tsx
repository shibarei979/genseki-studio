"use client";

import { useState } from "react";

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
                /*
                 * ★ 誰かは、入っている本人から聞く。
                 *
                 *   getProfile() は誰のものかを返さない
                 *   （id は "self" 固定）。
                 *   そこから user_id を取ろうとして空になり、
                 *   控えずに印だけ戻していた。
                 *   丸が一瞬ついて消えるのは、これだった。
                 */
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (user) {
                    const { error } = await supabase
                        .from("profiles")
                        .update({ work_popup_style: "none" })
                        .eq("user_id", user.id);

                    if (!error) {
                        setIsSaved(true);
                        return;
                    }
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

                </div>
            </div>

            {/*
              * 「次から出さない」の印。
              *
              * ★ 本の外、その下に置く。
              *
              *   本の中に置くと、見開きの紙面に
              *   設定の話が混ざる。読むための紙面なので、
              *   そこに置くものではない。
              *
              * ★ 本は真ん中に置かれている。
              *   高さの半分ぶん下げた所が、本の下端。
              *   そこからさらに 14px 下げる。
              *   本の大きさの決め方は book_info.css と同じ形にする。
              */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    transform:
                        "translateY(calc(min(620px, 82vh) / 2 + 14px))",
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                }}
            >
                <button
                    type="button"
                    onClick={turnOff}
                    aria-pressed={isChecked}
                    style={{
                        pointerEvents: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "none",
                        background: "rgba(255, 255, 255, .82)",
                        cursor: isChecked ? "default" : "pointer",
                        color: "var(--color-text-muted)",
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
    );
}
