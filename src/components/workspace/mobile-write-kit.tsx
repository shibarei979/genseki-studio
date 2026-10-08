/**
 * ============================================================
 * 原石航路 Studio
 * 携帯の執筆画面だけの部品
 *
 * ★ 1024px 未満でだけ出す。パソコンの執筆画面には一切出さない。
 *
 * ★ 考え方は「いま何をしているか」で、下に出す道具を入れかえること。
 *
 *   読み返しているとき（キーボードなし）
 *     下の段：話・通し読み・続きを書く・資料・道具
 *   書いているとき（キーボードあり）
 *     キーボードのすぐ上：ルビ・傍点・注釈｜「」『』……――字下げ場面｜戻す・閉じる
 *
 * ★ ルビ・傍点・注釈は、文字を選ばずに付ける。
 *   携帯で文字をなぞって選ぶのは細かくて面倒なので、
 *   カーソルの直前の漢字のかたまりに付ける。
 *   ずれていたら「1字ふやす／へらす」で直す。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSwipeClose } from "@/lib/swipe-close";

/* ------------------------------------------------------------
 * 携帯かどうか
 * ------------------------------------------------------------ */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(max-width: 1023px)");
        const tell = () => setIsMobile(query.matches);
        tell();
        query.addEventListener("change", tell);
        return () => query.removeEventListener("change", tell);
    }, []);

    return isMobile;
}

/* ------------------------------------------------------------
 * キーボードが出ているか
 *
 * ★ 携帯のキーボードは、見えている部分（visualViewport）を縮める。
 *   窓の高さとの差が大きければ、キーボードが出ている。
 *
 * ★ 返す inset は、画面の下からキーボードの上までの高さ。
 *   キーボードの上の段は、ここに置く。
 * ------------------------------------------------------------ */
/*
 * ★ iPhone の新しい Safari（iOS 26〜）は、キーボードの上に「gensekikoro.com」の住所の札と
 *   「∧ ∨ ✓」の帯を浮かせて出す（どちらも Safari のもので、頁の側からは消せない）。
 *
 *   実機の画面で測ると、見えている部分（visualViewport）の下端は、住所の札のすぐ上で終わっていた。
 *   つまり見えている部分の下端に置けば、Safari の札や帯には重ならない。
 *   前は帯のぶん（56px）さらに持ち上げていたため、画面の途中に浮いて見えていた。足すぶんは 0 にする。
 *   （どの版でも「見えている部分の下端に置く」だけでよい）
 */
function floatingBarExtra(): number {
    return 0;
}

