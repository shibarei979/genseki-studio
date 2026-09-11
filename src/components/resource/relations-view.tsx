/**
 * ============================================================
 * 原石航路 Studio
 * RelationsView — 関係図
 *
 * 人物同士に限らない。人物と組織、人物と場所、人物と出来事も結べる。
 * 恋愛の「すれ違い」も、ミステリーの「容疑者」も同じ形で持てる。
 *
 * 関係は 1 つのラベルで固定しない。
 * 「初対面 → 警戒 → 信頼 → 決別」を 1 語で表すことはできないので、
 * 話数に沿った変化を下段の帯に並べる。
 * ============================================================
 */

"use client";

import { useMemo, useState } from "react";

import DeleteButton from "@/components/common/delete-button";
import { pairKey, suggestRelations } from "@/lib/resource/relation-suggest";
import RelationGraph from "@/components/resource/relation-graph";
import ResourceIcon from "@/components/resource/resource-icons";
import type { Episode, ResourceEntry, ResourcePage, ResourceRelation } from "@/types";

const PRESETS = ["家族", "友人", "恋人", "師弟", "所属", "対立", "協力", "容疑者", "片想い"];

interface Props {
    relations: ResourceRelation[];
    entries: ResourceEntry[];
    pages: ResourcePage[];
    episodes: Episode[];
    onCreate: (
        fromId: string,
        toId: string,
        label: string,
        lineStyle: "dashed" | "solid" | "arrow" | null,
    ) => void;
    onUpdate: (relationId: string, patch: Partial<ResourceRelation>) => void;
    onDelete: (relation: ResourceRelation) => void;
    onUpdatePage: (patch: Partial<ResourcePage>) => void;
    /*
     * 図の中で丸を動かしたときに呼ぶ。
     *
     * 置いた場所を覚えないと、離した瞬間に輪へ戻る。
     * 主人公を左、敵を右、という並べ方は作者にしか決められない。
     */
    onMoveNode?: (entryId: string, position: { x: number; y: number }) => void;
}

