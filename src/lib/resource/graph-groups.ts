/**
 * ============================================================
 * 原石航路 Studio
 * 関係図の「まとまり」と「線の通り道」
 *
 * ★ ここには絵を描く部分を入れない。
 *
 *   まとまりの見つけ方、囲みの四角、線の折れ方だけを置く。
 *   描くのは relation-graph に任せる。
 *   分けておけば、ここだけを見て直せる。
 *
 * ★ まとまりは、関係から見つける。
 *
 *   作者に「この人とこの人は同じ組」と
 *   もう一度入れてもらうのは、二度手間になる。
 *   「所属」「配下」といった関係は、すでに書いてある。
 *   それを読めば、ひとりでに囲める。
 *
 * ★ どこにも入らない人は、囲まない。
 *   一人だけの囲みも作らない。囲む意味がない。
 *
 * ★ 二つ以上に入る人は、両方に入れる。
 *   囲みどうしが重なる。それでいい。
 *   掛け持ちしている人が、図の上でも掛け持ちに見える。
 * ============================================================
 */

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/* ============================================================
 * 1. まとまりを見つける
 * ============================================================ */

/**
 * 「向こう側」が囲みになる言葉。
 *
 *   A から B への関係が「所属」なら、
 *   A は B の中にいる。囲みの名前は B。
 */
const OWNER_IS_TO = [
    "所属",
    "一員",
    "構成員",
    "メンバー",
    "在籍",
    "配下",
    "部下",
    "従者",
    "眷属",
    "門下",
    "家臣",
    "臣下",
    "手下",
    "舎弟",
    "仕え",
];

/**
 * 「こちら側」が囲みになる言葉。
 *
 *   A から B への関係が「上司」なら、
 *   B は A の中にいる。囲みの名前は A。
 */
const OWNER_IS_FROM = [
    "上司",
    "主人",
    "主君",
    "頭領",
    "首領",
    "当主",
    "隊長",
    "団長",
    "率い",
];

export interface FoundGroup {
    /** 囲みの id。中心になった項目の id をそのまま使う */
    key: string;
    /** 囲みに出す名前 */
    name: string;
    /** 中に入る項目の id。中心になった項目も入る */
    ids: string[];
}

interface MiniEntry {
    id: string;
    name: string;
}

interface MiniRelation {
    from_entry_id: string;
    to_entry_id: string;
    label: string;
}

/**
 * 関係を読んで、まとまりを作る。
 *
 * ★ 二人以上入らない囲みは捨てる。
 *   一人を囲んでも、何も分からない。
 */
export function findGroups(
    entries: MiniEntry[],
    relations: MiniRelation[],
): FoundGroup[] {
    const nameOf = new Map(entries.map((one) => [one.id, one.name]));
    const holds = new Map<string, Set<string>>();

    const add = (ownerId: string, memberId: string) => {
        if (!nameOf.has(ownerId) || !nameOf.has(memberId)) return;
        if (ownerId === memberId) return;

        const set = holds.get(ownerId) ?? new Set<string>();
        set.add(memberId);
        /* 中心も中に入れる。囲みの名札と中身が離れないように */
        set.add(ownerId);
        holds.set(ownerId, set);
    };

    for (const relation of relations) {
        const label = (relation.label ?? "").trim();
        if (!label) continue;

        if (OWNER_IS_TO.some((word) => label.includes(word))) {
            add(relation.to_entry_id, relation.from_entry_id);
            continue;
        }

        if (OWNER_IS_FROM.some((word) => label.includes(word))) {
            add(relation.from_entry_id, relation.to_entry_id);
        }
    }

    const found: FoundGroup[] = [];

    for (const [ownerId, set] of holds) {
        /* 中心のほかに、少なくとも二人 */
        if (set.size < 3) continue;

        found.push({
            key: ownerId,
            name: nameOf.get(ownerId) ?? "",
            ids: [...set],
        });
    }

    /* 大きい囲みから先に描く。小さい囲みが上に乗る */
    return found.sort((a, b) => b.ids.length - a.ids.length);
}

/* ============================================================
 * 2. 囲みの四角
 * ============================================================ */

export interface GroupBox extends Rect {
    key: string;
    name: string;
    ids: string[];
    /** 何番目の囲みか。色を決めるのに使う */
    tone: number;
}

