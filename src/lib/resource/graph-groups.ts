/**
 * ============================================================
 * 原石航路 Studio
 * 関係図の「組分け」と「線の通り道」
 *
 * ★ ここには絵を描く部分を入れない。
 *
 *   組の見つけ方、囲みの四角、線の折れ方だけを置く。
 *   描くのは relation-graph に任せる。
 *   分けておけば、ここだけを見て直せる。
 *
 * ★ 組は、すでに書いてあるものから作る。
 *
 *   作者に「この人とこの人は同じ組」と
 *   もう一度入れてもらうのは、二度手間になる。
 *   手がかりは、資料のあちこちにもう書いてある。
 *
 *   拾う順（先のものほど確か）
 *
 *     1. 組織の資料の「所属する人」
 *        組織の名前が、そのまま組の名前になる
 *
 *     2. 人物の資料の「所属：〜」「組織：〜」
 *        本文から資料を集めると、所属はここに入る
 *
 *     3. 関係の言葉
 *        「所属」「部下」「上司」など。向きで中心を決める
 *
 *     4. 家族の関係
 *        親子・兄弟・妹・祖母などで繋がる人たち
 *        名字が揃っていれば「〇〇家」と名付ける
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
 * 1. 組を見つける
 * ============================================================ */

/**
 * 「向こう側」が組の中心になる言葉。
 *
 *   A から B への関係が「所属」なら、
 *   A は B の中にいる。組の名前は B。
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
 * 「こちら側」が組の中心になる言葉。
 *
 *   A から B への関係が「上司」なら、
 *   B は A の中にいる。組の名前は A。
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

/**
 * 組織の資料で、「中にいる人」を並べる欄の見出し。
 *
 * ★ 「関わる人」は入れない。
 *   出来事の資料にもある欄で、そちらは組ではない。
 */
/*
 * ★ 「所属」だけの欄は入れない。
 *   人物の資料の「所属」は、その人が属している先を指す。
 *   「所属する人」「構成員」のように、中にいる人を並べる欄だけ。
 */
const MEMBER_FIELD = /所属する|所属者|所属メンバー|メンバー|構成員|一員|members/i;

/**
 * 人物の資料で、「どこに属しているか」を書く欄の見出し。
 */
const BELONG_FIELD = /所属|組織|陣営|勢力|派閥|チーム|団体|勤務先|学校|一族|家柄/;

/**
 * 文章の中の「所属：〜」。
 *
 * ★ 本文から資料を集めると、所属は人物の説明の末尾に
 *   「所属：〇〇」の形で入る（入れる欄が無いので）。
 */
const BELONG_LINE =
    /(?:所属先?|組織|陣営|勢力|派閥|チーム|団体|勤務先|学校)\s*[：:]\s*([^\n]+)/g;

/** 恋の関係は、家族の組には入れない */
const NOT_FAMILY = /恋|片想|片思|想い人|元カ|浮気/;

/*
 * どこから見つけた組か。
 *
 *   members   組織・グループの資料の「所属する人」       … 作者が決めたもの
 *   field     人物の資料の「所属」欄で選んだ項目          … 作者が決めたもの
 *   text      人物の資料の文章にある「所属：〜」          … 候補
 *   relation  関係の言葉（所属・部下・上司など）           … 候補
 *   family    家族の関係で繋がっている人たち              … 候補
 *
 * ★ 図に囲みを描くのは、作者が決めたものだけ。
 *
 *   関係の言葉や家族から当てた組は、外れる。
 *   「クマさん→エバ」「エバ—アル」から
 *   「エバ」「エバの家族」と囲んだが、
 *   作者が思っていたのは「律とアルのタッグ」だった。
 *
 *   当てたものは右の欄に候補として出し、
 *   作者が名前を直してから組にできるようにする。
 */
export type GroupSource = "members" | "field" | "text" | "relation" | "family";

/** 作者が決めた組の出どころ */
export const AUTHORED: GroupSource[] = ["members", "field"];

/** 候補として出す組の出どころ */
export const SUGGESTED: GroupSource[] = ["text", "relation", "family"];

/**
 * 組の色。
 *
 * ★ はっきりした色にする。
 *
 *   前は線の色を 7% ほどに薄めて塗っていた。
 *   夜の画面でも浮かないようにと考えたが、
 *   昼の画面では組があるのかどうかも分からなかった。
 *
 *   枠と名札は、この色をそのまま使う。
 *   塗りだけ薄くする（中の丸と名前を読むため）。
 *
 * ★ 見分けやすい八色。隣り合っても混ざらない並び。
 */
export const GROUP_COLORS: { value: string; label: string }[] = [
    /*
     * ★ くすんだ色にする。
     *
     *   原色に近い青・赤・緑を並べたら、
     *   図がけばけばしくなり、中の丸と名前より囲みが目立った。
     *   日本の伝統色くらいの、灰みを含んだ色にする。
     */
    { value: "#5566a8", label: "藍" },
    { value: "#6c8a5b", label: "苔" },
    { value: "#9c5b55", label: "蘇芳" },
    { value: "#b08a3e", label: "山吹" },
    { value: "#44849a", label: "浅葱" },
    { value: "#80669c", label: "藤" },
    { value: "#8a7152", label: "朽葉" },
    { value: "#66737a", label: "鼠" },
];

const COLOR_VALUES = GROUP_COLORS.map((one) => one.value);

/** 色の鍵を、項目の values の中に置く。ページの欄とは別なので、資料の画面には出ない */
export const COLOR_KEY = "graph_color";

/**
 * 関係図の主人公の印。人物の項目の values に true で置く。
 *
 * ★ 役割の欄に「主人公」と書いていない作品でも、図の上で選べるように。
 *   選んだら、役割の「主人公」より優先する。
 */
export const LEAD_KEY = "graph_lead";

/**
 * 組ごとの色を決める。
 *
 * ★ 作者が選んだ色があれば、それ。
 *
 * ★ 選んでいない組どうしは、同じ色にしない。
 *   前は組の id から色を割り出していたので、
 *   「NOTE」と「公安」がたまたま同じ緑になり、見分けがつかなかった。
 *
 *   id から決めた色がもう使われていたら、次の色へずらす。
 *   id で決めるので、組が増えても、ほかの組の色はなるべく動かない。
 */
export function assignColors(
    groups: { key: string; color?: string | null }[],
): Map<string, string> {
    const out = new Map<string, string>();
    const used = new Set<string>();

    /* 選んである色を先に置く */
    for (const group of groups) {
        if (group.color) {
            out.set(group.key, group.color);
            used.add(group.color);
        }
    }

    const sorted = groups
        .filter((group) => !group.color)
        .sort((a, b) => a.key.localeCompare(b.key));

    for (const group of sorted) {
        let hash = 0;

        for (let i = 0; i < group.key.length; i += 1) {
            hash = (hash * 31 + group.key.charCodeAt(i)) >>> 0;
        }

        let pick = COLOR_VALUES[hash % COLOR_VALUES.length];

        for (let step = 0; step < COLOR_VALUES.length; step += 1) {
            const one = COLOR_VALUES[(hash + step) % COLOR_VALUES.length];

            if (!used.has(one)) {
                pick = one;
                break;
            }
        }

        out.set(group.key, pick);
        used.add(pick);
    }

    return out;
}

export interface FoundGroup {
    /** 組の id。中心になった項目の id か、名前から作ったもの */
    key: string;
    /** 囲みに出す名前 */
    name: string;
    /** 中に入る項目の id */
    ids: string[];
    /** どこから見つけたか。知らせるときに使う */
    from?: GroupSource;
    /**
     * 組織の資料で、中にいる人を並べている欄の鍵。
     * 右の欄から人を足し引きするとき、どの欄を書き換えるかに使う。
     */
    field?: string;
    /** 作者が選んだ色。選んでいなければ無し */
    color?: string | null;
}

interface MiniEntry {
    id: string;
    name: string;
    aliases?: string[];
    page_id?: string;
    summary?: string;
    values?: Record<string, unknown>;
}

interface MiniRelation {
    from_entry_id: string;
    to_entry_id: string;
    label: string;
}

interface MiniPage {
    id: string;
    builtin_key?: string | null;
    fields: { key: string; label: string; type: string }[];
}

/**
 * その欄が「中にいる人」の欄か。
 *
 * ★ 組織・グループの資料の「所属する人」。
 *   右の欄から人を足すとき、ここに書く。
 */
export function isMemberField(
    page: { builtin_key?: string | null } | undefined,
    field: { key: string; label: string; type: string },
): boolean {
    if (field.type !== "relation_entry") return false;

    return (
        MEMBER_FIELD.test(field.label) ||
        (page?.builtin_key === "organization" && field.key === "members")
    );
}

/**
 * その欄が「どこに属しているか」の欄か。
 *
 * ★ 人物の資料の「所属」。項目を選ぶ作りのもの。
 *   組から人を外すとき、こちらに書いてあれば、こちらも外す。
 */
export function isBelongField(
    page: { builtin_key?: string | null } | undefined,
    field: { key: string; label: string; type: string },
): boolean {
    if (field.type !== "relation_entry") return false;
    if (isMemberField(page, field)) return false;

    return BELONG_FIELD.test(field.label);
}

/** 「」『』やまわりの空白を落とす */
function cleanName(text: string): string {
    return text
        .trim()
        .replace(/^[「『（(【\[]+/, "")
        .replace(/[」』）)】\]。．.]+$/, "")
        .trim();
}

/** 「A、B／C」を分ける */
function splitNames(text: string): string[] {
    return text
        .split(/[、,，/／・;；]|\s{2,}/)
        .map(cleanName)
        /* 長すぎるのは名前ではなく説明 */
        .filter((one) => one.length > 0 && one.length <= 20);
}

/** いくつかの名前の、頭の揃っているところ */
function commonHead(names: string[]): string {
    if (names.length === 0) return "";

    let head = names[0];

    for (const one of names.slice(1)) {
        let at = 0;
        while (at < head.length && at < one.length && head[at] === one[at]) {
            at += 1;
        }
        head = head.slice(0, at);
        if (!head) break;
    }

    return head.trim();
}

/**
 * 組を見つける。
 *
 * @param entries   資料の項目。図に出ていない組織の項目も渡してよい
 * @param relations 関係
 * @param extra     資料のページ（欄の見出しを読むため）と、家族かどうかの見分け方
 */
