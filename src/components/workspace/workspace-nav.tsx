"use client";

/**
 * ============================================================
 * 原石航路 Studio
 * WorkspaceNav — ワークスペースの切り替え
 *
 * ★ パソコンは左の柱に縦。
 *   執筆・設定・資料 を 1 段目、投稿を 2 段目、
 *   読者の目で見る を最後に置く。
 *   目的の違いを、段の分かれ目で表す。
 *
 * ★ 携帯は上に横一列。
 *
 *   前は「いま居る所」だけを出し、押すと残りが開く形だった。
 *   行き先を見るのに一度押す、という一手が毎回入っていた。
 *   5 つとも短い言葉なので、並べても一行に収まる。
 *
 * 通し読みは執筆画面の横に出す形にした。
 * 「書く」「読み返す」を行き来するのに画面ごと移るのは遠い。
 * ============================================================
 */

import Link from "next/link";

interface Props {
    workId: string;
    current: "write" | "settings" | "resource" | "post";
    /**
     * 畳まずに、いつも開いておく。
     *
     * ★ もう見ていない。携帯でも畳まなくなったため。
     *   呼び出し側を一度に直さなくてよいよう、受け口だけ残す。
     */
    alwaysOpen?: boolean;
    /** 投稿へ渡す話。書いていた話をそのまま開くため */
    episodeId?: string | null;
}

export default function WorkspaceNav({ workId, current, episodeId }: Props) {
    const postHref = episodeId
        ? `/workspace/${workId}/post?ep=${episodeId}`
        : `/workspace/${workId}/post`;

    return (
        <div className="space-y-2">
            {/*
              * 携帯では、ここに出さない。
              *
              * ★ 下の帯が、この 5 つを持っている。
              *   作品を書いているあいだ、帯の中身は
              *   執筆・設定・資料・投稿・プレビューに変わる。
              *   上にも同じものを出すと二重になり、
              *   本文の場所がそのぶん狭くなる。
              *
              * ★ 中身は残しておく。
              *   帯が出ない端末や、帯を隠す設定にしたときの備え。
              */}
            <div className="hidden">
                <NavButton
                    href={`/workspace/${workId}`}
                    label="執筆"
                    isActive={current === "write"}
                    isNarrow
                />
                <NavButton
                    href={`/workspace/${workId}/settings`}
                    label="設定"
                    isActive={current === "settings"}
                    isNarrow
                />
                <NavButton
                    href={`/workspace/${workId}/resource`}
                    label="資料"
                    isActive={current === "resource"}
                    isNarrow
                />
                <NavButton
                    href={postHref}
                    label="投稿"
                    isActive={current === "post"}
                    isNarrow
                />

                {/*
                  * 読者の目で見る。
                  *
                  * ★ 別の頁で開く。書きかけの画面を閉じさせない。
                  * ★ ここだけ行き先が外なので、印を付けない。
                  */}
                <Link
                    href={`/novel/${workId}`}
                    target="_blank"
                    rel="noopener"
                    className="block whitespace-nowrap rounded-md border border-line px-1 py-2 text-center text-[10.5px] text-muted hover:bg-canvas"
                >
                    プレビュー
                </Link>
            </div>

            {/* パソコン。左の柱に縦に並べる */}
            <div className="hidden space-y-2 lg:block">
            <div className="grid grid-cols-3 gap-2">
            <NavButton
                href={`/workspace/${workId}`}
                label="執筆"
                isActive={current === "write"}
            />
            <NavButton
                href={`/workspace/${workId}/settings`}
                label="設定"
                isActive={current === "settings"}
            />
                <NavButton
                    href={`/workspace/${workId}/resource`}
                    label="資料"
                    isActive={current === "resource"}
                />
            </div>

            {/*
             * 投稿は、書き終えてから外へ出すもの。
             * 上の 3 つとは目的が違うので、段を分ける。
             */}
            <NavButton
                href={
                    episodeId
                        ? `/workspace/${workId}/post?ep=${episodeId}`
                        : `/workspace/${workId}/post`
                }
                label="投稿"
                isActive={current === "post"}
            />

            {/*
             * 読者の目で見る。
             *
             * ★ 自分の作品を読者と同じ形で開く道が、執筆側に無かった。
             *   作者は毎回「作品を探す」から自分の作品を掘り出していた。
             *
             * 別の頁で開く。書きかけの画面を閉じさせない。
             */}
            <Link
                href={`/novel/${workId}`}
                target="_blank"
                rel="noopener"
                className="block rounded-md border border-line px-3 py-2 text-center text-[13px] text-muted hover:bg-canvas"
            >
                読者の目で見る
            </Link>
            </div>
        </div>
    );
}

function NavButton({
    href,
    label,
    isActive,
    isNarrow = false,
}: {
    href: string;
    label: string;
    isActive: boolean;
    /** 5 つに割った狭い枠に入れるか。字と余白を詰める */
    isNarrow?: boolean;
}) {
    return (
        <Link
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
                "block whitespace-nowrap rounded-md text-center",
                isNarrow ? "px-1 py-2 text-[10.5px]" : "px-3 py-2 text-[13px]",
                isActive
                    ? "bg-forest text-white"
                    : "border border-line text-muted hover:bg-canvas",
            ].join(" ")}
        >
            {label}
        </Link>
    );
}
