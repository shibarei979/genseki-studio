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

import IconCropper from "@/components/mypage/icon-cropper";
import IllustRecommendEditor from "@/components/post/illust-recommend-editor";
import {
    ILLUST_SHAPE_LABEL,
    scaleOf,
    shapeOf,
} from "@/config/illust-size";
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
    /**
     * 本文の画面へ移る直前に呼ぶ。
     *
     * ★ 書きかけの設定を、先に控えてもらう。
     *   予約の日時などは押すまで表に入っていないので、
     *   そのまま移ると消えてしまう。
     */
    onBeforeLeave?: () => void;
}


export default function EpisodeIllustManager({ novelId, episodeId, body, onBeforeLeave }: Props) {
    const router = useRouter();

    const [illusts, setIllusts] = useState<EpisodeIllust[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    /*
     * 切り抜き待ちの絵。
     *
     * ★ 表紙と同じ道にする。
     *   上げる前に、出したい所だけを切り出せる。
     *   周りの白が広い絵は、それだけで小さく見える。
     */
    const [cropTarget, setCropTarget] = useState<File | null>(null);

    /* すすめる見せ方を決めている絵 */
    const [recTarget, setRecTarget] = useState<EpisodeIllust | null>(null);
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

    async function handleUpload(file: Blob) {
        setBusy(true);
        setError("");

        try {
            /*
             * ★ 画質を落とさない。
             *
             *   小さくて軽い絵は、元のまま上げる。
             *   描き直すと、線画や字の輪郭が甘くなる。
             *   大きすぎるものだけ縮める。
             */
            const shrunk = await shrinkImage(file as File, true, true);
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

    /** 絵ごとの大きさを決める。空にすると読む人の設定に従う */
    async function handleSize(
        illust: EpisodeIllust,
        size: string | null,
    ) {
        await getRepository().setEpisodeIllustSize(illust.id, size);
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
                            {/*
                              * ★ 切らずに、全体を出す。
                              *
                              *   前は 80×80 の四角に切っていた。
                              *   横長の絵は左右が落ち、
                              *   どんな絵だったか分からなくなる。
                              *
                              *   置き場所や大きさを決める画面なので、
                              *   絵の形が分からないと決められない。
                              */}
                            <img
                                src={illust.url}
                                alt=""
                                className="h-20 w-28 shrink-0 rounded-md border border-line bg-canvas object-contain"
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
                                        onClick={() => {
                                            onBeforeLeave?.();
                                            router.push(
                                                `/workspace/${novelId}?ep=${episodeId}` +
                                                    `&illust=${illust.id}` +
                                                    `&illustUrl=${encodeURIComponent(illust.url)}`,
                                            );
                                        }}
                                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        置く場所を選ぶ
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRecTarget(illust)}
                                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-muted hover:border-forest-line hover:text-forest"
                                    >
                                        {illust.rec_width ? "すすめる見せ方を直す" : "すすめる見せ方を決める"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(illust)}
                                        className="rounded border border-line px-2 py-0.5 text-[10.5px] text-[var(--color-danger)] hover:opacity-80"
                                    >
                                        外す
                                    </button>
                                </div>

                                {/*
                                  * 形と大きさ。
                                  *
                                  * ★ 形が、どこまで伸ばせるかを決める。
                                  *
                                  *     縦長    高く取れる。幅は狭い
                                  *     正方形  どちらも中くらい
                                  *     横長    幅いっぱい。高さは抑える
                                  *
                                  * ★ つまみで、そこから狭める。
                                  *
                                  *   いちばん右が、その形で入るいちばん大きい状態。
                                  *   絵は切らない。縦横比も変えない。
                                  *
                                  * ★ 前は小・中・大だった。
                                  *   どれも高さで止めていたので、絵の形によって
                                  *   「いちばん大きい」が変わってしまった。
                                  */}
                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                    <span className="text-[10.5px] text-faint">形</span>

                                    {([null, "tall", "square", "wide"] as const).map((key) => (
                                        <button
                                            key={key ?? "auto"}
                                            type="button"
                                            onClick={() =>
                                                void handleSize(
                                                    illust,
                                                    key
                                                        ? `${key}:${scaleOf(illust.size)}`
                                                        : null,
                                                )
                                            }
                                            className={[
                                                "rounded border px-2 py-0.5 text-[10.5px]",
                                                (illust.size
                                                    ? shapeOf(String(illust.size).split(":")[0])
                                                    : null) === key
                                                    ? "border-forest bg-forest-tint text-forest"
                                                    : "border-line text-muted hover:border-forest-line",
                                            ].join(" ")}
                                        >
                                            {key ? ILLUST_SHAPE_LABEL[key] : "おまかせ"}
                                        </button>
                                    ))}
                                </div>

                                {illust.size && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className="text-[10.5px] text-faint">
                                            大きさ
                                        </span>

                                        <input
                                            type="range"
                                            min={10}
                                            max={100}
                                            step={5}
                                            value={scaleOf(illust.size)}
                                            onChange={(e) =>
                                                void handleSize(
                                                    illust,
                                                    `${shapeOf(String(illust.size).split(":")[0])}:${e.target.value}`,
                                                )
                                            }
                                            aria-label="挿絵の大きさ"
                                            className="w-32 accent-[var(--color-forest)]"
                                        />

                                        <span className="w-9 text-[10px] text-faint">
                                            {scaleOf(illust.size)}%
                                        </span>
                                    </div>
                                )}

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

                        /* そのまま上げず、切り抜きへ */
                        if (file) setCropTarget(file);
                        event.target.value = "";

                        /*
                         * ★ 焦点を外す。
                         *
                         *   選び終えたあとも、この押し具に焦点が残る。
                         *   切り抜きの窓を閉じると焦点が戻り、
                         *   Enter や space を押すたびに窓が開き直していた。
                         *   「何度も勝手に開く」はこれ。
                         */
                        event.target.blur();
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

            {recTarget && (
                <IllustRecommendEditor
                    url={recTarget.url}
                    body={body}
                    afterSentence={recTarget.after_sentence}
                    value={
                        recTarget.rec_width
                            ? { width: recTarget.rec_width, align: recTarget.rec_align ?? 0 }
                            : null
                    }
                    onSave={async (rec) => {
                        await getRepository().setEpisodeIllustRecommend(recTarget.id, rec);
                        await reload();
                    }}
                    onClose={() => setRecTarget(null)}
                />
            )}

            {cropTarget && (
                <IconCropper
                    file={cropTarget}
                    shape="rect"
                    title="挿絵を切り抜く"
                    /* はじめは横長。窓の中で縦長・正方形にも変えられる */
                    aspect={1.6}
                    /*
                     * ★ 挿絵は大きく書き出す。
                     *   既定の 400px だと、そこが天井になって荒れる。
                     * ★ 形は絵に合わせて選ぶ。
                     *   線画や字は png で、1 ドットも変えずに書き出す。
                     *   写真は webp。png だと桁違いに重くなる。
                     */
                    outputSize={1600}
                    mime="auto"
                    quality={0.95}
                    onCancel={() => setCropTarget(null)}
                    onSkip={() => {
                        const file = cropTarget;
                        setCropTarget(null);
                        if (file) void handleUpload(file);
                    }}
                    onDone={(blob) => {
                        setCropTarget(null);
                        void handleUpload(blob);
                    }}
                />
            )}
        </div>
    );
}
