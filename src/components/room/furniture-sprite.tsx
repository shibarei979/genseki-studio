/**
 * ============================================================
 * 原石航路 Studio
 * FurnitureSprite — 家具の絵
 *
 * ドット絵ができるまでの仮の姿。
 *
 * 大事なのは「見分けがつくこと」。
 * 平たい長方形を並べると、机も本棚もソファも同じに見えて
 * 部屋が図面になる。
 *
 * そこで全部の家具に
 *   ・天面と側面（厚み）
 *   ・足元の影
 *   ・その家具にしかない目印
 * を持たせる。
 * ============================================================
 */

"use client";

import type { FurnitureDef } from "@/lib/room/furniture-catalog";
import {
    hasDirectionalSprite,
    sizeOf,
    spriteFor,
} from "@/lib/room/furniture-catalog";
import type { Facing } from "@/types/room-layout";
import { TILE_SIZE } from "@/types/room-layout";

/** 厚みの高さ。1 マス（16）に対する割合 */
const DEPTH = 4;

interface Props {
    def: FurnitureDef;
    facing: Facing;
    isGhost?: boolean;
}

export default function FurnitureSprite({ def, facing, isGhost = false }: Props) {
    /*
     * 足元・絵の入る枠・絵そのもの、の 3 つを分けて考える。
     *
     *   足元   … 床で占めるマス。置ける場所を決めるだけ
     *   枠     … 絵が入る場所。横向きに置いたら縦横が入れ替わる
     *   絵     … 回す前の大きさ。回すのは絵だけで、枠は回さない
     *
     * ここを一緒くたにしていたので、回すと位置がずれていた。
     */
    const foot = sizeOf(def, facing);
    const isSideways = facing === "left" || facing === "right";
    const canTurn = def.rotatable;

    /** 回す前の絵の大きさ（マス） */
    const baseCols = def.artCols ?? def.cols;
    const baseRows = def.artRows ?? def.rows;

    /*
     * 絵が入る枠。横向きなら縦横が入れ替わる。
     * ただし向きごとに描いた絵は回さないので、そのままの形で置く。
     */
    const isDirectional = hasDirectionalSprite(def);
    const swap = canTurn && isSideways && !isDirectional;

    const boxCols = swap ? baseRows : baseCols;
    const boxRows = swap ? baseCols : baseRows;

    const boxW = boxCols * TILE_SIZE;
    const boxH = boxRows * TILE_SIZE;

    /*
     * 絵は足元の下端に合わせ、横は中央に揃える。
     * はみ出すぶんだけ枠を左と上へずらす。
     */
    const offsetX = ((boxCols - foot.cols) / 2) * TILE_SIZE;
    const offsetY = (boxRows - foot.rows) * TILE_SIZE;

    const picture = spriteFor(def, facing);

    return (
        <span
            className="pointer-events-none absolute block"
            style={{ left: -offsetX, top: -offsetY, width: boxW, height: boxH }}
        >
            {picture ? (
                /*
                 * 絵は「回す前の大きさ」で置き、枠の中央で回す。
                 * 枠の大きさで置いて回すと、90 度のときにはみ出す。
                 */
                <span
                    className="absolute left-1/2 top-1/2 block"
                    style={{
                        /*
                         * 回すときは「回す前の大きさ」で置く。
                         * 向きごとに描いた絵は回さないので、枠の大きさに合わせる。
                         * ここを取り違えると、側面図が横倒しに縮む。
                         */
                        width: (picture.turn ? baseCols : boxCols) * TILE_SIZE,
                        height: (picture.turn ? baseRows : boxRows) * TILE_SIZE,
                        /*
                         * 中央合わせと回転を 1 つにまとめる。
                         * 別々に書くと後の指定が前を打ち消し、
                         * 絵が左上へ飛んでいた。
                         */
                        transform: `translate(-50%, -50%) rotate(${picture.turn}deg)`,
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={picture.src}
                        alt=""
                        style={{
                            imageRendering: def.pixelated ? "pixelated" : "auto",
                            opacity: isGhost ? 0.55 : 1,
                        }}
                        className="absolute bottom-0 left-1/2 block max-h-full max-w-full -translate-x-1/2"
                    />
                </span>
            ) : (
                /* 絵が無いものは図形で描く。図形は枠に合わせて描き直す */
                <svg
                    width={boxW}
                    height={boxH}
                    viewBox={`0 0 ${boxCols * 16} ${boxRows * 16}`}
                    style={{ opacity: isGhost ? 0.55 : 1, overflow: "visible" }}
                    className="block"
                    aria-hidden="true"
                >
                    <Shape def={def} cols={boxCols} rows={boxRows} facing={facing} />
                </svg>
            )}
        </span>
    );
}

function Shape({
    def,
    cols,
    rows,
    facing,
}: {
    def: FurnitureDef;
    cols: number;
    rows: number;
    facing: Facing;
}) {
    const w = cols * 16;
    const h = rows * 16;

    const top = def.tone;
    const side = shade(top, -34);
    const edge = shade(top, -55);
    const hi = shade(top, 20);

    /** 足元の影。全部の家具で同じ向きに落とす */
    const Shadow = () => (
        <ellipse cx={w / 2 + 1} cy={h - 1} rx={w * 0.44} ry={2.4} fill="#000" opacity="0.22" />
    );

    /**
     * 天面と側面を持つ箱。
     * 高さのあるものはこれを土台にする。
     */
    const Box = ({
        x,
        y,
        bw,
        bh,
        depth = DEPTH,
        fill = top,
    }: {
        x: number;
        y: number;
        bw: number;
        bh: number;
        depth?: number;
        fill?: string;
    }) => (
        <g>
            {/* 側面。手前に厚みを出す */}
            <rect x={x} y={y + bh - depth} width={bw} height={depth} fill={shade(fill, -34)} />
            {/* 天面 */}
            <rect x={x} y={y} width={bw} height={bh - depth} fill={fill} />
            {/* 天面の照り */}
            <rect x={x + 1} y={y + 1} width={bw - 2} height={1.4} fill={shade(fill, 20)} opacity="0.8" />
            {/*
             * 輪郭。細く、少し透かす。
             * 太い黒枠で囲うと、絵ではなく図形の集まりに見える。
             */}
            <rect
                x={x + 0.25}
                y={y + 0.25}
                width={bw - 0.5}
                height={bh - 0.5}
                rx="0.8"
                fill="none"
                stroke={shade(fill, -55)}
                strokeWidth="0.5"
                opacity="0.75"
            />
        </g>
    );

    switch (def.shape) {
        /* ---------------- 机・台 ---------------- */
        case "table":
            return (
                <g>
                    <Shadow />
                    <Box x={0.5} y={1} bw={w - 1} bh={h - 2} />
                    {/* 木目。机と分かる目印 */}
                    {Array.from({ length: Math.max(1, Math.floor(h / 7)) }, (_, i) => (
                        <line
                            key={i}
                            x1={2}
                            y1={4 + i * 6}
                            x2={w - 2}
                            y2={4 + i * 6}
                            stroke={side}
                            strokeWidth="0.4"
                            opacity="0.45"
                        />
                    ))}
                </g>
            );

        /* ---------------- 椅子 ---------------- */
        case "chair": {
            const back = { down: [2, 1, w - 4, 3.2], up: [2, h - 5, w - 4, 3.2],
                           left: [w - 5, 2, 3.2, h - 4], right: [1, 2, 3.2, h - 4] }[facing];
            return (
                <g>
                    <Shadow />
                    {/* 座面 */}
                    <Box x={3} y={5} bw={w - 6} bh={h - 7} depth={3} />
                    {/* 背もたれ。向きで位置が変わるので椅子だと分かる */}
                    <rect
                        x={back[0]}
                        y={back[1]}
                        width={back[2]}
                        height={back[3]}
                        rx="1"
                        fill={side}
                        stroke={edge}
                        strokeWidth="0.5"
                    />
                </g>
            );
        }

        /* ---------------- ソファ ---------------- */
        case "sofa":
            return (
                <g>
                    <Shadow />
                    {/* 座面 */}
                    <Box x={1} y={4} bw={w - 2} bh={h - 5} depth={3} />
                    {/* 背もたれ */}
                    <rect x={1} y={1.5} width={w - 2} height={4.5} rx="2" fill={side} stroke={edge} strokeWidth="0.5" />
                    {/* 肘掛け。ソファにしかない形 */}
                    <rect x={1} y={4} width={3.4} height={h - 6} rx="1.6" fill={side} stroke={edge} strokeWidth="0.5" />
                    <rect x={w - 4.4} y={4} width={3.4} height={h - 6} rx="1.6" fill={side} stroke={edge} strokeWidth="0.5" />
                    {/* 座面の割れ目 */}
                    <line x1={w / 2} y1={7} x2={w / 2} y2={h - 3} stroke={edge} strokeWidth="0.5" opacity="0.5" />
                </g>
            );

        /* ---------------- 本棚 ---------------- */
        case "shelf":
            return (
                <g>
                    <Shadow />
                    {/* 枠 */}
                    <rect x={0.5} y={0.5} width={w - 1} height={h - 2} rx="0.8" fill={edge} />
                    <rect x={1.5} y={1.5} width={w - 3} height={h - 4} fill={shade(top, -18)} />
                    {/* 本。色が違う背が並ぶのが本棚の目印 */}
                    {Array.from({ length: Math.floor((w - 4) / 2.6) }, (_, i) => {
                        const bh = (h - 5) * (0.68 + ((i * 37) % 30) / 100);
                        return (
                            <rect
                                key={i}
                                x={2.2 + i * 2.6}
                                y={h - 3 - bh}
                                width="2"
                                height={bh}
                                fill={BOOKS[i % BOOKS.length]}
                            />
                        );
                    })}
                    {/* 手前の厚み */}
                    <rect x={0.5} y={h - 2.4} width={w - 1} height={2} fill={side} />
                </g>
            );

        /* ---------------- 小物棚 ---------------- */
        case "cabinet":
            return (
                <g>
                    <Shadow />
                    <Box x={0.5} y={1} bw={w - 1} bh={h - 2} />
                    {/* 扉 2 枚と取っ手 */}
                    <rect x={2} y={3} width={(w - 6) / 2} height={h - 8} fill={shade(top, -14)} stroke={edge} strokeWidth="0.5" />
                    <rect x={w / 2 + 1} y={3} width={(w - 6) / 2} height={h - 8} fill={shade(top, -14)} stroke={edge} strokeWidth="0.5" />
                    <circle cx={w / 2 - 1.4} cy={h / 2 - 1} r="0.8" fill="#e8dcc4" />
                    <circle cx={w / 2 + 1.4} cy={h / 2 - 1} r="0.8" fill="#e8dcc4" />
                </g>
            );

        /* ---------------- ベッド ---------------- */
        case "bed":
            return (
                <g>
                    <Shadow />
                    {/* 枠 */}
                    <rect x={0.5} y={0.5} width={w - 1} height={h - 2} rx="1.5" fill={shade("#7a5c3d", 0)} />
                    <rect x={1.5} y={1.5} width={w - 3} height={h - 4} rx="1" fill={shade("#7a5c3d", 16)} />
                    {/* 枕 */}
                    <rect x={3} y={3} width={w - 6} height={h * 0.18} rx="1.6" fill="#f4efe4" stroke="#d8cfbc" strokeWidth="0.5" />
                    {/* 掛け布団 */}
                    <rect x={2.5} y={3 + h * 0.2} width={w - 5} height={h * 0.72} rx="1.6" fill={top} stroke={edge} strokeWidth="0.5" />
                    <rect x={2.5} y={3 + h * 0.2} width={w - 5} height={2} fill={hi} opacity="0.8" />
                </g>
            );

        /* ---------------- ラグ ---------------- */
        case "rug":
            return (
                <g>
                    <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx="2.5" fill={top} />
                    <rect x={2.5} y={2.5} width={w - 5} height={h - 5} rx="1.8" fill="none" stroke={hi} strokeWidth="1.4" opacity="0.75" />
                    <rect x={4.5} y={4.5} width={w - 9} height={h - 9} rx="1.2" fill={shade(top, 8)} opacity="0.45" />
                    {/* 房 */}
                    {Array.from({ length: Math.floor(w / 4) }, (_, i) => (
                        <line key={i} x1={2 + i * 4} y1={0.4} x2={2 + i * 4} y2={-1} stroke={side} strokeWidth="0.8" />
                    ))}
                </g>
            );

        /* ---------------- 植物 ---------------- */
        case "plant": {
            const cx = w / 2;
            const potTop = h - 7;
            return (
                <g>
                    <Shadow />
                    {/* 葉 */}
                    <g fill={top}>
                        <ellipse cx={cx} cy={potTop - 6} rx="3" ry="5" />
                        <ellipse cx={cx - 4} cy={potTop - 3.5} rx="4" ry="2.6" transform={`rotate(-30 ${cx - 4} ${potTop - 3.5})`} />
                        <ellipse cx={cx + 4} cy={potTop - 3.5} rx="4" ry="2.6" transform={`rotate(30 ${cx + 4} ${potTop - 3.5})`} />
                        <ellipse cx={cx - 2.5} cy={potTop - 8} rx="2.6" ry="4" transform={`rotate(-25 ${cx - 2.5} ${potTop - 8})`} />
                        <ellipse cx={cx + 2.5} cy={potTop - 8} rx="2.6" ry="4" transform={`rotate(25 ${cx + 2.5} ${potTop - 8})`} />
                    </g>
                    <ellipse cx={cx} cy={potTop - 6} rx="1.6" ry="3" fill={shade(top, -22)} opacity="0.5" />
                    {/* 鉢 */}
                    <path d={`M${cx - 4} ${potTop} h8 l-1.2 6 h-5.6 Z`} fill="#a8724a" stroke="#8a5a38" strokeWidth="0.5" />
                    <rect x={cx - 4.4} y={potTop - 1} width="8.8" height="1.8" rx="0.6" fill="#b98055" />
                </g>
            );
        }

        /* ---------------- 灯り ---------------- */
        case "lamp": {
            const cx = w / 2;
            return (
                <g>
                    {/* 光 */}
                    <ellipse cx={cx} cy={h - 4} rx={w * 0.6} ry={h * 0.38} fill="#ffe6a8" opacity="0.35" />
                    <Shadow />
                    {/* 台 */}
                    <ellipse cx={cx} cy={h - 3} rx="3.4" ry="1.4" fill={shade("#6b6055", 0)} />
                    {/* 支柱 */}
                    <rect x={cx - 0.7} y={h - 11} width="1.4" height="8" fill="#8a8074" />
                    {/* 傘。台形にすると灯りだと分かる */}
                    <path d={`M${cx - 5} ${h - 11} l2 -5 h6 l2 5 Z`} fill={top} stroke={shade(top, -30)} strokeWidth="0.5" />
                    <path d={`M${cx - 5} ${h - 11} h10`} stroke="#fff3d0" strokeWidth="1" opacity="0.9" />
                </g>
            );
        }

        case "candle":
            return (
                <g>
                    <ellipse cx={w / 2} cy={h - 6} rx={w * 0.5} ry={h * 0.34} fill="#ffe0a0" opacity="0.35" />
                    <ellipse cx={w / 2} cy={h - 3} rx="2.6" ry="1.1" fill="#8a8074" />
                    <rect x={w / 2 - 1.6} y={h - 9} width="3.2" height="6" rx="0.4" fill="#f2e8d4" stroke="#d6c9ae" strokeWidth="0.4" />
                    <ellipse cx={w / 2} cy={h - 10.5} rx="1.1" ry="2" fill="#f5b942" />
                    <ellipse cx={w / 2} cy={h - 10.2} rx="0.5" ry="1" fill="#fff3c4" />
                </g>
            );

        /* ---------------- 壁のもの ---------------- */
        case "window":
            return (
                <g>
                    {/* 外の空 */}
                    <rect x={1} y={1} width={w - 2} height={h - 2} fill="#bcd4e0" />
                    <rect x={1} y={1} width={w - 2} height={(h - 2) * 0.45} fill="#cfe2ec" />
                    {/* 遠くの木 */}
                    <ellipse cx={w * 0.3} cy={h - 3} rx={w * 0.18} ry="2.6" fill="#93ad8a" />
                    <ellipse cx={w * 0.68} cy={h - 3.5} rx={w * 0.14} ry="2.2" fill="#a3bb99" />
                    {/* 枠 */}
                    <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="none" stroke="#8a7458" strokeWidth="1.6" />
                    <line x1={w / 2} y1={1} x2={w / 2} y2={h - 1} stroke="#8a7458" strokeWidth="1.1" />
                    <line x1={1} y1={h / 2} x2={w - 1} y2={h / 2} stroke="#8a7458" strokeWidth="1.1" />
                    {/* 桟の照り */}
                    <line x1={1} y1={1.6} x2={w - 1} y2={1.6} stroke="#fff" strokeWidth="0.5" opacity="0.4" />
                </g>
            );

        case "frame":
            return (
                <g>
                    <rect x={0.8} y={0.8} width={w - 1.6} height={h - 2.4} rx="0.6" fill={top} stroke={edge} strokeWidth="0.7" />
                    <rect x={2.4} y={2.4} width={w - 4.8} height={h - 5.6} fill="#e4ecdc" />
                    {/* 風景 */}
                    <path d={`M3 ${h - 3.6} l3.5 -4.5 l2.6 3.2 l2 -2.4 l2.5 3.7 Z`} fill="#8aa87c" />
                    <circle cx={w - 4} cy="4.6" r="1.2" fill="#f0d69a" />
                </g>
            );

        case "clock":
            return (
                <g>
                    <circle cx={w / 2} cy={h / 2 - 1} r={w * 0.4} fill={top} />
                    <circle cx={w / 2} cy={h / 2 - 1} r={w * 0.32} fill="#f4efe2" />
                    <path
                        d={`M${w / 2} ${h / 2 - 1} v-3.2 M${w / 2} ${h / 2 - 1} l2.6 1.6`}
                        stroke="#4a4038"
                        strokeWidth="0.9"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <circle cx={w / 2} cy={h / 2 - 1} r="0.5" fill="#4a4038" />
                </g>
            );

        /* ---------------- 小物 ---------------- */
        case "book":
            return (
                <g>
                    <ellipse cx={w / 2} cy={h - 2.5} rx="5" ry="1.2" fill="#000" opacity="0.16" />
                    <rect x={2.5} y={h - 5.4} width={w - 5} height="2.4" rx="0.3" fill={BOOKS[0]} />
                    <rect x={3.2} y={h - 7.6} width={w - 6.4} height="2.4" rx="0.3" fill={BOOKS[2]} />
                    <rect x={2.8} y={h - 9.8} width={w - 5.6} height="2.4" rx="0.3" fill={BOOKS[4]} />
                    <line x1={3} y1={h - 4.2} x2={w - 3} y2={h - 4.2} stroke="#fff" strokeWidth="0.4" opacity="0.5" />
                </g>
            );

        case "cup":
            return (
                <g>
                    <ellipse cx={w / 2} cy={h - 3} rx="3.2" ry="1.2" fill="#000" opacity="0.16" />
                    <path d={`M${w / 2 - 2.8} ${h - 9} h5.6 l-0.6 5.6 h-4.4 Z`} fill={top} stroke={shade(top, -34)} strokeWidth="0.5" />
                    <ellipse cx={w / 2} cy={h - 9} rx="2.8" ry="1" fill="#f4efe4" />
                    <path d={`M${w / 2 + 2.8} ${h - 7.6} q2.2 0.8 0 2.8`} fill="none" stroke={top} strokeWidth="0.9" />
                </g>
            );

        case "vase":
            return (
                <g>
                    <ellipse cx={w / 2} cy={h - 2.6} rx="3" ry="1.1" fill="#000" opacity="0.16" />
                    {/* 花 */}
                    <path d={`M${w / 2} ${h - 8} q-2.6 -3 -3.4 -4.6 M${w / 2} ${h - 8} q2.6 -3 3.8 -4.2 M${w / 2} ${h - 8} v-5`}
                        fill="none" stroke="#7d9a6a" strokeWidth="0.9" strokeLinecap="round" />
                    <circle cx={w / 2 - 3.4} cy={h - 12.8} r="1.4" fill="#d98da8" />
                    <circle cx={w / 2 + 3.8} cy={h - 12.4} r="1.3" fill="#e0a97c" />
                    <circle cx={w / 2} cy={h - 13.4} r="1.5" fill="#e8c46a" />
                    {/* 瓶 */}
                    <path d={`M${w / 2 - 2.4} ${h - 8.4} q-0.8 -1.6 0.8 -2.2 h3.2 q1.6 0.6 0.8 2.2 l-0.6 5.6 h-3.6 Z`}
                        fill={top} opacity="0.85" stroke={shade(top, -30)} strokeWidth="0.5" />
                </g>
            );

        case "bin":
            return (
                <g>
                    <Shadow />
                    <path d={`M${w / 2 - 3.4} ${h - 10} h6.8 l-0.9 7.4 h-5 Z`} fill={top} stroke={shade(top, -34)} strokeWidth="0.5" />
                    {/* 縦筋 */}
                    <line x1={w / 2 - 1.4} y1={h - 9.4} x2={w / 2 - 1.7} y2={h - 3.2} stroke={side} strokeWidth="0.5" />
                    <line x1={w / 2 + 1.4} y1={h - 9.4} x2={w / 2 + 1.7} y2={h - 3.2} stroke={side} strokeWidth="0.5" />
                    <rect x={w / 2 - 4} y={h - 11.2} width="8" height="1.8" rx="0.8" fill={side} stroke={edge} strokeWidth="0.5" />
                </g>
            );

        case "cushion":
            return (
                <g>
                    <ellipse cx={w / 2} cy={h - 2.4} rx={w * 0.36} ry="1.5" fill="#000" opacity="0.18" />
                    <rect x={2} y={h - 10} width={w - 4} height="7.4" rx="3" fill={top} stroke={shade(top, -34)} strokeWidth="0.5" />
                    <rect x={3.4} y={h - 8.6} width={w - 6.8} height="4.4" rx="2.2" fill={hi} opacity="0.65" />
                    {/* 四隅のくぼみ */}
                    <circle cx={w / 2} cy={h - 6.4} r="0.9" fill={shade(top, -30)} opacity="0.6" />
                </g>
            );

        default:
            return (
                <g>
                    <Shadow />
                    <Box x={0.5} y={1} bw={w - 1} bh={h - 2} />
                </g>
            );
    }
}

const BOOKS = ["#8d5f4a", "#5f6f8d", "#6f8d5f", "#8d5f6f", "#5f8d85", "#7a5f8d", "#8d7a4a"];

function shade(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const clamp = (n: number) => Math.min(255, Math.max(0, n));
    const r = clamp(((num >> 16) & 255) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
