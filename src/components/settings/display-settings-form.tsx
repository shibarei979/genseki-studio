/**
 * ============================================================
 * 原石航路 Studio
 * DisplaySettingsForm — 設定 / 表示設定
 *
 * 変更はその場で保存し、プレビューに即座に反映する。
 * 見た目の設定は「試して決める」ものなので、
 * 保存ボタンを挟むと確認の往復が増える。
 * ============================================================
 */

"use client";

import { useState } from "react";

import MobilePreview from "@/components/settings/mobile-preview";
import ManuscriptSurface from "@/components/workspace/manuscript-surface";
import PagedReader from "@/components/workspace/paged-reader";
import type {
    DisplaySettings,
    FontKey,
    LetterSpacingKey,
    LineHeightKey,
    PageMode,
    ThemeKey,
    WritingMode,
} from "@/types";
import {
    FONT_DESCRIPTION,
    FONT_LABEL,
    FONT_SIZES,
    FONT_STACK,
    LETTER_SPACING_LABEL,
    LINE_HEIGHT_LABEL,
    READER_MODE_LABEL,
    PAGE_MODE_LABEL,
    THEME_LABEL,
    WRITING_MODE_LABEL,
} from "@/types";

const PREVIEW_TEXT = `　風が、研究塔の屋根を鳴らしていた。

　リオ・アルセインは、窓の外を眺めながら石段を降りる。遠くで鐘が一つ、午後の時を告げる。

　研究塔は古く、石造りの壁には幾重もの葛が這っていた。けれど内部は整然としていて、棚には無数の書物や装置が並ぶ。

　リオは机の上のノートを開いた。父の残した文字が、薄暗がりの中で静かに並んでいる。

「――やはり、粒子は流れている」

　呟いた声は、誰にも届かない。`;

type Device = "pc" | "mobile";

interface Props {
    settings: DisplaySettings;
    workTitle: string;
    onChange: (patch: Partial<Omit<DisplaySettings, "work_id">>) => void;
}