export function useKeyboard(): { isOpen: boolean; inset: number; anchor: number | null; viewTop: number | null } {
    const [state, setState] = useState<{ isOpen: boolean; inset: number; anchor: number | null; viewTop: number | null }>({ isOpen: false, inset: 0, anchor: null, viewTop: null });

    useEffect(() => {
        const vv = window.visualViewport;

        /*
         * ★ 端末によって、キーボードの出方が 2 通りある。
         *
         *   iPhone    窓の高さはそのまま。見えている部分だけ縮む。
         *             → 差（inset）のぶん、上に持ち上げて置く。
         *   Android   窓そのものが縮むことが多い。
         *             → 差は 0 のまま。下に置けば、そのままキーボードの上。
         *
         *   どちらでも「書く欄を触っていて、どこかが 120px 以上縮んだ」なら
         *   キーボードが出ているとみなす。
         */
        /*
         * ★ いちばん高かった窓の高さは、幅ごとに覚える。
         *   縦で測った高さのままだと、横にしただけで「縮んだ」と見なしてしまう。
         */
        const tallestByWidth = new Map<number, number>();
        const extra = floatingBarExtra();

        function tell() {
            const w = window.innerWidth;
            const tallest = Math.max(tallestByWidth.get(w) ?? 0, window.innerHeight);
            tallestByWidth.set(w, tallest);
            const gap = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
            const shrunk = tallest - window.innerHeight;
            const active = document.activeElement;
            const typing =
                !!active &&
                (active.tagName === "TEXTAREA" ||
                    (active.tagName === "INPUT" && (active as HTMLInputElement).type === "text") ||
                    (active as HTMLElement).isContentEditable);
            const isOpen = typing && (gap > 120 || shrunk > 120);
            const inset = isOpen ? gap + extra : 0;
            /*
             * ★ 置く場所は「見えている部分の上端から」決める（anchor）。
             *   画面の下からの距離（inset）で決めると、新しい iPhone の Safari では
             *   キーボードを出したときに窓の高さの値（innerHeight）も変わるため、
             *   少し足りずに帯に重なったり、画面の途中まで浮いたりしていた。
             *   固定した部品の基準（頁の窓の上端）から見た、見えている部分の下端に置く。
             */
            const anchor = isOpen && vv ? Math.round(vv.offsetTop + vv.height - extra) : null;
            /*
             * ★ 見えている部分の上端（頁の窓の上端から）。
             *   書いているあいだは、道具の段をここ（画面の一番上）に出す。
             *   iPhone の Safari は、キーボードの上に住所の札と「∧ ∨ ✓」の帯を重ねて出し、
             *   下に置いた段がどうしても隠れるため。上には何も重ならない。
             */
            const viewTop = isOpen ? Math.round(vv ? vv.offsetTop : 0) : null;
            document.documentElement.style.setProperty("--kb-extra", `${isOpen ? extra : 0}px`);
            /* 同じなら描き直さない（見えている部分が動くたびに呼ばれる） */
            setState((prev) =>
                prev.isOpen === isOpen && prev.inset === inset && prev.anchor === anchor && prev.viewTop === viewTop
                    ? prev
                    : { isOpen, inset, anchor, viewTop },
            );
        }

        tell();
        vv?.addEventListener("resize", tell);
        vv?.addEventListener("scroll", tell);
        window.addEventListener("resize", tell);
        document.addEventListener("focusin", tell);
        const onOut = () => window.setTimeout(tell, 60);
        document.addEventListener("focusout", onOut);
        return () => {
            vv?.removeEventListener("resize", tell);
            vv?.removeEventListener("scroll", tell);
            window.removeEventListener("resize", tell);
            document.removeEventListener("focusin", tell);
            document.removeEventListener("focusout", onOut);
        };
    }, []);

    return state;
}

/* ------------------------------------------------------------
 * 書くときに、画面が勝手に大きくならないようにする（iPhone）
 *
 * ★ iPhone は、16px より小さい字の欄を押すと、画面を拡大する。
 *   携帯の横書きは 1 行 24 字にしているので、字は 14px ほど。
 *   押すたびに拡大され、右が切れ、キーボードの上の段もずれて被っていた。
 *
 * ★ この画面にいるあいだだけ、拡大の上限を 1 倍にする。
 *   iPhone は、これでも指で広げる拡大はできる（押したときの自動拡大だけ止まる）。
 *   離れたら元に戻す。iPhone 以外では何もしない。
 * ------------------------------------------------------------ */
export function useNoFocusZoom(active: boolean) {
    useEffect(() => {
        if (!active) return;
        const ua = navigator.userAgent;
        const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
        if (!isIOS) return;
        const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
        if (!meta) return;
        const before = meta.getAttribute("content") ?? "";
        if (/maximum-scale/.test(before)) return;
        meta.setAttribute("content", `${before}${before ? ", " : ""}maximum-scale=1`);
        return () => {
            meta.setAttribute("content", before);
        };
    }, [active]);
}

/**
 * キーボードの上に出す部品の置き場所。
 * anchor（見えている部分の下端）があれば、そこに下端を合わせる（translate で自分の高さぶん上げる）。
 * 無ければ、これまでどおり画面の下からの距離で置く。
 */
function placeAt(bottom: number, anchor: number | null, top: number | null = null): React.CSSProperties {
    if (top !== null) return { top, bottom: "auto" };
    if (anchor === null) return { bottom };
    return { top: anchor, bottom: "auto", translate: "0 -100%" };
}

