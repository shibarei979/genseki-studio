/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeList — 左サイドバーの話一覧
 *
 * 章ごとに束ねて並べる。
 *
 *   第一章　出会い          ← 見出し。名前を直せる・消せる
 *     第1話 はじまり
 *     第2話 出会い
 *   章に入れていない
 *     第3話
 *
 * 話は章の見出しへドラッグして入れられる。
 * 話どうしをドラッグすれば、今までどおり並びが変わる。
 *
 * 並び替えは HTML5 のドラッグ＆ドロップを使う。
 * ライブラリを入れずに済ませ、依存を増やさないため。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";

import EpisodeStatusMark from "@/components/workspace/episode-status-mark";
import { formatNumber } from "@/lib/utils/text";
import type { Chapter, Episode } from "@/types";
import { useAskText } from "@/hooks/use-ask-text";
import { formatChapterLabel, formatEpisodeLabel } from "@/types";

import {
    buildChapterGroups,
    formatChapterNumber,
    formatPartNumber,
    moveChapterGroup,
    moveChapterOnto,
    orderedEpisodeIds,
} from "./chapter-tree";

interface Props {
    episodes: Episode[];
    selectedId: string | null;
    onSelect: (episodeId: string) => void;
    onCreate: () => void;
    onDelete: (episodeId: string) => void;
    onToggleStatus: (episode: Episode) => void;
    onReorder: (orderedIds: string[]) => void;
    /** 章の一覧 */
    chapters?: Chapter[];
    /** 話を章へ入れる・外す */
    onAssignChapter?: (episodeId: string, chapterId: string | null) => void;
    /**
     * 数話まとめて章へ入れる。
     *
     * ★ 1 話ずつ onAssignChapter を呼ばない。
     *   同時に走ると番号がぶつかり、
     *   「同じものがすでにあります」で弾かれて並びが狂う。
     */
    onAssignChapterMany?: (episodeIds: string[], chapterId: string) => void;
    /** 章を作る。話を渡せば、その話を作った章に入れる */
    onCreateChapter?: (episodeId: string | null) => void;
    /** 章の名前を変える */
    onRenameChapter?: (chapterId: string, title: string) => void;
    /** 章を消す。中の話は「章に入れていない」へ戻る */
    onDeleteChapter?: (chapterId: string) => void;
    /** 章を並べ替える。渡した順に上から並ぶ */
    onReorderChapters?: (orderedIds: string[]) => void;
    /** 選んだ話をまとめて消す */
    onDeleteMany?: (episodeIds: string[]) => void;
    /** 話の題名を変える */
    onRenameEpisode?: (episodeId: string, title: string) => void;
}

