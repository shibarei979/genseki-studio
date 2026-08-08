/**
 * ============================================================
 * 原石航路 Studio
 * RoomCanvas — 部屋の床・壁と、置かれたもの
 *
 * 疑似トップダウン。床は真上、家具は斜め前から見た形。
 * 上下左右の 4 面を壁で囲う。奥の壁だけは立ち上がって見えるので高い。
 *
 * 組み立ての順は外から内へ。
 *   壁の面 → 床 → 出入口 → 家具 → 人
 * ============================================================
 */

"use client";

import FurnitureSprite from "@/components/room/furniture-sprite";
import { findFurniture, sizeOf } from "@/lib/room/furniture-catalog";
import { findFloor, findWall } from "@/lib/room/surfaces";
import type { PlacedFurniture, RoomDoor, RoomLayout } from "@/types/room-layout";
import {
    DOOR_WIDTH,
    doorClearance,
    ROOM_COLS,
    ROOM_ROWS,
    TILE_SIZE,
    WALL_THICKNESS,
    zIndexOf,
} from "@/types/room-layout";

/** 奥の壁の高さ（マス数）。立ち上がって見えるので他より高い */
export const WALL_ROWS = 4;

/** 部屋全体の大きさ（px）。外から使う */
export const CANVAS_WIDTH = (ROOM_COLS + WALL_THICKNESS * 2) * TILE_SIZE;
export const CANVAS_HEIGHT = (ROOM_ROWS + WALL_ROWS + WALL_THICKNESS) * TILE_SIZE;

/** 床の左上が、部屋全体の中でどこにあるか */
export const FLOOR_LEFT = WALL_THICKNESS * TILE_SIZE;
export const FLOOR_TOP = WALL_ROWS * TILE_SIZE;

interface Props {
    layout: RoomLayout;
    showGrid?: boolean;
    selectedId?: string | null;
    onSelectFurniture?: (item: PlacedFurniture) => void;
    /** 押し始め。長押しで掴むために使う */
    onPressFurniture?: (item: PlacedFurniture) => void;
    /** 人など、床の上に重ねるもの */
    children?: React.ReactNode;
}

