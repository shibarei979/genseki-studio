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

import { useEffect, useRef, useState } from "react";

import { getImage } from "@/lib/storage/image-store";

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

/** 図の広さ。もとの大きさ。広げるときは、これに倍率を掛ける */
const BASE_SIZE = 400;
const BASE_RADIUS = 142;

/*
 * 紐の長さの段。
 *
 * ★ 数字は、丸と丸を離す割合。
 *
 *   1 のとき、丸 1 つぶんほど離れて並ぶ。
 *   1.9 なら、その倍近く離れる。
 *
 * ★ 言葉は「短い／長い」にする。
 *
 *   前は「狭い／広い」と書いていた。
 *   図そのものが広くなると読まれ、
 *   大きさの押し具と区別が付かなかった。
 *   動くのは紐の長さなので、そう呼ぶ。
 */
const SPREADS = [
    { label: "短い", value: 0.85 },
    { label: "ふつう", value: 1.15 },
    { label: "長い", value: 1.5 },
    { label: "とても長い", value: 1.9 },
];

/*
 * 丸どうしの、いちばん近い間。
 *
 * ★ 丸の直径に、名前のぶんを足す。
 *   名前は丸の下に出るので、縦に重なりやすい。
 */
const MIN_GAP = 68;
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

    /*
     * 図の大きさ。
     *
     * ★ 枠にぴったり収まる大きさを 50% とする。
     *
     *   いまの見え方が 50%。そこから大きくも小さくもできる。
     *   50 より上にすると枠からはみ出すので、送って見る。
     *   50 以下なら、送らずに全体が見える。
     *
     * ★ 広さとは別のもの。
     *
     *   広さ  丸と丸の間の空き方（並べ方）
     *   大きさ 描かれるものの大きさ（見え方）
     *
     *   項目が多いときは、広さを広げて大きさを下げると
     *   全体が見える。近くを読みたいときは大きさを上げる。
     */
    const [zoom, setZoom] = useState(50);

    /*
     * 画面いっぱいに広げるか。
     *
     * ★ 枠は頁の一部なので、どうしても小さい。
     *   人が 20 人を超えると、名前が読める大きさにならない。
     *
     * ★ 広げるのは器だけ。図の作りは変えない。
     *   同じ部品がそのまま大きな器に入るので、
     *   広げたときだけ別物になる、ということが起きない。
     *
     * ★ Esc で閉じる。
     *   覆いを閉じる道が押し具だけだと、逃げ場が無い。
     */
    const [isFull, setIsFull] = useState(false);

    useEffect(() => {
        if (!isFull) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setIsFull(false);
        }

        document.addEventListener("keydown", onKey);
        /* 後ろの頁が動くと、どこを見ていたか分からなくなる */
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [isFull]);

    /*
     * 凡例を開いているか。
     *
     * 畳んだ状態から始める。関係の名前は数が多く、
     * 開いたままだと図の場所を奪う。
     */
    const [isLegendOpen, setIsLegendOpen] = useState(false);

    /*
     * 紐の長さ。
     *
     * ★ 丸と丸を、どれだけ離して並べるか。
     *
     *   離すほど紐は長くなり、どこへ繋がっているか
     *   目で追いやすい。近いほど図はまとまるが、
     *   紐が束になって読めなくなる。
     *
     * ★ 見え方の大きさとは別。
     *
     *   紐の長さ  並べ方。丸どうしの離れ具合
     *   大きさ    見え方。枠の中でどれだけ大きく描くか
     *
     * ★ 数字を変えると、置いた場所が合わなくなる。
     *   座標は、この広さの中の位置として控えてある。
     *   短くすると、外にあった丸が端に貼り付く。
     *   そのときは「整理する」で並べ直してもらう。
     */
    const [spreadAt, setSpreadAt] = useState(3);

    const spread = SPREADS[spreadAt].value;
    const SIZE = Math.round(BASE_SIZE * spread);
    const CENTER = SIZE / 2;
    const RADIUS = BASE_RADIUS * spread;
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

    /*
     * 丸の中に出す絵。
     *
     * ★ image_url は、そのままでは絵の住所ではない。
     *
     *   「idb:…」の形で覚えていることがあり、
     *   そのときは置き場から引き出さないと出せない。
     *   一覧では EntryImage が同じことをしている。
     *   ここだけ生のまま <image> に渡していたので、丸が空だった。
     */
    const [pictures, setPictures] = useState<Record<string, string>>({});

    useEffect(() => {
        let isAlive = true;

        void (async () => {
            const found: Record<string, string> = {};

            await Promise.all(
                entries
                    .filter((entry) => entry.image_url)
                    .map(async (entry) => {
                        try {
                            const value = await getImage(entry.image_url as string);
                            if (value) found[entry.id] = value;
                        } catch {
                            /* 引き出せない絵は、丸のまま出す */
                        }
                    }),
            );

            if (isAlive) setPictures(found);
        })();

        return () => {
            isAlive = false;
        };
    }, [entries]);

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

    /*
     * こちらが並べたものだけ、重なりをほどく。
     * 掴んでいるものと、手で置いたものは動かさない。
     */
    const fixedIds = new Set<string>(
        nodes
            .filter((node) => layout[node.id] || dragging?.id === node.id)
            .map((node) => node.id),
    );
    untangle(positions, fixedIds);

    /*
     * 重なりをほどく。
     *
     * ★ 近すぎる丸を、少しずつ押し離す。
     *
     *   円周に等間隔で置いても、項目が増えれば
     *   丸と丸、丸と名前が重なる。
     *   重なると、どれの名前なのか読めない。
     *
     * ★ 手で置いたものは動かさない。
     *   置いた場所には意味がある。
     *   動かすのは、こちらが並べたものだけ。
     *
     * ★ 何度も少しずつ。
     *   一度に離すと、弾かれて端に貼り付く。
     */
    function untangle(
        place: Map<string, { x: number; y: number }>,
        fixed: Set<string>,
    ) {
        const ids = Array.from(place.keys());

        for (let round = 0; round < 60; round += 1) {
            let moved = false;

            for (let a = 0; a < ids.length; a += 1) {
                for (let b = a + 1; b < ids.length; b += 1) {
                    const one = place.get(ids[a]);
                    const two = place.get(ids[b]);
                    if (!one || !two) continue;

                    const dx = two.x - one.x;
                    const dy = two.y - one.y;
                    const gap = Math.hypot(dx, dy);

                    const want = MIN_GAP * spread;
                    if (gap >= want) continue;

                    moved = true;

                    /* 真上に重なっているときは、適当な向きへ逃がす */
                    const angle = gap < 0.01 ? (a + b) * 1.7 : Math.atan2(dy, dx);
                    const push = (want - gap) / 2;

                    const stepX = Math.cos(angle) * push;
                    const stepY = Math.sin(angle) * push;

                    if (!fixed.has(ids[a])) {
                        place.set(ids[a], clampToBoard({
                            x: one.x - stepX,
                            y: one.y - stepY,
                        }));
                    }
                    if (!fixed.has(ids[b])) {
                        place.set(ids[b], clampToBoard({
                            x: two.x + stepX,
                            y: two.y + stepY,
                        }));
                    }
                }
            }

            if (!moved) break;
        }
    }

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

        /*
         * ★ 描かれているのは、枠の中の正方形。
         *
         *   図は正方形（SIZE × SIZE）で、枠は正方形とは限らない。
         *   余ったところは上下か左右に空く。
         *
         *   枠の幅と高さでそのまま割ると、その空きぶんだけ
         *   掴む位置がずれる。丸を掴んだつもりで、
         *   少し離れた所を掴むことになる。
         *
         *   実際に描かれている正方形の一辺と、
         *   その左上の位置を出してから割る。
         */
        const side = Math.min(rect.width, rect.height);
        const left = rect.left + (rect.width - side) / 2;
        const top = rect.top + (rect.height - side) / 2;

        return {
            x: ((event.clientX - left) / side) * SIZE,
            y: ((event.clientY - top) / side) * SIZE,
        };
    }

    /*
     * 整理する。
     *
     * ★ 繋がりの多いものを内側へ。
     *
     *   多くの相手と結ばれているものは、
     *   図の真ん中にあるほうが紐が短く済む。
     *   端に置くと、そこから長い紐が何本も伸びる。
     *
     * ★ 輪は、入るぶんだけ。
     *   入りきらないぶんは外の輪へ回す。
     *   詰め込むと、また重なる。
     *
     * ★ 最後にほどく。
     *   輪に並べただけでは、輪と輪の間で重なる。
     */
    function tidy() {
        if (!onMove) return;

        const degree = new Map<string, number>();
        for (const relation of relations) {
            degree.set(relation.from_entry_id, (degree.get(relation.from_entry_id) ?? 0) + 1);
            degree.set(relation.to_entry_id, (degree.get(relation.to_entry_id) ?? 0) + 1);
        }

        const sorted = [...nodes].sort(
            (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
        );

        const place = new Map<string, { x: number; y: number }>();
        const want = MIN_GAP * spread;

        let at = 0;
        let ring = 0;

        while (at < sorted.length) {
            /*
             * 内側から数えて ring 番目の輪。
             * いちばん内側（0）は、真ん中に 1 つだけ置く。
             */
            if (ring === 0) {
                place.set(sorted[at].id, { x: CENTER, y: CENTER });
                at += 1;
                ring += 1;
                continue;
            }

            const radius = Math.min(
                CENTER - NODE_RADIUS - 8,
                (want * ring) / 1.6,
            );

            /* この輪に入る数。詰めすぎない */
            const room = Math.max(1, Math.floor((Math.PI * 2 * radius) / want));
            const count = Math.min(room, sorted.length - at);

            for (let i = 0; i < count; i += 1) {
                const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
                place.set(sorted[at + i].id, {
                    x: CENTER + Math.cos(angle) * radius,
                    y: CENTER + Math.sin(angle) * radius,
                });
            }

            at += count;
            ring += 1;

            /* 輪を増やしても入らないときは、そこで止める */
            if (radius >= CENTER - NODE_RADIUS - 8 && count === 0) break;
        }

        untangle(place, new Set());

        for (const node of nodes) {
            const point = place.get(node.id);
            if (point) onMove(node.id, point);
        }
    }

    const active = hoveredId ?? selectedId;
    const labels = Array.from(new Set(relations.map((relation) => relation.label)));

    const body = (
        <div className="flex h-full flex-col">
            {/*
              * 図の置き場。
              *
              * ★ 送らない。枠に収める。
              *
              *   前は広げたぶんだけ図を大きくして、
              *   はみ出したところを送って見てもらっていた。
              *   だが送らないと全体が見えないなら、
              *   広く使える意味がない。関係図は
              *   「全部を一目で見る」ための絵なので。
              *
              *   図そのものは枠いっぱいに縮めて描く。
              *   「広さ」は、丸と丸の間の空き方になる。
              *   広げるほど丸は小さくなるが、全部見える。
              *
              * ★ 押し具と凡例は、下に貼り付けたまま。
              */}
            <div className="thin-scroll min-h-0 flex-1 overflow-auto">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className={[
                    "mx-auto block",
                    dragging ? "cursor-grabbing" : "",
                ].join(" ")}
                /*
                 * ★ 高さで決めて、幅は正方形に合わせる。
                 *
                 *   幅と高さを別々に % で指定すると、
                 *   枠の形によって図が歪む。丸が楕円になる。
                 *   高さだけ決めて、幅は 1 対 1 で追わせる。
                 *
                 * ★ 50% が枠ぴったり。だから 2 倍して渡す。
                 */
                style={{
                    height: `${zoom * 2}%`,
                    aspectRatio: "1 / 1",
                    width: "auto",
                }}
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
                            {pictures[node.id] ? (
                                <>
                                    <clipPath id={`clip-${node.id}`}>
                                        <circle
                                            cx={position.x}
                                            cy={position.y}
                                            r={NODE_RADIUS}
                                        />
                                    </clipPath>
                                    <image
                                        href={pictures[node.id]}
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

                            {!pictures[node.id] && (
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
            </div>

            {onMove && (
                <>
                    {/*
                      * 紐の長さ。
                      *
                      * ★ 何が動くのかを、言葉で言う。
                      *   「広さ」だと図全体の話に読める。
                      */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[11px] text-faint">紐の長さ</span>
                        {SPREADS.map((one, index) => (
                            <button
                                key={one.label}
                                type="button"
                                onClick={() => setSpreadAt(index)}
                                aria-pressed={index === spreadAt}
                                className={[
                                    "rounded-md border px-2.5 py-1 text-[11px]",
                                    index === spreadAt
                                        ? "border-forest bg-forest-tint/60 text-forest"
                                        : "border-line text-muted hover:border-forest-line",
                                ].join(" ")}
                            >
                                {one.label}
                            </button>
                        ))}

                        <span className="text-[10.5px] text-faint">
                            丸どうしの離れ具合
                        </span>

                        <button
                            type="button"
                            onClick={tidy}
                            className="rounded-md border border-forest bg-surface px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                        >
                            整理する
                        </button>
                    </div>

                    {/*
                      * 大きさ。
                      *
                      * ★ 50% で枠ぴったり。
                      *   それより上は送って見る。下は全体が見える。
                      */}
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[11px] text-faint">大きさ</span>
                        {[25, 50, 75, 100].map((one) => (
                            <button
                                key={one}
                                type="button"
                                onClick={() => setZoom(one)}
                                aria-pressed={one === zoom}
                                className={[
                                    "rounded-md border px-2.5 py-1 text-[11px]",
                                    one === zoom
                                        ? "border-forest bg-forest-tint/60 text-forest"
                                        : "border-line text-muted hover:border-forest-line",
                                ].join(" ")}
                            >
                                {one}%
                            </button>
                        ))}
                        <span className="text-[10.5px] text-faint">
                            50% で枠ぴったり
                        </span>

                        <button
                            type="button"
                            onClick={() => setIsFull((open) => !open)}
                            className="rounded-md border border-forest bg-surface px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                        >
                            {isFull ? "元の大きさに戻す" : "画面いっぱいに広げる"}
                        </button>
                    </div>

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
                </>
            )}

            {/*
             * 凡例。
             * 破線で見せる。図の中の線と形を揃えないと、
             * どれがどれか分からない。
             */}
            {/*
              * 凡例。
              *
              * ★ 畳んでおく。
              *
              *   関係の名前は作品によっては 40 を超える。
              *   全部並べると 5 段になり、枠の 3 分の 1 を食う。
              *   図に使える高さが、そのぶん減る。
              *
              *   ふだんは 1 段ぶんだけ出し、
              *   見たい人が開く形にする。
              *
              * ★ 閉じているときも、いくつあるかは書く。
              *   隠していることが分からないと、押されない。
              */}
            <ul
                className={[
                    "mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5",
                    isLegendOpen ? "" : "max-h-[26px] overflow-hidden",
                ].join(" ")}
            >
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

            {labels.length > 6 && (
                <div className="mt-1.5 text-center">
                    <button
                        type="button"
                        onClick={() => setIsLegendOpen((open) => !open)}
                        aria-expanded={isLegendOpen}
                        className="text-[11px] text-forest hover:underline"
                    >
                        {isLegendOpen
                            ? "関係の名前を畳む"
                            : `関係の名前をすべて見る（${labels.length}）`}
                    </button>
                </div>
            )}

            <p className="mt-3 text-center text-xs text-faint">
                実線は変化を記録した関係、破線はまだ記録がない関係です。
            </p>
        </div>
    );

    if (!isFull) return body;

    /*
     * 画面いっぱい。
     *
     * ★ 中身は同じものをそのまま入れる。
     *   別に作ると、広げたときだけ動きが違う、が起きる。
     *
     * ★ 覆いを押しても閉じない。
     *   丸を掴んで端まで運んだとき、指が覆いに乗る。
     *   そこで閉じると、置いた場所が消える。
     */
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 800,
                background: "var(--color-canvas)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="関係図（画面いっぱい）"
        >
            {body}
        </div>
    );
}
