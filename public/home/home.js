/* ============================================================
   原石航路 トップページ 挙動スクリプト（デザイン home_10 由来）
   ・各セクションは元の js ファイル名に対応。コードは原則原文のまま
   ・Next.js のクライアント遷移で再マウントされるため、
     自動実行だった初期化は window.HomeV2.init / teardown に集約
   ・メニュー・トグル類はサイト共通 public/site.js 側にある
   ============================================================ */


/* ===================== js/bookshelf_loop/layout_calc.js ===================== */
class LayoutCalc {
    //==================================================
    // Config
    //==================================================

    static B_WIDTH = 245 * 0.9;
    static B_HEIGHT = 300 * 0.9;
    /*
     * 背表紙の厚み。
     *
     * ★ 触らないこと。
     *
     *   携帯だけ細くしたら、本が重なって散らばった。
     *   位置の計算がこの値から出ているので、
     *   ここを変えると並びが食い違う。
     */
    static B_DEPTH = 60 * 0.9;

    /*
     * 左右に並べる冊数。
     *
     * ここは触らないこと。
     *
     * 3 にしたら本が画面の端へ飛び、中央の 1 冊しか
     * 見えなくなった。棚の幅・拡大率・本の間隔が
     * すべてこの値から計算されているため。
     *
     * 見た目の冊数を減らしたいときは、
     * 棚の幅を狭めて、端を隠すほうが安全。
     */
    /*
     * 両脇に並べる冊数。
     *
     * ★ 本棚に並ぶ本の数（SHELF_COUNT = 25）より、
     *   ここが要求する数（この値 × 2 + 1）を超えてはいけない。
     *
     *   10 なら 21 冊。25 冊あるので足りる。
     *   14 にすると 29 冊要る。4 冊足りず、
     *   同じ 1 冊が左端と右端の両方に要求される。
     *   その結果、本が端から端へ飛ぶのが見えた。
     *
     *   増やすときは SHELF_COUNT も一緒に増やすこと。
     */
    /*
     * 両脇に並べる冊数。
     *
     * ★ 本棚に並ぶ本の数（SHELF_COUNT = 25）より、
     *   ここが要求する数（この値 × 2 + 1）を超えてはいけない。
     *   超えると、同じ 1 冊が左端と右端の両方に要求され、
     *   本が端から端へ飛ぶのが見える。
     *
     * 携帯では 6。
     * 縮めたぶん 1 冊が細くなるので、10 のままだと
     * 帯が横に伸びすぎる。
     */
    /*
     * 両脇に並べる冊数。
     *
     * ★ 減らしてはいけない。
     *
     *   3 にしたら、入れ替わるたびに本が端から端まで動き、
     *   たくさんの本が前を通るようになった。
     *   冊数が少ないほど、1 回の動きが大きくなる。
     *
     *   両脇が画面に入るかどうかは、
     *   冊数ではなく CENTER_MARGIN で決まる。
     */
    static B_SIDE_COUNT = 10;
    static B_OVERFLOW_COUNT = 1.5;

    static SCALE = 1;
    static CENTER_MIN_SCALE = 1;

    /* 真ん中の本の左右に空ける幅。寸法と同じ割合で縮める */
    static get CENTER_MARGIN() {
        if (typeof window === "undefined") return 200;

        /*
         * 真ん中の本の左右に空ける幅。
         *
         * 携帯では詰める。200 のままだと、
         * そのぶん両脇が外へ押し出される。
         */
        const shelf = document.querySelector(".bookshelf-loop");
        const w = shelf?.clientWidth || window.innerWidth;

        return w < 1024 ? 20 : 200;
    }
    /*
     * 帯の最小の幅。
     *
     * ★ 一度きりの計算にしない。
     *   冊数と余白が画面の幅で変わるので、
     *   古い値のまま残ると帯だけ広いままになる。
     */
    static get TRACK_MIN_WIDTH() {
        return (this.B_DEPTH * this.B_SIDE_COUNT * 2)
            + (this.B_WIDTH * this.CENTER_MIN_SCALE)
            + (this.CENTER_MARGIN * 2);
    }

    //==================================================
    // Calculate
    //==================================================

    static calculate(root) {
        const bookshelf = {
            width: root.clientWidth,
            height: root.clientHeight,
        };
        const track = this.calcTrack(bookshelf);
        const center = this.calcCenterBook(bookshelf, track);
        const side = this.calcSideBook();
        return {
            track,
            center,
            side,
        };
    }

    //==================================================
    // Track
    //==================================================

    static calcTrack(bookshelf) {
        const width = Math.max(bookshelf.width + (this.B_DEPTH * this.B_OVERFLOW_COUNT * 2), this.TRACK_MIN_WIDTH);
        const x = (bookshelf.width - width) / 2;
        return {
            x,
            width,
        };
    }

    //==================================================
    // Center Book
    //==================================================

    static calcCenterBook(bookshelf, track) {
        const scale = Math.min((track.width - (this.B_DEPTH * this.B_SIDE_COUNT * 2) - (this.CENTER_MARGIN * 2)) / this.B_WIDTH, bookshelf.height / this.B_HEIGHT);
        return {
            width: this.B_WIDTH,
            height: this.B_HEIGHT,
            depth: this.B_DEPTH,
            scale,
        };
    }

