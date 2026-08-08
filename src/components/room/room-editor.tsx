/**
 * ============================================================
 * 原石航路 Studio
 * RoomEditor — 部屋を作る
 *
 * 右の道具箱から選び、床を押して置く。
 * 置いたものを押すと選ばれ、向きを変えたり外したりできる。
 *
 * 置ける・置けないは、置く前に見せる。
 * 押してから断られると、どこなら置けるのか分からない。
 * ============================================================
 */

"use client";

import { useEffect, useRef, useState } from "react";

import FurnitureSprite from "@/components/room/furniture-sprite";
import RoomCanvas, {
    FLOOR_LEFT,
    FLOOR_TOP,
    WALL_ROWS,
} from "@/components/room/room-canvas";
import type { FurnitureCategory, FurnitureDef } from "@/lib/room/furniture-catalog";
import {
    blockingSizeOf,
    CATEGORY_LABEL,
    findFurniture,
    FURNITURE,
    sizeOf,
} from "@/lib/room/furniture-catalog";
import { FLOORS, ROOM_THEMES, WALLS } from "@/lib/room/surfaces";
import type { Facing, PlacedFurniture, RoomLayout } from "@/types/room-layout";
import {
    doorClearance,
    FACING_ORDER,
    ROOM_COLS,
    maxDoorOffset,
    ROOM_ROWS,
    TILE_SIZE,
    WALL_THICKNESS,
} from "@/types/room-layout";

type Tab = "theme" | "furniture" | "surface";

interface Props {
    layout: RoomLayout;
    onChange: (layout: RoomLayout) => void;
}

