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

import { getRepository } from "@/lib/repository";
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
        <div className="flex h-full w-full shrink-0 flex-col rounded-lg border border-line bg-surface lg:w-[320px]">
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

            <div className="border-b border-line px-3.5 py-2.5">
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="本文で言葉を選ぶか、ここに入力"
                    aria-label="資料を探す"
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[13px] outline-none focus:border-forest"
                />
                {selection && (
                    <p className="mt-1.5 text-xs text-forest">
                        本文で「{selection.slice(0, 20)}」を選択中
                    </p>
                )}
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {matched.length === 0 ? (
                    <div className="px-2 py-4">
                        <p className="text-xs text-faint">
                            当てはまる資料がありません。
                            {keyword.trim() && "新しく作って結びつけられます。"}
                        </p>
                        {keyword.trim() && (
                            <ul className="mt-3 space-y-1">
                                {pages
                                    .filter((page) => page.kind === "entries")
                                    .map((page) => (
                                        <li key={page.id}>
                                            <button
                                                type="button"
                                                onClick={() => void handleCreateAndLink(page.id)}
                                                className="w-full rounded-md border border-line px-3 py-1.5 text-left text-xs text-ink hover:border-forest-line hover:text-forest"
                                            >
                                                「{keyword.trim()}」を{page.label}に追加
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <ul>
                        {matched.map((entry) => (
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
                            </li>
                        ))}
                    </ul>
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
        </div>
    );
}
