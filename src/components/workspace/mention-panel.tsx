/**
 * ============================================================
 * 原石航路 Studio
 * MentionPanel — 本文から資料へのリンク
 *
 * 本文に記法を埋め込まない。リンクは別に持つ。
 * 本文を素のテキストのまま保てば、
 * 縦書き表示・書き出し・将来の投稿サイトへの転送が記法に縛られない。
 * ============================================================
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import EntryReport from "@/components/workspace/entry-report";
import ProBadge from "@/components/common/pro-badge";
import SceneSearch from "@/components/workspace/scene-search";
import { getRepository } from "@/lib/repository";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";
import type { Episode, EntryMention, ResourceEntry, ResourcePage } from "@/types";

interface Props {
    workId: string;
    episodeId: string;
    /** 本文で選択されている文字列 */
    selection: string;
    onClose: () => void;
    /**
     * 本文の中のその語へ飛ぶ。
     *
     * 資料を押したとき、結びつけるだけでなく
     * 本文のどこに出てくるかを見に行けるようにする。
     */
    onJumpToWord?: (word: string) => void;
}

export default function MentionPanel({ workId, episodeId, selection, onClose, onJumpToWord }: Props) {
    const [pages, setPages] = useState<ResourcePage[]>([]);
    const [entries, setEntries] = useState<ResourceEntry[]>([]);
    const [mentions, setMentions] = useState<EntryMention[]>([]);
    /* 本文。一覧の各行に「どこで使われたか」を添えるのに使う */
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [keyword, setKeyword] = useState("");

    /*
     * ★ 報告書（会員）。
     *   開いている資料の id。null なら一覧を出す。
     *   会員でない人が押したときは、案内だけ出す。
     */
    const { entryReport } = useMemberFeatures();
    const [reportId, setReportId] = useState<string | null>(null);
    const [showLocked, setShowLocked] = useState(false);
    /* 本文に出てこない資料を広げて見せるか */
    const [showUnused, setShowUnused] = useState(false);

    async function reload() {
        const repository = getRepository();
        setPages(await repository.listPages(workId));
        setEntries(await repository.listEntries(workId));
        setMentions(await repository.listMentions(workId, episodeId));
        try {
            setEpisodes(await repository.listEpisodes(workId));
        } catch {
            /* 読めなくても一覧は出す。使われた所が出ないだけ */
        }
    }

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workId, episodeId]);

    // 本文で選んだ言葉を検索語の初期値にする
    useEffect(() => {
        if (selection) setKeyword(selection);
    }, [selection]);

    const pageLabelById = new Map(pages.map((page) => [page.id, page.label]));
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    const searchable = entries.filter(
        (entry) => entry.candidate_status === "none" && entry.name,
    );
    const matched = keyword.trim()
        ? searchable.filter((entry) => entry.name.includes(keyword.trim()))
        : searchable;

    /*
     * ★ 打った言葉を「誰」と「何」に分ける。
     *
     *   「リオ 投げる」なら、リオが「誰」、投げるが「何」。
     *   資料の名前・別名に当たる言葉が「誰」、残りが「何」。
     *
     *   「何」があるときは、資料の一覧ではなく場面を探す。
     *   ・言葉が 2 つ以上
     *   ・言葉が 1 つで、どの資料にも当たらない
     */
    const tokens = keyword.trim().split(/[\s　]+/).filter((token) => token.length > 0);
    const who: ResourceEntry[] = [];
    const what: string[] = [];

    const typedFor: Record<string, string> = {};

    /*
     * ★ 「誰」を選ぶ順番。
     *
     *   「律」と打つと、「律はわたし」「律は」のような
     *   本文から拾われた用語まで名前に「律」を含む。
     *   前は最初に見つかったものを選んでいたので、人ではなく用語が選ばれていた。
     *
     *   1. 名前・別名がぴったり同じ
     *   2. 人物の資料
     *   3. 打った言葉で始まる名前
     *   4. 名前が短いもの（「律さん」＞「律さんは鉄パイプ」）
     */
    const pageKindById = new Map(pages.map((page) => [page.id, page.builtin_key]));
    function pickWho(token: string): ResourceEntry | null {
        const exact = searchable.find(
            (entry) => entry.name === token || entry.aliases.includes(token),
        );
        if (exact) return exact;

        /*
         * ★ 人物以外は、打った言葉で始まるときだけ「誰」にする。
         *   「律 叫ぶ」の「叫ぶ」が、用語の「律が叫ぶ」に吸われて
         *   「何」として探されなくなっていた。
         */
        const hits = searchable.filter((entry) => {
            const isPerson = pageKindById.get(entry.page_id) === "character";
            const names = [entry.name, ...entry.aliases];
            return isPerson
                ? names.some((name) => name.includes(token))
                : names.some((name) => name.startsWith(token));
        });
        if (hits.length === 0) return null;

        const score = (entry: ResourceEntry) =>
            (pageKindById.get(entry.page_id) === "character" ? 0 : 100) +
            (entry.name.startsWith(token) ? 0 : 10) +
            Math.min(entry.name.length, 9);

        return hits.slice().sort((a, b) => score(a) - score(b))[0];
    }

    for (const token of tokens) {
        const picked = pickWho(token);

        if (picked) {
            if (!who.some((entry) => entry.id === picked.id)) who.push(picked);
            typedFor[picked.id] = token;
        } else {
            what.push(token);
        }
    }

    const sceneMode =
        what.length > 0 && (tokens.length >= 2 || matched.length === 0);

    /*
     * 一覧に出すもの。
     * 「リオ エバ」のように名前だけを並べたときは、当たった資料を並べる。
     */
    /*
     * ★ 言葉が 1 つのときは、名前の一部に当たるものと、別名に当たるものを合わせる。
     *   前は名前だけを見ていたので、別名で打つと「資料にありません」と出ていた。
     */
    const listed = (
        tokens.length >= 2
            ? who
            : [...matched, ...who.filter((entry) => !matched.some((one) => one.id === entry.id))]
    )
        .slice()
        /*
         * ★ 人物を先に並べる。
         *   探しているのは、たいてい人。
         *   本文から拾われた用語が上に来ると、目当ての人が埋もれる。
         */
        .sort(
            (a, b) =>
                (pageKindById.get(a.page_id) === "character" ? 0 : 1) -
                (pageKindById.get(b.page_id) === "character" ? 0 : 1),
        );

    /*
     * ★ 名前を 1 つだけ打ったとき。
     *   資料の一覧の下に、その人が出てくる行を「第〇話 〇行」で並べる（Pro）。
     */
    const nameMode = tokens.length === 1 && who.length === 1 && what.length === 0;

    /*
     * ★ 一覧の各行に、本文で最初に使われた所を添える。
     *
     *   名前だけ並んでも、それが何話のどんな文で使われたのか分からない。
     *   本文から拾った候補だと、名前なのか文の切れ端なのかの見分けもつかない。
     *   「第3話 2行　律は窓の外を見ていた。」と出せば、残すか消すかも決めやすい。
     *
     * ★ 数えるのは画面に出す上から 30 件まで。
     *   何も打っていないと全部の資料が並ぶので、全部は数えない。
     */
    const firstUse = useMemo(() => {
        const map = new Map<
            string,
            { label: string; text: string; count: number; hit: string }
        >();
        const sorted = episodes.slice().sort((a, b) => a.ep_number - b.ep_number);
        const split = sorted.map((episode) => ({ episode, lines: (episode.body ?? "").split("\n") }));

        for (const entry of listed.slice(0, 30)) {
            const words = [entry.name, ...entry.aliases]
                .map((word) => word.trim())
                .filter((word) => word.length > 0);
            if (words.length === 0) continue;

            let found: { label: string; text: string; hit: string } | null = null;
            let count = 0;

            for (const { episode, lines } of split) {
                lines.forEach((line, index) => {
                    const hit = words.find((word) => line.includes(word));
                    if (!hit) return;
                    count += 1;
                    if (found) return;

                    /* 長い行は、当たった言葉の前後だけ */
                    const at = line.indexOf(hit);
                    const start = Math.max(0, at - 14);
                    const end = Math.min(line.length, at + hit.length + 30);
                    const text =
                        (start > 0 ? "…" : "") +
                        line.slice(start, end).trim() +
                        (end < line.length ? "…" : "");

                    found = { label: `第${episode.ep_number}話 ${index + 1}行`, text, hit };
                });
            }

            if (found) {
                const { label, text, hit } = found;
                map.set(entry.id, { label, text, count, hit });
            } else if (split.length > 0) {
                /* 本文に一度も出てこない。拾い損ねた切れ端などを見分ける手がかり */
                map.set(entry.id, { label: "", text: "", count: 0, hit: "" });
            }
        }

        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episodes, keyword, entries, pages]);

    /* 資料を足す案内。言葉が 1 つのときだけ。「リオ 投げる」という資料は作らない */
    const createBlock = tokens.length === 1 && (
        <div className="px-2 pb-1 pt-2">
            <p className="text-xs text-faint">
                「{tokens[0]}」は資料にありません。新しく作って結びつけられます。
            </p>
            <ul className="mt-2 flex flex-wrap gap-1">
                {pages
                    .filter((page) => page.kind === "entries")
                    .map((page) => (
                        <li key={page.id}>
                            <button
                                type="button"
                                onClick={() => void handleCreateAndLink(page.id)}
                                className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink hover:border-forest-line hover:text-forest"
                            >
                                {page.label}に追加
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    );

    async function handleLink(entryId: string) {
        const surface = selection.trim() || entryById.get(entryId)?.name || "";
        if (!surface) return;
        await getRepository().createMention(workId, episodeId, entryId, surface);
        await reload();
    }

    async function handleCreateAndLink(pageId: string) {
        const name = keyword.trim();
        if (!name) return;
        const repository = getRepository();
        const entry = await repository.createEntry(workId, pageId, { name });
        await repository.createMention(workId, episodeId, entry.id, selection.trim() || name);
        await reload();
    }

    /* 当たった言葉を目立たせる */
    function highlight(text: string, word: string) {
        if (!word) return text;
        const at = text.indexOf(word);
        if (at < 0) return text;
        return (
            <>
                {text.slice(0, at)}
                <mark className="rounded-sm bg-forest-tint px-0.5 font-medium text-forest">
                    {word}
                </mark>
                {text.slice(at + word.length)}
            </>
        );
    }

    /*
     * 一覧の 1 行。
     *
     * ★ 3 段に分ける。
     *   1 段目：名前と種類（いちばん大きく）
     *   2 段目：一言説明（薄く 1 行）
     *   3 段目：本文で最初に使われた所（話・行の札と、その文）
     *   前は全部が同じような小さな字で、どこを見ればよいか分からなかった。
     */
    function renderRow(entry: ResourceEntry, compact = false) {
        const use = firstUse.get(entry.id);

        return (
            /*
             * ★ 報告書の押し具は右上に重ねる。
             *   横に並べると、下の引用の枠が押し具のぶん細くなり、
             *   狭い欄では 1 行に数文字しか入らなかった。
             */
            <li key={entry.id} className="relative px-1 py-1.5">
                <button
                    type="button"
                    onClick={() => {
                        /*
                         * 押したら本文のその語へ飛ぶ。
                         * 選択中の文字があるときは、これまでどおり資料と結びつける。
                         */
                        if (selection.trim()) {
                            void handleLink(entry.id);
                            return;
                        }
                        onJumpToWord?.(use?.hit || entry.name);
                    }}
                    title={
                        selection.trim()
                            ? "選んだ文字を、この資料に結びつけます"
                            : "本文のこの語へ移動します"
                    }
                    className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-canvas"
                >
                    <span className="flex items-center gap-1.5 pr-[5.5rem]">
                        <span
                            className={[
                                "truncate text-ink",
                                compact ? "text-[12.5px]" : "text-[13.5px] font-medium",
                            ].join(" ")}
                        >
                            {entry.name}
                        </span>
                        <span className="shrink-0 rounded bg-forest-tint px-1.5 py-px text-[10px] text-forest">
                            {pageLabelById.get(entry.page_id) ?? "資料"}
                        </span>
                    </span>

                    {!compact && entry.summary && (
                        <span className="mt-0.5 block truncate pr-[5.5rem] text-[11.5px] text-muted">
                            {entry.summary}
                        </span>
                    )}

                    {!compact && use && use.count > 0 && (
                        <span className="mt-1.5 block rounded-md border-l-2 border-forest-line bg-canvas px-2 py-1.5">
                            <span className="flex items-center gap-1.5 text-[10.5px]">
                                <span className="rounded border border-line bg-surface px-1.5 py-px text-muted">
                                    {use.label}
                                </span>
                                {use.count > 1 && (
                                    <span className="text-faint">ほか{use.count - 1}か所</span>
                                )}
                            </span>
                            <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-ink">
                                {highlight(use.text, use.hit)}
                            </span>
                        </span>
                    )}
                </button>

                {/*
                  * ★ 報告書を開く。
                  *   会員でない人にも押し具は見せる。押したら、会員で使えることを伝える。
                  */}
                <button
                    type="button"
                    onClick={() => {
                        if (entryReport) {
                            setReportId(entry.id);
                            setShowLocked(false);
                        } else {
                            setShowLocked(true);
                        }
                    }}
                    title="この資料を報告書の形で見る"
                    className="absolute right-2 top-2.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] text-muted hover:border-forest-line hover:text-forest"
                >
                    報告書
                    <ProBadge />
                </button>
            </li>
        );
    }

    return (
        <div
            className={[
                "flex h-full w-full shrink-0 flex-col rounded-lg border border-line bg-surface",
                /* 報告書は中身が多いので、少し広げる */
                reportId ? "lg:w-[400px]" : "lg:w-[320px]",
            ].join(" ")}
        >
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <h2 className="text-[13px] font-medium text-ink">資料へのリンク</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className="px-1 text-[13px] text-faint hover:text-ink"
                >
                    ✕
                </button>
            </div>

            {reportId ? (
                <EntryReport
                    workId={workId}
                    entryId={reportId}
                    episodeId={episodeId}
                    onBack={() => setReportId(null)}
                    onJumpToWord={onJumpToWord}
                />
            ) : (
            <>
            <div className="border-b border-line px-3.5 py-2.5">
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="名前や言葉を入力（例：リオ 投げる）"
                    aria-label="資料を探す"
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[13px] outline-none focus:border-forest"
                />
                {selection && (
                    <p className="mt-1.5 text-xs text-forest">
                        本文で「{selection.slice(0, 20)}」を選択中
                    </p>
                )}
            </div>

            {/* 押した所の近くに出す。一覧の上 */}
            {showLocked && (
                <div className="mx-3 mt-2 rounded-md border border-forest-line bg-forest-tint px-3 py-2">
                    <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-forest">
                            報告書は<ProBadge className="mx-0.5" />の機能です。サブスクに入ると使えます。
                            <br />
                            <span className="text-[11px] text-muted">
                                設定・初登場と最後の登場・関係・まだ書いていない欄を、1枚にまとめて見られます。
                            </span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowLocked(false)}
                            aria-label="閉じる"
                            className="shrink-0 text-[11px] text-faint hover:text-ink"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {sceneMode ? (
                    <>
                        {createBlock}
                        {tokens.length === 1 && <div className="mx-2 my-2 border-t border-line" />}
                        <SceneSearch
                            workId={workId}
                            episodeId={episodeId}
                            who={who}
                            what={what}
                            pages={pages}
                            locked={!entryReport}
                            onJumpToWord={onJumpToWord}
                            onOpenReport={(entryId) => setReportId(entryId)}
                                    typedFor={typedFor}
                        />
                    </>
                ) : listed.length === 0 ? (
                    createBlock || (
                        <p className="px-2 py-4 text-xs text-faint">当てはまる資料がありません。</p>
                    )
                ) : (
                    <>
                    {(() => {
                        /*
                         * ★ 本文に出てこない資料は、下にまとめて畳む。
                         *   本文から拾った切れ端（「律は」「律も」）が
                         *   目当ての人のあいだに挟まって、一覧が読みにくかった。
                         */
                        const used = listed.filter((entry) => firstUse.get(entry.id)?.count !== 0);
                        const unused = listed.filter((entry) => firstUse.get(entry.id)?.count === 0);

                        return (
                            <>
                                {used.length > 0 && (
                                    <p className="px-2.5 pb-1 pt-0.5 text-[10.5px] text-faint">
                                        資料 {used.length}件
                                    </p>
                                )}
                                <ul className="divide-y divide-line">
                                    {used.map((entry) => renderRow(entry))}
                                </ul>

                                {unused.length > 0 && (
                                    <div className="mt-1 border-t border-line pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowUnused((on) => !on)}
                                            aria-expanded={showUnused}
                                            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[11px] text-muted hover:bg-canvas"
                                        >
                                            <span className="w-3 text-faint">{showUnused ? "▾" : "▸"}</span>
                                            本文に出てこない資料
                                            <span className="text-faint">{unused.length}件</span>
                                        </button>
                                        {showUnused && (
                                            <>
                                                <p className="px-2.5 pb-1 text-[10.5px] leading-relaxed text-faint">
                                                    本文から拾った言葉の切れ端かもしれません。要らなければ資料から消せます。
                                                </p>
                                                <ul className="divide-y divide-line">
                                                    {unused.map((entry) => renderRow(entry, true))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        );
                    })()}

                    {nameMode && (
                        entryReport ? (
                            <>
                                <div className="mx-2 my-2 border-t border-line" />
                                <SceneSearch
                                    workId={workId}
                                    episodeId={episodeId}
                                    who={who}
                                    what={[]}
                                    pages={pages}
                                    locked={false}
                                    onJumpToWord={onJumpToWord}
                                    onOpenReport={(entryId) => setReportId(entryId)}
                                    typedFor={typedFor}
                                />
                            </>
                        ) : (
                            <p className="mx-2 mt-3 border-t border-line px-1 pt-2.5 text-[11px] leading-relaxed text-faint">
                                <ProBadge className="mr-1" />
                                なら、この人が出てくる行を「第〇話 〇行」で全話から並べます。
                            </p>
                        )
                    )}
                    </>
                )}
            </div>

            <div className="border-t border-line px-3.5 py-2.5">
                <p className="text-xs text-muted">この話のリンク（{mentions.length}件）</p>
                {mentions.length === 0 ? (
                    <p className="mt-1.5 text-xs text-faint">まだありません。</p>
                ) : (
                    <ul className="thin-scroll mt-2 max-h-32 space-y-1 overflow-y-auto">
                        {mentions.map((mention) => {
                            const entry = entryById.get(mention.entry_id);
                            return (
                                <li
                                    key={mention.id}
                                    className="group flex items-center gap-2 text-xs"
                                >
                                    <span className="min-w-0 flex-1 truncate text-ink">
                                        {mention.surface}
                                        {entry && entry.name !== mention.surface && (
                                            <span className="text-faint"> → {entry.name}</span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await getRepository().deleteMention(mention.id);
                                            await reload();
                                        }}
                                        aria-label="このリンクを外す"
                                        className="shrink-0 text-faint opacity-0 hover:text-ink group-hover:opacity-100"
                                    >
                                        ✕
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            </>
            )}
        </div>
    );
}