export default function EpisodeList({
    episodes,
    chapters = [],
    onAssignChapter,
    onAssignChapterMany,
    onCreateChapter,
    onRenameChapter,
    onDeleteChapter,
    onReorderChapters,
    onDeleteMany,
    onRenameEpisode,
    selectedId,
    onSelect,
    onCreate,
    onDelete,
    onToggleStatus,
    onReorder,
}: Props) {
    /* 名前を尋ねる小窓。ブラウザの prompt は出ない機械がある */
    const { ask, dialog: askDialog } = useAskText();

    const [draggingId, setDraggingId] = useState<string | null>(null);
    /* 「⋯」を開いている話。confirm は削除の確かめ中 */
    const [menuFor, setMenuFor] = useState<{ id: string; confirm: boolean } | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    /* ドラッグが乗っている章の見出し */
    const [overChapterId, setOverChapterId] = useState<string | null>(null);
    /* つかんでいる章。話とは別に覚える */
    const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);

    /*
     * まとめて消すために選んでいる話。
     *
     * ふだんは出さない。「選んで消す」を押したときだけ
     * 丸が出る。書いている最中に消す口が見えていると、
     * 手が滑ったときに戻せない。
     */
    /*
     * 閉じている章。
     *
     * 章が増えると、一覧が長くなって目当ての話まで遠い。
     * 見出しを押すと、その章の中身をしまえる。
     */
    const [closedChapters, setClosedChapters] = useState<string[]>([]);

    /*
     * 章を作ったあと、入れる話を選ぶ窓。
     *
     * ドラッグで入れるには、話を掴んだまま
     * 章の帯が出るまで画面を送らねばならない。
     * 100 話を超えると、これがひどく辛い。
     * 名前で探して選べるようにする。
     */
    const [fillingChapterId, setFillingChapterId] = useState<string | null>(null);
    const [fillQuery, setFillQuery] = useState("");
    const [fillPicked, setFillPicked] = useState<string[]>([]);

    const [isPicking, setIsPicking] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);

    /* 直前に選んだ話。シフトで「ここからここまで」を出すのに使う */
    const lastPicked = useRef<string | null>(null);

    /* 入れる窓のほうの、直前に選んだ話 */
    const lastFillPicked = useRef<string | null>(null);

    /*
     * 入れる窓に出ている話。
     *
     * 探した言葉で絞ったあとの並びが、そのまま
     * 「ここからここまで」の順になる。
     */
    const fillList = episodes.filter(
        (ep) =>
            !fillQuery.trim() ||
            formatEpisodeLabel(ep)
                .toLowerCase()
                .includes(fillQuery.trim().toLowerCase()),
    );

    /**
     * 入れる窓で話を選ぶ。
     *
     * シフトを押しながらだと、直前に選んだ話から
     * この話までを、まとめて選ぶ。
     * すでにその章に入っている話は、あいだにあっても飛ばす。
     */
    function toggleFillPicked(id: string, withShift = false) {
        if (withShift && lastFillPicked.current && lastFillPicked.current !== id) {
            const order = fillList.map((ep) => ep.id);
            const from = order.indexOf(lastFillPicked.current);
            const to = order.indexOf(id);

            if (from >= 0 && to >= 0) {
                const span = fillList
                    .slice(Math.min(from, to), Math.max(from, to) + 1)
                    .filter((ep) => ep.chapter_id !== fillingChapterId)
                    .map((ep) => ep.id);

                setFillPicked((list) => Array.from(new Set([...list, ...span])));
                lastFillPicked.current = id;
                return;
            }
        }

        lastFillPicked.current = id;
        setFillPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 話を選ぶ。
     *
     * シフトを押しながらだと、直前に選んだ話から
     * この話までを、まとめて選ぶ。
     * 100 話を選ぶのに 100 回押すことになっていた。
     */
    function togglePicked(id: string, withShift = false) {
        if (withShift && lastPicked.current && lastPicked.current !== id) {
            const order = orderedEpisodeIds(chapters, episodes);
            const from = order.indexOf(lastPicked.current);
            const to = order.indexOf(id);

            if (from >= 0 && to >= 0) {
                const span = order.slice(
                    Math.min(from, to),
                    Math.max(from, to) + 1,
                );
                setPicked((list) => Array.from(new Set([...list, ...span])));
                lastPicked.current = id;
                return;
            }
        }

        lastPicked.current = id;
        setPicked((list) =>
            list.includes(id) ? list.filter((at) => at !== id) : [...list, id],
        );
    }

    /**
     * 1 つ上（または下）へ動かす。
     *
     * ★ つまんで動かす操作は、携帯でできない。
     *   指では別の動き（画面を送る）になってしまう。
     *
     * ★ パソコンでも気づかれにくい。
     *   実際、並べ替えが無いと思われていた。
     *
     * 押し具なら、どこでも同じように使える。
     */
    /**
     * 1 つ上（下）へ動かせるか。
     *
     * ★ 同じ章の中だけ。
     *   となりが別の章の話だと、番号を入れ替えても章ごとに束ねて見せるので、
     *   画面の上では動かない（押しても何も起きないように見える）。
     *   章をまたぐときは「章から出す」や、つまんで章へ落とす操作を使う。
     */
    function canMove(episodeId: string, step: -1 | 1): boolean {
        const order = orderedEpisodeIds(chapters, episodes);
        const from = order.indexOf(episodeId);
        const to = from + step;
        if (from < 0 || to < 0 || to >= order.length) return false;
        const self = episodes.find((at) => at.id === episodeId);
        const other = episodes.find((at) => at.id === order[to]);
        return (self?.chapter_id ?? null) === (other?.chapter_id ?? null);
    }

    function moveBy(episodeId: string, step: -1 | 1) {
        /*
         * 画面に見えている順で数える。
         *
         * 章を作ると、見えている順は章ごとに束ねた順になり、
         * 配列の順（ep_number 順）とずれる。
         */
        const order = orderedEpisodeIds(chapters, episodes);
        const from = order.indexOf(episodeId);
        if (from < 0) return;

        const to = from + step;
        if (!canMove(episodeId, step)) return;

        const next = [...order];
        [next[from], next[to]] = [next[to], next[from]];
        onReorder(next);
    }

    /**
     * 章をまるごと 1 つ上（または下）へ動かす。
     *
     * ★ つまんで動かす操作は、携帯では効かない（長押しで文字が選ばれる）。
     *   押し具なら、どこでも同じように使える。
     *
     * ★ 章の並びは中の話の並びで決まるので、話ごと動かす。
     *   章の番号も新しい並びに合わせて振り直す。
     */
    function moveChapter(groupAt: number, step: -1 | 1) {
        const result = moveChapterGroup(chapters, episodes, groupAt, step);
        if (!result) return;
        onReorder(result.episodeIds);
        onReorderChapters?.(result.chapterIds);
    }

    function handleDrop(targetId: string, dragId: string | null = draggingId) {
        const draggingId = dragId;
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setOverId(null);
            return;
        }

        /*
         * ★ 別の章の話の上に落としたら、その章へ入れる。
         *   番号だけ入れ替えても、章ごとに束ねて見せるので画面の上では動かない
         *   （落としても何も起きないように見えていた）。
         */
        const dragged = episodes.find((at) => at.id === draggingId);
        const target = episodes.find((at) => at.id === targetId);
        if (
            onAssignChapter &&
            dragged &&
            target &&
            (dragged.chapter_id ?? null) !== (target.chapter_id ?? null)
        ) {
            onAssignChapter(draggingId, target.chapter_id ?? null);
            setDraggingId(null);
            setOverId(null);
            return;
        }

        /*
         * 並べ替えは、画面に見えている順で数える。
         *
         * 前は episodes の配列の順（ep_number 順）で数えていた。
         * 章を作ると、見えている順は章ごとに束ねた順になり、
         * 配列の順とずれる。
         * ずれたまま「3 番目に落とした」と数えるので、
         * まったく違う場所に入っていた。
         */
        const ids = orderedEpisodeIds(chapters, episodes);
        const from = ids.indexOf(draggingId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) {
            setDraggingId(null);
            setOverId(null);
            return;
        }
        ids.splice(from, 1);
        ids.splice(to, 0, draggingId);

        onReorder(ids);
        setDraggingId(null);
        setOverId(null);
    }

    /* ------------------------------------------------------------
     * 長押しで動かす（指で使う端末）
     *
     * ★ つまんで動かす操作（HTML5 のドラッグ）は、携帯の指では動かない。
     *   指を置いて少し待つと「つかんだ」ことにして、そのまま指で運べるようにする。
     *
     *   ・左のつまみ（⠿）に触れた → すぐつかむ（パソコンと同じ）
     *   ・行のほかの所に置いてすぐ動かした → いつもの画面送り（つかまない）
     *   ・行のほかの所に置いたまま 0.4 秒 → つかむ（軽く震える）
     *   ・つかんだ行は、同じ形のまま指についてくる。元の場所は薄くなる
     *   ・話の上で離す → その位置へ。別の章の話の上なら、その章へ入る
     *   ・章の見出しの上で離す → その章へ入る
     *   ・一覧の上端・下端へ寄せると、一覧が送られる
     * ------------------------------------------------------------ */
    const LONG_PRESS_MS = 400;
    const pressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
    const touchDragRef = useRef<{ id: string; scroller: HTMLElement | null } | null>(null);
    /* 長押しのあと指を離したときに、話を開いてしまわないように */
    const suppressClickRef = useRef(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    /*
     * 指についてくる話。つかんだ行と同じ形・同じ幅で、つかんだ位置のまま動く
     * （パソコンでつまんだときと同じ見え方）。
     */
    const [ghost, setGhost] = useState<{
        x: number;
        y: number;
        offsetX: number;
        offsetY: number;
        width: number;
        label: string;
        chars: number;
    } | null>(null);

    /* 指を離したときに使う。描き直しのたびに新しいものへ差し替える */
    const dropRef = useRef({ handleDrop, onAssignChapter, episodes });
    dropRef.current = { handleDrop, onAssignChapter, episodes };

    function cancelPress() {
        if (!pressRef.current) return;
        window.clearTimeout(pressRef.current.timer);
        pressRef.current = null;
    }

    /** 一覧を送っている箱（画面いっぱいなら画面そのもの） */
    function scrollerOf(el: HTMLElement | null): HTMLElement | null {
        let at = el?.parentElement ?? null;
        while (at) {
            const style = window.getComputedStyle(at);
            if (/(auto|scroll)/.test(style.overflowY) && at.scrollHeight > at.clientHeight) return at;
            at = at.parentElement;
        }
        return (document.scrollingElement as HTMLElement | null) ?? null;
    }

    /** つかむ。行の形を写した影を、指の下に出す */
    function startTouchDrag(row: HTMLElement, episode: Episode, x: number, y: number) {
        const box = row.getBoundingClientRect();
        pressRef.current = null;
        touchDragRef.current = { id: episode.id, scroller: scrollerOf(row) };
        suppressClickRef.current = true;
        setMenuFor(null);
        setDraggingId(episode.id);
        setGhost({
            x,
            y,
            offsetX: x - box.left,
            offsetY: y - box.top,
            width: box.width,
            label: formatEpisodeLabel(episode),
            chars: episode.char_count,
        });
        try {
            navigator.vibrate?.(12);
        } catch {
            /* 震えない端末もある */
        }
    }

    function handleRowTouchStart(e: ReactTouchEvent<HTMLLIElement>, episode: Episode) {
        if (isPicking || e.touches.length !== 1) return;
        const el = e.target as HTMLElement;
        if (el.closest("[data-no-press]")) return;
        const touch = e.touches[0];
        const row = e.currentTarget;
        cancelPress();

        /* つまみに触れたら、待たずにつかむ */
        if (el.closest("[data-grip]")) {
            startTouchDrag(row, episode, touch.clientX, touch.clientY);
            return;
        }

        /* 行のほかの所は、少し長押ししてからつかむ（すぐ動かせば画面送り） */
        const timer = window.setTimeout(() => {
            startTouchDrag(row, episode, touch.clientX, touch.clientY);
        }, LONG_PRESS_MS);
        pressRef.current = { x: touch.clientX, y: touch.clientY, timer };
    }

    function handleRowTouchMove(e: ReactTouchEvent) {
        const press = pressRef.current;
        if (!press) return;
        const touch = e.touches[0];
        /* 待っている間に指が動いた ＝ 画面を送りたい。つかまない */
        if (Math.abs(touch.clientX - press.x) > 10 || Math.abs(touch.clientY - press.y) > 10) cancelPress();
    }

    /*
     * ★ 画面送りを止める口は、はじめから付けておく。
     *   つかんでから付けても、端末によっては止まらない（もう送り始めている扱いになる）。
     *   つかんでいないときは何もしない。
     */
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const stop = (e: TouchEvent) => {
            if (touchDragRef.current && e.cancelable) e.preventDefault();
        };
        root.addEventListener("touchmove", stop, { passive: false });
        return () => root.removeEventListener("touchmove", stop);
    }, []);

    const isTouchDragging = Boolean(draggingId && ghost);

    /*
     * 指だけの端末では、ブラウザのつまむ操作（draggable）を切る。
     * 長押しで、ブラウザのつまむ操作とこちらの長押しが両方動き、取り合いになる。
     */
    const [fingerOnly, setFingerOnly] = useState(false);
    useEffect(() => {
        const query = window.matchMedia("(hover: none) and (pointer: coarse)");
        const update = () => setFingerOnly(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);

    useEffect(() => {
        if (!isTouchDragging) return;

        let lastX = 0;
        let lastY = 0;
        let moved = false;
        let frame = 0;
        let target: { kind: "ep" | "ch" | "out"; id: string } | null = null;

        function hitAt(x: number, y: number) {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            const ep = el?.closest<HTMLElement>("[data-ep-drop]");
            if (ep?.dataset.epDrop) return { kind: "ep" as const, id: ep.dataset.epDrop };
            const ch = el?.closest<HTMLElement>("[data-ch-drop]");
            if (ch?.dataset.chDrop) return { kind: "ch" as const, id: ch.dataset.chDrop };
            if (el?.closest("[data-unassign-drop]")) return { kind: "out" as const, id: "" };
            return null;
        }

        function aim() {
            target = hitAt(lastX, lastY);
            setOverId(target?.kind === "ep" ? target.id : target?.kind === "out" ? "__unassign__" : null);
            setOverChapterId(target?.kind === "ch" ? target.id : null);
        }

        /* 上端・下端に寄せている間、一覧を送る */
        function tick() {
            const scroller = touchDragRef.current?.scroller;
            if (scroller && moved) {
                const whole = scroller === document.scrollingElement;
                const top = whole ? 0 : scroller.getBoundingClientRect().top;
                const bottom = whole ? window.innerHeight : scroller.getBoundingClientRect().bottom;
                const edge = 64;
                let dy = 0;
                if (lastY < top + edge) dy = -Math.ceil((top + edge - lastY) / 5);
                else if (lastY > bottom - edge) dy = Math.ceil((lastY - (bottom - edge)) / 5);
                if (dy !== 0) {
                    scroller.scrollTop += dy;
                    aim();
                }
            }
            frame = window.requestAnimationFrame(tick);
        }

        function move(e: TouchEvent) {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            if (!touch) return;
            lastX = touch.clientX;
            lastY = touch.clientY;
            moved = true;
            setGhost((now) => (now ? { ...now, x: lastX, y: lastY } : now));
            aim();
        }

        function end() {
            const id = touchDragRef.current?.id ?? null;
            touchDragRef.current = null;
            const { handleDrop: drop, onAssignChapter: assign, episodes: list } = dropRef.current;
            const dragged = list.find((at) => at.id === id);
            if (id && target) {
                if (target.kind === "ep") {
                    drop(target.id, id);
                } else if (target.kind === "ch" && assign) {
                    const chapterId = target.id === "__none__" ? null : target.id;
                    /* 今いる章の見出しに戻しただけなら、何もしない */
                    if ((dragged?.chapter_id ?? null) !== chapterId) assign(id, chapterId);
                } else if (target.kind === "out" && assign && dragged?.chapter_id) {
                    assign(id, null);
                }
            }
            setDraggingId(null);
            setOverId(null);
            setOverChapterId(null);
            setGhost(null);
            /* 指を離した直後の「押した」扱いを捨ててから、元に戻す */
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 350);
        }

        document.addEventListener("touchmove", move, { passive: false });
        document.addEventListener("touchend", end);
        document.addEventListener("touchcancel", end);
        frame = window.requestAnimationFrame(tick);
        return () => {
            document.removeEventListener("touchmove", move);
            document.removeEventListener("touchend", end);
            document.removeEventListener("touchcancel", end);
            window.cancelAnimationFrame(frame);
        };
    }, [isTouchDragging]);

    /*
     * 章ごとに束ねる。
     *
     * 章の並びはそのまま、最後に「章に入れていない」を置く。
     * 章の無い作品では、束ねずにただ並べる（見出しだけ増えても邪魔）。
     */
    const hasChapters = chapters.length > 0;

    /*
     * 章を 2 段で組み立てる。
     *
     * 大きい章のすぐ後ろに、その子が続く。
     * 組み立ては chapter-tree.ts にある。
     */
    const groups = buildChapterGroups(chapters, episodes);

    /*
     * 選ばれた話まで送る。
     *
     * 新しく作った話は一番下に来るので、
     * 話が多いと画面の外にできる。
     * 見えていなければ、そこまで滑らせる。
     */
    useEffect(() => {
        if (!selectedId) return;

        /* 描き終わってから探す。すぐだとまだ無い */
        const timer = window.setTimeout(() => {
            const row = document.querySelector<HTMLElement>(
                'li[data-selected="1"]',
            );
            if (!row) return;

            /*
             * すでに見えているなら動かさない。
             *
             * 一覧の話を押すたびに画面が跳ねると、
             * 選んだつもりの場所を見失う。
             */
            const box = row.getBoundingClientRect();
            const isVisible = box.top >= 0 && box.bottom <= window.innerHeight;
            if (isVisible) return;

            row.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);

        return () => window.clearTimeout(timer);
    }, [selectedId, episodes.length]);

    function renderEpisode(episode: Episode) {
        const isSelected = episode.id === selectedId;
        const isOver = episode.id === overId && episode.id !== draggingId;

        return (
            <li
                key={episode.id}
                /*
                 * 選ばれた行に印を付ける。
                 *
                 * 新しく作った話は一覧の一番下に来る。
                 * 話が増えると画面の外なので、
                 * 作ってもどこへ行ったか分からない。
                 * この印を目印に、そこまで送る。
                 */
                data-selected={isSelected ? "1" : undefined}
                /* 長押しで運んでいるとき、指の下の話を見つける目印 */
                data-ep-drop={episode.id}
                onTouchStart={(e) => handleRowTouchStart(e, episode)}
                onTouchMove={handleRowTouchMove}
                onTouchEnd={cancelPress}
                onTouchCancel={cancelPress}
                /* 長押しで出る端末の小窓（コピーなど）を出さない */
                onContextMenu={(e) => {
                    if (pressRef.current || touchDragRef.current) e.preventDefault();
                }}
                draggable={!fingerOnly}
                onDragStart={() => setDraggingId(episode.id)}
                onDragEnd={() => {
                    setDraggingId(null);
                    setOverId(null);
                    setOverChapterId(null);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setOverId(episode.id);
                }}
                onDrop={() => handleDrop(episode.id)}
                className={[
                    /* ep-row：指で使う端末の決まり（mobile-write.css） */
                    "ep-row group relative mb-1 flex select-none items-center gap-2 rounded-md px-2 py-2 [-webkit-touch-callout:none]",
                    /* 移す先を選んでいる間は、ほかを目立たせない */
                    isSelected ? "bg-forest-tint" : "hover:bg-canvas",
                    isOver
                        ? "border-t-2 border-forest"
                        : "border-t-2 border-transparent",
                    draggingId === episode.id ? "opacity-40" : "",
                ].join(" ")}
            >
                {/*
                  * 上下へ動かす押し具。
                  *
                  * ★ つまんで動かす操作は、携帯でできない。
                  *   指では画面を送る動きになってしまう。
                  *   パソコンでも気づかれにくい。
                  *
                  * ★ 選んでいる間は出さない。
                  *   まとめて動かす作業と混ざる。
                  */}
                {/*
                  * 移す先を選んでいる間は、
                  * 「ここへ」の押し具に変える。
                  */}

                {/*
                  * ★ 行の上に重ねて置く。
                  *
                  *   並べて置くと、その幅だけ題名の場所が減る。
                  *   実際、題名が 1 文字ずつ折り返して読めなくなった。
                  *   隠すだけでは、場所は取ったまま。
                  *
                  *   重ねれば幅を取らないので、いつも出しておける。
                  *   指を置いたときだけ出す形だと、
                  *   携帯では一度も出ない。
                  */}
                {/*
                  * 話ごとの ▲▼ を行に並べるのはやめた（一覧がごちゃつくため）。
                  * 並べ替えは、つまんで動かす（パソコン）か、「⋯」の「1つ上へ・1つ下へ」で。
                  */}



                {/* 選んでいる間は、つまみの代わりに丸を出す */}
                {isPicking ? (
                    <button
                        type="button"
                        onClick={(e) => togglePicked(episode.id, e.shiftKey)}
                        aria-pressed={picked.includes(episode.id)}
                        /* 四角。選ぶ印は丸より四角のほうが伝わる */
                        className={[
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                            picked.includes(episode.id)
                                ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white"
                                : "border-line text-transparent hover:border-[var(--color-danger)]",
                        ].join(" ")}
                    >
                        ✓
                    </button>
                ) : (
                    <span
                        aria-hidden="true"
                        /*
                         * つまみ。指で触れたら、待たずにすぐつかむ（パソコンでつまむのと同じ）。
                         * ここだけは画面送りにしない（touch-action: none）。
                         * 指で押しやすいよう、見た目より広く受ける。
                         */
                        data-grip
                        className="-my-2 -ml-1 flex cursor-grab touch-none select-none items-center self-stretch px-1.5 text-xs leading-none text-faint"
                    >
                        ⠿
                    </span>
                )}

                <button
                    type="button"
                    onClick={(e) => {
                        /* 長押しで運んだあとの指離れは、開く扱いにしない */
                        if (suppressClickRef.current) return;
                        if (isPicking) togglePicked(episode.id, e.shiftKey);
                        else onSelect(episode.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                >
                    {/*
                      * ★ 題名は 2 行まで出す（それでも長ければ … で止める）。
                      *   部と章で入れ子にすると幅が狭くなり、1 行だと 2 文字しか見えなかった。
                      */}
                    <span className="block text-[13px] leading-snug text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden break-all">
                        {formatEpisodeLabel(episode)}
                    </span>
                    <span className="mt-0.5 block whitespace-nowrap text-xs text-faint">
                        {formatNumber(episode.char_count)}文字
                    </span>
                </button>

                <span data-no-press className="contents">
                    <EpisodeStatusMark
                        status={episode.status}
                        onToggle={() => onToggleStatus(episode)}
                    />
                </span>

                {/*
                  * ★ 「名前」「章から出す」「削除」は「⋯」にまとめる。
                  *   前は行に並べていて（見えない押し具も幅を取っていた）、
                  *   部と章で入れ子にすると題名が 2 文字しか見えなかった。
                  */}
                <span data-no-press className="relative shrink-0">
                    <button
                        type="button"
                        aria-label="この話の操作"
                        aria-haspopup="menu"
                        aria-expanded={menuFor?.id === episode.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor((now) => (now?.id === episode.id ? null : { id: episode.id, confirm: false }));
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-canvas hover:text-ink"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                        </svg>
                    </button>
                    {menuFor?.id === episode.id && (
                        <>
                            <span className="fixed inset-0 z-30" onClick={() => setMenuFor(null)} aria-hidden="true" />
                            <span
                                role="menu"
                                className="absolute right-0 top-full z-40 mt-1 block w-52 overflow-hidden rounded-lg border border-line bg-surface text-left shadow-lg"
                            >
                                {menuFor.confirm ? (
                                    <span className="block px-3 py-2.5">
                                        <span className="block text-[12px] font-medium text-ink">この話を削除しますか？</span>
                                        <span className="mt-1 block text-[10.5px] leading-relaxed text-muted">本文と履歴も消えます。元に戻せません。</span>
                                        <span className="mt-2 flex gap-1.5">
                                            <button type="button" onClick={() => setMenuFor({ id: episode.id, confirm: false })} className="flex-1 rounded border border-line py-1.5 text-[11px] text-muted">
                                                やめる
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMenuFor(null);
                                                    onDelete(episode.id);
                                                }}
                                                className="flex-1 rounded bg-[var(--color-danger)] py-1.5 text-[11px] font-medium text-white"
                                            >
                                                削除する
                                            </button>
                                        </span>
                                    </span>
                                ) : (
                                    <>
                                        {/*
                                          * ★ 1 つ上へ・下へ。
                                          *   つまんで動かす操作は携帯の指ではできない（画面が送られる）。
                                          *   話ごとの ▲▼ を行に並べるのはやめたので（一覧がごちゃつく）、ここに置く。
                                          *   押しても小窓は閉じない。続けて押せば何段でも動かせる。
                                          */}
                                        <span className="flex border-b border-line">
                                            <button
                                                type="button"
                                                role="menuitem"
                                                disabled={!canMove(episode.id, -1)}
                                                onClick={() => moveBy(episode.id, -1)}
                                                className="flex-1 px-3 py-2.5 text-center text-[12.5px] text-ink hover:bg-canvas disabled:text-faint disabled:opacity-50"
                                            >
                                                ▲ 1つ上へ
                                            </button>
                                            <span className="w-px bg-line" aria-hidden="true" />
                                            <button
                                                type="button"
                                                role="menuitem"
                                                disabled={!canMove(episode.id, 1)}
                                                onClick={() => moveBy(episode.id, 1)}
                                                className="flex-1 px-3 py-2.5 text-center text-[12.5px] text-ink hover:bg-canvas disabled:text-faint disabled:opacity-50"
                                            >
                                                ▼ 1つ下へ
                                            </button>
                                        </span>
                                        {onRenameEpisode && (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    setMenuFor(null);
                                                    void (async () => {
                                                        const next = await ask(`${episode.ep_number}話目の名前`, episode.title ?? "");
                                                        if (next === null) return;
                                                        onRenameEpisode(episode.id, next.trim());
                                                    })();
                                                }}
                                                className="block w-full px-3 py-2.5 text-left text-[12.5px] text-ink hover:bg-canvas"
                                            >
                                                名前を変える
                                            </button>
                                        )}
                                        {episode.chapter_id && onAssignChapter && (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    setMenuFor(null);
                                                    onAssignChapter(episode.id, null);
                                                }}
                                                className="block w-full border-t border-line px-3 py-2.5 text-left text-[12.5px] text-ink hover:bg-canvas"
                                            >
                                                章から出す
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => setMenuFor({ id: episode.id, confirm: true })}
                                            className="block w-full border-t border-line px-3 py-2.5 text-left text-[12.5px] text-[var(--color-danger)] hover:bg-canvas"
                                        >
                                            削除する
                                        </button>
                                    </>
                                )}
                            </span>
                        </>
                    )}
                </span>
            </li>
        );
    }

    return (
        <div ref={rootRef} className="flex h-full flex-col">
            {/*
              * つかんだ話。行と同じ形で、つかんだ位置のまま指についてくる。
              * 落とす先は、一覧の線と章の枠の光りで分かる。
              */}
            {ghost && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed z-[80] flex items-center gap-2 rounded-md bg-surface px-2 py-2 opacity-95 shadow-[0_6px_20px_rgba(20,40,55,.22)] ring-1 ring-forest-line"
                    style={{ left: ghost.x - ghost.offsetX, top: ghost.y - ghost.offsetY, width: ghost.width }}
                >
                    <span className="px-0.5 text-xs leading-none text-faint">⠿</span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] leading-snug text-ink">{ghost.label}</span>
                        <span className="mt-0.5 block whitespace-nowrap text-xs text-faint">
                            {formatNumber(ghost.chars)}文字
                        </span>
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">エピソード</h2>
                <span className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onCreate}
                        className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                    >
                        ＋ 新規作成
                    </button>

                    {onCreateChapter && (
                        <button
                            type="button"
                            onClick={() => onCreateChapter(null)}
                            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                        >
                            ＋ 章
                        </button>
                    )}

                </span>
            </div>

            {/*
             * まとめて消す。
             *
             * 余分な話を 1 つずつ消すのは骨が折れる。
             * ただし戻せない操作なので、
             * ふだんは丸を出さず、押したときだけ選べるようにする。
             */}
            {onDeleteMany && episodes.length > 0 && (
                /*
                 * 選んでいる間は、この帯を上に貼り付ける。
                 *
                 * 下のほうの話を選んでいると、
                 * 「◯話を選んでいます」も操作の押し具も
                 * 画面の外へ行ってしまい、何をしているのか分からなくなる。
                 */
                <div
                    className={[
                        "px-3.5 pb-2",
                        isPicking ? "sticky top-0 z-10 bg-surface pt-2 shadow-sm" : "",
                    ].join(" ")}
                >
                    {!isPicking ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsPicking(true);
                                setPicked([]);
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface py-1.5 text-[11px] text-muted hover:border-forest-line hover:text-forest"
                        >
                            <span aria-hidden="true">☑</span>
                            話を選ぶ
                        </button>
                    ) : (
                        /*
                         * ★ 帯の高さに上限を掛ける。
                         *
                         *   選ぶと、章の数だけ行き先の押し具が増える。
                         *   携帯では帯が画面の大半を占め、
                         *   肝心の話の一覧が数行しか見えなくなっていた。
                         *
                         *   帯は 4 割まで。あふれたら帯の中で送る。
                         */
                        <div className="thin-scroll max-h-[40vh] overflow-y-auto rounded-md border border-line bg-canvas px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-ink">
                                    {picked.length > 0
                                        ? `${picked.length}話を選んでいます`
                                        : "消す話を選んでください"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPicking(false);
                                        setPicked([]);
                                    }}
                                    className="shrink-0 text-[11px] text-faint hover:text-ink"
                                >
                                    やめる
                                </button>
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPicked(
                                            picked.length === episodes.length
                                                ? []
                                                : episodes.map((ep) => ep.id),
                                        )
                                    }
                                    className="rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line"
                                >
                                    {picked.length === episodes.length
                                        ? "選択を外す"
                                        : "すべて選ぶ"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setPicked(
                                            episodes
                                                .filter(
                                                    (ep) =>
                                                        !ep.title.trim() &&
                                                        ep.char_count === 0,
                                                )
                                                .map((ep) => ep.id),
                                        )
                                    }
                                    title="名前も本文も無い話を選びます"
                                    className="rounded border border-line px-2 py-0.5 text-[10px] text-muted hover:border-forest-line"
                                >
                                    空の話を選ぶ
                                </button>

                            </div>

                            {/*
                             * 選んだ話にできること。
                             *
                             * 消すだけでなく、章へ入れる・外すもここから。
                             * 1 話ずつ章を選び直すのは骨が折れる。
                             */}
                            {picked.length > 0 && (
                                <div className="mt-2 border-t border-line pt-2">
                                    {onAssignChapter && (
                                        <>
                                            <p className="text-[10px] text-faint">
                                                選んだ{picked.length}話を
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {chapters.map((chapter, at) => (
                                                    <button
                                                        key={chapter.id}
                                                        type="button"
                                                        onClick={() => {
                                                            picked.forEach((id) =>
                                                                onAssignChapter(id, chapter.id),
                                                            );
                                                            setIsPicking(false);
                                                            setPicked([]);
                                                        }}
                                                        className="max-w-[140px] truncate rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                    >
                                                        {formatChapterLabel(chapter, at)}へ
                                                    </button>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        picked.forEach((id) =>
                                                            onAssignChapter(id, null),
                                                        );
                                                        setIsPicking(false);
                                                        setPicked([]);
                                                    }}
                                                    className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-forest-line hover:text-forest"
                                                >
                                                    章から出す
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const names = episodes
                                                .filter((ep) => picked.includes(ep.id))
                                                .slice(0, 5)
                                                .map((ep) => formatEpisodeLabel(ep))
                                                .join("\n");

                                            if (
                                                !window.confirm(
                                                    `${picked.length}話を消します。元に戻せません。\n\n` +
                                                        `${names}${picked.length > 5 ? "\nほか" : ""}`,
                                                )
                                            ) {
                                                return;
                                            }
                                            onDeleteMany(picked);
                                            setIsPicking(false);
                                            setPicked([]);
                                        }}
                                        className="mt-2 w-full rounded bg-[var(--color-danger)] py-1.5 text-[10px] text-white hover:opacity-90"
                                    >
                                        {picked.length}話を消す
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/*
              * ★ 一覧には必ず高さを残す。
              *
              *   上の帯が伸びると、ここが数行に潰れていた。
              */}
            <div className="thin-scroll min-h-[30vh] flex-1 overflow-y-auto px-2 pb-2">
                {groups.map((group, groupAt) => {
                    const {
                        chapter,
                        items,
                        depth,
                        isBig,
                        parentId,
                        labelIndex,
                        totalCount,
                    } = group;

                    /* 章が無い作品では、見出しを出さずに並べるだけ */
                    if (!hasChapters) {
                        return (
                            <ul key="all">{items.map(renderEpisode)}</ul>
                        );
                    }

                    /* 空の「章に入れていない」は出さない。見出しだけ残っても仕方ない */
                    if (!chapter && items.length === 0) return null;

                    /*
                     * 親をしまっているあいだ、小さい章は出さない。
                     *
                     * 中の話だけでなく、章の見出しごと隠す。
                     * でないと「しまった」ように見えない。
                     */
                    if (parentId && closedChapters.includes(parentId)) {
                        return null;
                    }

                    const isOverHere =
                        overChapterId === (chapter?.id ?? "__none__");

                    return (
                        <div
                            /*
                             * 同じ章が並びの中に何度も出ることがある。
                             * 章の id だけを目印にすると重なって、
                             * 描き直しのときに行が入れ替わる。
                             * 並びの位置を混ぜて、必ず別物にする。
                             */
                            key={`${chapter?.id ?? "__none__"}-${groupAt}`}
                            className="mb-1"
                            style={depth > 0 ? { paddingLeft: 14 } : undefined}
                        >
                            {/*
                             * 章の見出し。
                             *
                             * ここへ話をドラッグすると、その章に入る。
                             * 受け取れることが分かるよう、
                             * 乗っている間は枠を光らせる。
                             */}
                            <div
                                /*
                                 * 章そのものも動かせる。
                                 * 上から並んだ順が、そのまま章の順になる。
                                 */
                                draggable={Boolean(chapter && onReorderChapters)}
                                onDragStart={() => {
                                    if (chapter) setDraggingChapterId(chapter.id);
                                }}
                                onDragEnd={() => {
                                    setDraggingChapterId(null);
                                    setOverChapterId(null);
                                }}
                                onDragOver={(e) => {
                                    if (!onAssignChapter && !draggingChapterId) return;
                                    e.preventDefault();
                                    setOverChapterId(chapter?.id ?? "__none__");
                                }}
                                onDragLeave={() => setOverChapterId(null)}
                                /* 長押しで運んでいるとき、指の下の章を見つける目印 */
                                data-ch-drop={onAssignChapter ? chapter?.id ?? "__none__" : undefined}
                                onDrop={() => {
                                    /*
                                     * 章を章の上へ落としたら、並べ替え。
                                     *
                                     * ★ 中の話ごと動かす。章の並びは話の並びで決まるので、
                                     *   番号だけ入れ替えても見た目が変わらなかった。
                                     */
                                    if (
                                        draggingChapterId &&
                                        chapter &&
                                        draggingChapterId !== chapter.id &&
                                        onReorderChapters
                                    ) {
                                        const result = moveChapterOnto(
                                            chapters,
                                            episodes,
                                            draggingChapterId,
                                            chapter.id,
                                        );
                                        if (result) {
                                            onReorder(result.episodeIds);
                                            onReorderChapters(result.chapterIds);
                                        } else {
                                            /*
                                             * 話の入っていない章などは、今までどおり番号だけ入れ替える
                                             * （空の章は、この番号の順で並ぶ）。
                                             */
                                            const ids = chapters.map((c) => c.id);
                                            const from = ids.indexOf(draggingChapterId);
                                            const to = ids.indexOf(chapter.id);
                                            ids.splice(from, 1);
                                            ids.splice(to, 0, draggingChapterId);
                                            onReorderChapters(ids);
                                        }
                                    } else if (draggingId && onAssignChapter) {
                                        /* 話を落としたら、その章に入れる */
                                        onAssignChapter(
                                            draggingId,
                                            chapter?.id ?? null,
                                        );
                                    }
                                    setDraggingId(null);
                                    setDraggingChapterId(null);
                                    setOverChapterId(null);
                                }}
                                className={[
                                    /*
                                     * 2 段にする。
                                     *
                                     * 名前と押し具を横に並べていたので、
                                     * 細い一覧では名前の幅が 3 分の 1 ほどしか
                                     * 残らず、「第一部　白書の魔女」が切れた。
                                     * 名前に 1 行ぜんぶを渡す。
                                     */
                                    "el-chhead group/chapter mt-2 flex flex-col gap-1 rounded-md px-2 py-1.5",
                                    isOverHere
                                        ? "bg-forest-tint ring-1 ring-forest"
                                        : "bg-canvas",
                                ].join(" ")}
                            >
                                {/* 1 段目：つまみ・開閉・名前 */}
                                <div className="flex w-full items-center gap-1.5">
                                {chapter && onReorderChapters && (
                                    <span
                                        aria-hidden="true"
                                        className="cursor-grab select-none text-[10px] leading-none text-faint"
                                    >
                                        ⠿
                                    </span>
                                )}

                                {chapter && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setClosedChapters((list) =>
                                                list.includes(chapter.id)
                                                    ? list.filter((at) => at !== chapter.id)
                                                    : [...list, chapter.id],
                                            )
                                        }
                                        aria-expanded={!closedChapters.includes(chapter.id)}
                                        title={
                                            closedChapters.includes(chapter.id)
                                                ? "開く"
                                                : "しまう"
                                        }
                                        className="shrink-0 px-0.5 text-[10px] text-faint hover:text-forest"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="inline-block transition-transform"
                                            style={{
                                                transform: closedChapters.includes(chapter.id)
                                                    ? "rotate(-90deg)"
                                                    : "none",
                                            }}
                                        >
                                            ▾
                                        </span>
                                    </button>
                                )}

                                {/*
                                 * 番号は札にして、名前とは分ける。
                                 *
                                 * 「第一部　白書の魔女」を 1 つの文字列に
                                 * していたので、細い一覧では番号だけが見えて
                                 * 名前が切れていた。
                                 * 札は縮まないので、残り全部が名前に渡る。
                                 */}
                                {/*
                                 * 番号の札。
                                 *
                                 * ★ 名前が付いたら出さない。
                                 *
                                 *   「序章」と名付けても「第一章」の札が残り、
                                 *   名前を直したのに変わっていないように見えた。
                                 *   名前が無い章だけ、番号で場所を示す。
                                 */}
                                {chapter && !chapter.title?.trim() && (
                                    <span
                                        className={[
                                            "shrink-0 rounded px-1 py-0.5 text-[9px] leading-none",
                                            isBig
                                                ? "bg-forest font-bold text-white"
                                                : "bg-forest-tint font-medium text-forest",
                                        ].join(" ")}
                                    >
                                        {isBig
                                            ? formatPartNumber(labelIndex)
                                            : formatChapterNumber(labelIndex)}
                                    </span>
                                )}

                                <span
                                    className={[
                                        "min-w-0 flex-1 truncate text-[11px] text-ink",
                                        isBig ? "font-semibold" : "font-medium",
                                    ].join(" ")}
                                    title={chapter?.title || undefined}
                                >
                                    {chapter
                                        ? chapter.title || (
                                              <span className="text-faint">
                                                  名前なし
                                              </span>
                                          )
                                        : "章に入れていない"}
                                </span>

                                {/*
                                 * 大きい章は、配下の小さい章まで合わせた数。
                                 * 部の見出しに「0話」と出ては困る。
                                 */}
                                <span className="shrink-0 text-[10px] font-normal text-faint">
                                    {totalCount}話
                                </span>
                                </div>

                                {/* 2 段目：押し具。名前の幅を取らない */}
                                <div className="flex w-full items-center gap-1">


                                {chapter && onAssignChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFillingChapterId(chapter.id);
                                            setFillQuery("");
                                            setFillPicked([]);
                                        }}
                                        title="この章に話を入れる"
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-forest hover:text-forest"
                                    >
                                        話を入れる
                                    </button>
                                )}

                                {chapter && onRenameChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void (async () => {
                                            const next = await ask(
                                                "章の名前",
                                                chapter.title ?? "",
                                            );
                                            if (next === null) return;
                                            onRenameChapter(
                                                chapter.id,
                                                next.trim(),
                                            );
                                            })();
                                        }}
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-forest hover:text-forest"
                                    >
                                        名前
                                    </button>
                                )}

                                {chapter && onDeleteChapter && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                !window.confirm(
                                                    `「${chapter.title || "この章"}」を消しますか？\n中の話は消えません。「章に入れていない」へ戻ります。`,
                                                )
                                            ) {
                                                return;
                                            }
                                            onDeleteChapter(chapter.id);
                                        }}
                                        className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                    >
                                        消す
                                    </button>
                                )}
                                {/*
                                  * 章を上下へ動かす。中の話ごと動く。「消す」の横に小さく置く。
                                  * 動かせない向き（いちばん上・下、話の無い章）は薄くする。
                                  */}
                                {chapter && onReorderChapters && (() => {
                                    const canUp = moveChapterGroup(chapters, episodes, groupAt, -1) !== null;
                                    const canDown = moveChapterGroup(chapters, episodes, groupAt, 1) !== null;
                                    return (
                                        <span className="el-chmove flex shrink-0 items-center overflow-hidden rounded border border-line">
                                            <button
                                                type="button"
                                                onClick={() => moveChapter(groupAt, -1)}
                                                disabled={!canUp}
                                                title="章を1つ上へ"
                                                aria-label="章を1つ上へ動かす"
                                                className="px-1 py-0 text-[7px] leading-[12px] text-muted hover:text-forest disabled:opacity-30"
                                            >
                                                ▲
                                            </button>
                                            <span className="h-2 w-px bg-line" aria-hidden="true" />
                                            <button
                                                type="button"
                                                onClick={() => moveChapter(groupAt, 1)}
                                                disabled={!canDown}
                                                title="章を1つ下へ"
                                                aria-label="章を1つ下へ動かす"
                                                className="px-1 py-0 text-[7px] leading-[12px] text-muted hover:text-forest disabled:opacity-30"
                                            >
                                                ▼
                                            </button>
                                        </span>
                                    );
                                })()}
                                </div>
                            </div>

                            {!(chapter && closedChapters.includes(chapter.id)) && (
                                <ul>{items.map(renderEpisode)}</ul>
                            )}

                            {/*
                             * 大きい章には出さない。
                             * 話は小さい章のほうへ入れてもらう。
                             */}
                            {items.length === 0 && !isBig && (
                                <p className="px-3 py-2 text-[10px] text-faint">
                                    ここへ話をドラッグすると入ります
                                </p>
                            )}
                        </div>
                    );
                })}

                {/*
                  * 章から出す先。
                  *
                  * 出す仕組みは前からあったが、口が2つとも
                  * 見つけにくい所にあった。
                  *
                  *   「話を選ぶ」で選んでから押す
                  *   「章に入れていない」の見出しへ落とす
                  *
                  * 後者は、章に入っていない話が1つも無いと
                  * 見出しごと出ない。全部を章に入れた瞬間、
                  * 出す先が画面から消えていた。
                  * 「章を消して組み直すしかない」と言われたのは、そのため。
                  *
                  * つまんでいる間だけ、必ずここに出す。
                  */}
                {draggingId && onAssignChapter && (
                    <div
                        data-unassign-drop
                        onDragOver={(e) => {
                            e.preventDefault();
                            setOverId("__unassign__");
                        }}
                        onDragLeave={() => setOverId(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (draggingId) onAssignChapter(draggingId, null);
                            setDraggingId(null);
                            setOverId(null);
                        }}
                        className={[
                            "mt-2 rounded-md border border-dashed px-3 py-3 text-center text-[11px]",
                            overId === "__unassign__"
                                ? "border-forest bg-forest-tint text-forest"
                                : "border-line text-faint",
                        ].join(" ")}
                    >
                        ここへ落とすと、章から出ます
                    </div>
                )}
            </div>

            {episodes.length === 0 && (
                <p className="px-4 pb-4 text-xs text-faint">
                    まだ話がありません。「新規作成」で第1話を作ります。
                </p>
            )}

            {/*
             * 章に話を入れる窓。
             *
             * 名前で探して選ぶ。ドラッグで運ぶより確実で速い。
             */}
            {fillingChapterId && onAssignChapter && (
                <div
                    onClick={() => setFillingChapterId(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex max-h-[70vh] w-[min(420px,100%)] flex-col overflow-hidden rounded-xl bg-surface"
                    >
                        <div className="flex items-center justify-between border-b border-line px-4 py-3">
                            <span className="text-[13px] font-medium text-ink">
                                {formatChapterLabel(
                                    chapters.find((c) => c.id === fillingChapterId)!,
                                    chapters.findIndex((c) => c.id === fillingChapterId),
                                )}
                                に入れる話
                            </span>
                            <button
                                type="button"
                                onClick={() => setFillingChapterId(null)}
                                className="text-[13px] text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-4 pt-3">
                            <input
                                type="text"
                                value={fillQuery}
                                onChange={(e) => setFillQuery(e.target.value)}
                                placeholder="話の名前で探す"
                                className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                        </div>

                        <ul className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                            {fillList.map((ep) => {
                                /*
                                 * すでにこの章に入っている話は選べない。
                                 *
                                 * 押しても何も起きないのに押せてしまうと、
                                 * 入れたつもりの数が合わなくなる。
                                 */
                                const isIn = ep.chapter_id === fillingChapterId;
                                const isPicked = fillPicked.includes(ep.id);

                                return (
                                    <li key={ep.id}>
                                        <button
                                            type="button"
                                            disabled={isIn}
                                            onClick={(e) =>
                                                toggleFillPicked(ep.id, e.shiftKey)
                                            }
                                            className={[
                                                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left",
                                                isIn
                                                    ? "cursor-not-allowed opacity-50"
                                                    : "hover:bg-canvas",
                                            ].join(" ")}
                                        >
                                            <span
                                                className={[
                                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px]",
                                                    isIn
                                                        ? "border-line bg-canvas text-transparent"
                                                        : isPicked
                                                          ? "border-forest bg-forest text-white"
                                                          : "border-line text-transparent",
                                                ].join(" ")}
                                            >
                                                ✓
                                            </span>
                                            <span
                                                className={[
                                                    "min-w-0 flex-1 truncate text-[13px]",
                                                    isIn ? "text-faint" : "text-ink",
                                                ].join(" ")}
                                            >
                                                {formatEpisodeLabel(ep)}
                                            </span>
                                            {isIn && (
                                                <span className="shrink-0 text-[10px] text-faint">
                                                    入っています
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
                            <span className="text-[11px] text-muted">
                                {fillPicked.length}話を選択
                            </span>
                            <button
                                type="button"
                                disabled={fillPicked.length === 0}
                                onClick={() => {
                                    /* まとめて渡す。1 話ずつ呼ぶと番号がぶつかる */
                                    if (onAssignChapterMany) {
                                        onAssignChapterMany(
                                            fillPicked,
                                            fillingChapterId,
                                        );
                                    } else {
                                        fillPicked.forEach((id) =>
                                            onAssignChapter(id, fillingChapterId),
                                        );
                                    }
                                    setFillingChapterId(null);
                                    setFillPicked([]);
                                }}
                                className="ml-auto rounded-md bg-forest px-4 py-1.5 text-[12px] text-white hover:bg-forest-dark disabled:opacity-40"
                            >
                                この章に入れる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {episodes.length > 1 && (
                <p className="border-t border-line px-3.5 py-2 text-[11px] text-faint">
                    ドラッグ＆ドロップで並び替え
                    {hasChapters && "・章の見出しへ入れられます"}
                </p>
            )}

            {askDialog}
        </div>
    );
}