export default function RoomCanvas({
    layout,
    showGrid = false,
    selectedId,
    onSelectFurniture,
    onPressFurniture,
    children,
}: Props) {
    const floor = findFloor(layout.surface?.floor ?? "wood");
    const wall = findWall(layout.surface?.wall ?? "cream");
    // 保存先から来た間取りは、項目が欠けていることがある
    const furniture = layout.furniture ?? [];
    const door = layout.door ?? {
        side: "bottom" as const,
        offset: Math.floor((ROOM_COLS - DOOR_WIDTH) / 2),
    };

    const floorWidth = ROOM_COLS * TILE_SIZE;
    const floorHeight = ROOM_ROWS * TILE_SIZE;

    return (
        <div
            className="relative select-none overflow-hidden rounded-lg"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        >
            {/* ---- 壁。全面に敷いてから、中を床でくり抜く ---- */}
            <div
                className="absolute inset-0"
                style={{
                    background: wall.base,
                    // 壁の板は床より大きく取る。同じ細かさだと壁が煩い
                    backgroundImage: patternOf(wall, TILE_SIZE * 2),
                    backgroundPosition:
                        wall.pattern === "brick"
                            ? `0 0, ${TILE_SIZE}px 0, 0 0`
                            : undefined,
                }}
            />
            {/*
             * 壁の上端の縁。
             * 見本の画像では、壁の上に厚みがあって
             * そこに植物などが乗っている。
             * 縁があると、壁が「立っている」ように見える。
             */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{
                    height: TILE_SIZE * 0.75,
                    background: "linear-gradient(#8f7355, #6b5238)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                }}
            />

            {/* 壁の陰。外側ほど暗くして、囲まれた中だと分かるようにする */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "linear-gradient(rgba(0,0,0,0.26), rgba(0,0,0,0) 16%)," +
                        "linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0) 5%)," +
                        "linear-gradient(to left, rgba(0,0,0,0.18), rgba(0,0,0,0) 5%)," +
                        "linear-gradient(to top, rgba(0,0,0,0.14), rgba(0,0,0,0) 5%)",
                }}
            />

            {/* ---- 床 ---- */}
            <div
                className="absolute"
                style={{
                    left: FLOOR_LEFT,
                    top: FLOOR_TOP,
                    width: floorWidth,
                    height: floorHeight,
                    background: floor.base,
                    backgroundImage: patternOf(floor, TILE_SIZE),
                    boxShadow: "inset 0 6px 12px rgba(0,0,0,0.22)",
                }}
            />
            {/* 光のむら。単色の面に見せない */}
            <div
                className="pointer-events-none absolute"
                style={{
                    left: FLOOR_LEFT,
                    top: FLOOR_TOP,
                    width: floorWidth,
                    height: floorHeight,
                    background:
                        "radial-gradient(120% 90% at 50% -10%, rgba(255,244,214,0.30) 0%, rgba(255,244,214,0) 55%)," +
                        "radial-gradient(120% 100% at 50% 105%, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 60%)",
                }}
            />

            {/* 巾木。奥の壁と床の境に木の縁を回す */}
            <div
                className="pointer-events-none absolute"
                style={{
                    left: FLOOR_LEFT,
                    top: FLOOR_TOP - 5,
                    width: floorWidth,
                    height: 6,
                    background: "linear-gradient(#8a6f4d, #6b533a)",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                    zIndex: 4,
                }}
            />

            {/* ---- 格子。編集中だけ ---- */}
            {showGrid && (
                <>
                    <div
                        className="pointer-events-none absolute"
                        style={{
                            left: FLOOR_LEFT,
                            top: FLOOR_TOP,
                            width: floorWidth,
                            height: floorHeight,
                            backgroundImage:
                                "linear-gradient(to right, rgba(0,0,0,0.09) 1px, transparent 1px)," +
                                "linear-gradient(to bottom, rgba(0,0,0,0.09) 1px, transparent 1px)",
                            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
                            zIndex: 5,
                        }}
                    />
                    {/* 出入口の前。置けない場所 */}
                    {Array.from(doorClearance(door)).map((cell) => {
                        const [col, row] = cell.split(",").map(Number);
                        return (
                            <div
                                key={cell}
                                className="pointer-events-none absolute"
                                style={{
                                    left: FLOOR_LEFT + col * TILE_SIZE,
                                    top: FLOOR_TOP + row * TILE_SIZE,
                                    width: TILE_SIZE,
                                    height: TILE_SIZE,
                                    background:
                                        "repeating-linear-gradient(45deg, rgba(179,55,44,0.18) 0 4px, transparent 4px 8px)",
                                    zIndex: 5,
                                }}
                            />
                        );
                    })}
                </>
            )}

            {/* ---- 出入口 ---- */}
            <Door door={door} floorWidth={floorWidth} floorHeight={floorHeight} />

            {/* ---- 置かれたもの ---- */}
            {furniture.map((item) => {
                const def = findFurniture(item.catalog_id);
                if (!def) return null;

                const size = sizeOf(def, item.facing);
                const isWall = def.layer === "wall";

                return (
                    <div
                        key={item.id}
                        onClick={
                            onSelectFurniture
                                ? (event) => {
                                      event.stopPropagation();
                                      onSelectFurniture(item);
                                  }
                                : undefined
                        }
                        onMouseDown={
                            onPressFurniture ? () => onPressFurniture(item) : undefined
                        }
                        className={[
                            "absolute",
                            onSelectFurniture ? "cursor-pointer" : "",
                            selectedId === item.id
                                ? "outline outline-2 outline-offset-1 outline-[var(--color-forest)]"
                                : "",
                        ].join(" ")}
                        style={{
                            left: FLOOR_LEFT + item.col * TILE_SIZE,
                            // 壁の飾りは奥の壁の面へ、それ以外は床へ
                            top: isWall
                                ? 4 + item.row * TILE_SIZE
                                : FLOOR_TOP + item.row * TILE_SIZE,
                            width: size.cols * TILE_SIZE,
                            height: size.rows * TILE_SIZE,
                            zIndex: zIndexOf(def.layer, item.row),
                        }}
                    >
                        <FurnitureSprite def={def} facing={item.facing} />
                    </div>
                );
            })}

            {children}
        </div>
    );
}

/**
 * ============================================================
 * 出入口
 *
 * 4 面のどこにでも置けるが、部屋に 1 つだけ。
 * 面によって向きが変わるので描き分ける。
 * ============================================================
 */

function Door({
    door,
    floorWidth,
    floorHeight,
}: {
    door: RoomDoor;
    floorWidth: number;
    floorHeight: number;
}) {
    const doorPx = DOOR_WIDTH * TILE_SIZE;
    const thick = WALL_THICKNESS * TILE_SIZE;
    const isVertical = door.side === "left" || door.side === "right";

    /*
     * 両開きの木戸。
     *
     * 暗い穴を開けるだけだと、部屋に空いた欠けに見えていた。
     * 戸そのものを描き、真ん中を少し開けて向こうを覗かせる。
     * 「入ってこられる場所」だと分かればよい。
     */
    const wood = "#7d6146";
    const woodDark = "#5c452f";
    const woodLight = "#9a7a58";

    /** 戸の板。鏡板を並べて木戸に見せる */
    const panel = (side: "a" | "b") => (
        <span
            className="absolute overflow-hidden"
            style={{
                ...(isVertical
                    ? {
                          left: 0,
                          right: 0,
                          top: side === "a" ? 0 : "52%",
                          height: "48%",
                      }
                    : {
                          top: 0,
                          bottom: 0,
                          left: side === "a" ? 0 : "52%",
                          width: "48%",
                      }),
                /*
                 * 陰は部屋の外側へ向かって濃くする。
                 * 向きが揃っていないと、扉だけ光源が違って見える。
                 */
                background: `linear-gradient(${
                    door.side === "top"
                        ? "to top"
                        : door.side === "bottom"
                          ? "to bottom"
                          : door.side === "left"
                            ? "to left"
                            : "to right"
                }, ${woodDark}, ${wood} 55%, ${woodLight})`,
                /*
                 * 板の縁取り。部屋側には落とさない。
                 * 一周させると、床との境に線が引かれてしまう。
                 */
                boxShadow:
                    door.side === "top"
                        ? "inset 0 1px 0 rgba(0,0,0,0.3)"
                        : door.side === "bottom"
                          ? "inset 0 -1px 0 rgba(0,0,0,0.3)"
                          : door.side === "left"
                            ? "inset 1px 0 0 rgba(0,0,0,0.3)"
                            : "inset -1px 0 0 rgba(0,0,0,0.3)",
            }}
        >
            {/* 鏡板 */}
            <span
                className="absolute"
                style={{
                    inset: 4,
                    border: `1px solid ${woodDark}`,
                    borderRadius: 1,
                    background: "rgba(0,0,0,0.06)",
                }}
            />
            {/* 取っ手。中央側に付ける */}
            <span
                className="absolute rounded-full"
                style={{
                    width: 3,
                    height: 3,
                    background: "#d9bc7a",
                    boxShadow: "0 0 2px rgba(0,0,0,0.5)",
                    ...(isVertical
                        ? {
                              left: "50%",
                              marginLeft: -1.5,
                              ...(side === "a" ? { bottom: 4 } : { top: 4 }),
                          }
                        : {
                              top: "50%",
                              marginTop: -1.5,
                              ...(side === "a" ? { right: 4 } : { left: 4 }),
                          }),
                }}
            />
        </span>
    );

    const box: React.CSSProperties = isVertical
        ? {
              left: door.side === "left" ? 0 : FLOOR_LEFT + floorWidth,
              top: FLOOR_TOP + door.offset * TILE_SIZE,
              width: thick,
              height: doorPx,
          }
        : {
              left: FLOOR_LEFT + door.offset * TILE_SIZE,
              top: door.side === "top" ? 0 : FLOOR_TOP + floorHeight,
              width: doorPx,
              height: door.side === "top" ? FLOOR_TOP : thick,
          };

    return (
        <div className="absolute overflow-hidden" style={{ ...box, zIndex: 6 }}>
            {/* 隙間から見える向こう側 */}
            <span
                className="absolute inset-0"
                style={{ background: "#1a1510" }}
            />

            {/* 両開きの戸 */}
            {panel("a")}
            {panel("b")}

            {/*
             * 部屋側には板を渡さない。
             * 敷居があると扉と床のあいだに仕切りが立って見え、
             * そこから入ってこられる場所に見えなくなる。
             */}

            {/*
             * 枠の影。部屋に接する辺には落とさない。
             * 四周に影を回すと、そこに板が渡っているように見えて、
             * 扉が床から切り離される。
             */}
            <span
                className="absolute inset-0"
                style={{
                    boxShadow:
                        door.side === "top"
                            ? "inset 0 6px 8px -4px rgba(0,0,0,0.5)"
                            : door.side === "bottom"
                              ? "inset 0 -6px 8px -4px rgba(0,0,0,0.5)"
                              : door.side === "left"
                                ? "inset 6px 0 8px -4px rgba(0,0,0,0.5)"
                                : "inset -6px 0 8px -4px rgba(0,0,0,0.5)",
                }}
            />
        </div>
    );
}

/**
 * 床板・壁紙の模様。
 *
 * 継ぎ目の線だけだと、板ではなく罫線に見える。
 * 板ごとに濃さを変え、木目の細い筋を重ねて、面に手触りを出す。
 */
function patternOf(surface: { line: string; pattern: string }, tile: number): string {
    const line = surface.line;

    if (surface.pattern === "plank-h") {
        return [
            `repeating-linear-gradient(to bottom,` +
                ` rgba(255,255,255,0.05) 0 ${tile}px,` +
                ` rgba(0,0,0,0.045) ${tile}px ${tile * 2}px,` +
                ` rgba(255,255,255,0.02) ${tile * 2}px ${tile * 3}px,` +
                ` rgba(0,0,0,0.02) ${tile * 3}px ${tile * 4}px)`,
            `repeating-linear-gradient(to right,` +
                ` transparent 0 5px, ${line}22 5px 6px, transparent 6px 13px, ${line}18 13px 14px)`,
            `repeating-linear-gradient(to bottom, transparent 0 ${tile - 1}px, ${line}77 ${tile - 1}px ${tile}px)`,
            `repeating-linear-gradient(to right, transparent 0 ${tile * 5 - 1}px, ${line}55 ${tile * 5 - 1}px ${tile * 5}px)`,
        ].join(",");
    }

    if (surface.pattern === "plank-v") {
        return [
            `repeating-linear-gradient(to right,` +
                ` rgba(255,255,255,0.05) 0 ${tile}px,` +
                ` rgba(0,0,0,0.045) ${tile}px ${tile * 2}px,` +
                ` rgba(255,255,255,0.02) ${tile * 2}px ${tile * 3}px,` +
                ` rgba(0,0,0,0.02) ${tile * 3}px ${tile * 4}px)`,
            `repeating-linear-gradient(to bottom,` +
                ` transparent 0 5px, ${line}22 5px 6px, transparent 6px 13px, ${line}18 13px 14px)`,
            `repeating-linear-gradient(to right, transparent 0 ${tile - 1}px, ${line}77 ${tile - 1}px ${tile}px)`,
            `repeating-linear-gradient(to bottom, transparent 0 ${tile * 5 - 1}px, ${line}55 ${tile * 5 - 1}px ${tile * 5}px)`,
        ].join(",");
    }

    if (surface.pattern === "check") {
        return [
            `radial-gradient(circle at 30% 35%, rgba(255,255,255,0.06) 0 ${tile * 0.5}px, transparent ${tile * 0.5}px)`,
            `radial-gradient(circle at 72% 68%, rgba(0,0,0,0.05) 0 ${tile * 0.4}px, transparent ${tile * 0.4}px)`,
            `repeating-linear-gradient(to right, transparent 0 ${tile * 2 - 1}px, ${line}66 ${tile * 2 - 1}px ${tile * 2}px)`,
            `repeating-linear-gradient(to bottom, transparent 0 ${tile * 2 - 1}px, ${line}66 ${tile * 2 - 1}px ${tile * 2}px)`,
        ].join(",");
    }

    if (surface.pattern === "brick") {
        // 煉瓦は 1 段ごとに半分ずらす。目地を細く白っぽく
        const bw = tile;
        const bh = tile * 0.5;
        return [
            `repeating-linear-gradient(to bottom,` +
                ` transparent 0 ${bh - 2}px, ${line} ${bh - 2}px ${bh}px)`,
            `repeating-linear-gradient(to right,` +
                ` transparent 0 ${bw - 2}px, ${line} ${bw - 2}px ${bw}px)`,
            `repeating-linear-gradient(to bottom,` +
                ` rgba(255,255,255,0.05) 0 ${bh}px, rgba(0,0,0,0.05) ${bh}px ${bh * 2}px)`,
        ].join(",");
    }

    if (surface.pattern === "tatami") {
        return [
            `repeating-linear-gradient(to bottom, transparent 0 2px, ${line}20 2px 3px)`,
            `repeating-linear-gradient(to right, transparent 0 ${tile * 2 - 2}px, ${line}cc ${tile * 2 - 2}px ${tile * 2}px)`,
            `repeating-linear-gradient(to bottom, transparent 0 ${tile * 4 - 2}px, ${line}cc ${tile * 4 - 2}px ${tile * 4}px)`,
        ].join(",");
    }

    return [
        `radial-gradient(circle at 25% 30%, rgba(255,255,255,0.05) 0 ${tile * 0.7}px, transparent ${tile * 0.7}px)`,
        `radial-gradient(circle at 75% 70%, rgba(0,0,0,0.04) 0 ${tile * 0.6}px, transparent ${tile * 0.6}px)`,
    ].join(",");
}
