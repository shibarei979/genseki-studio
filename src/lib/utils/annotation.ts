/**
 * ============================================================
 * 原石航路 Studio
 * 注釈の記法
 *
 *   言葉［＃注：説明］         直前の言葉に付く
 *   ｜言葉［＃注：説明］       範囲をはっきりさせたいとき（ふりがなの ｜ と同じ考え方）
 *   月読《つくよみ》［＃注：…］ ふりがなの付いた言葉にも付く
 *
 * ★ 記法は青空文庫の ［＃…］ にそろえた。書き慣れている人が多い。
 *
 * ★ 本文は書き換えない。読む画面で描くときにだけ、印に変える。
 *
 * ★ 描くときは、記法を「私用の文字」の目印に置き換えてから、
 *   ふりがな・縦書きの整えにかける。目印はどの整えにも触られない。
 *   最後に目印を、印（点線と ※番号）に変える。
 * ============================================================
 */

export interface Annotation {
    /** 印を付け始める位置（言葉の頭。｜ があればその位置） */
    start: number;
    /** 言葉の終わり（［＃注： の直前） */
    wordEnd: number;
    /** 記法の終わり（］ の次） */
    end: number;
    /** 注釈に使った ｜ の位置。無ければ -1（ふりがなの ｜ は含めない） */
    pipeAt: number;
    /** 言葉（ふりがなの記法を含むことがある） */
    word: string;
    note: string;
}

export interface NoteItem {
    index: number;
    /** 見せる言葉（ふりがなの記法は外す） */
    word: string;
    note: string;
}

const NOTE_RE = /［＃注：([^］\n]*)］/g;

const KANJI = /[一-鿿々〆〇ヵヶ]/;
const KATAKANA = /[゠-ヿｦ-ﾟ]/;
const HIRAGANA = /[぀-ゟ]/;
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/;

function classOf(char: string): string {
    if (KANJI.test(char)) return "kanji";
    if (KATAKANA.test(char)) return "kata";
    if (HIRAGANA.test(char)) return "hira";
    if (ALNUM.test(char)) return "alnum";
    return "";
}

/** 本文の中の注釈を、前から順にすべて見つける */
export function findAnnotations(text: string): Annotation[] {
    const found: Annotation[] = [];
    const re = new RegExp(NOTE_RE.source, "g");
    let hit: RegExpExecArray | null;
    let floor = 0;

    while ((hit = re.exec(text)) !== null) {
        const at = hit.index;
        const lineStart = Math.max(text.lastIndexOf("\n", at - 1) + 1, floor);
        let start = at;
        let pipeAt = -1;

        if (text[at - 1] === "》") {
            /* ふりがなの付いた言葉。ふりがなの記法ごと、1 つの言葉として扱う */
            const open = text.lastIndexOf("《", at - 1);
            if (open >= lineStart) {
                let s = open;
                const pipe = Math.max(text.lastIndexOf("｜", open), text.lastIndexOf("|", open));
                if (pipe >= lineStart && !/[《》［］]/.test(text.slice(pipe + 1, open))) {
                    s = pipe;
                } else {
                    while (s > lineStart && KANJI.test(text[s - 1])) s -= 1;
                }
                start = s;
            }
        } else {
            /* 注釈の ｜ があるか。間に ｜《》［］ が無いものだけ */
            const pipe = Math.max(text.lastIndexOf("｜", at - 1), text.lastIndexOf("|", at - 1));
            if (pipe >= lineStart && !/[｜|《》［］\n]/.test(text.slice(pipe + 1, at))) {
                start = pipe;
                pipeAt = pipe;
            } else {
                /* 直前の、同じ種類の字の並び（最大 20 字） */
                const kind = at > lineStart ? classOf(text[at - 1]) : "";
                if (kind) {
                    let s = at;
                    while (s > lineStart && at - s < 20 && classOf(text[s - 1]) === kind) s -= 1;
                    start = s;
                }
            }
        }

        const wordFrom = pipeAt >= 0 ? pipeAt + 1 : start;
        found.push({
            start,
            wordEnd: at,
            end: at + hit[0].length,
            pipeAt,
            word: text.slice(wordFrom, at),
            note: hit[1].trim(),
        });
        floor = at + hit[0].length;
    }

    return found;
}

/** ふりがなの記法を外して、言葉だけにする（一覧に出す用） */
function plainWord(word: string): string {
    return word
        .replace(/[|｜]([^《》\n]*)《[^》\n]*》/g, "$1")
        .replace(/《《([^》\n]*)》》/g, "$1")
        .replace(/([^《\n]*?)《[^》\n]*》/g, "$1")
        .trim();
}

function keyOf(word: string, note: string): string {
    return `${plainWord(word)}\u0000${note}`;
}

/**
 * 話の中の注釈に、出てきた順に番号を振る。
 * 同じ言葉・同じ説明が 2 度出てきたら、同じ番号にする。
 */
