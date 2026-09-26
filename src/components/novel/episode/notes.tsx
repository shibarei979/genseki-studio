/**
 * ============================================================
 * 原石航路 Studio
 * 注釈を読む（印・吹き出し・下から出る欄・話の終わりの一覧）
 *
 * ★ 印：注釈のある言葉に点線の下線と小さな ※番号。
 *   縦書きでは、点線は言葉の左、番号は言葉の後ろに小さく立てる。
 *
 * ★ 押すと
 *   パソコン：言葉のすぐ近くに吹き出し
 *   スマホ　：画面の下から説明の欄（前後の注釈へも送れる）
 *
 * ★ 話の終わりに「注釈」の一覧。「本文へ ↑」で元の場所に戻れる。
 *   一覧ははじめ畳んでおく（▸ 注釈 3件）。あとがきの下が長くならないように。
 *   吹き出しの「注釈の一覧で見る」を押したときは、開いてから そこへ送る。
 *
 * ★ 読書設定で「注釈の印を出す」を切れる。切っても一覧は残す。
 * ============================================================
 */

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { NoteItem } from "@/lib/utils/annotation";
import { splitNoteTokens } from "@/lib/utils/annotation";

/* ---------- 番号の表と、印を出すか ---------- */

export interface NoteContextValue {
    lookup?: Map<string, number>;
    show: boolean;
}

export const NoteContext = createContext<NoteContextValue>({ show: true });

export function useNoteContext(): NoteContextValue {
    return useContext(NoteContext);
}

/* ---------- 見た目（どの画面でも同じ） ---------- */

export function NoteStyles() {
    return (
        <style>{`
.gk-note{cursor:pointer;text-decoration-line:underline;text-decoration-style:dotted;text-decoration-color:var(--color-brand,#1f4e6b);text-decoration-thickness:1.5px;text-underline-offset:.28em;border-radius:2px}
.gk-note:hover,.gk-note:focus-visible,.gk-note--active{background:var(--color-brand-light,#e6eef4);outline:none}
.gk-note--bare{text-decoration:none}
.gk-note-num{display:inline-block;text-decoration:none;font-family:var(--font-sans),sans-serif;font-size:.55em;font-weight:700;color:var(--color-brand,#1f4e6b);margin-left:1px;line-height:1;vertical-align:.9em}
.gk-vertical .gk-note{text-underline-position:left}
.gk-vertical .gk-note-num{vertical-align:baseline;font-size:.5em;margin:0}
@keyframes gk-note-flash{0%{background:var(--color-brand-light,#e6eef4)}100%{background:transparent}}
.gk-note--flash{animation:gk-note-flash 1.6s ease-out}
`}</style>
    );
}

/* ---------- 縦書き（React で組む画面）用 ---------- */

/**
 * 目印の入った文を、印つきで組む。
 *
 * @param renderPlain  ふつうの文字の組み方（縦中横などはそちらに任せる）
 */
export function renderNoteTokens(
    text: string,
    key: string,
    renderPlain: (text: string, key: string) => ReactNode,
): ReactNode[] {
    if (!/[]/.test(text)) return [renderPlain(text, key)];

    const segments = splitNoteTokens(text);
    const nodes: ReactNode[] = [];
    let i = 0;

    const number = (n: number, k: string) => (
        <span key={k} className="gk-note-num">
            ※<span style={{ textCombineUpright: "all" } as React.CSSProperties}>{n}</span>
        </span>
    );

    while (i < segments.length) {
        const seg = segments[i];

        if (seg.type === "text") {
            nodes.push(renderPlain(seg.body, `${key}-${i}`));
            i += 1;
            continue;
        }

        if (seg.type === "start") {
            /* 同じ番号の終わりまでを、1 つの印にまとめる */
            const endAt = segments.findIndex((s, j) => j > i && s.type === "end" && s.n === seg.n);
            if (endAt > i) {
                const inner = segments
                    .slice(i + 1, endAt)
                    .map((s) => (s.type === "text" ? s.body : ""))
                    .join("");
                nodes.push(
                    <span
                        key={`${key}-n${i}`}
                        className="gk-note"
                        data-gk-note={seg.n}
                        role="button"
                        tabIndex={0}
                        aria-label={`注釈${seg.n}`}
                    >
                        {renderPlain(inner, `${key}-in${i}`)}
                        {number(seg.n, `${key}-num${i}`)}
                    </span>,
                );
                i = endAt + 1;
                continue;
            }
            /* 終わりが別の所（ふりがなの向こう）にある。開きは捨てる */
            i += 1;
            continue;
        }

        /* 終わりだけ。番号だけ押せるようにする */
        nodes.push(
            <span
                key={`${key}-b${i}`}
                className="gk-note gk-note--bare"
                data-gk-note={seg.n}
                role="button"
                tabIndex={0}
                aria-label={`注釈${seg.n}`}
            >
                {number(seg.n, `${key}-bn${i}`)}
            </span>,
        );
        i += 1;
    }

    return nodes;
}

