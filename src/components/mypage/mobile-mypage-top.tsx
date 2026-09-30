/**
 * ============================================================
 * 原石航路 Studio
 * 携帯：マイページのいちばん上
 *
 *   海の色の帯（名前・歯車・航路）
 *   数字 3 つ
 *   誤字報告のお知らせ
 *   3 列のメニュー（マイページの中の行き先ぜんぶ）
 *
 * ★ 前は横に流れるタブだった。9 つあると、右の方は
 *   横に送らないと見えず、何があるのか分からなかった。
 *   全部を 3 列で並べ、一度で見渡せるようにする。
 *
 * ★ 航路は、書く向きなら作品の合計 PV、読む向きなら読んだ話の数で進む。
 *   港の名前は、節目のお祝いと同じもの。
 *
 * ★ 数字は、いま手元にあるものだけを出す。作らない。
 *
 * ★ 携帯（1024px 未満）でだけ出す。パソコンは今のまま。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CostumeOverlay from "@/components/common/costume-overlay";
import { createClient } from "@/lib/supabase/client";

/** 港の名前（節目のお祝いと同じ並び） */
const HARBOR_NAMES = [
    "最初の灯",
    "小さな港町",
    "灯台の岬",
    "外洋の入り口",
    "星読みの海",
    "新しい大陸",
    "風の群島",
    "黄金の航路",
    "世界の果ての灯台",
];

/** 書く向き：作品の合計 PV */
const PV_ROUTE = [100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 100000];
/** 読む向き：読んだ話の数 */
const READ_ROUTE = [10, 30, 100, 300, 500, 1000, 3000, 5000, 10000];

export type MobileMenuItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    /** 押したときの行き先。無ければ onPick に id を渡す */
    href?: string;
    badge?: number;
};

/** メニューの札の色（前もって決めた並び） */
const TONE: Record<string, string> = {
    works: "sea",
    typos: "amber",
    analytics: "sea",
    series: "sea",
    bookmarks: "green",
    history: "violet",
    mission: "green",
    items: "amber",
    settings: "sea",
};

function fmt(n: number): string {
    if (n >= 10000) {
        const man = n / 10000;
        return `${man >= 100 ? Math.round(man) : Math.round(man * 10) / 10}万`;
    }
    return n.toLocaleString("ja-JP");
}

