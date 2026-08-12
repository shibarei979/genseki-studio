/**
 * ============================================================
 * 原石航路 Studio
 * HomeWorkTable — ホームの「書いた本」
 *
 * 見方を 2 つ持たせている。
 *
 *   一覧 … 1 行 1 作品。更新日と分量を縦に並べて比べられる
 *   表紙 … 正方形の札。題名と雰囲気で選ぶ
 *
 * 数が少ないうちは札のほうが探しやすく、
 * 増えてくると一覧のほうが速い。どちらが正しいかは
 * 作品の数と、その日の目的で変わるので、押して切り替える。
 *
 * 絞り込みや並べ替えは置かない。
 * それは作品一覧（マイページ）の仕事で、ここでは行き先を選ぶだけ。
 * ============================================================
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatNumber } from "@/lib/utils/text";
import type { Episode, WorkWithStats } from "@/types";

/**
 * 作品の状態。
 *
 * かつては棚の上にタブを並べて絞り込めるようにしていたが、
 * 外した。棚は本の背が見えていることに意味があり、
 * 絞り込むと棚がまばらになって、棚に見えなくなる。
 *
 * 状態は本の表紙に書いてあるので、
 * 眺めれば「まだ下書きばかりだ」と分かる。
 */
type StateKey = "writing" | "public" | "completed" | "paused";
type SortKey = "updated" | "created" | "title" | "chars";

const SORTS: { key: SortKey; label: string }[] = [
    { key: "updated", label: "更新日が新しい順" },
    { key: "created", label: "作った順" },
    { key: "title", label: "タイトル順" },
    { key: "chars", label: "文字数が多い順" },
];

/**
 * 作品がいまどの状態にあるか。
 *
 * 完結と休止は公開範囲より強い。
 * 「公開されている完結作」は完結として扱いたいので、
 * 連載状態を先に見てから公開範囲を見る。
 */
function stateOf(work: WorkWithStats): StateKey {
    if (work.serial_status === "completed") return "completed";
    if (work.serial_status === "paused") return "paused";
    if (work.visibility === "draft") return "writing";
    return "public";
}

const STATE_STYLE: Record<
    StateKey,
    { label: string; className: string; bar: string }
> = {
    writing: {
        label: "執筆中",
        className: "bg-forest-tint text-forest",
        bar: "var(--color-forest)",
    },
    public: {
        label: "公開中",
        className: "bg-[var(--color-leaf-tint)] text-[var(--color-leaf)]",
        bar: "var(--color-leaf)",
    },
    completed: {
        label: "完結済み",
        className: "bg-amber-tint text-amber",
        bar: "var(--color-amber)",
    },
    paused: {
        label: "保存済み",
        className: "bg-canvas text-muted",
        bar: "var(--color-faint)",
    },
};

/**
 * 表紙 1 冊の横幅（px）。
 *
 * ここだけ変えれば棚全体の大きさが変わる。
 *
 * 引き伸ばし（1fr）は使わない。
 * 「最低 52px、余りは分け合う」にすると、画面が広いときに
 * 1 冊が倍近くまで太り、指定した大きさで表示されない。
 * 余りは右端の空きとして残す。
 */
const BOOK_WIDTH = 128;
/*
 * 本 1 冊の高さ。棚板の位置もここから決まる。
 *
 * 128 × 166。縦横比 1.3。
 * 細長くすると短冊に、正方形に寄せると色板に見える。
 */
const BOOK_HEIGHT = 166;
/** 本と本の間 */
const BOOK_GAP = 24;
/*
 * 棚板の各面の高さ。
 *
 * 板は 3 つの面で出来ている。
 *   上面 … 本が載る奥の板。明るい
 *   前面 … 手前に見える木。明→中間→暗→最暗の 4 段
 *   下面 … 板の裏。暗く、下へ溶ける
 * 木目を描き込むより、面を分けるほうが板になる。
 */
const SHELF_TOP = 7;
const SHELF_FRONT = 16;
const SHELF_UNDER = 5;
const SHELF_THICKNESS = SHELF_TOP + SHELF_FRONT + SHELF_UNDER;
/** 棚板から次の段の本までの空き。板が厚くなったぶん詰めてある */
const SHELF_GAP = 26;

/**
 * 表紙の中の寸法。
 *
 * 幅から割り出す。背表紙や余白を px で固定すると、
 * BOOK_WIDTH を変えたときに比率が崩れて別の本に見える。
 * 題名だけは下限を置く。9px を切ると読めない。
 */
