/**
 * ============================================================
 * 原石航路 Studio
 * EpisodeIllustManager — 話の中の挿絵
 *
 * ★ 1 話に何枚でも置ける。
 *
 *   前は 1 枚だけ、本文の頭に固定だった。
 *   場面の変わり目に挟みたいという声があった。
 *
 * ★ 置き場所は、本文を見ながら選ぶ。
 *
 *   文と文のあいだに指を置くと線が出る。押すとそこに入る。
 *   蛍光ペンで資料に足すのと同じ触り心地にしてある。
 *
 * ★ 場所は「何文目の後ろか」で持つ。
 *
 *   行は画面の幅で変わる。文ならどこで見ても同じ場所を指す。
 *   0 は本文の頭。
 * ============================================================
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getRepository } from "@/lib/repository";
import { shrinkImage } from "@/lib/storage/image-store";
import { uploadImage } from "@/lib/storage/remote-image";
import { splitIntoSentences } from "@/lib/utils/sentences";
import type { EpisodeIllust } from "@/types";

interface Props {
    novelId: string;
    episodeId: string;
    /** いまの本文。置き場所を選ぶのに使う */
    body: string;
}


export default function EpisodeIllustManager({ novelId, episodeId, body }: Props) {
    const router = useRouter();

    const [illusts, setIllusts] = useState<EpisodeIllust[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");


    const sentences = splitIntoSentences(body);

    const reload = useCallback(async () => {
        try {
            setIllusts(await getRepository().listEpisodeIllusts(episodeId));
        } catch {
            /* 読めなくても、画面は出す */
        }
        setIsLoading(false);
    }, [episodeId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    async function handleUpload(file: File) {
        setBusy(true);
        setError("");

        try {
            /* 縮めてから上げる。そのままだと数 MB になる */
            const shrunk = await shrinkImage(file, true);
            const url = await uploadImage(shrunk, "illust");

            await getRepository().addEpisodeIllust({
                novelId,
                episodeId,
                url,
                isAi: false,
                /* はじめは本文の頭。置き場所はあとで選ぶ */
                afterSentence: 0,
                anchorText: "",
            });

            await reload();
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "上げられませんでした",
            );
        }

        setBusy(false);
    }

    async function handleDelete(illust: EpisodeIllust) {
        if (!window.confirm("この挿絵を外します。よろしいですか。")) return;
        await getRepository().deleteEpisodeIllust(illust.id);
        await reload();
    }

    async function handleAi(illust: EpisodeIllust, isAi: boolean) {
        await getRepository().setEpisodeIllustAi(illust.id, isAi);
        await reload();
    }

    /** その絵がいまどこに置かれているか、言葉にする */
    function placeLabel(illust: EpisodeIllust) {
        if (illust.after_sentence === 0) return "本文の頭";
        const text = (sentences[illust.after_sentence - 1] ?? "").trim();
        if (!text) return `${illust.after_sentence}文目の後ろ`;
        return `「${text.slice(0, 14)}${text.length > 14 ? "…" : ""}」の後ろ`;
    }

    return (
        <div>
            {isLoading ? (
                <p className="text-[11px] text-faint">読み込んでいます</p>
            ) : (
                <ul className="space-y-2">
                    {illusts.map((illust) => (
                        <li
                            key={illust.id}
                            className="flex items-start gap-3 rounded-lg border border-line p-2.5"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={illust.url}
                                alt=""
                                className="h-20 w-20 shrink-0 rounded-md border border-line object-cover"
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[11.5px] text-ink">
                                    {placeLabel(illust)}
                                </p>

                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {/*
                                      * ★ 本文そのものへ行く。
                                      *
                                      *   小窓に本文を写して選ばせていたが、
                                      *   本文とは別物に見えて分かりにくかった。
                                      *   蛍光ペンと同じく、執筆画面へ送る。
                                      */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                `/workspace/${novelId}?ep=${episodeId}` +
                                                    `&illust=${illust.id}` +
                                                    `&illustUrl=${encodeURIComponent(illust.url)}`,
                                            )
                                        }
                                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        置く場所を選ぶ
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(illust)}
                                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-[var(--color-danger)] hover:opacity-80"
                                    >
                                        外す
                                    </button>
                                </div>

                                <label className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted">
                                    <input
                                        type="checkbox"
                                        checked={illust.is_ai}
                                        onChange={(event) =>
                                            void handleAi(illust, event.target.checked)
                                        }
                                    />
                                    AI を使って作った絵
                                </label>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3">
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(file);
                        event.target.value = "";
                    }}
                    className="w-full text-[12px] text-muted"
                />
                <p className="mt-1.5 text-[11px] leading-[1.8] text-faint">
                    JPEG または PNG。上げたあと「置く場所を選ぶ」で、
                    本文のどこに入れるかを決められます。
                </p>

                {busy && <p className="mt-1 text-[11px] text-forest">上げています…</p>}
                {error && (
                    <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p>
                )}
            </div>

        </div>
    );
}
