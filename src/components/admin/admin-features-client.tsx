/**
 * ============================================================
 * 原石航路 Studio
 * AdminFeaturesClient — 機能の入切
 *
 * 作りかけの機能を、出したり隠したりする。
 *
 * 3 段階にしてあるのは、いきなり全員に出すのが怖いため。
 * 試験公開は「使えるが、目立つ所には出さない」状態。
 * ============================================================
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "@/components/admin/admin-shell";
import { getRepository } from "@/lib/repository";
import type { FeatureFlag, FeatureStatus } from "@/types";
import { FEATURE_STATUS_COLOR, FEATURE_STATUS_LABEL } from "@/types";

export default function AdminFeaturesClient() {
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [toast, setToast] = useState("");

    const reload = useCallback(async () => {
        setFeatures(await getRepository().listFeatureFlags());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function update(key: string, status: FeatureStatus) {
        await getRepository().updateFeatureFlag(key, status);
        await reload();
        setToast("保存しました");
        window.setTimeout(() => setToast(""), 1800);
    }

    return (
        <AdminShell
            title="機能の入切"
            description="作りかけの機能を、出したり隠したりします。"
        >
            {toast && (
                <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-forest px-5 py-2 text-sm text-white shadow-lg">
                    {toast}
                </p>
            )}

            <ul className="space-y-2">
                {features.map((feature) => (
                    <li
                        key={feature.key}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink">
                                {feature.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted">
                                {feature.description}
                            </p>
                        </div>

                        <div className="flex shrink-0 gap-1">
                            {(Object.keys(FEATURE_STATUS_LABEL) as FeatureStatus[]).map(
                                (key) => {
                                    const tone = FEATURE_STATUS_COLOR[key];
                                    const isCurrent = feature.status === key;

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => void update(feature.key, key)}
                                            aria-pressed={isCurrent}
                                            className="rounded-full border px-3 py-1 text-[11px] font-medium"
                                            style={{
                                                background: isCurrent
                                                    ? tone.bg
                                                    : "transparent",
                                                color: isCurrent ? tone.text : "#7d867f",
                                                borderColor: isCurrent
                                                    ? tone.text
                                                    : "var(--color-line)",
                                            }}
                                        >
                                            {FEATURE_STATUS_LABEL[key]}
                                        </button>
                                    );
                                },
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-[11px] leading-relaxed text-faint">
                いまは自分の端末の中にだけ残ります。
                全員に効かせるには、保存先が必要です。
            </p>
        </AdminShell>
    );
}