    //==================================================
    // Side Book
    //==================================================

    static calcSideBook() {
        return {
            width: this.B_WIDTH,
            height: this.B_HEIGHT,
            depth: this.B_DEPTH,
            scale: this.SCALE,
        };
    }

    //==================================================
    // Book Style
    //==================================================

    static getBookStyle(layout, position) {
        //------------------------------------------
        // Hidden
        //------------------------------------------
        if (position === undefined) {
            return this.getHiddenStyle(layout);
        }

        //------------------------------------------
        // Center
        //------------------------------------------
        if (position === 0) {
            return {
                x: layout.track.width / 2 - layout.center.width * layout.center.scale / 2,
                width: layout.center.width,
                height: layout.center.height,
                depth: layout.center.depth,
                scale: layout.center.scale,
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                opacity: 1,
            };
        }

        //------------------------------------------
        // Left
        //------------------------------------------
        if (position < 0) {
            const n = Math.abs(position);
            return {
                x: this.B_DEPTH * (this.B_SIDE_COUNT - n),
                width: layout.side.width,
                height: layout.side.height,
                depth: layout.side.depth,
                scale: layout.side.scale,
                rotateX: 0,
                rotateY: -90,
                rotateZ: 0,
                opacity: 1,
            };
        }

        //------------------------------------------
        // Right
        //------------------------------------------
        return {
            x: layout.track.width - this.B_DEPTH * (this.B_SIDE_COUNT - position + 1),
            width: layout.side.width,
            height: layout.side.height,
            depth: layout.side.depth,
            scale: layout.side.scale,
            rotateX: 0,
            rotateY: -90,
            rotateZ: 0,
            opacity: 1,
        };
    }

    //==================================================
    // Hidden
    //==================================================

    static getHiddenStyle(layout) {
        return {
            x: 0,
            width: layout.side.width,
            height: layout.side.height,
            depth: layout.side.depth,
            scale: layout.side.scale,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0,
            opacity: 0,
        };
    }
}

/* ===================== js/bookshelf_loop/bookshelf_loop.js ===================== */
class BookshelfLoop {
    constructor(root) {
        //------------------------------------------
        // Elements
        //------------------------------------------
        this.root = root;
        this.books = [...root.querySelectorAll(".book")];

        //------------------------------------------
        // State
        //------------------------------------------
        this.bookCount = this.books.length;
        this.centerIndex = 0;

        //------------------------------------------
        // Config
        //------------------------------------------
        /*
         * 次の本へ移るまでの間。
         *
         * ★ 8 秒は長く、5 秒は速かった。
         *   1 冊を眺め終わるくらいで次へ移る。
         */
        this.LOOP_INTERVAL = 6500;

        //------------------------------------------
        // Cache
        //------------------------------------------
        this.positionClasses = this.createPositionClasses();

        //------------------------------------------
        // Bind
        //------------------------------------------
        this.updateLayout = this.updateLayout.bind(this);

        //------------------------------------------
        // Event
        //------------------------------------------
        window.addEventListener("resize", this.updateLayout);

        /*
         * 字や絵が入ったあとに、もう一度測る。
         *
         * ★ ただし、幅が変わったときだけ。
         *
         *   毎回やり直すと、そのたびに本が並び直り、
         *   端から端へ動くのが見えてしまう。
         *   幅が同じなら、並びも同じなので、やる意味が無い。
         */
        const relayoutIfResized = () => {
            const w = this.root?.clientWidth ?? 0;
            if (w === 0 || w === this._lastWidth) return;
            this._lastWidth = w;
            this.updateLayout();
        };

        window.addEventListener("load", relayoutIfResized);
        window.setTimeout(relayoutIfResized, 300);
        window.setTimeout(relayoutIfResized, 1000);

        //------------------------------------------
        // Visibility
        //------------------------------------------
        this.onVisibilityChange =
            this.onVisibilityChange.bind(this);

        document.addEventListener(
            "visibilitychange",
            this.onVisibilityChange
        );

        //------------------------------------------
        // Initialize
        //------------------------------------------

        // 初回だけ transition を無効
        this.books.forEach(book => {
            book.style.transition = "none";
        });

        // 配置
        this.updateLayout();
        this.update();

        // 次のフレームで transition を有効化
        requestAnimationFrame(() => {
            this.books.forEach(book => {
                book.style.transition = "";
            });
        });

        // ループ開始
        this.start();
    }

    //==================================================
    // Position Classes
    //==================================================

    createPositionClasses() {
        const classes = [];

        //------------------------------------------
        // Left
        //------------------------------------------
        for (let i = LayoutCalc.B_SIDE_COUNT; i >= 1; i--) {
            classes.push(`bsl_l${i}`);
        }

        //------------------------------------------
        // Center
        //------------------------------------------
        classes.push("bsl_c");

        //------------------------------------------
        // Right
        //------------------------------------------
        for (let i = 1; i <= LayoutCalc.B_SIDE_COUNT; i++) {
            classes.push(`bsl_r${i}`);
        }

        //------------------------------------------
        classes.push("bsl_hidden");
        return classes;
    }

    //==================================================
    // Layout
    //==================================================

