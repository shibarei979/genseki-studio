/**
 * ============================================================
 * 原石航路 Studio
 * RelationGraph — 関係を図にする
 *
 * 物理演算は使わない。円周上に決まった順で並べる。
 * 開くたびに配置が変わると、前に見たときの記憶が使えなくなる。
 * 項目の並び順が同じなら、図もいつも同じ形になる。
 * ============================================================
 */

"use client";

import { useRef, useState } from "react";

import type { ResourceEntry, ResourceRelation } from "@/types";

interface Props {
    entries: ResourceEntry[];
    relations: ResourceRelation[];
    onSelect: (entryId: string | null) => void;
    selectedId: string | null;
    /**
     * 置いた場所。項目の id から座標を引く。
     * 覚えていないと、開き直すたびに円周へ戻ってしまう。
     */
    layout?: Record<string, { x: number; y: number }>;
    onMove?: (entryId: string, position: { x: number; y: number }) => void;
    /** 置いた場所を捨てて、円周の並びに戻す */
    onReset?: () => void;
}

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 142;
/*
 * 丸の大きさ。
 * 頭文字が読める大きさにする。小さいと点にしか見えない。
 */
const NODE_RADIUS = 21;

/** 関係の名前から線の色を決める。同じ名前なら同じ色になる */
const RELATION_COLORS = [
    "#2f6b3d", "#3a5a7d", "#7d4a3a", "#5a4a7d",
    "#7d6b3a", "#3a7d75", "#6b3a5a", "#4a5a3a",
];

function colorOf(label: string): string {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) | 0;
    return RELATION_COLORS[Math.abs(hash) % RELATION_COLORS.length];
}

interface Dragging {
    id: string;
    position: { x: number; y: number };
    /** 押した場所と丸の中心のずれ。掴んだ位置を保ったまま動かすため */
    offset: { x: number; y: number };
    moved: boolean;
}

