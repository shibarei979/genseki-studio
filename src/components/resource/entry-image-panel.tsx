/**
 * ============================================================
 * 原石航路 Studio
 * EntryImagePanel — 資料の画像
 *
 * 3 つの道がある。
 *   1. 文章で頼んで作らせる（1 作品 3 枚まで）
 *   2. 自分で用意した画像を貼る（何枚でも）
 *   3. 何も置かない
 *
 * 上限を設けているのは、画像づくりが 1 枚ごとに費用がかかるため。
 * 上限を超えたら、自分で作った画像を貼る道が残る。
 * ============================================================
 */

"use client";

import { useRef, useState } from "react";

import EntryImage from "@/components/common/entry-image";
import { findRealPlaces, MAP_ERA_LABEL } from "@/lib/ai/real-places";
import type { MapEra } from "@/lib/ai/real-places";
import { deleteImage, putImage, shrinkImage } from "@/lib/storage/image-store";
import type { ImageStyle } from "@/types";
import { IMAGE_QUOTA } from "@/types";

/**
 * 作風ごとの、頼み方の例。
 *
 * 短い指示ほど、ありきたりな絵が返る。
 * 何を書けばよいかを見せておくと、書き手も書きやすい。
 */
const HINT_EXAMPLE: Record<ImageStyle, string> = {
    portrait:
        "20代半ばの男。癖のある黒髪を後ろで束ねている。" +
        "灰緑の外套に革の肩当て。目つきは鋭いが表情は乏しい。",
    scene:
        "朝もやの湖畔。対岸に朽ちかけた石造りの塔。" +
        "手前は葦の茂る浅瀬。空は薄曇りで、光は弱い。",
    crest:
        "翼を広げた獅子。中央に縦に割れた盾。" +
        "深い藍と鈍い金。上部に三つの星。",
    icon: "六角形の結晶。内側に細い罅。淡い青の光を放つ。台座は黒鉄。",
    map:
        "中央に細長い湖。北岸に雪を頂く山脈が東西に走る。" +
        "南は入り江の多い海岸線。湖の南端に城下町、" +
        "そこから東西へ街道が伸びる。",
};

/** 何を書けば具体的になるか */
const HINT_POINTS: Record<ImageStyle, string[]> = {
    portrait: ["年頃と体つき", "髪と目", "服装と持ち物", "表情や佇まい"],
    scene: ["時刻と天気", "手前と奥にあるもの", "季節", "人の気配の有無"],
    crest: ["中心に置く生き物や図形", "色は2〜3色", "囲みの形", "添える印"],
    icon: ["形", "材質", "色", "光や動きの有無"],
    map: ["海・山・川の位置", "町の数と場所", "街道や航路", "全体の広さ"],
};

interface Props {
    style: ImageStyle;
    name: string;
    imageUrl: string | null;
    /** 作品全体で作った枚数 */
    usedCount: number;
    canGenerate: boolean;
    onGenerate: (hint: string, era: MapEra) => Promise<void>;
    onChange: (imageUrl: string | null) => void;
}

