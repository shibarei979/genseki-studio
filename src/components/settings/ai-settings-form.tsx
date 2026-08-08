/**
 * ============================================================
 * 原石航路 Studio
 * AiSettingsForm — 設定 / AI補助設定
 * ============================================================
 */

"use client";

import { useAiStatus } from "@/hooks/use-ai-status";
import type { AiSettings, ApprovalMode } from "@/types";
import { APPROVAL_MODE_DESCRIPTION, APPROVAL_MODE_LABEL } from "@/types";

interface Props {
    settings: AiSettings;
    onChange: (patch: Partial<Omit<AiSettings, "work_id">>) => void;
}

const TARGETS: { key: keyof AiSettings; label: string; description: string }[] = [
    { key: "extract_characters", label: "人物", description: "名前や呼び名を拾います。" },
    { key: "extract_places", label: "場所", description: "地名、建物、部屋などを拾います。" },
    {
        key: "extract_organizations",
        label: "組織・グループ",
        description: "国、学校、部活、集団などを拾います。",
    },
    { key: "extract_terms", label: "用語・設定", description: "作品独自の言葉を拾います。" },
    {
        key: "extract_events",
        label: "出来事",
        description: "起きたことを時系列の候補として拾います。",
    },
];

export default function AiSettingsForm({ settings, onChange }: Props) {
    const status = useAiStatus();

    return (
        <div className="space-y-4">
            {/* 繋がり先 */}
            {!status.isChecking && (
                <div
                    className={[
                        "flex flex-wrap items-center gap-3 rounded-lg border px-5 py-3.5",
                        status.connected
                            ? "border-forest-line bg-forest-tint/50"
                            : "border-line bg-canvas",
                    ].join(" ")}
                >
                    <span
                        className={[
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            status.connected ? "bg-forest" : "bg-[var(--color-faint)]",
                        ].join(" ")}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                            {status.connected
                                ? "モデルに接続しています"
                                : "簡易版で動作しています"}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                            {status.connected ? (
                                <>
                                    候補の抽出に {status.model} を使います。
                                    本文はサーバー経由でモデルへ送られます。
                                </>
                            ) : (
                                <>
                                    本文は外部へ送られません。端末の中だけで候補を拾います。
                                    取りこぼしや、要らないものを拾うことがあります。
                                </>
                            )}
                        </p>
                    </div>
                    {!status.connected && (
                        <details className="w-full">
                            <summary className="cursor-pointer text-xs text-forest">
                                モデルに繋ぐには
                            </summary>
                            <div className="mt-2 rounded-md bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted">
                                <p>
                                    プロジェクトの直下に <code>.env.local</code> を作り、
                                    次の 1 行を書いて開き直します。
                                </p>
                                <pre className="mt-1.5 overflow-x-auto rounded bg-canvas px-2.5 py-2 text-[11px] text-ink">
{`OPENAI_API_KEY=sk-proj-...`}
                                </pre>
                                <p className="mt-1.5">
                                    鍵はサーバー側だけで使い、ブラウザには出しません。
                                </p>
                            </div>
                        </details>
                    )}
                </div>
            )}

            <div className="rounded-lg border border-line bg-surface">
                <div className="flex items-start gap-4 border-b border-line px-6 py-5">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-medium text-ink">AI補助設定</h2>
                        <p className="mt-1 text-sm text-muted">
                            本文に書かれたものを読み取り、資料の候補として並べます。
                        </p>
                    </div>
                    <Toggle
                        checked={settings.is_enabled}
                        onChange={(next) => onChange({ is_enabled: next })}
                        label="AI補助を使う"
                    />
                </div>

                {/*
                 * 何をする道具か、ひとことで言う。
                 *
                 * 表を並べると説明書になる。
                 * 詳しく知りたい人だけが開けばよい。
                 */}
                <div className="px-6 py-5">
                    <p className="text-[13px] leading-relaxed text-muted">
                        本文から人物・場所・用語などを見つけ、資料の整理を手伝います。
                        <span className="text-ink">
                            AIは本文や物語を作りません。
                        </span>
                    </p>

                    <details className="mt-3 rounded-lg border border-line">
                        <summary className="cursor-pointer px-4 py-2.5 text-xs text-muted">
                            AI補助について詳しく見る
                        </summary>

                        <div className="grid gap-4 border-t border-line px-4 py-4 lg:grid-cols-2">
                            <div>
                                <p className="text-xs font-medium text-forest">
                                    すること
                                </p>
                                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-ink">
                                    <li>・本文から人物・場所・組織・用語・出来事を拾う</li>
                                    <li>・資料の関係を図に整理する</li>
                                    <li>・本文と資料の繋がりを見つける</li>
                                </ul>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-ink">
                                    しないこと
                                </p>
                                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted">
                                    <li>・本文を書く</li>
                                    <li>・あらすじや台詞を作る</li>
                                    <li>・表紙や挿絵を作る</li>
                                    <li>・プロット・構成に手を入れる</li>
                                </ul>
                                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                                    これらは設定でも入にできません。
                                    物語を書くのは作者だからです。
                                </p>
                            </div>

                            <div className="lg:col-span-2">
                                <p className="text-xs font-medium text-ink">
                                    送るものの扱い
                                </p>
                                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted">
                                    <li>・送ったものは、あなたの手元にだけ紐づきます</li>
                                    <li>・AIの学習には使いません</li>
                                    <li>・切れば、以降は何も送りません</li>
                                </ul>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            {settings.is_enabled && (
                <>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card title="拾う対象">
                            <ul className="space-y-3">
                                {TARGETS.map((target) => (
                                    <li
                                        key={String(target.key)}
                                        className="flex items-start justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm text-ink">{target.label}</p>
                                            <p className="mt-0.5 text-xs text-muted">
                                                {target.description}
                                            </p>
                                        </div>
                                        <Toggle
                                            checked={Boolean(settings[target.key])}
                                            onChange={(next) =>
                                                onChange({ [target.key]: next } as Partial<
                                                    Omit<AiSettings, "work_id">
                                                >)
                                            }
                                            label={target.label}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <div className="space-y-4">
                            <Card title="候補の扱い方">
                                <div className="space-y-2">
                                    {(Object.keys(APPROVAL_MODE_LABEL) as ApprovalMode[]).map(
                                        (key) => (
                                            <label
                                                key={key}
                                                className={[
                                                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5",
                                                    settings.approval_mode === key
                                                        ? "border-forest bg-forest-tint"
                                                        : "border-line hover:bg-canvas",
                                                ].join(" ")}
                                            >
                                                <input
                                                    type="radio"
                                                    name="approval-mode"
                                                    checked={settings.approval_mode === key}
                                                    onChange={() =>
                                                        onChange({ approval_mode: key })
                                                    }
                                                    className="mt-0.5 accent-[var(--color-forest)]"
                                                />
                                                <span>
                                                    <span className="block text-sm text-ink">
                                                        {APPROVAL_MODE_LABEL[key]}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-muted">
                                                        {APPROVAL_MODE_DESCRIPTION[key]}
                                                    </span>
                                                </span>
                                            </label>
                                        ),
                                    )}
                                </div>
                                <p className="mt-3 rounded-md bg-canvas px-3 py-2 text-xs text-muted">
                                    どちらの場合も、公開されるまで読者には表示されません。
                                </p>
                            </Card>

                            <Card title="そのほか">
                                <ToggleRow
                                    label="保存したときに候補を探す"
                                    checked={settings.auto_extract}
                                    onChange={(next) => onChange({ auto_extract: next })}
                                />
                                <div className="mt-3">
                                    <ToggleRow
                                        label="本文と資料の紐づけ先を提案する"
                                        checked={settings.suggest_links}
                                        onChange={(next) => onChange({ suggest_links: next })}
                                    />
                                </div>
                                <div className="mt-3">
                                    <ToggleRow
                                        label="資料の関係を図に整理する"
                                        checked={settings.generate_images}
                                        onChange={(next) => onChange({ generate_images: next })}
                                    />
                                    <p className="mt-1 text-xs text-faint">
                                        相関図・時系列図として整理します。
                                        本文や表紙は作りません。
                                    </p>
                                </div>
                            </Card>
                        </div>
                    </div>


                </>
            )}
        </div>
    );
}

/**
 * ============================================================
 * 小さな部品
 * ============================================================
 */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-4">
                <h3 className="text-sm font-medium text-ink">{title}</h3>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                checked ? "bg-forest" : "bg-[var(--color-line)]",
            ].join(" ")}
        >
            <span
                className={[
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    checked ? "left-[22px]" : "left-0.5",
                ].join(" ")}
            />
        </button>
    );
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink">{label}</span>
            <Toggle checked={checked} onChange={onChange} label={label} />
        </div>
    );
}