export default function RelationsView({
    relations,
    entries,
    pages,
    episodes,
    onCreate,
    onUpdate,
    onDelete,
    onUpdatePage,
    onMoveNode,
}: Props) {
    const [mode, setMode] = useState<"graph" | "list">("graph");

    /* 覚えている置き場所を、図が読める形に組み直す */
    const graphLayout = useMemo(() => {
        const map: Record<string, { x: number; y: number }> = {};
        for (const entry of entries) {
            const at = entry.graph_pos;
            if (at && typeof at.x === "number" && typeof at.y === "number") {
                map[entry.id] = { x: at.x, y: at.y };
            }
        }
        return map;
    }, [entries]);
    const [focusId, setFocusId] = useState<string | null>(null);
    const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    /*
     * 同じ段落に何度も並ぶ組を探す。
     * 何の関係かは決めない。そこは書き手が決める。
     */
    const suggestions = useMemo(() => {
        const existing = new Set(
            relations.map((row) => pairKey(row.from_entry_id, row.to_entry_id)),
        );
        for (const key of Array.from(dismissed)) existing.add(key);

        return suggestRelations(
            episodes.map((episode) => episode.body),
            entries.filter((entry) => entry.candidate_status === "none"),
            existing,
            episodes.map((episode) => `第${episode.ep_number}話`),
        );
    }, [relations, entries, episodes, dismissed]);
    /*
     * 関係を結べる項目。
     *
     * ★ 本文から拾った候補は、まだ混ぜない。
     *
     *   「わたし」「だけど」「そして」のような
     *   文の断片が数百並び、選び具が使い物にならなかった。
     *
     *   資料の本体には混ぜない決まりなのに、
     *   ここだけ素通しになっていた。
     *
     * ★ 名前の無いものも出さない。
     *   選んでも、図では「（名前未設定）」になる。
     */
    const pickable = entries.filter(
        (entry) => entry.candidate_status === "none" && entry.name.trim(),
    );

    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [label, setLabel] = useState("");

    /*
     * 結ぶときの線の形。
     *
     * ★ 結んだあとに直させない。
     *
     *   「AはBを慕っている」のような向きのある関係は、
     *   結ぶ時点で分かっている。
     *   あとで選び直させるのは、手数が増えるだけ。
     *
     * ★ 選ばなければ、おまかせ。
     *   変化の記録があれば実線、無ければ破線。
     */
    const [newStyle, setNewStyle] = useState<
        "dashed" | "solid" | "arrow" | null
    >(null);

    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const canCreate = fromId && toId && fromId !== toId && label.trim();

    const selected = relations.find((relation) => relation.id === selectedRelationId) ?? null;
    const from = selected ? entryById.get(selected.from_entry_id) : null;
    const to = selected ? entryById.get(selected.to_entry_id) : null;

    return (
        <div className="space-y-2">
            {/*
              * ★ 見出しと押し具を、同じ行に置く。
              *
              *   見出し・説明・押し具で 3 行使っていた。
              *   その上に頁のタブもあるので、
              *   図が画面の下へ押し出されていた。
              *
              *   説明は外す。名前と図を見れば分かる。
              */}
            <header className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-base font-medium text-ink">
                    <span className="text-forest">
                        <ResourceIcon builtinKey="relation" size={18} />
                    </span>
                    関係図
                </h1>


            </header>

            {entries.length < 2 ? (
                <div className="rounded-lg border border-dashed border-line py-20 text-center">
                    <p className="text-sm text-ink">関係を結ぶには、資料の項目が2つ以上必要です。</p>
                    <p className="mt-1 text-sm text-muted">
                        人物や場所を登録してから戻ってきてください。
                    </p>
                </div>
            ) : (
                <>
                    {/*
                      * 関係を追加。
                      *
                      * ★ 畳んでおく。
                      *
                      *   出しっぱなしだと、選び具と見本の札で
                      *   画面の上半分が埋まり、
                      *   図を見るのに毎回下へ送ることになる。
                      *
                      *   見に来る回数のほうが、結ぶ回数より多い。
                      *   ふだんは図を先に出す。
                      */}
                    {/*
                      * ★ 畳まずに出しておく。
                      *
                      *   一度畳んでみたが、結ぶたびに開くのが手間だった。
                      *   代わりに、中身を 1 行に収める。
                      *   見本の札は、欄に触れたときだけ出す。
                      */}
                    <div className="rounded-lg border border-line bg-surface px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">関係を追加</span>
                            <EntrySelect
                                value={fromId}
                                onChange={setFromId}
                                entries={pickable}
                                pages={pages}
                                label="出発点を選ぶ"
                            />
                            <span className="text-sm text-faint">→</span>
                            <EntrySelect
                                value={toId}
                                onChange={setToId}
                                entries={pickable.filter((entry) => entry.id !== fromId)}
                                pages={pages}
                                label="到達点を選ぶ"
                            />
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="関係ラベルを入力"
                                aria-label="関係の名前"
                                className="w-36 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-forest"
                            />
                            {/*
                              * 線の形。結ぶ前に選ぶ。
                              *
                              * ★ 印だけにする。
                              *   言葉を並べると、1 行に収まらない。
                              */}
                            <div className="flex gap-0.5 rounded-md border border-line p-0.5">
                                {(
                                    [
                                        { key: null, label: "おまかせ", mark: "—" },
                                        { key: "dashed", label: "破線", mark: "╌" },
                                        { key: "solid", label: "実線", mark: "─" },
                                        { key: "arrow", label: "矢印", mark: "→" },
                                    ] as {
                                        key: "dashed" | "solid" | "arrow" | null;
                                        label: string;
                                        mark: string;
                                    }[]
                                ).map((one) => (
                                    <button
                                        key={one.label}
                                        type="button"
                                        onClick={() => setNewStyle(one.key)}
                                        aria-pressed={newStyle === one.key}
                                        title={one.label}
                                        aria-label={`線の形：${one.label}`}
                                        className={[
                                            "rounded px-2 py-1 text-xs",
                                            newStyle === one.key
                                                ? "bg-forest text-white"
                                                : "text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {one.mark}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                disabled={!canCreate}
                                onClick={() => {
                                    onCreate(fromId, toId, label.trim(), newStyle);
                                    setLabel("");
                                }}
                                className="rounded-md bg-forest px-4 py-1.5 text-sm text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                結ぶ
                            </button>

                            <div className="ml-auto flex gap-0.5 rounded-md border border-line p-0.5">
                                {(["graph", "list"] as const).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setMode(key)}
                                        aria-pressed={mode === key}
                                        className={[
                                            "rounded px-3 py-1 text-xs",
                                            mode === key
                                                ? "bg-forest text-white"
                                                : "text-muted hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {key === "graph" ? "図" : "一覧"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ul className="mt-2 flex flex-wrap gap-1.5">
                            {PRESETS.map((preset) => (
                                <li key={preset}>
                                    <button
                                        type="button"
                                        onClick={() => setLabel(preset)}
                                        className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        {preset}
                                    </button>
                                </li>
                            ))}
                        </ul>

                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                        {/*
                          * 図の枠。
                          *
                          * ★ 枠の高さは決め打ち。中を送って見る。
                          *
                          *   図を広げると、前はそのぶん枠ごと
                          *   下へ伸びていた。図の下には凡例や
                          *   説明が続くので、そこまで指を送るのが遠い。
                          *   頁の形も、広さを変えるたびに動く。
                          *
                          *   枠は動かさず、中だけ送る。
                          *
                          * ★ 一覧のときは伸ばす。
                          *   あちらは行が並ぶだけで、
                          *   高さを切ると読みにくくなる。
                          */}
                        <div
                            className={[
                                "rounded-lg border border-line bg-surface p-4",
                                /*
                                 * ★ 枠の側では送らない。
                                 *   送るのは図だけ（RelationGraph の中）。
                                 *   ここで送ると、押し具や凡例まで流れて
                                 *   見えなくなる。
                                 */
                                mode === "graph" ? "overflow-hidden" : "",
                            ].join(" ")}
                            style={
                                mode === "graph"
                                    ? {
                                          /*
                                           * ★ 高さは決め打ち。
                                           *   図はこの中に収まるように縮む。
                                           *   広さを変えても枠は動かない。
                                           *
                                           *   横に長い画面では、正方形の図の
                                           *   左右が空く。そこは空けたままにする。
                                           *   図を横に伸ばすと、丸が歪む。
                                           */
                                          /*
                                           * ★ 高くする。
                                           *   図は枠に収めて描くので、
                                           *   枠が低いほど文字が小さくなる。
                                           *   縦に使える所は、図に回す。
                                           */
                                          /*
                                           * ★ 板を横長にしたので、
                                           *   高さは戻す。横幅を使って描く。
                                           */
                                          /*
                                           * ★ 残りの高さから決める。
                                           *
                                           *   72vh のような決め打ちだと、
                                           *   上の見出しや頁のタブのぶんだけ
                                           *   画面をはみ出す。
                                           *
                                           *   画面の高さから、上に積まれるものを
                                           *   引いた値にする。
                                           *
                                           *   引く量は 150px。
                                           *   頁の見出しと、この頁の見出しぶん。
                                           *   前は 230px 引いていて、
                                           *   下に 3 割ほど余っていた。
                                           *
                                           *   狭い画面でも最低 320px は残す。
                                           */
                                          height:
                                              "clamp(320px, calc(100vh - 150px), 900px)",
                                      }
                                    : undefined
                            }
                        >
                            {mode === "graph" ? (
                                <RelationGraph
                                    /*
                                     * ★ 図にも、候補は出さない。
                                     *   本文から拾った断片が丸になると、
                                     *   図が読めなくなる。
                                     */
                                    entries={pickable}
                                    relations={relations}
                                    selectedId={focusId}
                                    /*
                                     * 覚えている置き場所を渡す。
                                     * 決めていないものは、これまでどおり輪に並ぶ。
                                     */
                                    layout={graphLayout}
                                    onMove={onMoveNode}
                                    /*
                                     * 線の通り道。
                                     * つまんで決めた中間点を、そのまま覚える。
                                     */
                                    onBend={(relationId, bend) =>
                                        onUpdate(relationId, { bend })
                                    }
                                    onSelect={(id) => {
                                        /*
                                         * ★ 何も無いところを押したら、全体に戻す。
                                         *   右の欄も、選ぶ前の姿へ戻す。
                                         */
                                        /*
                                         * ★ 人を押したら、その人の関係を並べる。
                                         *
                                         *   前は最初に見つかった 1 本を
                                         *   勝手に選んでいた。
                                         *   どれが選ばれたのか分からず、
                                         *   直したい関係とは限らない。
                                         *
                                         *   並べて、その中から選んでもらう。
                                         */
                                        setFocusId(id);
                                        setSelectedRelationId(null);
                                    }}
                                />
                            ) : relations.length === 0 ? (
                                <p className="py-16 text-center text-sm text-faint">
                                    まだ関係が登録されていません。
                                </p>
                            ) : (
                                <ul className="divide-y divide-line">
                                    {relations.map((relation) => {
                                        const left = entryById.get(relation.from_entry_id);
                                        const right = entryById.get(relation.to_entry_id);
                                        return (
                                            <li
                                                key={relation.id}
                                                className={[
                                                    "flex items-center gap-2 px-2 py-2",
                                                    relation.id === selectedRelationId
                                                        ? "bg-forest-tint"
                                                        : "hover:bg-canvas",
                                                ].join(" ")}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedRelationId(relation.id)
                                                    }
                                                    className="min-w-0 flex-1 truncate text-left text-sm text-ink"
                                                >
                                                    {left?.name ?? "?"}
                                                </button>

                                                {/*
                                                 * 呼び名はここで直せる。
                                                 * 選び直してから編集欄を探すのでは、
                                                 * 一つ直すのに手数がかかりすぎる。
                                                 */}
                                                <input
                                                    type="text"
                                                    defaultValue={relation.label}
                                                    placeholder="関係"
                                                    aria-label={`${left?.name ?? ""}と${right?.name ?? ""}の関係`}
                                                    onBlur={(e) => {
                                                        const next = e.target.value.trim();
                                                        if (next !== relation.label) {
                                                            onUpdate(relation.id, {
                                                                label: next,
                                                            });
                                                        }
                                                    }}
                                                    className="w-24 shrink-0 rounded border border-transparent bg-forest-tint px-2 py-0.5 text-center text-xs text-forest outline-none hover:border-forest-line focus:border-forest focus:bg-surface"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedRelationId(relation.id)
                                                    }
                                                    className="min-w-0 flex-1 truncate text-right text-sm text-ink"
                                                >
                                                    {right?.name ?? "?"}
                                                </button>

                                                {relation.changes.length > 0 && (
                                                    <span className="shrink-0 text-[10px] text-faint">
                                                        変化{relation.changes.length}
                                                    </span>
                                                )}

                                                <DeleteButton
                                                    label={`${left?.name ?? "?"} — ${right?.name ?? "?"}`}
                                                    onDelete={() => onDelete(relation)}
                                                    size="small"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/*
                          * 選んだ関係。
                          *
                          * ★ 何も選んでいないときは、狭い画面では出さない。
                          *
                          *   横に並べられる画面では、右に置いておけばよい。
                          *   狭い画面では図の下に積まれるので、
                          *   空の枠のぶんだけ画面が伸びる。
                          */}
                        {/*
                          * ★ 右の欄も、図と同じ高さにそろえる。
                          *
                          *   図だけ高さを決めていたので、
                          *   右の欄は中身のぶんだけ下へ伸び、
                          *   頁ごと送ることになっていた。
                          *
                          *   同じ高さに切って、中だけ送る。
                          */}
                        <div
                            className={[
                                "thin-scroll overflow-y-auto rounded-lg border border-line bg-surface p-4",
                                /* 人も関係も選んでいないときだけ、狭い画面では隠す */
                                !selected && !focusId ? "hidden lg:block" : "",
                            ].join(" ")}
                            style={
                                /*
                                 * 図のときだけ、高さを切る。
                                 * 一覧のときは行が並ぶだけなので、
                                 * 切ると読みにくい。
                                 */
                                mode === "graph"
                                    ? {
                                          height:
                                              "clamp(320px, calc(100vh - 150px), 900px)",
                                      }
                                    : undefined
                            }
                        >
                            {!selected || !from || !to ? (
                                focusId ? (
                                    /*
                                      * その人の関係を並べる。
                                      *
                                      * ★ 押した人が、どういう関わりを
                                      *   持っているかを一度に見せる。
                                      *   直したいものを、その中から選ぶ。
                                      */
                                    <FocusRelations
                                        focusId={focusId}
                                        relations={relations}
                                        entryById={entryById}
                                        onPick={setSelectedRelationId}
                                    />
                                ) : (
                                    <p className="py-8 text-center text-xs text-faint">
                                        図や一覧から関係を選ぶと、ここに詳しく出ます。
                                    </p>
                                )
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="min-w-0 truncate text-sm font-medium text-ink">
                                            {from.name} ↔ {to.name}
                                        </h2>
                                        <DeleteButton
                                            label={`${from.name} ↔ ${to.name}`}
                                            onDelete={() => {
                                                onDelete(selected);
                                                setSelectedRelationId(null);
                                            }}
                                            size="small"
                                        />
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-faint">
                                        {pageById.get(from.page_id)?.label} ／{" "}
                                        {pageById.get(to.page_id)?.label}
                                    </p>

                                    <div className="mt-3">
                                        <p className="text-xs text-muted">現在の関係</p>
                                        <input
                                            type="text"
                                            defaultValue={selected.label}
                                            onBlur={(e) =>
                                                onUpdate(selected.id, { label: e.target.value })
                                            }
                                            aria-label="関係の名前"
                                            className="mt-1 w-full rounded-md border border-line bg-forest-tint px-2 py-1.5 text-sm text-forest outline-none focus:border-forest"
                                        />

                                        {/*
                                          * 線の形。
                                          *
                                          * ★ 矢印は、片側だけの関係に使う。
                                          *   「AはBを慕っている」のように、
                                          *   向きのある間柄を表せる。
                                          *
                                          * ★ 決めていなければ、これまでどおり
                                          *   変化の記録があれば実線、無ければ破線。
                                          */}
                                        <div className="mt-2.5">
                                            <p className="text-xs text-muted">線の形</p>

                                            <div className="mt-1 flex gap-1">
                                                {(
                                                    [
                                                        { key: null, label: "おまかせ" },
                                                        { key: "dashed", label: "破線" },
                                                        { key: "solid", label: "実線" },
                                                        { key: "arrow", label: "矢印" },
                                                    ] as {
                                                        key:
                                                            | "dashed"
                                                            | "solid"
                                                            | "arrow"
                                                            | null;
                                                        label: string;
                                                    }[]
                                                ).map((one) => (
                                                    <button
                                                        key={one.label}
                                                        type="button"
                                                        onClick={() =>
                                                            onUpdate(selected.id, {
                                                                line_style: one.key,
                                                            })
                                                        }
                                                        aria-pressed={
                                                            (selected.line_style ?? null) ===
                                                            one.key
                                                        }
                                                        className={[
                                                            "flex-1 rounded border px-1.5 py-1 text-[10.5px]",
                                                            (selected.line_style ?? null) ===
                                                            one.key
                                                                ? "border-forest bg-forest-tint text-forest"
                                                                : "border-line text-muted hover:border-forest-line",
                                                        ].join(" ")}
                                                    >
                                                        {one.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <p className="mt-1 text-[10px] leading-relaxed text-faint">
                                                矢印は、出発点から到達点への向きで出ます。
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-xs text-muted">メモ</p>
                                        <textarea
                                            defaultValue={selected.note}
                                            onBlur={(e) =>
                                                onUpdate(selected.id, { note: e.target.value })
                                            }
                                            rows={4}
                                            placeholder="どんな関係か、どう変わってきたか"
                                            aria-label="関係のメモ"
                                            className="mt-1 w-full resize-y rounded-md border border-line px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-forest"
                                        />
                                    </div>

                                    <ChangeEditor
                                        relation={selected}
                                        onUpdate={(patch) => onUpdate(selected.id, patch)}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* 関係の履歴 */}
                    {selected && selected.changes.length > 0 && (
                        <div className="rounded-lg border border-line bg-surface px-5 py-4">
                            <p className="text-sm text-ink">関係の履歴</p>
                            <ol className="mt-3 flex flex-wrap items-center gap-2">
                                {selected.changes.map((change, index) => (
                                    <li key={index} className="flex items-center gap-2">
                                        <span className="rounded-full border border-forest-line bg-forest-tint px-3 py-1 text-xs text-forest">
                                            {change.label}
                                        </span>
                                        <span className="text-[10px] text-faint">
                                            {change.at || "—"}
                                        </span>
                                        {index < selected.changes.length - 1 && (
                                            <span className="text-faint">→</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ChangeEditor({
    relation,
    onUpdate,
}: {
    relation: ResourceRelation;
    onUpdate: (patch: Partial<ResourceRelation>) => void;
}) {
    const [at, setAt] = useState("");
    const [label, setLabel] = useState("");

    /*
     * 結ぶときの線の形。
     *
     * ★ 結んだあとに直させない。
     *
     *   「AはBを慕っている」のような向きのある関係は、
     *   結ぶ時点で分かっている。
     *   あとで選び直させるのは、手数が増えるだけ。
     *
     * ★ 選ばなければ、おまかせ。
     *   変化の記録があれば実線、無ければ破線。
     */
    const [newStyle, setNewStyle] = useState<
        "dashed" | "solid" | "arrow" | null
    >(null);

    function add() {
        if (!label.trim()) return;
        onUpdate({
            changes: [...relation.changes, { at: at.trim(), label: label.trim() }],
        });
        setAt("");
        setLabel("");
    }

    return (
        <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs text-muted">関係の変化</p>
            <p className="mt-0.5 text-[10px] text-faint">
                1つのラベルで固定せず、話が進むにつれての変化を残せます。
            </p>

            {relation.changes.length > 0 && (
                <ol className="mt-2 space-y-1">
                    {relation.changes.map((change, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                            <span className="text-forest">{change.at || "—"}</span>
                            <span className="min-w-0 flex-1 truncate text-ink">
                                {change.label}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    onUpdate({
                                        changes: relation.changes.filter((_, i) => i !== index),
                                    })
                                }
                                aria-label="この変化を削除"
                                className="text-faint hover:text-ink"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ol>
            )}

            <div className="mt-2 flex gap-1.5">
                <input
                    type="text"
                    value={at}
                    onChange={(e) => setAt(e.target.value)}
                    placeholder="第5話"
                    aria-label="いつ"
                    className="w-20 rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                />
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="すれ違い、和解 …"
                    aria-label="関係の変化"
                    className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-[11px] outline-none focus:border-forest"
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!label.trim()}
                    className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-forest-line hover:text-forest disabled:opacity-40"
                >
                    足す
                </button>
            </div>
        </div>
    );
}

/**
 * 関係を結ぶ相手を選ぶ。
 *
 * ★ 種類ごとに分けて出す。
 *
 *   人物・場所・組織・出来事が混ざったまま並ぶと、
 *   数十個の中から目で探すことになる。
 *   「人物」の中を見ればよい、と分かるだけで早い。
 *
 * ★ 名前の順に並べる。
 *   作った順だと、あとから足した人が末尾に付く。
 *   探すときは名前で探す。
 */
/**
 * 関係を結ぶ相手を選ぶ。
 *
 * ★ 打って探せるようにする。
 *
 *   項目が数百あると、選び具を開いて目で探すのは無理。
 *   一文字打てば、その字を含むものだけが残る。
 *
 * ★ 種類も出す。
 *
 *   同じ名前が人物と場所の両方にあることがある。
 *   どちらを選んでいるのか、名前だけでは分からない。
 *
 * ★ 選んだあとは、名前だけを出す。
 *   選び終えた欄に一覧が残っていると、邪魔になる。
 */
function EntrySelect({
    value,
    onChange,
    entries,
    pages,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    entries: ResourceEntry[];
    pages: ResourcePage[];
    label: string;
}) {
    const [text, setText] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const pageById = new Map(pages.map((page) => [page.id, page]));
    const picked = entries.find((entry) => entry.id === value) ?? null;

    /*
     * 打った字で絞る。
     *
     * ★ 名前と別名の両方を見る。
     *   「律」で探して「律さん」が出ないと、探した気がしない。
     *
     * ★ 出すのは 40 件まで。
     *   それ以上並べても目で追えない。もう少し打ってもらう。
     */
    const found = (() => {
        const word = text.trim();
        const rows = word
            ? entries.filter(
                  (entry) =>
                      entry.name.includes(word) ||
                      entry.aliases.some((alias) => alias.includes(word)),
              )
            : entries;

        /*
         * ★ 人物を先に出す。
         *
         *   関係を結ぶ相手は、たいてい人。
         *   場所や出来事に混ざって五十音順に並ぶと、
         *   目当ての人が下のほうに沈む。
         *
         *   同じ種類の中では、名前の順。
         */
        function rank(entry: ResourceEntry) {
            const page = pageById.get(entry.page_id);
            if (page?.builtin_key === "character") return 0;
            return 1;
        }

        return rows
            .slice()
            .sort((a, b) => {
                const gap = rank(a) - rank(b);
                if (gap !== 0) return gap;
                return a.name.localeCompare(b.name, "ja");
            })
            .slice(0, 40);
    })();

    if (picked && !isOpen) {
        return (
            <button
                type="button"
                onClick={() => {
                    setIsOpen(true);
                    setText("");
                }}
                className="rounded-md border border-forest-line bg-forest-tint px-3 py-1.5 text-sm text-forest"
            >
                {picked.name}
            </button>
        );
    }

    return (
        <div className="relative">
            <input
                type="text"
                value={text}
                autoFocus={isOpen}
                onChange={(e) => {
                    setText(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={label}
                aria-label={label}
                className="w-40 rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-forest"
            />

            {isOpen && (
                <>
                    {/* 外を押したら閉じる */}
                    <button
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-10 cursor-default"
                    />

                    <ul className="thin-scroll absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
                        {found.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-faint">
                                見つかりません
                            </li>
                        ) : (
                            found.map((entry) => (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(entry.id);
                                            setIsOpen(false);
                                            setText("");
                                        }}
                                        className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-forest-tint"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                            {entry.name}
                                        </span>
                                        <span className="shrink-0 text-[10px] text-faint">
                                            {pageById.get(entry.page_id)?.label ?? ""}
                                        </span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </>
            )}
        </div>
    );
}

/**
 * ============================================================
 * FocusRelations — その人の関係を並べる
 *
 * ★ 人を押したとき、どの関係を直したいかは分からない。
 *
 *   前は最初に見つかった 1 本を勝手に選んでいた。
 *   選ばれた覚えがないものが右に出て、
 *   直したい関係へ辿り着けなかった。
 *
 *   その人が持つ関わりを、全部並べる。
 *   そこから選んでもらう。
 *
 * ★ 相手の名前を大きく出す。
 *
 *   探しているのは「誰との関係か」。
 *   関係の名前より、相手の名前で探す。
 * ============================================================
 */
function FocusRelations({
    focusId,
    relations,
    entryById,
    onPick,
}: {
    focusId: string;
    relations: ResourceRelation[];
    entryById: Map<string, ResourceEntry>;
    onPick: (relationId: string) => void;
}) {
    const own = relations.filter(
        (relation) =>
            relation.from_entry_id === focusId ||
            relation.to_entry_id === focusId,
    );

    const me = entryById.get(focusId);

    if (own.length === 0) {
        return (
            <div className="py-8 text-center">
                <p className="text-xs text-ink">
                    {me?.name ?? "この項目"}には、まだ関係がありません。
                </p>
                <p className="mt-1 text-[11px] text-faint">
                    上の「関係を追加」から結べます。
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className="text-sm font-medium text-ink">{me?.name ?? ""}</p>
            <p className="mt-0.5 text-[11px] text-faint">
                {own.length}件の関わり。直したいものを選んでください。
            </p>

            <ul className="mt-2 divide-y divide-line">
                {own.map((relation) => {
                    const isFrom = relation.from_entry_id === focusId;
                    const other = entryById.get(
                        isFrom ? relation.to_entry_id : relation.from_entry_id,
                    );

                    return (
                        <li key={relation.id}>
                            <button
                                type="button"
                                onClick={() => onPick(relation.id)}
                                className="flex w-full items-center gap-2 py-2 text-left hover:bg-forest-tint"
                            >
                                {/*
                                  * 向き。矢印の線のときは、どちら向きかが要る。
                                  * それ以外は「—」で、向きが無いことを示す。
                                  */}
                                <span className="shrink-0 text-[11px] text-faint">
                                    {relation.line_style === "arrow"
                                        ? isFrom
                                            ? "→"
                                            : "←"
                                        : "—"}
                                </span>

                                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                    {other?.name ?? "?"}
                                </span>

                                <span className="shrink-0 rounded bg-forest-tint px-2 py-0.5 text-[10.5px] text-forest">
                                    {relation.label || "（名前なし）"}
                                </span>

                                {relation.changes.length > 0 && (
                                    <span className="shrink-0 text-[10px] text-faint">
                                        変化{relation.changes.length}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
