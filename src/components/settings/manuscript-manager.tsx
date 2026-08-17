/**
 * ============================================================
 * 原石航路 Studio
 * ManuscriptManager — 設定 / 原稿管理
 *
 * 長文原稿の一括取り込みと、原稿の書き出し。
 * ============================================================
 */

"use client";

/**
 * 本文を切る印。
 *
 * 取り込んだ長い文を、話ごとに分けるために使う。
 * 本文に紛れない見た目にしておく。
 */
/*
 * 切り印は分割する側と同じものを使う。
 * 別々に持つと、片方を直したときにずれて、
 * 押しても切れなくなる。
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { getRepository } from "@/lib/repository";
import { buildEpub, buildWord } from "@/lib/export/documents";
import { ACCEPTED_IMPORT_TYPES, readManuscriptFile } from "@/lib/utils/file-import";
import {
    buildTxt,
    downloadTextFile,
    SPLIT_MARK,
    splitManuscript,
    suggestSplitPoints,
} from "@/lib/utils/manuscript";
import { openPrintView } from "@/lib/utils/pdf-export";
import { formatNumber } from "@/lib/utils/text";
import type { DisplaySettings, Episode, Work } from "@/types";
import { formatEpisodeLabel } from "@/types";

interface Props {
    work: Work;
    episodes: Episode[];
    settings: DisplaySettings;
    onImport: (
        items: { title: string; body: string; chapterTitle?: string }[],
        mode: "append" | "replace",
    ) => Promise<void>;
}

export default function ManuscriptManager({ work, episodes, settings, onImport }: Props) {
    const [raw, setRaw] = useState("");
    const [detectHeadings, setDetectHeadings] = useState(true);
    /*
     * 「第◯章」の扱い。
     * 1 話ぶんとして書く人と、話をまとめる見出しとして
     * 書く人がいる。どちらか選んでもらう。
     */
    const [chapterAs, setChapterAs] = useState<"episode" | "chapter">("episode");
    /* 貼った原稿の中を探す */
    const [query, setQuery] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [fileNotice, setFileNotice] = useState("");
    const [isReadingFile, setIsReadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /*
     * 貼り付けた原稿から分割する。
     *
     * 手を入れたものは edited に持つ。
     * 貼り直したら、手を入れたぶんは捨てて分割し直す。
     */
    const [edited, setEdited] = useState<ReturnType<typeof splitManuscript> | null>(
        null,
    );

    const auto = useMemo(
        () => splitManuscript(raw, { detectHeadings, chapterAs }),
        [raw, detectHeadings, chapterAs],
    );

    const chunks = edited ?? auto;
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.charCount, 0);

    /*
     * 探している言葉に当たる話。
     *
     * 題名と本文の両方を見る。
     * 「あの場面はどの話だったか」を探すのに、
     * 題名だけでは足りない。
     */
    /* 切ったほうがよさそうな場所 */
    const suggestions = useMemo(() => suggestSplitPoints(raw), [raw]);

    /**
     * 指した場所に切り印を入れる。
     *
     * 入れたあと、その位置へカーソルを移す。
     * どこに入ったか見えないと、続けて指せない。
     */
    function insertSplitAt(at: number) {
        const next = raw.slice(0, at) + SPLIT_MARK + "\n" + raw.slice(at);
        setRaw(next);
        setEdited(null);

        window.setTimeout(() => {
            const area = rawRef.current;
            if (!area) return;
            const to = at + SPLIT_MARK.length + 1;
            area.focus();
            area.setSelectionRange(to, to);
            /* その行が見えるところまで送る */
            const ratio = to / Math.max(1, next.length);
            area.scrollTop = area.scrollHeight * ratio - area.clientHeight / 2;
        }, 0);
    }

    /**
     * 原稿の中の、その話の場所へ移す。
     *
     * 探している言葉があればそこを、
     * 無ければその話の頭を選んで見せる。
     */
    function jumpToChunk(chunk: { title: string; body: string }) {
        const area = rawRef.current;
        if (!area) return;

        const needle = query.trim();
        const head = chunk.body.slice(0, 30);

        /* まず本文の頭で探し、そこから言葉を探す */
        let at = head ? raw.indexOf(head) : -1;
        if (at < 0 && chunk.title) at = raw.indexOf(chunk.title);
        if (at < 0) at = 0;

        if (needle) {
            const inBody = raw.indexOf(needle, at);
            if (inBody >= 0) at = inBody;
        }

        area.focus();
        area.setSelectionRange(at, at + (needle ? needle.length : 0));

        const ratio = at / Math.max(1, raw.length);
        area.scrollTop = area.scrollHeight * ratio - area.clientHeight / 2;
    }

    const matchedIndexes = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];

        return chunks
            .map((chunk, index) => ({ chunk, index }))
            .filter(
                ({ chunk }) =>
                    chunk.title.toLowerCase().includes(needle) ||
                    chunk.body.toLowerCase().includes(needle),
            )
            .map(({ index }) => index);
    }, [chunks, query]);

    /* 書き出しに載せる作者名 */
    const [profileName, setProfileName] = useState("名無しの書き手");

    useEffect(() => {
        void (async () => {
            const profile = await getRepository().getProfile();
            setProfileName(profile.display_name || "名無しの書き手");
        })();
    }, []);

    /* 原稿の欄と、いまの位置 */
    const rawRef = useRef<HTMLTextAreaElement>(null);
    const [caret, setCaret] = useState(0);

    /** 手で入れた切れ目の数 */
    const marks = raw.split(SPLIT_MARK).length - 1;

    /**
     * いまの位置に切れ目を入れる。
     *
     * 行の途中で切ると読みにくいので、
     * その行の頭まで戻してから入れる。
     */
    function insertSplit() {
        const at = raw.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;

        const next =
            raw.slice(0, at) + SPLIT_MARK + "\n" + raw.slice(at);
        setRaw(next);
        setEdited(null);

        /* 入れた印の後ろへ、書き口を移す */
        window.setTimeout(() => {
            const area = rawRef.current;
            if (!area) return;
            const to = at + SPLIT_MARK.length + 1;
            area.focus();
            area.setSelectionRange(to, to);
            setCaret(to);
        }, 0);
    }

    function clearSplits() {
        setRaw(raw.split(SPLIT_MARK).join("").replace(/\n{3,}/g, "\n\n"));
        setEdited(null);
    }

    /* どこへ入れるか */
    const [mode, setMode] = useState<"append" | "replace">("append");

    async function handleImport() {
        if (chunks.length === 0 || isImporting) return;

        const message =
            mode === "replace"
                ? `いまの${episodes.length}話をすべて消して、${chunks.length}話に入れ替えます。元には戻せません。`
                : `${chunks.length}話を、いまの${episodes.length}話のうしろに足します。`;

        if (!window.confirm(message)) return;

        setIsImporting(true);
        await onImport(
            chunks.map((chunk) => ({
                title: chunk.title,
                body: chunk.body,
                chapterTitle: chunk.chapterTitle,
            })),
            mode,
        );
        setRaw("");
        setEdited(null);
        setIsImporting(false);
    }

    async function handleSelectFile(file: File | undefined) {
        if (!file) return;
        setIsReadingFile(true);
        setFileNotice("");

        try {
            const result = await readManuscriptFile(file);
            // すでに書きかけの内容があれば後ろに足す。上書きで消さない
            setRaw((current) => (current ? `${current}\n\n${result.text}` : result.text));

            const isPdf = file.name.toLowerCase().endsWith(".pdf");
            setFileNotice(
                isPdf
                    ? `${file.name} を読み込みました。PDF は改行や段落が原稿どおりに戻らないことがあります。`
                    : `${file.name} を読み込みました（${result.encoding}）。`,
            );
        } catch {
            setFileNotice(
                `${file.name} を読み込めませんでした。別の形式で保存し直してみてください。`,
            );
        } finally {
            setIsReadingFile(false);
            // 同じファイルを選び直せるように値を空にする
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function handleExportPdf() {
        const opened = openPrintView(work.title, episodes, settings);
        if (!opened) {
            window.alert(
                "印刷用の画面を開けませんでした。ブラウザのポップアップ設定を確認してください。",
            );
        }
    }

    /**
     * 取り込む前の分割を直す。
     *
     * 自動の分割は必ずどこかを外すので、
     * 入れる前に手を入れられるようにする。
     */
    function renameChunk(index: number, title: string) {
        setEdited((rows) =>
            (rows ?? chunks).map((row, at) =>
                at === index ? { ...row, title } : row,
            ),
        );
    }

    function mergeUp(index: number) {
        setEdited((rows) => {
            const list = [...(rows ?? chunks)];
            if (index === 0) return list;

            const previous = list[index - 1];
            const current = list[index];

            list[index - 1] = {
                ...previous,
                body: `${previous.body}\n\n${current.body}`,
                charCount: previous.charCount + current.charCount,
            };
            list.splice(index, 1);
            return list;
        });
    }

    function removeChunk(index: number) {
        setEdited((rows) => (rows ?? chunks).filter((_, at) => at !== index));
    }

    function handleExportTxt() {
        const content = buildTxt(work.title, episodes);
        downloadTextFile(`${work.title}.txt`, content);
    }

    function handleExportDocx() {
        // Word が読む HTML。拡張子を .doc にすれば Word で開ける
        downloadTextFile(`${work.title}.doc`, buildWord(work, episodes));
    }

    async function handleExportEpub() {
        const blob = await buildEpub(
            work,
            episodes,
            profileName,
            settings.writing_mode === "vertical",
        );

        /* 出来た zip を落とす */
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${work.title || "作品"}.epub`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function handleExportJson() {
        const content = JSON.stringify({ work, episodes }, null, 2);
        downloadTextFile(`${work.title}.json`, content);
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-line bg-surface">
                <div className="border-b border-line px-6 py-5">
                    <h2 className="text-base font-medium text-ink">一括取り込み</h2>
                    <p className="mt-1 text-sm text-muted">
                        書きためた原稿を貼り付けて、話に分けます。
                    </p>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_IMPORT_TYPES}
                            onChange={(e) => void handleSelectFile(e.target.files?.[0])}
                            className="hidden"
                            id="manuscript-file"
                        />

                        <textarea
                            value={raw}
                            ref={rawRef}
                            onChange={(e) => {
                                setRaw(e.target.value);
                                // 貼り直したら、手を入れたぶんは捨てる
                                setEdited(null);
                            }}
                            onSelect={(e) => {
                                const area = e.target as HTMLTextAreaElement;
                                setCaret(area.selectionStart);
                            }}
                            rows={14}
                            aria-label="取り込む原稿"
                            placeholder={"第1話　風の違和感\n\nその日、風は静かだった。\n\n\n第2話　粒子のゆらぎ\n\n……"}
                            className="thin-scroll w-full resize-y rounded-md border border-line px-3 py-3 text-sm leading-relaxed outline-none focus:border-forest"
                        />

                        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={detectHeadings}
                                onChange={(e) => setDetectHeadings(e.target.checked)}
                                className="accent-[var(--color-forest)]"
                            />
                            章見出し・シーン区切りを検出する（推奨）
                        </label>
                        <p className="mt-1 text-xs text-faint">
                            「第1話」「◆」「###」などの行を区切りとして扱います。
                            見つからないときは、3行以上の空行で分けます。
                            切りたい場所が違うときは、下の「ここで切る」で指せます。
                        </p>

                        {/*
                         * 「第◯章」の扱い。
                         *
                         * 1 話ぶんのつもりで書く人と、
                         * 話をまとめる見出しのつもりで書く人がいる。
                         * どちらかで結果がまるで変わるので、選んでもらう。
                         */}
                        {detectHeadings && (
                            <div className="mt-3 rounded-md border border-line px-3.5 py-3">
                                <p className="text-[11px] text-ink">
                                    原稿の中の「第◯章」は
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setChapterAs("episode")}
                                        className={[
                                            "rounded-full border px-3 py-1 text-[11px]",
                                            chapterAs === "episode"
                                                ? "border-forest bg-forest text-white"
                                                : "border-line text-muted hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        1話として切る
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChapterAs("chapter")}
                                        className={[
                                            "rounded-full border px-3 py-1 text-[11px]",
                                            chapterAs === "chapter"
                                                ? "border-forest bg-forest text-white"
                                                : "border-line text-muted hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        章の見出しとして扱う
                                    </button>
                                </div>
                                <p className="mt-2 text-[10px] leading-relaxed text-faint">
                                    {chapterAs === "episode"
                                        ? "「第一章」も1話として数えます。章＝1話ぶんで書いている方はこちら。"
                                        : "「第一章」では切らず、中の「第◯話」で切ります。章の名前は各話に添えます。"}
                                </p>
                            </div>
                        )}

                        {/*
                         * 切れ目を手で入れる。
                         *
                         * 自動の分割は必ずどこかを外す。
                         * 「ここで切る」と指せるようにする。
                         */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={insertSplit}
                                disabled={!raw}
                                className="rounded-md border border-forest-line px-4 py-1.5 text-xs text-forest hover:bg-forest-tint disabled:opacity-40"
                            >
                                ここで切る
                            </button>

                            {marks > 0 && (
                                <>
                                    <span className="text-[11px] text-muted">
                                        切れ目 {marks}か所
                                    </span>
                                    <button
                                        type="button"
                                        onClick={clearSplits}
                                        className="text-[11px] text-faint hover:text-ink"
                                    >
                                        すべて外す
                                    </button>
                                </>
                            )}

                            <span className="text-[10px] text-faint">
                                切りたい場所を押してから
                            </span>
                        </div>

                        {/*
                         * 切る場所の提案。
                         *
                         * 自分で場所を探すのは骨が折れる。
                         * 見出しらしい行と、空行が続いた所を挙げて、
                         * 押せばそこに印が入るようにする。
                         */}
                        {suggestions.length > 0 && (
                            <div className="mt-3 rounded-md border border-line px-3.5 py-3">
                                <p className="text-[11px] text-ink">
                                    ここで切れそうです
                                    <span className="ml-1.5 text-[10px] text-faint">
                                        押すと印が入ります
                                    </span>
                                </p>
                                <ul className="thin-scroll mt-2 max-h-32 space-y-1 overflow-y-auto">
                                    {suggestions.map((point, index) => (
                                        <li key={index}>
                                            <button
                                                type="button"
                                                onClick={() => insertSplitAt(point.at)}
                                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-canvas"
                                            >
                                                <span className="shrink-0 rounded bg-forest-tint px-1.5 py-0.5 text-[9px] text-forest">
                                                    {point.label}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                                                    {point.preview}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={chunks.length === 0 || isImporting}
                                className="rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {chunks.length === 0
                                    ? "話に分割する"
                                    : `${chunks.length}話として取り込む`}
                            </button>

                            <label
                                htmlFor="manuscript-file"
                                className="cursor-pointer rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-forest-line hover:text-forest"
                            >
                                ファイルから読み込む
                                <span className="ml-2 text-xs text-faint">
                                    {isReadingFile ? "読み込み中" : "TXT / MD / PDF"}
                                </span>
                            </label>
                        </div>

                        {fileNotice && (
                            <p className="mt-3 rounded-md bg-forest-tint px-3 py-2 text-xs text-forest">
                                {fileNotice}
                            </p>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-medium text-ink">分割結果のプレビュー</h3>
                            {chunks.length > 0 && (
                                <span className="text-[11px] text-faint">
                                    {query.trim()
                                        ? `${matchedIndexes.length}話が一致`
                                        : `${chunks.length}話`}
                                </span>
                            )}
                        </div>

                        {/*
                         * 貼った原稿の中を探す。
                         *
                         * 何十話も貼ったあと、直したい話を
                         * 目で追って探すのは骨が折れる。
                         * 題名と本文の両方から探し、
                         * 当たった話だけを残して見せる。
                         */}
                        {chunks.length > 0 && (
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="題名や本文の言葉で探す"
                                className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                        )}
                        {chunks.length === 0 ? (
                            <div className="mt-2 flex h-[340px] items-center justify-center rounded-md border border-dashed border-line">
                                <p className="text-sm text-faint">
                                    原稿を貼り付けると、ここに結果が出ます。
                                </p>
                            </div>
                        ) : (
                            <>
                                {/*
                                 * 取り込む前に直せるようにする。
                                 *
                                 * 自動の分割は必ずどこかを外す。
                                 * 直せないと、入れてから手作業になる。
                                 */}
                                <ul className="thin-scroll mt-2 h-[340px] divide-y divide-line overflow-y-auto rounded-md border border-line">
                                    {chunks.map((chunk, index) => {
                                        /* 探しているときは、当たった話だけ出す */
                                        if (
                                            query.trim() &&
                                            !matchedIndexes.includes(index)
                                        ) {
                                            return null;
                                        }
                                        return (
                                        <li
                                            key={index}
                                            className="group flex items-center gap-2 px-3 py-2 text-sm"
                                        >
                                            <span className="w-5 shrink-0 text-right text-xs text-faint">
                                                {index + 1}
                                            </span>

                                            {/*
                                             * 探して見つけた話は、原稿のその場所へ飛べる。
                                             * 一覧で見つけても、直すのは左の原稿なので、
                                             * そこまで自分で送るのは骨が折れる。
                                             */}
                                            {query.trim() && (
                                                <button
                                                    type="button"
                                                    onClick={() => jumpToChunk(chunk)}
                                                    title="原稿のこの場所へ移動"
                                                    className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                >
                                                    原稿へ
                                                </button>
                                            )}

                                            <input
                                                type="text"
                                                value={chunk.title}
                                                onChange={(e) =>
                                                    renameChunk(index, e.target.value)
                                                }
                                                placeholder="（タイトルなし）"
                                                aria-label={`${index + 1}話の題名`}
                                                className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-forest"
                                            />

                                            <span className="shrink-0 text-xs text-muted">
                                                {formatNumber(chunk.charCount)}字
                                            </span>

                                            {/* 前の話とくっつける */}
                                            <button
                                                type="button"
                                                onClick={() => mergeUp(index)}
                                                disabled={index === 0}
                                                title="前の話とつなげる"
                                                className="shrink-0 px-1 text-xs text-faint opacity-0 hover:text-forest disabled:invisible group-hover:opacity-100"
                                            >
                                                ↑結合
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => removeChunk(index)}
                                                title="この話を取り込まない"
                                                className="shrink-0 px-1 text-xs text-faint opacity-0 hover:text-[var(--color-danger)] group-hover:opacity-100"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                        );
                                    })}

                                    {query.trim() && matchedIndexes.length === 0 && (
                                        <li className="px-3 py-6 text-center text-xs text-faint">
                                            見つかりませんでした
                                        </li>
                                    )}
                                </ul>
                                <p className="mt-2 text-right text-xs text-muted">
                                    合計：{chunks.length}話　{formatNumber(totalChars)}文字
                                </p>

                                {/*
                                 * すでに話があるときは、どうするか尋ねる。
                                 * 黙って後ろへ足すと、置き換えたい人が困る。
                                 */}
                                {episodes.length > 0 && (
                                    <div className="mt-3 rounded-md border border-line px-3.5 py-3">
                                        <p className="text-[11px] text-ink">
                                            この作品にはすでに{episodes.length}話あります
                                        </p>

                                        <div className="mt-2 space-y-1.5">
                                            {(
                                                [
                                                    {
                                                        value: "append",
                                                        label: "うしろに足す",
                                                    },
                                                    {
                                                        value: "replace",
                                                        label: "すべて入れ替える",
                                                    },
                                                ] as const
                                            ).map((row) => (
                                                <label
                                                    key={row.value}
                                                    className="flex cursor-pointer items-center gap-2"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="import-mode"
                                                        checked={mode === row.value}
                                                        onChange={() => setMode(row.value)}
                                                        className="accent-[var(--color-forest)]"
                                                    />
                                                    <span className="text-[11px] text-ink">
                                                        {row.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-line bg-surface">
                <div className="border-b border-line px-6 py-5">
                    <h2 className="text-base font-medium text-ink">書き出し</h2>
                    <p className="mt-1 text-sm text-muted">原稿を手元のファイルに保存します。</p>
                </div>

                <div className="flex flex-wrap gap-2 px-6 py-5">
                    <ExportButton label="TXT" onClick={handleExportTxt} disabled={episodes.length === 0} />
                    <ExportButton label="Word" onClick={handleExportDocx} disabled={episodes.length === 0} />
                    <ExportButton label="EPUB" onClick={() => void handleExportEpub()} disabled={episodes.length === 0} />
                    <ExportButton label="PDF" onClick={handleExportPdf} disabled={episodes.length === 0} />

                    <button
                        type="button"
                        onClick={handleExportJson}
                        disabled={episodes.length === 0}
                        className="ml-auto rounded-md bg-forest px-4 py-2 text-xs text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        バックアップを作成
                    </button>
                </div>

                <p className="border-t border-line px-6 py-4 text-xs leading-relaxed text-faint">
                    PDF は表示設定の組み方と文字の大きさを使います。
                    バックアップには本文・設定・資料がすべて入ります。
                </p>
            </div>

            {episodes.length > 0 && (
                <div className="rounded-lg border border-line bg-surface px-6 py-5">
                    <h2 className="text-base font-medium text-ink">いまの構成</h2>
                    <ul className="mt-3 space-y-1">
                        {episodes.map((episode) => (
                            <li key={episode.id} className="flex justify-between text-sm">
                                <span className="truncate text-ink">
                                    {formatEpisodeLabel(episode)}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                    {formatNumber(episode.char_count)}文字
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** 書き出しのボタン */
function ExportButton({
    label,
    onClick,
    disabled,
}: {
    label: string;
    onClick: () => void;
    disabled: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-md border border-line px-4 py-2 text-xs text-ink hover:border-forest-line hover:text-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
            {label}
        </button>
    );
}
