'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getRepository } from '@/lib/repository'

/**
 * ============================================================
 * 原石航路 Studio
 * MobileTabBar — 携帯の下に出す帯
 *
 * ★ 携帯だけに出す。1024px 以上では出さない。
 *   パソコンには上の柱があるので、二重になる。
 *
 * ★ 書く画面には出さない。
 *   本文を書いている最中に下から帯が出ると、
 *   打つ場所が狭くなり、指も当たる。
 *
 * ★ 絵は線画にする。
 *   塗りつぶすと 6 つ並んだときに重い。
 * ============================================================
 */

/*
 * 下に並べる行き先。
 *
 * ★ 読む向きと書く向きで、並びを変える。
 *
 *   読む人に「作品を書く」「コンテスト」を出しても、
 *   使う道ではない。
 *   代わりに「おすすめ」を出す。
 *
 *   上のヘッダーの並び（NAV_ITEMS）と同じ考え方。
 */
const WRITER_TABS = [
    { href: '/', label: 'ホーム', icon: 'home' },
    { href: '/post', label: '作品を書く', icon: 'pen' },
    { href: '/search', label: '作品を探す', icon: 'search' },
    { href: '/ranking', label: 'ランキング', icon: 'chart' },
    { href: '/rooms', label: 'コミュニティー', icon: 'people' },
    { href: '/contest', label: 'コンテスト', icon: 'trophy' },
] as const

const READER_TABS = [
    { href: '/', label: 'ホーム', icon: 'home' },
    { href: '/search', label: '作品を探す', icon: 'search' },
    { href: '/ranking', label: 'ランキング', icon: 'chart' },
    { href: '/recommend', label: 'おすすめ', icon: 'star' },
    { href: '/rooms', label: 'コミュニティー', icon: 'people' },
] as const

/*
 * 帯を出さない道。
 *
 *   /workspace  書く画面。本文の邪魔になる
 *   /login      入る途中。迷わせない
 *   /admin      運営の画面。柱がある
 */
const HIDE_ON = ['/login', '/auth', '/admin']

/*
 * 本文を書く画面だけ、出さない。
 *
 * ★ /workspace 全部を外してはいけない。
 *   設定・資料・下読みも同じ道の下にあり、
 *   丸ごと外すと、そこから戻る術が無くなる。
 */
const HIDE_PATTERN = /^\/workspace\/[^/]+\/post/

export default function MobileTabBar() {
    const pathname = usePathname() || '/'

    /*
     * 見る向き。
     *
     * 読めるまでは執筆向けを出す。
     * 一瞬で並びが入れ替わると、押そうとした所が動く。
     */
    const [isReader, setIsReader] = useState(false)

    useEffect(() => {
        void (async () => {
            try {
                const profile = await getRepository().getProfile()
                setIsReader(profile?.home_mode === 'read')
            } catch {
                /* 読めなくても、執筆向けの並びで足りる */
            }
        })()
    }, [])

    const TABS = isReader ? READER_TABS : WRITER_TABS

    if (HIDE_ON.some((path) => pathname.startsWith(path))) return null
    if (HIDE_PATTERN.test(pathname)) return null

    return (
        <nav className="mtb" aria-label="主な行き先">
            {TABS.map((tab) => {
                /*
                 * いま居る所を濃くする。
                 *
                 * ホームだけは完全一致で見る。
                 * 前方一致にすると、どの道でもホームが濃くなる。
                 */
                const isHere =
                    tab.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(tab.href)

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`mtb_item${isHere ? ' is-here' : ''}`}
                        aria-current={isHere ? 'page' : undefined}
                    >
                        <Icon name={tab.icon} />
                        <span className="mtb_label">{tab.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}

/** 線画の絵。塗らずに線だけで描く */
function Icon({ name }: { name: string }) {
    const common = {
        width: 21,
        height: 21,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    }

    switch (name) {
        case 'home':
            return (
                <svg {...common}>
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.5V20h14V9.5" />
                </svg>
            )
        case 'pen':
            return (
                <svg {...common}>
                    <path d="M4 20c6-1 10-4 13-9 1.5-2.5 2-4.5 2-7-3 .5-5.5 1.5-8 3.5C7 10.5 5 14.5 4 20Z" />
                    <path d="M4 20c2.5-2.5 5-4.5 8-6" />
                </svg>
            )
        case 'search':
            return (
                <svg {...common}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
            )
        case 'chart':
            return (
                <svg {...common}>
                    <path d="M5 20v-6" />
                    <path d="M12 20V5" />
                    <path d="M19 20v-9" />
                </svg>
            )
        case 'people':
            return (
                <svg {...common}>
                    <circle cx="9" cy="8" r="3.2" />
                    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                    <path d="M16.5 5.5a3.2 3.2 0 0 1 0 6" />
                    <path d="M18 14.8c2 .8 3 2.6 3 5.2" />
                </svg>
            )
        case 'star':
            return (
                <svg {...common}>
                    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
                </svg>
            )
        case 'trophy':
            return (
                <svg {...common}>
                    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                    <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7 11" />
                    <path d="M17 6h3v1.5A3.5 3.5 0 0 1 17 11" />
                    <path d="M12 14v3" />
                    <path d="M8.5 20h7" />
                    <path d="M10 17h4v3h-4z" />
                </svg>
            )
        default:
            return null
    }
}
