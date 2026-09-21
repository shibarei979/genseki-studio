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
import {
    AUTHORED,
    assignColors,
    boxesFor,
    curveRoute,
    findGroups,
    LEAD_KEY,
    type CurveRoute,
    middleOf,
    packByGroup,
    pathAround,
    roundedPath,
    trimEnds,
    type GroupBox,
} from "@/lib/resource/graph-groups";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";

import type { ResourceEntry, ResourcePage, ResourceRelation } from "@/types";

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
    /**
     * 線の中間点を動かしたとき。
     *
     * null を渡すと、これまでどおりの曲げ方に戻る。
     */
    onBend?: (relationId: string, bend: { x: number; y: number } | null) => void;
    /**
     * 資料のページ。
     *
     * ★ 組分けのときに、欄の見出しを読むために使う。
     *   「所属する人」「所属」といった欄がどこにあるかは、
     *   ページの作りを見ないと分からない。
     */
    pages?: ResourcePage[];
    /**
     * 右の欄で組を作ったり直したりしたときに、数が増える。
     *
     * ★ 増えたら、囲みを出す。並びは変えない。
     *   人を一人足すたびに全員が動くと、
     *   どこに誰がいたか分からなくなる。
     *   並べ直したいときは「組み直す」を押してもらう。
     */
    groupsTouched?: number;
    /**
     * 主人公を選ぶ（null で選ばない＝役割から決める）。
     * 渡されないときは、選ぶ欄を出さない。
     */
    onSetLead?: (entryId: string | null) => Promise<void> | void;
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


/*
 * 紐の長さ。丸どうしの離れ具合。
 *
 * 板の大きさは、この値で決まる。
 * 図の外でも使うので、部品の外に置く。
 */
/*
 * ★ 紙は、枠よりずっと広く取る。
 *
 *   つまみを小さくすると、その広い紙の全体が
 *   枠の中に小さく見える。丸は隅々まで置ける。
 *
 *   つまみを大きくすると、紙の一部が
 *   枠いっぱいに拡大され、送って見る。
 *
 *   前は 1.5（960×600）で、枠とほぼ同じ広さだった。
 *   だから小さくしても、置ける範囲が広がらなかった。
 *
 *   4.0 なら 2560×1600。枠のおよそ 2.7 倍の広さ。
 */
/*
 * ★ 紙の広さは、つまみで決める。
 *
 *   人が増えるほど窮屈になるので、
 *   広い紙を使えるようにする。
 *
 *   ここに書いてあるのは、いちばん狭いときの値。
 *   広げるときは、これに倍率を掛ける。
 */
const SPREAD = 2.5;

/* 紙の形。広さが変わっても、形は変わらない */
const DRAWN_ASPECT = ASPECT;
const BASE_RADIUS = 142;

/*
 * 丸どうしの、いちばん近い間。
 *
 * ★ 丸の直径に、名前のぶんを足す。
 *   名前は丸の下に出るので、縦に重なりやすい。
 */
const MIN_GAP = 54;
/*
 * 丸の大きさ。
 * 頭文字が読める大きさにする。小さいと点にしか見えない。
 */
/*
 * ★ 紙を広げたぶん、丸と字も大きくする。
 *
 *   紙は 2560×1600。枠に全体を収めると 0.6 倍ほどに縮む。
 *   丸の半径 21 は画面で 13px、字の 14 は 8.6px。
 *   小さすぎて読めない。
 *
 *   1.7 倍にしておけば、全体を見たときに
 *   丸 22px、字 15px ほどになる。
 */
/*
 * 丸の大きさ。紙の高さに対する割合で決める。
 *
 * ★ これまでは、紙の広さに関わらず 36 で固定だった。
 *
 *   紙は人数に合わせて広げるので、
 *   広げるほど丸だけが取り残されて小さくなる。
 *   全体を出すと、丸が 20px、名前が 8px しかなく、
 *   何が書いてあるのか読めなかった。
 *
 *   割合で持てば、どの広さでも同じ大きさに見える。
 *
 * ★ 0.03 は、紙の高さの 3 パーセント。
 *   30 人を輪に並べたときの間（紙の高さの 15% ほど）に対して、
 *   丸の直径がその 4 割ほどになる。
 *   名前が読めて、隣とぶつからない大きさ。
 */
const NODE_SHARE = 0.03;

/*
 * 線の端を、丸の手前で止める幅。
 *
 * ★ 矢印が丸の下に潜っていた。
 *
 *   線を丸の中心から中心まで引いていたので、
 *   矢の先が相手の丸に隠れて見えなかった。
 *   向きを決めても、向きが分からない図になっていた。
 *
 *   丸の縁より、少し手前で止める。
 */
const HALO_SHARE = 0.28;

/*
 * 同じ二人を結ぶ線が重なるとき、どれだけ外へ張り出すか。
 *
 * ★ 行きと帰りを、別々の弧にする。
 *
 *   「AはBを慕う」「BはAを疎む」のように、
 *   両方向を入れる人がいる。
 *   まっすぐ引くと二本が完全に重なり、
 *   後から引いたほうしか見えなかった。
 */
const BOW_SHARE = 1.3;

/**
 * 点を、行き先のほうへ少し引っ込める。
 *
 * ★ 短い線では、引っ込めすぎない。
 *   丸どうしが近いと、線が裏返ってしまう。
 */
function pullBack(
    at: { x: number; y: number },
    toward: { x: number; y: number },
    by: number,
) {
    const dx = toward.x - at.x;
    const dy = toward.y - at.y;
    const length = Math.hypot(dx, dy);

    if (length < 1) return at;

    const step = Math.min(by, length * 0.42);

    return {
        x: at.x + (dx / length) * step,
        y: at.y + (dy / length) * step,
    };
}

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

/**
 * 相関図のときの、関係の線の色。
 *
 * ★ はっきりした色にする。
 *   ふだんの図の線は、図の上に何十本も重なるので控えめにしてある。
 *   相関図は線と名前で読むものなので、線そのものを見せる。
 */
/*
 * ★ 見分けやすい六色。濃いめにして、白い地の上ではっきり見えるように。
 *   前の色はくすんでいて、紙の上で沈んでいた。
 *   橙・青・赤・緑・紫・灰と、色みそのものを離してある。
 */
const STRONG_COLORS: Record<string, string> = {
    family: "#d9650b",
    friend: "#1c5fd0",
    enemy: "#d42a2a",
    belong: "#17875a",
    master: "#7a45c8",
    other: "#50565e",
};

/* 名前・関係名の字。読みやすさを優先して黒 */
const INK = "#1a1a1a";

function strongColorOf(label: string): string {
    return STRONG_COLORS[groupOf(label).key] ?? STRONG_COLORS.other;
}

/**
 * 色を暗くする。組の名前を、組の色の濃いめで書くのに使う。
 */
