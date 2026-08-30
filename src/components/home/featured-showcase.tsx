'use client'

import { useState } from 'react'
import Link from 'next/link'

import { COVERS, hashOf } from '@/components/home/home-work-table'

/**
 * ============================================================
 * 原石航路 Studio
 * FeaturedShowcase — 受賞作品・運営のおすすめの見せ場
 *
 * 木の板の上に、本を正面から 1 冊置く。
 * その横に、賞の名前を吹き出しで出す。
 * 左右の矢印で、次の作品へ送る。
 *
 * ★ 本棚（home.js）には触らない。
 *
 *   本の絵は、執筆向けホームの作品一覧と同じ描き方。
 *   紙の端の縞と、表紙の影と光を CSS で重ねている。
 *   home.js の寸法の計算とは関わりがないので、
 *   ここを触っても棚は壊れない。
 * ============================================================
 */

export interface FeaturedItem {
    id: string
    href: string
    title: string
    author: string
    /** 賞の名前。受賞のときだけ入る */
    label?: string
}

export default function FeaturedShowcase({
    items,
}: {
    items: FeaturedItem[]
}) {
    const [at, setAt] = useState(0)

    if (items.length === 0) return null

    const item = items[at]
    const cover = COVERS[hashOf(item.title || item.id) % COVERS.length]

    /* 端まで来たら反対の端へ回る */
    const go = (step: 1 | -1) =>
        setAt((now) => (now + step + items.length) % items.length)

    return (
        <div className="fs">
            <div className="fs_stage">
                {items.length > 1 && (
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        className="fs_arrow fs_arrow-prev"
                        aria-label="前の作品"
                    >
                        ‹
                    </button>
                )}

                <div className="fs_center">
                    {/* 本。正面から見た姿 */}
                    <Link href={item.href} className="fs_book" style={{ background: cover.base }}>
                        {/*
                          * 背の側の影。
                          * これが無いと、ただの四角に見えて本にならない。
                          */}
                        <span className="fs_book-spine" />
                        {/* 上からの光 */}
                        <span className="fs_book-light" />

                        <span className="fs_book-text" style={{ color: cover.ink }}>
                            <span className="fs_book-title">{item.title}</span>
                            <span className="fs_book-author">著：{item.author}</span>
                        </span>
                    </Link>

                    {/* 紙の端。本の右側にはみ出す */}
                    <span className="fs_pages" aria-hidden="true" />

                    {/*
                      * 吹き出し。
                      *
                      * 賞の名前が無いときは出さない。
                      * 空の吹き出しは、置いてあるだけで意味がない。
                      */}
                    {item.label && (
                        <span className="fs_bubble">
                            {item.label}
                        </span>
                    )}
                </div>

                {items.length > 1 && (
                    <button
                        type="button"
                        onClick={() => go(1)}
                        className="fs_arrow fs_arrow-next"
                        aria-label="次の作品"
                    >
                        ›
                    </button>
                )}
            </div>

            {/* 板。本が宙に浮いて見えないように敷く */}
            <div className="fs_board" aria-hidden="true" />

            {items.length > 1 && (
                <div className="fs_dots">
                    {items.map((one, i) => (
                        <button
                            key={one.id}
                            type="button"
                            onClick={() => setAt(i)}
                            className={`fs_dot${i === at ? ' is-on' : ''}`}
                            aria-label={`${i + 1} 冊目`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