    updateLayout() {
        /*
         * 幅が取れないうちは、組み立てない。
         *
         * ★ 0 のまま計算すると、本の大きさも位置も 0 になる。
         *   一度そうなると、次に測り直す機会が無いまま固まる。
         *   携帯で「たまに真っ白になり、治らない」のはこれ。
         *
         * 少し待って、もう一度試す。
         */
        if (!this.root || this.root.clientWidth === 0) {
            window.clearTimeout(this._retryTimer);
            this._retryTimer = window.setTimeout(() => this.updateLayout(), 120);
            return;
        }

        //------------------------------------------
        // Transition OFF
        //------------------------------------------
        this.books.forEach(book => {
            book.style.transition = "none";
        });
        //------------------------------------------
        // Calculate
        //------------------------------------------
        /*
         * 位置の名前を作り直す。
         *
         * ★ 両脇の冊数が画面の幅で変わる。
         *   組み立てた時の冊数で作った名前のままだと、
         *   幅が変わったときに足りない・余る。
         */
        this.positionClasses = this.createPositionClasses();

        this.layout = LayoutCalc.calculate(this.root);
        /* 次に測り直すか判断するため、いまの幅を覚える */
        this._lastWidth = this.root.clientWidth;

        //------------------------------------------
        // CSS Variables
        //------------------------------------------
        this.root.style.setProperty("--bls-track-left", `${this.layout.track.x}px`);
        this.root.style.setProperty("--bls-track-width", `${this.layout.track.width}px`);

        //------------------------------------------
        this.applyPosition();

        //------------------------------------------
        // Transition ON
        //------------------------------------------
        requestAnimationFrame(() => {

            this.books.forEach(book => {
                book.style.transition = "";
            });

        });
    }

    //==================================================
    // Update
    //==================================================

    update() {
        this.books.forEach((book, index) => {
            //------------------------------------------
            // Reset
            //------------------------------------------
            book.classList.remove(...this.positionClasses);
            delete book.dataset.position;

            //------------------------------------------
            // Difference
            //------------------------------------------
            let diff = index - this.centerIndex;
            if (diff > this.bookCount / 2) {
                diff -= this.bookCount;
            }
            if (diff < -this.bookCount / 2) {
                diff += this.bookCount;
            }

            //------------------------------------------
            // Hidden
            //------------------------------------------
            if (Math.abs(diff) > LayoutCalc.B_SIDE_COUNT) {
                book.classList.add("bsl_hidden");
                return;
            }

            //------------------------------------------
            // Save
            //------------------------------------------
            book.dataset.position = diff;

            //------------------------------------------
            // Class
            //------------------------------------------
            if (diff === 0) {
                book.classList.add("bsl_c");
            }
            else if (diff < 0) {
                book.classList.add(`bsl_l${Math.abs(diff)}`);
            }
            else {
                book.classList.add(`bsl_r${diff}`);
            }
        });
        //------------------------------------------
        this.applyPosition();
    }

    //==================================================
    // Apply Position
    //==================================================

    applyPosition() {
        if (!this.layout) {
            return;
        }
        this.books.forEach(book => {
            //------------------------------------------
            // Layout
            //------------------------------------------
            const style =
                LayoutCalc.getBookStyle(
                    this.layout,
                    book.dataset.position ===
                        undefined
                        ? undefined
                        : Number(book.dataset.position)
                );

            //------------------------------------------
            // Apply
            //------------------------------------------
            this.setBookStyle(book, style);
        });
    }

    //==================================================
    // Book Style
    //==================================================

    setBookStyle(book, style) {
        book.style.setProperty("--b-width", `${style.width}px`);
        book.style.setProperty("--b-height", `${style.height}px`);
        book.style.setProperty("--b-depth", `${style.depth}px`);
        book.style.setProperty("--b-x", `${style.x}px`);
        book.style.setProperty("--b-y", `0px`);
        book.style.setProperty("--b-z", `0px`);
        book.style.setProperty("--b-scale", style.scale);
        book.style.setProperty("--b-rotate-x", `${style.rotateX}deg`);
        book.style.setProperty("--b-rotate-y", `${style.rotateY}deg`);

        book.style.setProperty("--b-rotate-z", `${style.rotateZ}deg`);
        book.style.setProperty("--b-opacity", style.opacity);
    }

    //==================================================
    // Next
    //==================================================

    next() {
        this.centerIndex++;
        if (this.centerIndex >= this.bookCount) {
            this.centerIndex = 0;
        }
        this.update();
    }

    //==================================================
    // Previous
    //==================================================

    prev() {
        this.centerIndex--;
        if (this.centerIndex < 0) {
            this.centerIndex = this.bookCount - 1;
        }
        this.update();
    }

    //==================================================
    // Loop
    //==================================================

    start() {
        this.stop();
        this.timer = setInterval(() => { this.next(); }, this.LOOP_INTERVAL);
    }
    stop() {
        if (!this.timer) {
            return;
        }
        clearInterval(this.timer);
        this.timer = null;
    }

    //==================================================
    // Destroy
    //==================================================

    destroy() {
        this.stop();
        window.removeEventListener(
            "resize",
            this.updateLayout
        );
        document.removeEventListener(
            "visibilitychange",
            this.onVisibilityChange
        );
    }

