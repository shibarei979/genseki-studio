/**
 * ============================================================
 * 原石航路 Studio
 * FontPicker — 書体を選ぶ（読む画面・書く画面で共通）
 *
 * ★ 無料の 4 つはいつも見せる。残りは「ほかの書体」を開くと並ぶ。
 *   読書設定の小窓は狭いので、30 書体を最初から並べると埋まってしまう。
 *
 * ★ 見本は、その書体で描く。
 *   名前だけでは、どんな字か分からない。
 *
 * ★ Pro でない人にも Pro の書体は見せる（押すと案内が出る）。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import ProBadge from "@/components/common/pro-badge";
import type { FontDef, FontGroup } from "@/lib/fonts/catalog";
import { FONT_CATALOG, FONT_GROUP_LABEL, fontDefOf, loadFontPreview } from "@/lib/fonts/catalog";

const SAMPLE = "海へ出る";

interface Props {
    value: string;
    onChange: (key: string) => void;
    isPro: boolean;
    /** 狭い所（読書設定の小窓）向け */
    compact?: boolean;
}

export default function FontPicker({ value, onChange, isPro, compact = false }: Props) {
    const current = fontDefOf(value);
    /* Pro の書体を選んでいるなら、はじめから開いておく */
    const [showAll, setShowAll] = useState(current.pro);
    const [notice, setNotice] = useState(false);

    const basic = FONT_CATALOG.filter((font) => font.group === "basic");
    const groups: FontGroup[] = ["mincho", "gothic", "maru", "brush", "design"];

    /* 見本の字だけ取り寄せる */
    useEffect(() => {
        for (const font of basic) loadFontPreview(font, SAMPLE);
        if (!showAll) return;
        for (const font of FONT_CATALOG) loadFontPreview(font, SAMPLE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAll]);

    function pick(font: FontDef) {
        if (font.pro && !isPro) {
            setNotice(true);
            return;
        }
        setNotice(false);
        onChange(font.key);
    }

    /*
     * stacked：見本の下に名前を置く形。
     * 狭い小窓の 2 列では、横に並べると名前が「ゴ…」のように切れてしまう。
     */
    const item = (font: FontDef, stacked = false) => {
        const selected = current.key === font.key;
        const locked = font.pro && !isPro;

        return (
            <li key={font.key}>
                <button
                    type="button"
                    onClick={() => pick(font)}
                    aria-pressed={selected}
                    title={font.note}
                    className={[
                        "flex w-full rounded-md border text-left",
                        stacked ? "flex-col items-start gap-0.5" : "items-center gap-2.5",
                        compact ? "px-2 py-1.5" : "px-3 py-2",
                        selected
                            ? "border-forest bg-forest-tint"
                            : "border-line bg-surface hover:border-forest-line",
                        locked ? "opacity-70" : "",
                    ].join(" ")}
                >
                    <span
                        className={[
                            "shrink-0 leading-tight text-ink",
                            stacked ? "text-[16px]" : compact ? "w-[4.6em] text-[15px]" : "w-[5em] text-[18px]",
                        ].join(" ")}
                        style={{ fontFamily: font.stack }}
                    >
                        {SAMPLE}
                    </span>
                    <span className={stacked ? "min-w-0 w-full" : "min-w-0 flex-1"}>
                        <span className="flex items-center gap-1">
                            <span className="truncate text-[12px] text-ink" style={{ fontFamily: font.stack }}>
                                {font.label}
                            </span>
                            {font.pro && <ProBadge />}
                        </span>
                        {!compact && <span className="block truncate text-[10.5px] text-muted">{font.note}</span>}
                    </span>
                </button>
            </li>
        );
    };

    return (
        <div>
            <ul className={compact ? "grid grid-cols-2 gap-1" : "grid gap-1.5 sm:grid-cols-2"}>
                {basic.map((font) => item(font, compact))}
            </ul>

            <button
                type="button"
                onClick={() => setShowAll((on) => !on)}
                aria-expanded={showAll}
                className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-left text-[11.5px] text-muted hover:border-forest-line hover:text-forest"
            >
                <span className="w-3 text-faint">{showAll ? "▾" : "▸"}</span>
                ほかの書体
                <span className="text-faint">{FONT_CATALOG.length - basic.length}種類</span>
                <ProBadge className="ml-auto" />
            </button>

            {notice && (
                <p className="mt-1.5 rounded-md bg-[var(--color-amber-tint)] px-2.5 py-1.5 text-[11px] leading-relaxed text-ink">
                    この書体は <ProBadge className="mx-0.5" /> で使えます。サブスクに入ると30種類の書体から選べます。
                </p>
            )}

            {showAll && (
                <div
                    className={[
                        "thin-scroll mt-2 overflow-y-auto pr-0.5",
                        compact ? "max-h-64" : "max-h-[28rem]",
                    ].join(" ")}
                >
                    {groups.map((group) => (
                        <div key={group} className="mb-2 last:mb-0">
                            <p className="mb-1 text-[10.5px] font-medium text-muted">
                                {FONT_GROUP_LABEL[group]}
                                {group === "design" && (
                                    <span className="ml-1.5 font-normal text-faint">見出し向き。長い本文は読みにくいこともあります</span>
                                )}
                            </p>
                            <ul className={compact ? "grid grid-cols-1 gap-1" : "grid gap-1.5 sm:grid-cols-2"}>
                                {FONT_CATALOG.filter((font) => font.group === group).map((font) => item(font))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