export default function EntryImagePanel({
    style,
    name,
    imageUrl,
    usedCount,
    canGenerate,
    onGenerate,
    onChange,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [hint, setHint] = useState("");
    /** 地図のときだけ使う。時代で地図の見た目は大きく変わる */
    const [era, setEra] = useState<MapEra>("unset");
    const [isBusy, setIsBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const remaining = Math.max(0, IMAGE_QUOTA - usedCount);
    const isWide = style === "map";

    /*
     * 実在の地名が含まれるかを、入力しながら見る。
     * 含まれるなら実際の地形に沿わせると伝えておく。
     * 描かれてから「違う」となるより先に分かるほうがよい。
     */
    const realPlaces = isWide ? findRealPlaces(name, hint) : [];

    async function handleGenerate() {
        if (remaining === 0 || !name.trim()) return;
        setIsBusy(true);
        setNotice("");
        await onGenerate(hint.trim(), era);
        setIsBusy(false);
        setIsOpen(false);
        setHint("");
    }

    async function handleUpload(file: File | undefined) {
        if (!file) return;
        setIsBusy(true);
        setNotice("");
        try {
            const shrunk = await shrinkImage(file);
            const ref = await putImage(shrunk);
            if (imageUrl) await deleteImage(imageUrl);
            onChange(ref);
            setIsOpen(false);
        } catch {
            setNotice("この画像は読み込めませんでした。");
        } finally {
            setIsBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    return (
        <div className="rounded-md border border-line bg-canvas p-3">
            <div className={isWide ? "space-y-3" : "flex items-start gap-3"}>
                <EntryImage
                    src={imageUrl}
                    fallback={Array.from(name)[0] ?? "?"}
                    className={
                        isWide
                            ? "aspect-[3/2] w-full rounded-md border border-line object-cover"
                            : "h-16 w-16 shrink-0 rounded-md object-cover"
                    }
                />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => setIsOpen((open) => !open)}
                            disabled={isBusy}
                            className="rounded-md border border-forest-line px-3 py-1.5 text-xs text-forest hover:bg-forest-tint disabled:opacity-40"
                        >
                            {isBusy ? "処理しています…" : imageUrl ? "変更する" : "画像を置く"}
                        </button>

                        {imageUrl && (
                            <button
                                type="button"
                                onClick={async () => {
                                    await deleteImage(imageUrl);
                                    onChange(null);
                                }}
                                className="rounded-md px-2.5 py-1.5 text-xs text-faint hover:text-ink"
                            >
                                外す
                            </button>
                        )}
                    </div>

                    <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                        自分で用意した画像はいくつでも貼れます。
                        <br />
                        AIに描かせられるのは、この作品であと{remaining}枚です。
                    </p>
                </div>
            </div>

            {isOpen && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                    {/* 自分の画像 */}
                    <div>
                        <p className="text-xs font-medium text-ink">自分の画像を貼る</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={(e) => void handleUpload(e.target.files?.[0])}
                            className="hidden"
                            id={`upload-${name}`}
                        />
                        <label
                            htmlFor={`upload-${name}`}
                            className="mt-1.5 inline-block cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:border-forest-line hover:text-forest"
                        >
                            ファイルを選ぶ
                        </label>
                        <p className="mt-1 text-[10px] text-faint">
                            長辺900pxに縮めて保存します。回数の制限はありません。
                        </p>
                    </div>

                    {/* AIに描かせる */}
                    <div className="border-t border-line pt-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs font-medium text-ink">AIに描かせる</p>
                            <span
                                className={[
                                    "text-[10px]",
                                    remaining === 0 ? "text-[var(--color-amber)]" : "text-faint",
                                ].join(" ")}
                            >
                                残り {remaining} / {IMAGE_QUOTA} 枚
                            </span>
                        </div>

                        {remaining === 0 ? (
                            <p className="mt-1.5 rounded-md bg-[var(--color-amber-tint)] px-3 py-2 text-[11px] leading-relaxed text-ink">
                                この作品で作れる枚数を使い切りました。
                                自分で用意した画像は、引き続き貼れます。
                            </p>
                        ) : !canGenerate ? (
                            <p className="mt-1.5 text-[11px] text-faint">
                                設定でAI補助または図案づくりがオフになっています。
                            </p>
                        ) : (
                            <>
                                {isWide && (
                                    <div className="mt-1.5">
                                        <label
                                            htmlFor="map-era"
                                            className="block text-[11px] text-muted"
                                        >
                                            いつの時代か
                                        </label>
                                        <select
                                            id="map-era"
                                            value={era}
                                            onChange={(e) =>
                                                setEra(e.target.value as MapEra)
                                            }
                                            className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-forest"
                                        >
                                            {(
                                                Object.keys(MAP_ERA_LABEL) as MapEra[]
                                            ).map((key) => (
                                                <option key={key} value={key}>
                                                    {MAP_ERA_LABEL[key]}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-[10px] leading-relaxed text-faint">
                                            同じ土地でも、時代で街道も町の広がりも変わります。
                                        </p>
                                    </div>
                                )}

                                <div className="mt-2 rounded-md bg-canvas px-2.5 py-2">
                                    <p className="text-[11px] font-medium text-ink">
                                        できるだけ具体的に書いてください
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                                        短い指示ほど、ありきたりな絵になります。
                                        次のようなことを書くと近づきます。
                                    </p>
                                    <ul className="mt-1 flex flex-wrap gap-1">
                                        {HINT_POINTS[style].map((point) => (
                                            <li
                                                key={point}
                                                className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted"
                                            >
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <textarea
                                    value={hint}
                                    onChange={(e) => setHint(e.target.value)}
                                    rows={4}
                                    maxLength={400}
                                    placeholder={`例：${HINT_EXAMPLE[style]}`}
                                    aria-label="どんな絵にしたいか"
                                    className="mt-1.5 w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-forest"
                                />

                                {/* 短すぎるときだけ促す */}
                                {hint.trim().length > 0 && hint.trim().length < 25 && (
                                    <p className="mt-1 text-[10px] text-[var(--color-amber)]">
                                        まだ短いようです。あと少し足すと、狙いに近づきます。
                                    </p>
                                )}
                                {realPlaces.length > 0 && (
                                    <p className="mt-1.5 rounded-md bg-forest-tint/60 px-2.5 py-2 text-[10px] leading-relaxed text-ink">
                                        実在の地名を見つけました（{realPlaces.join("、")}）。
                                        実際の海岸線や位置関係に沿って描かせます。
                                    </p>
                                )}

                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-faint">
                                        {hint.trim().length === 0
                                            ? "空のままだと、名前と説明だけで描きます"
                                            : `${hint.trim().length}文字`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleGenerate()}
                                        disabled={isBusy || !name.trim()}
                                        className="rounded-md bg-forest px-4 py-1.5 text-xs text-white hover:bg-forest-dark disabled:opacity-40"
                                    >
                                        {isBusy ? "描いています…" : "この内容で描く"}
                                    </button>
                                </div>
                                <p className="mt-1 text-[10px] text-faint">
                                    十数秒かかります。1枚使うと戻せません。
                                </p>
                            </>
                        )}
                    </div>

                    {notice && (
                        <p className="text-[11px] text-[var(--color-amber)]">{notice}</p>
                    )}
                </div>
            )}
        </div>
    );
}