export default function RoomEditor({ layout, onChange }: Props) {
    const [tab, setTab] = useState<Tab>("furniture");
    const [category, setCategory] = useState<FurnitureCategory>("desk");
    /** 道具箱で選んでいるもの。押した床に置かれる */
    const [holding, setHolding] = useState<FurnitureDef | null>(null);
    const [holdingFacing, setHoldingFacing] = useState<Facing>("down");
    /** 部屋に置いてあるもののうち、選んでいるもの */
    const [selectedId, setSelectedId] = useState<string | null>(null);
    /** 今どのマスの上にいるか。置ける・置けないを先に見せる */
    const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
    /**
     * 長押しで掴んだもの。
     * 掴んでいるあいだは、押した場所へ動かす。
     * 一度外して置き直すより、そのまま動かせるほうが早い。
     */
    const [dragging, setDragging] = useState<string | null>(null);
    const pressTimer = useRef<number | null>(null);

    /*
     * 間取りが空のことがある。
     * 保存先から来た部屋は、家具の並びを持たずに返ることがある。
     */
    const furniture = layout.furniture ?? [];
    const selected = furniture.find((row) => row.id === selectedId) ?? null;
    const selectedDef = selected ? findFurniture(selected.catalog_id) : null;

    function cancelPress() {
        if (pressTimer.current !== null) {
            window.clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
    }

    // 画面を離れるときに残さない
    useEffect(() => cancelPress, []);

    /** 押した場所をマスに直す */
    function toCell(event: React.MouseEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        // 壁の厚みぶん、床は内側にずれている
        const x = event.clientX - rect.left - FLOOR_LEFT;
        const y = event.clientY - rect.top - FLOOR_TOP;
        return {
            col: Math.floor(x / TILE_SIZE),
            row: Math.floor(y / TILE_SIZE),
        };
    }

    /** 掴んでいるものを、押した場所へ動かす */
    function moveDragging(cell: { col: number; row: number }) {
        const item = furniture.find((row) => row.id === dragging);
        const def = item ? findFurniture(item.catalog_id) : null;
        if (!item || !def) return;

        if (!canPlace(def, item.facing, cell.col, cell.row, layout, item.id)) return;

        onChange({
            ...layout,
            furniture: furniture.map((row) =>
                row.id === item.id ? { ...row, col: cell.col, row: cell.row } : row,
            ),
        });
    }

    function handleClick(event: React.MouseEvent<HTMLDivElement>) {
        // 動かし終えた直後は、置く操作にしない
        if (dragging) {
            setDragging(null);
            return;
        }

        if (!holding) {
            setSelectedId(null);
            return;
        }

        const { col, row } = toCell(event);
        if (!canPlace(holding, holdingFacing, col, row, layout)) return;

        const item: PlacedFurniture = {
            id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            catalog_id: holding.id,
            col,
            row,
            facing: holdingFacing,
        };

        onChange({ ...layout, furniture: [...furniture, item] });
    }

    function updateSelected(patch: Partial<PlacedFurniture>) {
        if (!selected) return;
        onChange({
            ...layout,
            furniture: furniture.map((row) =>
                row.id === selected.id ? { ...row, ...patch } : row,
            ),
        });
    }

    function removeSelected() {
        if (!selected) return;
        onChange({
            ...layout,
            furniture: furniture.filter((row) => row.id !== selected.id),
        });
        setSelectedId(null);
    }

    const canPlaceHere =
        holding && hover
            ? canPlace(holding, holdingFacing, hover.col, hover.row, layout)
            : false;

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            {/* 部屋 */}
            <div className="min-w-0">
                <div
                    className="thin-scroll flex justify-center overflow-auto rounded-2xl border border-line p-3"
                    style={{ background: "#2b2721" }}
                >
                    <div
                        onClick={handleClick}
                        onMouseMove={(event) => {
                            if (holding) setHover(toCell(event));
                            if (dragging) moveDragging(toCell(event));
                        }}
                        onMouseLeave={() => {
                            setHover(null);
                            cancelPress();
                        }}
                        onMouseUp={() => {
                            cancelPress();
                            // 掴んでいたなら、その場に置いて終わる
                            if (dragging) window.setTimeout(() => setDragging(null), 0);
                        }}
                        className={[
                            dragging
                                ? "cursor-grabbing"
                                : holding
                                  ? "cursor-crosshair"
                                  : "cursor-default",
                        ].join(" ")}
                    >
                        <RoomCanvas
                            layout={layout}
                            showGrid
                            selectedId={selectedId}
                            onSelectFurniture={(item) => {
                                setHolding(null);
                                setSelectedId(item.id);
                            }}
                            onPressFurniture={(item) => {
                                // 長押しで掴む。押してすぐ動くと選べない
                                cancelPress();
                                pressTimer.current = window.setTimeout(() => {
                                    setHolding(null);
                                    setSelectedId(item.id);
                                    setDragging(item.id);
                                }, 260);
                            }}
                        >
                            {/* 置く前の下見 */}
                            {holding && hover && (
                                <div
                                    className={[
                                        "pointer-events-none absolute",
                                        canPlaceHere
                                            ? "outline outline-2 outline-[var(--color-forest)]"
                                            : "outline outline-2 outline-[var(--color-danger)]",
                                    ].join(" ")}
                                    style={{
                                        left: FLOOR_LEFT + hover.col * TILE_SIZE,
                                        top:
                                            (holding.layer === "wall" ? 4 : FLOOR_TOP) +
                                            hover.row * TILE_SIZE,
                                        width:
                                            blockingSizeOf(holding, holdingFacing).cols *
                                            TILE_SIZE,
                                        height:
                                            blockingSizeOf(holding, holdingFacing).rows *
                                            TILE_SIZE,
                                        zIndex: 999,
                                        background: canPlaceHere
                                            ? "rgba(42,92,57,0.12)"
                                            : "rgba(179,55,44,0.15)",
                                    }}
                                >
                                    <span className="relative block h-full w-full">
                                        <FurnitureSprite
                                            def={holding}
                                            facing={holdingFacing}
                                            isGhost
                                        />
                                    </span>
                                </div>
                            )}
                        </RoomCanvas>
                    </div>
                </div>

                {/* 置いたものへの操作 */}
                {selected && selectedDef && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5">
                        <span className="text-sm text-ink">{selectedDef.label}</span>

                        {selectedDef.rotatable && (
                            <button
                                type="button"
                                onClick={() => {
                                    const next =
                                        FACING_ORDER[
                                            (FACING_ORDER.indexOf(selected.facing) + 1) % 4
                                        ];
                                    if (
                                        canPlace(
                                            selectedDef,
                                            next,
                                            selected.col,
                                            selected.row,
                                            layout,
                                            selected.id,
                                        )
                                    ) {
                                        updateSelected({ facing: next });
                                    }
                                }}
                                className="rounded-md border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                            >
                                回す
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={removeSelected}
                            className="rounded-md border border-line px-3 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                        >
                            外す
                        </button>

                        <span className="ml-auto text-[11px] text-faint">
                            置いてあるもの {furniture.length}点
                        </span>
                    </div>
                )}

                {holding && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-forest-line bg-forest-tint/50 px-4 py-2.5">
                        <span className="text-sm text-ink">{holding.label}を置きます</span>

                        {holding.rotatable && (
                            <button
                                type="button"
                                onClick={() =>
                                    setHoldingFacing(
                                        FACING_ORDER[
                                            (FACING_ORDER.indexOf(holdingFacing) + 1) % 4
                                        ],
                                    )
                                }
                                className="rounded-md border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink"
                            >
                                回す
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setHolding(null)}
                            className="rounded-md px-2 py-1 text-xs text-faint hover:text-ink"
                        >
                            やめる
                        </button>

                        <span className="ml-auto text-[11px] text-muted">
                            床を押すと置けます
                        </span>
                    </div>
                )}
            </div>

            {/* 道具箱 */}
            <div className="rounded-xl border border-line bg-surface">
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                    <h2 className="text-[13px] font-semibold text-ink">部屋をカスタマイズ</h2>
                    <span className="text-[10px] text-faint">
                        {furniture.length}点
                    </span>
                </div>

                <div className="flex gap-0.5 border-b border-line p-1">
                    {(
                        [
                            { value: "theme", label: "テーマ" },
                            { value: "furniture", label: "家具" },
                            { value: "surface", label: "壁・床" },
                        ] as const
                    ).map((row) => (
                        <button
                            key={row.value}
                            type="button"
                            onClick={() => setTab(row.value)}
                            aria-pressed={tab === row.value}
                            className={[
                                "flex-1 rounded-md py-1.5 text-xs",
                                tab === row.value
                                    ? "bg-forest-tint font-medium text-forest"
                                    : "text-muted hover:text-ink",
                            ].join(" ")}
                        >
                            {row.label}
                        </button>
                    ))}
                </div>

                <div className="thin-scroll max-h-[560px] overflow-y-auto p-3">
                    {tab === "theme" && (
                        <ul className="grid grid-cols-2 gap-2">
                            {ROOM_THEMES.map((theme) => (
                                <li key={theme.id}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                ...layout,
                                                surface: {
                                                    floor: theme.floor,
                                                    wall: theme.wall,
                                                },
                                            })
                                        }
                                        className={[
                                            "w-full rounded-lg border p-2 text-left",
                                            layout.surface?.floor === theme.floor &&
                                            layout.surface?.wall === theme.wall
                                                ? "border-forest bg-forest-tint/50"
                                                : "border-line hover:border-forest-line",
                                        ].join(" ")}
                                    >
                                        <ThemeSwatch themeId={theme.id} />
                                        <span className="mt-1.5 block text-xs font-medium text-ink">
                                            {theme.label}
                                        </span>
                                        <span className="block text-[10px] leading-relaxed text-faint">
                                            {theme.description}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === "furniture" && (
                        <>
                            <div className="mb-2 flex flex-wrap gap-1">
                                {(Object.keys(CATEGORY_LABEL) as FurnitureCategory[]).map(
                                    (key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setCategory(key)}
                                            aria-pressed={category === key}
                                            className={[
                                                "rounded-full px-2.5 py-1 text-[11px]",
                                                category === key
                                                    ? "bg-forest text-white"
                                                    : "border border-line text-muted hover:text-ink",
                                            ].join(" ")}
                                        >
                                            {CATEGORY_LABEL[key]}
                                        </button>
                                    ),
                                )}
                            </div>

                            <ul className="grid grid-cols-4 gap-1.5">
                                {FURNITURE.filter((def) => def.category === category).map(
                                    (def) => (
                                        <li key={def.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    /*
                                                     * もう一度押したら解除。
                                                     * やめるボタンを探しに行かせない。
                                                     */
                                                    if (holding?.id === def.id) {
                                                        setHolding(null);
                                                        return;
                                                    }
                                                    setHolding(def);
                                                    setHoldingFacing("down");
                                                    setSelectedId(null);
                                                }}
                                                className={[
                                                    "flex w-full flex-col items-center gap-1 rounded-lg border p-1.5",
                                                    holding?.id === def.id
                                                        ? "border-forest bg-forest-tint/50"
                                                        : "border-line hover:border-forest-line",
                                                ].join(" ")}
                                            >
                                                <span className="relative flex h-12 w-full items-end justify-center overflow-hidden">
                                                    {/*
                                                     * 絵は上へはみ出すので、
                                                     * 足元を下端に合わせて縮める。
                                                     */}
                                                    <span
                                                        className="relative"
                                                        style={{
                                                            width: def.cols * 32,
                                                            height: def.rows * 32,
                                                            transform: `scale(${Math.min(
                                                                1,
                                                                2.2 /
                                                                    Math.max(
                                                                        def.artCols ?? def.cols,
                                                                        def.artRows ?? def.rows,
                                                                    ),
                                                            )})`,
                                                            transformOrigin: "bottom center",
                                                        }}
                                                    >
                                                        <FurnitureSprite
                                                            def={def}
                                                            facing="down"
                                                        />
                                                    </span>
                                                </span>
                                                <span className="w-full truncate text-center text-[9px] leading-tight text-ink">
                                                    {def.label}
                                                </span>
                                            </button>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </>
                    )}

                    {tab === "surface" && (
                        <div className="space-y-4">
                            {/*
                             * 出入口。部屋に 1 つだけ。
                             * 増やせるようにすると、どこから入るのか分からなくなる。
                             */}
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-ink">
                                    出入口
                                </p>
                                <div className="mb-2 grid grid-cols-4 gap-1">
                                    {(
                                        [
                                            { value: "top", label: "奥" },
                                            { value: "bottom", label: "手前" },
                                            { value: "left", label: "左" },
                                            { value: "right", label: "右" },
                                        ] as const
                                    ).map((row) => (
                                        <button
                                            key={row.value}
                                            type="button"
                                            onClick={() =>
                                                onChange({
                                                    ...layout,
                                                    door: {
                                                        side: row.value,
                                                        offset: Math.min(
                                                            layout.door?.offset ?? 0,
                                                            maxDoorOffset(row.value),
                                                        ),
                                                    },
                                                })
                                            }
                                            aria-pressed={layout.door?.side === row.value}
                                            className={[
                                                "rounded-md border py-1.5 text-[11px]",
                                                layout.door?.side === row.value
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:text-ink",
                                            ].join(" ")}
                                        >
                                            {row.label}
                                        </button>
                                    ))}
                                </div>

                                <label
                                    htmlFor="door-offset"
                                    className="block text-[10px] text-faint"
                                >
                                    位置
                                </label>
                                <input
                                    id="door-offset"
                                    type="range"
                                    min={0}
                                    max={maxDoorOffset(layout.door?.side ?? "bottom")}
                                    value={layout.door?.offset ?? 0}
                                    onChange={(e) =>
                                        onChange({
                                            ...layout,
                                            door: {
                                                side: layout.door?.side ?? "bottom",
                                                offset: Number(e.target.value),
                                            },
                                        })
                                    }
                                    className="w-full accent-[var(--color-forest)]"
                                />
                                <p className="mt-1 text-[10px] leading-relaxed text-faint">
                                    出入口の前は物を置けません。
                                    赤い斜線のところが空ける場所です。
                                </p>
                            </div>

                            <SurfacePicker
                                title="床"
                                options={FLOORS}
                                current={layout.surface?.floor ?? "wood"}
                                onPick={(id) =>
                                    onChange({
                                        ...layout,
                                        surface: { ...layout.surface, floor: id },
                                    })
                                }
                            />
                            <SurfacePicker
                                title="壁"
                                options={WALLS}
                                current={layout.surface?.wall ?? "cream"}
                                onPick={(id) =>
                                    onChange({
                                        ...layout,
                                        surface: { ...layout.surface, wall: id },
                                    })
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * ============================================================
 * 置けるかどうか
 * ============================================================
 */

function canPlace(
    def: FurnitureDef,
    facing: Facing,
    col: number,
    row: number,
    layout: RoomLayout,
    ignoreId?: string,
): boolean {
    // 絵の広がりで見る。足元だけで見ると、隣の家具と重なる
    const { cols, rows } = blockingSizeOf(def, facing);
    const maxRows = def.layer === "wall" ? WALL_ROWS : ROOM_ROWS;

    // 部屋からはみ出さない
    if (col < 0 || row < 0) return false;
    if (col + cols > ROOM_COLS || row + rows > maxRows) return false;

    /*
     * 出入口の前は空けておく。
     * 入ってきた人が家具に埋まってしまう。
     */
    if (def.layer !== "wall" && layout.door) {
        const blocked = doorClearance(layout.door);
        for (let c = col; c < col + cols; c += 1) {
            for (let r = row; r < row + rows; r += 1) {
                if (blocked.has(`${c},${r}`)) return false;
            }
        }
    }

    /*
     * 重なりを見るのは同じ層だけ。
     * 机の上に本を置けなくなると、部屋が作れない。
     */
    for (const other of layout.furniture) {
        if (other.id === ignoreId) continue;
        const otherDef = findFurniture(other.catalog_id);
        if (!otherDef || otherDef.layer !== def.layer) continue;

        const size = blockingSizeOf(otherDef, other.facing);
        const overlaps =
            col < other.col + size.cols &&
            col + cols > other.col &&
            row < other.row + size.rows &&
            row + rows > other.row;
        if (overlaps) return false;
    }

    return true;
}

/**
 * ============================================================
 * 部品
 * ============================================================
 */

function ThemeSwatch({ themeId }: { themeId: string }) {
    const theme = ROOM_THEMES.find((row) => row.id === themeId);
    if (!theme) return null;

    const floor = FLOORS.find((row) => row.id === theme.floor) ?? FLOORS[0];
    const wall = WALLS.find((row) => row.id === theme.wall) ?? WALLS[0];

    return (
        <span className="block h-12 w-full overflow-hidden rounded">
            <span className="block h-1/3 w-full" style={{ background: wall.base }} />
            <span className="block h-2/3 w-full" style={{ background: floor.base }} />
        </span>
    );
}

function SurfacePicker({
    title,
    options,
    current,
    onPick,
}: {
    title: string;
    options: { id: string; label: string; base: string }[];
    current: string;
    onPick: (id: string) => void;
}) {
    return (
        <div>
            <p className="mb-1.5 text-xs font-medium text-ink">{title}</p>
            <ul className="grid grid-cols-3 gap-1.5">
                {options.map((option) => (
                    <li key={option.id}>
                        <button
                            type="button"
                            onClick={() => onPick(option.id)}
                            className={[
                                "w-full rounded-lg border p-1",
                                current === option.id
                                    ? "border-forest"
                                    : "border-line hover:border-forest-line",
                            ].join(" ")}
                        >
                            <span
                                className="block h-8 w-full rounded"
                                style={{ background: option.base }}
                            />
                            <span className="mt-1 block text-[10px] text-muted">
                                {option.label}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
