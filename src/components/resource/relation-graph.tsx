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

/*
 * 板の横と縦の比。
 *
 * ★ 横長にする。
 *
 *   前は正方形だった。枠は横に長いので、
 *   正方形の図を入れると左右が大きく空く。
 *   その空きぶん、図は縦に合わせて縮み、
 *   文字が小さくなっていた。
 *
 *   枠と同じ形にすれば、空きが減り、
 *   同じ枠でも大きく描ける。
 */
const ASPECT = 1.6;
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
const MIN_GAP = 82;
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

/*
 * ============================================================
 * 関係の色は、6 つにまとめる
 *
 * ★ 47 種類を 47 色にしても、人は覚えられない。
 *
 *   前は関係の名前ごとに違う色を振っていた。
 *   色の数だけ凡例が並び、図そのものより
 *   下の帯のほうが賑やかになっていた。
 *
 *   色で分けるのは「どういう間柄か」の大枠だけにする。
 *   細かい名前は、線に触れたときに出す。
 *
 * ★ 6 つにしたのは、一目で覚えられる数だから。
 *   これ以上増やすと、また覚えられなくなる。
 *
 * ★ どれにも当てはまらないものは「その他」。
 *   作者が自分で付けた名前は、そこへ入る。
 * ============================================================
 */
export const RELATION_GROUPS: {
    key: string;
    label: string;
    color: string;
    words: string[];
}[] = [
    {
        key: "family",
        label: "家族・恋愛",
        color: "#d9738f",
        words: [
            "兄弟", "姉妹", "家族", "夫婦", "片想い", "片思い", "許嫁",
            "息子", "娘", "祖父", "祖母", "叔父", "叔母", "伯父", "伯母",
            "従兄", "従弟", "従姉", "従妹", "親子", "義理",
            "父", "母", "兄", "弟", "姉", "妹", "親", "子", "祖",
            "恋", "婚", "想い", "血縁",
        ],
    },
    {
        key: "friend",
        label: "友好",
        color: "#3f9a7a",
        words: [
            "親友", "友人の友人", "クラスメイト", "知り合い", "知人",
            "仲間", "同級", "同期", "相棒", "味方", "協力", "協定",
            "同盟", "推し", "庇護", "恩人", "友",
        ],
    },
    {
        key: "enemy",
        label: "敵対",
        color: "#c4453a",
        words: [
            "敵", "対立", "宿敵", "仇", "復讐", "憎", "苦手", "不信",
            "襲撃", "殺", "裏切", "ライバル", "競",
        ],
    },
    {
        key: "belong",
        label: "所属・仕事",
        color: "#3a6ea8",
        words: [
            "従者", "部下", "上司", "同僚", "所属", "眷属", "奴隷",
            "使役", "手駒", "器物", "利用", "雇", "仕事", "取引", "臣",
            "主従", "駒",
        ],
    },
    {
        key: "master",
        label: "師弟",
        color: "#b5852f",
        words: ["師弟", "師匠", "弟子", "先輩", "後輩", "教え子", "指導", "門下", "師"],
    },
    {
        key: "other",
        label: "その他",
        color: "#8a8f93",
        words: [],
    },
];

/*
 * 言葉と大枠の対応。長いものから先に見る。
 *
 * ★ 短い言葉から当てると、取り違える。
 *
 *   「師弟」は「弟」に当たって家族になり、
 *   「親友」は「親」に当たって家族になっていた。
 *   「従者」も「従（従兄弟）」に当たっていた。
 *
 *   長い言葉を先に見れば、
 *   師弟・親友・従者のほうが先に当たる。
 */
const GROUP_WORDS = RELATION_GROUPS.flatMap((group) =>
    group.words.map((word) => ({ word, group })),
).sort((a, b) => b.word.length - a.word.length);

/** その関係が、どの大枠に入るか */
export function groupOf(label: string) {
    const text = label.trim();

    for (const one of GROUP_WORDS) {
        if (text.includes(one.word)) return one.group;
    }

    return RELATION_GROUPS[RELATION_GROUPS.length - 1];
}