export function findGroups(
    entries: MiniEntry[],
    relations: MiniRelation[],
    extra: {
        pages?: MiniPage[];
        isFamily?: (label: string) => boolean;
        /** どこから拾うか。渡さなければ全部 */
        use?: GroupSource[];
        /**
         * 一人以下の組も返すか。
         *
         * ★ 右の欄の一覧では残す。
         *   作ったばかりで、まだ誰も入れていない組が
         *   一覧から消えると、作れなかったように見える。
         */
        keepSmall?: boolean;
    } = {},
): FoundGroup[] {
    const use = new Set<GroupSource>(
        extra.use ?? ["members", "field", "text", "relation", "family"],
    );
    const byId = new Map(entries.map((one) => [one.id, one]));

    /* 名前から項目を引く。別名でも引けるように */
    const byName = new Map<string, MiniEntry>();

    for (const one of entries) {
        const name = cleanName(one.name ?? "");
        if (name && !byName.has(name)) byName.set(name, one);

        for (const alias of one.aliases ?? []) {
            const clean = cleanName(alias);
            if (clean && !byName.has(clean)) byName.set(clean, one);
        }
    }

    const pageOf = new Map((extra.pages ?? []).map((page) => [page.id, page]));

    const groups = new Map<
        string,
        { name: string; ids: Set<string>; from: GroupSource; field?: string }
    >();

    const put = (
        key: string,
        name: string,
        from: GroupSource,
        ids: string[],
        field?: string,
    ) => {
        if (!use.has(from)) return;

        const known = ids.filter((id) => byId.has(id));
        if (known.length === 0) return;

        const group = groups.get(key) ?? { name, ids: new Set<string>(), from };

        for (const id of known) group.ids.add(id);
        if (field && !group.field) group.field = field;
        groups.set(key, group);
    };

    /*
     * 名前で書かれた組を、どの鍵にまとめるか。
     *
     * ★ 同じ名前の項目があれば、その項目の組に入れる。
     *   組織の資料「黒鉄組」と、人物の「所属：黒鉄組」が
     *   別々の囲みになると、同じ組が二つ並ぶ。
     */
    const keyForName = (name: string): { key: string; name: string; hub?: string } => {
        const hit = byName.get(name);

        if (hit) return { key: hit.id, name: hit.name, hub: hit.id };

        return { key: `name:${name}`, name };
    };

    /* ---------------------------------------------------------
     * 1. 組織の資料の「所属する人」
     * --------------------------------------------------------- */
    for (const entry of entries) {
        const page = entry.page_id ? pageOf.get(entry.page_id) : undefined;
        if (!page) continue;

        for (const field of page.fields ?? []) {
            if (field.type !== "relation_entry") continue;

            const isMembers =
                MEMBER_FIELD.test(field.label) ||
                (page.builtin_key === "organization" && field.key === "members");

            if (!isMembers) continue;

            const raw = entry.values?.[field.key];
            const ids = Array.isArray(raw)
                ? raw.filter((one): one is string => typeof one === "string")
                : [];

            if (ids.length === 0 && !extra.keepSmall) continue;

            /* 組織そのものも、図に出ていれば中に入れる */
            put(entry.id, entry.name, "members", [entry.id, ...ids], field.key);
        }
    }

    /* ---------------------------------------------------------
     * 2. 人物の資料に書かれた所属
     * --------------------------------------------------------- */
    for (const entry of entries) {
        const found: string[] = [];

        /* 欄の見出しが「所属」などのもの */
        const page = entry.page_id ? pageOf.get(entry.page_id) : undefined;

        for (const field of page?.fields ?? []) {
            if (field.type === "relation_entry") {
                /*
                 * 「所属」欄が項目を指す作りなら、指した先が組。
                 * 組織の資料側に書かれていなくても拾える。
                 *
                 * ★ 組織の「所属する人」は、ここでは読まない。
                 *   あれは中にいる人の欄で、1 で読んである。
                 *   ここで読むと「組織が人に所属している」ことになり、
                 *   人の名前の囲みができてしまう。
                 */
                const isMembers =
                    MEMBER_FIELD.test(field.label) ||
                    (page?.builtin_key === "organization" && field.key === "members");

                if (isMembers) continue;
                if (!BELONG_FIELD.test(field.label)) continue;

                const raw = entry.values?.[field.key];
                if (!Array.isArray(raw)) continue;

                for (const id of raw) {
                    const target = typeof id === "string" ? byId.get(id) : undefined;
                    if (target) put(target.id, target.name, "field", [target.id, entry.id]);
                }
                continue;
            }

            if (!BELONG_FIELD.test(field.label)) continue;

            const raw = entry.values?.[field.key];

            if (typeof raw === "string") found.push(...splitNames(raw));
            if (Array.isArray(raw)) {
                for (const one of raw) {
                    if (typeof one === "string") found.push(...splitNames(one));
                }
            }
        }

        /* 文章の中の「所属：〜」 */
        const texts: string[] = [entry.summary ?? ""];

        for (const value of Object.values(entry.values ?? {})) {
            if (typeof value === "string") texts.push(value);
        }

        for (const text of texts) {
            for (const match of text.matchAll(BELONG_LINE)) {
                found.push(...splitNames(match[1] ?? ""));
            }
        }

        for (const name of new Set(found)) {
            /* 自分の名前を所属に書いている、は数えない */
            if (name === cleanName(entry.name)) continue;

            const where = keyForName(name);

            put(
                where.key,
                where.name,
                "text",
                where.hub ? [where.hub, entry.id] : [entry.id],
            );
        }
    }

    /* ---------------------------------------------------------
     * 3. 関係の言葉
     * --------------------------------------------------------- */
    for (const relation of relations) {
        const label = (relation.label ?? "").trim();
        if (!label) continue;

        let owner: string | null = null;
        let member: string | null = null;

        if (OWNER_IS_TO.some((word) => label.includes(word))) {
            owner = relation.to_entry_id;
            member = relation.from_entry_id;
        } else if (OWNER_IS_FROM.some((word) => label.includes(word))) {
            owner = relation.from_entry_id;
            member = relation.to_entry_id;
        }

        if (!owner || !member || owner === member) continue;

        const hub = byId.get(owner);
        if (!hub) continue;

        put(owner, hub.name, "relation", [owner, member]);
    }

    /* ---------------------------------------------------------
     * 4. 家族
     *
     * ★ 家族の関係で繋がっている人を、ひとかたまりにする。
     *   A―親子―B、B―兄弟―C なら、A・B・C で一つの家。
     *
     * ★ 恋の関係は入れない。
     *   恋人どうしを「〇〇家」で囲むのは早すぎる。
     * --------------------------------------------------------- */
    if (extra.isFamily) {
        const next = new Map<string, Set<string>>();

        for (const relation of relations) {
            const label = (relation.label ?? "").trim();
            if (!label || NOT_FAMILY.test(label)) continue;
            if (!extra.isFamily(label)) continue;

            const a = relation.from_entry_id;
            const b = relation.to_entry_id;
            if (!byId.has(a) || !byId.has(b) || a === b) continue;

            next.set(a, (next.get(a) ?? new Set()).add(b));
            next.set(b, (next.get(b) ?? new Set()).add(a));
        }

        const seen = new Set<string>();

        for (const start of next.keys()) {
            if (seen.has(start)) continue;

            const family: string[] = [];
            const queue = [start];
            seen.add(start);

            while (queue.length > 0) {
                const here = queue.shift()!;
                family.push(here);

                for (const other of next.get(here) ?? []) {
                    if (seen.has(other)) continue;
                    seen.add(other);
                    queue.push(other);
                }
            }

            if (family.length < 2) continue;

            /*
             * 名前。
             *
             * ★ 名字が揃っていれば「〇〇家」。
             *   二文字以上そろっていて、誰の名前もそこで終わっていないとき。
             *
             * ★ 揃っていなければ、いちばん繋がりの多い人の家族。
             */
            const names = family.map((id) => cleanName(byId.get(id)?.name ?? ""));
            const head = commonHead(names);
            const hub = family
                .slice()
                .sort((a, b) => (next.get(b)?.size ?? 0) - (next.get(a)?.size ?? 0))[0];

            const name =
                head.length >= 2 && names.every((one) => one.length > head.length)
                    ? `${head}家`
                    : `${byId.get(hub)?.name ?? ""}の家族`;

            put(`family:${hub}`, name, "family", family);
        }
    }

    /* ---------------------------------------------------------
     * まとめ
     *
     * ★ 二人に満たない組は捨てる。
     * ★ 中身がまったく同じ組は、先に見つけたほうだけ残す。
     *   組織の資料と関係の言葉から同じ組が出ることがある。
     * --------------------------------------------------------- */
    const found: FoundGroup[] = [];
    const sameAs = new Set<string>();

    for (const [key, group] of groups) {
        if (group.ids.size < 2 && !extra.keepSmall) continue;

        const sign = [...group.ids].sort().join("|");
        if (sameAs.has(sign)) continue;
        sameAs.add(sign);

        const picked = byId.get(key)?.values?.[COLOR_KEY];

        found.push({
            key,
            name: group.name,
            ids: [...group.ids],
            from: group.from,
            field: group.field,
            color: typeof picked === "string" && picked ? picked : null,
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
    /** 何番目の囲みか */
    tone: number;
    /**
     * 中に、いくつ重ねて組が入っているか。
     *
     *   0  中に組が無い（いちばん内側）
     *   1  中に組が一つ重なっている
     *
     * 大きいほど外側。外側から先に描く。
     */
    levels: number;
}

/**
 * 組の中に組があるか（入れ子）を調べる。
 *
 * ★ 中の人がまるごと別の組にも入っていれば、内側の組。
 *   公安の中の NOTE、警視庁の中の捜査一課。
 *
 * ★ 同じ顔ぶれの組が二つあるときは、鍵の順で内外を決める。
 *   どちらも外にすると、同じ四角が二つ重なって名札もぶつかる。
 */
export function nestingOf(
    groups: { key: string; ids: string[] }[],
): Map<string, { parents: string[]; levels: number }> {
    const sets = new Map(groups.map((group) => [group.key, new Set(group.ids)]));

    const inside = (a: string, b: string) => {
        if (a === b) return false;

        const small = sets.get(a)!;
        const big = sets.get(b)!;

        if (small.size === 0 || small.size > big.size) return false;

        for (const id of small) {
            if (!big.has(id)) return false;
        }

        return small.size < big.size || a > b;
    };

    const parents = new Map<string, string[]>();

    for (const a of groups) {
        parents.set(
            a.key,
            groups.filter((b) => inside(a.key, b.key)).map((b) => b.key),
        );
    }

    const levels = new Map<string, number>();

    const levelOf = (key: string, seen: Set<string>): number => {
        if (levels.has(key)) return levels.get(key)!;
        if (seen.has(key)) return 0;

        seen.add(key);

        let most = -1;

        for (const [child, list] of parents) {
            if (list.includes(key)) most = Math.max(most, levelOf(child, seen));
        }

        const value = most + 1;
        levels.set(key, value);
        return value;
    };

    const out = new Map<string, { parents: string[]; levels: number }>();

    for (const group of groups) {
        out.set(group.key, {
            parents: parents.get(group.key) ?? [],
            levels: levelOf(group.key, new Set()),
        });
    }

    return out;
}

/**
 * 中に入る丸を、ぜんぶ包む四角を出す。
 *
 * ★ 名前のぶんまで包む。
 *   丸だけで測ると、丸の下の名前が囲みからはみ出す。
 *
 * ★ 一人の組も囲む。
 *   作者が作った組なら、一人でも組。
 *   前は二人に満たないと描かなかったので、
 *   「謎の組織」が右の欄にはあるのに図に出なかった。
 *
 * ★ 入れ子の組は、外の組の内側に収める。
 *   同じ余白で囲むと、公安と NOTE の縁が同じところに来て、
 *   NOTE が公安からはみ出し、名札も同じ場所で潰れていた。
 *   中に組を抱えている組ほど、余白を広く取る。
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
        /**
         * 人ごとの大きさ。渡せば、丸と名前ではなくこの四角で包む。
         * 人物をカードで描くとき、主人公のカードは大きい。
         */
        extent?: (id: string) => { w: number; h: number } | undefined;
    },
): GroupBox[] {
    /*
     * ★ 囲みの形を、長方形か正方形に寄せる。
     *
     *   二人を横に並べただけの囲みが、細長い帯のようになる。
     *   横に長すぎるときは縦を、縦に長すぎるときは横を、外へ伸ばす。
     *   中身は動かさないので、並びは変わらない。
     */
    /*
     * ★ 横長は 3 倍まで許す。
     *   2.2 倍で止めると、二人ずつ横に並んだ組の上下に
     *   大きな空きができていた。
     */
    const WIDEST = 3;
    const TALLEST = 0.85;

    const shown = groups
        .map((group) => ({
            ...group,
            ids: group.ids.filter((id) => at.has(id)),
        }))
        .filter((group) => group.ids.length > 0);

    const nest = nestingOf(shown);

    const boxes = new Map<string, GroupBox>();

    shown.forEach((group, index) => {
        let x1 = Number.POSITIVE_INFINITY;
        let y1 = Number.POSITIVE_INFINITY;
        let x2 = Number.NEGATIVE_INFINITY;
        let y2 = Number.NEGATIVE_INFINITY;

        for (const id of group.ids) {
            const point = at.get(id)!;
            const card = size.extent?.(id);

            if (card) {
                x1 = Math.min(x1, point.x - card.w / 2);
                x2 = Math.max(x2, point.x + card.w / 2);
                y1 = Math.min(y1, point.y - card.h / 2);
                y2 = Math.max(y2, point.y + card.h / 2);
                continue;
            }

            const half = Math.max(size.radius, size.halfOf(id));

            x1 = Math.min(x1, point.x - half);
            x2 = Math.max(x2, point.x + half);
            y1 = Math.min(y1, point.y - size.radius);
            y2 = Math.max(y2, point.y + size.drop);
        }

        const levels = nest.get(group.key)?.levels ?? 0;

        /* 中に組を抱えているぶん、余白を広げる */
        const pad = size.pad + levels * (size.pad * 0.8);
        const head = size.head * (levels + 1);

        let left = x1 - pad;
        let top = y1 - pad - head;
        let right = x2 + pad;
        let bottom = y2 + pad;

        const shape = (right - left) / Math.max(1, bottom - top);

        if (shape > WIDEST) {
            const more = ((right - left) / WIDEST - (bottom - top)) / 2;
            top -= more;
            bottom += more;
        } else if (shape < TALLEST) {
            const more = ((bottom - top) * TALLEST - (right - left)) / 2;
            left -= more;
            right += more;
        }

        boxes.set(group.key, {
            key: group.key,
            name: group.name,
            ids: group.ids,
            tone: index,
            levels,
            x1: left,
            y1: top,
            x2: right,
            y2: bottom,
        });
    });

    /*
     * ★ 外の組は、内の組を必ず包む。
     *   形を整えるときに内の組が伸びると、外からはみ出すことがある。
     *   内側から順に、外の組を広げて包み直す。
     */
    const order = [...boxes.values()].sort((a, b) => a.levels - b.levels);
    const gapIn = size.pad * 0.6;

    for (const inner of order) {
        for (const parentKey of nest.get(inner.key)?.parents ?? []) {
            const outer = boxes.get(parentKey);
            if (!outer) continue;

            outer.x1 = Math.min(outer.x1, inner.x1 - gapIn);
            outer.x2 = Math.max(outer.x2, inner.x2 + gapIn);
            outer.y1 = Math.min(outer.y1, inner.y1 - gapIn - size.head);
            outer.y2 = Math.max(outer.y2, inner.y2 + gapIn);
        }
    }

    /* 外側から先に描く。内側の組が上に乗る */
    return [...boxes.values()].sort((a, b) => b.levels - a.levels);
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

/**
 * 邪魔をよける線を、まず弧で探す。
 *
 * ★ 直角に折れる線より、弧のほうが目で追いやすい。
 *
 *   直角の線は、囲みの外を大きく回り込む。
 *   同じ高さに並んだ人どうしを結ぶと、
 *   囲みの上を横切る長い「コ」の字になり、
 *   ほかの線や名札と重なった。
 *
 *   少しふくらませれば済むところは、ふくらませるだけにする。
 *
 * ★ ふくらみは小さいほうから試す。
 *   大きく曲げると、どこから来た線か分からなくなる。
 *
 * ★ 弧でよけきれないときだけ、直角に折る。
 *
 * @returns control があれば弧（二次の曲線の引っ張り点）。
 *          points があれば折れ線（両端を含む）。
 */
export function pathAround(
    from: Point,
    to: Point,
    blocks: Rect[],
    pad: number,
    /**
     * 行き帰りの二本のように、ふくらむ向きと最小のふくらみが決まっているとき。
     * side は線と直角のどちら側か、least は線の長さに対する割合。
     */
    fixed?: { side: 1 | -1; least: number },
): { control?: Point; points: Point[] } {
    const straight = [from, to];

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);

    if (length < 1) return { points: straight };

    /* 近くの邪魔だけ見る */
    const reach = length * 0.6 + pad;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    const near = blocks.filter(
        (block) =>
            block.x2 > Math.min(from.x, to.x) - reach &&
            block.x1 < Math.max(from.x, to.x) + reach &&
            block.y2 > Math.min(from.y, to.y) - reach &&
            block.y1 < Math.max(from.y, to.y) + reach,
    );

    if (near.length === 0 && !fixed) return { points: straight };

    const hits = (points: Point[]) => {
        let count = 0;

        for (let i = 1; i < points.length; i += 1) {
            for (const block of near) {
                if (crosses(points[i - 1], points[i], block)) count += 1;
            }
        }

        return count;
    };

    if (!fixed && hits(straight) === 0) return { points: straight };

    /* 線と直角の向き */
    const nx = -dy / length;
    const ny = dx / length;

    /* 弧を細かく刻んで、折れ線として当たりを見る */
    const sample = (control: Point) => {
        const out: Point[] = [];

        for (let i = 0; i <= 16; i += 1) {
            const t = i / 16;
            const u = 1 - t;

            out.push({
                x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
                y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
            });
        }

        return out;
    };

    /*
     * ★ 行き帰りの二本は、決まった側にだけふくらませる。
     *   反対側へ逃がすと、もう一本と重なる。
     *   決まったふくらみより小さくはしない。
     */
    const bends = fixed
        ? [fixed.least, 0.3, 0.42, 0.56, 0.72].filter((one) => one >= fixed.least)
        : [0.22, 0.34, 0.48, 0.64, 0.82];
    const sides: (1 | -1)[] = fixed ? [fixed.side] : [1, -1];

    for (const bend of bends) {
        for (const side of sides) {
            /* 引っ張り点は、弧の頂点の二倍外に置く */
            const control = {
                x: mid.x + nx * length * bend * side,
                y: mid.y + ny * length * bend * side,
            };

            /* 端は丸の中なので、両端の少しを除いて見る */
            const points = sample(control).slice(2, -2);

            if (hits(points) === 0) return { control, points: [from, to] };
        }
    }

    /* 行き帰りの二本で、よけきれないときは、決まったふくらみのまま */
    if (fixed) {
        return {
            control: {
                x: mid.x + nx * length * fixed.least * fixed.side,
                y: mid.y + ny * length * fixed.least * fixed.side,
            },
            points: [from, to],
        };
    }

    return { points: routeAround(from, to, blocks, pad) };
}

/* ============================================================
 * 直角に折れる線（組分けのとき）
 * ============================================================ */

/** 置いた線の一区間。縦か横 */
export interface Segment {
    a: Point;
    b: Point;
}

/** 区間どうしが、同じ通り道でどれだけ重なるか */
function overlapOf(one: Segment, other: Segment, lane: number): number {
    const oneFlat = Math.abs(one.a.y - one.b.y) < 0.5;
    const otherFlat = Math.abs(other.a.y - other.b.y) < 0.5;

    if (oneFlat !== otherFlat) return 0;

    if (oneFlat) {
        if (Math.abs(one.a.y - other.a.y) > lane) return 0;

        const lo = Math.max(Math.min(one.a.x, one.b.x), Math.min(other.a.x, other.b.x));
        const hi = Math.min(Math.max(one.a.x, one.b.x), Math.max(other.a.x, other.b.x));
        return Math.max(0, hi - lo);
    }

    if (Math.abs(one.a.x - other.a.x) > lane) return 0;

    const lo = Math.max(Math.min(one.a.y, one.b.y), Math.min(other.a.y, other.b.y));
    const hi = Math.min(Math.max(one.a.y, one.b.y), Math.max(other.a.y, other.b.y));
    return Math.max(0, hi - lo);
}

/**
 * 直角に折れる線の道を出す。
 *
 * ★ 人物相関図の線は、縦と横でできている。
 *
 *   斜めの線や弧は、何本もあると互いに絡んで、
 *   どこからどこへ行く線なのか目で追えなかった。
 *   縦と横だけにすれば、線はきれいに揃い、
 *   曲がり角で向きが変わるのも見て分かる。
 *
 * ★ ほとんど縦か横に並んでいるときは、まっすぐ。
 *
 * ★ ほかの線と同じ通り道に重ねない。
 *   先に引いた線の区間を覚えておき、重なる道には点を付ける。
 *   少しずらした道も候補に入れるので、線は並んで走る。
 *
 * @param used  先に引いた線の区間。引いた道の区間を、ここへ足していく
 * @param lane  線どうしを離す幅
 */
export function orthoRoute(
    from: Point,
    to: Point,
    blocks: Rect[],
    pad: number,
    used: Segment[],
    lane: number,
): Point[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const tries: Point[][] = [];

    /* ほとんど縦か横なら、まっすぐも候補に */
    if (Math.abs(dx) < lane * 0.8 || Math.abs(dy) < lane * 0.8) {
        tries.push([from, to]);
    }

    /* 角が一つ（L 字） */
    tries.push([from, { x: to.x, y: from.y }, to]);
    tries.push([from, { x: from.x, y: to.y }, to]);

    /* 角が二つ（コの字・Z 字）。折り返す場所をいくつか試す */
    const near = blocks.filter(
        (block) =>
            block.x2 > Math.min(from.x, to.x) - pad * 4 &&
            block.x1 < Math.max(from.x, to.x) + pad * 4 &&
            block.y2 > Math.min(from.y, to.y) - pad * 4 &&
            block.y1 < Math.max(from.y, to.y) + pad * 4,
    );

    const xs = new Set<number>();
    const ys = new Set<number>();

    for (const k of [0, 1, -1, 2, -2]) {
        xs.add((from.x + to.x) / 2 + k * lane);
        ys.add((from.y + to.y) / 2 + k * lane);
    }

    for (const block of near) {
        for (const k of [0, 1, 2]) {
            xs.add(block.x1 - pad - k * lane);
            xs.add(block.x2 + pad + k * lane);
            ys.add(block.y1 - pad - k * lane);
            ys.add(block.y2 + pad + k * lane);
        }
    }

    for (const mx of xs) {
        tries.push([from, { x: mx, y: from.y }, { x: mx, y: to.y }, to]);
    }

    for (const my of ys) {
        tries.push([from, { x: from.x, y: my }, { x: to.x, y: my }, to]);
    }

    let best: Point[] = tries[0];
    let bestCost = Number.POSITIVE_INFINITY;

    for (const raw of tries) {
        const path = tidyPath(raw);
        let hit = 0;
        let overlap = 0;

        for (let i = 1; i < path.length; i += 1) {
            const seg = { a: path[i - 1], b: path[i] };

            for (const block of near) {
                if (crosses(seg.a, seg.b, block)) hit += 1;
            }

            for (const other of used) {
                overlap += overlapOf(seg, other, lane * 0.6);
            }
        }

        const cost =
            hit * 100000 +
            overlap * 4 +
            (path.length - 2) * lane * 1.5 +
            lengthOf(path);

        if (cost < bestCost) {
            bestCost = cost;
            best = path;
        }
    }

    for (let i = 1; i < best.length; i += 1) {
        used.push({ a: best[i - 1], b: best[i] });
    }

    return best;
}

/**
 * 道の始めを、四角の縁で切る。
 *
 * ★ 組織から出る線は、囲みの縁から出す。
 *   囲みの真ん中から引くと、中の人の上を通ってしまう。
 */
export function clipStart(path: Point[], box: Rect): Point[] {
    const inside = (p: Point) =>
        p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;

    for (let i = 1; i < path.length; i += 1) {
        const a = path[i - 1];
        const b = path[i];

        if (inside(a) && !inside(b)) {
            /* a から b へ進んで、縁を越えるところ */
            let t = 1;

            if (b.x > box.x2) t = Math.min(t, (box.x2 - a.x) / (b.x - a.x));
            if (b.x < box.x1) t = Math.min(t, (box.x1 - a.x) / (b.x - a.x));
            if (b.y > box.y2) t = Math.min(t, (box.y2 - a.y) / (b.y - a.y));
            if (b.y < box.y1) t = Math.min(t, (box.y1 - a.y) / (b.y - a.y));

            const cut = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            return [cut, ...path.slice(i)];
        }

        if (!inside(a)) return path.slice(i - 1);
    }

    return path;
}

/** 道の終わりを、四角の縁で切る */
export function clipEnd(path: Point[], box: Rect): Point[] {
    return clipStart([...path].reverse(), box).reverse();
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

/** 道の片方の端だけを、丸の手前で止める */
export function trimOne(path: Point[], by: number, atEnd: boolean): Point[] {
    if (path.length < 2) return path;

    const out = [...path];

    if (atEnd) {
        out[out.length - 1] = toward(out[out.length - 1], out[out.length - 2], by);
    } else {
        out[0] = toward(out[0], out[1], by);
    }

    return out;
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
 * 人数に合う輪の大きさ。
 *
 * ★ 隣どうしが gap だけ離れる半径。
 *   二人なら横に並べるだけなので、半分の幅。
 */
function ringRadius(count: number, gap: number): number {
    if (count <= 1) return 0;
    if (count === 2) return gap / 2;

    return gap / (2 * Math.sin(Math.PI / count));
}

/**
 * 輪の上の置き場所。中心からのずれで返す。
 *
 * ★ 三人は、上に一人・下に二人の三角。
 *   名前は丸の下に出るので、上に一人のほうが名前がぶつからない。
 *
 * ★ 四人以上は、真上から時計回り。
 *   偶数のときは半歩ずらして、真上と真下に置かない。
 *   縦に並ぶと、上の人の名前と下の人の丸が近づく。
 */
function onRing(count: number, radius: number): Point[] {
    if (count <= 0) return [];
    if (count === 1) return [{ x: 0, y: 0 }];
    if (count === 2) {
        return [
            { x: -radius, y: 0 },
            { x: radius, y: 0 },
        ];
    }

    const start = -Math.PI / 2 + (count % 2 === 0 ? Math.PI / count : 0);
    const out: Point[] = [];

    for (let i = 0; i < count; i += 1) {
        const angle = start + (Math.PI * 2 * i) / count;

        out.push({
            /* 横は少し広く。名前は横に長い */
            x: Math.cos(angle) * radius * 1.15,
            y: Math.sin(angle) * radius,
        });
    }

    return out;
}

/**
 * 「組み直す」を、組ごとにやる。
 *
 * 人物相関図の形にする。
 *
 *   ・物語の真ん中の人（どこの組にも入らない人）を真ん中に
 *   ・組はそのまわりの四辺に
 *   ・全体は四角に近く
 *
 * ★ 入れ子の組は、外の組の場所の中に、ひとかたまりで置く。
 *   警視庁の中の捜査一課、公安の中の NOTE。
 *
 * ★ 二つの組を掛け持ちする人がいれば、その二つの組を隣り合わせにし、
 *   掛け持ちの人を境目に置く。
 *   家族と FBI を掛け持ちする赤井秀一のように、
 *   二つの囲みが境目で重なる形になる。
 *
 *   前は掛け持ちの人を図の真ん中へ置いていたので、
 *   二つの組の囲みが真ん中まで伸びて、ほかの組の上に被さっていた。
 */
export function packByGroup(options: {
    ids: string[];
    groups: FoundGroup[];
    width: number;
    height: number;
    gap: number;
    /** 枠の横と縦の比（使わない。形は四角に寄せ、収まらないときだけ紙に合わせる） */
    aspect: number;
    /** 詰めてよい、いちばん狭い間。丸どうしがぶつからない幅 */
    minGap?: number;
    /** 関係。並び順を決めるのに使う（線が短く、交わらないように） */
    links?: { a: string; b: string }[];
    /** 真ん中に置きたい人（主人公） */
    hub?: string | null;
    /** 並べ方。四角（組を詰めて並べる）か、丸（主人公を真ん中に輪に並べる） */
    shape?: "square" | "round";
}): Map<string, Point> {
    const { ids, groups, width, height } = options;
    const minGap = options.minGap ?? options.gap * 0.6;

    /*
     * ★ 紙に収まる間で並べる。
     *
     *   紙の外に出た丸は、紙の縁へ押し戻される。
     *   組が多いと並べた全体が紙より大きくなり、
     *   外に出た人がみな縁の一点に重なっていた。
     *
     *   まず決まった間で並べ、はみ出すなら間を詰めて並べ直す。
     *   それでもはみ出すぶんだけ、最後に全体を縮める。
     */
    /*
     * ★ まず四角に近い形で試す。
     *   それで紙に収まらないほど人が多いときだけ、紙の横長に合わせる。
     *   四角にこだわって全体を縮めると、名前どうしが重なって読めなくなる。
     */
    /* 並びの形は、渡された枠の形から決める（紙の形ではなく） */
    const paper = Math.max(1, Math.min(options.aspect, 1.8));
    /*
     * ★ 枠が横に広いときは、並びも少し横に広げる。
     *   縦長に並べると、枠に合わせて全体が縮み、顔も字も小さくなった。
     *   ただし一列の横長にはしない（1.6 まで）。
     */
    const square = Math.max(1.25, Math.min(paper, 1.6));

    let bestPlace = new Map<string, Point>();
    let bestGap = 0;
    let bestRoom = -1;

    for (const target of paper > square + 0.05 ? [square, paper] : [square]) {
        let gap = options.gap;
        let place = layoutWith(gap, target);

        for (let tries = 0; tries < 3; tries += 1) {
            const scale = fitScale(place, gap);
            if (scale >= 0.98) break;

            const next = Math.max(minGap, gap * scale);
            if (next >= gap - 0.5) break;

            gap = next;
            place = layoutWith(gap, target);
        }

        /* 縮めたあとに残る間。広いほど読みやすい */
        const room = gap * fitScale(place, gap);

        if (room > bestRoom * 1.08 || bestRoom < 0) {
            bestRoom = room;
            bestPlace = place;
            bestGap = gap;
        }

        /* 四角のままで縮めずに収まったなら、それでよい */
        if (fitScale(place, gap) >= 0.98) break;
    }

    /*
     * ★ 席の格子で、はじめから詰めて並べる（packGrid）。
     *   前の並べ方（layoutWith）は、組を四辺に置いてから格子に合わせていたので、
     *   組の中にも組の間にも空きが残り、丸があちこちに散らばって見えた。
     */
    void bestPlace;
    const grid = packGrid({
        ids,
        groups,
        gap: options.gap,
        width,
        height,
        aspect: Math.max(1.2, Math.min(paper, 1.8)),
        links: options.links ?? [],
        hub: options.hub ?? null,
        shape: options.shape ?? "square",
    });

    return fitPaper(improveOrder(grid, options.gap), options.gap);

    /*
     * 席替え。
     *
     * ★ 同じ組の中で、席を入れ替えて線が短く・交わらなくなるなら入れ替える。
     *
     *   組の中の順番は、資料の並び順のままだった。
     *   そのせいで、外の組と結ばれている人が反対側の端に座り、
     *   線が仲間の上を横切ったり、線どうしが交わったりしていた。
     *   （律とアル、クマさんとエバが逆だった）
     *
     * ★ 入れ替えるのは、入っている組がまったく同じ人どうしだけ。
     *   別の組の人と替えると、組がばらける。
     * ★ 席（格子の目）は変えないので、そろいは崩れない。
     */
    function improveOrder(map: Map<string, Point>, room: number): Map<string, Point> {
        const links = options.links ?? [];
        if (links.length === 0 || map.size < 3) return map;

        const place = new Map(map);

        /* 入っている組の組み合わせ */
        const signature = new Map<string, string>();
        for (const id of place.keys()) {
            const keys = groups
                .filter((group) => group.ids.includes(id))
                .map((group) => group.key)
                .sort();
            signature.set(id, keys.join("|"));
        }

        /* 組織そのものと結んだ線は、組の真ん中から出るとみなす（入れ替えても動かない） */
        const middleOf = new Map<string, Point>();
        for (const group of groups) {
            const points = group.ids.map((id) => place.get(id)).filter(Boolean) as Point[];
            if (points.length === 0) continue;
            middleOf.set(group.key, {
                x: points.reduce((sum, one) => sum + one.x, 0) / points.length,
                y: points.reduce((sum, one) => sum + one.y, 0) / points.length,
            });
        }

        const at = (id: string) => place.get(id) ?? middleOf.get(id);

        const edges = links.filter((one) => one.a !== one.b && at(one.a) && at(one.b));

        const cross = (p1: Point, p2: Point, p3: Point, p4: Point) => {
            const d = (a: Point, b: Point, c: Point) =>
                (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            const d1 = d(p3, p4, p1);
            const d2 = d(p3, p4, p2);
            const d3 = d(p1, p2, p3);
            const d4 = d(p1, p2, p4);
            return d1 * d2 < 0 && d3 * d4 < 0;
        };

        /* 線がほかの人の席の上を通るか */
        const through = (p: Point, q: Point, id: string) => {
            const r = place.get(id);
            if (!r) return false;
            const vx = q.x - p.x;
            const vy = q.y - p.y;
            const len2 = vx * vx + vy * vy || 1;
            const t = ((r.x - p.x) * vx + (r.y - p.y) * vy) / len2;
            if (t <= 0.05 || t >= 0.95) return false;
            return Math.hypot(p.x + vx * t - r.x, p.y + vy * t - r.y) < room * 0.35;
        };

        const hubCenter = (() => {
            const hub = options.hub;
            if (!hub || !place.has(hub)) return null;
            const mates = [...place.keys()].filter(
                (id) => signature.get(id) === signature.get(hub),
            );
            const points = mates.map((id) => place.get(id)!);
            return {
                x: points.reduce((sum, one) => sum + one.x, 0) / points.length,
                y: points.reduce((sum, one) => sum + one.y, 0) / points.length,
            };
        })();

        const total = () => {
            let sum = 0;
            const segs = edges.map((one) => ({ one, p: at(one.a)!, q: at(one.b)! }));

            for (const { p, q } of segs) sum += Math.hypot(p.x - q.x, p.y - q.y);

            for (let i = 0; i < segs.length; i += 1) {
                for (let j = i + 1; j < segs.length; j += 1) {
                    const A = segs[i];
                    const B = segs[j];
                    if (
                        A.one.a === B.one.a || A.one.a === B.one.b ||
                        A.one.b === B.one.a || A.one.b === B.one.b
                    ) continue;
                    if (cross(A.p, A.q, B.p, B.q)) sum += room * 1.2;
                }
            }

            for (const { one, p, q } of segs) {
                for (const id of place.keys()) {
                    if (id === one.a || id === one.b) continue;
                    if (through(p, q, id)) sum += room * 1.5;
                }
            }

            if (hubCenter && options.hub) {
                const h = place.get(options.hub)!;
                sum += Math.hypot(h.x - hubCenter.x, h.y - hubCenter.y) * 5;
            }

            return sum;
        };

        const buckets = new Map<string, string[]>();
        for (const [id, key] of signature) {
            buckets.set(key, [...(buckets.get(key) ?? []), id]);
        }

        let best = total();

        for (let pass = 0; pass < 4; pass += 1) {
            let better = false;

            for (const list of buckets.values()) {
                if (list.length < 2 || list.length > 16) continue;

                for (let i = 0; i < list.length; i += 1) {
                    for (let j = i + 1; j < list.length; j += 1) {
                        const a = place.get(list[i])!;
                        const b = place.get(list[j])!;
                        place.set(list[i], b);
                        place.set(list[j], a);

                        const now = total();
                        if (now < best - 0.5) {
                            best = now;
                            better = true;
                        } else {
                            place.set(list[i], a);
                            place.set(list[j], b);
                        }
                    }
                }
            }

            if (!better) break;
        }

        return place;
    }

    /* 紙に収めるのに、どれだけ縮める必要があるか */
    function fitScale(map: Map<string, Point>, room: number): number {
        if (map.size === 0) return 1;

        let x1 = Number.POSITIVE_INFINITY;
        let y1 = Number.POSITIVE_INFINITY;
        let x2 = Number.NEGATIVE_INFINITY;
        let y2 = Number.NEGATIVE_INFINITY;

        for (const point of map.values()) {
            x1 = Math.min(x1, point.x);
            x2 = Math.max(x2, point.x);
            y1 = Math.min(y1, point.y);
            y2 = Math.max(y2, point.y);
        }

        /*
         * ★ 余白は、丸と名前がはみ出さないぶんだけ。
         *   囲みは紙の外に出ても描ける（出す範囲は中身に合わせて決める）。
         *   紙が押し戻すのは、丸の中心だけ。
         */
        const margin = room * 0.55;

        return Math.min(
            1,
            (width - margin * 2) / Math.max(1, x2 - x1),
            (height - margin * 2) / Math.max(1, y2 - y1),
        );
    }

    /* 紙の真ん中に寄せ、はみ出すぶんだけ縮める */
    function fitPaper(map: Map<string, Point>, room: number): Map<string, Point> {
        if (map.size === 0) return map;

        const scale = fitScale(map, room);

        let x1 = Number.POSITIVE_INFINITY;
        let y1 = Number.POSITIVE_INFINITY;
        let x2 = Number.NEGATIVE_INFINITY;
        let y2 = Number.NEGATIVE_INFINITY;

        for (const point of map.values()) {
            x1 = Math.min(x1, point.x);
            x2 = Math.max(x2, point.x);
            y1 = Math.min(y1, point.y);
            y2 = Math.max(y2, point.y);
        }

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const out = new Map<string, Point>();

        for (const [id, point] of map) {
            out.set(id, {
                x: width / 2 + (point.x - cx) * scale,
                y: height / 2 + (point.y - cy) * scale,
            });
        }

        return out;
    }

    /*
     * 格子にそろえる。
     *
     * ★ どの組の人も、同じ一枚の格子の目に乗せる。
     *   組ごとに並べただけだと、隣の組とは縦も横もずれていて、
     *   図全体で見ると丸が斜めに散らばって見えた。
     *   線は斜めでもよいが、丸は縦と横の列にそろっているほうが読みやすい。
     *
     * ★ 目が埋まっていたら、いちばん近い空いた目へ。
     * ★ このあと紙に合わせて全体を同じ倍率で縮めるだけなので、そろいは崩れない。
     */
    function snapToCells(map: Map<string, Point>, gap: number): Map<string, Point> {
        const cellX = gap * 1.1;
        const cellY = gap * 1.1;
        const ox = width / 2;
        const oy = height / 2;
        const taken = new Set<string>();
        const out = new Map<string, Point>();
        const cells = new Map<string, { cx: number; cy: number }>();

        const wanted = [...map.entries()].map(([id, point]) => {
            const fx = (point.x - ox) / cellX;
            const fy = (point.y - oy) / cellY;
            const cx = Math.round(fx);
            const cy = Math.round(fy);
            return { id, fx, fy, cx, cy, off: Math.hypot(fx - cx, fy - cy) };
        });

        /* ずれの少ない人から先に目を取る */
        wanted.sort((a, b) => a.off - b.off);

        for (const one of wanted) {
            let best: { cx: number; cy: number } | null = null;
            let bestD = Number.POSITIVE_INFINITY;

            for (let r = 0; r <= 4 && !best; r += 1) {
                for (let dx = -r; dx <= r; dx += 1) {
                    for (let dy = -r; dy <= r; dy += 1) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                        const cx = one.cx + dx;
                        const cy = one.cy + dy;
                        if (taken.has(`${cx},${cy}`)) continue;
                        const d = Math.hypot(one.fx - cx, one.fy - cy);
                        if (d < bestD) {
                            bestD = d;
                            best = { cx, cy };
                        }
                    }
                }
            }

            const cell = best ?? { cx: one.cx, cy: one.cy };
            taken.add(`${cell.cx},${cell.cy}`);
            cells.set(one.id, cell);
        }

        /*
         * ★ 組ごと、真ん中へ寄せる。
         *
         *   組を四辺に置くと、いちばん大きい組に合わせて間が空き、
         *   ほかの組は真ん中から遠く離れていた。
         *   組（掛け持ちで繋がる組はひとまとめ）を一かたまりとして、
         *   ほかのかたまりと一目以上の間を保ったまま、一目ずつ真ん中へ動かす。
         */
        {
            const bodyOf = new Map<string, string>();
            const parent = new Map<string, string>();
            const root = (key: string): string => {
                const up = parent.get(key) ?? key;
                if (up === key) return key;
                const top = root(up);
                parent.set(key, top);
                return top;
            };

            const firstGroupOf = new Map<string, string>();
            for (const group of groups) {
                for (const id of group.ids) {
                    if (!cells.has(id)) continue;
                    const seen = firstGroupOf.get(id);
                    if (seen) {
                        const a = root(seen);
                        const b = root(group.key);
                        if (a !== b) parent.set(b, a);
                    } else {
                        firstGroupOf.set(id, group.key);
                    }
                }
            }

            for (const id of cells.keys()) {
                const key = firstGroupOf.get(id);
                bodyOf.set(id, key ? root(key) : "__core__");
            }

            const members = new Map<string, string[]>();
            for (const [id, body] of bodyOf) {
                members.set(body, [...(members.get(body) ?? []), id]);
            }

            const all = [...cells.values()];
            const coreIds = members.get("__core__") ?? [];
            const center = (coreIds.length > 0 ? coreIds.map((id) => cells.get(id)!) : all).reduce(
                (sum, one, _, list) => ({
                    cx: sum.cx + one.cx / list.length,
                    cy: sum.cy + one.cy / list.length,
                }),
                { cx: 0, cy: 0 },
            );

            const fits = (body: string, dx: number, dy: number) => {
                const mine = members.get(body)!;
                for (const id of mine) {
                    const c = cells.get(id)!;
                    const nx = c.cx + dx;
                    const ny = c.cy + dy;
                    for (const [other, oc] of cells) {
                        if (bodyOf.get(other) === body) continue;
                        /* 別のかたまりとは、一目あける（囲みと名札の場所） */
                        if (Math.abs(oc.cx - nx) < 2 && Math.abs(oc.cy - ny) < 2) return false;
                    }
                }
                return true;
            };

            for (let round = 0; round < 40; round += 1) {
                let moved = false;

                for (const [body, ids] of members) {
                    if (body === "__core__") continue;

                    const mid = ids.reduce(
                        (sum, id) => ({
                            cx: sum.cx + cells.get(id)!.cx / ids.length,
                            cy: sum.cy + cells.get(id)!.cy / ids.length,
                        }),
                        { cx: 0, cy: 0 },
                    );

                    const sx = Math.sign(Math.round(center.cx - mid.cx));
                    const sy = Math.sign(Math.round(center.cy - mid.cy));

                    for (const [dx, dy] of [
                        [sx, 0],
                        [0, sy],
                    ] as const) {
                        if (dx === 0 && dy === 0) continue;
                        if (!fits(body, dx, dy)) continue;
                        for (const id of ids) {
                            const c = cells.get(id)!;
                            cells.set(id, { cx: c.cx + dx, cy: c.cy + dy });
                        }
                        moved = true;
                    }
                }

                if (!moved) break;
            }
        }

        /*
         * ★ 誰もいない列と行を詰める。
         *   組を四辺に置くと、真ん中との間に空いた帯が何本もできた。
         *   帯のぶん全体が大きくなり、枠に収めると顔も字も小さくなる。
         *   空いた帯は、囲みと線が通れるだけ（一目と少し）残して詰める。
         *   人のいる列・行はそのまま一つずつなので、そろいは崩れない。
         */
        const squeeze = (values: number[]) => {
            const used = [...new Set(values)].sort((a, b) => a - b);
            const at = new Map<number, number>();
            let pos = 0;

            used.forEach((value, index) => {
                if (index > 0) {
                    const empty = value - used[index - 1] - 1;
                    pos += 1 + Math.min(empty, 1.25);
                }
                at.set(value, pos);
            });

            const mid = (pos) / 2;
            return (value: number) => (at.get(value) ?? 0) - mid;
        };

        const colAt = squeeze([...cells.values()].map((one) => one.cx));
        const rowAt = squeeze([...cells.values()].map((one) => one.cy));

        for (const [id, cell] of cells) {
            out.set(id, { x: ox + colAt(cell.cx) * cellX, y: oy + rowAt(cell.cy) * cellY });
        }

        return out;
    }

    function layoutWith(gap: number, TARGET: number): Map<string, Point> {
        const place = new Map<string, Point>();
        const shown = new Set(ids);

        const live = groups
            .map((group) => ({
                ...group,
                ids: group.ids.filter((id) => shown.has(id)),
            }))
            .filter((group) => group.ids.length > 0);

        const byKey = new Map(live.map((group) => [group.key, group]));
        const nest = nestingOf(live);

        /* すぐ外の組。外の組が二つ以上あれば、いちばん小さいもの */
        const parentOf = new Map<string, string | null>();

        for (const group of live) {
            const parents = (nest.get(group.key)?.parents ?? [])
                .map((key) => byKey.get(key)!)
                .sort((a, b) => a.ids.length - b.ids.length);

            parentOf.set(group.key, parents[0]?.key ?? null);
        }

        const childrenOf = new Map<string, typeof live>();

        for (const group of live) {
            const parent = parentOf.get(group.key);
            if (!parent) continue;
            childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), group]);
        }

        const tops = live.filter((group) => !parentOf.get(group.key));

        /* いちばん外の組のうち、どれに入っているか */
        const topsOf = new Map<string, string[]>();

        for (const top of tops) {
            for (const id of top.ids) {
                topsOf.set(id, [...(topsOf.get(id) ?? []), top.key]);
            }
        }

        interface Block {
            points: Map<string, Point>;
            w: number;
            h: number;
        }

        /* 人を輪に並べたかたまり */
        const ringBlock = (list: string[]): Block => {
            const radius = ringRadius(list.length, gap);
            const points = new Map<string, Point>();
            const spots = onRing(list.length, radius);

            spots.forEach((point, index) => {
                points.set(list[index], point);
            });

            /*
             * ★ 広さは、実際に置いた場所から測る。
             *   二人の輪は横に並ぶだけなので、縦はほとんど要らない。
             *   輪の半径から測ると縦にも同じだけ取り、
             *   組が縦に間延びして、四角く並べる判断も狂っていた。
             */
            const xs = spots.map((one) => one.x);
            const ys = spots.map((one) => one.y);

            return {
                points,
                w: Math.max(...xs) - Math.min(...xs) + gap,
                h: Math.max(...ys) - Math.min(...ys) + gap * 1.05,
            };
        };

        /*
         * 人を並べたかたまり。
         *
         * ★ 三人までは輪（三人なら三角）。四人からは格子。
         *
         *   輪は場所を取る。五人の輪は、同じ五人の格子の三倍近い広さになり、
         *   組が多い図では紙に収まらず、全体を縮めて名前が重なっていた。
         *
         * ★ 格子は、一つおきの列を少し下げる。
         *   三人がぴたりと一直線に並ぶと、端どうしの線が真ん中の人を貫く。
         */
        const peopleBlock = (list: string[], wantCols?: number): Block => {
            /*
             * ★ 三人までも、横一列に並べる（三角にしない）。
             *   丸は縦と横の線にそろえる。斜めに散らばると、目が迷う。
             */
            void ringBlock;

            const cols = Math.min(
                list.length,
                Math.max(
                    1,
                    wantCols ??
                        (list.length <= 3 ? list.length : Math.ceil(Math.sqrt(list.length * 1.15))),
                ),
            );
            const rowsN = Math.ceil(list.length / cols);
            const points = new Map<string, Point>();

            list.forEach((id, index) => {
                const row = Math.floor(index / cols);
                const inRow = Math.min(cols, list.length - row * cols);
                const col = index % cols;

                points.set(id, {
                    x: (col - (inRow - 1) / 2) * gap * 1.1,
                    /* ★ 列をずらさない。丸は格子の上にそろえる */
                    y: (row - (rowsN - 1) / 2) * gap * 0.95,
                });
            });

            return {
                points,
                w: (cols - 1) * gap * 1.1 + gap * 1.2,
                h: (rowsN - 1) * gap * 0.95 + gap * 1.25,
            };
        };

        /*
         * かたまりをいくつか、四角く並べる。
         *
         * ★ 何列にするかは、いちばん正方形に近くなるもの。
         *
         * ★ 横一列に決めたいとき（掛け持ちで繋がる組の並び）は cols を渡す。
         */
        const arrange = (parts: Block[], sep: number, fixedCols?: number): Block => {
            if (parts.length === 1) return parts[0];

            const layout = (cols: number) => {
                const rows: Block[][] = [];

                for (let i = 0; i < parts.length; i += cols) {
                    rows.push(parts.slice(i, i + cols));
                }

                const rowW = rows.map(
                    (row) =>
                        row.reduce((sum, part) => sum + part.w, 0) +
                        sep * (row.length - 1),
                );
                const rowH = rows.map((row) => Math.max(...row.map((part) => part.h)));

                return {
                    rows,
                    rowW,
                    rowH,
                    w: Math.max(...rowW),
                    h: rowH.reduce((sum, one) => sum + one, 0) + sep * (rows.length - 1),
                };
            };

            const off = (shape: { w: number; h: number }) =>
                Math.abs(Math.log(shape.w / shape.h) - Math.log(1.15));

            let best = layout(fixedCols ?? 1);

            if (!fixedCols) {
                for (let cols = 2; cols <= parts.length; cols += 1) {
                    const one = layout(cols);
                    if (off(one) < off(best)) best = one;
                }
            }

            const { rows, rowW, rowH, w, h } = best;
            const points = new Map<string, Point>();
            let y = -h / 2;

            rows.forEach((row, r) => {
                let x = -rowW[r] / 2;

                for (const part of row) {
                    const cx = x + part.w / 2;
                    const cy = y + rowH[r] / 2;

                    for (const [id, point] of part.points) {
                        points.set(id, { x: cx + point.x, y: cy + point.y });
                    }

                    x += part.w + sep;
                }

                y += rowH[r] + sep;
            });

            return { points, w, h };
        };

        /*
         * 組のかたまりを作る。
         *
         * ★ 内の組を先に、ひとかたまりずつ。残りの人を最後に。
         * ★ 内の組には囲みと名札が付くので、そのぶん広く場所を取る。
         */
        const blockOf = (key: string, free: Set<string>): Block => {
            const group = byKey.get(key)!;
            const parts: Block[] = [];

            const children = [...(childrenOf.get(key) ?? [])].sort(
                (a, b) => b.ids.length - a.ids.length,
            );

            for (const child of children) {
                const mine = new Set(child.ids.filter((id) => free.has(id)));
                if (mine.size === 0) continue;

                const inner = blockOf(child.key, mine);

                for (const id of inner.points.keys()) free.delete(id);

                parts.push({
                    points: inner.points,
                    w: inner.w + gap * 0.6,
                    h: inner.h + gap * 0.9,
                });
            }

            const rest = group.ids.filter((id) => free.has(id));

            if (rest.length > 0) {
                for (const id of rest) free.delete(id);
                parts.push(peopleBlock(rest));
            }

            if (parts.length === 0) return { points: new Map(), w: gap, h: gap };

            return arrange(parts, gap * 0.35);
        };

        /*
         * 掛け持ちで繋がる組を、ひとまとまりにする。
         *
         * ★ 家族と FBI を赤井秀一が掛け持ちしていれば、二つで一まとまり。
         *   [家族だけの人][赤井][FBI だけの人] と横に並べる。
         *   囲みは、赤井のところで重なる。
         */
        const clusterOf = new Map<string, string>();
        const root = (key: string): string => {
            const up = clusterOf.get(key) ?? key;
            if (up === key) return key;
            const top = root(up);
            clusterOf.set(key, top);
            return top;
        };

        for (const keys of topsOf.values()) {
            for (let i = 1; i < keys.length; i += 1) {
                const a = root(keys[0]);
                const b = root(keys[i]);
                if (a !== b) clusterOf.set(b, a);
            }
        }

        const clusters = new Map<string, typeof tops>();

        for (const top of tops) {
            const key = root(top.key);
            clusters.set(key, [...(clusters.get(key) ?? []), top]);
        }

        interface Tile {
            key: string;
            block: Block;
            w: number;
            h: number;
        }

        const tiles: Tile[] = [];

        for (const members of clusters.values()) {
            if (members.length === 1) {
                const top = members[0];
                const block = blockOf(top.key, new Set(top.ids));

                tiles.push({
                    key: top.key,
                    block,
                    w: block.w + gap * 0.7,
                    h: block.h + gap * 1.0,
                });
                continue;
            }

            /*
             * 並べる順。繋がっている組が隣に来るよう、掛け持ちを辿る。
             */
            const order: typeof tops = [];
            const left = [...members].sort((a, b) => b.ids.length - a.ids.length);

            order.push(left.shift()!);

            while (left.length > 0) {
                const last = new Set(order[order.length - 1].ids);
                const at = left.findIndex((group) => group.ids.some((id) => last.has(id)));
                order.push(left.splice(at >= 0 ? at : 0, 1)[0]);
            }

            const taken = new Set<string>();
            const parts: Block[] = [];

            order.forEach((group, index) => {
                /* この組だけの人 */
                const own = new Set(
                    group.ids.filter(
                        (id) => !taken.has(id) && (topsOf.get(id) ?? []).length === 1,
                    ),
                );

                if (own.size > 0) {
                    const block = blockOf(group.key, own);
                    for (const id of block.points.keys()) taken.add(id);
                    parts.push({ ...block, w: block.w + gap * 0.3, h: block.h + gap * 0.6 });
                }

                /* 次の組との境目に立つ人 */
                const next = order[index + 1];

                if (next) {
                    const nextIds = new Set(next.ids);
                    const shared = group.ids.filter(
                        (id) => !taken.has(id) && nextIds.has(id),
                    );

                    if (shared.length > 0) {
                        for (const id of shared) taken.add(id);
                        parts.push(peopleBlock(shared));
                    }
                }
            });

            /* 隣り合わない組どうしの掛け持ちは、いちばん端の境目に足す */
            const stray = members
                .flatMap((group) => group.ids)
                .filter((id, index, all) => all.indexOf(id) === index && !taken.has(id));

            if (stray.length > 0) parts.push(peopleBlock(stray));

            const block = arrange(parts, gap * 0.3, parts.length);

            tiles.push({
                key: order[0].key,
                block,
                w: block.w + gap * 0.7,
                h: block.h + gap * 1.0,
            });
        }

        /*
         * 真ん中に置く人。どこの組にも入らない人。
         *
         * ★ 人物相関図は、物語の中心の人を真ん中に置き、
         *   まわりを組織が取り巻く形が読みやすい。
         *   どこにも属さない人は、たいてい主人公とその身近な人。
         */
        const middle = ids.filter((id) => !topsOf.has(id));
        let core: Block =
            middle.length === 0 ? { points: new Map(), w: 0, h: 0 } : peopleBlock(middle);

        /*
         * 組を、真ん中のまわりの四辺に振り分ける。
         *
         * ★ 全体が四角に近くなるように。
         *   大きい組から順に、置いたときに全体がいちばん
         *   正方形に近くなる辺へ入れる。
         */
        const SEP = gap * 0.45;

        type Side = "top" | "right" | "bottom" | "left";
        const sides: Record<Side, Tile[]> = { top: [], right: [], bottom: [], left: [] };

        const measure = (with_: Record<Side, Tile[]>) => {
            const run = (list: Tile[], along: "w" | "h") =>
                list.reduce((sum, tile) => sum + tile[along], 0) +
                SEP * Math.max(0, list.length - 1);
            const thick = (list: Tile[], across: "w" | "h") =>
                list.reduce((most, tile) => Math.max(most, tile[across]), 0);

            const coreW = Math.max(core.w, run(with_.top, "w"), run(with_.bottom, "w"));
            const coreH = Math.max(core.h, run(with_.left, "h"), run(with_.right, "h"));

            const leftW = thick(with_.left, "w");
            const rightW = thick(with_.right, "w");
            const topH = thick(with_.top, "h");
            const bottomH = thick(with_.bottom, "h");

            return {
                coreW,
                coreH,
                leftW,
                rightW,
                topH,
                bottomH,
                w: coreW + leftW + rightW + (leftW ? SEP : 0) + (rightW ? SEP : 0),
                h: coreH + topH + bottomH + (topH ? SEP : 0) + (bottomH ? SEP : 0),
            };
        };

        const sorted = [...tiles].sort((a, b) => b.w * b.h - a.w * a.h);

        /*
         * ★ 真ん中に誰もいないときは、四辺ではなく格子に並べる。
         *   真ん中が空だと、組が空洞を囲むだけになる。
         */
        if (middle.length > 0 && tiles.length >= 2) {
            const sideOrder: Side[] = ["top", "right", "bottom", "left"];

            const scoreOf = (trial: Record<Side, Tile[]>) => {
                const shape = measure(trial);

                /*
                 * ★ まず広さ、次に形。
                 *   形だけを見ていたら、一つの辺に組を積み上げて
                 *   真ん中の四角が縦に引き伸ばされ、全体が紙に収まらなかった。
                 */
                return (
                    shape.w *
                    shape.h *
                    (1 +
                        1.5 *
                            Math.abs(
                                Math.log(shape.w / Math.max(1, shape.h)) - Math.log(TARGET),
                            ))
                );
            };

            if (sorted.length <= 7) {
                /*
                 * ★ 組が少ないうちは、振り分け方を全部試す。
                 *   一つずつ決めていくと、最初の組の置き場所に引きずられて、
                 *   下の辺が空いたまま右の辺に積み上がることがあった。
                 */
                let best: Record<Side, Tile[]> | null = null;
                let bestScore = Number.POSITIVE_INFINITY;
                const total = 4 ** sorted.length;

                for (let code = 0; code < total; code += 1) {
                    const trial: Record<Side, Tile[]> = { top: [], right: [], bottom: [], left: [] };
                    let rest = code;

                    for (const tile of sorted) {
                        trial[sideOrder[rest % 4]].push(tile);
                        rest = Math.floor(rest / 4);
                    }

                    const score = scoreOf(trial);

                    if (score < bestScore) {
                        bestScore = score;
                        best = trial;
                    }
                }

                if (best) Object.assign(sides, best);
            } else {
                for (const tile of sorted) {
                    let bestSide: Side = "top";
                    let bestScore = Number.POSITIVE_INFINITY;

                    for (const side of sideOrder) {
                        const score = scoreOf({ ...sides, [side]: [...sides[side], tile] });

                        if (score < bestScore) {
                            bestScore = score;
                            bestSide = side;
                        }
                    }

                    sides[bestSide].push(tile);
                }
            }

            /*
             * ★ 真ん中の人の並びを、空いている四角の形に合わせる。
             *
             *   左右に組が積まれると、真ん中の四角は縦に長くなる。
             *   そこへ横長の格子を置くと、上下は空いているのに
             *   横どうしの名前が重なっていた。
             *   列の数を変えて、全体がいちばん小さく、
             *   人どうしがいちばん離れるものを選ぶ。
             */
            if (middle.length > 3) {
                let bestArea = Number.POSITIVE_INFINITY;
                let bestSpace = 0;
                let bestCore = core;

                /*
                 * ★ 一列にはしない。
                 *   一列に並ぶと、端どうしを結ぶ線がみな列の上を大きく回り込む。
                 *   六人以上なら二段以上に。
                 */
                const most = middle.length >= 6 ? Math.ceil(middle.length / 2) : middle.length;
                /* 縦一列も同じ。六人以上なら二列以上に */
                const least = middle.length >= 6 ? 2 : 1;

                for (let c = least; c <= most; c += 1) {
                    const trial = peopleBlock(middle, c);
                    const saved = core;
                    core = trial;
                    const one = measure(sides);
                    core = saved;

                    const area = one.w * one.h;
                    const sx = Math.min(
                        1.7,
                        (one.coreW - gap * 0.6) / Math.max(1, trial.w - gap * 0.6),
                    );
                    const sy = Math.min(
                        1.7,
                        (one.coreH - gap * 0.6) / Math.max(1, trial.h - gap * 0.6),
                    );
                    const space = Math.min(
                        1.1 * gap * Math.max(1, sx),
                        0.95 * gap * Math.max(1, sy),
                    );

                    if (
                        area < bestArea * 0.97 ||
                        (area < bestArea * 1.03 && space > bestSpace)
                    ) {
                        bestArea = Math.min(bestArea, area);
                        bestSpace = space;
                        bestCore = trial;
                    }
                }

                core = bestCore;
            }

            const shape = measure(sides);

            const coreLeft = width / 2 - shape.w / 2 + shape.leftW + (shape.leftW ? SEP : 0);
            const coreTop = height / 2 - shape.h / 2 + shape.topH + (shape.topH ? SEP : 0);
            const coreMidX = coreLeft + shape.coreW / 2;
            const coreMidY = coreTop + shape.coreH / 2;

            /*
             * ★ 真ん中の人は、空いている四角いっぱいに広げる。
             *   人は詰めたままだと、まわりが空いているのに名前が重なる。
             *   縦と横で別々に広げる。
             */
            const spreadX = Math.min(
                1.2,
                Math.max(1, (shape.coreW - gap * 0.6) / Math.max(1, core.w - gap * 0.6)),
            );
            const spreadY = Math.min(
                1.2,
                Math.max(1, (shape.coreH - gap * 0.6) / Math.max(1, core.h - gap * 0.6)),
            );

            for (const [id, point] of core.points) {
                place.set(id, {
                    x: coreMidX + point.x * spreadX,
                    y: coreMidY + point.y * spreadY,
                });
            }

            const put = (tile: Tile, x: number, y: number) => {
                /* 名札のぶん、少し下げる */
                for (const [id, point] of tile.block.points) {
                    place.set(id, { x: x + point.x, y: y + point.y + gap * 0.15 });
                }
            };

            const lay = (list: Tile[], side: Side) => {
                const along = side === "top" || side === "bottom" ? "w" : "h";
                const total =
                    list.reduce((sum, tile) => sum + tile[along], 0) +
                    SEP * Math.max(0, list.length - 1);

                let at = along === "w" ? coreMidX - total / 2 : coreMidY - total / 2;

                for (const tile of list) {
                    const mid = at + tile[along] / 2;

                    /* 上の辺は下の縁を、下の辺は上の縁を、真ん中の四角にそろえる */
                    if (side === "top") put(tile, mid, coreTop - SEP - tile.h / 2);
                    if (side === "bottom") put(tile, mid, coreTop + shape.coreH + SEP + tile.h / 2);
                    if (side === "left") put(tile, coreLeft - SEP - tile.w / 2, mid);
                    if (side === "right") put(tile, coreLeft + shape.coreW + SEP + tile.w / 2, mid);

                    at += tile[along] + SEP;
                }
            };

            lay(sides.top, "top");
            lay(sides.right, "right");
            lay(sides.bottom, "bottom");
            lay(sides.left, "left");

            return snapToCells(place, gap);
        }

        /*
         * 格子に並べる（真ん中に誰もいない、または組が一つだけ）。
         * ★ 列の数は、全体が四角に近くなるもの。
         */
        const all: Tile[] = [...sorted];

        if (core.points.size > 0) {
            all.push({
                key: "__middle__",
                block: core,
                w: core.w + gap * 0.4,
                h: core.h + gap * 0.4,
            });
        }

        const shapeOf = (cols: number) => {
            const rows: Tile[][] = [];

            for (let i = 0; i < all.length; i += cols) {
                rows.push(all.slice(i, i + cols));
            }

            const rowW = rows.map((row) => row.reduce((sum, tile) => sum + tile.w, 0));
            const rowH = rows.map((row) =>
                row.reduce((most, tile) => Math.max(most, tile.h), 0),
            );

            return {
                rows,
                rowW,
                rowH,
                w: Math.max(...rowW, 1),
                h: rowH.reduce((sum, one) => sum + one, 0),
            };
        };

        let cols = 1;
        let bestOff = Number.POSITIVE_INFINITY;

        for (let n = 1; n <= all.length; n += 1) {
            const shape = shapeOf(n);
            const off = Math.abs(Math.log(shape.w / shape.h) - Math.log(TARGET));

            if (off < bestOff) {
                bestOff = off;
                cols = n;
            }
        }

        const { rows, rowW, rowH, h: totalH } = shapeOf(cols);
        let top = height / 2 - totalH / 2;

        rows.forEach((row, index) => {
            let x = width / 2 - rowW[index] / 2;

            for (const tile of row) {
                const at = { x: x + tile.w / 2, y: top + rowH[index] / 2 + gap * 0.15 };

                for (const [id, point] of tile.block.points) {
                    place.set(id, { x: at.x + point.x, y: at.y + point.y });
                }

                x += tile.w;
            }

            top += rowH[index];
        });

        return snapToCells(place, gap);
    }
}