/**
 * 中に入る丸を、ぜんぶ包む四角を出す。
 *
 * ★ 名前のぶんまで包む。
 *   丸だけで測ると、丸の下の名前が囲みからはみ出す。
 */
export function boxesFor(
    groups: FoundGroup[],
    at: Map<string, Point>,
    size: {
        /** 丸の半径 */
        radius: number;
        /** 名前の右端までの、中心からの幅 */
        halfOf: (id: string) => number;
        /** 名前の下端までの、中心からの高さ */
        drop: number;
        /** 外側の余白 */
        pad: number;
        /** 名札のぶん、上を空ける */
        head: number;
    },
): GroupBox[] {
    const out: GroupBox[] = [];

    groups.forEach((group, index) => {
        let x1 = Number.POSITIVE_INFINITY;
        let y1 = Number.POSITIVE_INFINITY;
        let x2 = Number.NEGATIVE_INFINITY;
        let y2 = Number.NEGATIVE_INFINITY;
        let count = 0;

        for (const id of group.ids) {
            const point = at.get(id);
            if (!point) continue;

            count += 1;
            const half = Math.max(size.radius, size.halfOf(id));

            x1 = Math.min(x1, point.x - half);
            x2 = Math.max(x2, point.x + half);
            y1 = Math.min(y1, point.y - size.radius);
            y2 = Math.max(y2, point.y + size.drop);
        }

        /* 図に出ている人が二人に満たなければ、囲まない */
        if (count < 2) return;

        out.push({
            key: group.key,
            name: group.name,
            ids: group.ids,
            tone: index,
            x1: x1 - size.pad,
            y1: y1 - size.pad - size.head,
            x2: x2 + size.pad,
            y2: y2 + size.pad,
        });
    });

    return out;
}

/* ============================================================
 * 3. 線の通り道
 * ============================================================ */

/** 線の一区間が、四角に掛かるか */
function crosses(a: Point, b: Point, box: Rect): boolean {
    /* まず、囲む四角どうしで離れていれば、掛からない */
    if (Math.max(a.x, b.x) < box.x1) return false;
    if (Math.min(a.x, b.x) > box.x2) return false;
    if (Math.max(a.y, b.y) < box.y1) return false;
    if (Math.min(a.y, b.y) > box.y2) return false;

    /* 縦か横の線なら、ここまでで当たり */
    if (a.x === b.x || a.y === b.y) return true;

    /* 斜めの線は、四角の四辺と見比べる */
    const sides: [Point, Point][] = [
        [{ x: box.x1, y: box.y1 }, { x: box.x2, y: box.y1 }],
        [{ x: box.x2, y: box.y1 }, { x: box.x2, y: box.y2 }],
        [{ x: box.x2, y: box.y2 }, { x: box.x1, y: box.y2 }],
        [{ x: box.x1, y: box.y2 }, { x: box.x1, y: box.y1 }],
    ];

    const side = (p: Point, q: Point, r: Point) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

    for (const [c, d] of sides) {
        const s1 = side(a, b, c);
        const s2 = side(a, b, d);
        const s3 = side(c, d, a);
        const s4 = side(c, d, b);

        if (s1 * s2 < 0 && s3 * s4 < 0) return true;
    }

    /* 端が四角の中に入っている */
    const inside = (p: Point) =>
        p.x > box.x1 && p.x < box.x2 && p.y > box.y1 && p.y < box.y2;

    return inside(a) || inside(b);
}

function lengthOf(path: Point[]): number {
    let total = 0;

    for (let i = 1; i < path.length; i += 1) {
        total += Math.abs(path[i].x - path[i - 1].x);
        total += Math.abs(path[i].y - path[i - 1].y);
    }

    return total;
}

function tidyPath(path: Point[]): Point[] {
    const out: Point[] = [];

    for (const point of path) {
        const last = out[out.length - 1];

        if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
            continue;
        }

        out.push(point);
    }

    /* まっすぐ続く三点は、真ん中を落とす */
    const flat: Point[] = [];

    for (let i = 0; i < out.length; i += 1) {
        const before = flat[flat.length - 1];
        const after = out[i + 1];

        if (before && after) {
            const sameX =
                Math.abs(before.x - out[i].x) < 0.5 &&
                Math.abs(out[i].x - after.x) < 0.5;
            const sameY =
                Math.abs(before.y - out[i].y) < 0.5 &&
                Math.abs(out[i].y - after.y) < 0.5;

            if (sameX || sameY) continue;
        }

        flat.push(out[i]);
    }

    return flat;
}

