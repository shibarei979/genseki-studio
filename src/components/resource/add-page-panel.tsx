/**
 * ============================================================
 * 原石航路 Studio
 * AddPagePanel — ページを追加する / 自作する
 *
 * 既製のページだけで全ジャンルを覆おうとしても限界がある。
 * 作者が自分で資料の種類を作れるようにする。
 *
 * 入力欄を組み立てながら、右で出来上がりを見せる。
 * 組み終わってから「思っていたのと違う」となるのを避けるため。
 * ============================================================
 */

"use client";

import { useState } from "react";

import ResourceIcon from "@/components/resource/resource-icons";
import { CUSTOM_FIELD_CHOICES, OPTIONAL_PAGES } from "@/lib/resource/builtin-pages";
import type { ResourceField, ResourcePage } from "@/types";

interface Props {
    pages: ResourcePage[];
    onAddBuiltin: (builtinKey: string) => void;
    onCreateCustom: (input: {
        label: string;
        description: string;
        fields: ResourceField[];
    }) => void;
}

export default function AddPagePanel({ pages, onAddBuiltin, onCreateCustom }: Props) {
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState<ResourceField[]>([]);
    const [fieldLabel, setFieldLabel] = useState("");
    const [fieldType, setFieldType] = useState<ResourceField["type"]>("textarea");
    const [draggingKey, setDraggingKey] = useState<string | null>(null);

    const existingKeys = new Set(pages.map((page) => page.builtin_key));
    const available = OPTIONAL_PAGES.filter((page) => !existingKeys.has(page.key));

    function addField() {
        const trimmed = fieldLabel.trim();
        if (!trimmed) return;
        setFields((current) => [
            ...current,
            { key: `f${Date.now()}`, label: trimmed, type: fieldType },
        ]);
        setFieldLabel("");
    }

    function moveField(targetKey: string) {
        if (!draggingKey || draggingKey === targetKey) {
            setDraggingKey(null);
            return;
        }
        const keys = fields.map((field) => field.key);
        const from = keys.indexOf(draggingKey);
        const to = keys.indexOf(targetKey);
        const next = [...fields];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setFields(next);
        setDraggingKey(null);
    }

    function handleCreate() {
        if (!label.trim()) return;
        onCreateCustom({ label: label.trim(), description: description.trim(), fields });
        setLabel("");
        setDescription("");
        setFields([]);
    }

    return (
        <div className="space-y-5">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-medium text-ink">ページを追加</h1>
                    <p className="mt-1 text-sm text-muted">
                        作品に必要な資料ページだけを追加できます。使う分だけ揃えて、
                        物語にぴったりのワークスペースを作れます。
                    </p>
                </div>
                <div className="hidden max-w-xs rounded-lg border border-forest-line bg-forest-tint/40 px-4 py-3 lg:block">
                    <p className="text-sm text-forest">必要な資料だけ、自由に</p>
                    <p className="mt-1 text-xs text-muted">
                        ジャンルや作風に合わせて、あなただけの資料環境を作れます。
                        使わないページは出しません。
                    </p>
                </div>
            </header>

            {/* 用意されているページ */}
            <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="text-sm font-medium text-ink">まずは、よく使うページを追加</h2>

                {available.length === 0 ? (
                    <p className="mt-3 text-xs text-faint">
                        用意されているページはすべて追加済みです。
                    </p>
                ) : (
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {available.map((page) => (
                            <li
                                key={page.key}
                                className="flex flex-col rounded-lg border border-line p-4"
                            >
                                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-canvas text-forest">
                                    <ResourceIcon builtinKey={page.key} size={24} />
                                </span>
                                <p className="mt-3 text-sm font-medium text-ink">{page.label}</p>
                                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                                    {page.description}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => onAddBuiltin(page.key)}
                                    className="mt-3 rounded-md border border-forest-line px-3 py-1.5 text-xs text-forest hover:bg-forest-tint"
                                >
                                    このページを追加
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 自作 */}
            <section className="rounded-lg border border-line bg-surface p-5">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-ink">新しい資料タイプを作る</h2>
                    <span className="rounded bg-canvas px-2 py-0.5 text-[10px] text-muted">
                        自由設計
                    </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                    部活動、証拠品、楽曲、料理、怪異、試合、夢——作品に必要なものを自分で作れます。
                </p>

                <div className="mt-4 grid gap-5 lg:grid-cols-3">
                    {/* 名前 */}
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="page-label" className="block text-xs text-muted">
                                ページ名
                            </label>
                            <input
                                id="page-label"
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="例：魔法体系、異世界の食文化、宇宙艦の仕様 など"
                                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                        </div>

                        <div>
                            <label htmlFor="page-desc" className="block text-xs text-muted">
                                説明（任意）
                            </label>
                            <textarea
                                id="page-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                placeholder="このページでどんな情報を整理するか、簡単に書いておきましょう。"
                                className="mt-1 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-forest"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!label.trim()}
                            className="w-full rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            このページを作成
                        </button>
                    </div>

                    {/* 入力欄 */}
                    <div>
                        <p className="text-xs text-muted">
                            フィールドを追加
                            <span className="ml-1 text-faint">（ドラッグで並べ替え）</span>
                        </p>

                        <ul className="mt-2 space-y-1.5">
                            {fields.map((field) => (
                                <li
                                    key={field.key}
                                    draggable
                                    onDragStart={() => setDraggingKey(field.key)}
                                    onDragEnd={() => setDraggingKey(null)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => moveField(field.key)}
                                    className={[
                                        "flex items-center gap-2 rounded-md border border-line px-3 py-2",
                                        draggingKey === field.key ? "opacity-40" : "",
                                    ].join(" ")}
                                >
                                    <span className="cursor-grab select-none text-xs text-faint">
                                        ⠿
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-ink">
                                        {field.label}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-faint">
                                        {
                                            CUSTOM_FIELD_CHOICES.find(
                                                (choice) => choice.type === field.type,
                                            )?.label
                                        }
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFields((current) =>
                                                current.filter((row) => row.key !== field.key),
                                            )
                                        }
                                        aria-label={`${field.label}を外す`}
                                        className="shrink-0 text-xs text-faint hover:text-ink"
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="mt-2 flex gap-1.5">
                            <input
                                type="text"
                                value={fieldLabel}
                                onChange={(e) => setFieldLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        addField();
                                    }
                                }}
                                placeholder="入力欄の名前"
                                aria-label="入力欄の名前"
                                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-xs outline-none focus:border-forest"
                            />
                            <select
                                value={fieldType}
                                onChange={(e) =>
                                    setFieldType(e.target.value as ResourceField["type"])
                                }
                                aria-label="入力欄の種類"
                                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-forest"
                            >
                                {CUSTOM_FIELD_CHOICES.map((choice) => (
                                    <option key={choice.type} value={choice.type}>
                                        {choice.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={addField}
                            disabled={!fieldLabel.trim()}
                            className="mt-2 w-full rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-forest-line hover:text-forest disabled:opacity-40"
                        >
                            ＋ フィールドを追加
                        </button>
                    </div>

                    {/* 出来上がり */}
                    <div>
                        <p className="text-xs text-muted">プレビュー（イメージ）</p>
                        <div className="mt-2 rounded-lg border border-line p-3">
                            <p className="text-sm font-medium text-ink">
                                {label.trim() || "ページ名"}
                            </p>
                            <dl className="mt-2 space-y-1.5">
                                <Row label="名前" value="短い文" />
                                <Row label="一言説明" value="短い文" />
                                {fields.map((field) => (
                                    <Row
                                        key={field.key}
                                        label={field.label}
                                        value={
                                            CUSTOM_FIELD_CHOICES.find(
                                                (choice) => choice.type === field.type,
                                            )?.label ?? ""
                                        }
                                    />
                                ))}
                            </dl>
                            {fields.length === 0 && (
                                <p className="mt-2 text-[10px] text-faint">
                                    名前と一言説明は最初から付きます。
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <p className="text-xs text-faint">
                追加したページは、いつでも並べ替え・編集・削除できます。
            </p>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline gap-2 text-xs">
            <dt className="w-20 shrink-0 truncate text-muted">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-faint">{value}</dd>
        </div>
    );
}