/* ============================================================
 * 5. 関係で引き合わせて、並びをほぐす
 * ============================================================ */

/**
 * 組ごとに並べたあと、関係で引き合わせて並びをほぐす。
 *
 * ★ 格子のままだと、整いすぎて機械が並べたように見える。
 *
 *   人物相関図は、関係のある人どうしが近くにいて、
 *   目で線をたどると物語が追えるもの。
 *   組ごとの並びを出発点にして、関係で少しずつ引き寄せる。
 *
 * ★ 引き寄せながら、崩れすぎないようにする。
 *
 *   ・関係で結ばれた人は、ほどよい距離まで近づく
 *   ・同じ組の人は、組の真ん中へ寄る（組がまとまる）
 *   ・人のカードどうしは重ならない
 *   ・組に入っていない人は、ほかの組の範囲から押し出す
 *   ・主人公は真ん中へ寄る
 *
 * ★ 最後に作者が手で動かせる。ここで決めるのは出発点。
 */
export function relaxLayout(options: {
    start: Map<string, Point>;
    /** 人ごとのカードの大きさ */
    sizes: Map<string, { w: number; h: number }>;
    links: { a: string; b: string }[];
    groups: { key: string; ids: string[] }[];
    /** 真ん中へ寄せる人（主人公） */
    hub?: string | null;
    width: number;
    height: number;
    gap: number;
    steps?: number;
}): Map<string, Point> {
    const { sizes, links, groups, hub, width, height, gap } = options;
    const steps = options.steps ?? 340;

    const ids = [...options.start.keys()];
    const at = new Map<string, Point>();

    for (const [id, point] of options.start) at.set(id, { ...point });

    const sizeOf = (id: string) => sizes.get(id) ?? { w: gap * 0.6, h: gap * 0.7 };

    const memberOf = new Map<string, Set<string>>();

    for (const group of groups) {
        for (const id of group.ids) {
            if (!at.has(id)) continue;
            const set = memberOf.get(id) ?? new Set<string>();
            set.add(group.key);
            memberOf.set(id, set);
        }
    }

    const liveGroups = groups
        .map((group) => ({ ...group, ids: group.ids.filter((id) => at.has(id)) }))
        .filter((group) => group.ids.length > 0);

    const want = gap * 1.3;
    const cx = width / 2;
    const cy = height / 2;

    /*
     * ★ 出発点に、ゆるく繋いでおく。
     *   引き合わせるだけだと、関係の多い主人公のまわりに
     *   全員が吸い寄せられ、組どうしが重なって一つの塊になった。
     *   組ごとの並びは崩さず、その中で少し動く程度にする。
     */
    const home = new Map<string, Point>();
    for (const [id, point] of options.start) home.set(id, { ...point });

    /* 入れ子でない組の組み合わせ（重なったら押し離す） */
    const setsOf = new Map(liveGroups.map((group) => [group.key, new Set(group.ids)]));
    const apartPairs: [string, string][] = [];

    for (let i = 0; i < liveGroups.length; i += 1) {
        for (let j = i + 1; j < liveGroups.length; j += 1) {
            const a = setsOf.get(liveGroups[i].key)!;
            const b = setsOf.get(liveGroups[j].key)!;
            const shared = [...a].some((id) => b.has(id));
            if (!shared) apartPairs.push([liveGroups[i].key, liveGroups[j].key]);
        }
    }

    for (let step = 0; step < steps; step += 1) {
        const heat = 1 - step / steps;
        const move = new Map<string, Point>(ids.map((id) => [id, { x: 0, y: 0 }]));

        const push = (id: string, x: number, y: number) => {
            const one = move.get(id);
            if (!one) return;
            one.x += x;
            one.y += y;
        };

        /* 関係で引き合う */
        for (const { a, b } of links) {
            const p = at.get(a);
            const q = at.get(b);
            if (!p || !q) continue;

            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            /* 近づけるだけ。遠いほど強く引くと、全員が一か所に寄る */
            /*
             * ★ 遠く離れた二人だけを、少し寄せる。
             *   近い二人まで寄せると、図がどこも詰まって線と名前が重なった。
             */
            const f = Math.max(0, d - want * 1.5) * 0.008;

            push(a, (dx / d) * f, (dy / d) * f);
            push(b, (-dx / d) * f, (-dy / d) * f);
        }

        /* 組の真ん中へ寄る */
        for (const group of liveGroups) {
            if (group.ids.length < 2) continue;

            let sx = 0;
            let sy = 0;

            for (const id of group.ids) {
                const p = at.get(id)!;
                sx += p.x;
                sy += p.y;
            }

            const mx = sx / group.ids.length;
            const my = sy / group.ids.length;

            for (const id of group.ids) {
                const p = at.get(id)!;
                push(id, (mx - p.x) * 0.008, (my - p.y) * 0.008);
            }
        }

        /* 主人公は真ん中へ */
        if (hub && at.has(hub)) {
            const p = at.get(hub)!;
            push(hub, (cx - p.x) * 0.012, (cy - p.y) * 0.012);
        }

        /* 出発点へ戻ろうとする力 */
        for (const id of ids) {
            const p = at.get(id)!;
            const h = home.get(id)!;
            push(id, (h.x - p.x) * 0.03, (h.y - p.y) * 0.03);
        }

        /* 組どうしが重なったら、組ごと押し離す */
        const boundsOf = (key: string) => {
            let x1 = Number.POSITIVE_INFINITY;
            let y1 = Number.POSITIVE_INFINITY;
            let x2 = Number.NEGATIVE_INFINITY;
            let y2 = Number.NEGATIVE_INFINITY;

            for (const id of setsOf.get(key) ?? []) {
                const p = at.get(id)!;
                const size = sizeOf(id);
                x1 = Math.min(x1, p.x - size.w / 2);
                x2 = Math.max(x2, p.x + size.w / 2);
                y1 = Math.min(y1, p.y - size.h / 2);
                y2 = Math.max(y2, p.y + size.h / 2);
            }

            const pad = gap * 0.5;
            return { x1: x1 - pad, y1: y1 - pad * 1.8, x2: x2 + pad, y2: y2 + pad };
        };

        for (const [ka, kb] of apartPairs) {
            const a = boundsOf(ka);
            const b = boundsOf(kb);

            const overX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
            const overY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
            if (overX <= 0 || overY <= 0) continue;

            const acx = (a.x1 + a.x2) / 2;
            const bcx = (b.x1 + b.x2) / 2;
            const acy = (a.y1 + a.y2) / 2;
            const bcy = (b.y1 + b.y2) / 2;

            let sx = 0;
            let sy = 0;

            if (overX < overY) sx = (acx <= bcx ? -1 : 1) * overX * 0.25;
            else sy = (acy <= bcy ? -1 : 1) * overY * 0.25;

            for (const id of setsOf.get(ka) ?? []) push(id, sx, sy);
            for (const id of setsOf.get(kb) ?? []) push(id, -sx, -sy);
        }

        /* 重ならない。カードの大きさで押し合う */
        for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
                const a = ids[i];
                const b = ids[j];
                const p = at.get(a)!;
                const q = at.get(b)!;
                const sa = sizeOf(a);
                const sb = sizeOf(b);

                const dx = q.x - p.x;
                const dy = q.y - p.y;
                const needX = (sa.w + sb.w) / 2 + gap * 0.4;
                const needY = (sa.h + sb.h) / 2 + gap * 0.3;

                const overX = needX - Math.abs(dx);
                const overY = needY - Math.abs(dy);

                if (overX > 0 && overY > 0) {
                    /* 浅いほうへ押し出す */
                    if (overX < overY) {
                        const s = (dx >= 0 ? 1 : -1) * overX * 0.5;
                        push(a, -s, 0);
                        push(b, s, 0);
                    } else {
                        const s = (dy >= 0 ? 1 : -1) * overY * 0.5;
                        push(a, 0, -s);
                        push(b, 0, s);
                    }
                } else {
                    /* 離れていても、少しだけ押し合う。詰まりすぎないように */
                    const d = Math.hypot(dx, dy) || 1;

                    if (d < gap * 2.4) {
                        const f = ((gap * gap) / (d * d)) * 0.8;
                        push(a, (-dx / d) * f, (-dy / d) * f);
                        push(b, (dx / d) * f, (dy / d) * f);
                    }
                }
            }
        }

        /* 組に入っていない人は、その組の範囲から出す */
        for (const group of liveGroups) {
            let x1 = Number.POSITIVE_INFINITY;
            let y1 = Number.POSITIVE_INFINITY;
            let x2 = Number.NEGATIVE_INFINITY;
            let y2 = Number.NEGATIVE_INFINITY;

            for (const id of group.ids) {
                const p = at.get(id)!;
                const s = sizeOf(id);
                x1 = Math.min(x1, p.x - s.w / 2);
                x2 = Math.max(x2, p.x + s.w / 2);
                y1 = Math.min(y1, p.y - s.h / 2);
                y2 = Math.max(y2, p.y + s.h / 2);
            }

            const pad = gap * 0.45;
            x1 -= pad;
            y1 -= pad * 1.6;
            x2 += pad;
            y2 += pad;

            for (const id of ids) {
                if (memberOf.get(id)?.has(group.key)) continue;

                const p = at.get(id)!;
                const s = sizeOf(id);

                const left = p.x + s.w / 2 - x1;
                const right = x2 - (p.x - s.w / 2);
                const top = p.y + s.h / 2 - y1;
                const bottom = y2 - (p.y - s.h / 2);

                if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) continue;

                const least = Math.min(left, right, top, bottom);

                if (least === left) push(id, -left * 0.4, 0);
                else if (least === right) push(id, right * 0.4, 0);
                else if (least === top) push(id, 0, -top * 0.4);
                else push(id, 0, bottom * 0.4);
            }
        }

        /* 動かす。熱が冷めるほど小さく */
        const cap = gap * (0.08 + 0.35 * heat);

        for (const id of ids) {
            const p = at.get(id)!;
            const m = move.get(id)!;
            const len = Math.hypot(m.x, m.y);
            const scale = len > cap ? cap / len : 1;

            const s = sizeOf(id);
            const marginX = s.w / 2 + gap * 0.2;
            const marginY = s.h / 2 + gap * 0.2;

            at.set(id, {
                x: Math.min(width - marginX, Math.max(marginX, p.x + m.x * scale)),
                y: Math.min(height - marginY, Math.max(marginY, p.y + m.y * scale)),
            });
        }
    }

    return at;
}

