/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeEditor — 本文の執筆欄
 * ============================================================
 */

"use client";

import HelpTip from "@/components/common/help-tip";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAskText } from "@/hooks/use-ask-text";
import ManuscriptSurface from "@/components/workspace/manuscript-surface";
import NotePicker from "@/components/workspace/note-picker";
import { VERSION_AUTO_INTERVAL_MS } from "@/config";
import { useAutosave } from "@/hooks/use-autosave";
import { insertEmphasis, insertRuby } from "@/lib/manuscript/notation";
import { insertAnnotation } from "@/lib/utils/annotation";
import { scrollToLine } from "@/lib/manuscript/scroll-to-line";
import { realignIllusts } from "@/lib/illust/realign";
import { getRepository } from "@/lib/repository";
import { countChars, formatNumber, formatTime } from "@/lib/utils/text";
import {
    normalizeForHorizontal,
    normalizeForVertical,
} from "@/lib/utils/vertical-text";
import type { DisplaySettings, Episode } from "@/types";
import { WRITING_MODE_LABEL } from "@/types";
import IllustPlaceSurface from "@/components/workspace/illust-place-surface";
import PickSurface from "@/components/workspace/pick-surface";
import { useRouter } from "next/navigation";
import ProBadge from "@/components/common/pro-badge";
import {
    MobileBottomBar,
    MobileEditorHeader,
    MobileKeyBar,
    MobileMarkPanel,
    MobileToolsSheet,
    guessBaseLength,
    stepBack,
    stepFwd,
    useBarSlots,
    useNoFocusZoom,
    useIsMobile,
    useKeyboard,
    type BarSlot,
    type MarkKind,
} from "@/components/workspace/mobile-write-kit";

interface Props {
    episode: Episode;
    /**
     * 蛍光ペン。
     * 資料から来たとき、その資料の id が入る。
     */
    pickEntryId?: string | null;
    /**
     * 置き場所を選んでいる挿絵の id。
     *
     * ★ 入っているあいだ、本文は打てない。
     *   蛍光ペンと同じ扱い。
     */
    illustPlacingId?: string | null;
    /** その絵。何を置くのか見せるために渡す */
    illustPlacingUrl?: string | null;
    /** 足す先の資料の名前。何に足しているかを見せる */
    pickEntryName?: string;
    settings: DisplaySettings;
    /** 資料から飛んできたときの行番号。1 から数える */
    jumpToLine?: number | null;
    onJumped?: () => void;
    onSave: (patch: { title: string; body: string }) => Promise<void>;
    /**
     * 作品の題名。書く画面の上に、小さく出す。
     *
     * ★ どの作品を書いているのか、画面の中に無かった。
     *   話を何十も持っていると、開いたときに
     *   どれの続きなのか分からない。
     *
     * ★ ここでは直せない。題名は作品の設定の役目。
     */
    workTitle?: string;
    onToggleWritingMode: () => void;
    onOpenHistory: () => void;
    isHistoryOpen: boolean;
    onOpenMentions: () => void;
    isMentionsOpen: boolean;
    onSelectionChange: (selected: string) => void;
    onOpenProofread: () => void;
    isProofreadOpen: boolean;
    onOpenRead: () => void;
    isReadOpen: boolean;
    /** 推敲パネルからの一括修正を受け取るための橋渡し */
    onRegisterBody: (body: string, apply: (next: string) => void) => void;
    /** 集中モード。一覧やまわりを隠して本文だけにする */
    isFocusMode?: boolean;
    onToggleFocus?: () => void;
    /** 作品の話。注釈を付けるとき、前に同じ言葉へ付けた説明を探すのに使う */
    allEpisodes?: Episode[];
    /** 携帯：話の一覧を開く（下から出る） */
    onOpenList?: () => void;
    /** 携帯：右上の「投稿」に出す、まだ出していない話の数 */
    unpostedCount?: number;
}

