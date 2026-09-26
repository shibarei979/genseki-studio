/**
 * ============================================================
 * 原石航路 Studio
 * HelpTip — 小さな「？」。押すと使い方が出る
 *
 * ★ 押し具の中には入れない。横に置く。
 *   押し具の中に入れると、？ を押したときに押し具も反応する。
 *   この部品はそれ自体が 1 つの押し具で、押しても外へ伝えない。
 *
 * ★ パソコン：？ のすぐ下（入らなければ上）に吹き出し
 *   スマホ　：画面の下から説明の欄（注釈と同じ形）
 *
 * ★ 窓は body の直下に出す。
 *   親に transform や overflow があると、固定の窓が切れたりずれたりする。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { HelpTopicId } from "@/lib/help/topics";
import { HELP_TOPICS } from "@/lib/help/topics";

interface Props {
    topic: HelpTopicId;
    className?: string;
    /** 大きさ。既定 16px */
    size?: number;
    /** ？ の横に添える言葉。押し具の横に置く場所が無いときに、下の行に出す */
    label?: string;
}

export default function HelpTip({ topic, className = "", size = 16, label }: Props) {
    const data = HELP_TOPICS[topic];
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [isNarrow, setIsNarrow] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const panelId = useId();

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return;
        const check = () => setIsNarrow(window.innerWidth < 768);
        check();

        function onDown(event: MouseEvent | TouchEvent) {
            const target = event.target as Node | null;
            if (!target) return;
            if (buttonRef.current?.contains(target)) return;
            if ((target as HTMLElement).closest?.(`[data-help-panel="${panelId}"]`)) return;
            setOpen(false);
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        }
        function onMove() {
            if (window.innerWidth >= 768) setOpen(false);
        }

        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", check);
        window.addEventListener("scroll", onMove, true);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", check);
            window.removeEventListener("scroll", onMove, true);
        };
    }, [open, panelId]);

    function toggle(event: React.MouseEvent) {
        /* ★ 外へ伝えない。親が押し具や label でも反応させない */
        event.preventDefault();
        event.stopPropagation();
        if (!open) setRect(buttonRef.current?.getBoundingClientRect() ?? null);
        setOpen((on) => !on);
    }

    const body = (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mark size={18} active />
                <span style={{ fontWeight: 700, fontSize: isNarrow ? 15 : 14, color: "var(--color-text,#1a211d)" }}>
                    {data.title}
                </span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: "var(--color-text-muted,#3c4540)", margin: "6px 0 0" }}>
                {data.what}
            </p>
            {"steps" in data && data.steps && data.steps.length > 0 && (
                <ol style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 7 }}>
                    {data.steps.map((step, i) => (
                        <li key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, lineHeight: 1.65, color: "var(--color-text,#1a211d)" }}>
                            <b
                                style={{
                                    flex: "none", width: 19, height: 19, borderRadius: "50%", marginTop: 1,
                                    background: "var(--color-brand-light,#e6eef4)", color: "var(--color-brand,#1f4e6b)",
                                    fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                {i + 1}
                            </b>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>
            )}
            {"examples" in data && data.examples && data.examples.length > 0 && (
                <div
                    style={{
                        marginTop: 10, border: "1px dashed var(--color-forest-line,#b4cede)", borderRadius: 8,
                        background: "var(--color-canvas,#f7fafb)", padding: "8px 10px", display: "grid", gap: 6,
                    }}
                >
                    {data.examples.map((one, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26 }}>
                            <span style={{ width: 30, flex: "none", fontSize: 11.5, color: "var(--color-muted,#6b746e)" }}>
                                {one.label ?? ""}
                            </span>
                            <code
                                style={{
                                    fontFamily: "var(--font-sans),sans-serif", fontSize: 12, fontWeight: 700,
                                    color: "var(--color-forest,#1f4e6b)", background: "var(--color-surface,#fff)",
                                    border: "1px solid var(--color-line,#dce6ec)", borderRadius: 4, padding: "1px 6px",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {one.code}
                            </code>
                            <span aria-hidden style={{ color: "var(--color-faint,#9aa5a0)", fontSize: 12 }}>→</span>
                            <span style={{ fontFamily: "var(--font-serif),serif", fontSize: 14, color: "var(--color-ink,#1a211d)" }}>
                                {"ruby" in one && one.ruby ? (
                                    <ruby>
                                        {one.ruby[0]}
                                        <rt style={{ fontSize: "0.5em" }}>{one.ruby[1]}</rt>
                                    </ruby>
                                ) : "note" in one && one.note ? (
                                    <>
                                        <span
                                            style={{
                                                textDecorationLine: "underline", textDecorationStyle: "dotted",
                                                textDecorationColor: "var(--color-forest,#1f4e6b)", textDecorationThickness: "1.5px",
                                                textUnderlineOffset: ".28em",
                                            }}
                                        >
                                            {one.note}
                                        </span>
                                        <sup style={{ fontSize: "0.55em", fontWeight: 700, color: "var(--color-forest,#1f4e6b)" }}>※1</sup>
                                    </>
                                ) : "dots" in one && one.dots ? (
                                    <span style={{ textEmphasis: "filled sesame", WebkitTextEmphasis: "filled sesame" } as React.CSSProperties}>
                                        {one.dots}
                                    </span>
                                ) : null}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {"tip" in data && data.tip && (
                <p
                    style={{
                        fontSize: 11.5, lineHeight: 1.7, color: "var(--color-text-muted,#6b746e)", margin: "10px 0 0",
                        background: "var(--color-amber-tint,#fbf7ec)", borderRadius: 6, padding: "6px 9px",
                    }}
                >
                    {data.tip}
                </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, borderTop: "1px solid var(--color-line,#eef0ef)", paddingTop: 8 }}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        close();
                    }}
                    style={{ background: "none", border: 0, padding: "2px 4px", cursor: "pointer", font: "inherit", fontSize: 12, color: "var(--color-brand,#1f4e6b)" }}
                >
                    わかった
                </button>
            </div>
        </>
    );

    let panel: React.ReactNode = null;
    if (open && typeof document !== "undefined") {
        if (isNarrow) {
            panel = (
                <>
                    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 480, background: "rgba(0,0,0,.18)" }} />
                    <div
                        data-help-panel={panelId}
                        role="dialog"
                        aria-label={data.title}
                        style={{
                            /* globals.css の [role=dialog] の幅の上限を外す。端まで出す */
                            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 481, maxWidth: "none",
                            background: "var(--color-surface,#fff)", borderTopLeftRadius: 18, borderTopRightRadius: 18,
                            boxShadow: "0 -8px 24px rgba(0,0,0,.14)",
                            padding: "10px 18px calc(16px + env(safe-area-inset-bottom))",
                            fontFamily: "var(--font-sans),sans-serif", textAlign: "left",
                            maxHeight: "80vh", overflowY: "auto",
                        }}
                    >
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-line,#dcdfda)", margin: "0 auto 12px" }} />
                        {body}
                    </div>
                </>
            );
        } else {
            /* 書き方の例があるときは、書く形と見える形を 1 行に並べるので広くする */
            const width = "examples" in data && data.examples ? 380 : 330;
            const r = rect;
            const left = r ? Math.min(Math.max(12, r.left + r.width / 2 - 28), window.innerWidth - width - 12) : 12;
            const below = r ? r.bottom + 10 : 80;
            const guess =
                90 +
                ((("steps" in data && data.steps?.length) || 0) * 34) +
                ((("examples" in data && data.examples?.length) || 0) * 32) +
                ("tip" in data && data.tip ? 56 : 0);
            const top = r && below + guess > window.innerHeight ? Math.max(12, r.top - guess - 10) : below;
            panel = (
                <div
                    data-help-panel={panelId}
                    role="dialog"
                    aria-label={data.title}
                    style={{
                        position: "fixed", left, top, width, zIndex: 481,
                        background: "var(--color-surface,#fff)", border: "1px solid var(--color-forest-line,#b4cede)",
                        borderRadius: 12, boxShadow: "0 10px 30px rgba(31,78,107,.18)", padding: "14px 16px 10px",
                        fontFamily: "var(--font-sans),sans-serif", textAlign: "left", fontWeight: 400,
                        whiteSpace: "normal", letterSpacing: "normal",
                    }}
                >
                    {body}
                </div>
            );
        }
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                /* 押しても、親の押し具やフォームを動かさない */
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={`使い方：${data.title}`}
                aria-expanded={open}
                title="使い方"
                className={`inline-flex shrink-0 items-center align-middle ${className}`}
                style={{
                    background: "none", border: 0, cursor: "pointer",
                    padding: label ? "2px 4px" : 2, margin: label ? 0 : -2, lineHeight: label ? 1.2 : 0,
                    gap: 5, fontSize: 11, color: "var(--color-muted,#6b746e)",
                }}
            >
                <Mark size={size} active={open} />
                {label && <span>{label}</span>}
            </button>
            {panel && createPortal(panel, document.body)}
        </>
    );
}

function Mark({ size, active = false }: { size: number; active?: boolean }) {
    return (
        <span
            aria-hidden
            style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: size, height: size, borderRadius: "50%", flex: "none",
                border: `1.3px solid ${active ? "var(--color-forest,#1f4e6b)" : "var(--color-faint,#9aa5a0)"}`,
                background: active ? "var(--color-forest,#1f4e6b)" : "transparent",
                color: active ? "#fff" : "var(--color-muted,#6b746e)",
                fontSize: Math.round(size * 0.66), fontWeight: 700, lineHeight: 1,
                fontFamily: "var(--font-sans),sans-serif",
                boxShadow: active ? "0 0 0 3px rgba(31,78,107,.15)" : "none",
            }}
        >
            ?
        </span>
    );
}