/* ---------- 押したときの吹き出し・下から出る欄 ---------- */

export function NoteLayer({ items }: { items: NoteItem[] }) {
    const [open, setOpen] = useState<{ n: number; rect: DOMRect | null } | null>(null);
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        const check = () => setIsNarrow(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    const openAt = useCallback((element: HTMLElement) => {
        const n = Number(element.dataset.gkNote);
        if (!n) return;
        document.querySelectorAll(".gk-note--active").forEach((el) => el.classList.remove("gk-note--active"));
        element.classList.add("gk-note--active");
        setOpen({ n, rect: element.getBoundingClientRect() });
    }, []);

    const close = useCallback(() => {
        document.querySelectorAll(".gk-note--active").forEach((el) => el.classList.remove("gk-note--active"));
        setOpen(null);
    }, []);

    useEffect(() => {
        if (items.length === 0) return;

        function onClick(event: MouseEvent) {
            const target = (event.target as HTMLElement | null)?.closest?.("[data-gk-note]") as HTMLElement | null;
            if (target) {
                event.preventDefault();
                openAt(target);
                return;
            }
            if (!(event.target as HTMLElement | null)?.closest?.("[data-gk-note-panel]")) close();
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") close();
            if (event.key === "Enter") {
                const target = (event.target as HTMLElement | null)?.closest?.("[data-gk-note]") as HTMLElement | null;
                if (target) openAt(target);
            }
        }
        function onScroll() {
            if (!isNarrow) close();
        }

        document.addEventListener("click", onClick);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("click", onClick);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [items.length, openAt, close, isNarrow]);

    if (!open) return null;
    const item = items.find((one) => one.index === open.n);
    if (!item) return null;

    const toList = () => {
        close();
        /* 一覧が畳まれていたら開く。開いて描かれてから送る */
        window.dispatchEvent(new CustomEvent(NOTES_OPEN_EVENT));
        const n = item.index;
        window.setTimeout(() => {
            const row = document.getElementById(`gk-note-${n}`);
            row?.scrollIntoView({ behavior: "smooth", block: "center" });
            row?.classList.add("gk-note--flash");
            window.setTimeout(() => row?.classList.remove("gk-note--flash"), 1700);
        }, 60);
    };

    const step = (delta: number) => {
        const next = items.find((one) => one.index === item.index + delta);
        if (!next) return;
        const el = document.querySelector(`[data-gk-note="${next.index}"]`) as HTMLElement | null;
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
            openAt(el);
        } else {
            setOpen({ n: next.index, rect: null });
        }
    };

    const head = (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: "var(--color-brand,#1f4e6b)", color: "#fff", borderRadius: 4, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>
                ※{item.index}
            </span>
            {item.word && <span style={{ fontWeight: 700, fontSize: isNarrow ? 15 : 13, color: "var(--color-text,#1a211d)" }}>{item.word}</span>}
        </div>
    );

    /* スマホ：下から出る欄 */
    if (isNarrow) {
        return (
            <>
                <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.18)" }} />
                <div
                    data-gk-note-panel
                    role="dialog"
                    aria-label={`注釈${item.index}`}
                    style={{
                        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 401,
                        background: "var(--color-bg-card,#fff)", borderTopLeftRadius: 18, borderTopRightRadius: 18,
                        boxShadow: "0 -8px 24px rgba(0,0,0,.14)", padding: "10px 18px calc(18px + env(safe-area-inset-bottom))",
                        fontFamily: "var(--font-sans),sans-serif",
                    }}
                >
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-brand-border,#dcdfda)", margin: "0 auto 10px" }} />
                    {head}
                    <p style={{ fontSize: 14.5, lineHeight: 1.8, margin: "8px 0 12px", color: "var(--color-text,#1a211d)", whiteSpace: "pre-wrap" }}>{item.note}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--color-brand,#1f4e6b)" }}>
                        <button type="button" onClick={() => step(-1)} disabled={item.index <= 1} style={navBtn(item.index <= 1)}>‹ ※{item.index - 1 || ""}</button>
                        <button type="button" onClick={toList} style={navBtn(false)}>注釈の一覧</button>
                        <button type="button" onClick={() => step(1)} disabled={item.index >= items.length} style={navBtn(item.index >= items.length)}>※{item.index < items.length ? item.index + 1 : ""} ›</button>
                    </div>
                </div>
            </>
        );
    }

    /* パソコン：言葉の近くに吹き出し */
    const width = 300;
    const rect = open.rect;
    const left = rect ? Math.min(Math.max(12, rect.left - 12), window.innerWidth - width - 12) : window.innerWidth / 2 - width / 2;
    const below = rect ? rect.bottom + 10 : window.innerHeight / 3;
    const top = below + 160 > window.innerHeight && rect ? Math.max(12, rect.top - 170) : below;

    return (
        <div
            data-gk-note-panel
            role="dialog"
            aria-label={`注釈${item.index}`}
            style={{
                position: "fixed", left, top, width, zIndex: 401,
                background: "var(--color-bg-card,#fff)", border: "1px solid var(--color-brand-border,#b4cede)", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(31,78,107,.16)", padding: "12px 14px", fontFamily: "var(--font-sans),sans-serif",
            }}
        >
            {head}
            <p style={{ fontSize: 13, lineHeight: 1.75, margin: "6px 0 8px", color: "var(--color-text,#1a211d)", whiteSpace: "pre-wrap" }}>{item.note}</p>
            <button type="button" onClick={toList} style={{ ...navBtn(false), fontSize: 11.5 }}>
                注釈の一覧で見る ›
            </button>
        </div>
    );
}