    //==================================================
    // Visibility
    //==================================================

    onVisibilityChange() {
        if (document.hidden) {
            this.stop();
        } else {
            this.start();
        }
    }
}

//==================================================
// Initialize
//==================================================

// Next.js: 再マウント毎に HomeV2.init から呼び出す
window.bookshelfLoops = [];
window.__initBookshelves = function () {
    window.bookshelfLoops = [...document.querySelectorAll(".bookshelf-loop")]
        .map(root => new BookshelfLoop(root));
    return window.bookshelfLoops;
};

/* ===================== js/book_template.js ===================== */
/* ==========================================================
   Book Template
   すべての本を同じ HTML フォーマットで生成する共通部品

   フォーマット（本リスト）:
     <a class="book" href="…" data-id="…">
         <p class="b_title">題名</p>
         <p class="b_author">著者</p>
         <ul class="b_tags"><li>タグ</li>…</ul>
         <p class="b_head">最初の本文数行</p>
         <p class="b_excerpt">本文抜粋</p>
         <p class="b_comment">コメント</p>
         <p class="b_likes">いいね数</p>
     </a>

   セクションごとに使わない要素は CSS 側で display:none にする。
   将来的には id を渡して中身を差し替える口として使う想定。
========================================================== */

window.BookTemplate = (() => {
    "use strict";

    function el(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /**
     * @param {Object} data
     * @param {string}   [data.id]      作品ID
     * @param {string}   [data.href]    リンク先
     * @param {string}   [data.title]   題名
     * @param {string}   [data.author]  著者
     * @param {string[]} [data.tags]    タグ
     * @param {string}   [data.head]    最初の本文数行
     * @param {string}   [data.excerpt] 本文抜粋
     * @param {string}   [data.comment] コメント
     * @param {number|string} [data.likes] いいね数
     * @param {string}   [data.cover]   表紙画像URL（省略時は CSS の bg）
     * @returns {HTMLAnchorElement}
     */
    function create(data = {}) {
        const book = document.createElement("a");
        book.className = "book";
        book.href = data.href ?? "#";
        if (data.id) book.dataset.id = data.id;
        if (data.placeholder) book.dataset.placeholder = "1"; // 準備中（クリック無効）
        if (data.cover) book.style.backgroundImage = `url(${data.cover})`;

        book.append(
            el("p", "b_title", data.title ?? ""),
            el("p", "b_author", data.author ?? ""),
        );

        const tags = el("ul", "b_tags");
        (data.tags ?? []).forEach((tag) => {
            tags.append(el("li", "", tag));
        });
        book.append(tags);

        book.append(
            el("p", "b_head", data.head ?? ""),
            el("p", "b_excerpt", data.excerpt ?? ""),
            el("p", "b_comment", data.comment ?? ""),
            el("p", "b_likes", String(data.likes ?? 0)),
        );

        return book;
    }

    return { create };
})();


/* ===================== js/works_refresh.js ===================== */
/* ==========================================================
   Pick Up! / New Release! 更新ボタン
   別 JS（API 側）から変数を受け取れるプロバイダー形式

   使い方（別 JS 側）:
     WorksRefresh.register("pickup", async () => {
         // fetch 等で取得して配列を返す
         return [
             { title: "題名", author: "著者", href: "/works/1", cover: "/img/cover/1.png" },
             ...
         ];
     });
     WorksRefresh.register("new_release", provider);

   手動更新:
     WorksRefresh.refresh("pickup");

   ※ cover は任意。未指定なら CSS の単色 bg のまま
     （bg-img は後日 CSS 側で指定する想定）
========================================================== */

(() => {
    "use strict";

    //------------------------------------------
    // Config
    //------------------------------------------
    const GRID_COUNT = 10;

    //------------------------------------------
    // Providers
    //------------------------------------------
    const providers = {};

    // API 未接続時のダミー
    function defaultProvider() {
        const dummy = [...Array(20)].map((_, i) => ({
            id: `dummy${String(i + 1).padStart(3, "0")}`,
            title: "題名",
            author: "著者",
            tags: ["Tag", "Tag"],
            head: "あああああああああ、ああああああああああ。あああああああああああ。",
            excerpt: "ああああああああああああああああああああ",
            comment: "あああああああああああああああ",
            likes: (i * 17 + 8) % 500,
            href: "#",
        }));
        return dummy.sort(() => Math.random() - 0.5);
    }

    //------------------------------------------
    // Render（統一フォーマットは js/book_template.js が担当）
    //------------------------------------------
    function createItem(work) {
        const li = document.createElement("li");
        li.append(window.BookTemplate.create(work));
        return li;
    }

    function render(section, works) {
        const grid = section.querySelector(".w_grid");
        if (!grid) return;

        grid.replaceChildren(
            ...works.slice(0, GRID_COUNT).map(createItem)
        );
    }

    //------------------------------------------
    // Refresh
    //------------------------------------------
    async function refresh(name) {
        const section = document.querySelector(`section.works[data-works="${name}"]`);
        if (!section) return;

        const provider = providers[name] ?? defaultProvider;

        try {
            const works = await provider(name);
            if (Array.isArray(works)) {
                render(section, works);
                // クローン・送り幅を取り直す
                window.WorksCarousel?.refresh(section);
            }
        } catch (error) {
            console.error(`WorksRefresh: "${name}" の取得に失敗`, error);
        }
    }

    //------------------------------------------
    // Event
    //------------------------------------------
    document.addEventListener("click", (e) => {
        const button = e.target.closest(".w_refresh");
        if (!button) return;

        const section = button.closest("section.works");
        if (!section) return;

        button.classList.add("is_spin");
        refresh(section.dataset.works).finally(() => {
            setTimeout(() => button.classList.remove("is_spin"), 600);
        });
    });

    //------------------------------------------
    // Export
    //------------------------------------------
    window.WorksRefresh = {
        register(name, provider) {
            providers[name] = provider;
        },
        refresh,
    };
})();


/* ===================== js/works_carousel.js ===================== */
/* ==========================================================
   Pick Up! / New Release! カルーセル
   ・横並びの本をループ状態にし、左右ボタンで1冊分送る
   ・両端に複製（クローン）を敷き、端まで来たら
     transition なしで同じ見た目の位置へ巻き戻す方式
   ・works_refresh.js の再描画後は
     window.WorksCarousel.refresh(section) で組み直す
========================================================== */

(() => {
    "use strict";

    const instances = new Map();

    //==================================================
    // Carousel
    //==================================================

    class Carousel {
        constructor(section) {
            this.section = section;
            this.view = section.querySelector(".w_view");
            this.track = section.querySelector(".w_grid");
            this.index = 0;
            this.count = 0;
            this.step = 0;
            this.clones = 0;
            this.animating = false;

            this.onEnd = this.onEnd.bind(this);
            this.track.addEventListener("transitionend", this.onEnd);

            this.build();
        }

        //------------------------------------------
        // 本体の li（クローンを除く）
        //------------------------------------------
        items() {
            return [...this.track.querySelectorAll(":scope > li:not([data-clone])")];
        }

        //------------------------------------------
        // 構築（初期化・再描画後・リサイズ後）
        //------------------------------------------
        build() {
            this.track.querySelectorAll("li[data-clone]").forEach((li) => li.remove());

            const items = this.items();
            this.count = items.length;
            if (this.count === 0) return;

            // 1冊分の送り幅（gap 込みで実測）
            const first = items[0];
            this.step = items[1]
                ? items[1].offsetLeft - first.offsetLeft
                : first.offsetWidth;

            // 巻き戻しの瞬間に空白が見えないよう、
            // ビューポートを覆える枚数 +1 をクローンする
            const visible = Math.ceil(this.view.clientWidth / this.step) + 1;
            this.clones = Math.min(this.count, Math.max(2, visible));

            const cloneOf = (li) => {
                const c = li.cloneNode(true);
                c.dataset.clone = "true";
                c.setAttribute("aria-hidden", "true");
                return c;
            };

            this.track.prepend(...items.slice(-this.clones).map(cloneOf));
            this.track.append(...items.slice(0, this.clones).map(cloneOf));

            // 中央寄せ：ビュー内に収まる冊数を左右均等の余白で配置する
            const gap = this.step - first.offsetWidth;
            const fit = Math.max(1, Math.floor((this.view.clientWidth + gap) / this.step));
            const used = fit * this.step - gap;
            this.centerOffset = Math.round((this.view.clientWidth - used) / 2);

            this.index = 0;
            this.animating = false;
            this.jump();
        }

        //------------------------------------------
        // 位置反映
        //------------------------------------------
        apply(withTransition) {
            const x = this.centerOffset - (this.index + this.clones) * this.step;

            if (!withTransition) {
                this.track.style.transition = "none";
            }

            this.track.style.transform = `translateX(${x}px)`;

            if (!withTransition) {
                void this.track.offsetWidth; // reflow してから transition を戻す
                this.track.style.transition = "";
            }
        }

        jump() {
            this.apply(false);
        }

        //------------------------------------------
        // 1冊送り
        //------------------------------------------
        next() {
            if (this.animating || this.count === 0) return;
            this.animating = true;
            this.index += 1;
            this.apply(true);
        }

        prev() {
            if (this.animating || this.count === 0) return;
            this.animating = true;
            this.index -= 1;
            this.apply(true);
        }

        //------------------------------------------
        // 端に到達したらループ位置へ巻き戻す
        //------------------------------------------
        onEnd(e) {
            if (e.target !== this.track || e.propertyName !== "transform") return;

            this.animating = false;

            if (this.index >= this.count) {
                this.index -= this.count;
                this.jump();
            } else if (this.index < 0) {
                this.index += this.count;
                this.jump();
            }
        }
    }

    //==================================================
    // Event
    //==================================================

    document.addEventListener("click", (e) => {
        const button = e.target.closest(".w_nav");
        if (!button) return;

        const section = button.closest("section.works");
        const carousel = instances.get(section);
        if (!carousel) return;

        button.classList.contains("w_prev") ? carousel.prev() : carousel.next();
    });

    // Next.js: 再マウント毎に HomeV2.init から呼び出す
    window.__initCarousels = function () {
        // 前回マウントの死んだ instance を掃除
        instances.forEach((_, section) => {
            if (!document.contains(section)) instances.delete(section);
        });
        document.querySelectorAll("section.works").forEach((section) => {
            if (section.querySelector(".w_view") && !instances.has(section)) {
                instances.set(section, new Carousel(section));
            }
        });
    };

    // リサイズで送り幅・クローン数を取り直す
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            instances.forEach((carousel) => carousel.build());
        }, 150);
    });

    //==================================================
    // Export
    //==================================================

    window.WorksCarousel = {
        /** section 要素または data-works 名で組み直し */
        refresh(target) {
            const section = typeof target === "string"
                ? document.querySelector(`section.works[data-works="${target}"]`)
                : target;
            instances.get(section)?.build();
        },
    };
})();