function colorOf(label: string): string {
    return groupOf(label).color;
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
     * その人を中心に見るか。
     *
     * ★ 初めから入れておく。
     *
     *   人が増えるほど、全部を一度に見ても読めない。
     *   誰かを押した時点で、その人の周りだけになるほうが
     *   知りたいことに近い。
     *
     *   全体を見たい人は、押し具で外せる。
     */
    const [isFocusMode, setIsFocusMode] = useState(true);

    /*
     * いま見ている章。null は全部の時点。
     *
     * ★ 小説の関係は、話が進むと変わる。
     *
     *   最初は敵、途中で協力、最後は仲間。
     *   全部を一枚に重ねると、
     *   「3章の時点では誰と誰が知り合いだったか」が分からない。
     *
     * ★ 登場する章を決めていない人は、どの章でも出る。
     *   入れた人だけが絞られる。
     */
    const [chapter, setChapter] = useState<number | null>(null);

    /*
     * この作品で使われている章。
     *
     * 誰かが入れている章だけを並べる。
     * 1 から順に全部出すと、使っていない章まで押せてしまう。
     */
    const allChapters = Array.from(
        new Set(entries.flatMap((entry) => entry.chapters ?? [])),
    ).sort((a, b) => a - b);

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
    /*
     * ★ 初めは「ふつう」。
     *
     *   長くするほど図は広がるが、枠に収めるぶん
     *   全部が縮んで名前が読めなくなる。
     *   まず読める大きさから始めて、
     *   足りなければ伸ばしてもらう。
     */
    const [spreadAt, setSpreadAt] = useState(1);

    const spread = SPREADS[spreadAt].value;
    /*
     * 板の大きさ。
     *
     * ★ 縦は今までどおり。横だけ広げる。
     *   縦を変えると、置いた場所が縦にずれる。
     *   横に広げるぶんには、右に余地ができるだけで
     *   すでに置いた丸は動かない。
     */
    const HEIGHT = Math.round(BASE_SIZE * spread);
    const WIDTH = Math.round(HEIGHT * ASPECT);
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    const RADIUS_X = BASE_RADIUS * spread * ASPECT;
    const RADIUS_Y = BASE_RADIUS * spread;
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
     * ============================================================
     * その人を中心に見る
     *
     * ★ 選んだ人と、直につながる人だけを残す。
     *
     *   47 人を薄くして残しても、地は埋まったまま。
     *   関わりのない人は、出さない。
     *
     * ★ 選んだ人を真ん中に置き、まわりに輪で並べる。
     *
     *   置いた場所をそのまま使うと、
     *   選んだ人が端にいたとき、輪が画面の外へ出る。
     *   中心に据え直せば、何人いても収まる。
     *
     * ★ 元の並びは壊さない。
     *   ここで作るのは、見せ方だけ。
     *   置いた場所は表に残したまま。
     * ============================================================
     */
    /*
     * その章に出る人か。
     *
     * 決めていない（空）人は、どの章でも出る。
     * 決めていない人まで消すと、
     * 何も入力していない作品では図が空になる。
     */
    function inChapter(node: { chapters?: number[] | null }) {
        if (chapter === null) return true;
        const list = node.chapters;
        if (!list || list.length === 0) return true;
        return list.includes(chapter);
    }

    const focusId = isFocusMode ? selectedId : null;

    /** 選んだ人と、直につながる人 */
    const focusIds = (() => {
        if (!focusId) return null;

        const near = new Set<string>([focusId]);
        for (const relation of relations) {
            if (relation.from_entry_id === focusId) near.add(relation.to_entry_id);
            if (relation.to_entry_id === focusId) near.add(relation.from_entry_id);
        }
        return near;
    })();

    /* 出す人。章で絞り、中心に見るときは近い人だけ */
    const inChapterNodes = nodes.filter(inChapter);
    const shownNodes = focusIds
        ? inChapterNodes.filter((node) => focusIds.has(node.id))
        : inChapterNodes;

    const shownIds = new Set(shownNodes.map((node) => node.id));

    /*
     * 出す線。
     *
     * ★ 両端とも出ている人でなければ、線も出さない。
     *   片方が消えている線は、どこへも繋がらない。
     */
    const shownRelations = relations.filter((relation) => {
        if (!shownIds.has(relation.from_entry_id)) return false;
        if (!shownIds.has(relation.to_entry_id)) return false;

        if (focusId) {
            return (
                relation.from_entry_id === focusId ||
                relation.to_entry_id === focusId
            );
        }
        return true;
    });

    const positions = new Map<string, { x: number; y: number }>();

    if (focusId && focusIds) {
        /* 真ん中に、選んだ人 */
        positions.set(focusId, { x: CENTER_X, y: CENTER_Y });

        const around = shownNodes.filter((node) => node.id !== focusId);

        /*
         * まわりの輪。
         *
         * 人数が少ないときは小さく、多いときは大きく。
         * いつも同じ大きさだと、2 人のときに間が空きすぎる。
         */
        const tight = Math.min(1, Math.max(0.45, around.length / 10));

        around.forEach((node, index) => {
            const angle = (Math.PI * 2 * index) / around.length - Math.PI / 2;
            positions.set(node.id, {
                x: CENTER_X + Math.cos(angle) * RADIUS_X * tight,
                y: CENTER_Y + Math.sin(angle) * RADIUS_Y * tight,
            });
        });
    } else {
    nodes.forEach((node, index) => {
        const saved = dragging?.id === node.id ? dragging.position : layout[node.id];
        if (saved) {
            positions.set(node.id, saved);
            return;
        }
        // 上から時計回りに並べる
        const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
        positions.set(node.id, {
            /* 板が横長なので、輪も横長にする */
            x: CENTER_X + Math.cos(angle) * RADIUS_X,
            y: CENTER_Y + Math.sin(angle) * RADIUS_Y,
        });
    });
    }

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
            x: Math.min(WIDTH - margin, Math.max(margin, point.x)),
            y: Math.min(HEIGHT - margin, Math.max(margin, point.y)),
        };
    }

    /** 図の中の座標に直す。画面の大きさが変わっても合うように */
    /*
     * ★ 中心に見ているときは、掴んで動かさない。
     *
     *   並びはこちらで決めているので、動かしても
     *   全体に戻したときには残らない。
     *   動くのに残らないのは、いちばん困る。
     */
    function toGraphPoint(event: { clientX: number; clientY: number }) {
        const svg = svgRef.current;
        if (!svg) return null;

        const rect = svg.getBoundingClientRect();

        /*
         * ★ 板と器の形は、そろえてある。
         *
         *   板の比（ASPECT）を、そのまま器にも掛けてある。
         *   余白が入らないので、枠の幅と高さで割ればよい。
         */
        return {
            x: ((event.clientX - rect.left) / rect.width) * WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
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
                place.set(sorted[at].id, { x: CENTER_X, y: CENTER_Y });
                at += 1;
                ring += 1;
                continue;
            }

            /*
             * 輪の大きさ。板が横長なので、横と縦で別に持つ。
             * 同じにすると、縦だけ先に端へ着いて詰まる。
             */
            const ry = Math.min(
                CENTER_Y - NODE_RADIUS - 8,
                (want * ring) / 1.6,
            );
            const rx = Math.min(CENTER_X - NODE_RADIUS - 8, ry * ASPECT);

            /* この輪に入る数。詰めすぎない */
            const room = Math.max(1, Math.floor((Math.PI * (rx + ry)) / want));
            const count = Math.min(room, sorted.length - at);

            for (let i = 0; i < count; i += 1) {
                const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
                place.set(sorted[at + i].id, {
                    x: CENTER_X + Math.cos(angle) * rx,
                    y: CENTER_Y + Math.sin(angle) * ry,
                });
            }

            at += count;
            ring += 1;

            /* 輪を増やしても入らないときは、そこで止める */
            if (ry >= CENTER_Y - NODE_RADIUS - 8 && count === 0) break;
        }

        untangle(place, new Set());

        for (const node of nodes) {
            const point = place.get(node.id);
            if (point) onMove(node.id, point);
        }
    }

    const active = hoveredId ?? selectedId;
    /*
     * この作品で使われている、関係の大枠。
     *
     * 47 種類の名前を、6 つにまとめたもの。
     * 凡例には、これだけを出す。
     */
    const usedGroups = RELATION_GROUPS.filter((group) =>
        relations.some((relation) => groupOf(relation.label).key === group.key),
    );

    const body = (
        <div className="flex h-full flex-col">
            {/*
              * 章で絞る。
              *
              * ★ 誰かが章を入れているときだけ出す。
              *
              *   何も入力していない作品に出しても、
              *   どれを押しても同じ図になる。
              *   使えないものは置かない。
              */}
            {allChapters.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10.5px] text-faint">章で見る</span>

                    <button
                        type="button"
                        onClick={() => setChapter(null)}
                        aria-pressed={chapter === null}
                        className={[
                            "rounded-md border px-2.5 py-0.5 text-[11px]",
                            chapter === null
                                ? "border-forest bg-forest-tint/60 text-forest"
                                : "border-line text-muted hover:border-forest-line",
                        ].join(" ")}
                    >
                        全部
                    </button>

                    {allChapters.map((one) => (
                        <button
                            key={one}
                            type="button"
                            onClick={() => setChapter(one)}
                            aria-pressed={chapter === one}
                            className={[
                                "rounded-md border px-2.5 py-0.5 text-[11px]",
                                chapter === one
                                    ? "border-forest bg-forest-tint/60 text-forest"
                                    : "border-line text-muted hover:border-forest-line",
                            ].join(" ")}
                        >
                            {one}章
                        </button>
                    ))}
                </div>
            )}

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
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
                /*
                 * ★ 幅で決めて、高さは板の比に合わせる。
                 *   枠は横に長いので、幅のほうが先に足りなくなる。
                 * ★ 50% が枠ぴったり。だから 2 倍して渡す。
                 */
                style={{
                    width: `${zoom * 2}%`,
                    aspectRatio: `${ASPECT} / 1`,
                    height: "auto",
                }}
                role="img"
                aria-label="関係図"
                onPointerMove={(event) => {
                    if (focusId) return;
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

                {shownRelations.map((relation) => {
                    const from = positions.get(relation.from_entry_id);
                    const to = positions.get(relation.to_entry_id);
                    if (!from || !to) return null;

                    /* この線が、いま選んでいる人につながっているか */
                    const touchesActive =
                        !!active &&
                        (relation.from_entry_id === active ||
                            relation.to_entry_id === active);

                    const isActive = !active || touchesActive;

                    // 中心へ少し引き寄せて曲げる。直線だけだと線が重なって読めない
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    const controlX = midX + (CENTER_X - midX) * 0.35;
                    const controlY = midY + (CENTER_Y - midY) * 0.35;

                    return (
                        /*
                          * ★ 選んでいる人から遠い線は、ほとんど消す。
                          *
                          *   前は 0.15 で残していたが、
                          *   47 本もあると、薄くても地が埋まる。
                          *   見るべき線だけを残す。
                          */
                        <g key={relation.id} opacity={isActive ? 1 : 0.06}>
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
                             * ★ ふだんは出さない。
                             *
                             *   47 本あれば、47 個の札が中央に散らばる。
                             *   図の真ん中が文字で埋まり、
                             *   どの線を見ればよいのか分からなくなる。
                             *
                             *   誰かを選んだとき、その人につながる線にだけ出す。
                             *   知りたいのは「いま見ている人との間柄」なので、
                             *   それで足りる。
                             *
                             * ★ 白い札で囲む。
                             *   線の上に直に置くと、線が字を横切って読めない。
                             */}
                            {relation.label && touchesActive && (
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
                                        fontSize="12"
                                        fill={colorOf(relation.label)}
                                    >
                                        {relation.label}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}

                {shownNodes.map((node) => {
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
                                /* 中心に見ているときは、押して選ぶだけ */
                                if (focusId || !onMove) {
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
                                    fontSize="18"
                                    fontWeight="600"
                                    fill="var(--color-forest)"
                                >
                                    {Array.from(node.name)[0] ?? "?"}
                                </text>
                            )}

                            <text
                                x={position.x}
                                y={position.y + NODE_RADIUS + 17}
                                textAnchor="middle"
                                /*
                                 * ★ 枠に収めるほど、文字は縮む。
                                 *
                                 *   図は枠いっぱいに縮めて描くので、
                                 *   紐を長くするほど文字も小さくなる。
                                 *   名前が読めなければ、図の意味がない。
                                 *
                                 *   丸に対して字を大きくする。
                                 *   重なりは、丸どうしの間（MIN_GAP）で防ぐ。
                                 */
                                fontSize="14"
                                fontWeight="500"
                                fill="var(--color-ink)"
                            >
                                {node.name.length > 8
                                    ? `${node.name.slice(0, 8)}…`
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

                        {/*
                          * ★ 中心に見ているときは、出さない。
                          *   並びはこちらで決めているので、
                          *   押しても何も起きない。
                          */}
                        {!focusId && (
                            <button
                                type="button"
                                onClick={tidy}
                                className="rounded-md border border-forest bg-surface px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                            >
                                整理する
                            </button>
                        )}
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
              *
              * ★ 6 つだけ出す。
              *
              *   前は関係の名前をぜんぶ並べていた。
              *   作品によっては 47 個あり、5 段になって
              *   図より下の帯のほうが賑やかだった。
              *
              *   色で分けるのは「どういう間柄か」の大枠だけ。
              *   細かい名前は、その人を選んだときに線の上へ出る。
              *
              * ★ 使われている大枠だけ出す。
              *   その作品に無い色を並べても意味がない。
              */}
            <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                {usedGroups.map((group) => (
                    <li
                        key={group.key}
                        className="flex items-center gap-2 text-xs text-muted"
                    >
                        <svg width="26" height="6" aria-hidden="true">
                            <line
                                x1="0"
                                y1="3"
                                x2="26"
                                y2="3"
                                stroke={group.color}
                                strokeWidth="2.6"
                                strokeLinecap="round"
                            />
                        </svg>
                        {group.label}
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-center text-xs text-faint">
                {chapter !== null
                    ? `${chapter}章に出る人だけを出しています。章を決めていない人は、どの章でも出ます。`
                    : focusId
                    ? "この人と直につながる人だけを出しています。実線は変化を記録した関係です。"
                    : active
                      ? "実線は変化を記録した関係、破線はまだ記録がない関係です。"
                      : "丸を押すと、その人を中心にした図になります。"}
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