export function buildNoteIndex(body: string): { items: NoteItem[]; lookup: Map<string, number> } {
    const items: NoteItem[] = [];
    const lookup = new Map<string, number>();

    for (const one of findAnnotations(body)) {
        const key = keyOf(one.word, one.note);
        if (lookup.has(key)) continue;
        const index = items.length + 1;
        lookup.set(key, index);
        items.push({ index, word: plainWord(one.word), note: one.note });
    }

    return { items, lookup };
}

/** 記法を外して、素の文にする（読み上げ・字数・書き出しの下ごしらえ） */
export function stripAnnotations(text: string): string {
    const list = findAnnotations(text);
    if (list.length === 0) return text;

    let out = "";
    let last = 0;
    for (const one of list) {
        if (one.pipeAt >= 0) {
            out += text.slice(last, one.pipeAt) + text.slice(one.pipeAt + 1, one.wordEnd);
        } else {
            out += text.slice(last, one.wordEnd);
        }
        last = one.end;
    }
    return out + text.slice(last);
}

/* ---------- 描くときの目印 ---------- */

const START = "";
const END = "";
const BASE = 0xe100;

const numChar = (n: number) => String.fromCharCode(BASE + n);

/**
 * 記法を目印に置き換える。
 *
 * @param lookup  話全体で振った番号。無ければ、この文の中で振る
 * @param show    印を出すか。出さないなら記法を外すだけ
 */
export function markAnnotations(
    text: string,
    lookup?: Map<string, number>,
    show = true,
): string {
    const list = findAnnotations(text);
    if (list.length === 0) return text;

    const local = lookup ?? buildNoteIndex(text).lookup;

    let out = "";
    let last = 0;
    for (const one of list) {
        const n = local.get(keyOf(one.word, one.note)) ?? 0;
        const wordFrom = one.pipeAt >= 0 ? one.pipeAt + 1 : one.start;
        const word = text.slice(wordFrom, one.wordEnd);

        out += text.slice(last, one.start);
        if (show && n > 0) {
            out += word ? `${START}${numChar(n)}${word}${END}${numChar(n)}` : `${END}${numChar(n)}`;
        } else {
            out += word;
        }
        last = one.end;
    }
    return out + text.slice(last);
}

const TOKEN_RE = /([])([-])/g;

/** 横書き（HTML の文字列）用。目印を印に変える */
export function tokensToHtml(html: string): string {
    const open: number[] = [];
    return html.replace(TOKEN_RE, (_m, kind: string, num: string) => {
        const n = num.charCodeAt(0) - BASE;
        const attrs = `class="gk-note" data-gk-note="${n}" role="button" tabindex="0" aria-label="注釈${n}"`;
        if (kind === START) {
            open.push(n);
            return `<span ${attrs}>`;
        }
        const mark = `<sup class="gk-note-num">※${n}</sup>`;
        if (open[open.length - 1] === n) {
            open.pop();
            return `${mark}</span>`;
        }
        /* 言葉の無い注釈や、開きが別の所にあるとき。番号だけ押せるようにする */
        return `<span ${attrs.replace('class="gk-note"', 'class="gk-note gk-note--bare"')}>${mark}</span>`;
    });
}

export type NoteSegment =
    | { type: "text"; body: string }
    | { type: "start"; n: number }
    | { type: "end"; n: number };

/** 縦書き（React で組む）用。目印で切り分ける */
export function splitNoteTokens(text: string): NoteSegment[] {
    const out: NoteSegment[] = [];
    let last = 0;
    const re = new RegExp(TOKEN_RE.source, "g");
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(text)) !== null) {
        if (hit.index > last) out.push({ type: "text", body: text.slice(last, hit.index) });
        const n = hit[2].charCodeAt(0) - BASE;
        out.push({ type: hit[1] === START ? "start" : "end", n });
        last = hit.index + hit[0].length;
    }
    if (last < text.length) out.push({ type: "text", body: text.slice(last) });
    return out;
}

/** 目印を消す（念のため。どこかで目印が残っても字として出さない） */
export function dropTokens(text: string): string {
    return text.replace(TOKEN_RE, "");
}

/**
 * 書き出し用。「月読（※1）」の形にして、末尾の一覧を返す。
 */
export function annotationsForExport(body: string): { text: string; notes: NoteItem[] } {
    const { items, lookup } = buildNoteIndex(body);
    if (items.length === 0) return { text: body, notes: [] };

    const list = findAnnotations(body);
    let out = "";
    let last = 0;
    for (const one of list) {
        const n = lookup.get(keyOf(one.word, one.note)) ?? 0;
        const wordFrom = one.pipeAt >= 0 ? one.pipeAt + 1 : one.start;
        out += body.slice(last, one.start) + body.slice(wordFrom, one.wordEnd) + (n ? `（※${n}）` : "");
        last = one.end;
    }
    return { text: out + body.slice(last), notes: items };
}

/** 書く画面の「注釈」押し具で入れる形 */
export function insertAnnotation(text: string, start: number, end: number, note: string): string {
    const word = text.slice(start, end);
    const clean = note.replace(/[］\n]/g, " ").trim();
    if (!clean) return text;
    return `${text.slice(0, start)}｜${word}［＃注：${clean}］${text.slice(end)}`;
}