/* ===================== js/notice/notice_tab.js ===================== */
/* ==========================================================
   お知らせ タブ切替
   div:nth-child(1) すべて / (2) お知らせ / (3) コンテスト
   → section.notice の data-n-tab を "all | notice | contest" に
========================================================== */

(() => {
    "use strict";

    const TABS = ["all", "notice", "contest"];

    // 初期タブはサーバー側 (JSX) が data-n-tab="all" を出力する

    document.addEventListener("click", (e) => {
        const h2 = e.target.closest("section.notice > div > h2");
        if (!h2) return;

        const section = h2.closest("section.notice");
        const divs = [...section.querySelectorAll(":scope > div")];
        const index = divs.indexOf(h2.parentElement);

        section.dataset.nTab = TABS[index] ?? "all";

        // 表示リストが変わるので画像スタックを組み直す
        window.NoticeImg?.refresh();
    });
})();


/* ===================== js/notice/notice_fold.js ===================== */
/* ==========================================================
   お知らせ 畳み込み
   data-n-fold="on"  : 4件表示 + もっと見る(button)
   data-n-fold="off" : 8件表示 + もっと見る(aタグ・別ページ)
========================================================== */

(() => {
    "use strict";

    document.addEventListener("click", (e) => {
        const button = e.target.closest("#n_fold");
        if (!button) return;

        const section = button.closest("section.notice");
        section.dataset.nFold = "off";

        // 表示件数が変わるので画像スタックを組み直す
        window.NoticeImg?.refresh();
    });
})();


