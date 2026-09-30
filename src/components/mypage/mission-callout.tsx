"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * MissionCallout — マイページのいちばん上に出す、ミッションの入り口
 *
 *   ［旗］ミッション　クリアできるミッションが 3 件あります　(3) ›
 *   ［ログインスタンプ 12/28］
 *
 * ★ ミッションはメニューの奥にあり、たどり着けない人が多かった。
 *   ポイントはミッションで貯まるので、目に入る所に大きく出す。
 *
 * ★ クリアを押せるものがあるときは、金色で目立たせる。
 * ============================================================
 */

import { missionProgress, type MissionStats } from "@/components/mypage/mission-client";
import InviteButton from "@/components/mypage/invite-button";
import PlanButton from "@/components/mypage/plan-button";
import LoginStampButton from "@/components/mypage/login-stamp-button";

export default function MissionCallout({
    stats,
    claimedIds,
    isWriter,
    onOpen,
}: {
    stats: MissionStats;
    claimedIds: string[];
    isWriter: boolean;
    onOpen: () => void;
}) {
    const { total, done, claimable } = missionProgress(stats, claimedIds, isWriter);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="mco">
            <button type="button" className={`mco-main${claimable > 0 ? " is-hot" : ""}`} onClick={onOpen}>
                <span className="mco-ic" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                </span>
                <span className="mco-t">
                    <b>ミッション</b>
                    <small>
                        {claimable > 0
                            ? `クリアできるミッションが ${claimable} 件あります（1つ +10pt）`
                            : `${done} / ${total} クリア　1つクリアするごとに +10pt`}
                    </small>
                    <span className="mco-bar" aria-hidden="true">
                        <i style={{ width: `${pct}%` }} />
                    </span>
                </span>
                {claimable > 0 && <em className="mco-badge">{claimable}</em>}
                <span className="mco-go" aria-hidden="true">›</span>
            </button>
            <LoginStampButton />
            <InviteButton />
            <PlanButton />
        </div>
    );
}
