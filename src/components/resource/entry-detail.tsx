/**
 * ============================================================
 * 原石航路 Studio
 * EntryDetail — 選んだ項目の詳細
 *
 * 一覧の右に置く。
 * 資料は「この人は誰と繋がっているか」を確かめに来る場所なので、
 * 入力欄を並べるだけでなく、関係・登場する話・履歴も同じ面に出す。
 * ============================================================
 */

"use client";

import { useEffect, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import EntryImagePanel from "@/components/resource/entry-image-panel";
import MentionTimeline from "@/components/resource/mention-timeline";
import ResourceIcon from "@/components/resource/resource-icons";
import { getRepository } from "@/lib/repository";
import type {
    Episode,
    EntryMention,
    FieldValue,
    ResourceEntry,
    ResourceField,
    ResourcePage,
    ResourceRelation,
} from "@/types";
import { formatEpisodeLabel } from "@/types";

interface Props {
    page: ResourcePage;
    pages: ResourcePage[];
    entry: ResourceEntry;
    allEntries: ResourceEntry[];
    episodes: Episode[];
    relations: ResourceRelation[];
    mentions: EntryMention[];
    canGenerateImage: boolean;
    /** その作品でこれまでに作った図案の数 */
    imageUsedCount: number;
    onGenerateImage: (hint: string, era: string) => Promise<void>;
    onChange: (patch: Partial<ResourceEntry>) => void;
    onSelectEntry: (entryId: string) => void;
    /** 本文のその場所へ飛ぶ */
    onJump?: (episodeId: string, line: number) => void;
    /** 蛍光ペン。資料と話を決めて、本文を開く */
    onPick?: (entryId: string, episodeId: string) => void;
    onClose: () => void;
}

export default function EntryDetail({
    page,
    pages,
    entry,
    allEntries,
    episodes,
    relations,
    mentions,
    canGenerateImage,
    imageUsedCount,
    onGenerateImage,
    onChange,
    onSelectEntry,
    onJump,
    onPick,
    onClose,
}: Props) {
    /*
     * 資料から外した行。
     *
     * 「言及・行動・台詞」は本文を読んで毎回数え直しているので、
     * 外したことは別に覚えておく必要がある。
     */
    const [isPicking, setIsPicking] = useState(false);

    const [hiddenLines, setHiddenLines] = useState<
        { episode_id: string; line: number; text: string }[]
    >([]);

    useEffect(() => {
        void (async () => {
            try {
                const rows = await getRepository().listLineMarks(entry.id);
                setHiddenLines(rows.filter((row) => row.kind === "hidden"));
            } catch {
                /* 読めなくても、数え直した一覧は出す */
            }
        })();
    }, [entry.id]);

    async function hideLine(episodeId: string, line: number, text: string) {
        /*
         * 画面から先に消す。
         * 保存を待たせると、押しても反応が無いように見える。
         */
        setHiddenLines((prev) => [...prev, { episode_id: episodeId, line, text }]);

        try {
            await getRepository().hideMentionLine(entry.id, episodeId, line, text);
        } catch {
            /* 保存できなければ、戻す */
            setHiddenLines((prev) =>
                prev.filter(
                    (row) => !(row.episode_id === episodeId && row.line === line),
                ),
            );
            window.alert("外せませんでした。時間をおいて試してください。");
        }
    }

    const [isEditing, setIsEditing] = useState(false);

    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    const entryById = new Map(allEntries.map((row) => [row.id, row]));
    const pageById = new Map(pages.map((row) => [row.id, row]));

    const related = relations
        .filter(
            (relation) =>
                relation.from_entry_id === entry.id || relation.to_entry_id === entry.id,
        )
        .map((relation) => {
            const otherId =
                relation.from_entry_id === entry.id
                    ? relation.to_entry_id
                    : relation.from_entry_id;
            return { relation, other: entryById.get(otherId) };
        })
        .filter((row) => row.other);

    const appearedIn = mentions
        .filter((mention) => mention.entry_id === entry.id)
        .map((mention) => episodes.find((episode) => episode.id === mention.episode_id))
        .filter((episode): episode is Episode => Boolean(episode));
    const uniqueEpisodes = Array.from(new Map(appearedIn.map((e) => [e.id, e])).values());

    return (
        <aside className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
            {/* 見出し */}
            <div className="flex items-start gap-3 border-b border-line px-6 py-4">
                <Figure entry={entry} size={56} />

                <div className="min-w-0 flex-1">
                    {entry.candidate_source && (
                        <span className="inline-block rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                            本文から追加
                        </span>
                    )}
                    <h3 className="mt-0.5 truncate text-base font-medium text-ink">
                        {entry.name || "（名前未設定）"}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {entry.summary || "説明はまだありません"}
                    </p>
                    {aliases.length > 0 && (
                        <p className="mt-1 truncate text-xs text-faint">
                            別名：{aliases.join("、")}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="shrink-0 px-1 text-sm text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {isEditing ? (
                    <EntryForm
                        page={page}
                        entry={entry}
                        aliases={aliases}
                        allEntries={allEntries}
                        episodes={episodes}
                        canGenerateImage={canGenerateImage}
                        imageUsedCount={imageUsedCount}
                        onGenerateImage={onGenerateImage}
                        onChange={onChange}
                    />
                ) : (
                    <>
                        {/*
                         * 入っている欄を先に、空の欄はまとめて後ろへ。
                         * 空欄を同じ大きさで並べると、書いた内容が埋もれる。
                         */}
                        {(() => {
                            const own = page.fields.filter(
                                (field) =>
                                    field.type !== "relation_entry" &&
                                    field.type !== "relation_episode",
                            );
                            const filled = own.filter((field) =>
                                hasValue(entry.values[field.key]),
                            );
                            const empty = own.filter(
                                (field) => !hasValue(entry.values[field.key]),
                            );

                            return (
                                <>
                                    {filled.length > 0 && (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {filled.map((field) => (
                                                <div
                                                    key={field.key}
                                                    className={
                                                        field.type === "textarea"
                                                            ? "sm:col-span-2"
                                                            : ""
                                                    }
                                                >
                                                    <Card title={field.label}>
                                                        <FieldReadout
                                                            value={
                                                                entry.values[field.key]
                                                            }
                                                        />
                                                    </Card>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {empty.length > 0 && (
                                        <div className="rounded-lg border border-dashed border-line px-4 py-3">
                                            <p className="text-[11px] text-faint">
                                                まだ書いていない項目
                                            </p>
                                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                                {empty.map((field) => (
                                                    <li key={field.key}>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setIsEditing(true)
                                                            }
                                                            className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                                                        >
                                                            ＋ {field.label}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        <div className="grid gap-3 lg:grid-cols-2">
                        {/* 関係している項目 */}
                        <Card
                            title={`関係している項目（${related.length}）`}
                            icon={<ResourceIcon builtinKey="relation" size={14} />}
                        >
                            {related.length === 0 ? (
                                <p className="text-xs text-faint">まだありません。</p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {related.slice(0, 10).map(({ relation, other }) => (
                                        <li key={relation.id}>
                                            <button
                                                type="button"
                                                onClick={() => onSelectEntry(other!.id)}
                                                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-canvas"
                                            >
                                                <Figure entry={other!} size={24} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs text-ink">
                                                        {other!.name}
                                                    </span>
                                                    <span className="block truncate text-[10px] text-faint">
                                                        {pageById.get(other!.page_id)?.label}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                                                    {relation.label}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>

                        </div>

                        {/*
                         * 本文での登場。
                         * 「このキャラ、こんなこと言ってたな」を辿る場所。
                         * 資料の中で一番よく開くところなので、下ではなく
                         * 関係のすぐ後ろに置く。
                         */}
                        <Card title="本文での登場">
                            {/*
                              * 蛍光ペン。
                              *
                              * 押すと話を選び、その本文が開く。
                              * 本文で行を長押しすると、
                              * この資料に足せる。
                              *
                              * ★ 資料の側から始める。
                              *   どの資料に入れるかが最初に決まるので、
                              *   本文の側で選ばせる手間が要らない。
                              */}
                            {onPick && episodes.length > 0 && (
                                <div className="mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsPicking((v) => !v)}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-forest-line px-3 py-1.5 text-[11.5px] text-forest hover:bg-forest-tint"
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="1.8"
                                            strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m15 5 4 4" />
                                            <path d="M13 7 8.5 11.5a2 2 0 0 0-.5 1v3h3a2 2 0 0 0 1-.5L16.5 10.5" />
                                            <path d="M5 20h14" />
                                        </svg>
                                        本文から足す
                                    </button>

                                    {isPicking && (
                                        <div className="mt-2 rounded-lg border border-line bg-canvas p-2">
                                            <p className="px-1 pb-1.5 text-[11px] text-muted">
                                                どの話の本文を開きますか
                                            </p>
                                            <div className="thin-scroll max-h-40 overflow-y-auto">
                                                {episodes.map((ep) => (
                                                    <button
                                                        key={ep.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setIsPicking(false);
                                                            onPick(entry.id, ep.id);
                                                        }}
                                                        className="block w-full truncate rounded px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface"
                                                    >
                                                        第{ep.ep_number}話　{ep.title || "無題"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <MentionTimeline
                                entry={entry}
                                episodes={episodes}
                                onJump={onJump}
                                hidden={hiddenLines}
                                onHide={hideLine}
                            />
                        </Card>

                        {entry.candidate_source && (
                            <Card title="本文での記述">
                                {entry.source_ref && (
                                    <p className="mb-1 text-[11px] text-forest">
                                        {entry.source_ref}
                                    </p>
                                )}
                                <p className="text-xs leading-relaxed text-muted">
                                    {entry.candidate_source}
                                </p>
                            </Card>
                        )}
                    </>
                )}
            </div>

            {/* 操作 */}
            <div className="flex gap-2 border-t border-line px-6 py-3">
                <button
                    type="button"
                    onClick={() => setIsEditing((editing) => !editing)}
                    className={[
                        "flex-1 rounded-md px-3 py-2 text-sm",
                        isEditing
                            ? "bg-forest text-white hover:bg-forest-dark"
                            : "border border-line text-ink hover:border-forest-line hover:text-forest",
                    ].join(" ")}
                >
                    {isEditing ? "編集を終える" : "編集"}
                </button>
                <button
                    type="button"
                    onClick={() => onChange({ is_major: !entry.is_major })}
                    aria-pressed={entry.is_major}
                    className={[
                        "rounded-md border px-3 py-2 text-sm",
                        entry.is_major
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line text-muted hover:text-ink",
                    ].join(" ")}
                >
                    主要
                </button>
            </div>
        </aside>
    );
}

/**
 * ============================================================
 * 編集
 * ============================================================
 */

function EntryForm({
    page,
    entry,
    aliases,
    allEntries,
    episodes,
    canGenerateImage,
    imageUsedCount,
    onGenerateImage,
    onChange,
}: {
    page: ResourcePage;
    entry: ResourceEntry;
    aliases: string[];
    allEntries: ResourceEntry[];
    episodes: Episode[];
    canGenerateImage: boolean;
    imageUsedCount: number;
    onGenerateImage: (hint: string, era: string) => Promise<void>;
    onChange: (patch: Partial<ResourceEntry>) => void;
}) {
    const [name, setName] = useState(entry.name);
    const [summary, setSummary] = useState(entry.summary);
    const [aliasDraft, setAliasDraft] = useState("");

    /*
     * 入力欄を役目ごとに分ける。
     * 一列にずらりと並べると、どこに何を書くのかが分からなくなる。
     *
     *   見出し … 名前・一言説明・別名。どの項目かを決めるもの
     *   中身 … そのページ固有の欄。書き手が育てていくところ
     *   つながり … 他の項目や話を指す欄
     */
    const linkFields = page.fields.filter(
        (field) =>
            field.type === "relation_entry" || field.type === "relation_episode",
    );
    const bodyFields = page.fields.filter(
        (field) =>
            field.type !== "relation_entry" && field.type !== "relation_episode",
    );

    return (
        <div className="space-y-5">
            {page.image_style && (
                <Section title="図案">
                    <EntryImagePanel
                        style={page.image_style}
                        name={entry.name}
                        imageUrl={entry.image_url}
                        usedCount={imageUsedCount}
                        canGenerate={canGenerateImage}
                        onGenerate={onGenerateImage}
                        onChange={(imageUrl) => onChange({ image_url: imageUrl })}
                    />
                </Section>
            )}

            <Section title="見出し">
                {/* 名前と一言説明は横に並べる。どちらも 1 行で済む */}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="名前" htmlFor="entry-name">
                        <input
                            id="entry-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => onChange({ name })}
                            className={inputClass}
                        />
                    </Labeled>

                    <Labeled label="一言説明" htmlFor="entry-summary">
                        <input
                            id="entry-summary"
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            onBlur={() => onChange({ summary })}
                            className={inputClass}
                        />
                    </Labeled>
                </div>

                {/*
                 * 別名。
                 *
                 * ほかの欄と同じ見た目に並べていたので、
                 * 「決めた名前の下に、引っかかる名前を登録したい」
                 * という声が届いた。まさにこの欄のことだった。
                 * 枠で囲って、何をする所かを先に言う。
                 */}
                <div className="mt-3 rounded-lg border border-forest-line bg-forest-tint/25 p-3">
                    <span className="block text-sm font-medium text-ink">
                        別名・呼び方
                    </span>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                        「タロウ」「太郎さん」のような別の書き方をここに入れておくと、
                        本文にその名前が出てきても同じものとして数えられます。
                        新しい項目は増えません。
                    </p>
                    <input
                        type="text"
                        value={aliasDraft}
                        onChange={(e) => setAliasDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                const alias = aliasDraft.trim();
                                if (alias && !aliases.includes(alias)) {
                                    onChange({ aliases: [...aliases, alias] });
                                }
                                setAliasDraft("");
                            }
                        }}
                        placeholder="入力して Enter"
                        aria-label="別名を追加"
                        className={inputClass}
                    />
                    {aliases.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                            {aliases.map((alias) => (
                                <li
                                    key={alias}
                                    className="flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs"
                                >
                                    {alias}
                                    <button
                                        type="button"
                                        aria-label={`${alias}を外す`}
                                        onClick={() =>
                                            onChange({
                                                aliases: aliases.filter(
                                                    (row) => row !== alias,
                                                ),
                                            })
                                        }
                                        className="text-faint hover:text-ink"
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Section>

            {bodyFields.length > 0 && (
                <Section title={page.label + "の中身"}>
                    {/*
                     * 1 行で済む欄は 2 列、長い文章の欄は 1 列。
                     * 短い欄まで横幅いっぱいに伸ばすと、間延びして読みにくい。
                     */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        {bodyFields.map((field) => (
                            <div
                                key={field.key}
                                className={
                                    field.type === "textarea" ? "sm:col-span-2" : ""
                                }
                            >
                                <FieldInput
                                    field={field}
                                    value={entry.values[field.key]}
                                    allEntries={allEntries.filter(
                                        (row) => row.id !== entry.id,
                                    )}
                                    episodes={episodes}
                                    onChange={(value) =>
                                        onChange({
                                            values: {
                                                ...entry.values,
                                                [field.key]: value,
                                            },
                                        })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {linkFields.length > 0 && (
                <Section title="つながり">
                    <div className="space-y-3">
                        {linkFields.map((field) => (
                            <FieldInput
                                key={field.key}
                                field={field}
                                value={entry.values[field.key]}
                                allEntries={allEntries.filter(
                                    (row) => row.id !== entry.id,
                                )}
                                episodes={episodes}
                                onChange={(value) =>
                                    onChange({
                                        values: { ...entry.values, [field.key]: value },
                                    })
                                }
                            />
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}

/**
 * ============================================================
 * ひとまとまり
 *
 * 見出しをつけて枠で囲む。どこまでが同じ役目の欄か分かるように。
 * ============================================================
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-faint">
                {title}
            </h3>
            <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
                {children}
            </div>
        </section>
    );
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

const inputClass =
    "mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest";

function Figure({ entry, size }: { entry: ResourceEntry; size: number }) {
    return (
        <span style={{ width: size, height: size }} className="shrink-0">
            <EntryImage
                src={entry.image_url}
                fallback={Array.from(entry.name)[0] ?? "?"}
                className="h-full w-full rounded-full object-cover"
            />
        </span>
    );
}

function Card({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-line px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-muted">
                {icon && <span className="text-forest">{icon}</span>}
                {title}
            </p>
            <div className="mt-1.5">{children}</div>
        </div>
    );
}

/** 値が入っているか。空文字・空配列・未設定はすべて「無し」 */
function hasValue(value: FieldValue | undefined): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return true;
}

function FieldReadout({ value }: { value: FieldValue | undefined }) {
    if (value === undefined || value === "" || value === false) {
        return <p className="text-xs text-faint">—</p>;
    }
    if (Array.isArray(value)) {
        return (
            <ul className="flex flex-wrap gap-1">
                {value.map((item) => (
                    <li
                        key={String(item)}
                        className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted"
                    >
                        {String(item)}
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink">
            {String(value)}
        </p>
    );
}

function Labeled({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
                {label}
            </label>
            {children}
        </div>
    );
}

function FieldInput({
    field,
    value,
    allEntries,
    episodes,
    onChange,
}: {
    field: ResourceField;
    value: FieldValue | undefined;
    allEntries: ResourceEntry[];
    episodes: Episode[];
    onChange: (value: FieldValue) => void;
}) {
    const [draft, setDraft] = useState(typeof value === "string" ? value : "");

    if (field.type === "relation_entry" || field.type === "relation_episode") {
        const selected = Array.isArray(value) ? value : [];
        const options =
            field.type === "relation_episode"
                ? episodes.map((ep) => ({ id: ep.id, label: formatEpisodeLabel(ep) }))
                : allEntries.map((row) => ({
                      id: row.id,
                      label: row.name || "（名前未設定）",
                  }));

        return (
            <div>
                <span className="block text-sm font-medium text-ink">{field.label}</span>
                {options.length === 0 ? (
                    <p className="mt-1.5 text-xs text-faint">
                        結びつけられるものがまだありません。
                    </p>
                ) : (
                    <ul className="thin-scroll mt-1.5 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                        {options.map((option) => {
                            const isOn = selected.includes(option.id);
                            return (
                                <li key={option.id}>
                                    <button
                                        type="button"
                                        aria-pressed={isOn}
                                        onClick={() =>
                                            onChange(
                                                isOn
                                                    ? selected.filter((id) => id !== option.id)
                                                    : [...selected, option.id],
                                            )
                                        }
                                        className={[
                                            "rounded-full border px-2.5 py-1 text-xs",
                                            isOn
                                                ? "border-forest bg-forest-tint text-forest"
                                                : "border-line text-muted hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        {option.label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );
    }

    if (field.type === "tags") {
        const tags = Array.isArray(value) ? value : [];
        return (
            <div>
                <span className="block text-sm font-medium text-ink">{field.label}</span>
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            const tag = draft.trim();
                            if (tag && !tags.includes(tag)) onChange([...tags, tag]);
                            setDraft("");
                        }
                    }}
                    placeholder="入力して Enter"
                    aria-label={field.label}
                    className={inputClass}
                />
                {tags.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                            <li
                                key={tag}
                                className="flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs"
                            >
                                {tag}
                                <button
                                    type="button"
                                    aria-label={`${tag}を外す`}
                                    onClick={() => onChange(tags.filter((row) => row !== tag))}
                                    className="text-faint hover:text-ink"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    if (field.type === "checkbox") {
        return (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => onChange(e.target.checked)}
                    className="accent-[var(--color-forest)]"
                />
                {field.label}
            </label>
        );
    }

    if (field.type === "select") {
        return (
            <Labeled label={field.label} htmlFor={field.key}>
                <select
                    id={field.key}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputClass} bg-surface`}
                >
                    <option value="">未選択</option>
                    {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </Labeled>
        );
    }

    if (field.type === "textarea") {
        return (
            <Labeled label={field.label} htmlFor={field.key}>
                <textarea
                    id={field.key}
                    rows={5}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => onChange(draft)}
                    placeholder={field.placeholder}
                    className={`${inputClass} resize-y leading-relaxed`}
                />
            </Labeled>
        );
    }

    return (
        <Labeled label={field.label} htmlFor={field.key}>
            <input
                id={field.key}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onChange(draft)}
                placeholder={field.placeholder}
                className={inputClass}
            />
        </Labeled>
    );
}