export default function MobileMypageTop({
    name,
    handle,
    iconUrl,
    costumeUrl = null,
    workCount,
    isReaderMode,
    routeValue,
    stats,
    menu,
    myNovelIds,
    onPick,
    bio = "",
    titles = [],
    onIconClick,
    actions,
    extras,
}: {
    name: string;
    handle: string | null;
    iconUrl: string | null;
    /** つけているアイコン衣装の絵 */
    costumeUrl?: string | null;
    workCount: number;
    isReaderMode: boolean;
    /** 航路を進める数（書く向き＝合計 PV、読む向き＝読んだ話）。null はまだ届いていない */
    routeValue: number | null;
    /** null はまだ届いていない数。「—」と出す */
    stats: { value: number | null; label: string }[];
    menu: MobileMenuItem[];
    /** 誤字報告を数えるための、自分の作品の id */
    myNovelIds: string[];
    onPick: (id: string) => void;
    /** 自己紹介（あれば名前の下に出す） */
    bio?: string;
    /** 飾っている称号 */
    titles?: { id: string; name: string; url: string | null }[];
    /** アイコンを押したとき（画像を替える） */
    onIconClick?: () => void;
    /** プロフィールを編集・衣装・公開ページの押し具 */
    actions?: React.ReactNode;
    /** 数字の下に出すもの（生年月日の促し・ミッション・新着通知） */
    extras?: React.ReactNode;
}) {
    /*
     * 誤字報告の数。
     *
     * ★ 片づけた報告は表から消えるので、残っている数がそのまま「まだ見ていない数」。
     * ★ 読む向きのときは数えない（誤字報告のメニュー自体が出ない）。
     */
    const [typoCount, setTypoCount] = useState(0);
    const idsKey = myNovelIds.join(",");

    useEffect(() => {
        if (isReaderMode || myNovelIds.length === 0) {
            setTypoCount(0);
            return;
        }
        let alive = true;
        void (async () => {
            try {
                const { count } = await createClient()
                    .from("typo_reports")
                    .select("id", { count: "exact", head: true })
                    .in("novel_id", myNovelIds);
                if (alive) setTypoCount(count ?? 0);
            } catch {
                /* 数えられなくても、ほかは出す */
            }
        })();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReaderMode, idsKey]);

    const steps = isReaderMode ? READ_ROUTE : PV_ROUTE;
    const isLoading = routeValue === null;
    const value = routeValue ?? 0;
    const reached = steps.filter((s) => s <= value).length;
    const nextStep = steps[reached];
    const unit = isReaderMode ? "話" : "PV";

    return (
        <div className="mmp">
            <section className="mmp-sea">
                <div className="mmp-me">
                    <span
                        style={{ position: "relative", width: 58, height: 58, flexShrink: 0, marginTop: costumeUrl ? 20 : 0, cursor: onIconClick ? "pointer" : undefined }}
                        onClick={onIconClick}
                        role={onIconClick ? "button" : undefined}
                        aria-label={onIconClick ? "アイコンを変える" : undefined}
                    >
                    {iconUrl ? (
                        <img src={iconUrl} alt="" className="mmp-av" />
                    ) : (
                        <span className="mmp-av mmp-av-none">{name.slice(0, 1)}</span>
                    )}
                        <CostumeOverlay url={costumeUrl} size={58} />
                    </span>
                    <div className="mmp-who">
                        <b>{name}</b>
                        <small>
                            {handle ? `@${handle}・` : ""}作品 {workCount}
                        </small>
                    </div>
                    <button type="button" className="mmp-gear" aria-label="設定" onClick={() => onPick("settings")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                        </svg>
                    </button>
                </div>

                {titles.length > 0 && (
                    <div className="ttl-row mmp-ttl">
                        {titles.map((one) =>
                            one.url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img key={one.id} src={one.url} alt={one.name} title={one.name} />
                            ) : (
                                <span key={one.id}>{one.name}</span>
                            ),
                        )}
                    </div>
                )}
                {bio && <p className="mmp-bio">{bio}</p>}
                {actions && <div className="mmp-actions">{actions}</div>}

                {/* 航路。着いた港は金、まだの港は白い輪。船はいまいる所 */}
                <div className="mmp-route" aria-hidden="true">
                    {steps.map((s, i) => (
                        <span key={s} className={`mmp-port${i < reached ? " is-on" : ""}`}>
                            {i > 0 && <i className={`mmp-leg${i < reached ? " is-on" : ""}`} />}
                            <em />
                            {i === Math.max(0, reached - 1) && (
                                <svg className="mmp-ship" width="26" height="22" viewBox="0 0 26 22">
                                    <path d="M13 1v14" stroke="#fff" strokeWidth="1.4" />
                                    <path d="M13 2l8 11h-8z" fill="#fff" />
                                    <path d="M12 4l-6 9h6z" fill="#f3e3b5" />
                                    <path d="M3 15h20l-3 5H6z" fill="#fff" />
                                </svg>
                            )}
                        </span>
                    ))}
                </div>

                <div className="mmp-next">
                    {isLoading ? (
                        <span>&nbsp;</span>
                    ) : nextStep ? (
                        <>
                            <span>
                                次の港 <b>{HARBOR_NAMES[reached]}</b>
                                <small>（{isReaderMode ? `読んだ話 ${fmt(nextStep)}` : `${fmt(nextStep)} PV`}）</small>
                            </span>
                            <strong>あと {fmt(nextStep - value)}{unit}</strong>
                        </>
                    ) : (
                        <span>
                            <b>{HARBOR_NAMES[HARBOR_NAMES.length - 1]}</b> に着きました
                        </span>
                    )}
                </div>
                <svg className="mmp-wave" viewBox="0 0 400 16" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 8 C 40 0, 80 16, 120 8 S 200 0, 240 8 S 320 16, 360 8 S 400 4, 400 4 V16 H0Z" />
                </svg>
            </section>

            <div className="mmp-stats">
                {stats.map((s) => (
                    <div key={s.label}>
                        <b>{s.value === null ? "—" : fmt(s.value)}</b>
                        <small>{s.label}</small>
                    </div>
                ))}
            </div>

            <div className="mmp-body">
                {extras}
                {typoCount > 0 && (
                    <button type="button" className="mmp-alert" onClick={() => onPick("typos")}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                        </svg>
                        <span>
                            <b>誤字報告が{typoCount}件</b>届いています
                        </span>
                        <em>›</em>
                    </button>
                )}

                <nav className="mmp-menu" aria-label="マイページの中">
                    {menu.map((m) => {
                        const badge = m.id === "typos" ? typoCount : m.badge ?? 0;
                        const inner = (
                            <>
                                <span className={`mmp-ic is-${TONE[m.id] ?? "sea"}`}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        {m.icon}
                                    </svg>
                                </span>
                                <b>{m.label}</b>
                                {badge > 0 && <span className="mmp-badge">{badge}</span>}
                            </>
                        );
                        return m.href ? (
                            <Link key={m.id} href={m.href} className="mmp-tile">
                                {inner}
                            </Link>
                        ) : (
                            <button key={m.id} type="button" className="mmp-tile" onClick={() => onPick(m.id)}>
                                {inner}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}

/** マイページ以外を開いているときの、上の戻る段 */
export function MobileMypageBack({ label, onBack }: { label: string; onBack: () => void }) {
    return (
        <div className="mmp-back">
            <button type="button" onClick={onBack} aria-label="マイページへ戻る">
                ‹ マイページ
            </button>
            <b>{label}</b>
        </div>
    );
}