const BOOK = {
    /** 背表紙の幅 */
    spine: 7,
    /** 小口（紙の束）の幅 */
    edge: 5,
    /** 題名の大きさ */
    title: 12,
};

/**
 * 表紙の色。
 *
 * 淡い紙の色を並べる。濃い色に白抜きだと、
 * 12 冊並んだときに画面が重くなる。
 * 棚に挿さった本は、背が明るいほうが探しやすい。
 */
export const COVERS = [
    { base: "#f4f1e8", ink: "#4a4238" },
    { base: "#2f3f5c", ink: "#f0ece2" },
    { base: "#dfe8db", ink: "#3f5040" },
    { base: "#e2e8ec", ink: "#5c4632" },
    { base: "#dbe4ec", ink: "#39485a" },
    { base: "#e8e6e0", ink: "#4a4640" },
    { base: "#e2dced", ink: "#453c5c" },
    { base: "#f2dcdc", ink: "#5c3a3a" },
    { base: "#e6e0d2", ink: "#4f4632" },
    { base: "#e9ddc8", ink: "#5a4726" },
    { base: "#d8e5e6", ink: "#37504f" },
    { base: "#f4efe4", ink: "#4a4238" },
];

interface Props {
    works: WorkWithStats[];
    episodes: Episode[];
    onDelete: (work: WorkWithStats) => void | Promise<void>;
}