function navBtn(disabled: boolean): React.CSSProperties {
    return {
        background: "none", border: 0, padding: "4px 2px", cursor: disabled ? "default" : "pointer",
        color: "var(--color-brand,#1f4e6b)", opacity: disabled ? 0.3 : 1, font: "inherit",
    };
}

/* ---------- 話の終わりの一覧 ---------- */

/** 吹き出しから「一覧を開いて」と頼むための合図 */
const NOTES_OPEN_EVENT = "gk-notes-open";

export function NotesList({ items }: { items: NoteItem[] }) {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const openList = () => setExpanded(true);
        window.addEventListener(NOTES_OPEN_EVENT, openList);
        return () => window.removeEventListener(NOTES_OPEN_EVENT, openList);
    }, []);

    if (items.length === 0) return null;

    const back = (n: number) => {
        const el = document.querySelector(`[data-gk-note="${n}"]`) as HTMLElement | null;
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        el.classList.add("gk-note--flash");
        window.setTimeout(() => el.classList.remove("gk-note--flash"), 1700);
    };

    return (
        <section
            aria-label="注釈"
            style={{
                borderTop: "1px solid var(--color-brand-border,#dcdfda)", padding: "12px 18px",
                fontFamily: "var(--font-sans),sans-serif", writingMode: "horizontal-tb",
            }}
        >
            <h3 style={{ margin: 0, fontSize: 13 }}>
                <button
                    type="button"
                    onClick={() => setExpanded((on) => !on)}
                    aria-expanded={expanded}
                    aria-controls="gk-notes-list"
                    style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: 0,
                        padding: "2px 0", cursor: "pointer", font: "inherit", fontWeight: 700, textAlign: "left",
                        color: "var(--color-text,#1a211d)",
                    }}
                >
                    <span style={{ width: 3, height: 14, background: "var(--color-brand,#1f4e6b)", borderRadius: 2, display: "inline-block" }} />
                    注釈
                    <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--color-text-muted,#6b746e)" }}>{items.length}件</span>
                    <span
                        aria-hidden
                        style={{
                            marginLeft: "auto", fontSize: 11, color: "var(--color-brand,#1f4e6b)", fontWeight: 400,
                            display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                    >
                        {expanded ? "閉じる" : "開く"}
                        <span style={{ display: "inline-block", transition: "transform .15s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
                    </span>
                </button>
            </h3>
            {expanded && (
            <ol id="gk-notes-list" style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {items.map((item, i) => (
                    <li
                        key={item.index}
                        id={`gk-note-${item.index}`}
                        style={{
                            display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 4px",
                            borderBottom: i < items.length - 1 ? "1px dashed var(--color-brand-border,#dcdfda)" : "none",
                            fontSize: 13, lineHeight: 1.7, color: "var(--color-text,#1a211d)", borderRadius: 4,
                        }}
                    >
                        <span style={{ flex: "none", color: "var(--color-brand,#1f4e6b)", fontWeight: 700, fontSize: 11.5, border: "1px solid var(--color-brand-border,#b4cede)", borderRadius: 4, padding: "0 6px", lineHeight: "19px" }}>
                            ※{item.index}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap" }}>
                            {item.word && <b style={{ marginRight: 6 }}>{item.word}</b>}
                            {item.note}
                        </span>
                        <button type="button" onClick={() => back(item.index)} style={{ ...navBtn(false), flex: "none", fontSize: 11 }}>
                            本文へ ↑
                        </button>
                    </li>
                ))}
            </ol>
            )}
        </section>
    );
}