/* ============================================================
 * 6. 線の通り道（組分けのとき）
 * ============================================================ */

export interface CurveRoute {
    /** SVG の道 */
    d: string;
    /** 線の上の点。名前の札の置き場所と、ほかの線との重なりを見るのに使う */
    samples: Point[];
}

function onQuad(p0: Point, c: Point, p2: Point, t: number): Point {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
    };
}

function inRect(p: Point, r: Rect): boolean {
    return p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2;
}

/**
 * 二人を結ぶ線の通り道を選ぶ。
 *
 * ★ 形は何でもよい。読みやすいものを選ぶ。
 *     まっすぐ
 *     ゆるい弧（大きくふくらんで回り込んでもよい）
 *     カクッと折れる線（L 字・コの字・Z 字）
 *
 * ★ 選ぶ決め手。
 *   人の丸や名前に掛からない（いちばん大事）
 *   先に引いた線と同じ所を走らない
 *   関係のない組の囲みは、なるべく横切らない
 *   そのうえで、短くて素直な形
 */
export function curveRoute(options: {
    from: Point;
    to: Point;
    /** 通ってはいけないもの（ほかの人の丸と名前） */
    hard: Rect[];
    /** なるべく通らないもの（関係のない組の囲み） */
    soft: Rect[];
    /** 先に引いた線の点 */
    placed: Point[][];
    /** 線どうしが、これより近いと重なりとみなす */
    lane: number;
    /** 始まりの人（組）の広さ。この外から線を出す */
    startRect?: Rect | null;
    endRect?: Rect | null;
    /** 端を、ここまで手前で止める（startRect が無いとき） */
    halo: number;
    /** 折れ目の丸み */
    corner: number;
    /**
     * 行き帰りの二本のうちの一本。
     * ふくらむ弧だけにする（二本が左右対称に分かれる）。
     */
    bowOnly?: boolean;
    /**
     * 両端の人が入っている組の囲み。
     * この外側をぐるりと回る道（下へ出て、横へ行き、上がる）も候補にする。
     */
    around?: Rect[];
}): CurveRoute {
    const { from, to, hard, soft, placed, lane, startRect, endRect, halo, corner } = options;
    const bowOnly = options.bowOnly ?? false;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const step = Math.max(lane * 1.6, length * 0.11);

    const outOfStart = (p: Point) =>
        startRect ? !inRect(p, startRect) : Math.hypot(p.x - from.x, p.y - from.y) > halo;
    const outOfEnd = (p: Point) =>
        endRect ? !inRect(p, endRect) : Math.hypot(p.x - to.x, p.y - to.y) > halo;

    /* 端の人の外に出たところから、相手に入るところまで */
    const clip = (all: Point[]) => {
        let a = 0;
        while (a < all.length - 1 && !outOfStart(all[a])) a += 1;
        let b = all.length - 1;
        while (b > a && !outOfEnd(all[b])) b -= 1;
        return { a, b };
    };

    const costOf = (samples: Point[]) => {
        let cost = 0;

        const hardHit = new Set<number>();
        const softHit = new Set<number>();
        for (const p of samples) {
            hard.forEach((r, i) => {
                if (inRect(p, r)) hardHit.add(i);
            });
            soft.forEach((r, i) => {
                if (inRect(p, r)) softHit.add(i);
            });
        }
        cost += hardHit.size * 60 + softHit.size * 6;

        /* 先に引いた線に沿って走る長さ（交わるだけなら少し） */
        let close = 0;
        const inner = samples.slice(2, Math.max(2, samples.length - 2));
        for (const p of inner) {
            for (const line of placed) {
                if (line.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < lane)) {
                    close += 1;
                    break;
                }
            }
        }
        cost += close * 3;

        /*
         * ★ ほかの線と交わる回数も数える。
         *   交わりが多いと、どの線がどこへ行くのか追えない。
         *   外を回る道は長いが、交わらずに済むならそちらを選ぶ。
         */
        let crossings = 0;
        const seg = (a: Point, b: Point, c: Point, d: Point) => {
            const o = (p: Point, q: Point, r: Point) =>
                (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
            return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
        };
        for (const line of placed) {
            let hitLine = false;
            for (let i = 1; i < samples.length && !hitLine; i += 1) {
                for (let j = 1; j < line.length; j += 1) {
                    if (seg(samples[i - 1], samples[i], line[j - 1], line[j])) {
                        hitLine = true;
                        break;
                    }
                }
            }
            if (hitLine) crossings += 1;
        }
        cost += crossings * 2.5;

        /* 長さ。回り道は少しだけ嫌う */
        let run = 0;
        for (let i = 1; i < samples.length; i += 1) {
            run += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        }
        cost += Math.max(0, run / length - 1) * 2.5;

        return cost;
    };

    const candidates: { cost: number; route: CurveRoute }[] = [];

    /* まっすぐと、弧 */
    const N = 40;
    /*
     * ★ 行き帰りの二本は、同じ向き（+）にだけふくらませる。
     *   向きが逆の線なので、同じ + でも、見た目は左右に分かれる。
     */
    for (const k of bowOnly ? [1, 2, 3] : [0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6]) {
        const control = { x: mid.x + nx * step * k, y: mid.y + ny * step * k };
        const all = Array.from({ length: N + 1 }, (_, i) => onQuad(from, control, to, i / N));
        const { a, b } = clip(all);
        const ta = a / N;
        const tb = b / N;

        /* 切り取った部分の、曲線の引っ張り点（ブロッサム） */
        const sub = {
            x:
                from.x * (1 - ta) * (1 - tb) +
                control.x * ((1 - ta) * tb + ta * (1 - tb)) +
                to.x * ta * tb,
            y:
                from.y * (1 - ta) * (1 - tb) +
                control.y * ((1 - ta) * tb + ta * (1 - tb)) +
                to.y * ta * tb,
        };

        const samples = all.slice(a, b + 1);
        const start = all[a];
        const end = all[b];

        /*
         * ★ 長い斜めの線は、少しだけ嫌う。
         *   紙の相関図は、縦と横に折れる線で組の外を回っている。
         *   斜めの線が組の中を横切ると、どこからどこへの線か追いにくい。
         *   短い斜め（隣どうし）は気にしない。
         */
        const slanted =
            Math.abs(dx) > lane * 2.5 && Math.abs(dy) > lane * 2.5 && length > lane * 6;

        candidates.push({
            cost: costOf(samples) + Math.abs(k) * 1.0 + (slanted && !bowOnly ? 2 : 0),
            route: {
                d:
                    k === 0
                        ? `M${start.x} ${start.y} L${end.x} ${end.y}`
                        : `M${start.x} ${start.y} Q${sub.x} ${sub.y} ${end.x} ${end.y}`,
                samples,
            },
        });
    }

    /* 折れる線。角を通る点の並びから作る */
    const bent = (corners: Point[], extra: number) => {
        const path = [from, ...corners, to];
        const all: Point[] = [];
        const cornerAt: number[] = [];
        const piece = Math.max(4, lane / 2);

        for (let i = 1; i < path.length; i += 1) {
            const p = path[i - 1];
            const q = path[i];
            const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / piece));
            for (let j = i === 1 ? 0 : 1; j <= n; j += 1) {
                all.push({ x: p.x + ((q.x - p.x) * j) / n, y: p.y + ((q.y - p.y) * j) / n });
            }
            if (i < path.length - 1) cornerAt.push(all.length - 1);
        }

        const { a, b } = clip(all);
        const samples = all.slice(a, b + 1);
        const inside = cornerAt.filter((at) => at > a && at < b).map((at) => all[at]);

        /* 角が端の人の中に入ってしまうと、形が崩れるので使わない */
        if (inside.length !== corners.length) return;

        candidates.push({
            cost: costOf(samples) + extra,
            route: { d: roundedPath([all[a], ...inside, all[b]], corner), samples },
        });
    };

    if (bowOnly) {
        candidates.sort((a, b) => a.cost - b.cost);
        return candidates[0].route;
    }

    /* L 字（横から縦・縦から横） */
    bent([{ x: to.x, y: from.y }], 0.8);
    bent([{ x: from.x, y: to.y }], 0.8);

    /* コの字・Z 字。折れる位置をいくつか試す。外へ張り出す形（輪になる形）も */
    for (const f of [0.5, 0.3, 0.7, -0.25, 1.25]) {
        const x = from.x + dx * f;
        const y = from.y + dy * f;
        const out = f < 0 || f > 1 ? 1.5 : 0;
        bent([{ x, y: from.y }, { x, y: to.y }], 2.5 + out);
        bent([{ x: from.x, y }, { x: to.x, y }], 2.5 + out);
    }

    /* 大きく張り出すコの字（上下・左右に、線の外側を回る） */
    for (const room of [step * 1.5, step * 3]) {
        const top = Math.min(from.y, to.y) - room;
        const bottom = Math.max(from.y, to.y) + room;
        const left = Math.min(from.x, to.x) - room;
        const right = Math.max(from.x, to.x) + room;
        bent([{ x: from.x, y: top }, { x: to.x, y: top }], 4);
        bent([{ x: from.x, y: bottom }, { x: to.x, y: bottom }], 4);
        bent([{ x: left, y: from.y }, { x: left, y: to.y }], 4);
        bent([{ x: right, y: from.y }, { x: right, y: to.y }], 4);
    }

    /*
     * ★ 囲みの外をぐるりと回る道。
     *   組の中の人から、組の外の人へ結ぶとき、囲みの中を斜めに横切らず、
     *   囲みの下（上・左・右）の外側を通って、相手の真下（真上…）から入る。
     */
    if (options.around && options.around.length > 0) {
        const edge = options.around.reduce(
            (all, one) => ({
                x1: Math.min(all.x1, one.x1),
                y1: Math.min(all.y1, one.y1),
                x2: Math.max(all.x2, one.x2),
                y2: Math.max(all.y2, one.y2),
            }),
            { x1: Math.min(from.x, to.x), y1: Math.min(from.y, to.y), x2: Math.max(from.x, to.x), y2: Math.max(from.y, to.y) },
        );
        const out = lane * 0.9;
        bent([{ x: from.x, y: edge.y2 + out }, { x: to.x, y: edge.y2 + out }], 1.2);
        bent([{ x: from.x, y: edge.y1 - out }, { x: to.x, y: edge.y1 - out }], 1.2);
        bent([{ x: edge.x1 - out, y: from.y }, { x: edge.x1 - out, y: to.y }], 1.2);
        bent([{ x: edge.x2 + out, y: from.y }, { x: edge.x2 + out, y: to.y }], 1.2);
    }

    candidates.sort((a, b) => a.cost - b.cost);
    return candidates[0].route;
}