export default function HomeWorkTable({ works, episodes, onDelete }: Props) {
    const [sort, setSort] = useState<SortKey>("updated");

    /* 棚で見るか、一覧で見るか */
    const [view, setView] = useState<"shelf" | "list">("shelf");

    const shown = [...works].sort((a, b) => {
        if (sort === "title")
            return (a.title || "無題").localeCompare(b.title || "無題", "ja");
        if (sort === "chars") return b.total_char_count - a.total_char_count;
        if (sort === "created") return b.created_at.localeCompare(a.created_at);
        return b.updated_at.localeCompare(a.updated_at);
    });

    const episodesOf = (workId: string) =>
        episodes.filter((episode) => episode.work_id === workId);

    return (
        /*
         * 白い枠で囲まない。
         * 棚板と本そのものが枠の役目をするので、
         * さらに外側を囲むと入れ子の箱になる。
         */
        <section>
            <div className="flex items-center gap-3">
                <h2 className="shrink-0 text-[13px] font-semibold tracking-wide text-ink">
                    書いた本
                </h2>

                {/*
                 * 見出しから右へ細い線を引く。
                 * 棚の段と同じ向きの線が 1 本入ると、
                 * ここから下が棚だと分かる。
                 */}
                <span className="h-px min-w-0 flex-1 bg-line" />

                {/*
                 * 見せ方の切り替え。
                 *
                 * 少ないうちは棚が楽しいが、増えてくると
                 * 一覧のほうが速い。どちらが正しいかは冊数で変わる。
                 */}
                <div className="flex shrink-0 gap-0.5 rounded-lg border border-line bg-surface p-0.5">
                    {(
                        [
                            { key: "shelf", label: "棚" },
                            { key: "list", label: "一覧" },
                        ] as const
                    ).map((row) => (
                        <button
                            key={row.key}
                            type="button"
                            onClick={() => setView(row.key)}
                            aria-pressed={view === row.key}
                            className={[
                                "rounded px-2.5 py-1 text-[11px]",
                                view === row.key
                                    ? "bg-forest text-white"
                                    : "text-muted hover:text-ink",
                            ].join(" ")}
                        >
                            {row.label}
                        </button>
                    ))}
                </div>

                <label className="flex shrink-0 items-center gap-1.5">
                    <span className="sr-only">並べ替え</span>
                    <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value as SortKey)}
                        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted outline-none hover:text-ink focus:border-forest"
                    >
                        {SORTS.map((row) => (
                            <option key={row.key} value={row.key}>
                                {row.label}
                            </option>
                        ))}
                    </select>
                </label>

            </div>

            {shown.length === 0 ? (
                <p className="mt-4 py-12 text-center text-xs leading-relaxed text-muted">
                    {works.length === 0 ? (
                        <>
                            まだ作品がありません。
                            <br />
                            <Link
                                href="/post"
                                className="mt-3 inline-block text-forest hover:underline"
                            >
                                最初の作品を作る
                            </Link>
                        </>
                    ) : null}
                </p>
            ) : view === "list" ? (
                /*
                 * 一覧。
                 *
                 * 表紙を小さく添える。
                 * 文字だけ並べると、どれがどれか目で追えない。
                 * 棚で覚えた色が、ここでも手がかりになる。
                 */
                <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {shown.map((work) => {
                        const own = episodesOf(work.id);
                        const state = stateOf(work);
                        const chip = STATE_STYLE[state];

                        const hash = hashOf(work.title || work.id);
                        const cover = COVERS[hash % COVERS.length];

                        const newest = [...own].sort(
                            (a, b) => b.ep_number - a.ep_number,
                        )[0];

                        return (
                            <li key={work.id} className="relative">
                                <Link
                                    href={`/workspace/${work.id}`}
                                    className="flex items-center gap-3.5 py-3 pl-4 pr-12 hover:bg-canvas"
                                >
                                    {/*
                                     * 小さな本。
                                     *
                                     * 平らな色板ではなく、棚と同じ作りを縮めて置く。
                                     * 綴じ側の陰・紙の束・縁の線まで同じにすると、
                                     * 棚と一覧を行き来しても同じ本に見える。
                                     */}
                                    <span className="relative h-12 w-[34px] shrink-0">
                                        <span
                                            className="absolute bottom-[1px] right-0 top-[1px] w-[4px] rounded-r-[2px]"
                                            style={{
                                                background:
                                                    "repeating-linear-gradient(90deg, #ebe4d5 0 1px, #f8f4ec 1px 2px)",
                                                boxShadow:
                                                    "inset -1px 0 0 rgba(0,0,0,0.10)",
                                            }}
                                        />
                                        <span
                                            className="absolute inset-y-0 left-0 right-[3px] overflow-hidden rounded-l-[1px] rounded-r-[2px]"
                                            style={{
                                                background: cover.base,
                                                boxShadow:
                                                    "inset 0 0 0 1px rgba(0,0,0,0.07), 0 3px 6px -4px rgba(60,45,30,0.45)",
                                            }}
                                        >
                                            <span
                                                className="absolute inset-y-0 left-0 w-[4px]"
                                                style={{
                                                    background:
                                                        "linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 60%, rgba(255,255,255,0.30) 100%)",
                                                }}
                                            />
                                            <span
                                                className="absolute inset-0"
                                                style={{
                                                    background:
                                                        "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)",
                                                }}
                                            />
                                        </span>
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-[13px] font-medium text-ink">
                                                {work.title || "無題"}
                                            </span>
                                            <span
                                                className={`shrink-0 rounded px-1.5 py-px text-[10px] ${chip.className}`}
                                            >
                                                {chip.label}
                                            </span>
                                        </span>

                                        {/* いま何話まで来ているか。棚では見えない情報 */}
                                        <span className="mt-1 block truncate text-[11px] text-muted">
                                            {newest
                                                ? `第${newest.ep_number}話　${newest.title || "無題"}`
                                                : "まだ話がありません"}
                                        </span>

                                        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-faint">
                                            <span>
                                                {own.length > 0
                                                    ? `全${own.length}話`
                                                    : `${formatNumber(work.total_char_count)}字`}
                                            </span>
                                            <span>·</span>
                                            <span className="tabular-nums">
                                                更新{" "}
                                                {work.updated_at
                                                    .slice(0, 10)
                                                    .replace(/-/g, "/")}
                                            </span>
                                        </span>
                                    </span>
                                </Link>

                                {/*
                                 * 「⋮」。棚では出るのに一覧では消せなかった。
                                 * 押す所の外に置き、行の押し先と混ざらないようにする。
                                 */}
                                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <RowMenu
                                        work={work}
                                        onDelete={() => void onDelete(work)}
                                    />
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                /*
                 * 棚。
                 *
                 * 列数ではなく 1 冊の幅を決めて敷き詰める。
                 * 列数を決め打ちにすると、画面幅によって本が大きくなったり
                 * 小さくなったりして、棚としての見え方が安定しない。
                 *
                 * 棚板は、段ごとに要素を置くのではなく背景で描く。
                 * 画面幅で 1 段に入る冊数が変わるので、
                 * どこで段が変わるかを JavaScript 側では決められない。
                 * 段の高さぶんで繰り返す背景にすれば、
                 * 何冊並ぼうと必ず本の足元に板が来る。
                 *
                 * 下に板の厚みぶんの余白を取る。
                 * 段と段の隙間には板が入るが、最後の段のあとには
                 * 隙間が無い。余白を作らないと、そこだけ板が消える。
                 * 1 段しか無いときは、板が 1 枚も出ないことになる。
                 */
                <ul
                    /*
                     * 板を左右に少し伸ばす。
                     *
                     * 背景は枠の幅ぶんしか描かれない。
                     * 本の列とぴったり同じ幅で終わると、
                     * 板が本に切り揃えられて、棚ではなく下線に見える。
                     */
                    className="-mx-3 mt-4 grid justify-center px-3 sm:justify-start"
                    style={{
                        gridTemplateColumns: `repeat(auto-fill, ${BOOK_WIDTH}px)`,
                        gridAutoRows: `${BOOK_HEIGHT}px`,
                        columnGap: `${BOOK_GAP}px`,
                        rowGap: `${SHELF_THICKNESS + SHELF_GAP}px`,
                        // 板の下へ落ちる影のぶん、最後の段のあとを広めに取る
                        paddingBottom: `${SHELF_THICKNESS + 8}px`,
                        /*
                         * 面ごとの色。
                         *
                         *   上面   光の線 1px → 明るい木（#efd19b→#d7a665）
                         *   前面   細いハイライト 1px →
                         *          明 #d8ae70 → 中間 #c58f4f(35%)
                         *          → 暗 #a96f35(75%) → 最暗 #8b5728
                         *          → 締めの線 #74451f 1px
                         *   下面   #805026 から透明へ
                         *   影     さらに下へ淡くにじませる
                         *
                         * 段ごとの要素に ::before/::after で面を付ける代わりに、
                         * 同じ構造を繰り返し背景の色の段で描いている。
                         * 段の折り返しが画面幅で変わるため、要素は置けない。
                         */
                        background: `repeating-linear-gradient(
                            to bottom,
                            transparent 0px,
                            transparent ${BOOK_HEIGHT}px,
                            rgba(255, 255, 255, 0.8) ${BOOK_HEIGHT}px,
                            rgba(255, 255, 255, 0.8) ${BOOK_HEIGHT + 1}px,
                            #efd19b ${BOOK_HEIGHT + 1}px,
                            #d7a665 ${BOOK_HEIGHT + SHELF_TOP}px,
                            rgba(255, 255, 255, 0.7) ${BOOK_HEIGHT + SHELF_TOP}px,
                            rgba(255, 255, 255, 0.7) ${BOOK_HEIGHT + SHELF_TOP + 1}px,
                            #d8ae70 ${BOOK_HEIGHT + SHELF_TOP + 1}px,
                            #c58f4f ${Math.round(BOOK_HEIGHT + SHELF_TOP + 1 + (SHELF_FRONT - 2) * 0.35)}px,
                            #a96f35 ${Math.round(BOOK_HEIGHT + SHELF_TOP + 1 + (SHELF_FRONT - 2) * 0.75)}px,
                            #8b5728 ${BOOK_HEIGHT + SHELF_TOP + SHELF_FRONT - 1}px,
                            #74451f ${BOOK_HEIGHT + SHELF_TOP + SHELF_FRONT - 1}px,
                            #74451f ${BOOK_HEIGHT + SHELF_TOP + SHELF_FRONT}px,
                            #805026 ${BOOK_HEIGHT + SHELF_TOP + SHELF_FRONT}px,
                            rgba(75, 42, 20, 0.15) ${BOOK_HEIGHT + SHELF_THICKNESS}px,
                            rgba(50, 30, 15, 0.14) ${BOOK_HEIGHT + SHELF_THICKNESS}px,
                            rgba(50, 30, 15, 0) ${BOOK_HEIGHT + SHELF_THICKNESS + 8}px,
                            transparent ${BOOK_HEIGHT + SHELF_THICKNESS + 8}px,
                            transparent ${BOOK_HEIGHT + SHELF_THICKNESS + SHELF_GAP}px
                        )`,
                    }}
                >
                    {shown.map((work) => (
                        <Tile
                            key={work.id}
                            work={work}
                            episodes={episodesOf(work.id)}
                            onDelete={() => void onDelete(work)}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * 一覧の 1 行。
 *
 * 進み具合（完成した話 ÷ 全話数）は出さない。
 * 話ごとのステータスを付けていない人には常に 0% と出てしまい、
 * 書いているのに進んでいないように見える。
 * 目盛りとして働かない数字は、無いほうがいい。
 */
/**
 * 棚に挿さった本 1 冊。
 *
 * 表紙は淡い紙色。題名を上に、下に状態と更新日を置く。
 * 中央には題名から選んだ小さな印を打つ。
 * 12 冊並ぶと題名だけでは似て見えるので、
 * 形の違うものを 1 つ入れて目印にする。
 *
 * 表紙の画像はまだ持っていないので、題名から色と印を決める。
 * 同じ作品はいつも同じ表紙になるので、置き場所を覚えられる。
 * cover_url が入ったら、この背景だけ差し替えれば済む。
 */
function Tile({
    work,
    episodes,
    onDelete,
}: {
    work: WorkWithStats;
    episodes: Episode[];
    onDelete: () => void;
}) {
    const state = stateOf(work);
    const chip = STATE_STYLE[state];

    const hash = hashOf(work.title || work.id);
    const cover = COVERS[hash % COVERS.length];

    const updated = work.updated_at.slice(0, 10).replace(/-/g, "/");
    const amount =
        episodes.length > 0
            ? `全${episodes.length}話`
            : `${formatNumber(work.total_char_count)}字`;

    return (
        <li className="group relative" style={{ height: BOOK_HEIGHT }}>
            {/*
             * 板に落ちる影。
             *
             * 本そのものの影は縁を締めるためのもので、
             * 下へはあまり伸びない。
             * 足元に一枚敷いて、板に載っているように見せる。
             *
             * 本より少し狭く、下へはみ出させる。
             * 幅を揃えると、影ではなく台座に見える。
             */}
            {/*
             * 接地の影。
             * 光は左上からなので、左を広く右を狭く敷く。
             * ぼかして、本の底が板に触れている感じを出す。
             */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-1 left-[8%] right-[4%] h-[5px] transition-opacity group-hover:opacity-60"
                style={{
                    background: "rgba(70, 45, 25, 0.16)",
                    filter: "blur(3px)",
                }}
            />

            <Link
                href={`/workspace/${work.id}`}
                title={`${work.title || "無題"}　${chip.label}　${amount}　更新 ${updated}`}
                className="block h-full"
            >
                <span
                    className="relative block h-full transition-transform duration-200 group-hover:-translate-y-1"
                    // 本そのものの影。左上からの光に合わせて右下へ落とす
                    style={{
                        filter: "drop-shadow(3px 3px 2px rgba(40, 35, 25, 0.12))",
                    }}
                >
                    {/*
                     * 小口（紙の束）。
                     *
                     * 表紙の右にわずかに覗かせる。
                     * これが無いと、色板が立っているだけに見える。
                     * 束ねた紙が見えて、はじめて本の厚みになる。
                     *
                     * 上下を 2px 詰めているのは、表紙が紙より
                     * わずかに大きいから。実物の本と同じ関係にする。
                     */}
                    <span
                        className="absolute bottom-[2px] right-0 top-[2px] rounded-r-[3px]"
                        style={{
                            width: BOOK.edge,
                            background:
                                "repeating-linear-gradient(90deg, #ebe4d5 0 1px, #f8f4ec 1px 2px)",
                            boxShadow: "inset -1px 0 0 rgba(0,0,0,0.10)",
                        }}
                    />

                    {/* 表紙 */}
                    <span
                        className="absolute inset-y-0 left-0 overflow-hidden rounded-l-[2px] rounded-r-[4px]"
                        style={{
                            right: BOOK.edge - 2,
                            background: cover.base,
                            /*
                             * 影は 2 枚。
                             * 縁の細い線で形を締め、下に落ちる影で棚に載せる。
                             * 1 枚で済ませると、濃くすれば汚れ、薄くすれば浮く。
                             */
                            // 落ちる影は本全体の drop-shadow に譲った。ここは縁の線だけ
                            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07)",
                        }}
                    >
                        {/*
                         * 背表紙側の陰。
                         * 綴じてある側は光が回らず、必ず暗くなる。
                         */}
                        <span
                            className="absolute inset-y-0 left-0"
                            style={{
                                width: BOOK.spine,
                                background:
                                    "linear-gradient(90deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.05) 60%, rgba(255,255,255,0.30) 100%)",
                            }}
                        />

                        {/* 表紙の丸み。上を明るく、下をわずかに落とす */}
                        <span
                            className="absolute inset-0"
                            style={{
                                background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.06) 100%)",
                            }}
                        />

                        {/* 題名 */}
                        <span
                            className="absolute left-0 right-0 px-3"
                            style={{
                                top: Math.round(BOOK_HEIGHT * 0.22),
                                paddingLeft: BOOK.spine + 10,
                            }}
                        >
                            <span
                                className="line-clamp-2 block text-center font-serif leading-[1.5] tracking-[0.04em]"
                                style={{ fontSize: BOOK.title, color: cover.ink }}
                            >
                                {work.title || "無題"}
                            </span>
                        </span>

                        {/*
                         * 状態と更新日。
                         * 読ませるためではなく、棚を眺めたときに
                         * 新しい本がどれか分かればよい。
                         */}
                        <span
                            className="absolute bottom-2.5 left-0 right-8"
                            style={{ paddingLeft: BOOK.spine + 8 }}
                        >
                            <span
                                className="block text-[9px] leading-[1.6] opacity-70"
                                style={{ color: cover.ink }}
                            >
                                {chip.label}
                            </span>
                            <span
                                className="block text-[9px] leading-[1.6] tabular-nums opacity-55"
                                style={{ color: cover.ink }}
                            >
                                更新日 {updated}
                            </span>
                        </span>
                    </span>
                </span>
            </Link>

            <div className="absolute bottom-2 right-3 opacity-45 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <RowMenu work={work} onDelete={onDelete} tone={cover.ink} />
            </div>
        </li>
    );
}

/**
 * 表紙に打つ印。
 *
 * 意味は持たせない。題名から機械的に選ぶだけ。
 * 内容と合っていなくても、置き場所の目印にはなる。
 */
/**
 * 題名から数を作る。同じ題名なら必ず同じ数になる。
 * 表紙の色と印を選ぶのに使う。
 */
export function hashOf(text: string): number {
    let value = 0;
    for (let index = 0; index < text.length; index += 1) {
        value = (value * 131 + text.charCodeAt(index)) % 100003;
    }
    return value;
}

/**
 * 「⋮」。
 *
 * 削除はこの中で確かめてから実行する。
 * window.confirm は画面から目が離れるので使わない。
 */
function RowMenu({
    work,
    onDelete,
    tone,
}: {
    work: WorkWithStats;
    onDelete: () => void;
    /**
     * 表紙の上に重ねるときの字の色。
     * 表紙は淡いものも濃いものもあるので、
     * どちらでも読めるよう表紙側の字と同じ色をもらう。
     */
    tone?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        function handleOutside(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
                setIsConfirming(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [isOpen]);

    return (
        <div ref={rootRef} className="relative inline-block">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label={`${work.title || "無題"}の操作`}
                aria-expanded={isOpen}
                style={tone ? { color: tone } : undefined}
                className={[
                    "flex items-center justify-center rounded-md",
                    tone
                        ? "h-6 w-6 opacity-60 hover:bg-black/10 hover:opacity-100"
                        : "h-7 w-7 text-faint hover:bg-surface hover:text-ink",
                ].join(" ")}
            >
                <DotsIcon small={Boolean(tone)} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 text-left shadow-lg">
                    {isConfirming ? (
                        <div className="px-3 py-2.5">
                            <p className="text-[12px] leading-relaxed text-ink">
                                「{work.title || "無題"}」を削除しますか。
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted">
                                中のすべての話と資料も消えます。元に戻せません。
                            </p>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsConfirming(false);
                                        onDelete();
                                    }}
                                    className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
                                >
                                    削除する
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsConfirming(false)}
                                    className="rounded-md border border-line px-3 py-1.5 text-[11px] text-muted hover:text-ink"
                                >
                                    やめる
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <MenuLink href={`/workspace/${work.id}`}>執筆室を開く</MenuLink>
                            <MenuLink href={`/workspace/${work.id}/resource`}>
                                資料を開く
                            </MenuLink>
                            <MenuLink href={`/workspace/${work.id}/settings`}>
                                設定
                            </MenuLink>
                            <button
                                type="button"
                                onClick={() => setIsConfirming(true)}
                                className="block w-full px-3 py-2 text-left text-[12px] text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                            >
                                削除
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="block px-3 py-2 text-[12px] text-ink hover:bg-canvas">
            {children}
        </Link>
    );
}

/**
 * ============================================================
 * 図案
 * ============================================================
 */

function DotsIcon({ small = false }: { small?: boolean }) {
    const size = small ? 12 : 16;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5.5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="18.5" r="1.6" />
        </svg>
    );
}