function costOf(path: Point[], blocks: Rect[]): number {
    let hit = 0;

    for (let i = 1; i < path.length; i += 1) {
        for (const block of blocks) {
            if (crosses(path[i - 1], path[i], block)) hit += 1;
        }
    }

    return hit * 10000 + (path.length - 2) * 60 + lengthOf(path) * 0.05;
}

/**
 * 二点を結ぶ、直角に折れた道を出す。
 *
 * ★ まっすぐ引けるなら、まっすぐ引く。
 *
 *   何も邪魔していないのに折れ曲がると、
 *   かえって何が繋がっているのか分からない。
 *
 * ★ 邪魔があるときだけ、よけて回る。
 *
 *   よけ方は、真ん中で折り返す形をいくつか試して、
 *   いちばんぶつからない・いちばん短いものを選ぶ。
 *   細かく探し回るより、この程度で十分に見やすくなる。
 */
export function routeAround(
    from: Point,
    to: Point,
    blocks: Rect[],
    pad: number,
): Point[] {
    /* 近くにある邪魔だけ見る。遠くのものを数えても答えは変わらない */
    const near: Rect[] = [];
    const around = {
        x1: Math.min(from.x, to.x) - pad,
        y1: Math.min(from.y, to.y) - pad,
        x2: Math.max(from.x, to.x) + pad,
        y2: Math.max(from.y, to.y) + pad,
    };

    for (const block of blocks) {
        if (block.x2 < around.x1 || block.x1 > around.x2) continue;
        if (block.y2 < around.y1 || block.y1 > around.y2) continue;
        near.push(block);
    }

    /*
     * ★ 近いものだけに絞る。
     *
     *   人が多い図では、一本ごとに何十もの四角を見比べることになる。
     *   遠くのものを入れても、選ぶ道はほとんど変わらない。
     */
    if (near.length > 14) {
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

        near.sort((a, b) => {
            const da =
                Math.abs((a.x1 + a.x2) / 2 - mid.x) +
                Math.abs((a.y1 + a.y2) / 2 - mid.y);
            const db =
                Math.abs((b.x1 + b.x2) / 2 - mid.x) +
                Math.abs((b.y1 + b.y2) / 2 - mid.y);

            return da - db;
        });

        near.length = 14;
    }

    const straight = [from, to];

    if (near.length === 0) return straight;
    if (costOf(straight, near) < 10000) return straight;

    /* 折り返す場所の候補 */
    const xs = new Set<number>([(from.x + to.x) / 2]);
    const ys = new Set<number>([(from.y + to.y) / 2]);

    for (const block of near) {
        xs.add(block.x1 - pad);
        xs.add(block.x2 + pad);
        ys.add(block.y1 - pad);
        ys.add(block.y2 + pad);
    }

    const tries: Point[][] = [
        [from, { x: to.x, y: from.y }, to],
        [from, { x: from.x, y: to.y }, to],
    ];

    for (const mx of xs) {
        tries.push([
            from,
            { x: mx, y: from.y },
            { x: mx, y: to.y },
            to,
        ]);
    }

    for (const my of ys) {
        tries.push([
            from,
            { x: from.x, y: my },
            { x: to.x, y: my },
            to,
        ]);
    }

    let best = straight;
    let bestCost = costOf(straight, near);

    for (const one of tries) {
        const path = tidyPath(one);
        const cost = costOf(path, near);

        if (cost < bestCost) {
            best = path;
            bestCost = cost;
        }
    }

    return best;
}

/** 点を、行き先のほうへ寄せる */
function toward(at: Point, aim: Point, by: number): Point {
    const dx = aim.x - at.x;
    const dy = aim.y - at.y;
    const length = Math.hypot(dx, dy);

    if (length < 1) return at;

    const step = Math.min(by, length * 0.45);

    return {
        x: at.x + (dx / length) * step,
        y: at.y + (dy / length) * step,
    };
}

/** 道の両端を、丸の手前で止める */
export function trimEnds(path: Point[], by: number): Point[] {
    if (path.length < 2) return path;

    const out = [...path];

    out[0] = toward(out[0], out[1], by);
    out[out.length - 1] = toward(
        out[out.length - 1],
        out[out.length - 2],
        by,
    );

    return out;
}

