"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * ============================================================
 * 原石航路 Studio
 * VerticalBox — 携帯・縦書きのときだけ使う、入力の箱
 *
 * ★ なぜ textarea をやめるか。
 *
 *   textarea の縦書きは、Safari が対応していない。
 *   2013 年に上がった報告が、いまも直っていない。
 *   （WebKit 117228 / 283620）
 *
 *   押した位置から字を割り出す計算が動かないので、
 *   余白や字間をどう直しても、ずれは消えない。
 *   土台が動いていないところに、手当てを積んでいた。
 *
 *   div に contenteditable を付けたものは、
 *   同じ Safari でも縦書きが効く。
 *   世の中の縦書きエディタは、この形を取っている。
 *
 * ★ 書いている最中は、中身に触らない。
 *
 *   ここがいちばん大事。
 *   打つたびに中身を入れ替えると、
 *   カーソルが末尾へ飛び、変換中の字が消える。
 *
 *   触れているあいだは、箱に任せる。
 *   話を切り替えたときだけ、こちらから入れ直す。
 *
 * ★ 飾りは受け取らない。
 *   plaintext-only を指定して、素の文字だけにする。
 *   効かない端末のために、貼り付けも自分で受ける。
 * ============================================================
 */

interface Props {
    value: string;
    onChange?: (value: string) => void;
    onSelectionChange?: (selected: string) => void;
    className?: string;
    style?: CSSProperties;
    placeholder?: string;
    /** 中の箱を、外から触りたいとき */
    boxRef?: React.RefObject<HTMLDivElement>;
}

export default function VerticalBox({
    value,
    onChange,
    onSelectionChange,
    className,
    style,
    placeholder,
    boxRef,
}: Props) {
    const own = useRef<HTMLDivElement>(null);
    const box = boxRef ?? own;

    /*
     * 最後にこちらから外へ渡した文。
     *
     * 親から同じ文が返ってきたときに、
     * 入れ直さずに済ませるために覚えておく。
     * 入れ直すと、そのたびにカーソルが飛ぶ。
     */
    const sent = useRef<string | null>(null);

    useEffect(() => {
        const el = box.current;
        if (!el) return;

        /* 触れているあいだは、箱に任せる */
        if (document.activeElement === el) return;

        /* 自分が出した文が返ってきただけなら、何もしない */
        if (sent.current === value) return;

        if (el.innerText !== value) el.innerText = value;
    }, [value, box]);

    /*
     * 選んだ文字を、外へ知らせる。
     *
     * ルビや傍点は、選んだ範囲に付ける。
     * 箱の中の選択は textarea とは別の仕組みなので、
     * ここで拾い直す。
     */
    useEffect(() => {
        if (!onSelectionChange) return;

        function onSelect() {
            const el = box.current;
            if (!el) return;

            const sel = window.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;

            /* 箱の外の選択は、こちらの話ではない */
            if (!el.contains(sel.anchorNode)) return;

            onSelectionChange?.(sel.toString());
        }

        document.addEventListener("selectionchange", onSelect);
        return () => document.removeEventListener("selectionchange", onSelect);
    }, [onSelectionChange, box]);

    return (
        <div
            ref={box}
            /*
             * plaintext-only は、飾りを受け取らない指定。
             * 効かない端末では true として扱われるので、
             * 貼り付けは下で自分で受ける。
             */
            contentEditable={"plaintext-only" as unknown as boolean}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="本文"
            data-placeholder={placeholder}
            className={className}
            style={{
                ...style,
                /* 改行と続く空白を、そのまま残す */
                whiteSpace: "pre-wrap",
                /* 長い語も折り返す。1 行が伸び続けるのを防ぐ */
                overflowWrap: "anywhere",
                outline: "none",
            }}
            onInput={(e) => {
                const text = e.currentTarget.innerText;
                sent.current = text;
                onChange?.(text);
            }}
            onPaste={(e) => {
                /*
                 * ★ 貼り付けは、素の文字だけ受ける。
                 *   飾り付きのまま入ると、本文に見えない印が混ざる。
                 */
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, text);
            }}
        />
    );
}