export default function DisplaySettingsForm({ settings, workTitle, onChange }: Props) {
    const [device, setDevice] = useState<Device>("pc");

    const pageMode = device === "pc" ? settings.page_mode_pc : settings.page_mode_mobile;

    function setPageMode(mode: PageMode) {
        onChange(device === "pc" ? { page_mode_pc: mode } : { page_mode_mobile: mode });
    }

    return (
        <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-6 py-5">
                <h2 className="text-base font-medium text-ink">表示設定</h2>
                <p className="mt-1 text-sm text-muted">
                    執筆画面と、将来の読者向けページでの見え方を決めます。
                </p>
            </div>

            <div className="grid gap-8 px-6 py-6 lg:grid-cols-[260px_1fr]">
                <div className="space-y-5">
                    <Section title="組み方向">
                        <Choices
                            options={Object.keys(WRITING_MODE_LABEL) as WritingMode[]}
                            labels={WRITING_MODE_LABEL}
                            selected={settings.writing_mode}
                            onSelect={(key) => onChange({ writing_mode: key })}
                        />
                    </Section>

                    <Section title="文字サイズ">
                        <div className="flex flex-wrap gap-1.5">
                            {FONT_SIZES.map((size) => (
                                <ChoiceButton
                                    key={size}
                                    label={String(size)}
                                    isSelected={settings.font_size === size}
                                    onClick={() => onChange({ font_size: size })}
                                />
                            ))}
                        </div>
                    </Section>

                    <Section title="行間">
                        <Choices
                            options={Object.keys(LINE_HEIGHT_LABEL) as LineHeightKey[]}
                            labels={LINE_HEIGHT_LABEL}
                            selected={settings.line_height}
                            onSelect={(key) => onChange({ line_height: key })}
                        />
                    </Section>

                    <Section title="字間" note="縦書きでは少し広めに出ます。">
                        <Choices
                            options={
                                Object.keys(
                                    LETTER_SPACING_LABEL,
                                ) as LetterSpacingKey[]
                            }
                            labels={LETTER_SPACING_LABEL}
                            selected={settings.letter_spacing ?? "normal"}
                            onSelect={(key) => onChange({ letter_spacing: key })}
                        />
                    </Section>

                    <Section title="書体" note="端末に入っている書体から選びます。">
                        <ul className="space-y-1.5">
                            {(Object.keys(FONT_LABEL) as FontKey[]).map((key) => (
                                <li key={key}>
                                    <button
                                        type="button"
                                        onClick={() => onChange({ font_family: key })}
                                        aria-pressed={settings.font_family === key}
                                        className={[
                                            "flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left",
                                            settings.font_family === key
                                                ? "border-forest bg-forest-tint/50"
                                                : "border-line hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        {/*
                                         * 見本を左に、説明を右に。
                                         *
                                         * 名前と説明と見本を横一列に並べると、
                                         * どれがどれか分からなくなる。
                                         * 見本は大きく出して、選ぶ手がかりにする。
                                         */}
                                        <span
                                            className="w-20 shrink-0 text-[19px] leading-tight text-ink"
                                            style={{ fontFamily: FONT_STACK[key] }}
                                        >
                                            海へ出る
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[13px] font-medium text-ink">
                                                {FONT_LABEL[key]}
                                            </span>
                                            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                                                {FONT_DESCRIPTION[key]}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="背景色テーマ">
                        <Choices
                            options={Object.keys(THEME_LABEL) as ThemeKey[]}
                            labels={THEME_LABEL}
                            selected={settings.theme}
                            onSelect={(key) => onChange({ theme: key })}
                        />
                    </Section>

                    <Section
                        title={`読み進め方（${device === "pc" ? "PC" : "携帯"}）`}
                        note="PC と携帯で別々に設定できます。上のプレビュー切替と連動します。"
                    >
                        <Choices
                            options={Object.keys(PAGE_MODE_LABEL) as PageMode[]}
                            labels={PAGE_MODE_LABEL}
                            selected={pageMode}
                            onSelect={setPageMode}
                        />
                    </Section>
                </div>

                <div className="min-w-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-ink">プレビュー</h3>
                        <div className="flex gap-1 rounded-md border border-line p-0.5">
                            <DeviceTab
                                label="WEB"
                                isActive={device === "pc"}
                                onClick={() => setDevice("pc")}
                            />
                            <DeviceTab
                                label="携帯"
                                isActive={device === "mobile"}
                                onClick={() => setDevice("mobile")}
                            />
                        </div>
                    </div>

                    <div className="mt-3 flex justify-center rounded-lg bg-canvas p-5">
                        {device === "pc" ? (
                            <div className="h-[500px] w-full overflow-hidden rounded-md border border-line bg-surface">
                                {settings.page_mode_pc === "paged" ? (
                                    <PagedReader settings={settings} text={PREVIEW_TEXT} />
                                ) : (
                                    <ManuscriptSurface
                                        settings={settings}
                                        readOnly
                                        value={PREVIEW_TEXT}
                                    />
                                )}
                            </div>
                        ) : (
                            <MobilePreview
                                settings={settings}
                                workTitle={workTitle}
                                episodeTitle="第一章　夜明けの風"
                                text={PREVIEW_TEXT}
                            />
                        )}
                    </div>

                    <p className="mt-3 text-xs text-faint">
                        {pageMode === "paged"
                            ? "本文の左半分を押すと次のページへ進みます。ページは左へ送られます。"
                            : "実際の見え方は、端末やブラウザによって変わることがあります。"}
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 小さな部品
 * ============================================================
 */

function Section({
    title,
    note,
    children,
}: {
    title: string;
    note?: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h3 className="text-sm font-medium text-ink">{title}</h3>
            <div className="mt-2">{children}</div>
            {note && <p className="mt-1.5 text-xs text-faint">{note}</p>}
        </section>
    );
}

function Choices<T extends string>({
    options,
    labels,
    selected,
    onSelect,
}: {
    options: T[];
    labels: Record<T, string>;
    selected: T;
    onSelect: (key: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((key) => (
                <ChoiceButton
                    key={key}
                    label={labels[key]}
                    isSelected={selected === key}
                    onClick={() => onSelect(key)}
                />
            ))}
        </div>
    );
}

function ChoiceButton({
    label,
    isSelected,
    onClick,
}: {
    label: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isSelected}
            className={[
                "rounded-full border px-3 py-1.5 text-xs",
                isSelected
                    ? "border-forest bg-forest-tint text-forest"
                    : "border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
        </button>
    );
}

function DeviceTab({
    label,
    isActive,
    onClick,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={[
                "rounded px-3 py-1 text-xs",
                isActive ? "bg-forest text-white" : "text-muted hover:text-ink",
            ].join(" ")}
        >
            {label}
        </button>
    );
}