/* ============================================================
 * 7. 席の格子で、組を詰めて並べる
 * ============================================================ */

/**
 * 組を、席の格子の上に詰めて並べる。
 *
 * ★ 目指すのは、紙の人物相関図。
 *   組は四角い枠で、枠どうしはほとんど隙間なく並ぶ。
 *   枠の中の人は、行と列にきちんと並ぶ。
 *   どこにも入らない人（主人公のまわり）は真ん中。
 *
 * ★ 作り方。
 *   1. 組ごとに、中の人を行と列に並べた「かたまり」を作る
 *      ・内側の組は、外側の組の中に一かたまりで入れる
 *      ・外側の組だけの人は、内側の組の横に並べる（縦に積むと間が空く）
 *      ・掛け持ちの人がいる組どうしは横につなぎ、その人のところで枠が重なる
 *   2. 真ん中に、どこにも入らない人を置く
 *   3. 大きいかたまりから順に、真ん中にいちばん近くて、
 *      ほかと一目あけて置ける場所に置く。関係のある人の近くを選ぶ
 */
function packGrid(options: {
    ids: string[];
    groups: FoundGroup[];
    gap: number;
    width: number;
    height: number;
    aspect: number;
    links: { a: string; b: string }[];
    /** 図の真ん中に置く人（主人公） */
    hub?: string | null;
    shape?: "square" | "round";
}): Map<string, Point> {
    const { ids, groups, gap, width, height, aspect, links } = options;
    /*
     * ★ 行の間は、列の間より広く。
     *   丸の下に名前と役割が付くので、縦の線は名前のぶん短くなる。
     *   行が近いと、縦に結んだ線と関係名が押しつぶされた。
     */
    const cellX = gap * 1.0;
    const cellY = gap * 1.3;

    type Cell = { c: number; r: number };
    interface Block {
        cells: Map<string, Cell>;
        w: number;
        h: number;
    }

    const shown = new Set(ids);

    const live = groups
        .map((group) => ({ ...group, ids: group.ids.filter((id) => shown.has(id)) }))
        .filter((group) => group.ids.length > 0);

    const byKey = new Map(live.map((group) => [group.key, group]));
    const nest = nestingOf(live);

    const parentOf = new Map<string, string | null>();
    for (const group of live) {
        const parents = (nest.get(group.key)?.parents ?? [])
            .map((key) => byKey.get(key)!)
            .sort((a, b) => a.ids.length - b.ids.length);
        parentOf.set(group.key, parents[0]?.key ?? null);
    }

    const childrenOf = new Map<string, typeof live>();
    for (const group of live) {
        const parent = parentOf.get(group.key);
        if (!parent) continue;
        childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), group]);
    }

    const tops = live.filter((group) => !parentOf.get(group.key));

    const topsOf = new Map<string, string[]>();
    for (const top of tops) {
        for (const id of top.ids) topsOf.set(id, [...(topsOf.get(id) ?? []), top.key]);
    }

    const empty = (): Block => ({ cells: new Map(), w: 0, h: 0 });

    /* 行と列に並べる */
    const grid = (list: string[], cols: number, rows?: number): Block => {
        const block = empty();
        if (list.length === 0) return block;
        const c = Math.max(1, Math.min(cols, list.length));
        const h = Math.max(rows ?? 0, Math.ceil(list.length / c));
        /* 行の数が決まっているときは、縦に先に詰める */
        list.forEach((id, index) => {
            const cell = rows
                ? { c: Math.floor(index / h), r: index % h }
                : { c: index % c, r: Math.floor(index / c) };
            block.cells.set(id, cell);
        });
        block.w = rows ? Math.ceil(list.length / h) : c;
        block.h = h;
        return block;
    };

    const colsFor = (n: number, shape = 1.4) =>
        n <= 3 ? n : Math.ceil(Math.sqrt(n * shape));

    /* 横につなぐ。高さのちがうものは上下の真ん中にそろえる */
    const side = (blocks: Block[], space: number): Block => {
        const list = blocks.filter((one) => one.cells.size > 0);
        const out = empty();
        out.h = Math.max(0, ...list.map((one) => one.h));
        let x = 0;
        list.forEach((one, index) => {
            const dy = Math.floor((out.h - one.h) / 2);
            for (const [id, cell] of one.cells) out.cells.set(id, { c: cell.c + x, r: cell.r + dy });
            x += one.w + (index < list.length - 1 ? space : 0);
        });
        out.w = x;
        return out;
    };

    const blockOf = (key: string, free: Set<string>): Block => {
        const group = byKey.get(key)!;

        const kids: Block[] = [];
        for (const child of [...(childrenOf.get(key) ?? [])].sort((a, b) => b.ids.length - a.ids.length)) {
            const mine = new Set(child.ids.filter((id) => free.has(id)));
            if (mine.size === 0) continue;
            const inner = blockOf(child.key, mine);
            for (const id of inner.cells.keys()) free.delete(id);
            kids.push(inner);
        }

        const rest = group.ids.filter((id) => free.has(id));
        for (const id of rest) free.delete(id);

        if (kids.length === 0) return grid(rest, colsFor(rest.length));

        /* 内側の組どうしは、枠の間を一目あける */
        const inner = side(kids, 1);
        if (rest.length === 0) return inner;

        /*
         * 外側の組だけの人は、内側の組の横か下。四角に近くなるほう。
         * ★ 横なら内側の組と同じ高さで、下なら内側の組と同じ幅で並べる。
         */
        const beside = side([grid(rest, 1, Math.min(inner.h, rest.length)), inner], 0);

        const cols = Math.max(inner.w, Math.min(rest.length, colsFor(rest.length)));
        const below = grid(rest, cols);
        const stacked = empty();
        for (const [id, cell] of inner.cells) stacked.cells.set(id, { ...cell });
        const shift = Math.floor((Math.max(inner.w, below.w) - below.w) / 2);
        for (const [id, cell] of below.cells) {
            stacked.cells.set(id, { c: cell.c + shift, r: cell.r + inner.h });
        }
        stacked.w = Math.max(inner.w, below.w);
        stacked.h = inner.h + below.h;

        const size = (one: Block) => Math.max(one.w / 1.4, one.h) * 10 + one.w * one.h;
        return size(stacked) <= size(beside) ? stacked : beside;
    };

    /* 掛け持ちでつながる組をまとめる */
    const parent = new Map<string, string>();
    const root = (key: string): string => {
        const up = parent.get(key) ?? key;
        if (up === key) return key;
        const top = root(up);
        parent.set(key, top);
        return top;
    };
    for (const keys of topsOf.values()) {
        for (let i = 1; i < keys.length; i += 1) {
            const a = root(keys[0]);
            const b = root(keys[i]);
            if (a !== b) parent.set(b, a);
        }
    }
    const clusters = new Map<string, typeof tops>();
    for (const top of tops) {
        const key = root(top.key);
        clusters.set(key, [...(clusters.get(key) ?? []), top]);
    }

    const tiles: { key: string; block: Block }[] = [];

    for (const members of clusters.values()) {
        if (members.length === 1) {
            tiles.push({ key: members[0].key, block: blockOf(members[0].key, new Set(members[0].ids)) });
            continue;
        }

        const order: typeof tops = [];
        const left = [...members].sort((a, b) => b.ids.length - a.ids.length);
        order.push(left.shift()!);
        while (left.length > 0) {
            const last = new Set(order[order.length - 1].ids);
            const at = left.findIndex((group) => group.ids.some((id) => last.has(id)));
            order.push(left.splice(at >= 0 ? at : 0, 1)[0]);
        }

        const taken = new Set<string>();
        const parts: Block[] = [];

        order.forEach((group, index) => {
            const own = new Set(
                group.ids.filter((id) => !taken.has(id) && (topsOf.get(id) ?? []).length === 1),
            );
            if (own.size > 0) {
                const block = blockOf(group.key, own);
                for (const id of block.cells.keys()) taken.add(id);
                parts.push(block);
            }

            const next = order[index + 1];
            if (next) {
                const nextIds = new Set(next.ids);
                const shared = group.ids.filter((id) => !taken.has(id) && nextIds.has(id));
                if (shared.length > 0) {
                    for (const id of shared) taken.add(id);
                    parts.push(grid(shared, 1));
                }
            }
        });

        const stray = members
            .flatMap((group) => group.ids)
            .filter((id, index, all) => all.indexOf(id) === index && !taken.has(id));
        if (stray.length > 0) parts.push(grid(stray, 1));

        /* 掛け持ちの人の列で、二つの枠が重なる。間はあけない */
        tiles.push({ key: order[0].key, block: side(parts, 0) });
    }

    /* 真ん中の人 */
    const middle = ids.filter((id) => !topsOf.has(id));
    const core = grid(middle, colsFor(middle.length, 1.3));

    /* ============ 置いていく ============ */
    const partners = new Map<string, string[]>();
    for (const { a, b } of links) {
        partners.set(a, [...(partners.get(a) ?? []), b]);
        partners.set(b, [...(partners.get(b) ?? []), a]);
    }

    const sorted = [...tiles].sort((a, b) => b.block.cells.size - a.block.cells.size);

    /*
     * ============================================================
     * 主人公を、図の真ん中に
     *
     * ★ 主人公のいる場所を、置き始めの点（0, 0）にする。
     *   ほかのものは、そこからの近さで置いていく。
     *
     *   どこにも入らない人なら、真ん中の人たちの、さらに真ん中の席へ。
     *   組に入っている人なら、その組を真ん中に置き、
     *   どこにも入らない人たちも一かたまりとして、そのまわりに置く。
     * ============================================================
     */
    const hub = options.hub && shown.has(options.hub) ? options.hub : null;

    if (hub && core.cells.has(hub)) {
        const mid = { c: Math.floor((core.w - 1) / 2), r: Math.floor((core.h - 1) / 2) };
        const sitting = [...core.cells].find(([, cell]) => cell.c === mid.c && cell.r === mid.r)?.[0];
        const mine = core.cells.get(hub)!;
        if (sitting && sitting !== hub) core.cells.set(sitting, mine);
        core.cells.set(hub, mid);
    }

    const hubTile = hub ? tiles.find((tile) => tile.block.cells.has(hub)) : undefined;

    /* 真ん中に置くかたまりと、その中での主人公の席 */
    const first = hubTile ? { key: hubTile.key, block: hubTile.block } : { key: "__core__", block: core };
    const firstAt = hub
        ? (() => {
              const cell = first.block.cells.get(hub)!;
              return { c: -cell.c, r: -cell.r };
          })()
        : { c: -Math.floor(core.w / 2), r: -Math.floor(core.h / 2) };

    const around = hubTile
        ? [
              ...sorted.filter((tile) => tile !== hubTile),
              ...(core.cells.size > 0 ? [{ key: "__core__", block: core }] : []),
          ].sort((a, b) => b.block.cells.size - a.block.cells.size)
        : sorted;

    const placeAll = (growW: number, pullW: number, centerW: number) => {
    const where = new Map<string, Cell>();
    /* 置いた目。組の枠のぶんは、枠の中の空きも埋まっているとみなす */
    const filled = new Map<string, string>();
    const mark = (c: number, r: number, body: string) => filled.set(`${c},${r}`, body);

    for (const [id, cell] of first.block.cells) {
        where.set(id, { c: cell.c + firstAt.c, r: cell.r + firstAt.r });
        if (first.key === "__core__") mark(cell.c + firstAt.c, cell.r + firstAt.r, "__core__");
    }
    if (first.key !== "__core__") {
        for (let c = firstAt.c; c < firstAt.c + first.block.w; c += 1) {
            for (let r = firstAt.r; r < firstAt.r + first.block.h; r += 1) mark(c, r, first.key);
        }
    }

    for (const { key, block } of around) {
        let best: { c: number; r: number; score: number } | null = null;

        const fits = (dc: number, dr: number) => {
            for (let c = dc - 1; c <= dc + block.w; c += 1) {
                for (let r = dr - 1; r <= dr + block.h; r += 1) {
                    const hit = filled.get(`${c},${r}`);
                    if (hit && hit !== key) return false;
                }
            }
            return true;
        };

        /* 関係のある、もう置いた人 */
        const pulls: Cell[] = [];
        const own = new Set(block.cells.keys());
        for (const id of own) {
            for (const other of partners.get(id) ?? []) {
                if (own.has(other)) continue;
                const at = where.get(other);
                if (at) pulls.push(at);
            }
        }
        /* 組織そのものと結ばれた線（組→真ん中の人）も引き寄せる */
        for (const other of partners.get(key) ?? []) {
            const at = where.get(other);
            if (at) pulls.push(at);
        }

        /*
         * ★ 全体の四角が、なるべく大きくならない場所。
         *   真ん中からの近さだけで選ぶと、組のまわりに空きが残った。
         *   いまの全体の四角の中の空きを先に埋めると、紙の相関図のように詰まる。
         * ★ 全体の形は、枠の形（横長）に近いほうがよい。
         */
        const bx1 = Math.min(...[...filled.keys()].map((k) => Number(k.split(",")[0])));
        const bx2 = Math.max(...[...filled.keys()].map((k) => Number(k.split(",")[0])));
        const by1 = Math.min(...[...filled.keys()].map((k) => Number(k.split(",")[1])));
        const by2 = Math.max(...[...filled.keys()].map((k) => Number(k.split(",")[1])));
        const hasAny = filled.size > 0;

        const R = 24;
        for (let dr = -R; dr <= R; dr += 1) {
            for (let dc = -R; dc <= R; dc += 1) {
                const midC = dc + block.w / 2;
                const midR = dr + block.h / 2;

                const nx1 = hasAny ? Math.min(bx1, dc) : dc;
                const nx2 = hasAny ? Math.max(bx2, dc + block.w - 1) : dc + block.w - 1;
                const ny1 = hasAny ? Math.min(by1, dr) : dr;
                const ny2 = hasAny ? Math.max(by2, dr + block.h - 1) : dr + block.h - 1;
                const nw = nx2 - nx1 + 1;
                const nh = ny2 - ny1 + 1;
                const before = hasAny ? (bx2 - bx1 + 1) * (by2 - by1 + 1) : 0;
                const grow = (nw * nh - before) / Math.max(1, block.w * block.h);

                let score =
                    grow * growW +
                    Math.abs(Math.log(nw / nh / aspect)) * 1.5 +
                    Math.hypot(midC / aspect, midR) * centerW;

                /*
                 * ★ 主人公がいるときは、全体の真ん中が主人公から離れないように。
                 *   片側にばかり積むと、主人公が図の端に寄った。
                 */
                if (hub) {
                    score += Math.hypot((nx1 + nx2) / 2 / aspect, (ny1 + ny2) / 2) * 0.4;
                }

                if (pulls.length > 0) {
                    const pull =
                        pulls.reduce(
                            (sum, one) => sum + Math.hypot(one.c - midC, one.r - midR),
                            0,
                        ) / pulls.length;
                    score += pull * pullW;
                }

                if (best && score >= best.score) continue;
                if (!fits(dc, dr)) continue;
                best = { c: dc, r: dr, score };
            }
        }

        const at = best ?? { c: R + 2, r: 0 };
        for (const [id, cell] of block.cells) where.set(id, { c: cell.c + at.c, r: cell.r + at.r });
        for (let c = at.c; c < at.c + block.w; c += 1) {
            for (let r = at.r; r < at.r + block.h; r += 1) mark(c, r, key);
        }
    }

    return where;
    };

    /*
     * ★ 決め方の重みを何通りか試し、いちばん良いものを使う。
     *   良さ：枠（横長）に収めたときに大きく映る（外形が小さい）
     *         関係のある人どうしが近い
     *         真ん中の人たち（主人公のまわり）が、全体の真ん中にいる
     */
    let where = new Map<string, Cell>();
    let bestScore = Number.POSITIVE_INFINITY;

    /*
     * ============================================================
     * 丸型
     *
     * ★ 真ん中に一人（主人公）。まわりに輪を二重。
     *     内の輪  どこにも入らない人
     *     外の輪  組（囲みごと）
     * ★ 組は、結ばれている人のいる向きに置く。線が短く、交わりにくい。
     * ★ 輪の大きさは、隣どうしがぶつからない大きさまで広げる。
     * ============================================================
     */
    if (options.shape === "round") {
        /*
         * 行と列の目の比。輪が縦長にならないよう、縦の目に直すときに掛ける。
         * ★ 枠は横に広いので、輪は横長の楕円にする（横を 1.45 倍）。
         *   まん丸だと縦に長い図になり、枠に収めると小さく写った。
         */
        const squash = cellX / cellY;
        const stretch = 1.45;

        /* 真ん中の人。主人公、いなければ関係のいちばん多い人 */
        const degree = new Map<string, number>();
        for (const { a, b } of links) {
            degree.set(a, (degree.get(a) ?? 0) + 1);
            degree.set(b, (degree.get(b) ?? 0) + 1);
        }
        const center =
            hub ??
            [...ids].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0))[0] ??
            null;

        const ring = new Map<string, Cell>();
        const centerTile = center ? tiles.find((tile) => tile.block.cells.has(center)) : undefined;

        /* 真ん中 */
        let innerR = 0;
        if (centerTile && center) {
            const at = centerTile.block.cells.get(center)!;
            for (const [id, cell] of centerTile.block.cells) {
                ring.set(id, { c: cell.c - at.c, r: cell.r - at.r });
            }
            innerR = Math.hypot(centerTile.block.w, centerTile.block.h * (1 / squash)) / 2 + 1;
        } else if (center) {
            ring.set(center, { c: 0, r: 0 });
            innerR = 0.6;
        }

        /* 内の輪：どこにも入らない人 */
        const inner = middle.filter((id) => id !== center);
        /* 輪の上の人と人は、名前と関係名が入るよう一目半あける */
        const r1 =
            inner.length === 0
                ? innerR
                : Math.max(innerR + 1.1, (inner.length * 1.25) / (2 * Math.PI), 1.5);

        /* 真ん中の人と結ばれている人を、上から順に */
        inner.forEach((id, index) => {
            const angle = -Math.PI / 2 + (index / Math.max(1, inner.length)) * Math.PI * 2;
            ring.set(id, { c: Math.cos(angle) * r1 * stretch, r: Math.sin(angle) * r1 * squash });
        });

        /* 外の輪：組 */
        const outerTiles = tiles.filter((tile) => tile !== centerTile);

        /* 組ごとの向きの好み（結ばれている、もう置いた人の向き） */
        const pref = new Map<string, number>();
        outerTiles.forEach((tile, index) => {
            let sx = 0;
            let sy = 0;
            for (const id of [...tile.block.cells.keys(), tile.key]) {
                for (const { a, b } of links) {
                    const other = a === id ? b : b === id ? a : null;
                    if (!other || tile.block.cells.has(other)) continue;
                    const at = ring.get(other);
                    if (at) {
                        sx += at.c / stretch;
                        sy += at.r / squash;
                    }
                }
            }
            pref.set(
                tile.key,
                sx === 0 && sy === 0
                    ? -Math.PI / 2 + (index / Math.max(1, outerTiles.length)) * Math.PI * 2
                    : Math.atan2(sy, sx),
            );
        });

        const ordered = [...outerTiles].sort((a, b) => pref.get(a.key)! - pref.get(b.key)!);

        /* 各組の、輪に沿って要る幅（囲みと名札のぶん一目足す） */
        const span = (tile: (typeof tiles)[number]) =>
            Math.hypot(tile.block.w, tile.block.h / squash) + 1.2;

        /* 楕円の上で、向き θ のところの 1 ラジアンあたりの長さ（半径 1 のとき） */
        const arcAt = (theta: number) =>
            Math.sqrt(stretch * stretch * Math.sin(theta) ** 2 + Math.cos(theta) ** 2);

        /* 小さい輪から試して、重ならない大きさまで広げる */
        let r2 = r1 + 1.5;

        const put = (radius: number) => {
            const out = new Map(ring);
            const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

            /* 好みの向きに近いところから、順に置く。重なるなら次の向きへずらす */
            const needOf = (tile: (typeof tiles)[number]) =>
                span(tile) / (radius * arcAt(pref.get(tile.key)!));
            let angle = ordered.length > 0 ? pref.get(ordered[0].key)! - needOf(ordered[0]) / 2 : 0;
            for (const tile of ordered) {
                const need = needOf(tile);
                const wantMid = pref.get(tile.key)!;
                let mid = Math.max(angle + need / 2, wantMid);
                if (mid - need / 2 < angle) mid = angle + need / 2;
                angle = mid + need / 2;

                const cx = Math.cos(mid) * radius * stretch;
                const cy = Math.sin(mid) * radius * squash;
                const left = Math.round(cx - (tile.block.w - 1) / 2);
                const top = Math.round(cy - (tile.block.h - 1) / 2);
                boxes.push({ x1: left - 1, y1: top - 1, x2: left + tile.block.w, y2: top + tile.block.h });
                for (const [id, cell] of tile.block.cells) {
                    out.set(id, { c: cell.c + left, r: cell.r + top });
                }
            }

            /* 一周を超えた、または重なったら、失敗 */
            const first = ordered.length > 0 ? pref.get(ordered[0].key)! - needOf(ordered[0]) / 2 : 0;
            if (angle - first > Math.PI * 2 + 0.01) return null;
            for (let i = 0; i < boxes.length; i += 1) {
                for (let j = i + 1; j < boxes.length; j += 1) {
                    const a = boxes[i];
                    const b = boxes[j];
                    if (a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1) return null;
                }
                /* 内側の人に掛かっていないか */
                for (const cell of ring.values()) {
                    const a = boxes[i];
                    if (cell.c > a.x1 - 0.5 && cell.c < a.x2 + 0.5 && cell.r > a.y1 - 0.5 && cell.r < a.y2 + 0.5) {
                        return null;
                    }
                }
            }
            return out;
        };

        let placed: Map<string, Cell> | null = null;
        for (let tries = 0; tries < 120 && !placed; tries += 1) {
            placed = put(r2);
            if (!placed) r2 += 0.25;
        }

        where = placed ?? put(r2 + 10) ?? ring;
    } else
    for (const [growW, pullW, centerW] of [
        [0.6, 0.4, 0.3],
        [1.0, 0.2, 0.15],
        [0.6, 0.8, 0.3],
        [1.2, 0.4, 0.1],
        [0.3, 0.4, 0.5],
        [0.8, 0.6, 0.2],
    ]) {
        const trial = placeAll(growW, pullW, centerW);
        const cs = [...trial.values()];
        if (cs.length === 0) continue;
        const w = Math.max(...cs.map((one) => one.c)) - Math.min(...cs.map((one) => one.c)) + 2;
        const h = Math.max(...cs.map((one) => one.r)) - Math.min(...cs.map((one) => one.r)) + 2;
        const extent = Math.max(w / aspect, h);

        let linkSum = 0;
        let linkN = 0;
        for (const { a, b } of links) {
            const p = trial.get(a);
            const q = trial.get(b);
            if (!p || !q) continue;
            linkSum += Math.hypot(p.c - q.c, p.r - q.r);
            linkN += 1;
        }

        const midC = (Math.max(...cs.map((one) => one.c)) + Math.min(...cs.map((one) => one.c))) / 2;
        const midR = (Math.max(...cs.map((one) => one.r)) + Math.min(...cs.map((one) => one.r))) / 2;
        const coreAt = (hub ? [hub] : middle).map((id) => trial.get(id)!).filter(Boolean);
        const hubOff =
            coreAt.length > 0
                ? Math.hypot(
                      coreAt.reduce((sum, one) => sum + one.c, 0) / coreAt.length - midC,
                      coreAt.reduce((sum, one) => sum + one.r, 0) / coreAt.length - midR,
                  )
                : 0;

        /* 主人公がいるときは、真ん中にいることを重く見る */
        const score =
            extent + (linkN ? (linkSum / linkN) * 0.4 : 0) + hubOff * (hub ? 1.2 : 0.4);
        if (score < bestScore) {
            bestScore = score;
            where = trial;
        }
    }

    /* 紙の座標へ。全体の真ん中を紙の真ん中に */
    const cs = [...where.values()];
    const minC = Math.min(...cs.map((one) => one.c));
    const maxC = Math.max(...cs.map((one) => one.c));
    const minR = Math.min(...cs.map((one) => one.r));
    const maxR = Math.max(...cs.map((one) => one.r));
    const midC = (minC + maxC) / 2;
    const midR = (minR + maxR) / 2;

    const out = new Map<string, Point>();
    for (const [id, cell] of where) {
        out.set(id, {
            x: width / 2 + (cell.c - midC) * cellX,
            y: height / 2 + (cell.r - midR) * cellY,
        });
    }
    return out;
}
