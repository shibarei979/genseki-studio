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

import { useEffect, useState } from "react";

import EntryReport from "@/components/workspace/entry-report";
import ProBadge from "@/components/common/pro-badge";
import SceneSearch from "@/components/workspace/scene-search";
import { getRepository } from "@/lib/repository";
import { useMemberFeatures } from "@/lib/subscription/use-member-features";
import type { EntryMention, ResourceEntry, ResourcePage } from "@/types";

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
    const [keyword, setKeyword] = useState("");

    /*
     * ★ 報告書（会員）。
     *   開いている資料の id。null なら一覧を出す。
     *   会員でない人が押したときは、案内だけ出す。
     */
    const { entryReport } = useMemberFeatures();
    const [reportId, setReportId] = useState<string | null>(null);
    const [showLocked, setShowLocked] = useState(false);

    async function reload() {
        const repository = getRepository();
        setPages(await repository.listPages(workId));
        setEntries(await repository.listEntries(workId));
        setMentions(await repository.listMentions(workId, episodeId));
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

    for (const token of tokens) {
        const exact = searchable.find(
            (entry) => entry.name === token || entry.aliases.includes(token),
        );
        const partial = exact ?? searchable.find((entry) => entry.name.includes(token));

        if (partial) {
            if (!who.some((entry) => entry.id === partial.id)) who.push(partial);
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
    const listed =
        tokens.length >= 2
            ? who
            : [...matched, ...who.filter((entry) => !matched.some((one) => one.id === entry.id))];

    /*
     * ★ 名前を 1 つだけ打ったとき。
     *   資料の一覧の下に、その人が出てくる行を「第〇話 〇行」で並べる（Pro）。
     */
    const nameMode = tokens.length === 1 && who.length === 1 && what.length === 0;

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
                        />
                    </>
                ) : listed.length === 0 ? (
                    createBlock || (
                        <p className="px-2 py-4 text-xs text-faint">当てはまる資料がありません。</p>
                    )
                ) : (
                    <>
                    <ul>
                        {listed.map((entry) => (
                            <li key={entry.id} className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        /*
                                         * 押したら本文のその語へ飛ぶ。
                                         *
                                         * 選択中の文字があるときは、
                                         * これまでどおり資料と結びつける。
                                         */
                                        if (selection.trim()) {
                                            void handleLink(entry.id);
                                            return;
                                        }
                                        onJumpToWord?.(entry.name);
                                    }}
                                    title={
                                        selection.trim()
                                            ? "選んだ文字を、この資料に結びつけます"
                                            : "本文のこの語へ移動します"
                                    }
                                    className="min-w-0 flex-1 rounded-md px-3 py-2 text-left hover:bg-canvas"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="truncate text-[13px] text-ink">
                                            {entry.name}
                                        </span>
                                        <span className="shrink-0 rounded bg-forest-tint px-1.5 py-0.5 text-[10px] text-forest">
                                            {pageLabelById.get(entry.page_id) ?? "資料"}
                                        </span>
                                    </span>
                                    {entry.summary && (
                                        <span className="mt-0.5 block truncate text-xs text-muted">
                                            {entry.summary}
                                        </span>
                                    )}
                                </button>

                                {/*
                                  * ★ 報告書を開く。
                                  *   会員でない人にも押し具は見せる。
                                  *   押したら、会員で使えることを伝える。
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
                                    className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] text-muted hover:border-forest-line hover:text-forest"
                                >
                                    報告書
                                    <ProBadge />
                                </button>
                            </li>
                        ))}
                    </ul>

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