/* ------------------------------------------------------------
 * 絵
 * ------------------------------------------------------------ */
type IconName =
    | "back" | "down" | "list" | "book" | "note" | "grid" | "pen" | "undo" | "kbd"
    | "clock" | "spark" | "swap" | "indent" | "focus" | "gear" | "send" | "eye" | "star" | "link";

export function MwIcon({ name, size = 22 }: { name: IconName; size?: number }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };

    switch (name) {
        case "back": return <svg {...common} strokeWidth={2}><path d="M15 5l-7 7 7 7" /></svg>;
        case "down": return <svg {...common} strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>;
        case "list": return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" /></svg>;
        case "book": return <svg {...common}><path d="M3 5.5c3-1.3 6-1.3 9 .8 3-2.1 6-2.1 9-.8V19c-3-1.3-6-1.3-9 .8-3-2.1-6-2.1-9-.8z" /><path d="M12 6.3v13.5" /></svg>;
        case "note": return <svg {...common}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>;
        case "grid": return <svg {...common}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>;
        case "pen": return <svg {...common} strokeWidth={2}><path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z" /><path d="M13.5 7l3.5 3.5" /></svg>;
        case "undo": return <svg {...common} strokeWidth={1.9}><path d="M9 7L4.5 11.5 9 16" /><path d="M5 11.5h9.5a5 5 0 010 10H12" /></svg>;
        case "kbd": return <svg {...common} strokeWidth={1.7}><rect x="2.5" y="4" width="19" height="11" rx="2" /><path d="M6 8h.01M9.5 8h.01M13 8h.01M16.5 8h.01M8 11.5h8" /><path d="M9 18.5l3 2.5 3-2.5" /></svg>;
        case "clock": return <svg {...common}><path d="M3.5 12a8.5 8.5 0 102.5-6" /><path d="M3.5 4v4h4" /><path d="M12 7.5V12l3 2" /></svg>;
        case "spark": return <svg {...common} strokeWidth={1.7}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>;
        case "swap": return <svg {...common}><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg>;
        case "indent": return <svg {...common}><path d="M10 6h10M10 12h10M4 18h16" /><path d="M4 8.5l3 1.5-3 1.5z" fill="currentColor" /></svg>;
        case "focus": return <svg {...common}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
        case "gear": return <svg {...common} strokeWidth={1.7}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></svg>;
        case "send": return <svg {...common}><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>;
        case "eye": return <svg {...common}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
        case "star": return <svg {...common} fill="currentColor" stroke="none"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></svg>;
        case "link": return <svg {...common}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>;
    }
}

/* ------------------------------------------------------------
 * 上の段
 *
 * ‹ 作品へ戻る ｜ 話の題（押すと話の一覧）・保存の印 ｜ 投稿
 * ------------------------------------------------------------ */
export function MobileEditorHeader({
    title,
    saveLabel,
    saveTone,
    backHref,
    postHref,
    unposted,
    onOpenList,
    todayChars = null,
}: {
    title: string;
    saveLabel: string;
    saveTone: "ok" | "draft" | "busy";
    /** 今日この作品で書いた文字数。null なら出さない */
    todayChars?: number | null;
    backHref: string;
    postHref: string;
    unposted: number;
    onOpenList: () => void;
}) {
    return (
        <div className="mw-head">
            <Link href={backHref} className="mw-iconbtn" aria-label="作品の一覧へ戻る">
                <MwIcon name="back" />
            </Link>

            <button type="button" className="mw-head-title" onClick={onOpenList}>
                <span className="mw-head-ep">
                    <span className="mw-head-ep-text">{title || "（題なし）"}</span>
                    <MwIcon name="down" size={15} />
                </span>
                <span className="mw-head-sub">
                    <span className={`mw-head-save is-${saveTone}`}>{saveLabel}</span>
                    {/* ★ 今日この作品で書いた文字数 */}
                    {todayChars !== null && <span className="mw-head-today">今日 +{todayChars.toLocaleString()}</span>}
                </span>
            </button>

            <Link href={postHref} className="mw-post">
                <MwIcon name="send" size={15} />
                投稿
                {unposted > 0 && <span className="mw-post-count">{unposted}</span>}
            </Link>
        </div>
    );
}