/* ===================== js/notice/notice_img.js ===================== */
/* ==========================================================
   お知らせ 重なり画像
   ・画像は li の中の .n_img（HTML は既存のまま）
   ・表示中リストの可視 li の画像だけを、セクション左の
     同じ位置に重ねて表示（transform で li 位置差を打ち消す）
   ・一定時間ごとに先頭が入れ替わる
   ・タブ / 畳み込み変更時は window.NoticeImg.refresh() で組み直し
========================================================== */

(() => {
    "use strict";

    //------------------------------------------
    // Config
    //------------------------------------------
    const SWITCH_INTERVAL = 4000;   // 切替間隔(ms)
    const STACK_OFFSET_X = 10;      // 後ろの画像のずらし量：右へ(px)
    const STACK_OFFSET_Y = 10;      // 後ろの画像のずらし量：上へ(px)
    const TAB_MAP = { all: 0, notice: 1, contest: 2 };

    //------------------------------------------
    // State
    //------------------------------------------
    let timer = null;
    let frontIndex = 0;
    let images = [];

    //------------------------------------------
    // Elements
    //------------------------------------------
    function getSection() {
        return document.querySelector("section.notice");
    }

    function getActiveList(section) {
        const divs = section.querySelectorAll(":scope > div");
        const index = TAB_MAP[section.dataset.nTab] ?? 0;
        return divs[index]?.querySelector("ul") ?? null;
    }

    // 畳み込みで display:none の li は除外
    function collectImages(list) {
        return [...list.querySelectorAll("li")]
            .filter((li) => li.offsetParent !== null)
            .map((li) => li.querySelector(".n_img"))
            .filter(Boolean);
    }

    //------------------------------------------
    // Layout
    // ・左エリア（ページ左端〜セクション左端）の中で
    //   スタック全体を左右中央に
    // ・セクション高さ（畳み込み展開で変化）の中で上下中央に
    // ・後ろの画像ほど右上に少しはみ出て並ぶ
    //------------------------------------------
    function applyStack(section) {
        const count = images.length;
        if (count === 0) return;

        const rise = STACK_OFFSET_X * Math.min(2, count - 1); // 右上へのはみ出し量

        const front = images[0];
        const imgW = front.offsetWidth;
        const imgH = front.offsetHeight;

        // 水平：右端(right:100%)基準からのずらし量
        // getBoundingClientRect は body の zoom 適用後の座標を返すため、
        // レイアウト座標（transform に渡す値）に割り戻す
        const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
        const areaW = Math.min(section.getBoundingClientRect().left / zoom, 1000); // 左エリアの幅
        const gap = Math.max(16, (areaW - imgW - rise) / 2);
        const dx0 = gap - (areaW - imgW); // 前面画像の左端が gap に来るように

        // 垂直：セクション高さの中でスタック全体を中央に
        const dy0 = (section.clientHeight - imgH + rise) / 2;

        images.forEach((img, i) => {
            const li = img.closest("li");
            const order = (i - frontIndex + count) % count; // 0 = 先頭

            const dx = dx0 + order * STACK_OFFSET_X;
            const dy = dy0 - li.offsetTop - order * STACK_OFFSET_Y;

            img.style.transform = `translate(${dx}px, ${dy}px)`;
            img.style.zIndex = String(count - order);
            img.style.opacity = order < 3 ? "1" : "0"; // 前3枚だけ見せる
        });
    }

    //------------------------------------------
    // Loop
    //------------------------------------------
    function next() {
        if (images.length < 2) return;
        frontIndex = (frontIndex + 1) % images.length;
        const section = getSection();
        if (section) applyStack(section);
    }

    function startTimer() {
        stopTimer();
        timer = setInterval(next, SWITCH_INTERVAL);
    }

    function stopTimer() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    //------------------------------------------
    // Refresh（タブ・畳み込み・リサイズ・データ差替え後）
    //------------------------------------------
    function refresh() {

        const section = getSection();
        if (!section) return;

        withoutTransition(() => {

            // 前回分の transform を掃除
            images.forEach((img) => {
                img.style.transform = "";
                img.style.zIndex = "";
                img.style.opacity = "";
            });

            const list = getActiveList(section);
            if (!list) return;

            images = collectImages(list);
            frontIndex = 0;

            if (images.length === 0) {
                stopTimer();
                return;
            }

            applyStack(section);

        });

        startTimer();

    }

    function withoutTransition(callback) {

        images.forEach(img => {
            img.style.transition = "none";
        });

        callback();

        requestAnimationFrame(() => {

            images.forEach(img => {
                img.style.transition = "";

            });

        });

    }

    //------------------------------------------
    // Event
    //------------------------------------------
    // Next.js: 初回描画は HomeV2.init が refresh() を呼ぶ
    let resizeTimer = null;

    window.addEventListener("resize", () => {

        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(refresh, 100);

    });
    document.addEventListener("visibilitychange", () => {
        document.hidden ? stopTimer() : startTimer();
    });

    //------------------------------------------
    // Settle（アニメーションなしで測り直し）
    // Safari では DOMContentLoaded 時点の計測がずれることが
    // あるため、読込完了後の再配置用に transition を止めて実行する
    //------------------------------------------
    function setTransitions(value) {
        document
            .querySelectorAll("section.notice .n_img")
            .forEach((img) => { img.style.transition = value; });
    }

    function settle() {
        setTransitions("none");
        refresh();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setTransitions(""));
        });
    }

    //------------------------------------------
    // Export
    //------------------------------------------
    window.NoticeImg = { refresh, settle, stop: stopTimer };
})();


