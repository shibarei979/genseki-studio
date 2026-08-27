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
    MAX_IMPORT_EPISODES,
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

    /*
     * 確定した話の番号。
     *
     * 自動で見つけた切れ目は、まだ「提案」でしかない。
     * 合っているものだけを確定へ移し、確定したものだけ取り込む。
     * 間違った提案は ✕ で消す（前の話とつながる）。
     */
    const [confirmed, setConfirmed] = useState<number[]>([]);

    /*
     * 確定をやり直す条件。
     *
     * 切り方の設定を変えたときだけ。
     * 原稿に印を足しただけで消すと、
     * 「ここで切る」を押すたびに確定が全部消えてしまう。
     *
     * 原稿を貼り替えたとき（中身がまるごと変わったとき）は、
     * 下の handleSelectFile と貼り付けの側で消している。
     */
    useEffect(() => {
        setConfirmed([]);
    }, [detectHeadings, chapterAs]);

    const confirmedChunks = confirmed
        .map((index) => chunks[index])
        .filter(Boolean);

    const pendingIndexes = chunks
        .map((_, index) => index)
        .filter((index) => !confirmed.includes(index));
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

    /*
     * 文字で切る場所を探す。
     *
     * 「第二章」「＊＊＊」など、自分で決めた区切りがある人は、
     * それを打てば場所を一覧にできる。
     * 提案だけでは、その人の書き方に合わないことがある。
     */
    const [findWord, setFindWord] = useState("");

    const foundPoints = useMemo(() => {
        const needle = findWord.trim();
        if (needle.length === 0) return [];

        const text = raw.replace(/\r\n/g, "\n");
        const points: { at: number; preview: string }[] = [];

        let from = 0;
        while (points.length < 200) {
            const at = text.indexOf(needle, from);
            if (at < 0) break;

            /* 前後を少し見せる。どの箇所かを見分けるため */
            const head = text.slice(Math.max(0, at - 10), at).replace(/\n/g, " ");
            const tail = text.slice(at, at + 40).replace(/\n/g, " ");

            points.push({ at, preview: `${head}${tail}` });
            from = at + needle.length;
        }

        return points;
    }, [raw, findWord]);

    /**
     * 指した場所に切り印を入れる。
     *
     * 入れたあと、その位置へカーソルを移す。
     * どこに入ったか見えないと、続けて指せない。
     */
    /**
     * まとめて印を入れる。
     *
     * 後ろから入れるのが肝。
     * 前から入れると、入れたぶんだけ後ろの位置がずれて、
     * 2 か所目からは見当違いの所に入る。
     */
    function insertSplitAtAll(positions: number[]) {
        if (positions.length === 0) return;

        const sorted = [...positions].sort((a, b) => b - a);
        let next = raw;

        for (const at of sorted) {
            next = next.slice(0, at) + SPLIT_MARK + "\n" + next.slice(at);
        }

        setRaw(next);
        setEdited(null);
        setConfirmed([]);
    }

    function insertSplitAt(at: number) {
        const next = raw.slice(0, at) + SPLIT_MARK + "\n" + raw.slice(at);
        setRaw(next);
        setEdited(null);
        shiftConfirmed(countPiecesBefore(next, at));

        window.setTimeout(() => {
            const area = rawRef.current;
            if (!area) return;
            const to = at + SPLIT_MARK.length + 1;
            area.focus();
            area.setSelectionRange(to, to);
            /* その行が見えるところまで送る */
            scrollTo(area, to, next);
        }, 0);
    }

    /**
     * 原稿の中の、指した位置まで送る。
     *
     * 文字数の割合で送ると、行の長さがまちまちなので
     * 狙いから外れる。実際に何行目かを数えて、
     * 行の高さを掛けたほうが正しく着く。
     */
    function scrollTo(area: HTMLTextAreaElement, at: number, text = raw) {
        const before = text.slice(0, at);
        const line = before.split("\n").length - 1;

        const style = window.getComputedStyle(area);
        const lineHeight =
            parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.7;

        area.scrollTop = Math.max(
            0,
            line * lineHeight - area.clientHeight / 2,
        );
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

        scrollTo(area, at);
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
    /* 選んだ範囲。題名にするのに使う */
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    /** 手で入れた切れ目の数 */
    const marks = raw.split(SPLIT_MARK).length - 1;

    /**
     * いまの位置に切れ目を入れる。
     *
     * 行の途中で切ると読みにくいので、
     * その行の頭まで戻してから入れる。
     */
    /**
     * 選んだ所で切る。
     *
     * 文字を選んでいれば、それを題名にして切る。
     * 「第三章 邂逅」を選べば、そこが新しい話の頭になり、
     * 題名も入った状態になる。
     * 何も選んでいなければ、いまいる行で切るだけ。
     */
    function insertSplit() {
        const picked = raw.slice(selection.start, selection.end).trim();

        if (picked.length > 0 && picked.length <= 60 && !picked.includes("\n")) {
            /*
             * 選んだ文字を題名にする。
             *
             * 選んだ所の行頭に印を入れ、選んだ文字は
             * 見出しの形（第◯話 …）ではなく、そのまま次の行の頭に残す。
             * 分割する側が、かたまりの頭の行を題名として拾う。
             */
            const lineStart =
                raw.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;

            const before = raw.slice(0, lineStart);
            const rest = raw.slice(lineStart);

            const next = `${before}${SPLIT_MARK}\n${picked}\n${rest.replace(picked, "").replace(/^\s*\n/, "")}`;

            setRaw(next);
            setEdited(null);

            /* 入れた場所より後ろの確定を、1 つずらす */
            shiftConfirmed(countPiecesBefore(next, lineStart));

            window.setTimeout(() => {
                const area = rawRef.current;
                if (!area) return;
                const to = lineStart + SPLIT_MARK.length + 1 + picked.length + 1;
                area.focus();
                area.setSelectionRange(to, to);
                setCaret(to);
                setSelection({ start: to, end: to });
            }, 0);
            return;
        }

        /* 何も選んでいないときは、いまいる行で切る */
        const at = raw.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;

        const next =
            raw.slice(0, at) + SPLIT_MARK + "\n" + raw.slice(at);
        setRaw(next);
        setEdited(null);

        shiftConfirmed(countPiecesBefore(next, at));

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
        /* 印を全部外したら、話の数が変わるので確定もやり直し */
        setRaw(raw.split(SPLIT_MARK).join("").replace(/\n{3,}/g, "\n\n"));
        setConfirmed([]);
        setEdited(null);
    }

    /* どこへ入れるか */
    const [mode, setMode] = useState<"append" | "replace">("append");

    async function handleImport() {
        /* 取り込むのは確定した分だけ */
        if (confirmedChunks.length === 0 || isImporting) return;

        /*
         * 上限を超えたら止める。
         * 途中まで入れて止まると、どこまで入ったか分からなくなる。
         */
        if (confirmedChunks.length > MAX_IMPORT_EPISODES) {
            window.alert(
                `一度に取り込めるのは${MAX_IMPORT_EPISODES.toLocaleString()}話までです。\n` +
                    `いまは${confirmedChunks.length.toLocaleString()}話が確定しています。\n` +
                    `分けて取り込んでください。`,
            );
            return;
        }

        const message =
            mode === "replace"
                ? `いまの${episodes.length}話をすべて消して、${confirmedChunks.length}話に入れ替えます。元には戻せません。`
                : `${confirmedChunks.length}話を、いまの${episodes.length}話のうしろに足します。`;

        if (!window.confirm(message)) return;

        setIsImporting(true);
        await onImport(
            confirmedChunks.map((chunk) => ({
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

    async function handleSelectFile(files: FileList | File[] | undefined) {
        const list = files ? Array.from(files) : [];
        if (list.length === 0) return;

        setIsReadingFile(true);
        setFileNotice("");

        /*
         * 名前の順に並べる。
         *
         * 1 話ずつ別のファイルにしている人は、
         * 「01.txt」「02.txt」のように番号を付けていることが多い。
         * 選んだ順ではなく、名前の順に読む。
         */
        list.sort((a, b) =>
            a.name.localeCompare(b.name, "ja", { numeric: true }),
        );

        const texts: string[] = [];
        const failed: string[] = [];
        let hasPdf = false;

        for (const file of list) {
            try {
                const result = await readManuscriptFile(file);
                texts.push(result.text.trim());
                if (file.name.toLowerCase().endsWith(".pdf")) hasPdf = true;
            } catch {
                failed.push(file.name);
            }
        }

        if (texts.length > 0) {
            /*
             * ファイルごとに切り印を挟む。
             *
             * 1 ファイル = 1 話として分かれる。
             * 中でさらに分けたければ、印を足せばよい。
             */
            const joined = texts.join(`\n\n${SPLIT_MARK}\n\n`);

            setRaw((current) =>
                current ? `${current}\n\n${SPLIT_MARK}\n\n${joined}` : joined,
            );
            setConfirmed([]);
        }

        const parts: string[] = [];
        if (texts.length === 1) {
            parts.push(`${list[0].name} を読み込みました。`);
        } else if (texts.length > 1) {
            parts.push(
                `${texts.length}個のファイルを読み込み、${texts.length}話に分けました。`,
            );
        }
        if (hasPdf) {
            parts.push("PDF は改行や段落が原稿どおりに戻らないことがあります。");
        }
        if (failed.length > 0) {
            parts.push(`読み込めませんでした：${failed.join("、")}`);
        }

        setFileNotice(parts.join(" "));
        setIsReadingFile(false);

        // 同じファイルを選び直せるように値を空にする
        if (fileInputRef.current) fileInputRef.current.value = "";
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

    /**
     * 切れ目を足したときに、確定の番号をずらす。
     *
     * 印を入れると、その位置より後ろの話は番号が 1 つ増える。
     * ずらさないと、確定していた話とは別の話が確定扱いになる。
     */
    /** その位置より前に、切れ目がいくつあるか */
    function countPiecesBefore(text: string, at: number): number {
        return text.slice(0, at).split(SPLIT_MARK).length - 1;
    }

    function shiftConfirmed(insertedAt: number) {
        setConfirmed((list) =>
            list.map((index) => (index >= insertedAt ? index + 1 : index)),
        );
    }

    /** 提案を確定へ移す */
    function confirmChunk(index: number) {
        setConfirmed((list) =>
            list.includes(index) ? list : [...list, index].sort((a, b) => a - b),
        );
    }

    /** 確定から提案へ戻す */
    function unconfirmChunk(index: number) {
        setConfirmed((list) => list.filter((at) => at !== index));
    }

    /** 残っている提案を、まとめて確定へ */
    function confirmAll() {
        setConfirmed(chunks.map((_, index) => index));
    }

    /**
     * 間違った提案を消す。
     *
     * 切れ目が間違いだったということなので、
     * 前の話とつなげ直す（その分だけ本文が前へ移る）。
     * 先頭のときは、次の話とつなげる。
     */
    function rejectChunk(index: number) {
        /*
         * 原稿に入れた切り印も消す。
         *
         * 一覧の上でつなげても、原稿に印が残っていると
         * 本文に線が残り、読み直すとまた同じ場所で切れる。
         *
         * 消すのは index 番目の話の直前にある印。
         * 印で切った所でなければ（見出しで切れた場合）、
         * 印の数が足りないので何もしない。
         */
        if (index > 0) {
            const pieces = raw.split(SPLIT_MARK);
            if (pieces.length > index) {
                /* index 番目の印だけを外して、前後をつなぐ */
                const next = pieces
                    .map((piece, at) =>
                        /* index 番目の話の「前」の印 = index-1 番目の切れ目 */
                        at === index - 1 ? piece : `${piece}${SPLIT_MARK}`,
                    )
                    .join("")
                    .replace(new RegExp(`${SPLIT_MARK}$`), "")
                    .replace(/\n{3,}/g, "\n\n");

                setRaw(next);
            }
        }

        if (index === 0) {
            /* 先頭は前が無いので、次とつなげる */
            setEdited((rows) => {
                const list = [...(rows ?? chunks)];
                if (list.length < 2) return list;

                const current = list[0];
                const next = list[1];
                list[1] = {
                    ...next,
                    body: `${current.body}\n\n${next.body}`,
                    charCount: current.charCount + next.charCount,
                };
                list.splice(0, 1);
                return list;
            });
        } else {
            mergeUp(index);
        }

        /*
         * 消したぶん、後ろの話は番号が 1 つ減る。
         *
         * 確定をやり直すのではなく、番号だけずらす。
         * やり直すと、確定してあったものが提案へ戻ってしまう。
         *
         * 消した話そのものが確定していたときは、
         * つながった先（1 つ前）が確定として残る。
         */
        setConfirmed((list) =>
            Array.from(
                new Set(
                    list.map((at) => {
                        if (at === index) return Math.max(0, index - 1);
                        return at > index ? at - 1 : at;
                    }),
                ),
            ).sort((a, b) => a - b),
        );
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
                            /*
                             * 何個でも選べる。
                             *
                             * 1 話ずつ別のファイルにしている人が、
                             * まとめて選んで一度に取り込める。
                             */
                            multiple
                            onChange={(e) => void handleSelectFile(e.target.files ?? undefined)}
                            className="hidden"
                            id="manuscript-file"
                        />

                        <textarea
                            value={raw}
                            ref={rawRef}
                            onChange={(e) => {
                                setRaw(e.target.value);
                                /* 手で書き換えたら、切れ目が動くので確定もやり直し */
                                setConfirmed([]);
                                // 貼り直したら、手を入れたぶんは捨てる
                                setEdited(null);
                            }}
                            onSelect={(e) => {
                                const area = e.target as HTMLTextAreaElement;
                                setCaret(area.selectionStart);
                                setSelection({
                                    start: area.selectionStart,
                                    end: area.selectionEnd,
                                });
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
                                {selection.end > selection.start
                                    ? "選んだ所で切る（題名にする）"
                                    : "ここで切る"}
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
                        {/*
                         * 文字で探す。
                         *
                         * 打った文字がある場所を挙げ、
                         * 押すとそこに印が入る。
                         */}
                        <div className="mt-3 rounded-md border border-line px-3.5 py-3">
                            <label className="text-[11px] text-ink">
                                文字で切る場所を探す
                            </label>

                            <input
                                type="text"
                                value={findWord}
                                onChange={(e) => setFindWord(e.target.value)}
                                placeholder="第　＊＊＊　◇　など"
                                className="mt-1.5 w-full rounded border border-line px-2.5 py-1.5 text-[12px] outline-none focus:border-forest"
                            />

                            {findWord.trim().length > 0 && (
                                foundPoints.length === 0 ? (
                                    <p className="mt-2 text-[11px] text-faint">
                                        見つかりませんでした。
                                    </p>
                                ) : (
                                    <>
                                        <p className="mt-2 text-[10px] text-faint">
                                            {foundPoints.length}か所。押すと、その手前に印が入ります
                                        </p>
                                        <ul className="thin-scroll mt-1.5 max-h-32 space-y-1 overflow-y-auto">
                                            {foundPoints.map((point, index) => (
                                                <li key={index}>
                                                    <button
                                                        type="button"
                                                        onClick={() => insertSplitAt(point.at)}
                                                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-canvas"
                                                    >
                                                        <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[9px] text-muted">
                                                            {index + 1}
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                                                            {point.preview}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            type="button"
                                            onClick={() => insertSplitAtAll(foundPoints.map((x) => x.at))}
                                            className="mt-2 w-full rounded border border-forest-line py-1.5 text-[11px] text-forest hover:bg-forest-tint"
                                        >
                                            {foundPoints.length}か所すべてに印を入れる
                                        </button>
                                    </>
                                )
                            )}
                        </div>

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
                                disabled={confirmedChunks.length === 0 || isImporting}
                                className="rounded-md bg-forest px-5 py-2 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {/* 取り込むのは確定した分だけ */}
                                {chunks.length === 0
                                    ? "話に分割する"
                                    : confirmedChunks.length === 0
                                      ? "確定した話がありません"
                                      : `${confirmedChunks.length}話として取り込む`}
                            </button>

                            <label
                                htmlFor="manuscript-file"
                                className="cursor-pointer rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-forest-line hover:text-forest"
                            >
                                ファイルから読み込む
                                <span className="ml-2 text-xs text-faint">
                                    {isReadingFile ? "読み込み中" : "何個でも選べます"}
                                </span>
                            </label>
                        </div>

                        {fileNotice && (
                            <p className="mt-3 rounded-md bg-forest-tint px-3 py-2 text-xs text-forest">
                                {fileNotice}
                            </p>
                        )}

                        <p className="mt-2 text-[11px] leading-relaxed text-faint">
                            TXT / MD / PDF に対応しています。
                            <br />
                            1話ずつ別のファイルにしている場合は、まとめて選ぶと
                            ファイルごとに1話として分かれます（名前の順に並びます）。
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-medium text-ink">
                                切れ目の提案
                                <span className="ml-1.5 text-[11px] font-normal text-faint">
                                    合っていれば確定へ
                                </span>
                            </h3>
                            {chunks.length > 0 && (
                                <span className="text-[11px] text-faint">
                                    {query.trim()
                                        ? `${matchedIndexes.length}話が一致`
                                        : `残り${pendingIndexes.length}／${chunks.length}話`}
                                </span>
                            )}
                        </div>

                        {/*
                         * まとめて確定。
                         *
                         * うまく切れているときは、1 つずつ押させない。
                         * 間違っているものだけ ✕ で消してもらう。
                         */}
                        {pendingIndexes.length > 0 && (
                            <button
                                type="button"
                                onClick={confirmAll}
                                className="mt-2 w-full rounded-md border border-forest-line bg-forest-tint/40 py-2 text-xs text-forest hover:bg-forest-tint"
                            >
                                残り{pendingIndexes.length}話をまとめて確定
                            </button>
                        )}

                        {/*
                         * 貼った原稿の中を探す。
                         *
                         * 何十話も貼ったあと、直したい話を
                         * 目で追って探すのは骨が折れる。
                         * 題名と本文の両方から探し、
                         * 当たった話だけを残して見せる。
                         */}
                        {/*
                         * 切れすぎているときは知らせる。
                         *
                         * 何百話にも刻まれた一覧を見せられても、
                         * 直しようがない。先に気づいてもらう。
                         */}
                        {chunks.length > 500 && (
                            <p className="mt-2 rounded-md border border-amber bg-amber-tint/40 px-3 py-2 text-[11px] leading-relaxed text-ink">
                                {chunks.length}話に分かれています。
                                多すぎるときは、上の「章見出し・シーン区切りを検出する」を
                                切って、「ここで切る」で自分の切りたい場所を指すほうが早いです。
                            </p>
                        )}

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
                                        /* 確定したものは、下の確定の側に出す */
                                        if (confirmed.includes(index)) return null;
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


                                            {/*
                                             * ✕ は「この切れ目が間違い」の意味。
                                             * 前の話とつなげ直す（本文は消えない）。
                                             */}
                                            <button
                                                type="button"
                                                onClick={() => rejectChunk(index)}
                                                title="この切れ目は間違い（前の話とつなげる）"
                                                className="shrink-0 px-1 text-xs text-faint hover:text-[var(--color-danger)]"
                                            >
                                                ✕
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => confirmChunk(index)}
                                                title="この切れ目で確定する"
                                                className="shrink-0 rounded border border-forest-line px-2 py-0.5 text-[10px] text-forest hover:bg-forest-tint"
                                            >
                                                確定 →
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

                                {pendingIndexes.length === 0 && chunks.length > 0 && (
                                    <p className="px-3 py-4 text-center text-xs text-faint">
                                        提案はすべて確定しました
                                    </p>
                                )}

                                {/*
                                 * 確定した話。
                                 *
                                 * ここに入っている分だけ取り込む。
                                 * 間違えたら「戻す」で提案へ返せる。
                                 */}
                                <div className="mt-4 rounded-lg border border-forest-line">
                                    <div className="flex items-center justify-between border-b border-line bg-forest-tint/30 px-3 py-2">
                                        <span className="text-[12px] font-medium text-ink">
                                            確定した話
                                        </span>
                                        <span className="text-[11px] text-muted">
                                            {confirmedChunks.length}話　
                                            {formatNumber(
                                                confirmedChunks.reduce(
                                                    (sum, row) => sum + row.charCount,
                                                    0,
                                                ),
                                            )}
                                            文字
                                        </span>
                                    </div>

                                    {confirmedChunks.length === 0 ? (
                                        <p className="px-3 py-6 text-center text-xs text-faint">
                                            まだありません。
                                            上の提案から「確定 →」で移してください。
                                        </p>
                                    ) : (
                                        <ul className="thin-scroll max-h-64 divide-y divide-line overflow-y-auto">
                                            {confirmed.map((index, order) => {
                                                const chunk = chunks[index];
                                                if (!chunk) return null;
                                                return (
                                                    <li
                                                        key={index}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm"
                                                    >
                                                        <span className="w-5 shrink-0 text-right text-xs text-faint">
                                                            {order + 1}
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                                            {chunk.title || "（タイトルなし）"}
                                                        </span>
                                                        <span className="shrink-0 text-[11px] text-faint">
                                                            {formatNumber(chunk.charCount)}字
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => unconfirmChunk(index)}
                                                            title="提案へ戻す"
                                                            className="shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                        >
                                                            ← 戻す
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>

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