/* ------------------------------------------------------------
 * 下の段（キーボードを出していないとき）
 *
 * 話・［入れかえ 1］・続きを書く・［入れかえ 2］・道具
 * ------------------------------------------------------------ */
export type BarSlot = "read" | "resource" | "mentions" | "proofread" | "history" | "replace" | "focus";

export const SLOT_LABEL: Record<BarSlot, { label: string; icon: IconName }> = {
    read: { label: "通し読み", icon: "book" },
    /* ★ 「資料」は作品の資料の頁をひらく。前は「この話に出る資料」の窓が開き、別の物に見えていた */
    resource: { label: "資料", icon: "note" },
    mentions: { label: "話の資料", icon: "note" },
    proofread: { label: "誤字脱字", icon: "spark" },
    history: { label: "履歴", icon: "clock" },
    replace: { label: "置き換え", icon: "swap" },
    focus: { label: "集中", icon: "focus" },
};

const SLOT_KEY = "gk-write-bar";
const DEFAULT_SLOTS: [BarSlot, BarSlot] = ["read", "resource"];

/**
 * 下の段の入れかえ 2 か所。
 *
 * ★ この端末の中だけに覚える（その人の使い方の好み）。
 *   読めない端末でも、決まりの並びで出る。
 */
export function useBarSlots(): [[BarSlot, BarSlot], (next: [BarSlot, BarSlot]) => void] {
    const [slots, setSlots] = useState<[BarSlot, BarSlot]>(DEFAULT_SLOTS);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(SLOT_KEY) || "null");
            if (
                Array.isArray(saved) &&
                saved.length === 2 &&
                /* in だと toString なども通ってしまうので、自分の持ち物だけを見る */
                saved.every((one) => typeof one === "string" && Object.prototype.hasOwnProperty.call(SLOT_LABEL, one)) &&
                saved[0] !== saved[1]
            ) {
                setSlots(saved as [BarSlot, BarSlot]);
            }
        } catch {
            /* 読めなくても、決まりの並びで出す */
        }
    }, []);

    function save(next: [BarSlot, BarSlot]) {
        setSlots(next);
        try {
            localStorage.setItem(SLOT_KEY, JSON.stringify(next));
        } catch {
            /* 覚えられなくても、いまの画面では効く */
        }
    }

    return [slots, save];
}

export function MobileBottomBar({
    slots,
    onList,
    onSlot,
    onTools,
    onSettings,
}: {
    slots: [BarSlot, BarSlot];
    onList: () => void;
    onSlot: (slot: BarSlot) => void;
    /** 使っていない（「続きを書く」を外したため）。呼ぶ側を変えずに済むよう残す */
    onWrite?: () => void;
    onTools: () => void;
    /** 作品の設定の頁へ */
    onSettings?: () => void;
}) {
    return (
        <nav className="mw-bar" aria-label="執筆の道具">
            <button type="button" className="mw-bar-item" onClick={onList}>
                <MwIcon name="list" size={24} />話
            </button>
            <button type="button" className="mw-bar-item" onClick={() => onSlot(slots[0])}>
                <MwIcon name={SLOT_LABEL[slots[0]].icon} size={24} />
                {SLOT_LABEL[slots[0]].label}
            </button>
            {/* ★ 「続きを書く」は外した（本文を押せば書ける。下の段を広く使う） */}
            <button type="button" className="mw-bar-item" onClick={() => onSlot(slots[1])}>
                <MwIcon name={SLOT_LABEL[slots[1]].icon} size={24} />
                {SLOT_LABEL[slots[1]].label}
            </button>
            {/* ★ 作品の設定（題名・あらすじ・表紙など）へ。資料の横に置く */}
            {onSettings && (
                <button type="button" className="mw-bar-item" onClick={onSettings}>
                    <MwIcon name="gear" size={24} />設定
                </button>
            )}
            <button type="button" className="mw-bar-item" onClick={onTools}>
                <MwIcon name="grid" size={24} />道具
            </button>
        </nav>
    );
}