/* ===================== js/book_info.js ===================== */
/* ==========================================================
   Book Info ポップアップ
   ・ページ内すべての .book（本棚 / Pick Up / New Release /
     4カラム）タッチで、その本の情報を
     div.book_info に流し込み、開いた本としてポップアップ
   ・別 JS からも window.BookInfo.open(data) で開ける
     data: { id, href, title, author, head, excerpt, comment, tags[] }
========================================================== */

(() => {
    "use strict";

    //------------------------------------------
    // Elements
    //------------------------------------------
    function getRoot() {
        return document.querySelector(".book_info");
    }

    //------------------------------------------
    // Collect（.book の中身から情報を集める）
    //------------------------------------------
    function textOf(book, selector) {
        return book.querySelector(selector)?.textContent.trim() ?? "";
    }

    function collect(book) {
        return {
            id: book.dataset.id ?? "",
            href: book.getAttribute("href") ?? "#",
            title: textOf(book, ".b_title"),
            author: textOf(book, ".b_author"),
            head: textOf(book, ".b_head"),
            excerpt: textOf(book, ".b_excerpt"),
            comment: textOf(book, ".b_comment"),
            likes: textOf(book, ".b_likes"),
            tags: [...book.querySelectorAll(".b_tags li")]
                .map((li) => li.textContent.trim())
                .filter(Boolean),
        };
    }

    //------------------------------------------
    // Render
    //------------------------------------------
    function render(root, data) {
        root.dataset.bookId = data.id;

        root.querySelector(".bi_title").textContent = data.title;
        root.querySelector(".bi_author").textContent = data.author;
        root.querySelector(".bi_head").textContent = data.head;
        root.querySelector(".bi_excerpt").textContent = data.excerpt;
        root.querySelector(".bi_comment").textContent = data.comment;
        root.querySelector(".bi_likes").textContent = data.likes || "0";
        root.querySelector(".bi_read").href = data.href ?? "#";

        const tags = root.querySelector(".bi_tags");
        tags.replaceChildren(
            ...(data.tags ?? []).map((tag) => {
                const li = document.createElement("li");
                li.textContent = tag;
                return li;
            })
        );
    }

    //------------------------------------------
    // Open / Close
    //------------------------------------------
    function open(data) {
        const root = getRoot();
        if (!root) return;

        render(root, data);

        root.classList.add("is_open");
        root.setAttribute("aria-hidden", "false");
        document.body.classList.add("is_modal_open");

        // 背後のループは一時停止
        window.bookshelfLoops?.forEach((loop) => loop.stop());
    }

    function close() {
        const root = getRoot();
        if (!root || !root.classList.contains("is_open")) return;

        root.classList.remove("is_open");
        root.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is_modal_open");

        window.bookshelfLoops?.forEach((loop) => loop.start());
    }


    /*
     * 外から開けるようにする。
     *
     * ランキングや検索など、本棚の外からも
     * 同じ見開きを使いたい。
     * 器も見た目も 1 つにしておけば、
     * 直すときに片方だけ古くなることがない。
     */
    window.openBookInfo = open;
    window.closeBookInfo = close;

    //------------------------------------------
    // Event
    //------------------------------------------
    document.addEventListener("click", (e) => {
        // 本棚・Pick Up・New Release・4カラムなど、すべての .book が対象
        const book = e.target.closest("a.book");
        if (book) {
            if (book.dataset.placeholder) {
                e.preventDefault();
                return; // 準備中の本は開かない
            }

            /*
             * 見開きを開くか、そのまま作品ページへ行くか。
             *
             * 設定が「札」の人には、ここで見開きを出さない。
             * React 側の小窓（NovelPopup）が受け持つ。
             *
             * 印は body に付けてある（reader-home が付ける）。
             */
            if (document.body.dataset.workPopup === "card") return;

            e.preventDefault();
            open(collect(book));
            return;
        }

        if (e.target.closest(".bi_close") || e.target.matches(".bi_overlay")) {
            close();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
    });

    //------------------------------------------
    // Export
    //------------------------------------------
    window.BookInfo = { open, close };
})();


/* ===================== ローディング（元: loading.js） ===================== */
(() => {
    "use strict";

    const MIN_SHOW = 900;       // 最低表示時間(ms)
    const FORCE_FINISH = 6000;  // 保険：これ以上は待たない(ms)

    window.__runLoading = function () {
        document.body.classList.add("is_loading");

        const started = performance.now();
        let finished = false;

        function finish() {
            if (finished) return;
            finished = true;

            const wait = Math.max(0, MIN_SHOW - (performance.now() - started));

            setTimeout(() => {
                const loader = document.getElementById("loading");
                document.body.classList.remove("is_loading");
                if (!loader) return;

                loader.classList.add("is_done");
                loader.setAttribute("aria-hidden", "true");
                loader.addEventListener("transitionend", () => loader.remove(), { once: true });
                setTimeout(() => loader.remove(), 1000);
            }, wait);
        }

        if (document.readyState === "complete") {
            finish();
        } else {
            window.addEventListener("load", finish, { once: true });
        }
        setTimeout(finish, FORCE_FINISH);
    };
})();

/* ===================== ライフサイクル（HomeV2.init / teardown） ===================== */
(() => {
    "use strict";

    const GRID_COUNT = 10; // works_refresh.js と同じ表示数

    let settleTimers = [];

    function shuffle(list) {
        const a = [...list];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // 実データをシャッフルし、足りない分は「準備中」で末尾を埋めて10冊固定にする
    function makeProvider(pool, kind) {
        return () => {
            const books = shuffle(pool).slice(0, GRID_COUNT);
            while (books.length < GRID_COUNT) {
                books.push({
                    id: `${kind}-placeholder-${books.length}`,
                    href: "#",
                    title: "作品タイトル（準備中）",
                    author: "作者（準備中）",
                    tags: ["ジャンル"],
                    head: "", excerpt: "", comment: "",
                    likes: 0,
                    placeholder: true,
                });
            }
            return books;
        };
    }

    // 初期配置の測り直し（元: relayout_settle.js / Safari 対策）
    function settle() {
        window.bookshelfLoops?.forEach((loop) => loop.updateLayout());
        window.NoticeImg?.settle();
    }

    window.HomeV2 = {
        /**
         * @param {Object} data
         * @param {Array}  data.pickupPool     Pick Up! の候補プール（実データのみ）
         * @param {Array}  data.newReleasePool New Release! の候補プール（実データのみ）
         */
        init(data = {}) {
            const marker = document.getElementById("home-page");
            if (!marker || marker.dataset.hv2Init) return;
            marker.dataset.hv2Init = "1";

            // 「更新」ボタンのデータ提供元（元: works_refresh.js のプロバイダー形式）
            if (window.WorksRefresh) {
                window.WorksRefresh.register("pickup", makeProvider(data.pickupPool ?? [], "pickup"));
                window.WorksRefresh.register("new_release", makeProvider(data.newReleasePool ?? [], "new"));
            }

            // 各コンポーネント初期化
            window.__initBookshelves?.();
            window.__initCarousels?.();
            window.NoticeImg?.refresh();

            // 背景（bg-paper / bg-binding）はサイト共通 site.js が管理する

            // ローディング解除
            window.__runLoading?.();

            // 測り直し（元: relayout_settle.js）
            settle();
            settleTimers.push(setTimeout(settle, 300));
            if (document.readyState !== "complete") {
                window.addEventListener("load", () => {
                    settle();
                    settleTimers.push(setTimeout(settle, 300));
                }, { once: true });
            }
        },

        teardown() {
            settleTimers.forEach(clearTimeout);
            settleTimers = [];

            window.bookshelfLoops?.forEach((loop) => loop.destroy());
            window.bookshelfLoops = [];

            window.NoticeImg?.stop();

            document.body.classList.remove("is_loading", "is_modal_open");
        },
    };
})();