export default function EpisodeEditor({
    episode,
    workTitle = "",
    pickEntryId = null,
    illustPlacingId = null,
    illustPlacingUrl = null,
    pickEntryName = "この資料",
    settings,
    onSave,
    jumpToLine,
    onJumped,
    onToggleWritingMode,
    onOpenHistory,
    isHistoryOpen,
    onOpenMentions,
    isMentionsOpen,
    onSelectionChange,
    onOpenProofread,
    isProofreadOpen,
    onOpenRead,
    isReadOpen,
    onRegisterBody,
    isFocusMode = false,
    onToggleFocus,
    allEpisodes = [],
    onOpenList,
    unpostedCount = 0,
}: Props) {
    /* ルビ・置き換えの問い。ブラウザの prompt は出ない機械がある */
    const { ask, dialog: askDialog } = useAskText();

    const [title, setTitle] = useState(episode.title);
    const [body, setBody] = useState(episode.body);
    /** 縦書き整形の直前の本文。取り消し用に 1 手ぶんだけ持つ */
    const [beforeNormalize, setBeforeNormalize] = useState<string | null>(null);

    /*
     * ほかの道具を開いているか。
     *
     * 狭い画面でだけ使う。
     * 全部並べると 2 段になり、書く場所がそのぶん減る。
     */
    const [isToolsOpen, setIsToolsOpen] = useState(false);

    /*
     * 縮尺。
     *
     * 狭い画面では、決まった大きさだと読みにくい。
     * 全体を見渡したいときは小さく、
     * 直したいときは大きくできるようにする。
     */
    const [zoom, setZoom] = useState(1);
    const [notice, setNotice] = useState("");
    /*
     * 行番号。資料の「第3話 12行目」から場所を探すときに使う。
     * 常に出すと本文の邪魔になるので、切り替えられるようにしておく。
     */
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    /** その行を少しのあいだ光らせる。どこへ来たのか分かるように */
    const [flashLine, setFlashLine] = useState<number | null>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    /** 本文の選択位置。ルビを振るときに使う */
    const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    /* 注釈を付ける小窓。開いたときの選び（カーソルの位置）を持つ */
    const [notePick, setNotePick] = useState<{ start: number; end: number } | null>(null);

    /*
     * ============================================================
     * 携帯だけ
     * ============================================================
     */
    const isMobile = useIsMobile();
    const keyboard = useKeyboard();
    useNoFocusZoom(isMobile);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [slots, setSlots] = useBarSlots();
    /*
     * 話の題を打っているか。
     * ★ そのあいだはキーボードの上の段を出さない。
     *   段の記号やルビは本文に入るので、題を打っているのに本文が変わってしまう。
     */
    const [isTitleFocused, setIsTitleFocused] = useState(false);

    /*
     * ルビ・傍点・注釈の小窓。
     *
     * caret はカーソルの位置（付ける文字のすぐ後ろ）、
     * len は付ける字数。本文を選ばずに決める。
     */
    const [mark, setMark] = useState<{
        kind: MarkKind;
        caret: number;
        len: number;
        reading: string;
        auto: boolean;
    } | null>(null);

    /*
     * 変換する前に打った読み。
     *
     * ★ 「しおもり」と打って「潮守」に変換した直後に「ルビ」を押すと、
     *   読みの欄に「しおもり」を先に入れておく。
     *   変換の途中の字は compositionupdate で届く。ひらがなだけのものを覚える。
     *   届かない端末では、空の欄に自分で打つ。
     */
    const lastKanaRef = useRef("");
    const composedRef = useRef<{ text: string; reading: string; end: number } | null>(null);

    /*
     * 戻す。
     *
     * ★ 本文は手元の値で持っているので、ブラウザの「元に戻す」が効かない。
     *   打つ手が 0.8 秒止まるたびに、ひとつ前の姿を積む。
     */
    const undoStackRef = useRef<string[]>([]);
    const lastSnapRef = useRef<string | null>(null);
    const [canUndo, setCanUndo] = useState(false);

    /*
     * ★ 携帯では、行番号をはじめは出さない。
     *   左に番号の列があると、1 行が 24 字に届かない。
     *   出したい人は「道具」の「行番号を出す」から。
     */
    useEffect(() => {
        if (isMobile) setShowLineNumbers(false);
    }, [isMobile]);

    /*
     * 蛍光ペン。
     *
     * 資料から「本文から足す」で来たとき、
     * 住所に ?pick=資料のid が付いている。
     *
     * ★ そのあいだは、打ち込む欄をやめて読む形にする。
     *   引用コメントと同じく、文ごとに押せる。
     *
     *   打ち込む欄（textarea）の中には、
     *   文を包む入れ物を置けない。
     *   選んだ範囲から行を割り出す形も試したが、
     *   何が押せるのか分かりにくかった。
     */
    const router = useRouter();

    /*
     * 足す先の名前は、資料の側から渡してもらう。
     * ここで引くと、作品の id が要る。
     */

    const episodeId = episode.id;

    async function addToEntry(text: string, line: number) {
        if (!pickEntryId) return;
        await getRepository().pickMentionLine(pickEntryId, episode.id, line, text);
    }

    /*
     * 別の話に切り替わったときだけ、編集中の値を差し替える。
     *
     * ★ 本文が変わったからといって、書き戻さない。
     *
     *   前は episode.body も見張っていた。
     *   自動保存が終わると、親が話を読み直して episode.body が
     *   新しくなる。するとここが動き、打っている最中の本文を
     *   保存された時点の本文で上書きしていた。
     *
     *   ・保存の往復のあいだに打った字が消える
     *   ・打ち込み欄の中身が入れ替わるので、カーソルが飛ぶ
     *
     *   「改行を調整していると1文字消える」という声は、この形。
     *   改行は1文字なので、往復の隙に入りやすい。
     *
     *   差し替えるのは、開いている話が変わったときだけでよい。
     */
    const loadedIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (loadedIdRef.current === episode.id) return;

        loadedIdRef.current = episode.id;
        setTitle(episode.title);
        setBody(episode.body);
        setBeforeNormalize(null);
    }, [episode.id, episode.title, episode.body]);

    useEffect(() => {
        if (lastSnapRef.current === null) {
            lastSnapRef.current = body;
            return;
        }
        const timer = window.setTimeout(() => {
            if (lastSnapRef.current !== null && lastSnapRef.current !== body) {
                undoStackRef.current.push(lastSnapRef.current);
                if (undoStackRef.current.length > 50) undoStackRef.current.shift();
                lastSnapRef.current = body;
                setCanUndo(true);
            }
        }, 800);
        return () => window.clearTimeout(timer);
    }, [body]);

    /* 話が変わったら、戻す手は捨てる */
    useEffect(() => {
        undoStackRef.current = [];
        lastSnapRef.current = null;
        setCanUndo(false);
    }, [episode.id]);

    function handleUndo() {
        /*
         * ★ まだ積んでいない打ちかけ（0.8 秒たっていない）があれば、
         *   まずその手前（いま積んである最後の姿）へ戻す。
         *   いきなり積んだ山から取ると、ひとつ飛ばして戻ってしまう。
         */
        const snap = lastSnapRef.current;
        if (snap !== null && snap !== body) {
            setBody(snap);
            return;
        }
        const prev = undoStackRef.current.pop();
        if (prev === undefined) return;
        lastSnapRef.current = prev;
        setBody(prev);
        setCanUndo(undoStackRef.current.length > 0);
    }

    useEffect(() => {
        if (!isMobile) return;
        const area = surfaceRef.current?.querySelector("textarea");
        if (!area) return;

        const onUpdate = (e: CompositionEvent) => {
            if (e.data && /^[\u3041-\u309F\u30FC]+$/.test(e.data)) lastKanaRef.current = e.data;
        };
        const onEnd = (e: CompositionEvent) => {
            const text = e.data ?? "";
            const reading = lastKanaRef.current;
            lastKanaRef.current = "";
            window.setTimeout(() => {
                composedRef.current =
                    text && reading && text !== reading
                        ? { text, reading, end: area.selectionEnd }
                        : null;
            }, 0);
        };
        area.addEventListener("compositionupdate", onUpdate);
        area.addEventListener("compositionend", onEnd);
        return () => {
            area.removeEventListener("compositionupdate", onUpdate);
            area.removeEventListener("compositionend", onEnd);
        };
    });

    const { state, savedAt } = useAutosave({
        // 2 つの値をまとめて 1 つの文字列として監視する
        value: JSON.stringify({ title, body }),
        onSave: async (serialized) => {
            const parsed = JSON.parse(serialized) as { title: string; body: string };
            await onSave(parsed);
            await maybeCreateVersion();

            /*
             * 挿絵の場所を、本文の直しに追いかけさせる。
             *
             * ★ 場所は「何文目の後ろか」で持っている。
             *   前のほうに文を足すと、後ろの番号がずれる。
             *   置いたときの文を探し直して、番号を付け直す。
             *
             * 失敗しても本文の保存には触らない。
             */
            void realignIllusts(episode.id, parsed.body).catch(() => {});
        },
    });

    /**
     * 自動保存のたびに履歴を作ると版が増えすぎるので、
     * 前回から一定時間あいたときだけ残す。
     */
    const lastVersionAtRef = useRef<number>(0);
    async function maybeCreateVersion() {
        const elapsed = Date.now() - lastVersionAtRef.current;
        if (elapsed < VERSION_AUTO_INTERVAL_MS) return;
        lastVersionAtRef.current = Date.now();
        await getRepository().createVersion(episode.id, "auto");
    }

    function handleNormalize() {
        /*
         * いまの書き方に合わせて直す。
         *
         * 縦書きで打った文を横書きにしても、全角のままだと読みにくい。
         * 逆も同じ。書き方を切り替えたら、揃え直せるようにする。
         */
        const result =
            settings.writing_mode === "vertical"
                ? normalizeForVertical(body)
                : normalizeForHorizontal(body);
        if (result.changeCount === 0) {
            setNotice("直すところはありませんでした");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        setBeforeNormalize(body);
        setBody(result.text);
        setNotice(`${result.changeCount}行を整えました`);
        window.setTimeout(() => setNotice(""), 6000);
    }

    function handleUndoNormalize() {
        if (beforeNormalize === null) return;
        setBody(beforeNormalize);
        setBeforeNormalize(null);
        setNotice("元に戻しました");
        window.setTimeout(() => setNotice(""), 2500);
    }

    // 推敲パネルへ、いまの本文と差し替え口を渡す
    useEffect(() => {
        onRegisterBody(body, setBody);
    }, [body, onRegisterBody]);

    /**
     * 注釈を付ける。
     *
     * ★ 選んだ言葉のあとに ［＃注：説明］ を入れる（先頭に ｜ を付けて範囲をはっきりさせる）。
     *   記法は lib/utils/annotation.ts。読む画面では点線と ※番号になり、押すと説明が出る。
     */
    function handleNote() {
        /*
         * ★ 言葉を選んでいなくても、小窓を開く。
         *   携帯では本文の中で言葉を指で選ぶのが難しく、前はここで止まっていた。
         *   小窓の中で、字の札を押して選べる（note-picker.tsx）。
         */
        setIsToolsOpen(false);
        setNotePick(range);
    }

    async function handleRuby() {
        if (range.start === range.end) {
            setNotice("ルビを振る文字を選んでください");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        const base = body.slice(range.start, range.end);
        const ruby = await ask(`「${base}」の読みを入れてください`, "");
        if (!ruby?.trim()) return;
        setBody(insertRuby(body, range.start, range.end, ruby.trim()));
    }

    /**
     * カーソルの所に文字を差し込む。
     *
     * 区切り線・一文字下げ・改行で使い回す。
     * 差し込んだあと、その後ろにカーソルを置く。
     * 置かないと、また先頭から探すことになる。
     */
    function insertAt(text: string, addsNewline = true) {
        const area = surfaceRef.current?.querySelector("textarea");
        const at = area?.selectionStart ?? body.length;

        const inserted = addsNewline ? `${text}\n` : text;
        const next = body.slice(0, at) + inserted + body.slice(at);

        setBody(next);

        window.setTimeout(() => {
            if (!area) return;

            const to = at + inserted.length;
            area.focus();
            area.setSelectionRange(to, to);
        }, 0);
    }

    /**
     * 段落の頭を下げる。
     *
     * カーソルの所ではなく、本文の全部に効かせる。
     * 1 行ずつ手で下げるのは、長い話ほど大変になる。
     *
     * 会話文は下げない。
     * 「」『』【】 で始まる行は、そのままのほうが読みやすい。
     * すでに下がっている行も、二重にしない。
     */
    function handleIndent() {
        const OPENERS = ["「", "『", "【"];

        const next = body
            .split("\n")
            .map((line) => {
                const trimmed = line.trimStart();

                if (trimmed === "") return line;
                if (line.startsWith("　")) return line;
                if (OPENERS.some((mark) => trimmed.startsWith(mark))) return line;

                return `　${line}`;
            })
            .join("\n");

        if (next === body) {
            setNotice("下げるところはありませんでした");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }

        setBeforeNormalize(body);
        setBody(next);

        setNotice("段落の頭を下げました");
        window.setTimeout(() => setNotice(""), 6000);
    }

    /**
     * 置き換える。
     *
     * 何を何に替えるかを 2 度尋ねる。
     * 一度にまとめて替えるので、数を伝える。
     */
    async function handleReplace() {
        const from = await ask("置き換える文字を入れてください", "");
        if (!from) return;

        const to = await ask(`「${from}」を何に替えますか`, "");
        if (to === null) return;

        const count = body.split(from).length - 1;
        if (count === 0) {
            setNotice(`「${from}」は見つかりませんでした`);
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }

        setBeforeNormalize(body);
        setBody(body.split(from).join(to));

        setNotice(`${count}か所を置き換えました`);
        window.setTimeout(() => setNotice(""), 6000);
    }

    function handleEmphasis() {
        if (range.start === range.end) {
            setNotice("傍点をつける文字を選んでください");
            window.setTimeout(() => setNotice(""), 2500);
            return;
        }
        setBody(insertEmphasis(body, range.start, range.end));
    }

    const otherMode = settings.writing_mode === "vertical" ? "horizontal" : "vertical";

    /*
     * ============================================================
     * 携帯の道具
     * ============================================================
     */
    function getArea(): HTMLTextAreaElement | null {
        return surfaceRef.current?.querySelector("textarea") ?? null;
    }

    /** 本文を差し替えて、カーソルを pos に置く */
    function replaceBodyAndPlace(next: string, pos: number) {
        setBody(next);
        window.setTimeout(() => {
            const area = getArea();
            if (!area) return;
            area.focus();
            area.setSelectionRange(pos, pos);
        }, 0);
    }

    /** カーソルの所に記号を入れる。「」のように閉じがあれば、そのあいだに置く */
    function insertPair(open: string, close = "") {
        const area = getArea();
        const start = area?.selectionStart ?? body.length;
        const end = area?.selectionEnd ?? start;
        const inside = body.slice(start, end);
        const next = body.slice(0, start) + open + inside + close + body.slice(end);
        replaceBodyAndPlace(next, start + open.length + inside.length);
    }

    /**
     * ルビ・傍点・注釈の小窓を開く。
     *
     * ★ 文字を選んでいれば、その文字に付ける（パソコンと同じ）。
     *   選んでいなければ、カーソルの直前の漢字のかたまりに付ける。
     */
    function openMark(kind: MarkKind) {
        const area = getArea();
        const start = area?.selectionStart ?? range.start;
        const end = area?.selectionEnd ?? range.end;

        const caret = end;
        const len = end > start ? end - start : guessBaseLength(body, caret);
        const base = body.slice(caret - len, caret);

        /* 変換した直後なら、読みを先に入れておく */
        const composed = composedRef.current;
        const reading =
            kind === "ruby" && composed && composed.end === caret && composed.text.endsWith(base)
                ? base === composed.text
                    ? composed.reading
                    : ""
                : "";

        setMark({ kind, caret, len, reading, auto: reading !== "" });
    }

    function applyMark() {
        if (!mark || mark.len <= 0) return;
        const start = mark.caret - mark.len;
        const end = mark.caret;

        if (mark.kind === "note") {
            setMark(null);
            setNotePick({ start, end });
            return;
        }

        if (mark.kind === "ruby" && !mark.reading.trim()) return;

        /*
         * ★ すぐ前も漢字・カタカナなら、必ず ｜ を付ける。
         *   付けないと、読む画面では前の字までまとめてルビがかかる
         *   （「潮守」の「守」だけ、「東京タワー」の「タワー」だけ、のとき）。
         */
        const joinsBefore = start > 0 && /[一-龥々〆ヶァ-ヴー]/.test(body[start - 1]);
        const next =
            mark.kind === "ruby"
                ? joinsBefore
                    ? `${body.slice(0, start)}｜${body.slice(start, end)}《${mark.reading.trim()}》${body.slice(end)}`
                    : insertRuby(body, start, end, mark.reading.trim())
                : insertEmphasis(body, start, end);

        setMark(null);
        replaceBodyAndPlace(next, end + (next.length - body.length));
        setNotice(mark.kind === "ruby" ? `「${body.slice(start, end)}」にルビを付けました` : `「${body.slice(start, end)}」に傍点を付けました`);
        window.setTimeout(() => setNotice(""), 3000);
    }

    /** 続きを書く。最後の行へ行って、キーボードを出す */
    function writeOn() {
        const area = getArea();
        if (!area) return;
        const endAt = area.value.length;
        area.focus();
        area.setSelectionRange(endAt, endAt);
        area.scrollTop = area.scrollHeight;
    }

    function runSlot(slot: BarSlot) {
        if (slot === "read") onOpenRead();
        else if (slot === "resource") router.push(`/workspace/${episode.work_id}/resource`);
        else if (slot === "mentions") onOpenMentions();
        else if (slot === "proofread") onOpenProofread();
        else if (slot === "history") onOpenHistory();
        else if (slot === "replace") void handleReplace();
        else if (slot === "focus") onToggleFocus?.();
    }

    /** ★ を押した道具を、下の段に置く。2 か所なので、古いほうと入れかえる */
    function pinSlot(slot: BarSlot) {
        if (slots.includes(slot)) return;
        setSlots([slots[1], slot]);
    }

    const saveTone: "ok" | "draft" | "busy" =
        state === "saving" || state === "pending" ? "busy" : episode.is_published === false ? "draft" : "ok";
    const saveLabel =
        state === "saving"
            ? "保存中"
            : state === "pending"
              ? "未保存の変更"
              : episode.is_published === false
                ? `下書きに保存・${formatNumber(countChars(body))}字`
                : `保存済み・${formatNumber(countChars(body))}字`;

    const showKeyBar = isMobile && keyboard.isOpen && !mark && !notePick && !isTitleFocused;
    const showBottomBar = isMobile && !keyboard.isOpen && !mark && !isFocusMode;

    /*
     * 資料から飛んできたら、その行へ動かして選ぶ。
     * 開いただけで場所が分からないのでは、辿れるうちに入らない。
     *
     * ★ 同じ合図では、一度しか動かさない。
     *
     *   前は見張りに onJumped を入れていた。
     *   あれは親が組み直るたびに別物になるので、
     *   組み直るたびに、この中身が走っていた。
     *
     *   「末尾へ寄せる」の合図が残ったまま打つと、
     *   一文字ごとにカーソルが末尾へ飛ぶ。
     *   携帯で「打ちたい所と違う所に入る」のは、これ。
     *
     *   受け取った合図を覚えておき、同じ値では走らせない。
     */
    const jumpedRef = useRef<number | null>(null);

    /* 知らせる先は、見張りに入れずに持つ */
    const onJumpedRef = useRef(onJumped);
    onJumpedRef.current = onJumped;

    useEffect(() => {
        if (!jumpToLine) {
            /* 合図が下りたら、次を受けられるようにする */
            jumpedRef.current = null;
            return;
        }

        if (jumpedRef.current === jumpToLine) return;
        jumpedRef.current = jumpToLine;

        /*
         * 描き終わってから測る。
         * 開いた直後は幅も高さもまだ決まっておらず、
         * その時点で測ると折り返しの位置がずれる。
         */
        const timer = window.setTimeout(() => {
            const area = surfaceRef.current?.querySelector("textarea");
            if (!area) return;

            const result = scrollToLine(area, jumpToLine);

            /*
             * 末尾へ寄せたいだけのとき（開いた直後の「続きから」）は、
             * 光らせず、選ばず、書き足せる形にする。
             *
             * 資料から飛んできたときは「この行だよ」と
             * 示したいので今までどおり光らせる。
             * 行数を超えた指定は、末尾へ寄せる合図として扱う。
             */
            const isTail = jumpToLine >= 999999;

            if (isTail) {
                const end = area.value.length;
                area.setSelectionRange(end, end);
            } else {
                setFlashLine(jumpToLine);
                window.setTimeout(() => setFlashLine(null), 2600);
            }

            void result;
            onJumpedRef.current?.();
        }, 60);

        return () => window.clearTimeout(timer);
    }, [jumpToLine]);

    return (
        <div
            className={[
                /* min-h-0 が無いと、親の高さを超えて膨らむ */
                "flex h-full min-h-0 flex-col overflow-hidden bg-surface",
                // 集中モードは画面の端まで使う。枠と角丸は普段だけ
                isFocusMode ? "" : "rounded-lg border border-line",
                /* 携帯：下の段のぶん、下を空ける */
                showBottomBar ? "mw-pad" : "",
                showKeyBar ? "mw-pad-key" : "",
            ].join(" ")}
        >
            {/*
              * 携帯の上の段。
              *
              * ★ パソコンの 2 段（題・保存・通し読み… と 道具の並び）は、
              *   携帯では隠す（mw-desk）。道具は下の段と「道具」の中へ移した。
              */}
            {isMobile && !isFocusMode && (
                <MobileEditorHeader
                    title={title}
                    saveLabel={saveLabel}
                    saveTone={saveTone}
                    backHref="/"
                    postHref={`/workspace/${episode.work_id}/post?ep=${episode.id}`}
                    unposted={unpostedCount}
                    onOpenList={() => onOpenList?.()}
                />
            )}

            {/*
             * 上の帯。
             *
             * 狭い画面では 2 段にする。
             * 1 段に詰めると、右のボタンが画面の外へ出る。
             */}
            <div className="mw-desk flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2 sm:flex-nowrap sm:gap-2.5 sm:px-5 sm:py-2.5">
                {/*
                  * 題名のまわり。
                  *
                  * ★ 2 行に分け、それぞれに札を付ける。
                  *
                  *   前は「話のタイトル・白書の魔女」と 1 行に並べていた。
                  *   狭い画面で折り返すと、
                  *
                  *     話のタイトル
                  *     ・
                  *     白書の魔女
                  *     エンドロール
                  *
                  *   と縦に落ち、作品の題名が話の題名に見えていた。
                  *
                  * ★ 札は左に揃える。値は右。
                  *   どちらが何の名前かが、線を引かなくても分かる。
                  *
                  * ★ 札は折り返させない。
                  *   折り返すと、また同じ読み違いが起きる。
                  */}
                <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2">
                    {workTitle.trim() && (
                        <>
                            <span className="whitespace-nowrap text-[10px] leading-none text-faint">
                                作品タイトル
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5">
                                <span className="min-w-0 truncate text-[11px] leading-none text-muted">
                                    {workTitle}
                                </span>

                                {/*
                                  * 作品の題名を直しに行く道。
                                  *
                                  * ★ ここでは直せないようにしてある。
                                  *   本文を書いている最中に作品そのものが
                                  *   書き換わると、気づかないまま変わる。
                                  *
                                  * ★ 代わりに、直す場所へ送る押し具を置く。
                                  *   直せないことだけ伝えて放り出すと、
                                  *   どこで直すのかを探すことになる。
                                  *
                                  * ★ 同じ窓で開く。
                                  *   別窓にすると、直したあと
                                  *   こちらの画面は古い題名のまま残る。
                                  *   本文は自動で控えてあるので、戻れば続きから書ける。
                                  */}
                                <Link
                                    href={`/workspace/${episode.work_id}/settings`}
                                    className="shrink-0 whitespace-nowrap rounded border border-line px-1.5 py-[1px] text-[10px] leading-none text-muted hover:border-forest-line hover:text-forest"
                                >
                                    変更
                                </Link>
                            </span>
                        </>
                    )}

                    <span className="whitespace-nowrap text-[10px] leading-none text-faint">
                        話のタイトル
                    </span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        aria-label="話のタイトル"
                        placeholder="話の名前を入れてください"
                        className={[
                            "mt-0.5 w-full border-b bg-transparent text-[14px] font-medium text-ink outline-none focus:border-forest-line",
                            /*
                             * 名前が空のときは、下線で気づかせる。
                             *
                             * 止めはしない。名前は書いているうちに決まることが多く、
                             * 入り口で止めると書き始める気を削ぐ。
                             * 投稿するときには必須にしてある。
                             */
                            title.trim() ? "border-transparent" : "border-amber",
                        ].join(" ")}
                    />
                </div>

                <div className="thin-scroll flex w-full shrink-0 items-center gap-2 overflow-x-auto text-[11px] text-muted lg:w-auto lg:gap-2.5">
                    <SaveIndicator
                        state={state}
                        savedAt={savedAt}
                        isDraft={episode.is_published === false}
                    />
                    <span>{formatNumber(countChars(body))}文字</span>
                    <button
                        type="button"
                        onClick={onOpenRead}
                        aria-pressed={isReadOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
                            isReadOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        通し読み
                    </button>
                    {/*
                     * 誤字脱字（Pro）。
                     *
                     * ★ 前は「推敲」をここに置く予定で、隠してあった。
                     *   同じ場所・同じ開き方で、誤字脱字・表記揺れのチェックを出す。
                     *   画面では「AI」と言わない（運営の決まり）。
                     *   会員でない人にも見せ、開くと Pro の案内が出る。
                     */}
                    <button
                        type="button"
                        onClick={onOpenProofread}
                        aria-pressed={isProofreadOpen}
                        className={[
                            "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5",
                            isProofreadOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        誤字脱字
                        <ProBadge />
                    </button>
                    <button
                        type="button"
                        onClick={onOpenMentions}
                        aria-pressed={isMentionsOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
                            isMentionsOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        資料リンク
                    </button>
                    <button
                        type="button"
                        onClick={onOpenHistory}
                        aria-pressed={isHistoryOpen}
                        className={[
                            "shrink-0 rounded border px-2 py-0.5",
                            isHistoryOpen
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        履歴
                    </button>
                </div>
            </div>

            {/*
             * 道具の並び。
             *
             * 狭い画面では「…」に畳む。
             * 全部並べると 2 段になり、書く場所がそのぶん減る。
             *
             * よく使う「縦横」と「行番号」だけは外に出す。
             */}
            <div className="mw-desk relative flex items-center gap-1.5 border-b border-line bg-canvas px-3 py-1.5 text-[11px] sm:px-5">
                {/*
                 * 大きさ。
                 *
                 * 道具の先頭に置く。
                 * 隅に浮かせると、あることに気づかれない。
                 */}
                <span className="flex shrink-0 items-center rounded border border-line bg-surface lg:hidden">
                    <button
                        type="button"
                        onClick={() => setZoom((now) => Math.max(0.7, now - 0.1))}
                        disabled={zoom <= 0.7}
                        aria-label="小さくする"
                        className="px-2 py-0.5 text-muted hover:text-forest disabled:opacity-35"
                    >
                        −
                    </button>

                    <button
                        type="button"
                        onClick={() => setZoom(1)}
                        title="元の大きさに戻す"
                        className="min-w-[34px] border-x border-line px-1 py-0.5 text-[10px] tabular-nums text-faint hover:text-ink"
                    >
                        {Math.round(zoom * 100)}%
                    </button>

                    <button
                        type="button"
                        onClick={() => setZoom((now) => Math.min(1.6, now + 0.1))}
                        disabled={zoom >= 1.6}
                        aria-label="大きくする"
                        className="px-2 py-0.5 text-muted hover:text-forest disabled:opacity-35"
                    >
                        ＋
                    </button>
                </span>

                <button
                    type="button"
                    onClick={onToggleWritingMode}
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    {WRITING_MODE_LABEL[otherMode]}にする
                </button>

                <button
                    type="button"
                    onClick={() => setShowLineNumbers((show) => !show)}
                    aria-pressed={showLineNumbers}
                    title="10行ごとに行番号を出します"
                    className={[
                        "shrink-0 rounded border px-2 py-0.5",
                        showLineNumbers
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                    ].join(" ")}
                >
                    行番号
                </button>

                {/*
                 * よく使う記号を、押すだけで入れる。
                 *
                 * ★ 「……」「――」は、打つと 2 回変換することになり手間。
                 *   ほかのサイトでボタン 1 つで入れられるのが便利、という声があった。
                 *   携帯はキーボードの上の帯に同じものがある。
                 *
                 * ★ 押しても本文から離れないようにする（onMouseDown で止める）。
                 *   離れると、どこに入れるか分からなくなる。
                 */}
                <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
                <span className="flex shrink-0 items-center gap-1">
                    {[
                        { label: "……", open: "……", close: "", title: "三点リーダー（……）を入れます" },
                        { label: "――", open: "――", close: "", title: "ダッシュ（――）を入れます" },
                    ].map((one) => (
                        <button
                            key={one.label}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertPair(one.open, one.close)}
                            title={one.title}
                            className="min-w-[34px] rounded border border-line bg-surface px-2 py-0.5 tracking-normal text-muted hover:border-forest-line hover:text-forest"
                        >
                            {one.label}
                        </button>
                    ))}
                </span>

                {/* ここから先は、狭い画面では「…」の中 */}
                <div
                    className={[
                        "flex items-center gap-2",
                        isToolsOpen
                            ? "absolute left-0 right-0 top-full z-20 flex-wrap border-b border-line bg-canvas px-3 py-2 shadow-sm"
                            : "hidden",
                        "lg:static lg:flex lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
                    ].join(" ")}
                >
                <button
                    type="button"
                    onClick={handleNormalize}
                    title={
                        settings.writing_mode === "vertical"
                            ? "半角英数字を全角に、... を …… に直し、段落の頭を字下げします"
                            : "全角英数字を半角に、…… を ... に直します"
                    }
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    {settings.writing_mode === "vertical"
                        ? "縦書き用に整える"
                        : "横書き用に整える"}
                </button>

                {/*
                 * 縦線。
                 *
                 * 左は書き方まわり、右は文字への加工。
                 * 境目が無いと、どこまでが何の仲間か分からない。
                 */}
                <span aria-hidden className="h-4 w-px shrink-0 bg-line" />

                <button
                    type="button"
                    onClick={() => void handleRuby()}
                    title="選んだ文字にルビを振ります（｜親文字《ルビ》）"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    ルビ
                </button>

                <button
                    type="button"
                    onClick={handleNote}
                    title="言葉に注釈を付けます（｜言葉［＃注：説明］）。読む人が押すと説明が出ます"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    注釈
                </button>

                <button
                    type="button"
                    onClick={handleEmphasis}
                    title="選んだ文字に傍点をつけます（《《文字》》）"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    傍点
                </button>

                {/*
                 * 場面を分ける線。
                 *
                 * 罫線を 12 本つないだもの。
                 * 中黒や星印より、切れ目だと分かりやすい。
                 */}
                <button
                    type="button"
                    onClick={() => insertAt("────────────")}
                    title="場面の切れ目に線を入れます"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    区切り線
                </button>

                <button
                    type="button"
                    onClick={handleIndent}
                    title="会話文をのぞく段落の頭に、全角の空白を入れます"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    一文字下げ
                </button>

                {/*
                 * 空の行。
                 *
                 * 間を置きたいときに使う。
                 * 改行を 2 つ入れると、1 行ぶん空く。
                 */}
                <button
                    type="button"
                    onClick={() => insertAt("", true)}
                    title="空の行を入れます"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    改行
                </button>

                <button
                    type="button"
                    onClick={() => void handleReplace()}
                    title="本文の中の文字を、まとめて置き換えます"
                    className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:border-forest-line hover:text-forest"
                >
                    置換
                </button>

                {/*
                  * 書く道具の使い方。
                  * ★ 並びのいちばん後ろに 1 つ。ルビから置換までの 7 つをまとめて説明する。
                  * ★ 押し具の中ではなく外に置く。
                  */}
                <HelpTip topic="write-marks" />

                {beforeNormalize !== null && (
                    <button
                        type="button"
                        onClick={handleUndoNormalize}
                        className="rounded border border-line bg-surface px-2 py-0.5 text-muted hover:text-ink"
                    >
                        取り消す
                    </button>
                )}

                </div>

                {/* 「…」。狭い画面だけ */}
                <button
                    type="button"
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    aria-expanded={isToolsOpen}
                    title="ほかの道具"
                    className={[
                        "ml-auto shrink-0 rounded border px-2 py-0.5 lg:hidden",
                        isToolsOpen
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-line bg-surface text-muted",
                    ].join(" ")}
                >
                    ⋯
                </button>

                {notice && <span className="text-forest">{notice}</span>}

                {/*
                 * 集中モード。
                 *
                 * 隅に浮かべていた頃は、本文やつまみに重なって邪魔だった。
                 * 道具の列の右端に、拡大の印として置く。
                 */}
                {onToggleFocus && (
                    <button
                        type="button"
                        onClick={onToggleFocus}
                        aria-pressed={isFocusMode}
                        title={
                            isFocusMode
                                ? "集中モードを解除します"
                                : "一覧やまわりを隠して、本文だけにします"
                        }
                        className={[
                            "shrink-0 rounded border p-1.5 lg:ml-auto",
                            isFocusMode
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line bg-surface text-muted hover:border-forest-line hover:text-forest",
                        ].join(" ")}
                    >
                        <FocusIcon on={isFocusMode} />
                    </button>
                )}
            </div>

            {/*
             * 本文。
             *
             * 紙のように見せる。
             * 白い面に影を落とし、周りを少し暗くすると、
             * どこまでが原稿なのかが分かる。
             */}
            <div
                ref={surfaceRef}
                className="relative flex min-h-0 flex-1 overflow-hidden bg-canvas p-0 sm:p-4"
            >
                {/*
                 * 白い紙。
                 *
                 * 高さを必ず決める。
                 *
                 * 以前は広い画面で h-auto にしていた。
                 * 高さの決まっていない親の中では、本文欄の h-full が
                 * 効かずに既定の 2 行ぶんまで縮む。
                 * 横書きにしたとき上の数行しか見えなかったのはこれ。
                 *
                 * 送るのは本文欄。紙は画面いっぱいのまま動かさない。
                 *
                 * 幅は縦書きも横書きも画面いっぱい。
                 * 以前は横書きだけ 820px で止めていたが、
                 * 広く書きたいとの声で外した。
                 */}
                <div className="mx-auto flex h-full min-h-0 w-full flex-col bg-surface shadow-[0_1px_4px_rgba(31,78,107,0.08)] sm:rounded">
                {/*
                  * 携帯：話の題は、原稿の紙のいちばん上で直す。
                  * パソコンは上の帯のまま。
                  */}
                {isMobile && !illustPlacingId && !pickEntryId && (
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onFocus={() => setIsTitleFocused(true)}
                        onBlur={() => setIsTitleFocused(false)}
                        aria-label="話のタイトル"
                        placeholder="話の題を入れてください"
                        className={`mw-title${title.trim() ? "" : " is-empty"}`}
                    />
                )}
                {illustPlacingId ? (
                    /*
                      * 挿絵の置き場所を選んでいるあいだも、打ち込む欄をやめる。
                      * 蛍光ペンと同じ形にして、触り方を揃える。
                      */
                    <IllustPlaceSurface
                        body={body}
                        illustUrl={illustPlacingUrl}
                        onPlace={async (afterSentence, anchorText) => {
                            await getRepository().moveEpisodeIllust(
                                illustPlacingId,
                                afterSentence,
                                anchorText,
                            );
                            router.back();
                        }}
                        onClose={() => router.back()}
                    />
                ) : pickEntryId ? (
                    /*
                      * 蛍光ペンのあいだは、打ち込む欄をやめる。
                      * 文ごとに押せる読む形に差し替える。
                      */
                    <PickSurface
                        body={body}
                        entryName={pickEntryName}
                        onPick={addToEntry}
                        onClose={() => router.back()}
                    />
                ) : (
                <ManuscriptSurface
                    zoom={zoom}
                    settings={settings}
                    value={body}
                    onChange={setBody}
                    showLineNumbers={showLineNumbers}
                    onSelectionChange={onSelectionChange}
                    onRangeChange={setRange}
                    /* 蛍光ペンで来たときだけ、触れた行を丸ごと選ぶ */
                    selectLineOnClick={Boolean(pickEntryId)}
                    placeholder="ここに本文を書きます。"
                />
                )}

                </div>

                {flashLine !== null && (
                    <p className="pointer-events-none absolute right-4 top-3 rounded-full bg-forest px-3 py-1 text-[11px] text-white shadow">
                        {flashLine}行目へ移動しました
                    </p>
                )}
            </div>

            {/* ---------- 携帯の下まわり ---------- */}
            {showBottomBar && (
                <MobileBottomBar
                    slots={slots}
                    onList={() => onOpenList?.()}
                    onSlot={runSlot}
                    onWrite={writeOn}
                    onTools={() => setIsSheetOpen(true)}
                    onSettings={() => router.push(`/workspace/${episode.work_id}/settings`)}
                />
            )}

            {showKeyBar && (
                <MobileKeyBar
                    bottom={keyboard.inset}
                    anchor={keyboard.anchor}
                    onRuby={() => openMark("ruby")}
                    onEmphasis={() => openMark("dot")}
                    onNote={() => openMark("note")}
                    onInsert={insertPair}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    onClose={() => getArea()?.blur()}
                />
            )}

            {isMobile && mark && (
                <MobileMarkPanel
                    bottom={keyboard.inset}
                    anchor={keyboard.anchor}
                    kind={mark.kind}
                    onKind={(kind) => setMark({ ...mark, kind })}
                    base={body.slice(mark.caret - mark.len, mark.caret)}
                    canGrow={
                        mark.caret - mark.len > 0 &&
                        body[mark.caret - mark.len - 1] !== "\n" &&
                        mark.len < 20
                    }
                    canShrink={mark.len > stepFwd(body, mark.caret - mark.len)}
                    /* 字を変えたら、先に入れた読みは合わなくなるので消す */
                    onGrow={() => setMark({ ...mark, len: mark.len + stepBack(body, mark.caret - mark.len), reading: mark.auto ? "" : mark.reading, auto: false })}
                    onShrink={() => setMark({ ...mark, len: mark.len - stepFwd(body, mark.caret - mark.len), reading: mark.auto ? "" : mark.reading, auto: false })}
                    reading={mark.reading}
                    onReading={(value) => setMark({ ...mark, reading: value })}
                    autoFilled={mark.auto}
                    onApply={applyMark}
                    onCancel={() => {
                        const at = mark.caret;
                        setMark(null);
                        window.setTimeout(() => {
                            const area = getArea();
                            area?.focus();
                            area?.setSelectionRange(at, at);
                        }, 0);
                    }}
                />
            )}

            {isMobile && isSheetOpen && (
                <MobileToolsSheet
                    workId={episode.work_id}
                    onClose={() => setIsSheetOpen(false)}
                    slots={slots}
                    onPin={pinSlot}
                    onSlot={runSlot}
                    onIndent={handleIndent}
                    onNormalize={handleNormalize}
                    normalizeLabel={settings.writing_mode === "vertical" ? "縦書き用に整える" : "横書き用に整える"}
                    isFocusMode={isFocusMode}
                    zoom={zoom}
                    onZoom={setZoom}
                    showLineNumbers={showLineNumbers}
                    onToggleLineNumbers={() => setShowLineNumbers((show) => !show)}
                />
            )}

            {/* 集中モードのときは、戻る道だけ小さく残す */}
            {isMobile && isFocusMode && !keyboard.isOpen && (
                <button type="button" className="mw-focus-exit" onClick={onToggleFocus}>
                    集中を解く
                </button>
            )}

            {/* 知らせ（ルビを付けました など）。携帯では上の段が無いので、ここに出す */}
            {isMobile && notice && <p className="mw-toast">{notice}</p>}

            {askDialog}
            {notePick && (
                <NotePicker
                    body={body}
                    range={notePick}
                    otherEpisodes={allEpisodes
                        .filter((one) => one.id !== episode.id)
                        .map((one) => ({ title: one.title, body: one.body ?? "" }))}
                    onCancel={() => setNotePick(null)}
                    onSubmit={(start, end, note) => {
                        setBody(insertAnnotation(body, start, end, note));
                        setNotePick(null);
                    }}
                />
            )}
        </div>
    );
}

function SaveIndicator({
    state,
    savedAt,
    isDraft,
}: {
    state: string;
    savedAt: string | null;
    /** まだ出していない話か */
    isDraft?: boolean;
}) {
    if (state === "saving") return <span>保存中</span>;
    if (state === "pending") return <span className="text-faint">未保存の変更</span>;

    /*
     * ★ 出していない話は、そう言う。
     *
     *   「自動保存済み」とだけ出ていると、
     *   保存した＝出た、と思う人がいる。
     *   実際「全4話なのに目次で1話しか出ない」という
     *   問い合わせが続いた。
     *
     *   保存できたことと、出ていないことは別のこと。
     *   同じ場所で、両方言う。
     *
     * ★ 色も分ける。
     *     出ている  青緑。安心してよい
     *     下書き    琥珀。まだ途中
     */
    if (state === "saved" && savedAt) {
        if (isDraft) {
            return (
                <span className="text-amber">
                    下書きに保存 {formatTime(savedAt)}・まだ出していません
                </span>
            );
        }

        return <span className="text-forest">自動保存済み {formatTime(savedAt)}</span>;
    }

    return <span className="text-faint">自動保存</span>;
}

/** 拡大の印。四隅のかぎ。集中モード中は内向きにして「戻す」を表す */
function FocusIcon({ on = false }: { on?: boolean }) {
    return (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            {on ? (
                <path
                    d="M5 1v4H1M9 1v4h4M5 13V9H1M9 13V9h4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ) : (
                <path
                    d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}