function darken(hex: string, amount: number): string {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return hex;

    const part = (at: number) =>
        Math.round(parseInt(clean.slice(at, at + 2), 16) * (1 - amount))
            .toString(16)
            .padStart(2, "0");

    return `#${part(0)}${part(2)}${part(4)}`;
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
    onBend,
    pages = [],
    groupsTouched = 0,
    onSetLead,
}: Props) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    /*
     * 囲みを出すか。
     *
     * ★ 会員でも、切れるようにしておく。
     *   見比べたいときや、囲みが邪魔なときがある。
     */
    /*
     * 組分けしているか。
     *
     * ★ 押したときに組を作る。ずっと出しっぱなしにはしない。
     *
     *   前は「囲む」を切り替えるだけで、
     *   組が一つも見つからないときは何も起きなかった。
     *   押しても変わらないので、壊れているように見えた。
     *
     *   押したら、その時点の図と資料から組を作り、
     *   組ごとに並べ直す。見つからなければ、そう伝える。
     *
     * ★ 覚えておく。開き直すたびに解けると、また押し直すことになる。
     */
    const [grouped, setGrouped] = useState(false);

    /* 組分けの結果を、一行で伝える */
    const [groupNote, setGroupNote] = useState("");

    /* 組分けを解いたあとに、並べ直すか */
    const retidy = useRef(false);

    /*
     * 関係名を出しておくか（組分けのとき）。
     *
     * ★ 隠したときは、組分けしていないときと同じ。
     *   人に触れる・選ぶと、その人の線にだけ名前が出る。
     */
    const [showNames, setShowNames] = useState(true);

    /* どの作品の図か。組分けを覚えておく鍵に使う */
    const workKey = entries[0]?.work_id ?? "";

    useEffect(() => {
        if (!workKey) return;

        try {
            setGrouped(
                window.localStorage.getItem(`graph-grouped:${workKey}`) === "1",
            );
        } catch {
            /* 覚えられなくても、図は描ける */
        }
    }, [workKey]);

    useEffect(() => {
        if (!workKey) return;

        try {
            setShowNames(window.localStorage.getItem(`graph-names:${workKey}`) !== "0");
        } catch {
            /* 覚えられなくても、図は描ける */
        }
    }, [workKey]);

    function rememberShowNames(on: boolean) {
        setShowNames(on);

        try {
            window.localStorage.setItem(`graph-names:${workKey}`, on ? "1" : "0");
        } catch {
            /* 覚えられなくても、図は描ける */
        }
    }

    function rememberGrouped(on: boolean) {
        setGrouped(on);

        try {
            if (on) {
                window.localStorage.setItem(`graph-grouped:${workKey}`, "1");
            } else {
                window.localStorage.removeItem(`graph-grouped:${workKey}`);
            }
        } catch {
            /* 覚えられなくても、図は描ける */
        }
    }

    /*
     * 会員かどうか。
     *
     * ★ 決めるのは、ここだけ。
     *
     *   上から「使ってよい」と渡せる口は作らない。
     *   渡せるようにすると、図を置くどの画面からでも
     *   入れてしまえる。サーバーの答えだけを見る。
     *
     * ★ 答えが返るまでは、無料の見た目。
     *   先に囲みを出しておいて、あとから消えるほうが驚く。
     *
     * ★ 聞けなかったときも、無料の見た目。
     *   困るのは、入っていない人に出てしまうほう。
     */
    const { graphGroup: mayGroup } = useMemberFeatures();

    /*
     * 右の欄で組をいじったら、囲みを出す。
     *
     * ★ 最初の一回（0）では何もしない。
     *   開いただけで組分けに切り替わると驚く。
     */
    useEffect(() => {
        if (groupsTouched <= 0) return;

        rememberGrouped(true);
        setGroupNote(
            "右で作った組を図に出しました。組ごとに並べ直すときは「組み直す」を押してください。",
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupsTouched]);

    /*
     * いま、どの線の中間点をつまんでいるか。
     *
     * ★ 丸を動かすのとは、別に持つ。
     *   同じ入れ物にすると、どちらを動かしているのか
     *   分からなくなる。
     */
    /*
     * 中間点を出している線。
     *
     * 線を二度押すと出る。もう一度押すと引っ込む。
     */
    /* 名前で探すときの、打った字 */
    const [findText, setFindText] = useState("");

    const [openBendId, setOpenBendId] = useState<string | null>(null);

    const [bending, setBending] = useState<{
        id: string;
        position: { x: number; y: number };
    } | null>(null);

    /*
     * その人を中心に見るか。
     *
     * ★ 初めは入れない。
     *
     *   入れて出していたが、丸を押した瞬間に
     *   その人が中心へ据え直され、掴んで動かせなくなった。
     *   並びをこちらが決めている間は、動かしても残らないため。
     *
     *   「真ん中以外動かせない」という声は、これ。
     *
     *   ふだんは、押したら選ぶだけ。動かせる。
     *   中心に見たい人が、押し具で切り替える。
     */
    const [isFocusMode, setIsFocusMode] = useState(false);

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
    /*
     * 図の大きさ。
     *
     * ★ いつも枠ぴったり。選ばせない。
     *
     *   前は 25〜100% から選べて、画面いっぱいにも広げられた。
     *   押し具が 2 段になり、どれを触ればよいのか分からない。
     *
     *   紐の長さを変えれば、詰まり具合は調えられる。
     *   大きさまで持たせる必要がなかった。
     */
    /*
     * 大きさ。つまみ 1 つで決める。
     *
     * ★ 0 で丸が小さく、100 で大きい。
     *
     *   中では「紐の長さ」を動かしている。
     *   図は枠いっぱいに縮めて描くので、
     *   紐を長くすると全体が縮み、丸が小さくなる。
     *   短くすると丸が大きくなる。
     *
     *   押し具を 2 段に分けていたが、
     *   触る人にとっては「大きさ」ひとつで足りる。
     *
     * ★ 図はいつも枠ぴったり。送りは出ない。
     */




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
    /*
     * つまみの値。0〜100。
     *
     * ★ 右へ動かすほど、丸が大きい。
     *
     *   中では紐の長さを動かしている。
     *   紐が短いほど図が詰まり、枠に収めたときに丸が大きくなる。
     *   つまり、つまみと紐の長さは逆向き。
     */
    /*
     * 大きさ。0〜100。
     *
     * ★ 大きな一枚を、拡げたり縮めたりして見る。
     *
     *   前は「枠にぴったり収める」作りだった。
     *   人が増えるほど全体が縮み、名前が読めなくなる。
     *
     *   一枚の大きさを変えられるようにして、
     *   見たいところへ送って見てもらう。
     *
     * ★ 初めは、いちばん大きい。
     *   小さく出して「読めない」と思われるより、
     *   大きく出して「送れば見える」ほうがよい。
     */
    /*
     * ★ 初めは、枠ぴったり。
     *   つまみの 38 あたりで 1.0 倍になる。
     */
    /*
     * ★ 初めは、枠ぴったり。
     *
     *   つまみの真ん中が 1.0 倍。
     *   左端で 0.35 倍、右端で 1.9 倍。
     *
     *   前は右半分で大きくならなかった。
     *   板の外まで描こうとしていたので、
     *   はみ出したぶんが切れていた。
     */
    /*
     * ★ 初めは、紙が枠ぴったりのところ。
     *   そこから、引いて眺めるか、寄って読むか。
     */
    /*
     * 紙の広さ。0〜100。
     *
     * ★ つまみは 1 つで足りる。
     *
     *   紙を広げると、枠に収めるぶん見かけが縮む。
     *   狭めると、枠に収まらず送って見ることになる。
     *   これは拡大・縮小と同じことをしている。
     *
     *   前は「広さ」と「拡大」の 2 つを並べていたが、
     *   触る人からは同じ動きに見える。
     *
     * ★ 右へ動かすほど、広い紙。
     *
     *   100 いちばん広い。全体が枠に収まり、小さく見える
     *   0   狭い紙。丸が詰まり、送って見る
     */
    const [wideValue, setWideValue] = useState(100);

    /*
     * 送る枠。
     *
     * 大きさを変えたとき、真ん中が見えるように寄せ直す。
     */
    const panRef = useRef<HTMLDivElement>(null);

    /*
     * 枠の高さ。図の大きさを、実寸で出すのに使う。
     *
     * 割合で指定すると、入れ物の作りによって
     * 伸びたり伸びなかったりする。
     */
    const [box, setBox] = useState({ w: 0, h: 0 });

    /*
     * 枠にちょうど収まる高さ。
     *
     * 板は横長なので、枠の形によっては
     * 横が先に足りなくなる。両方を見て、小さいほうに合わせる。
     */
    /*
     * 紙の形を、枠に合わせる。
     *
     * ★ 形が違うと、必ず余白が出る。
     *
     *   紙を 1.6 で固定していた。枠の形は画面によって
     *   1.4 のことも 1.8 のこともある。
     *   収めたときに、上下か左右が必ず余っていた。
     *
     *   枠と同じ形にすれば、ぴったり収まる。
     *   余白が消えて、そのぶん広く使える。
     *
     * ★ 測れていないあいだは、1.6 のまま。
     */
    const liveAspect = box.w && box.h ? box.w / box.h : DRAWN_ASPECT;


    /*
     * つまみから、倍率を出す。
     *
     * ★ 紙は一枚。広さは変わらない。つまみは倍率だけ。
     *
     *   0   紙の全体を、遠くから眺める。
     *       枠のまわりに余白が出るが、形は掴める。
     *
     *   39  紙が枠にぴったり。
     *
     *   100 紙の一部が、枠いっぱいに拡大される。
     *       見たいところへ送って見る。
     *
     * ★ 余白の外へは、丸を置けない。
     *   そこは紙ではないので。
     *   紙の端までは行ける（壁は丸の縁ぶんだけ）。
     *
     * ★ 掛け算で伸ばす。
     *   足し算だと、小さいほうの差が目盛りに出ない。
     */
    /*
     * 見かけの倍率。
     *
     * ★ つまみは「どれだけ大きく見えるか」を動かす。
     *
     *   1.0  枠ぴったり。全体が見える
     *   2.5  いちばん大きい。送って見る
     *
     * ★ 前は、いちばん大きいところで 9 倍あった。
     *
     *   丸ひとつが 130px ほどになり、
     *   枠が二、三人で埋まってしまっていた。
     *
     *   そのうえ変わり方が偏っていて、
     *   左の四分の一で一気に大きくなり、
     *   残りの四分の三はほとんど動かなかった。
     *
     *   倍率をそのまま目盛りにすれば、
     *   どこを掴んでも同じだけ変わる。
     */
    const zoom = 1 + ((100 - wideValue) / 100) * 1.5;

    /*
     * 紙の広さ。
     *
     * ★ 倍率から、逆に出す。
     *
     *   紙を狭めると、同じ丸が詰まって見える。
     *   枠に収めたときの見かけは、広さの二乗で効くので、
     *   広さは 3 ÷ √倍率 になる。
     */
    const wide = 3 / Math.sqrt(zoom);

    useEffect(() => {
        const el = panRef.current;
        if (!el) return;

        /*
         * ★ 少しだけ小さく測る。
         *
         *   ぴったりに合わせると、端数の丸めで
         *   1 ピクセルはみ出すことがある。
         *   はみ出すと送りが出て、そのぶん幅が減り、
         *   またはみ出す——という堂々巡りになる。
         *
         *   2 ピクセル譲っておけば、そうならない。
         */
        const measure = () =>
            setBox({
                w: Math.max(0, el.clientWidth - 2),
                h: Math.max(0, el.clientHeight - 2),
            });
        measure();

        const watcher =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measure)
                : null;
        watcher?.observe(el);

        return () => watcher?.disconnect();
    }, []);

    useEffect(() => {
        const box = panRef.current;
        if (!box) return;

        /* 描き直したあとに寄せる */
        const timer = window.setTimeout(() => {
            box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
            box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
        }, 30);

        return () => window.clearTimeout(timer);
    }, [wideValue]);


    /*
     * 画面いっぱいに広げるか。
     *
     * ★ 枠は頁の一部なので、どうしても小さい。
     *   人が増えると、名前が読める大きさにならない。
     *
     * ★ 広げるのは器だけ。図の作りは変えない。
     * ★ Esc で閉じる。押し具だけだと、逃げ場が無い。
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
     * ★ 決め打ちにする。
     *
     *   つまみは一枚の大きさを変えるためのもので、
     *   丸どうしの離れ具合とは別の話。
     *   両方をひとつのつまみで動かすと、
     *   何が起きているのか分からない。
     *
     *   離れ具合を変えたいときは「整理する」。
     */
    const spread = SPREAD * wide;
    /*
     * 板の大きさ。
     *
     * ★ 縦は今までどおり。横だけ広げる。
     *   縦を変えると、置いた場所が縦にずれる。
     *   横に広げるぶんには、右に余地ができるだけで
     *   すでに置いた丸は動かない。
     */
    /*
     * 紙の高さ。
     *
     * ★ 広さのつまみで決まる。
     *   輪が収まるだけの広さがあればよい。
     */
    /*
     * 丸と字の大きさ。
     *
     * ★ 紙の広さから出す。
     *   紙を広げても狭めても、見かけの大きさは変わらない。
     *   つまみは、ただの拡大・縮小になる。
     */
    const NODE_RADIUS = Math.round(BASE_SIZE * spread * NODE_SHARE);

    /* 線の端を止める位置。丸の縁より、少し外 */
    const HALO = Math.round(NODE_RADIUS * (1 + HALO_SHARE));

    /* 行きと帰りの弧を離す幅 */
    const BOW = Math.round(NODE_RADIUS * BOW_SHARE);

    /* 丸の下に出す名前 */
    const NAME_SIZE = Math.round(NODE_RADIUS * 0.66);

    /* 絵の無い丸に出す、名前の一文字目 */
    const INITIAL_SIZE = Math.round(NODE_RADIUS * 0.84);

    /* 丸の中心から、名前の行までの下がり */
    const NAME_DROP = NODE_RADIUS + Math.round(NAME_SIZE * 1.15);

    /* 線に出す関係の名前 */
    const EDGE_SIZE = Math.round(NODE_RADIUS * 0.56);

    /*
     * 丸を、画面でどのくらいの大きさに見せたいか。
     *
     * ★ 人数で大きさが変わらないようにする。
     *
     *   枠に収める作りなので、人が少ないほど丸が膨らむ。
     *   4、5 人だと丸だけが画面の一割を占め、
     *   図というより絵札が並んでいるように見えた。
     *
     *   丸の大きさを決めてから、それに合う広さに並べる。
     *   人が少ないときは、丸を大きくするのではなく
     *   間を広げる。
     */
    const NODE_WANT_PX = 22;

    /*
     * 丸どうしの、いちばん近い間。
     *
     * ★ 関係の名前が入るだけの幅を取る。
     *
     *   縦に並んだ二つを線で結ぶと、
     *   上の丸の名前と下の丸の名前の間に札が入る。
     *   名前の帯と札が触れない距離は、
     *   丸の半径のおよそ 5 倍。
     *
     *   足りないと、どれだけ札を動かしても重なる。
     *   動かすのではなく、初めから空けておく。
     */
    const gapWanted = Math.max(MIN_GAP * spread, NODE_RADIUS * 6);

    /* その大きさになるための、中身の高さ（紙の目盛り） */
    const wantSpan = box.h
        ? NODE_RADIUS * (box.h / NODE_WANT_PX)
        : 0;

    /*
     * ★ 組分けのときは、紙を大きく取る。
     *
     *   組の囲みと格子の目のぶん、人が同じでも広さが要る。
     *   紙が狭いと、並べた全体を縮めて押し込むことになり、
     *   顔の丸はそのままの大きさなので、隣どうしがくっついた。
     *   紙を広げて、縮めずに並べる。見る範囲は中身に合わせて決まる。
     */
    const PAPER = mayGroup && grouped && !isFocusMode ? 1.8 : 1;

    const HEIGHT = Math.round(BASE_SIZE * spread * PAPER);

    /* 組分けしたときの紙。押したその場で並べるときも、この広さで並べる */
    const GROUP_HEIGHT = Math.round(BASE_SIZE * spread * 1.8);
    const GROUP_WIDTH = Math.round(GROUP_HEIGHT * liveAspect);
    /* 紙の横幅。枠と同じ形にする */
    const WIDTH = Math.round(HEIGHT * liveAspect);
    const CENTER_X = WIDTH / 2;
    const CENTER_Y = HEIGHT / 2;
    /*
     * 丸を並べる輪の大きさ。
     *
     * ★ 紙いっぱいに広げる。
     *
     *   前は紙の 7 割ほどの輪だった。
     *   左右に 139、上下に 87 の余りが出て、
     *   端のほうへは自分で運ばないと届かない。
     *   「左右上下に行けない」と見えるのは、これ。
     *
     *   丸と名前が切れない幅だけ残して、あとは使う。
     */

    /* 掴んでいる間、動かさずに使う範囲 */
    const heldView = useRef<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);

    const [dragging, setDragging] = useState<Dragging | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    /*
     * 図に出す人。
     *
     * ★ まだ結んでいない人も出す。
     *
     *   前は関係を持つ人だけを出していた。
     *   11 人いるのに 4 人しか出ず、
     *   「誰をまだ結んでいないか」が分からなかった。
     *
     *   全体像を見る場所なので、全員が居るべき。
     *
     * ★ ただし薄く、外側に置く。
     *   結んである人の図を、邪魔しないように。
     */
    const connectedIds = new Set<string>();
    for (const relation of relations) {
        connectedIds.add(relation.from_entry_id);
        connectedIds.add(relation.to_entry_id);
    }

    /*
     * ★ まだ結んでいない人は、図に出さない。
     *
     *   一度出してみたが、数百並んで図が埋まった。
     *   本文から拾った断片まで項目として入っているため。
     *
     *   全部を出すのは、項目が整っている作品でしか成り立たない。
     *   ここは関係を見る場所であって、
     *   まだ結んでいない人を数える場所ではない。
     */
    const nodes = entries.filter((entry) => connectedIds.has(entry.id));

    /*
     * 初めに並ぶ輪の大きさ。
     *
     * ★ 人数で決める。紙の広さでは決めない。
     *
     *   紙を広げたら、そのぶん輪も広がっていた。
     *   4 人しかいないのに四隅へ散らばり、
     *   線だけがやたら長くなる。
     *
     *   輪の長さは「人数 × 丸どうしの間」で足りる。
     *   それ以上広げても、間が空くだけで読みにくい。
     *
     * ★ 紙からはみ出さないよう、上限だけ紙で決める。
     */
    const EDGE = NODE_RADIUS + Math.round(NAME_SIZE * 1.6);

    const MAX_X = WIDTH / 2 - EDGE;
    const MAX_Y = HEIGHT / 2 - EDGE;

    /*
     * 人数ぶんの丸が、間を空けて並ぶのに要る半径。
     *
     * ★ 一人あたり、丸の直径の 3 倍ほどを見込む。
     *
     *   MIN_GAP（丸どうしの最短の間）で数えると、
     *   4 人のときに輪が丸 2 個ぶんしかなく、
     *   団子になってしまう。
     *
     * ★ 少なくても、丸 5 個ぶんの輪は取る。
     *   2 人や 3 人のときに、くっつきすぎないように。
     */
    /*
     * 初めに並ぶ輪の大きさ。
     *
     * ★ 紙いっぱいに広げる。
     *
     *   自分で置いた丸は動かさないが、
     *   まだ置いていない丸は、紙の広さに合わせて並べる。
     *
     *   合わせないと、紙を広げたときに
     *   丸だけ左上に取り残され、右下が空になる。
     *
     * ★ 人数ぶんの下限も見る。
     *   人が少ないときに、四隅へ散らばりすぎないように。
     */
    const PER_NODE = NODE_RADIUS * 6;
    const NEEDED = Math.max(
        NODE_RADIUS * 5,
        (nodes.length * PER_NODE) / (Math.PI * 2),
        MAX_Y * 0.95,
    );

    const RADIUS_Y = Math.min(MAX_Y, NEEDED);
    const RADIUS_X = Math.min(MAX_X, RADIUS_Y * liveAspect);


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

    /*
     * 同じ二人を結ぶ線が、二本以上あるとき。
     *
     * ★ 行きと帰りを、別の弧に分ける。
     *
     *   向きのある間柄は、両方向を入れる人がいる。
     *   「AはBを慕う」「BはAを疎む」のように、
     *   行きと帰りで言い分が違うことがある。
     *
     *   まっすぐ引くと二本がぴたりと重なり、
     *   後から引いたほうしか見えない。
     *   名前も矢印も、下に隠れてしまう。
     *
     * ★ 片方を外へ、片方を内へ膨らませる。
     *   どちらも端は丸に着いたまま、途中だけ離れる。
     *
     * ★ 中間点を置いた線は、そのままにする。
     *   自分で通り道を決めた線を、こちらで動かさない。
     */
    const bowOf = new Map<string, number>();

    {
        const bySides = new Map<string, string[]>();

        for (const relation of shownRelations) {
            const key = [relation.from_entry_id, relation.to_entry_id]
                .slice()
                .sort()
                .join("|");

            const found = bySides.get(key);

            if (found) {
                found.push(relation.id);
            } else {
                bySides.set(key, [relation.id]);
            }
        }

        for (const list of bySides.values()) {
            if (list.length < 2) continue;

            /* 真ん中を空けて、外・内・外……と振り分ける */
            list.forEach((id, at) => {
                const step = Math.floor(at / 2) + 1;
                bowOf.set(id, (at % 2 === 0 ? -1 : 1) * step);
            });
        }
    }

    /*
     * 覚えている位置を、いまの紙に収める倍率。
     *
     * ★ 紙の広さや丸の大きさを変えると、
     *   昔の位置が紙からはみ出す。
     *   はみ出したところは描かれないので、
     *   丸が消えたように見える。
     *
     * ★ 端に貼り付けるのではなく、まとめて縮める。
     *   貼り付けると、並びが潰れて重なる。
     *   同じ割合で縮めれば、形は保たれる。
     */


    /*
     * 詰めて並べる。
     *
     * ★ 真ん中から、輪を重ねて外へ。
     *
     *   一本の大きな輪に全員を並べると、
     *   内側がまるごと空いたまま、
     *   丸だけが縁に押し付けられて小さくなる。
     *
     *   内側から詰めれば、同じ枠に同じ人数を
     *   ずっと大きく置ける。
     *
     * ★ 繋がりの多いものから内側へ。
     *   多くの相手と結ばれているものを真ん中に置くと、
     *   線が短く済む。
     */
    function packed(list: { id: string }[], fill = true) {
        const degree = new Map<string, number>();

        for (const relation of relations) {
            degree.set(
                relation.from_entry_id,
                (degree.get(relation.from_entry_id) ?? 0) + 1,
            );
            degree.set(
                relation.to_entry_id,
                (degree.get(relation.to_entry_id) ?? 0) + 1,
            );
        }

        const sorted = [...list].sort(
            (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
        );

        const place = new Map<string, { x: number; y: number }>();
        const want = gapWanted;

        let at = 0;
        let ring = 0;

        while (at < sorted.length) {
            /* いちばん内側は、真ん中に 1 つ */
            if (ring === 0) {
                place.set(sorted[at].id, { x: CENTER_X, y: CENTER_Y });
                at += 1;
                ring += 1;
                continue;
            }

            const ry = Math.min(
                CENTER_Y - NODE_RADIUS - 8,
                (want * ring) / 1.6,
            );

            /*
             * ★ 輪の形は、枠の形に合わせる。
             *   決め打ちの比で広げると、
             *   横に長い画面で左右が大きく余る。
             */
            const rx = Math.min(CENTER_X - NODE_RADIUS - 8, ry * liveAspect);

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

        /*
         * ★ 最後に、紙いっぱいまで広げる。
         *
         *   人が少ないと、輪が二つで終わって
         *   真ん中に小さくまとまる。
         *   丸の大きさには上限を置いてあるので、
         *   そのままだと枠の大半が空いたままになる。
         *
         *   丸を大きくするのではなく、間を広げる。
         *   図の形は変えずに、隙間だけが伸びる。
         */
        const roomY = CENTER_Y - NODE_RADIUS * 2;
        const roomX = CENTER_X - NODE_RADIUS * 2;

        let spanX = 0;
        let spanY = 0;

        for (const point of place.values()) {
            spanX = Math.max(spanX, Math.abs(point.x - CENTER_X));
            spanY = Math.max(spanY, Math.abs(point.y - CENTER_Y));
        }

        /* 目指す広さ。丸が思う大きさに見えるところ */
        const aimY = wantSpan / 2;
        const aimX = (wantSpan * liveAspect) / 2;

        const grow = Math.min(
            spanX > 1
                ? Math.min(roomX, aimX) / spanX
                : Number.POSITIVE_INFINITY,
            spanY > 1
                ? Math.min(roomY, aimY) / spanY
                : Number.POSITIVE_INFINITY,
        );

        /*
         * ★ 「整理する」では、広げない。
         *
         *   押した人が求めているのは、散らばったものを
         *   まとめることであって、並べ直して
         *   また枠いっぱいに散らすことではない。
         *
         *   はじめの並びのときだけ広げる。
         *   あちらは、まだ誰も触っていない図なので、
         *   枠に対して小さすぎると読めない。
         */
        if (fill && Number.isFinite(grow) && grow > 1) {
            for (const [id, point] of place) {
                place.set(id, {
                    x: CENTER_X + (point.x - CENTER_X) * grow,
                    y: CENTER_Y + (point.y - CENTER_Y) * grow,
                });
            }
        }

        return place;
    }

    /*
     * まだ誰も動かしていないか。
     *
     * ★ 何も置かれていないときは、詰めて並べる。
     *
     *   はじめの並びが一本の大きな輪だと、
     *   人数が増えるほど丸が縁に押し付けられ、
     *   全体を出したときに名前が読めない。
     *
     * ★ 一人でも自分で置いていたら、これまでどおり。
     *   並べ直すのは「整理する」を押したときだけにする。
     */
    const untouched = shownNodes.every((node) => !layout[node.id]);

    const firstLook =
        !focusId && untouched && shownNodes.length > 0
            ? packed(shownNodes)
            : null;

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

        /*
         * ★ 輪は、丸の大きさから決める。
         *
         *   これまでは紙の大きさに割合を掛けていた。
         *   人が少ないと輪が丸 3 個ぶんまで縮み、
         *   関係の名前の札が、丸の下の名前に重なっていた。
         *
         *   間に札が入るだけの幅を、必ず取る。
         *   名前の帯（丸の下）と札が、触れない距離。
         */
        const ringY = Math.min(
            MAX_Y,
            Math.max(
                NODE_RADIUS * 6.5,
                Math.min(MAX_Y, (wantSpan / 2) * tight),
            ),
        );

        const ringX = Math.min(MAX_X, ringY * liveAspect);

        around.forEach((node, index) => {
            const angle = (Math.PI * 2 * index) / around.length - Math.PI / 2;
            positions.set(node.id, {
                x: CENTER_X + Math.cos(angle) * ringX,
                y: CENTER_Y + Math.sin(angle) * ringY,
            });
        });
    } else {
    nodes.forEach((node, index) => {
        const saved = dragging?.id === node.id ? dragging.position : layout[node.id];
        if (saved) {
            /*
             * ★ 紙を広げたら、置いた場所も一緒に伸ばす。
             *
             *   覚えているのは、いちばん狭い紙での位置。
             *   そのまま使うと、広げたときに丸が左上へ固まる。
             *
             *   つまんで動かしている最中の位置は、
             *   もう今の紙での値なので、そのまま使う。
             */
            /*
             * ★ 覚えた場所は、紙に対する割合で持つ。
             *
             *   0〜1 の値で覚えておき、いまの紙に掛ける。
             *
             *   そのままの座標で覚えると、紙を広げたときに
             *   丸だけ左上に取り残され、右下が空になる。
             *
             *   割合で持てば、紙を広げても狭めても
             *   同じ場所にいる。見かけ上、丸は動かない。
             *
             * ★ 掴んでいる最中は、そのまま使う。
             *   指の位置は、もういまの紙での値なので。
             */
            const isDragging = dragging?.id === node.id;

            /*
             * ★ 昔の覚え方にも合わせる。
             *
             *   前は座標そのもの（100 や 800）で覚えていた。
             *   それを割合として読むと、みな左上の角に潰れる。
             *
             *   1 より大きければ昔の覚え方とみなし、
             *   そのときの紙（1600×1000）での割合に直す。
             */
            const asRatio =
                saved.x > 1 || saved.y > 1
                    ? { x: saved.x / 1600, y: saved.y / 1000 }
                    : saved;

            positions.set(
                node.id,
                clampToBoard(
                    isDragging
                        ? saved
                        : { x: asRatio.x * WIDTH, y: asRatio.y * HEIGHT },
                ),
            );
            return;
        }
        /* まだ誰も動かしていないときは、詰めた並び */
        const first = firstLook?.get(node.id);

        if (first) {
            positions.set(node.id, first);
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
     * 描いたものが、実際に占めている範囲。
     *
     * ★ 紙ではなく、中身に合わせて枠に収める。
     *
     *   これまでは紙の全体を枠に収めていた。
     *   紙は人数に合わせて広げてあるので、
     *   並べ直して中身が小さくまとまっても、
     *   まわりの余白ごと縮めて出していた。
     *   そのぶん、丸も名前も小さくなる。
     *
     *   中身の外ぎりぎりで切れば、余白のぶんだけ大きく出せる。
     *
     * ★ 掴んでいる間は、動かさない。
     *   丸を端へ運ぶたびに全体が縮むと、
     *   手元の丸が指から逃げていく。
     */
    /*
     * ★ 名前のぶんまで数える。
     *
     *   丸の幅だけで測ると、端の人の長い名前が切れる。
     *   名前は丸より横に広いので、そちらで測る。
     */
    const halfOf = (name: string) =>
        Math.max(NODE_RADIUS, ((name || "?").length * NAME_SIZE) / 2);

    /* 名前を引く。札を名前から逃がすときに要る */
    const nameOf = new Map(shownNodes.map((node) => [node.id, node.name]));

    /*
     * ============================================================
     * まとまり（会員）
     *
     * ★ 「所属」「配下」といった関係から、ひとりでに作る。
     *   作者に、同じことをもう一度入れてもらわない。
     *
     * ★ どこにも入らない人は囲まない。
     * ★ 二つ以上に入る人は、両方の囲みに入る。囲みは重なる。
     *
     * ★ 誰かを選んで見ているときは、出さない。
     *   あちらは一人のまわりだけを見る場所なので、
     *   囲みを出すと、居ない人のぶんまで枠が伸びる。
     * ============================================================
     */
    const grouping = mayGroup && grouped && !focusId;

    const foundGroups = grouping ? findGroupsHere() : [];

    /*
     * 囲みで表す組織。
     *
     * ★ 組織の項目そのものは、丸で描かない。
     *   囲みがその組織を表しているので、
     *   中に「黒ずくめの組織」という丸がもう一つあると紛らわしい。
     *   組織に結んだ関係は、囲みの縁から出す。
     */
    if (grouping) {
        for (const group of foundGroups) positions.delete(group.key);
    }

    /*
     * 組の色。
     *
     * ★ 右の欄と同じ決め方にする。
     *   全部の組を渡して決めるので、図に出ていない組があっても色がずれない。
     */
    const groupColors = mayGroup ? assignColors(authoredAll()) : new Map<string, string>();

    /*
     * ============================================================
     * 相関図の人物カード
     *
     * ★ 丸に一文字をやめて、写真の入る四角いカードにする。
     *   丸に一文字は、表計算や組織図の道具に見える。
     *   人物相関図は、顔と名前と役割で人を見せる。
     *
     * ★ 大事な人ほど大きく。
     *   全員が同じ大きさだと、正しいけれど物語が見えない。
     *
     *     主人公    役割に「主人公」と書いてある人
     *     主要人物  資料で「主要」にしてある人
     *     通常      関係が三本以上ある人
     *     補助      それ以外
     * ============================================================
     */
    const degreeOf = new Map<string, number>();

    for (const relation of shownRelations) {
        degreeOf.set(relation.from_entry_id, (degreeOf.get(relation.from_entry_id) ?? 0) + 1);
        degreeOf.set(relation.to_entry_id, (degreeOf.get(relation.to_entry_id) ?? 0) + 1);
    }

    /* 役割。人物ページの「役割」の欄 */
    const roleOf = (entry: ResourceEntry): string => {
        const page = pages.find((one) => one.id === entry.page_id);
        const field = page?.fields.find((one) => one.label === "役割");
        const raw = entry.values?.[field?.key ?? "role"];
        return typeof raw === "string" ? raw.trim() : "";
    };

    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    /*
     * ★ 大事な数人は、はっきり大きく。
     *   主人公と主要人物が、ほかと同じくらいだと、どこから読めばよいか分からない。
     */
    /*
     * ★ 大きさは三つだけ。主人公・主要人物・ほかの全員。
     *   関係の数でも大きさを変えていたので、丸の大きさがばらばらで落ち着かなかった。
     *   ほかの人は、みな同じ大きさにそろえる。
     */
    const TIER_SCALE = [1.45, 1.2, 1, 1];

    /* 図の上で選んだ主人公。選んでいれば、役割の「主人公」より優先 */
    const leadId = entries.find((entry) => entry.values?.[LEAD_KEY] === true)?.id ?? null;

    const tierOf = (id: string): number => {
        const entry = entryById.get(id);
        if (!entry) return 3;
        if (leadId) {
            if (id === leadId) return 0;
            if (roleOf(entry).includes("主人公")) return 1;
        } else if (roleOf(entry).includes("主人公")) return 0;
        if (entry.is_major) return 1;
        if ((degreeOf.get(id) ?? 0) >= 3) return 2;
        return 3;
    };

    const CARD_IMAGE = NODE_RADIUS * 2.1;

    const cardOf = (id: string) => {
        const entry = entryById.get(id);
        const scale = TIER_SCALE[tierOf(id)];
        const image = CARD_IMAGE * scale;
        const pad = Math.round(image * 0.07);
        const nameSize = Math.round(NAME_SIZE * (0.92 + (scale - 1) * 0.6));
        const role = entry ? roleOf(entry) : "";
        const roleSize = Math.round(nameSize * 0.72);
        /* 名前が顔より横に長いときは、名前の幅で取る */
        const nameChars = Math.min(9, Array.from(entry?.name ?? "").length);
        const w = Math.max(image + pad * 2, nameChars * nameSize * 0.98 + pad);
        const h =
            pad + image + pad * 0.8 + nameSize * 1.2 + (role ? roleSize * 1.35 : 0) + pad;

        return { w, h, image, pad, nameSize, role, roleSize, scale };
    };

    const groupBoxes: GroupBox[] = grouping
        ? boxesFor(
              foundGroups.map((group) => ({
                  ...group,
                  ids: group.ids.filter((id) => shownIds.has(id)),
              })),
              positions,
              {
                  radius: NODE_RADIUS,
                  halfOf: (id) => halfOf(nameOf.get(id) ?? ""),
                  drop: NAME_DROP + NAME_SIZE * 0.4,
                  pad: Math.round(NODE_RADIUS * 0.8),
                  head: Math.round(NAME_SIZE * 2.6),
                  extent: (id) => {
                      const card = cardOf(id);
                      return { w: card.w, h: card.h };
                  },
              },
          )
        : [];

    const boxOf = new Map(groupBoxes.map((box) => [box.key, box]));

    /* 線の端。人なら丸の真ん中、組織なら囲みの真ん中 */
    const anchorOf = (id: string) => {
        const at = positions.get(id);
        if (at) return at;

        const box = boxOf.get(id);
        return box ? { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 } : undefined;
    };

    /*
     * 省く線。
     *
     * ★ 組織どうしに関係を結んだら、中の人どうしの同じ関係は省く。
     *
     *   「黒ずくめの組織 —敵対— FBI」を結んだのに、
     *   ジンと赤井、ウォッカとジョディ……と同じ「敵対」を
     *   一本ずつ描くと、図が線で埋まる。
     *   組織の線が一本あれば、中の人たちの関係はそれで分かる。
     *
     *   組織と人（少年探偵団 —同級生— コナン）でも同じ。
     *
     * ★ 名前が同じときだけ省く。
     *   「敵対」の組織どうしでも、中に「内通」している人がいれば、
     *   その線は残す。そういう線こそ読みたい。
     *
     * ★ 組織と、その中にいる人との線（所属など）も省く。
     *   囲みの中にいることで、もう分かる。
     */
    const hiddenRelations = new Set<string>();

    if (grouping && boxOf.size > 0) {
        const groupsOfPerson = new Map<string, Set<string>>();

        for (const box of groupBoxes) {
            for (const id of box.ids) {
                const set = groupsOfPerson.get(id) ?? new Set<string>();
                set.add(box.key);
                groupsOfPerson.set(id, set);
            }
        }

        const covers = (side: string, person: string) =>
            side === person ||
            (boxOf.has(side) && (groupsOfPerson.get(person)?.has(side) ?? false));

        const groupLevel = shownRelations.filter(
            (one) => boxOf.has(one.from_entry_id) || boxOf.has(one.to_entry_id),
        );

        for (const relation of shownRelations) {
            const a = relation.from_entry_id;
            const b = relation.to_entry_id;

            /* 組織と、その中にいる人 */
            if (
                (boxOf.has(a) && groupsOfPerson.get(b)?.has(a)) ||
                (boxOf.has(b) && groupsOfPerson.get(a)?.has(b))
            ) {
                hiddenRelations.add(relation.id);
                continue;
            }

            if (boxOf.has(a) || boxOf.has(b)) continue;

            const label = (relation.label ?? "").trim();
            if (!label) continue;

            const same = groupLevel.some(
                (one) =>
                    (one.label ?? "").trim() === label &&
                    ((covers(one.from_entry_id, a) && covers(one.to_entry_id, b)) ||
                        (covers(one.from_entry_id, b) && covers(one.to_entry_id, a))),
            );

            if (same) hiddenRelations.add(relation.id);
        }
    }

    const drawnRelations = shownRelations.filter(
        (relation) => !hiddenRelations.has(relation.id),
    );

    /*
     * ============================================================
     * 組分けのときに、ふだん出す線
     *
     * ★ 線が多すぎると読めない。
     *   ふだん出すのは、主要な人どうし・組と組・組と主要な人の線だけ。
     *   脇役の線は、その人（か相手）に触れたとき・選んだときに出す。
     *
     * ★ 主要な人は、役割が「主人公」の人と、資料で「主要」にした人。
     *   だれも決めていなければ、関係の多い順に上から四分の一（三人以上）。
     *
     * ★ 人が八人以下なら、全部出す。もともと線が少ない。
     * ============================================================
     */
    const activeNow = hoveredId ?? selectedId;

    const mainIds = new Set(
        shownNodes.filter((node) => tierOf(node.id) <= 1).map((node) => node.id),
    );

    if (grouping && mainIds.size < 2) {
        const want = Math.max(3, Math.ceil(shownNodes.length / 4));

        for (const node of [...shownNodes]
            .sort((a, b) => (degreeOf.get(b.id) ?? 0) - (degreeOf.get(a.id) ?? 0))
            .slice(0, want)) {
            mainIds.add(node.id);
        }
    }

    const everyone = !grouping || shownNodes.length <= 8;
    const isKey = (id: string) => boxOf.has(id) || mainIds.has(id);

    /* ふだんは出さない線 */
    const isQuiet = (relation: ResourceRelation) =>
        !everyone && !(isKey(relation.from_entry_id) && isKey(relation.to_entry_id));

    const touches = (relation: ResourceRelation, id: string | null) =>
        !!id && (relation.from_entry_id === id || relation.to_entry_id === id);

    const visibleRelations = drawnRelations.filter(
        (relation) => !isQuiet(relation) || touches(relation, activeNow),
    );

    /*
     * 関係の名前の置き場所（組分けのとき）。
     *
     * ★ 名前どうし、名前と丸が重ならないところに置く。
     *
     *   並んで走る二本の線（師弟と弟子）の名前を、
     *   どちらも線の真ん中に置くと、片方がもう片方の下に隠れた。
     *   線の上を少しずつずらして、空いているところを探す。
     *
     * ★ 長い区間から先に探す。短い区間に置くと、角に近くて読みにくい。
     */
    const placedLabels: { x1: number; y1: number; x2: number; y2: number }[] = [];

    function labelSpot(
        points: { x: number; y: number }[],
        w: number,
        h: number,
    ): { x: number; y: number } {
        const segments = points
            .slice(1)
            .map((b, index) => ({ a: points[index], b }))
            .sort(
                (one, two) =>
                    Math.hypot(two.b.x - two.a.x, two.b.y - two.a.y) -
                    Math.hypot(one.b.x - one.a.x, one.b.y - one.a.y),
            );

        const blocked = (x: number, y: number) => {
            const box = { x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 };

            const hitsLabel = placedLabels.some(
                (one) =>
                    box.x1 < one.x2 && box.x2 > one.x1 && box.y1 < one.y2 && box.y2 > one.y1,
            );
            if (hitsLabel) return true;

            return nodeBlocks.some(
                (one) =>
                    box.x1 < one.x2 && box.x2 > one.x1 && box.y1 < one.y2 && box.y2 > one.y1,
            );
        };

        for (const { a, b } of segments) {
            for (const t of [0.5, 0.32, 0.68, 0.2, 0.8]) {
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;

                if (!blocked(x, y)) {
                    placedLabels.push({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 });
                    return { x, y };
                }
            }
        }

        /* どこも空いていなければ、いちばん長い区間の真ん中 */
        const first = segments[0] ?? { a: points[0], b: points[0] };
        const x = (first.a.x + first.b.x) / 2;
        const y = (first.a.y + first.b.y) / 2;
        placedLabels.push({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 });

        return { x, y };
    }

    /*
     * 曲がる線の上の、関係名の置き場所。
     *
     * ★ 線の真ん中から探し、ほかの札や人に掛からないところ。
     *   線から離さない。離れた札は、どの線のものか分からない。
     */
    function labelOnCurve(
        samples: { x: number; y: number }[],
        w: number,
        h: number,
    ): { x: number; y: number } {
        const hit = (x: number, y: number) => {
            /* 札どうし、少し間をあける */
            const m = NAME_SIZE * 0.25;
            const box = { x1: x - w / 2 - m, y1: y - h / 2 - m, x2: x + w / 2 + m, y2: y + h / 2 + m };
            const over = (one: { x1: number; y1: number; x2: number; y2: number }) =>
                box.x1 < one.x2 && box.x2 > one.x1 && box.y1 < one.y2 && box.y2 > one.y1;
            return placedLabels.some(over) || nodeBlocks.some(over);
        };

        const last = samples.length - 1;

        for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]) {
            const at = samples[Math.round(last * t)];
            if (at && !hit(at.x, at.y)) {
                placedLabels.push({ x1: at.x - w / 2, y1: at.y - h / 2, x2: at.x + w / 2, y2: at.y + h / 2 });
                return at;
            }
        }

        /*
         * ★ どこも空いていなければ、札どうしの重なりがいちばん少ないところ。
         *   真ん中に決め打ちすると、行き帰りの二本（師弟と弟子）の札が重なった。
         */
        const overlap = (x: number, y: number) =>
            placedLabels.reduce((sum, one) => {
                const ox = Math.min(x + w / 2, one.x2) - Math.max(x - w / 2, one.x1);
                const oy = Math.min(y + h / 2, one.y2) - Math.max(y - h / 2, one.y1);
                return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
            }, 0);

        let at = samples[Math.round(last / 2)] ?? samples[0];
        let least = overlap(at.x, at.y);
        for (let i = 1; i < last; i += 1) {
            const one = samples[i];
            const o = overlap(one.x, one.y);
            if (o < least - 0.5) {
                least = o;
                at = one;
            }
        }

        placedLabels.push({ x1: at.x - w / 2, y1: at.y - h / 2, x2: at.x + w / 2, y2: at.y + h / 2 });
        return at;
    }

    /* 丸ごとの縁の色。いちばん小さい（内側の）組の色 */
    const ringOf = new Map<string, string>();

    for (const box of [...groupBoxes].sort((a, b) => a.ids.length - b.ids.length)) {
        const ink = groupColors.get(box.key);
        if (!ink) continue;

        for (const id of box.ids) {
            if (!ringOf.has(id)) ringOf.set(id, ink);
        }
    }

    /*
     * 線がよけるもの。
     *
     * ★ 丸そのものと、名前の帯。
     *   名前の上を線が横切ると、名前が読めない。
     */
    /*
     * 線が丸と名前をよけるか。
     *
     * ★ 会員なら、組分けしていなくても。
     *   名前の上を線が横切るのは、組があってもなくても読みにくい。
     */
    const avoiding = mayGroup && !focusId;

    const nodeBlocks = avoiding
        ? shownNodes.flatMap((node) => {
              const at = positions.get(node.id);
              if (!at) return [];

              if (grouping) {
                  const card = cardOf(node.id);

                  return [
                      {
                          id: node.id,
                          x1: at.x - card.w / 2,
                          y1: at.y - card.h / 2,
                          x2: at.x + card.w / 2,
                          y2: at.y + card.h / 2,
                      },
                  ];
              }

              const half = halfOf(node.name);

              return [
                  {
                      id: node.id,
                      x1: at.x - half,
                      y1: at.y - NODE_RADIUS,
                      x2: at.x + half,
                      y2: at.y + NAME_DROP + NAME_SIZE * 0.4,
                  },
              ];
          })
        : [];

    /*
     * 線ごとの、よけ方。
     *
     * ★ 描く前に決めておく。
     *
     *   弧や回り道は、丸と囲みの外へ出ることがある。
     *   描くところで決めると、出す範囲を決めた後なので、
     *   はみ出した部分が枠で切れて消える。
     *
     * ★ 手で中間点を置いた線と、行き帰りの二本は、よけない。
     *   作者が決めた通り道を、こちらで書き換えない。
     */
    const aroundOf = new Map<
        string,
        {
            control?: { x: number; y: number };
            points: { x: number; y: number }[];
            ready?: boolean;
            curve?: CurveRoute;
            /** 触れた人のぶんだけ出す線。出す範囲の計算には入れない（触れるたびに図が動かないよう） */
            extra?: boolean;
        }
    >();

    if (grouping) {
        /*
         * ============================================================
         * 組分けしているときは、ゆるく曲がる線
         *
         * ★ 直角に折れる線は、硬くて、同じ通り道に何本も重なった。
         *   まっすぐ引けるならまっすぐ、人に掛かるならふくらませてよける。
         *   先に引いた線と重なるときも、ふくらませてずらす。
         *
         * ★ ふだん出す線を先に、触れた人の線を後に引く。
         *   触れるたびに、ふだんの線の形が変わらないように。
         *
         * ★ 短い線から先に引く。短い線はよけ方が少ないので、先に良い道を取らせる。
         * ============================================================
         */
        const placed: { x: number; y: number }[][] = [];
        const lane = Math.round(NODE_RADIUS * 0.9);

        const inside = (inner: GroupBox, outer: GroupBox) =>
            inner.x1 >= outer.x1 &&
            inner.x2 <= outer.x2 &&
            inner.y1 >= outer.y1 &&
            inner.y2 <= outer.y2;

        const cardRect = (id: string) => {
            const p = positions.get(id);
            if (!p) return null;
            const card = cardOf(id);
            return {
                x1: p.x - card.w / 2 - 2,
                y1: p.y - card.h / 2 - 2,
                x2: p.x + card.w / 2 + 2,
                y2: p.y + card.h / 2 + 2,
            };
        };

        const lengthOfLine = (relation: ResourceRelation) => {
            const a = anchorOf(relation.from_entry_id);
            const b = anchorOf(relation.to_entry_id);
            return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
        };

        const byLength = (a: ResourceRelation, b: ResourceRelation) =>
            lengthOfLine(a) - lengthOfLine(b);

        const usual = visibleRelations.filter((relation) => !isQuiet(relation)).sort(byLength);
        const extra = visibleRelations.filter((relation) => isQuiet(relation)).sort(byLength);

        for (const relation of [...usual, ...extra]) {
            if (relation.bend || bending?.id === relation.id) continue;

            const from = anchorOf(relation.from_entry_id);
            const to = anchorOf(relation.to_entry_id);
            if (!from || !to) continue;

            const fromBox = boxOf.get(relation.from_entry_id);
            const toBox = boxOf.get(relation.to_entry_id);

            const soft = groupBoxes.filter(
                (box) =>
                    !box.ids.includes(relation.from_entry_id) &&
                    !box.ids.includes(relation.to_entry_id) &&
                    box !== fromBox &&
                    box !== toBox &&
                    !(fromBox && inside(box, fromBox)) &&
                    !(toBox && inside(box, toBox)),
            );

            const hard = nodeBlocks.filter(
                (one) => one.id !== relation.from_entry_id && one.id !== relation.to_entry_id,
            );

            const curve = curveRoute({
                from,
                to,
                hard,
                soft,
                placed,
                lane,
                startRect: fromBox ?? cardRect(relation.from_entry_id),
                endRect: toBox ?? cardRect(relation.to_entry_id),
                halo: HALO,
                corner: Math.round(NODE_RADIUS * 0.8),
            });

            placed.push(curve.samples);

            aroundOf.set(relation.id, {
                points: curve.samples,
                curve,
                ready: true,
                extra: isQuiet(relation),
            });
        }
    } else if (avoiding) {
        for (const relation of shownRelations) {
            if (relation.bend || bending?.id === relation.id) continue;

            const from = positions.get(relation.from_entry_id);
            const to = positions.get(relation.to_entry_id);
            if (!from || !to) continue;

            /*
             * ★ 行き帰りの二本も、よける。
             *   前はよけずに決まった形でふくらませていたので、
             *   間にいる人（律とクマの間のエバ）の上を通っていた。
             *   ふくらむ向きは変えず、大きさだけ足す。
             */
            const bow = bowOf.get(relation.id) ?? 0;
            const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
            const lean = bow * (relation.from_entry_id < relation.to_entry_id ? 1 : -1);
            const fixed =
                bow === 0
                    ? undefined
                    : {
                          side: (lean > 0 ? 1 : -1) as 1 | -1,
                          least: (BOW * Math.abs(lean)) / length,
                      };

            aroundOf.set(
                relation.id,
                pathAround(
                    from,
                    to,
                    [
                        ...groupBoxes.filter(
                            (box) =>
                                !box.ids.includes(relation.from_entry_id) &&
                                !box.ids.includes(relation.to_entry_id),
                        ),
                        ...nodeBlocks.filter(
                            (one) =>
                                one.id !== relation.from_entry_id &&
                                one.id !== relation.to_entry_id,
                        ),
                    ],
                    Math.round(NODE_RADIUS * 0.7),
                    fixed,
                ),
            );
        }
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of shownNodes) {
        const at = positions.get(node.id);
        if (!at) continue;

        if (grouping) {
            const card = cardOf(node.id);
            minX = Math.min(minX, at.x - card.w / 2);
            maxX = Math.max(maxX, at.x + card.w / 2);
            minY = Math.min(minY, at.y - card.h / 2);
            maxY = Math.max(maxY, at.y + card.h / 2);
            continue;
        }

        const half = halfOf(node.name);

        minX = Math.min(minX, at.x - half);
        maxX = Math.max(maxX, at.x + half);
        minY = Math.min(minY, at.y - NODE_RADIUS);
        maxY = Math.max(maxY, at.y + NAME_DROP + NAME_SIZE * 0.4);
    }

    /* 囲みのぶんも数える。はみ出したまま切ると、枠が欠ける */
    for (const box of groupBoxes) {
        minX = Math.min(minX, box.x1);
        maxX = Math.max(maxX, box.x2);
        minY = Math.min(minY, box.y1);
        maxY = Math.max(maxY, box.y2);
    }

    /*
     * よけた線のぶんも数える。
     *
     * ★ 弧は、引っ張り点までは行かない。
     *   いちばん外れるのは、両端と引っ張り点の真ん中あたり。
     */
    for (const [id, around] of aroundOf) {
        if (around.extra) continue;

        const points = [...around.points];

        if (around.control) {
            const relation = shownRelations.find((one) => one.id === id);
            const from = relation ? positions.get(relation.from_entry_id) : undefined;
            const to = relation ? positions.get(relation.to_entry_id) : undefined;

            if (from && to) {
                points.push({
                    x: (from.x + around.control.x * 2 + to.x) / 4,
                    y: (from.y + around.control.y * 2 + to.y) / 4,
                });
            }
        }

        for (const point of points) {
            minX = Math.min(minX, point.x - NODE_RADIUS * 0.5);
            maxX = Math.max(maxX, point.x + NODE_RADIUS * 0.5);
            minY = Math.min(minY, point.y - NODE_RADIUS * 0.5);
            maxY = Math.max(maxY, point.y + NODE_RADIUS * 0.5);
        }
    }

    const seen = Number.isFinite(minX)
        ? { minX, maxX, minY, maxY }
        : { minX: 0, maxX: WIDTH, minY: 0, maxY: HEIGHT };

    /*
     * 外側に、少しだけ余白。
     *
     * ★ よけて回る線のぶんは、多めに取る。
     *
     *   線は囲みの外側を回るので、丸と囲みだけで切ると、
     *   回り道の部分が枠の外に出て、消えてしまう。
     */
    const ROOM = Math.round(NODE_RADIUS * (avoiding ? 0.9 : 0.6));

    /*
     * 狭すぎる範囲は、広げておく。
     * 一人二人しかいないときに、丸だけ巨大になるのを防ぐ。
     */
    const LEAST = NODE_RADIUS * 12;

    const rawW = seen.maxX - seen.minX + ROOM * 2;
    const rawH = seen.maxY - seen.minY + ROOM * 2;

    const liveView = {
        w: Math.max(LEAST * liveAspect, rawW),
        h: Math.max(LEAST, rawH),
    };

    const viewNow = {
        x: (seen.minX + seen.maxX) / 2 - liveView.w / 2,
        y: (seen.minY + seen.maxY) / 2 - liveView.h / 2,
        w: liveView.w,
        h: liveView.h,
    };

    /* 掴んでいる間は、掴む前の範囲を使い続ける */
    if (!dragging && !bending) heldView.current = viewNow;

    const view =
        (dragging || bending) && heldView.current ? heldView.current : viewNow;

    /*
     * 枠に収めるときの、一目盛りあたりの点の数。
     *
     * ★ 横と縦のうち、きつい方に合わせる。
     *   片方だけに合わせると、もう片方がはみ出す。
     */
    /*
     * ★ 丸が大きくなりすぎないようにする。
     *
     *   中身に合わせて枠いっぱいに広げるので、
     *   人が 4、5 人しかいないと、丸だけが
     *   画面の 1 割を占めるほど膨らんでいた。
     *   図というより、絵札が並んでいるように見える。
     *
     *   画面の点で、丸の半径に上限を置く。
     *   上限に当たったら、そこで止めて真ん中に寄せる。
     */
    const NODE_CAP_PX = 24;

    const fitRatio =
        box.w && box.h
            ? Math.min(
                  box.w / view.w,
                  box.h / view.h,
                  NODE_CAP_PX / NODE_RADIUS,
              )
            : 0;

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

                    const want = gapWanted;
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
    /*
     * 板の中に留める。
     *
     * ★ 壁は作らない。枠の中は、関係図の紙そのもの。
     *
     *   前は丸を内側で止めていた。
     *   端に置きたいのに置けず、見えない壁に当たる。
     *   紙の端まで使えるほうが、並べ方が自由になる。
     *
     * ★ 外へは出さない。
     *
     *   紙の外に置くと、そこは描かれない。
     *   丸も線も消えたように見える。
     *   端で止めるのは、そのためだけ。
     */
    function clampToBoard(point: { x: number; y: number }) {
        /*
         * 紙の中に留める。
         *
         * ★ 止めるのは、紙の外は描かれないから。それだけ。
         *
         * ★ 向きによって、要る余裕が違う。
         *
         *   左・右・上  丸の縁まで。名前はここに出ない。
         *   下          名前の高さぶん。丸の下に出るので。
         *
         *   前は四方すべてに名前ぶんの余裕を取っていた。
         *   上と左右には要らないので、そのぶん端まで行けない。
         */
        const side = NODE_RADIUS;
        const bottom = NODE_RADIUS + Math.round(NAME_SIZE * 1.6);

        return {
            x: Math.min(WIDTH - side, Math.max(side, point.x)),
            y: Math.min(HEIGHT - bottom, Math.max(side, point.y)),
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
        /*
         * ★ 余白のぶんを足して数える。
         *
         *   描く範囲は紙より一回り大きい。
         *   紙の幅だけで割ると、そのぶん掴む位置がずれる。
         */
        /*
         * ★ 出している範囲（view）で割る。
         *   紙の全体ではなく、中身に合わせて切っているので。
         */
        return {
            x: view.x + ((event.clientX - rect.left) / rect.width) * view.w,
            y: view.y + ((event.clientY - rect.top) / rect.height) * view.h,
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
    /*
     * いま図に出ている人から、組を作る。
     *
     * ★ 資料は全部渡す。
     *   組織の項目は、関係を結んでいなければ図に出てこない。
     *   それでも「所属する人」は書いてあるので、そこから組が作れる。
     *
     * ★ 返すのは、図に二人以上いる組だけ。
     */
    function findGroupsHere() {
        const onGraph = new Set(nodes.map((node) => node.id));

        /*
         * ★ 作者が決めた組だけ。
         *
         *   関係の言葉や家族から当てた組は、外れることがある。
         *   そちらは右の欄に候補として出すだけにして、
         *   図には描かない。
         */
        /*
         * ★ 一人の組も残す。
         *   作者が作った組なら、一人でも組。
         *   ただし、組織の項目そのもの（組の名前の丸）だけ、は組にしない。
         */
        return authoredAll()
            .map((group) => ({
                ...group,
                ids: group.ids.filter((id) => onGraph.has(id)),
            }))
            .filter((group) => group.ids.some((id) => id !== group.key));
    }

    /* 作者が決めた組。まだ誰も入れていない組も含めて全部 */
    function authoredAll() {
        return findGroups(entries, relations, {
            pages,
            use: AUTHORED,
            keepSmall: true,
        });
    }

    /*
     * 組分けする。
     *
     * ★ 押したときに作って、組ごとに並べ直す。
     *   囲みだけ出して並びがばらばらのままだと、
     *   囲みが紙いっぱいに広がって重なり合う。
     *
     * ★ 見つからなければ、何を書けば組になるかを伝える。
     *   黙っていると、押しても壊れているように見える。
     */
    function runGrouping() {
        const found = findGroupsHere();

        if (found.length === 0) {
            rememberGrouped(false);
            setGroupNote(
                "まだ組がありません。右の欄の「新しい組」で作るか、" +
                    "人物の資料の「所属」で組織を選ぶと、組になります。",
            );
            return;
        }

        rememberGrouped(true);

        const names = found.map((group) => group.name).filter(Boolean);
        setGroupNote(
            `${found.length}つの組に分けました：${names.slice(0, 6).join("・")}` +
                (names.length > 6 ? ` ほか${names.length - 6}` : ""),
        );

        arrange(found);
    }

    /*
     * 組分けを解く。
     *
     * ★ 解いたら、ふだんの図の並びに整え直す。
     *   組分けの並びは広い紙で決めてあるので、そのまま戻すと
     *   ふだんの紙の上で詰まって、丸どうしが重なる。
     *   紙の大きさが戻ってから並べるので、描き終えたあとで行う。
     */
    function stopGrouping() {
        retidy.current = true;
        rememberGrouped(false);
        setGroupNote("");
    }

    function tidy() {
        /*
         * ★ 組分けしているときは、組ごとに寄せる。
         *
         *   ばらばらのまま囲むと、囲みが紙いっぱいに広がって、
         *   どの囲みも重なってしまう。
         *   先に寄せてから囲めば、囲みは小さく収まる。
         *
         *   組が見つからなければ、これまでどおり詰める。
         */
        arrange(mayGroup && grouped ? findGroupsHere() : []);
    }

    function arrange(byGroup: ReturnType<typeof findGroupsHere>) {
        if (!onMove) return;

        const packedPlace =
            byGroup.length > 0
                ? packByGroup({
                      /*
                       * ★ 囲みで表す組織の項目は、並べない。
                       *   丸を描かないので、場所も要らない。
                       */
                      ids: nodes
                          .map((node) => node.id)
                          .filter(
                              (id) =>
                                  !byGroup.some(
                                      (group) =>
                                          group.key === id &&
                                          group.ids.some((one) => one !== id),
                                  ),
                          ),
                      groups: byGroup,
                      width: GROUP_WIDTH,
                      height: GROUP_HEIGHT,
                      /*
                       * ★ 格子の一目は、いちばん大きい人（主人公）のカードが収まる広さ。
                       *   目が狭いと、隣どうしのカードと名前がくっつく。
                       */
                      gap: Math.max(gapWanted, NODE_RADIUS * 6.6),
                      minGap: NODE_RADIUS * 6.2,
                      /* 席替えに使う。線が短く、交わらない順に座らせる */
                      links: shownRelations.map((relation) => ({
                          a: relation.from_entry_id,
                          b: relation.to_entry_id,
                      })),
                      hub:
                          nodes.find((node) => tierOf(node.id) === 0)?.id ?? null,
                      aspect: liveAspect,
                  })
                : packed(nodes, false);

        /*
         * ★ 組ごとに並べたら、そのまま使う。
         *   前は関係で引き合わせてほぐしていたが、丸が斜めに散らばって
         *   かえって読みにくかった。丸は格子にそろえておく。
         */
        const place = packedPlace;

        /*
         * ★ 組ごとに並べたときは、ほどかない。
         *   間は並べる時点で空けてある。
         *   ほどくと人が押し出され、隣の組の囲みに入り込む。
         */
        if (byGroup.length === 0) untangle(place, new Set());

        /*
         * ★ 覚えてもらうのは、紙に対する割合。
         *
         *   ここだけ、紙の座標のまま渡していた。
         *   受け取る側は 1 を超える値を「昔の覚え方」とみなして
         *   1600×1000 の紙での割合に直すので、
         *   整理するたびに、全員が右下の隅へ寄って重なっていた。
         *
         *   つまんで動かしたときと同じ形で渡す。
         */
        const paperW = byGroup.length > 0 ? GROUP_WIDTH : WIDTH;
        const paperH = byGroup.length > 0 ? GROUP_HEIGHT : HEIGHT;

        for (const node of nodes) {
            const point = place.get(node.id);

            if (point) {
                onMove(node.id, {
                    x: point.x / paperW,
                    y: point.y / paperH,
                });
            }
        }
    }

    const active = hoveredId ?? selectedId;

    useEffect(() => {
        if (grouped || !retidy.current) return;
        retidy.current = false;
        tidy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouped]);

    /* 線を描き終えてから重ねる、関係名の札 */
    const laterLabels: {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
        text: string;
        color: string;
        dim: boolean;
    }[] = [];
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
              * いまの姿を、一行で。
              *
              * ★ 全体像を確かめる場所なので、
              *   数がそろっているかを、まず出す。
              *
              *   結んだ人・まだの人・関係の本数。
              *   これだけで「あと誰が残っているか」が分かる。
              */}
            {/*
              * 名前で探す。
              *
              * ★ 人が増えると、目で探すのは無理。
              *   打った字を含む人だけを、はっきり出す。
              *   ほかは薄くして、場所だけ分かるようにする。
              *
              * ★ 人が少ないうちは出さない。
              *   4 人の図に探す欄があっても、邪魔なだけ。
              */}
            {/*
              * ★ 探す欄と数は、同じ行に置く。
              *
              *   二段に積むと、それだけで 50px ほど取る。
              *   そのぶん図が低くなり、名前が小さくなる。
              *   縦に使える所は、図に回す。
              */}
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {entries.length >= 8 && (
                    <input
                        type="text"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        placeholder="名前で探す"
                        aria-label="名前で探す"
                        className="w-40 rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] outline-none focus:border-forest"
                    />
                )}

                <p className="text-[11px] text-muted">
                    {nodes.length}人を{relations.length}本の関係で結んでいます。
                </p>
            </div>

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
            {/*
              * ★ 上下左右に送れるようにする。
              *
              *   一枚を大きくすると、枠からはみ出す。
              *   はみ出したところは、送って見る。
              *
              * ★ 真ん中から見えるようにする。
              *   左上から始まると、いちばん見たい真ん中が
              *   毎回外れている。
              */}
            <div
                ref={panRef}
                className="thin-scroll min-h-0 flex-1 overflow-auto"
            >
                {/*
                  * ★ 縦にも真ん中へ置くための、内側の一枚。
                  *
                  *   margin: auto は横しか真ん中にしない。
                  *   縦が上に張り付いて、下が大きく空いていた。
                  *
                  *   枠と同じ大きさを下限に持つ入れ物を挟み、
                  *   その中で縦横とも真ん中に寄せる。
                  *   紙が枠より大きいときは、この入れ物ごと伸びる。
                  */}
                {/*
                  * ★ はみ出しているときは、真ん中に寄せない。
                  *
                  *   寄せたまま大きくすると、
                  *   左と上へはみ出したぶんが掴めなくなる。
                  *   送っても端まで戻れない。
                  *
                  *   枠より小さいときだけ寄せる。
                  */}
                <div
                    className={[
                        "flex min-h-full min-w-full",
                        zoom > 1
                            ? "items-start justify-start"
                            : "items-center justify-center",
                    ].join(" ")}
                >
            <svg
                ref={svgRef}
                /*
                 * ★ 紙の外側に、少し余白を持たせる。
                 *
                 *   端に置いた丸は、そのままだと半分切れ、
                 *   下に出る名前も消える。
                 *
                 *   描く範囲だけ外へ広げる。
                 *   置ける場所は紙の中のまま。
                 */
                viewBox={`${Math.round(view.x)} ${Math.round(view.y)} ${Math.round(
                    view.w,
                )} ${Math.round(view.h)}`}
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
                /*
                 * ★ 一枚の大きさ。
                 *
                 *   いちばん小さいときは、枠の中にすっかり収まる。
                 *   上下にも送りが出ないよう、高さで合わせる。
                 *
                 *   幅で合わせると、板が横長なので
                 *   高さが余り、縦の送りだけが残っていた。
                 *
                 * ★ いちばん大きいときは、その 2 倍。
                 *   前は 2.8 倍で、大きすぎた。
                 */
                /*
                 * ★ 実寸で決める。
                 *
                 *   割合（%）で指定すると、入れ物の作りによって
                 *   伸びたり伸びなかったりする。
                 *   真ん中から先で大きくならなかったのは、これ。
                 *
                 *   枠の高さを測って、その何倍かで出す。
                 *
                 * ★ 0 で枠の 3 割、100 で 1.2 倍。
                 *   前はいちばん大きいが 2 倍で、大きすぎた。
                 */
                /*
                 * ★ 枠いっぱいに使う。
                 *
                 *   前は高さだけを見て決めていた。
                 *   枠が横に長いと、横が余ったままになる。
                 *
                 *   横と縦の両方を見て、
                 *   「ちょうど収まる大きさ」を先に出す。
                 *   つまみは、そこからの倍率。
                 *
                 * ★ つまみがいちばん左のとき、1.0 倍。
                 *   紙の全体が、枠にぴったり収まる。
                 */
                /*
                 * ★ 縦も横も、実寸で決める。
                 *
                 *   比（aspectRatio）に任せると、
                 *   入れ物の作りによって片方が伸びない。
                 *
                 * ★ 縮めさせない（flexShrink: 0）。
                 *
                 *   送る枠は横並びの入れ物で、
                 *   はみ出した絵は勝手に縮められる。
                 *   つまみを動かしても大きくならなかったのは、これ。
                 */
                style={{
                    /*
                     * ★ 文字と同じ並び方をやめる。
                     *
                     *   そのままだと、絵が文字の足元の線に乗り、
                     *   下に数ピクセルの隙間ができる。
                     *   そのぶんはみ出して送りが出て、
                     *   幅が減って、さらにはみ出す。
                     */
                    display: "block",
                    /*
                     * ★ 中身の範囲を、枠に収めてから倍率を掛ける。
                     *
                     *   倍率 1 で、中身がちょうど枠いっぱい。
                     *   そこから寄って読む。
                     */
                    width: fitRatio
                        ? `${Math.floor(view.w * fitRatio * zoom)}px`
                        : "100%",
                    height: fitRatio
                        ? `${Math.floor(view.h * fitRatio * zoom)}px`
                        : "100%",
                    flexShrink: 0,
                    flexGrow: 0,
                }}
                role="img"
                aria-label="関係図"
                onPointerMove={(event) => {
                    /* 線の中間点をつまんでいるとき */
                    if (bending) {
                        /*
                         * ★ 中間点も、板の中に留める。
                         *
                         *   外へ置けるようにしたが、
                         *   板の外は描かれないので線が切れて見えた。
                         *   置いたはずの点も消える。
                         *
                         *   板を広く取ってあるので、
                         *   中だけでも十分に回せる。
                         */
                        const point = toGraphPoint(event);
                        if (!point) return;
                        setBending({ ...bending, position: clampToBoard(point) });
                        return;
                    }

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
                /*
                 * ★ 何も無いところを押したら、全体に戻す。
                 *
                 *   中心に見ているとき、外れた場所を押すと
                 *   そのままだった。戻る道が押し具だけなのは、
                 *   下まで目を動かすことになる。
                 *
                 *   図そのものを押せば戻る。
                 */
                onPointerDown={(event) => {
                    if (event.target === event.currentTarget) {
                        onSelect(null);
                    }
                }}
                onPointerUp={() => {
                    /* 線の中間点を離したとき */
                    if (bending) {
                        onBend?.(bending.id, bending.position);
                        setBending(null);
                        return;
                    }

                    if (!dragging) return;

                    /*
                     * ★ 中心に見ているあいだに動かしたぶんは、覚えない。
                     *
                     *   あの並びはこちらが置き直したもの。
                     *   そこでの位置を覚えると、
                     *   全体に戻したときに並びが崩れる。
                     */
                    if (focusId) {
                        if (!dragging.moved) {
                            onSelect(selectedId === dragging.id ? null : dragging.id);
                        }
                        setDragging(null);
                        return;
                    }
                    // 動かさずに離したときは、選んだものとして扱う
                    /*
                     * ★ 覚えるときは、いちばん狭い紙での値に戻す。
                     *   広げた状態の値をそのまま覚えると、
                     *   狭めたときに紙からはみ出す。
                     */
                    /*
                     * ★ 覚えるときは、紙に対する割合に直す。
                     *   0〜1 で持てば、紙の広さが変わっても合う。
                     */
                    if (dragging.moved) {
                        onMove?.(dragging.id, {
                            x: dragging.position.x / WIDTH,
                            y: dragging.position.y / HEIGHT,
                        });
                    }
                    else onSelect(selectedId === dragging.id ? null : dragging.id);
                    setDragging(null);
                }}
                onPointerLeave={() => {
                    if (bending) {
                        onBend?.(bending.id, bending.position);
                        setBending(null);
                    }
                    if (dragging?.moved && !focusId) {
                        onMove?.(dragging.id, {
                            x: dragging.position.x / WIDTH,
                            y: dragging.position.y / HEIGHT,
                        });
                    }
                    setDragging(null);
                }}
            >
                {/*
                  * 紙の縁。
                  *
                  * ★ どこまでが紙かを、目に見えるようにする。
                  *
                  *   丸を置ける範囲は、この中だけ。
                  *   縁が見えないと、どこで止まっているのか、
                  *   止まっているのが正しいのかが分からない。
                  *
                  *   いちばん小さくしたとき、この縁が
                  *   枠にぴったり重なるのが正しい姿。
                  */}
                <rect
                    x="0.5"
                    y="0.5"
                    width={WIDTH - 1}
                    height={HEIGHT - 1}
                    fill="none"
                    stroke="var(--color-brand-border)"
                    strokeWidth="1"
                    strokeDasharray="6 6"
                    opacity="0.5"
                />

                {/*
                 * 丸に落とす影。
                 * 板の上に置かれているように見せる。
                 */}
                <defs>
                    {/*
                      * 矢印の先。
                      *
                      * ★ 線の色ごとに用意する。
                      *   SVG の矢印は、線の色を引き継がない。
                      *   家族の線に敵対の色の矢印が付くと、読み違える。
                      */}
                    {RELATION_GROUPS.map((group) => (
                        <marker
                            key={group.key}
                            id={`arrow-${group.key}`}
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M0 0 L10 5 L0 10 z" fill={group.color} />
                        </marker>
                    ))}

                    {/*
                      * 相関図のときの矢印。
                      *
                      * ★ 図の大きさで決める。
                      *   線の太さに合わせると、全体を縮めて見たときに
                      *   矢印が点のように小さくなった。
                      */}
                    {Object.entries(STRONG_COLORS).map(([key, color]) => (
                        <marker
                            key={`strong-${key}`}
                            id={`arrow-strong-${key}`}
                            viewBox="0 0 10 10"
                            refX="8.5"
                            refY="5"
                            markerUnits="userSpaceOnUse"
                            markerWidth={Math.round(NODE_RADIUS * 0.5)}
                            markerHeight={Math.round(NODE_RADIUS * 0.5)}
                            orient="auto-start-reverse"
                        >
                            <path d="M0 0.5 L10 5 L0 9.5 z" fill={color} />
                        </marker>
                    ))}

                    {/*
                      * 相関図の地。薄い方眼。
                      * ★ 真っ白の地は、事務の道具に見える。作家の資料らしくする。
                      */}
                    <pattern
                        id="paper-grid"
                        width={Math.round(NODE_RADIUS * 0.8)}
                        height={Math.round(NODE_RADIUS * 0.8)}
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d={`M ${Math.round(NODE_RADIUS * 0.8)} 0 L 0 0 0 ${Math.round(NODE_RADIUS * 0.8)}`}
                            fill="none"
                            stroke="var(--color-line)"
                            strokeOpacity="0.45"
                            strokeWidth="0.6"
                            vectorEffect="non-scaling-stroke"
                        />
                    </pattern>

                    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#3b2f1e" floodOpacity="0.16" />
                    </filter>

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

                {/*
                  * まとまりの囲み。
                  *
                  * ★ いちばん下に描く。
                  *   線と丸の上に乗ると、図が読めなくなる。
                  *
                  * ★ 塗りはごく薄く。
                  *   囲みは、そこに何があるかを示すだけのもの。
                  *   主役は丸と線なので、色で争わない。
                  */}
                {/*
                  * ★ 名札は、囲みの左上に色の札で出す。
                  *
                  *   前は薄い色の字を、囲みの中に直に書いていた。
                  *   二つの組の角が同じところにあると、
                  *   名前が重なって「N公安」のように潰れた。
                  *
                  *   外側の組から順に置き、先に置いた札とぶつかるなら右へずらす。
                  */}
                {/* 相関図の地。薄い方眼の紙 */}
                {grouping && (
                    <rect
                        x={view.x - view.w}
                        y={view.y - view.h}
                        width={view.w * 3}
                        height={view.h * 3}
                        fill="url(#paper-grid)"
                        pointerEvents="none"
                    />
                )}

                {(() => {
                    /*
                     * ★ 組は、薄い色の範囲と見出しだけ。
                     *
                     *   濃い色の箱に人を詰めると、人と関係より先に
                     *   「この人はこの組」が目に入り、組の図になってしまう。
                     *   相関図の主役は人と関係。組は背景に下げる。
                     *
                     * ★ 見出しの横に、組織の資料の一言説明を添える。
                     *   「血よりも強い、つながりがある。」のような一言があると、
                     *   組がただの分類ではなく、物語の中の場所になる。
                     *
                     * ★ 二つの範囲の隅が近いときは、後の見出しを右へずらす。
                     */
                    const titleFont = Math.round(NAME_SIZE * 1.15);
                    const titleH = Math.round(titleFont * 1.2);
                    const inset = Math.round(NODE_RADIUS * 0.35);
                    const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
                    const titles = new Map<string, { x: number; y: number; w: number }>();

                    for (const box of groupBoxes) {
                        /* 札の幅。点と両端の余白のぶんも入れる */
                        const w = Math.round(
                            Array.from(box.name || "組").length * titleFont + titleFont * 2.45,
                        );
                        let x = box.x1 + inset * 2;
                        const y = box.y1 - titleH / 2;

                        for (let tries = 0; tries < 12; tries += 1) {
                            const hit = placed.find(
                                (one) =>
                                    x < one.x2 + 6 &&
                                    x + w > one.x1 - 6 &&
                                    y < one.y2 &&
                                    y + titleH > one.y1,
                            );
                            if (!hit) break;
                            x = hit.x2 + titleFont * 0.6;
                        }

                        placed.push({ x1: x, y1: y, x2: x + w, y2: y + titleH });
                        titles.set(box.key, { x, y, w });
                    }

                    return groupBoxes.map((box) => {
                        const ink = groupColors.get(box.key) ?? "#5566a8";
                        const title = titles.get(box.key)!;
                        /*
                         * ★ 名札は白い札に黒い字。組の色は、横の点と囲みの縁だけ。
                         *   色の字は、薄い色だと読めなかった。
                         */
                        const tagH = Math.round(titleFont * 1.5);
                        const dot = Math.round(titleFont * 0.3);
                        const tagW = title.w;
                        const tagX = title.x;
                        const tagY = box.y1 - tagH / 2;

                        return (
                            <g key={`box-${box.key}`} pointerEvents="none">
                                <rect
                                    x={box.x1}
                                    y={box.y1}
                                    width={box.x2 - box.x1}
                                    height={box.y2 - box.y1}
                                    rx={NODE_RADIUS * 0.45}
                                    fill={ink}
                                    fillOpacity={0.07}
                                    stroke={ink}
                                    strokeOpacity={0.6}
                                    strokeWidth={1.5}
                                    strokeDasharray={box.levels > 0 ? "5 4" : undefined}
                                    vectorEffect="non-scaling-stroke"
                                />
                                <rect
                                    x={tagX}
                                    y={tagY}
                                    width={tagW}
                                    height={tagH}
                                    rx={tagH / 2}
                                    fill="#ffffff"
                                    stroke={ink}
                                    strokeWidth={1.5}
                                    vectorEffect="non-scaling-stroke"
                                />
                                <circle
                                    cx={tagX + titleFont * 0.6 + dot}
                                    cy={tagY + tagH / 2}
                                    r={dot}
                                    fill={ink}
                                />
                                <text
                                    x={tagX + titleFont * 0.6 + dot * 2 + titleFont * 0.35}
                                    y={tagY + tagH / 2 + titleFont * 0.36}
                                    fontSize={titleFont}
                                    fontWeight="700"
                                    fill={INK}
                                >
                                    {box.name}
                                </text>
                            </g>
                        );
                    });
                })()}

                {[
                    ...visibleRelations.filter((relation) => !isQuiet(relation)),
                    ...visibleRelations.filter((relation) => isQuiet(relation)),
                ].map((relation) => {
                    const from = anchorOf(relation.from_entry_id);
                    const to = anchorOf(relation.to_entry_id);
                    if (!from || !to) return null;

                    /* この線が、いま選んでいる人につながっているか */
                    const touchesActive =
                        !!active &&
                        (relation.from_entry_id === active ||
                            relation.to_entry_id === active);

                    const isActive = !active || touchesActive;

                    /*
                     * 線の曲げ方。
                     *
                     * ★ 中間点が決めてあれば、そこを通す。
                     *
                     *   決めていなければ、中心へ少し引き寄せる。
                     *   直線だけだと、線が重なって読めない。
                     *
                     * ★ つまんでいる最中は、指の位置を使う。
                     */
                    /*
                     * 中間点。
                     *
                     * ★ 中心に見ているときは、使わない。
                     *
                     *   あの並びは、こちらが置き直したもの。
                     *   丸だけ動かして中間点をそのままにすると、
                     *   線が遠くへ引っ張られて、尖った形になる。
                     *
                     *   置き直した並びには、置き直した線を引く。
                     */
                    const bent = focusId
                        ? null
                        : bending?.id === relation.id
                          ? bending.position
                          : (relation.bend ?? null);

                    /*
                     * 線の引き方。
                     *
                     * ★ 中間点を決めてあれば、そこを通る二本の直線。
                     *
                     *   曲線の「制御点」は線の上に乗らない。
                     *   つまんだ点と線が離れていて、
                     *   どこを動かしているのか分からなかった。
                     *
                     *   二本の直線にすれば、点は必ず線の上にある。
                     *   直角に曲げることもできる。
                     *
                     * ★ 決めていなければ、これまでどおり緩く曲げる。
                     */
                    /*
                     * ★ ふだんはまっすぐ引く。
                     *
                     *   前は中心へ引き寄せて緩く曲げていた。
                     *   線が重なるのを避けるためだったが、
                     *   紙を広げたので、重なることは減った。
                     *
                     *   曲げたいときは、中間点を置いてもらう。
                     *   勝手に曲げるより、そのほうが分かりやすい。
                     */
                    /*
                     * 重なりを避ける膨らみ。
                     *
                     * ★ 中間点を置いた線には、掛けない。
                     */
                    const bow = bent ? 0 : (bowOf.get(relation.id) ?? 0);

                    /*
                     * 通り道の、真ん中の点。
                     *
                     * ★ 膨らませるときは、線と直角の向きへずらす。
                     */
                    const middle = (() => {
                        if (bent) return bent;

                        const center = {
                            x: (from.x + to.x) / 2,
                            y: (from.y + to.y) / 2,
                        };

                        if (bow === 0) return center;

                        const dx = to.x - from.x;
                        const dy = to.y - from.y;
                        const length = Math.hypot(dx, dy) || 1;

                        /*
                         * ★ 膨らむ向きは、二人の並びで決める。
                         *
                         *   線の向きで決めると、
                         *   行きと帰りで直角の向きも裏返り、
                         *   二本とも同じ側へ膨らんで重なる。
                         *
                         *   どちらから引いた線でも同じ物差しを使う。
                         */
                        const lean =
                            bow *
                            (relation.from_entry_id < relation.to_entry_id
                                ? 1
                                : -1);

                        return {
                            x: center.x + (-dy / length) * BOW * lean,
                            y: center.y + (dx / length) * BOW * lean,
                        };
                    })();

                    /*
                     * 線の端。
                     *
                     * ★ 丸の手前で止める。
                     *   中心まで引くと、矢印が丸に隠れる。
                     *
                     * ★ 止める向きは、真ん中の点のほう。
                     *   膨らんだ線でも、端の向きが線に沿う。
                     */
                    const head = pullBack(from, middle, HALO);
                    const tail = pullBack(to, middle, HALO);

                    /*
                     * ============================================================
                     * よけて回る道（会員）
                     *
                     * ★ まっすぐ引けるところは、まっすぐのまま。
                     *
                     *   何も邪魔していないのに折れると、
                     *   かえって、どこへ繋がっているのか分からない。
                     *
                     * ★ 丸や囲みを跨ぐときだけ、直角に折れてよける。
                     *
                     *   自分の居る囲みは、よけない。
                     *   中から出られなくなる。
                     *
                     * ★ 中間点を置いた線と、行き帰りの二本は、そのまま。
                     *   作者が決めた通り道を、こちらで書き換えない。
                     */
                    /*
                     * ★ 弧でよけるのを先に試す。直角に折るのは最後。
                     *   直角の線は囲みの外を大きく回り込み、
                     *   ほかの線や名札と重なっていた。
                     */
                    const around = !bent ? (aroundOf.get(relation.id) ?? null) : null;

                    /* 弧でよけるときの引っ張り点 */
                    const arcAt = around?.control ?? null;

                    /* 直角に折ってよけるときの道 */
                    const routed = around?.ready
                        ? around.points
                        : around && !arcAt && around.points.length > 2
                          ? trimEnds(around.points, HALO)
                          : null;

                    const arcHead = arcAt ? pullBack(from, arcAt, HALO) : null;
                    const arcTail = arcAt ? pullBack(to, arcAt, HALO) : null;

                    const curve = around?.curve ?? null;

                    const path = bent
                        ? `M${head.x} ${head.y} L${bent.x} ${bent.y} L${tail.x} ${tail.y}`
                        : curve
                          ? curve.d
                          : arcAt && arcHead && arcTail
                          ? `M${arcHead.x} ${arcHead.y} Q${arcAt.x} ${arcAt.y} ${arcTail.x} ${arcTail.y}`
                          : routed && (around?.ready || routed.length > 2)
                          ? roundedPath(routed, NODE_RADIUS * (around?.ready ? 0.3 : 1.1))
                          : bow === 0
                            ? `M${head.x} ${head.y} L${tail.x} ${tail.y}`
                            : `M${head.x} ${head.y} Q${middle.x} ${middle.y} ${tail.x} ${tail.y}`;

                    /*
                     * 関係の名前を置くところ。
                     *
                     * ★ 線の上に置く。
                     *
                     *   曲線のときは、真ん中の点を出す。
                     *   制御点に置くと、線から浮いて見える。
                     */
                    /*
                     * ★ 膨らませた線では、線そのものの真ん中に置く。
                     *
                     *   弧の真ん中は、曲げるのに使う点より
                     *   半分だけ内側にある。
                     *   曲げる点に置くと、名前が線から浮く。
                     */
                    const onLine = bent
                        ? bent
                        : arcAt && arcHead && arcTail
                          ? {
                                x: (arcHead.x + arcAt.x * 2 + arcTail.x) / 4,
                                y: (arcHead.y + arcAt.y * 2 + arcTail.y) / 4,
                            }
                          : routed && (around?.ready || routed.length > 2)
                          ? middleOf(routed)
                          : bow === 0
                          ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
                          : {
                                x: (head.x + middle.x * 2 + tail.x) / 4,
                                y: (head.y + middle.y * 2 + tail.y) / 4,
                            };

                    /*
                     * ★ 札は、線の真ん中に置く。
                     *
                     *   一度は横へ逃がしてみたが、
                     *   線から離れた札は、どの線のものか分からない。
                     *
                     *   重なるのは、丸どうしが近すぎるから。
                     *   逃がすのではなく、丸の間を空けて直す。
                     *   間は、札が入るだけの幅を最初から取ってある。
                     */
                    const labelW =
                        Array.from(relation.label ?? "").length * Math.round(NAME_SIZE * 0.95) +
                        NAME_SIZE * 1.2;
                    const labelH = NAME_SIZE * 1.55;

                    /* この線に名前を出すか */
                    const nameShown =
                        !!relation.label && (touchesActive || (grouping && showNames));

                    const labelAt =
                        grouping && curve && nameShown
                            ? labelOnCurve(curve.samples, labelW, labelH)
                            : grouping && routed && relation.label
                            ? labelSpot(
                                  routed,
                                  Array.from(relation.label).length *
                                      Math.round(NAME_SIZE * 1.02) +
                                      NAME_SIZE * 0.9,
                                  NAME_SIZE * 1.5,
                              )
                            : onLine;

                    const controlX = labelAt.x;
                    const controlY = labelAt.y;

                    /*
                     * 線の形。
                     *
                     * 決めていなければ、これまでどおり
                     * 変化の記録があれば実線、無ければ破線。
                     */
                    /*
                     * ★ 組分けしているときは、決めていない線を実線にする。
                     *   点線だらけの図は、全体が薄くぼやけて見えた。
                     *   作者が「破線」と決めた線だけ破線にする。
                     */
                    const lineStyle =
                        relation.line_style ??
                        (grouping || relation.changes.length > 0 ? "solid" : "dashed");

                    return (
                        /*
                          * ★ 選んでいる人から遠い線は、ほとんど消す。
                          *
                          *   前は 0.15 で残していたが、
                          *   47 本もあると、薄くても地が埋まる。
                          *   見るべき線だけを残す。
                          */
                        <g
                            key={relation.id}
                            opacity={isActive ? 1 : grouping ? 0.16 : 0.06}
                        >
                            {/*
                              * ★ 線を二度押すと、中間点が出る。
                              *
                              *   押しやすいよう、見えない太い線を重ねる。
                              *   細い線をぴたりと押すのは、指では無理。
                              */}
                            <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth="14"
                                style={{ cursor: "pointer" }}
                                onDoubleClick={(event) => {
                                    event.stopPropagation();
                                    setOpenBendId(
                                        openBendId === relation.id
                                            ? null
                                            : relation.id,
                                    );
                                }}
                            />

                            <path
                                d={path}
                                fill="none"
                                stroke={
                                    grouping
                                        ? strongColorOf(relation.label)
                                        : colorOf(relation.label)
                                }
                                /*
                                 * ★ 線の太さは、画面の点で決める。
                                 *   図を縮めて全体を出すと、線が髪の毛のように細くなり、
                                 *   破線はほとんど見えなかった。
                                 *
                                 * ★ 相関図のときは、さらに太く。線が主役。
                                 */
                                strokeWidth={
                                    grouping ? 3 : relation.changes.length > 0 ? 2.6 : 1.9
                                }
                                vectorEffect="non-scaling-stroke"
                                /*
                                 * 線の形。
                                 *
                                 * ★ 決めてあれば、それを使う。
                                 * ★ 決めていなければ、これまでどおり
                                 *   変化の記録があれば実線、無ければ破線。
                                 */
                                strokeDasharray={
                                    lineStyle === "dashed" ? "7 6" : "0"
                                }
                                markerEnd={
                                    lineStyle === "arrow"
                                        ? grouping
                                            ? `url(#arrow-strong-${groupOf(relation.label).key})`
                                            : `url(#arrow-${groupOf(relation.label).key})`
                                        : undefined
                                }
                            />
                            {/*
                              * 中間点。つまんで、線の通り道を決める。
                              *
                              * ★ 選んでいる線にだけ出す。
                              *
                              *   47 本すべてに点を置くと、
                              *   図が点だらけになる。
                              *
                              * ★ 二度押しで、元の曲げ方に戻す。
                              *   動かしすぎたときに、戻す道が要る。
                              */}
                            {/*
                              * 中間点。
                              *
                              * ★ ふだんは出さない。
                              *
                              *   47 本すべてに点が出ると、
                              *   関係の名前と見分けが付かず、
                              *   図が点だらけになる。
                              *
                              *   線を二度押したときだけ出す。
                              */}
                            {onBend && !focusId && openBendId === relation.id && (
                                <circle
                                    cx={controlX}
                                    cy={controlY}
                                    r={bending?.id === relation.id ? 7 : 4.5}
                                    fill="var(--color-canvas)"
                                    stroke={colorOf(relation.label)}
                                    strokeWidth="2"
                                    style={{ cursor: "grab" }}
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                        (event.target as Element).setPointerCapture?.(
                                            event.pointerId,
                                        );
                                        setBending({
                                            id: relation.id,
                                            position: { x: controlX, y: controlY },
                                        });
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        onBend(relation.id, null);
                                    }}
                                >
                                    <title>
                                        つまむと線の通り道が変わります（二度押しで元に戻す）
                                    </title>
                                </circle>
                            )}

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
                            {/*
                              * ★ 組分けしているときは、全部の線に名前を出す。
                              *   人物相関図は、線と名前で読むもの。
                              *   名前の無い線は、何の関係か分からない。
                              */}
                            {grouping && nameShown && (() => {
                                laterLabels.push({
                                    id: relation.id,
                                    x: controlX,
                                    y: controlY,
                                    w: labelW,
                                    h: labelH,
                                    text: relation.label,
                                    color: strongColorOf(relation.label),
                                    dim: !isActive,
                                });
                                return null;
                            })()}
                            {!grouping && relation.label && touchesActive && (() => {
                                /*
                                 * ★ 組分けしているときは、名前を大きく太く。
                                 *   全体を見たときに読める大きさにする。
                                 *   札は角を立て、線と同じ色の字で書く。
                                 */
                                const size = grouping
                                    ? Math.round(NAME_SIZE * 1.02)
                                    : EDGE_SIZE;
                                const chars = Array.from(relation.label).length;
                                const plateW = chars * size + size * 0.7;
                                const plateH = size * 1.45;

                                return (
                                    <>
                                        <rect
                                            x={controlX - plateW / 2}
                                            y={controlY - plateH / 2}
                                            width={plateW}
                                            height={plateH}
                                            rx={grouping ? size * 0.12 : size * 0.35}
                                            /*
                                             * ★ 相関図のときは、札の枠を描かない。
                                             *   地の色で線を切り抜き、そこへ名前を書く。
                                             *   「―― 恋人 ――>」のように、線の途中に名前が乗る。
                                             */
                                            fill="var(--color-canvas)"
                                            stroke={grouping ? "none" : "var(--color-line)"}
                                            strokeWidth="1"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        <text
                                            x={controlX}
                                            y={controlY + size * 0.36}
                                            textAnchor="middle"
                                            fontSize={size}
                                            fontWeight={grouping ? 800 : 400}
                                            fill={
                                                grouping
                                                    ? strongColorOf(relation.label)
                                                    : colorOf(relation.label)
                                            }
                                        >
                                            {relation.label}
                                        </text>
                                    </>
                                );
                            })()}
                        </g>
                    );
                })}

                {/*
                  * 関係名（組分けのとき）。
                  *
                  * ★ 線を全部描いてから、上に重ねる。
                  *   線ごとに書くと、後から引いた線が前の札の上を通って字が切れた。
                  *
                  * ★ 白い札に、黒い字。縁だけ線の色。
                  */}
                {grouping &&
                    laterLabels.map((one) => (
                        <g key={`label-${one.id}`} opacity={one.dim ? 0.2 : 1} pointerEvents="none">
                            <rect
                                x={one.x - one.w / 2}
                                y={one.y - one.h / 2}
                                width={one.w}
                                height={one.h}
                                rx={one.h / 2}
                                fill="#ffffff"
                                stroke={one.color}
                                strokeWidth={1.5}
                                vectorEffect="non-scaling-stroke"
                            />
                            <text
                                x={one.x}
                                y={one.y + NAME_SIZE * 0.34}
                                textAnchor="middle"
                                fontSize={Math.round(NAME_SIZE * 0.95)}
                                fontWeight={700}
                                fill={INK}
                            >
                                {one.text}
                            </text>
                        </g>
                    ))}

                {shownNodes.map((node) => {
                    const position = positions.get(node.id);
                    if (!position) return null;
                    /*
                     * ★ 組分けのときは、触れた人の相手も濃く残す。
                     *   線だけ出て相手が薄いと、誰との線か読めない。
                     */
                    const isActive =
                        !active ||
                        node.id === active ||
                        (grouping &&
                            visibleRelations.some(
                                (relation) =>
                                    touches(relation, active) &&
                                    touches(relation, node.id),
                            ));

                    return (
                        <g
                            key={node.id}
                            opacity={
                                /*
                                 * ★ 名前で探しているときは、そちらを優先する。
                                 *   合う人だけをはっきり出し、
                                 *   ほかは薄くして場所だけ残す。
                                 */
                                findText.trim()
                                    ? node.name.includes(findText.trim())
                                        ? 1
                                        : 0.12
                                    : isActive
                                      ? 1
                                      : 0.3
                            }
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
                            {grouping ? (
                                (() => {
                                    /*
                                     * 人物カード。
                                     *
                                     * ★ 白い台紙に、顔・名前・役割。
                                     *   写真を貼った資料の一枚のように見せる。
                                     *
                                     * ★ 顔が無ければ、名前の一文字目を大きく。
                                     *   丸に一文字ではなく、四角い枠の中に置く。
                                     */
                                    const card = cardOf(node.id);
                                    const top = position.y - card.h / 2;
                                    const imageY = top + card.pad;
                                    const nameY = imageY + card.image + card.pad * 0.8 + card.nameSize;
                                    const ink = ringOf.get(node.id);
                                    const shortName =
                                        Array.from(node.name).length > 9
                                            ? `${Array.from(node.name).slice(0, 9).join("")}…`
                                            : node.name;

                                    /*
                                     * ★ 顔は丸。
                                     *   四角いカードは写真の資料らしくはなるが、
                                     *   丸のほうが人の顔として目に入りやすい。
                                     *   縁の色で、その人が入っている組を示す。
                                     */
                                    const r = card.image / 2;
                                    const faceX = position.x;
                                    const faceY = imageY + r;

                                    return (
                                        <>
                                            {/* 選んでいる人は、外側にもう一重 */}
                                            {node.id === selectedId && (
                                                <circle
                                                    cx={faceX}
                                                    cy={faceY}
                                                    r={r + card.pad * 0.9}
                                                    fill="none"
                                                    stroke="var(--color-forest)"
                                                    strokeWidth={2.5}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            )}

                                            {pictures[node.id] ? (
                                                <>
                                                    <clipPath id={`clip-${node.id}`}>
                                                        <circle cx={faceX} cy={faceY} r={r} />
                                                    </clipPath>
                                                    <circle
                                                        cx={faceX}
                                                        cy={faceY}
                                                        r={r}
                                                        fill="var(--color-surface)"
                                                        filter="url(#card-shadow)"
                                                    />
                                                    <image
                                                        href={pictures[node.id]}
                                                        x={faceX - r}
                                                        y={faceY - r}
                                                        width={r * 2}
                                                        height={r * 2}
                                                        preserveAspectRatio="xMidYMid slice"
                                                        clipPath={`url(#clip-${node.id})`}
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <circle
                                                        cx={faceX}
                                                        cy={faceY}
                                                        r={r}
                                                        fill="var(--color-surface)"
                                                        filter="url(#card-shadow)"
                                                    />
                                                    <circle
                                                        cx={faceX}
                                                        cy={faceY}
                                                        r={r}
                                                        fill={ink ?? "#8a8174"}
                                                        fillOpacity={0.15}
                                                    />
                                                    <text
                                                        x={faceX}
                                                        y={faceY + card.image * 0.16}
                                                        textAnchor="middle"
                                                        fontSize={card.image * 0.44}
                                                        fontWeight="700"
                                                        fontFamily='"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
                                                        fill={ink ? darken(ink, 0.25) : "#5b5347"}
                                                        fillOpacity={0.85}
                                                    >
                                                        {Array.from(node.name)[0] ?? "?"}
                                                    </text>
                                                </>
                                            )}

                                            {/* 縁。組の色、組が無ければ落ち着いた灰 */}
                                            <circle
                                                cx={faceX}
                                                cy={faceY}
                                                r={r}
                                                fill="none"
                                                stroke={ink ?? "#9a9184"}
                                                strokeWidth={card.scale >= 1.2 ? 3.5 : 2.5}
                                                vectorEffect="non-scaling-stroke"
                                            />

                                            <text
                                                x={position.x}
                                                y={nameY}
                                                textAnchor="middle"
                                                fontSize={card.nameSize}
                                                fontWeight="700"
                                                fill={INK}
                                                paintOrder="stroke"
                                                stroke="#ffffff"
                                                strokeWidth={card.nameSize * 0.28}
                                                strokeLinejoin="round"
                                            >
                                                {shortName}
                                            </text>

                                            {card.role && (
                                                <text
                                                    x={position.x}
                                                    y={nameY + card.roleSize * 1.35}
                                                    textAnchor="middle"
                                                    fontSize={card.roleSize}
                                                    fill="#3a3a3a"
                                                >
                                                    （{Array.from(card.role).length > 10
                                                        ? `${Array.from(card.role).slice(0, 10).join("")}…`
                                                        : card.role}）
                                                </text>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                            <>
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

                            {/*
                              * 組の色の縁。
                              *
                              * ★ いちばん内側の組の色で縁取る。
                              *   囲みから離れたところでも、丸を見ればどの組か分かる。
                              */}
                            {ringOf.get(node.id) && (
                                <circle
                                    cx={position.x}
                                    cy={position.y}
                                    r={NODE_RADIUS}
                                    fill="none"
                                    stroke={ringOf.get(node.id)}
                                    strokeWidth={3}
                                    vectorEffect="non-scaling-stroke"
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
                                    y={position.y + Math.round(INITIAL_SIZE * 0.35)}
                                    textAnchor="middle"
                                    fontSize={INITIAL_SIZE}
                                    fontWeight="600"
                                    fill="var(--color-forest)"
                                >
                                    {Array.from(node.name)[0] ?? "?"}
                                </text>
                            )}

                            <text
                                x={position.x}
                                y={position.y + NAME_DROP}
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
                                fontSize={NAME_SIZE}
                                fontWeight="500"
                                fill="var(--color-ink)"
                            >
                                {node.name.length > 8
                                    ? `${node.name.slice(0, 8)}…`
                                    : node.name}
                            </text>
                            </>
                            )}
                        </g>
                    );
                })}

            </svg>
                </div>
            </div>

            {onMove && (
                <>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                        {/*
                          * ★ つまみは 1 つ。
                          *
                          *   紙を広げると、枠に収めるぶん小さく見える。
                          *   狭めると、枠に収まらず送って見る。
                          *   拡大と同じことをしているので、分けない。
                          */}
                        <label className="flex items-center gap-2">
                            <span className="text-[11px] text-faint">大きさ</span>
                            <span className="text-[9px] text-faint">大</span>

                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={wideValue}
                                onChange={(e) => setWideValue(Number(e.target.value))}
                                aria-label="図の大きさ"
                                className="w-36 accent-[var(--color-forest)]"
                            />

                            <span className="text-[12px] text-faint">小</span>
                        </label>

                        <button
                            type="button"
                            onClick={tidy}
                            className="rounded-md border border-forest bg-surface px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                        >
                            整理する
                        </button>

                        {/*
                          * 組分け。
                          *
                          * ★ 会員のときだけ出す。
                          *   使えない印を並べても、邪魔になるだけ。
                          *
                          * ★ 押すたびに作り直す。
                          *   資料や関係を書き足したあとに押せば、
                          *   その時点の中身で組み直す。
                          */}
                        {mayGroup && (
                            <button
                                type="button"
                                onClick={runGrouping}
                                aria-pressed={grouped}
                                title="図に出ている人を、所属・家族ごとの組に分けて並べ直します"
                                className={
                                    grouped
                                        ? "rounded-md border border-forest bg-forest-tint/60 px-3 py-1 text-[11px] text-forest"
                                        : "rounded-md border border-forest bg-surface px-3 py-1 text-[11px] text-forest hover:bg-forest-tint/60"
                                }
                            >
                                {grouped ? "組み直す" : "組分け"}
                            </button>
                        )}

                        {mayGroup && grouped && (
                            <button
                                type="button"
                                onClick={stopGrouping}
                                className="text-[11px] text-muted hover:text-forest hover:underline"
                            >
                                解く
                            </button>
                        )}

                        {/*
                          * 関係名を出すか。
                          *
                          * ★ 隠すと、人に触れた・選んだときだけ、その人の線に名前が出る。
                          *   組分けしていないときと同じ見え方。
                          */}
                        {mayGroup && grouped && (
                            <button
                                type="button"
                                onClick={() => rememberShowNames(!showNames)}
                                aria-pressed={showNames}
                                title={
                                    showNames
                                        ? "関係名を隠します。人に触れると、その人の関係名だけ出ます"
                                        : "関係名を全部の線に出します"
                                }
                                className={
                                    showNames
                                        ? "rounded-md border border-forest bg-forest-tint/60 px-3 py-1 text-[11px] text-forest"
                                        : "rounded-md border border-line bg-surface px-3 py-1 text-[11px] text-muted hover:border-forest-line"
                                }
                            >
                                {showNames ? "関係名：表示" : "関係名：隠す"}
                            </button>
                        )}

                        {/*
                          * 主人公を選ぶ。
                          *
                          * ★ 選んだ人は、いちばん大きく、真ん中寄りに座る。
                          * ★ 「役割から」に戻すと、資料の役割に「主人公」と書いた人。
                          */}
                        {mayGroup && grouped && onSetLead && (
                            <label className="inline-flex items-center gap-1 text-[11px] text-muted">
                                主人公
                                <select
                                    value={leadId ?? ""}
                                    onChange={async (event) => {
                                        await onSetLead(event.target.value || null);
                                        setGroupNote(
                                            "主人公を変えました。並びにも反映するときは「組み直す」を押してください。",
                                        );
                                    }}
                                    className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink"
                                >
                                    <option value="">役割から</option>
                                    {shownNodes
                                        .filter((node) => !boxOf.has(node.id) && !foundGroups.some((group) => group.key === node.id))
                                        .map((node) => (
                                            <option key={node.id} value={node.id}>
                                                {node.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                        )}

                        {/*
                          * 画面いっぱい。
                          *
                          * ★ 印にする。
                          *   言葉で書くと場所を取るうえ、
                          *   拡大の印は、どこで見ても同じ形をしている。
                          */}
                        <button
                            type="button"
                            onClick={() => setIsFull((open) => !open)}
                            aria-label={
                                isFull ? "元の大きさに戻す" : "画面いっぱいに広げる"
                            }
                            title={
                                isFull ? "元の大きさに戻す" : "画面いっぱいに広げる"
                            }
                            className="rounded-md border border-line p-1.5 text-muted hover:border-forest-line hover:text-forest"
                        >
                            <ExpandIcon isFull={isFull} />
                        </button>
                    </div>

                    {/*
                      * 組分けの結果。
                      *
                      * ★ 何組できたか、見つからなければ何を書けばよいか。
                      *   押しても変化が小さいとき、ここを見れば分かる。
                      */}
                    {mayGroup && groupNote && (
                        <p
                            role="status"
                            className={
                                grouped
                                    ? "mt-1.5 text-[11px] text-forest"
                                    : "mt-1.5 text-[11px] leading-relaxed text-muted"
                            }
                        >
                            {groupNote}
                        </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <p className="text-[11px] text-faint">
                            丸をつまむと動かせます。線を二度押すと、通り道が変わります。
                        </p>
                        {Object.keys(layout).length > 0 && (
                            <button
                                type="button"
                                onClick={() => onReset?.()}
                                className="shrink-0 text-[11px] text-forest hover:underline"
                            >
                                {nodes.length}人を並べ直す
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
            <ul className="mt-1.5 flex flex-wrap justify-center gap-x-5 gap-y-1">
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
                                stroke={grouping ? (STRONG_COLORS[group.key] ?? group.color) : group.color}
                                strokeWidth="2.6"
                                strokeLinecap="round"
                            />
                        </svg>
                        {group.label}
                    </li>
                ))}
            </ul>

            <p className="mt-1 text-center text-[11px] text-faint">
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

/**
 * 拡大の印。
 *
 * ★ 言葉で書かない。
 *   どこで見ても同じ形なので、印のほうが早い。
 *   読む画面の拡大にも、同じ形を使う。
 */
function ExpandIcon({ isFull }: { isFull: boolean }) {
    return (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            {isFull ? (
                <path
                    d="M6.5 1.5v5h-5M9.5 14.5v-5h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ) : (
                <path
                    d="M1.5 5.5v-4h4M14.5 10.5v4h-4M1.5 10.5v4h4M14.5 5.5v-4h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}