/** 角を丸めた線の形 */
export function roundedPath(path: Point[], radius: number): string {
    if (path.length < 2) return "";
    if (path.length === 2) {
        return `M${path[0].x} ${path[0].y} L${path[1].x} ${path[1].y}`;
    }

    const parts = [`M${path[0].x} ${path[0].y}`];

    for (let i = 1; i < path.length - 1; i += 1) {
        const before = path[i - 1];
        const here = path[i];
        const after = path[i + 1];

        const inLen = Math.hypot(here.x - before.x, here.y - before.y);
        const outLen = Math.hypot(after.x - here.x, after.y - here.y);
        const r = Math.min(radius, inLen / 2, outLen / 2);

        const a = toward(here, before, r);
        const b = toward(here, after, r);

        parts.push(`L${a.x} ${a.y}`);
        parts.push(`Q${here.x} ${here.y} ${b.x} ${b.y}`);
    }

    const end = path[path.length - 1];
    parts.push(`L${end.x} ${end.y}`);

    return parts.join(" ");
}

/** 道のいちばん長い区間の、真ん中 */
export function middleOf(path: Point[]): Point {
    if (path.length < 2) return path[0] ?? { x: 0, y: 0 };

    let best = 0;
    let bestLen = -1;

    for (let i = 1; i < path.length; i += 1) {
        const len =
            Math.abs(path[i].x - path[i - 1].x) +
            Math.abs(path[i].y - path[i - 1].y);

        if (len > bestLen) {
            bestLen = len;
            best = i;
        }
    }

    return {
        x: (path[best].x + path[best - 1].x) / 2,
        y: (path[best].y + path[best - 1].y) / 2,
    };
}

/* ============================================================
 * 4. まとまりごとに並べ直す
 * ============================================================ */

/**
 * 「整理する」を、まとまりごとにやる。
 *
 * ★ 同じ囲みの人を、近くへ寄せる。
 *
 *   ばらばらのまま囲むと、囲みが紙いっぱいに広がって、
 *   どの囲みも重なってしまう。
 *   先に寄せてから囲めば、囲みは小さく収まる。
 *
 * ★ 二つ以上に入る人は、その囲みたちの真ん中へ置く。
 *   そこに置くと、囲みどうしが自然に重なる。
 *   離れた場所に置くと、囲みが無理に伸びる。
 *
 * ★ どこにも入らない人は、下にまとめて並べる。
 */
