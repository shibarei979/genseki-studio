/**
 * ============================================================
 * 原石航路 Studio
 * RoomThemeStrip — テーマを選ぶ
 *
 * 部屋の下に横並びで置く。見本の画像と同じ位置。
 * 道具箱の中に入れると、まず開かないと存在に気づかない。
 * ============================================================
 */

"use client";

import { FLOORS, ROOM_THEMES, WALLS } from "@/lib/room/surfaces";
import type { RoomLayout } from "@/types";

interface Props {
    layout: RoomLayout;
    onPick: (floor: string, wall: string) => void;
}

export default function RoomThemeStrip({ layout, onPick }: Props) {
    return (
        <section className="rounded-xl border border-line bg-surface px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ink">テーマを選ぶ</h2>

            <ul className="thin-scroll mt-2.5 flex gap-2 overflow-x-auto pb-1">
                {ROOM_THEMES.map((theme) => {
                    const floor = FLOORS.find((row) => row.id === theme.floor) ?? FLOORS[0];
                    const wall = WALLS.find((row) => row.id === theme.wall) ?? WALLS[0];
                    const isCurrent =
                        layout.surface?.floor === theme.floor &&
                        layout.surface?.wall === theme.wall;

                    return (
                        <li key={theme.id} className="shrink-0">
                            <button
                                type="button"
                                onClick={() => onPick(theme.floor, theme.wall)}
                                aria-pressed={isCurrent}
                                className={[
                                    "block w-[110px] overflow-hidden rounded-lg border-2 text-left",
                                    isCurrent
                                        ? "border-forest"
                                        : "border-transparent hover:border-forest-line",
                                ].join(" ")}
                            >
                                {/* 部屋の様子を小さく見せる */}
                                <span
                                    className="relative block h-14 w-full"
                                    style={{ background: wall.base }}
                                >
                                    <span
                                        className="absolute inset-x-0 bottom-0 block h-2/3"
                                        style={{ background: floor.base }}
                                    />
                                    {/* 家具に見立てた影を置く。ただの色面に見せない */}
                                    <span
                                        className="absolute bottom-2 left-2 block h-3 w-6 rounded-sm"
                                        style={{ background: floor.line }}
                                    />
                                    <span
                                        className="absolute bottom-3 right-3 block h-4 w-3 rounded-sm"
                                        style={{ background: wall.line }}
                                    />
                                </span>

                                <span className="block truncate px-1.5 py-1 text-[11px] text-ink">
                                    {theme.label}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
