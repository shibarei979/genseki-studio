"use client";

import { useEffect, useState } from "react";

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

    /*
     * ============================================================
     * 題名を、頁に入る大きさにする
     *
     * ★ 長い題名が入りきらず、下や左で切れていた。
     *   縦書きなので、字の大きさを決めると
     *   「一列に何字入るか」と「何列並ぶか」が決まる。
     *   入る大きさまで、1 px ずつ小さくする。
     *
     * ★ 測らずに計算で決める。
     *   何度も描き直して測ると、開いた瞬間に画面が揺れる。
     *   日本語の字は正方形なので、字の大きさから見当がつく。
     *
     * ★ それでも入りきらないほど長いときは、
     *   入る所までにして「…」で止める。
     *   はみ出して切れるより、そのほうが読める。
     *
     * ★ 中身を流し込むのは home.js なので、
     *   入った合図（文字が変わったこと）を見て走らせる。
     * ============================================================
     */
    useEffect(() => {
        const root = document.querySelector<HTMLElement>(".book_info");
        if (!root) return;

        const title = root.querySelector<HTMLElement>(".bi_title");
        const box = root.querySelector<HTMLElement>(".bi_v");
        if (!title || !box) return;

        /* いちばん小さくする所。これ以上小さいと読めない */
        const MIN = 13;

        /* 自分が書き換えたぶんで、また呼ばれないようにする */
        let mine = false;

        function fit() {
            if (!title || !box || mine) return;

            /* home.js が入れた題名を、元のまま覚えておく */
            const full = (title.dataset.full ?? title.textContent ?? "").trim();
            if (!full) return;
            title.dataset.full = full;

            const chars = Array.from(full);

            /* 決まりの大きさに戻してから測る */
            title.style.fontSize = "";
            const style = window.getComputedStyle(title);
            const max = Math.round(parseFloat(style.fontSize) || 30);
            const lineHeight = (parseFloat(style.lineHeight) || max * 1.4) / max;

            const author = root?.querySelector<HTMLElement>(".bi_author");
            const gap = parseFloat(window.getComputedStyle(box).columnGap || "0") || 0;

            /* 使える幅（列の並ぶ向き）と、一列の長さ */
            const width = box.clientWidth - (author ? author.offsetWidth + gap : 0) - 4;
            const height = box.clientHeight - 4;
            if (width <= 0 || height <= 0) return;

            let size = MIN;
            for (let one = max; one >= MIN; one -= 1) {
                const columns = Math.ceil((chars.length * one) / height);
                if (columns * one * lineHeight <= width) {
                    size = one;
                    break;
                }
            }
            title.style.fontSize = `${size}px`;

            /* いちばん小さくしても入らないときは、入る所まで */
            const columns = Math.max(1, Math.floor(width / (size * lineHeight)));
            const perColumn = Math.max(1, Math.floor(height / size));
            const room = Math.max(6, columns * perColumn);

            const next = chars.length > room ? `${chars.slice(0, room - 1).join("")}…` : full;
            if (title.textContent !== next) {
                mine = true;
                title.textContent = next;
                mine = false;
            }
        }

        const watcher = new MutationObserver(() => {
            /* 題名が入れ替わったら、覚えていた元の題名も捨てる */
            if (!mine && title) delete title.dataset.full;
            fit();
        });
        watcher.observe(title, { childList: true, characterData: true, subtree: true });

        /* 開いたとき（class が変わる）にも合わせ直す */
        const opening = new MutationObserver(() => fit());
        opening.observe(root, { attributes: true, attributeFilter: ["class"] });

        window.addEventListener("resize", fit);
        fit();

        return () => {
            watcher.disconnect();
            opening.disconnect();
            window.removeEventListener("resize", fit);
        };
    }, []);

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