export function packByGroup(options: {
    ids: string[];
    groups: FoundGroup[];
    width: number;
    height: number;
    gap: number;
    /** 枠の横と縦の比。並べ終わりの形を、これに近づける */
    aspect: number;
}): Map<string, Point> {
    const { ids, groups, width, height, gap, aspect } = options;

    const place = new Map<string, Point>();
    const shown = new Set(ids);

    /* 誰がどの囲みに入るか */
    const belongs = new Map<string, string[]>();

    for (const group of groups) {
        for (const id of group.ids) {
            if (!shown.has(id)) continue;
            belongs.set(id, [...(belongs.get(id) ?? []), group.key]);
        }
    }

    const live = groups.filter((group) =>
        group.ids.some((id) => shown.has(id)),
    );

    const loners = ids.filter((id) => !belongs.has(id));

    if (live.length === 0) return place;

    /*
     * 囲みごとの「場所取り」。
     *
     * ★ 紙を等分しない。
     *
     *   等分すると、三人の囲みも十人の囲みも同じ幅を取り、
     *   離れたところに置かれる。
     *   掛け持ちの人は、その真ん中に置かれるので、
     *   囲みが横へ長く伸びてしまう。
     *
     *   中身のぶんだけの広さを取って、隣へ詰める。
     *   囲みどうしが近ければ、重なりも小さく済む。
     */
    const tiles = live.map((group) => {
        const only = group.ids.filter(
            (id) => shown.has(id) && (belongs.get(id) ?? []).length === 1,
        );

        const count = Math.max(1, only.length);
        const wide = Math.max(1, Math.ceil(Math.sqrt(count * 1.4)));
        const tall = Math.ceil(count / wide);

        return {
            group,
            only,
            wide,
            tall,
            w: wide * gap + gap * 0.7,
            h: tall * gap * 0.85 + gap * 0.9,
        };
    });

    const loneH = loners.length > 0 ? gap * 1.6 : 0;

    /*
     * 何列にするか。
     *
     * ★ 枠の形に合わせる。
     *
     *   列の数を決め打ちにすると、
     *   横長の枠に縦長の並びができて、
     *   左右が大きく余ったまま全体が縮む。
     *   そのぶん、丸も名前も小さくなる。
     *
     *   並べ終わりの形が枠に近くなる列数を選ぶ。
     */
    const shapeOf = (cols: number) => {
        const rows: (typeof tiles)[] = [];

        for (let i = 0; i < tiles.length; i += cols) {
            rows.push(tiles.slice(i, i + cols));
        }

        const rowW = rows.map((row) =>
            row.reduce((sum, tile) => sum + tile.w, 0),
        );
        const rowH = rows.map((row) =>
            row.reduce((most, tile) => Math.max(most, tile.h), 0),
        );

        const w = Math.max(...rowW, 1);
        const h = rowH.reduce((sum, one) => sum + one, 0) + loneH;

        return { rows, rowW, rowH, w, h };
    };

    let cols = 1;
    let bestOff = Number.POSITIVE_INFINITY;

    for (let n = 1; n <= tiles.length; n += 1) {
        const shape = shapeOf(n);
        const off = Math.abs(
            Math.log(shape.w / shape.h) - Math.log(Math.max(0.2, aspect)),
        );

        if (off < bestOff) {
            bestOff = off;
            cols = n;
        }
    }

    const { rows, rowW, rowH } = shapeOf(cols);

    const totalH = rowH.reduce((sum, one) => sum + one, 0) + loneH;
    const widest = Math.max(...rowW, loners.length * gap);

    /* 紙の真ん中に置く */
    let top = height / 2 - totalH / 2;
    const left = width / 2;

    const center = new Map<string, Point>();

    rows.forEach((row, index) => {
        let x = left - rowW[index] / 2;

        for (const tile of row) {
            center.set(tile.group.key, {
                x: x + tile.w / 2,
                y: top + rowH[index] / 2,
            });
            x += tile.w;
        }

        top += rowH[index];
    });

    /* 一つの囲みにしか入らない人を、その囲みの中に並べる */
    for (const tile of tiles) {
        if (tile.only.length === 0) continue;

        const at = center.get(tile.group.key)!;

        /*
         * ★ 端数の段は、真ん中に寄せる。
         *   左詰めにすると、囲みの右下だけが大きく空く。
         */
        tile.only.forEach((id, index) => {
            const row = Math.floor(index / tile.wide);
            const col = index % tile.wide;
            const inRow = Math.min(
                tile.wide,
                tile.only.length - row * tile.wide,
            );

            place.set(id, {
                x: at.x + (col - (inRow - 1) / 2) * gap,
                y: at.y + (row - (tile.tall - 1) / 2) * gap * 0.85,
            });
        });
    }

    /* 掛け持ちの人は、入っている囲みの真ん中へ */
    const shared = ids.filter((id) => (belongs.get(id) ?? []).length > 1);

    shared.forEach((id, index) => {
        const keys = belongs.get(id)!;
        let sx = 0;
        let sy = 0;
        let count = 0;

        for (const key of keys) {
            const at = center.get(key);
            if (!at) continue;
            sx += at.x;
            sy += at.y;
            count += 1;
        }

        if (count === 0) return;

        /* 同じところに重ならないよう、少しずらす */
        const turn = (Math.PI * 2 * index) / Math.max(1, shared.length);

        place.set(id, {
            x: sx / count + Math.cos(turn) * gap * 0.35,
            y: sy / count + Math.sin(turn) * gap * 0.35,
        });
    });

    /* どこにも入らない人は、下にひと並び。囲みは付けない */
    if (loners.length > 0) {
        const wide = Math.max(
            1,
            Math.min(loners.length, Math.floor(widest / gap) || 1),
        );

        loners.forEach((id, index) => {
            const col = index % wide;
            const row = Math.floor(index / wide);

            place.set(id, {
                x: left + (col - (wide - 1) / 2) * gap,
                y: top + gap * 0.9 + row * gap * 0.85,
            });
        });
    }

    return place;
}