export default function RelationGraph({
    entries,
    relations,
    onSelect,
    selectedId,
    layout = {},
    onMove,
    onReset,
}: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<Dragging | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // 関係を持っているものだけを図に出す。
    // 孤立した点が並ぶと、図から関係が読み取りにくくなる
    const connectedIds = new Set<string>();
    for (const relation of relations) {
        connectedIds.add(relation.from_entry_id);
        connectedIds.add(relation.to_entry_id);
    }
    const nodes = entries.filter((entry) => connectedIds.has(entry.id));

    if (nodes.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-line">
                <p className="text-sm text-faint">
                    関係を結ぶと、ここに図が出ます。
                </p>
            </div>
        );
    }

    /*
     * 置いた場所があればそれを使い、無ければ円周に並べる。
     * 一度動かしたものは覚えておく。
     * 開き直すたびに並び直ると、作った図が意味を持たない。
     */
    const positions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, index) => {
        const saved = dragging?.id === node.id ? dragging.position : layout[node.id];
        if (saved) {
            positions.set(node.id, saved);
            return;
        }
        // 上から時計回りに並べる
        const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
        positions.set(node.id, {
            x: CENTER + Math.cos(angle) * RADIUS,
            y: CENTER + Math.sin(angle) * RADIUS,
        });
    });

    /** 図の外へ出さない。掴んだまま端を越えると見失う */
    function clampToBoard(point: { x: number; y: number }) {
        const margin = NODE_RADIUS + 4;
        return {
            x: Math.min(SIZE - margin, Math.max(margin, point.x)),
            y: Math.min(SIZE - margin, Math.max(margin, point.y)),
        };
    }

    /** 図の中の座標に直す。画面の大きさが変わっても合うように */
    function toGraphPoint(event: { clientX: number; clientY: number }) {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * SIZE,
            y: ((event.clientY - rect.top) / rect.height) * SIZE,
        };
    }

    const active = hoveredId ?? selectedId;
    const labels = Array.from(new Set(relations.map((relation) => relation.label)));

    return (
        <div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className={[
                    "mx-auto block w-full max-w-[460px]",
                    dragging ? "cursor-grabbing" : "",
                ].join(" ")}
                role="img"
                aria-label="関係図"
                onPointerMove={(event) => {
                    if (!dragging) return;
                    const point = toGraphPoint(event);
                    if (!point) return;
                    setDragging({
                        ...dragging,
                        moved: true,
                        position: clampToBoard({
                            x: point.x - dragging.offset.x,
                            y: point.y - dragging.offset.y,
                        }),
                    });
                }}
                onPointerUp={() => {
                    if (!dragging) return;
                    // 動かさずに離したときは、選んだものとして扱う
                    if (dragging.moved) onMove?.(dragging.id, dragging.position);
                    else onSelect(selectedId === dragging.id ? null : dragging.id);
                    setDragging(null);
                }}
                onPointerLeave={() => {
                    if (dragging?.moved) onMove?.(dragging.id, dragging.position);
                    setDragging(null);
                }}
            >
                {/*
                 * 丸に落とす影。
                 * 板の上に置かれているように見せる。
                 */}
                <defs>
                    <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow
                            dx="0"
                            dy="2"
                            stdDeviation="3"
                            floodColor="#1f4e6b"
                            floodOpacity="0.14"
                        />
                    </filter>
                </defs>

                {relations.map((relation) => {
                    const from = positions.get(relation.from_entry_id);
                    const to = positions.get(relation.to_entry_id);
                    if (!from || !to) return null;

                    const isActive =
                        !active ||
                        relation.from_entry_id === active ||
                        relation.to_entry_id === active;

                    // 中心へ少し引き寄せて曲げる。直線だけだと線が重なって読めない
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    const controlX = midX + (CENTER - midX) * 0.35;
                    const controlY = midY + (CENTER - midY) * 0.35;

                    return (
                        <g key={relation.id} opacity={isActive ? 1 : 0.15}>
                            <path
                                d={`M${from.x} ${from.y} Q${controlX} ${controlY} ${to.x} ${to.y}`}
                                fill="none"
                                stroke={colorOf(relation.label)}
                                strokeWidth={relation.changes.length > 0 ? 2.4 : 1.6}
                                strokeDasharray={relation.changes.length > 0 ? "0" : "7 6"}
                            />
                            {/*
                             * 関係の名前。
                             *
                             * 白い札で囲む。
                             * 線の上に直に置くと、線が字を横切って読めない。
                             */}
                            {relation.label && (
                                <>
                                    <rect
                                        x={controlX - relation.label.length * 4.5 - 5}
                                        y={controlY - 9}
                                        width={relation.label.length * 9 + 10}
                                        height={18}
                                        rx={5}
                                        fill="var(--color-surface)"
                                        stroke="var(--color-line)"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={controlX}
                                        y={controlY + 3.5}
                                        textAnchor="middle"
                                        fontSize="9.5"
                                        fill={colorOf(relation.label)}
                                    >
                                        {relation.label}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}

                {nodes.map((node) => {
                    const position = positions.get(node.id);
                    if (!position) return null;
                    const isActive = !active || node.id === active;

                    return (
                        <g
                            key={node.id}
                            opacity={isActive ? 1 : 0.3}
                            onMouseEnter={() => setHoveredId(node.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onPointerDown={(event) => {
                                if (!onMove) {
                                    onSelect(node.id === selectedId ? null : node.id);
                                    return;
                                }
                                event.preventDefault();
                                const point = toGraphPoint(event);
                                if (!point) return;
                                setDragging({
                                    id: node.id,
                                    position,
                                    offset: {
                                        x: point.x - position.x,
                                        y: point.y - position.y,
                                    },
                                    moved: false,
                                });
                            }}
                            className={onMove ? "cursor-grab" : "cursor-pointer"}
                        >
                            {node.image_url ? (
                                <>
                                    <clipPath id={`clip-${node.id}`}>
                                        <circle
                                            cx={position.x}
                                            cy={position.y}
                                            r={NODE_RADIUS}
                                        />
                                    </clipPath>
                                    <image
                                        href={node.image_url}
                                        x={position.x - NODE_RADIUS}
                                        y={position.y - NODE_RADIUS}
                                        width={NODE_RADIUS * 2}
                                        height={NODE_RADIUS * 2}
                                        clipPath={`url(#clip-${node.id})`}
                                    />
                                </>
                            ) : (
                                <circle
                                    cx={position.x}
                                    cy={position.y}
                                    r={NODE_RADIUS}
                                    fill="var(--color-forest-tint)"
                                    filter="url(#node-shadow)"
                                />
                            )}

                            <circle
                                cx={position.x}
                                cy={position.y}
                                r={NODE_RADIUS}
                                fill="none"
                                stroke={
                                    node.id === selectedId
                                        ? "var(--color-forest)"
                                        : "transparent"
                                }
                                strokeWidth={node.id === selectedId ? 2.5 : 0}
                            />

                            {!node.image_url && (
                                <text
                                    x={position.x}
                                    y={position.y + 5}
                                    textAnchor="middle"
                                    fontSize="14"
                                    fontWeight="500"
                                    fill="var(--color-forest)"
                                >
                                    {Array.from(node.name)[0] ?? "?"}
                                </text>
                            )}

                            <text
                                x={position.x}
                                y={position.y + NODE_RADIUS + 14}
                                textAnchor="middle"
                                fontSize="10"
                                fill="var(--color-ink)"
                            >
                                {node.name.length > 6
                                    ? `${node.name.slice(0, 6)}…`
                                    : node.name}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {onMove && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-faint">
                        丸をつまむと動かせます。置いた場所は覚えられます。
                    </p>
                    {Object.keys(layout).length > 0 && (
                        <button
                            type="button"
                            onClick={() => onReset?.()}
                            className="shrink-0 text-[11px] text-forest hover:underline"
                        >
                            並びを戻す
                        </button>
                    )}
                </div>
            )}

            {/*
             * 凡例。
             * 破線で見せる。図の中の線と形を揃えないと、
             * どれがどれか分からない。
             */}
            <ul className="mt-4 flex flex-wrap justify-center gap-5">
                {labels.map((label) => (
                    <li
                        key={label}
                        className="flex items-center gap-2 text-xs text-muted"
                    >
                        <svg width="28" height="6" aria-hidden="true">
                            <line
                                x1="0"
                                y1="3"
                                x2="28"
                                y2="3"
                                stroke={colorOf(label)}
                                strokeWidth="2.4"
                                strokeDasharray="7 6"
                                strokeLinecap="round"
                            />
                        </svg>
                        {label}
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-center text-xs text-faint">
                実線は変化を記録した関係、破線はまだ記録がない関係です。
            </p>
        </div>
    );
}