/* ------------------------------------------------------------
 * キーボードのすぐ上の段
 *
 * ★ 左はしにルビ・傍点・注釈、右に打ちにくい記号。
 *   右はしの「戻す」「キーボードを閉じる」は、いつも同じ場所。
 *
 * ★ 押しても本文からフォーカスを外さない（onMouseDown で止める）。
 *   外れるとキーボードが一度しまわれ、画面が跳ねる。
 * ------------------------------------------------------------ */
export function MobileKeyBar({
    bottom,
    anchor = null,
    top = null,
    inline = false,
    saving = false,
    onRuby,
    onEmphasis,
    onNote,
    onInsert,
    onUndo,
    canUndo,
    onClose,
}: {
    bottom: number;
    /** 見えている部分の下端（頁の窓の上端から）。あればこちらで置く */
    anchor?: number | null;
    /** 見えている部分の上端。あれば画面の一番上に出す（書いているあいだ） */
    top?: number | null;
    /** 話の題の帯の所に、帯と入れ替えて出す（固定しない） */
    inline?: boolean;
    /** 保存中か（完了の札に小さな点で出す） */
    saving?: boolean;
    onRuby: () => void;
    onEmphasis: () => void;
    onNote: () => void;
    onInsert: (open: string, close?: string) => void;
    onUndo: () => void;
    canUndo: boolean;
    onClose: () => void;
}) {
    const keep = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();

    const marks: { label: string; open: string; close?: string; serif?: boolean }[] = [
        { label: "「」", open: "「", close: "」", serif: true },
        { label: "『』", open: "『", close: "』", serif: true },
        { label: "……", open: "……", serif: true },
        { label: "――", open: "――", serif: true },
        { label: "字下げ", open: "　" },
        { label: "場面", open: "\n────────────\n" },
    ];

    return (
        <div
            className={`mw-key${inline ? " is-inline" : top !== null ? " is-top" : ""}`}
            style={inline ? undefined : placeAt(bottom, anchor, top)}
            onMouseDown={keep}
        >
            <div className="mw-key-scroll">
                {inline ? (
                    /* ★ ルビ・傍点・注釈は 1 つの札にまとめる（同じ仲間だと一目で分かり、幅も詰まる） */
                    <span className="mw-key-group" role="group" aria-label="文字に付ける">
                        <button type="button" onClick={onRuby}>ルビ</button>
                        <button type="button" onClick={onEmphasis}>傍点</button>
                        <button type="button" onClick={onNote}>注釈</button>
                    </span>
                ) : (
                    <>
                        <button type="button" className="mw-k is-mark" onClick={onRuby}>ルビ</button>
                        <button type="button" className="mw-k is-mark" onClick={onEmphasis}>傍点</button>
                        <button type="button" className="mw-k is-mark" onClick={onNote}>注釈</button>
                        <span className="mw-key-sep" aria-hidden="true" />
                    </>
                )}
                {marks.map((one) => (
                    <button
                        key={one.label}
                        type="button"
                        className={`mw-k${one.serif ? " is-serif" : ""}`}
                        onClick={() => onInsert(one.open, one.close)}
                    >
                        {one.label}
                    </button>
                ))}
            </div>
            <div className="mw-key-fixed">
                <button type="button" className="mw-iconbtn" onClick={onUndo} disabled={!canUndo} aria-label="戻す">
                    <MwIcon name="undo" />
                </button>
                {inline ? (
                    /* ★ 投稿の押し具と同じ場所・同じ形。押すとキーボードをしまい、話の題の帯に戻る */
                    <button type="button" className="mw-key-done" onClick={onClose} aria-label={saving ? "完了（保存中）" : "完了（保存済み）"}>
                        {/* ★ 書いているあいだも保存の様子が分かるように。緑＝保存済み、灰の点滅＝保存中 */}
                        <i className={`mw-key-dot${saving ? " is-busy" : ""}`} aria-hidden="true" />
                        完了
                    </button>
                ) : (
                    <button type="button" className="mw-iconbtn" onClick={onClose} aria-label="キーボードを閉じる">
                        <MwIcon name="kbd" size={24} />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------
 * 付ける文字を決める
 *
 * ★ カーソルの直前の「漢字のかたまり」。
 *   々・〆・ヶ も漢字の仲間に入れる（人々・〆切・一ヶ月）。
 *   漢字が無ければ、カタカナのかたまり、それも無ければ直前の 1 字。
 * ------------------------------------------------------------ */
const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ\u{20000}-\u{3FFFF}]/u;
const KATAKANA = /[ァ-ヺー]/;

/*
 * ★ 𠮷 のような字は、2 つぶんの長さを持つ。
 *   半分で切ると字が壊れるので、1 字ずつ数えるときはここを通す。
 */
function isPair(text: string, at: number): boolean {
    const hi = text.charCodeAt(at);
    const lo = text.charCodeAt(at + 1);
    return hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff;
}

/** pos の直前の 1 字の長さ（1 か 2） */
export function stepBack(text: string, pos: number): number {
    return pos >= 2 && isPair(text, pos - 2) ? 2 : 1;
}

/** pos から始まる 1 字の長さ（1 か 2） */
export function stepFwd(text: string, pos: number): number {
    return isPair(text, pos) ? 2 : 1;
}

export function guessBaseLength(text: string, caret: number): number {
    const before = text.slice(0, caret);

    const run = (re: RegExp) => {
        let n = 0;
        while (n < before.length) {
            const at = before.length - n;
            const step = stepBack(before, at);
            if (!re.test(before.slice(at - step, at))) break;
            n += step;
        }
        return n;
    };

    const kanji = run(KANJI);
    if (kanji > 0) return kanji;

    const kana = run(KATAKANA);
    if (kana > 0) return kana;

    /* 改行の直後などは、付ける字が無い */
    return before.length > 0 && before[before.length - 1] !== "\n" ? stepBack(before, before.length) : 0;
}

/* ------------------------------------------------------------
 * ルビ・傍点・注釈を付ける小窓（キーボードのすぐ上）
 * ------------------------------------------------------------ */
export type MarkKind = "ruby" | "dot" | "note";

export function MobileMarkPanel({
    bottom,
    anchor = null,
    top = null,
    inline = false,
    kind,
    onKind,
    base,
    canGrow,
    canShrink,
    onGrow,
    onShrink,
    reading,
    onReading,
    autoFilled,
    onApply,
    onCancel,
}: {
    bottom: number;
    anchor?: number | null;
    top?: number | null;
    inline?: boolean;
    kind: MarkKind;
    onKind: (kind: MarkKind) => void;
    base: string;
    canGrow: boolean;
    canShrink: boolean;
    onGrow: () => void;
    onShrink: () => void;
    reading: string;
    onReading: (value: string) => void;
    autoFilled: boolean;
    onApply: () => void;
    onCancel: () => void;
}) {
    const title = kind === "ruby" ? "ルビを付ける" : kind === "dot" ? "傍点を付ける" : "注釈を付ける";

    return (
        <div
            className={`mw-mark${inline ? " is-inline" : top !== null ? " is-top" : ""}`}
            style={inline ? undefined : placeAt(bottom, anchor, top)}
            /*
             * ★ 押しても本文からフォーカスを外さない（キーボードの上の段と同じ）。
             *   外れるとキーボードがしまわれ、付けたあと書き続けられない。
             *   読みの欄だけは、押して打てるようにそのまま。
             */
            onMouseDown={(e) => {
                if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
        >
            <div className="mw-mark-top">
                <b>{title}</b>
                <div className="mw-mark-tabs">
                    {(["ruby", "dot", "note"] as MarkKind[]).map((one) => (
                        <button
                            key={one}
                            type="button"
                            className={one === kind ? "is-on" : ""}
                            onClick={() => onKind(one)}
                        >
                            {one === "ruby" ? "ルビ" : one === "dot" ? "傍点" : "注釈"}
                        </button>
                    ))}
                </div>
                <button type="button" className="mw-mark-x" onClick={onCancel}>やめる</button>
            </div>

            {base ? (
                <>
                    <div className="mw-mark-in">
                        {kind === "dot" ? (
                            <span className="mw-mark-base is-dot">{base}</span>
                        ) : (
                            <span className="mw-mark-base">{base}</span>
                        )}

                        {kind === "ruby" && (
                            <label className="mw-mark-field">
                                <input
                                    value={reading}
                                    onChange={(e) => onReading(e.target.value)}
                                    placeholder="読みを入力"
                                    autoFocus
                                    enterKeyHint="done"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                            e.preventDefault();
                                            onApply();
                                        }
                                    }}
                                />
                                {autoFilled && reading && <em>読みを入れました</em>}
                            </label>
                        )}

                        {kind === "note" && (
                            <span className="mw-mark-hint">次の画面で説明を書きます</span>
                        )}

                        <button
                            type="button"
                            className="mw-mark-ok"
                            onClick={onApply}
                            disabled={kind === "ruby" && !reading.trim()}
                        >
                            {kind === "note" ? "次へ" : "付ける"}
                        </button>
                    </div>

                    <div className="mw-mark-adj">
                        <span>付ける文字：直前の「{base}」</span>
                        <button type="button" onClick={onGrow} disabled={!canGrow}>‹ 1字ふやす</button>
                        <button type="button" onClick={onShrink} disabled={!canShrink}>1字へらす ›</button>
                    </div>
                </>
            ) : (
                <p className="mw-mark-empty">
                    付けたい言葉のすぐ後ろを1回タップして、もう一度押してください。
                </p>
            )}
        </div>
    );
}

/* ------------------------------------------------------------
 * 「道具」を押したとき
 * ------------------------------------------------------------ */
export function MobileToolsSheet({
    workId,
    onClose,
    slots,
    onPin,
    onSlot,
    onIndent,
    onNormalize,
    normalizeLabel,
    isFocusMode,
    zoom,
    onZoom,
    showLineNumbers,
    onToggleLineNumbers,
}: {
    workId: string;
    onClose: () => void;
    slots: [BarSlot, BarSlot];
    onPin: (slot: BarSlot) => void;
    onSlot: (slot: BarSlot) => void;
    onIndent: () => void;
    onNormalize: () => void;
    normalizeLabel: string;
    isFocusMode: boolean;
    zoom: number;
    onZoom: (next: number) => void;
    showLineNumbers: boolean;
    onToggleLineNumbers: () => void;
}) {
    const tile = (slot: BarSlot, sub: string, pro = false) => {
        const pinned = slots.includes(slot);
        return (
            <div className="mw-tile" key={slot}>
                <button type="button" className="mw-tile-main" onClick={() => { onClose(); onSlot(slot); }}>
                    <MwIcon name={SLOT_LABEL[slot].icon} />
                    <span>
                        <b>{slot === "focus" ? (isFocusMode ? "集中を解く" : "集中モード") : SLOT_LABEL[slot].label}</b>
                        <small>{sub}</small>
                    </span>
                </button>
                {pro && <span className="mw-pro">Pro</span>}
                <button
                    type="button"
                    className={`mw-pin${pinned ? " is-on" : ""}`}
                    onClick={() => onPin(slot)}
                    aria-label={pinned ? "下の段に置いています" : "下の段に置く"}
                    title="★ を押すと下の段に置きます"
                >
                    <MwIcon name="star" size={16} />
                </button>
            </div>
        );
    };

    /* 見出し（道具〜とじる）とつまみを下へなでると閉じる */
    const sheetRef = useRef<HTMLDivElement>(null);
    const headRef = useRef<HTMLDivElement>(null);
    useSwipeClose(headRef, sheetRef, onClose, true);

    /*
     * ★ 体の直下に出す。
     *   書く欄の中（字の大きさを幅で決めるための入れ物）に置くと、
     *   画面いっぱいに広がらず、右にずれて見えていた。
     */
    if (typeof document === "undefined") return null;
    return createPortal(
        <div className="mw-sheet-wrap" role="dialog" aria-label="道具">
            <button type="button" className="mw-dim" onClick={onClose} aria-label="とじる" />
            <div className="mw-sheet" ref={sheetRef}>
                <div ref={headRef} className="mw-sheet-top">
                <div className="mw-grab" />
                <div className="mw-sheet-head">
                    <h3>道具</h3>
                    <button type="button" onClick={onClose}>とじる</button>
                </div>
                </div>

                <div className="mw-jump">
                    <Link href={`/workspace/${workId}/settings`}><MwIcon name="gear" size={20} />設定</Link>
                    <Link href={`/workspace/${workId}/resource`}><MwIcon name="note" size={20} />資料</Link>
                    <Link href={`/workspace/${workId}/post`}><MwIcon name="send" size={20} />投稿</Link>
                    <Link href={`/workspace/${workId}/preview`}><MwIcon name="eye" size={20} />読者の目</Link>
                </div>

                <div className="mw-grp">
                    <div className="mw-gh">読み返す</div>
                    <div className="mw-tiles">
                        {tile("read", "前の話から続けて")}
                        {tile("proofread", "誤字・表記の揺れ", true)}
                        {tile("history", "前の版に戻す")}
                        {tile("resource", "作品の資料をひらく")}
                        {tile("mentions", "この話に出る資料")}
                    </div>
                </div>

                <div className="mw-grp">
                    <div className="mw-gh">整える</div>
                    <div className="mw-tiles">
                        <div className="mw-tile">
                            <button type="button" className="mw-tile-main" onClick={() => { onClose(); onIndent(); }}>
                                <MwIcon name="indent" />
                                <span><b>字下げ</b><small>段落の頭をそろえる</small></span>
                            </button>
                        </div>
                        {tile("replace", "名前をまとめて直す")}
                        {tile("focus", "本文だけにする")}
                        <div className="mw-tile">
                            <button type="button" className="mw-tile-main" onClick={() => { onClose(); onNormalize(); }}>
                                <MwIcon name="spark" />
                                <span><b>{normalizeLabel}</b><small>記号や数字をそろえる</small></span>
                            </button>
                        </div>
                    </div>
                    <p className="mw-pin-note">★ を押すと、下の段の2か所（話と道具のあいだ）に置けます。</p>
                </div>

                <div className="mw-grp">
                    <div className="mw-gh">見え方</div>
                    <div className="mw-row">
                        <span>文字の大きさ</span>
                        <div className="mw-stepper">
                            <button type="button" onClick={() => onZoom(Math.max(0.7, +(zoom - 0.1).toFixed(1)))} disabled={zoom <= 0.7}>A</button>
                            <button type="button" className="mw-stepper-mid" onClick={() => onZoom(1)}>{Math.round(zoom * 100)}%</button>
                            <button type="button" className="is-big" onClick={() => onZoom(Math.min(1.6, +(zoom + 0.1).toFixed(1)))} disabled={zoom >= 1.6}>A</button>
                        </div>
                    </div>
                    <div className="mw-row">
                        <span>行番号を出す</span>
                        <button
                            type="button"
                            className={`mw-switch${showLineNumbers ? " is-on" : ""}`}
                            onClick={onToggleLineNumbers}
                            aria-pressed={showLineNumbers}
                            aria-label="行番号を出す"
                        />
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
