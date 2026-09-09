'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
    /* ヘッダーと同じ行き先にする。押すたびに違う画面が出ると迷う */
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
 *   /login      入る途中。迷わせない
 *   /admin      運営の画面。柱がある
 */
const HIDE_ON = ['/login', '/auth', '/admin']

/*
 * 作品を書いている道。
 *
 * ★ ここでは帯の中身を入れ替える。
 *
 *   前は書く画面で帯を隠していた。
 *   本文の邪魔になるという理由だったが、
 *   隠すと執筆・設定・資料・投稿の行き来が
 *   画面の上の押し具だけになり、遠かった。
 *
 *   隠すのではなく、その作品の中の行き先に差し替える。
 *   ホームや探すは、書いている最中に押すものではない。
 */
const WORKSPACE_PATTERN = /^\/workspace\/([^/]+)/

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
        /*
         * ★ まず、この端末に覚えてある向きを見る。
         *
         *   表を読むのは通信なので、頁が出てから少し遅れる。
         *   それまで執筆向けの並びが出ていた。
         *   読書向けに切り替えた直後、下の帯だけ
         *   一瞬もとの並びに見えるのは、これ。
         *
         *   クッキーなら、すぐ読める。
         */
        const saved = document.cookie
            .split('; ')
            .find((one) => one.startsWith('genseki-home-mode='))
            ?.split('=')[1]

        if (saved) setIsReader(saved === 'read')

        /* 表の値が本物。届いたら、そちらに合わせる */
        void (async () => {
            try {
                const profile = await getRepository().getProfile()
                setIsReader(profile?.home_mode === 'read')
            } catch {
                /* 読めなくても、覚えてある向きで足りる */
            }
        })()
    }, [])

    /*
     * 帯の高さを測って、中身の下の余白に渡す。
     *
     * ★ 帯の高さは決め打ちにできない。
     *
     *   1 つぶんの高さは min-height（52px）で、上限ではない。
     *   端末の文字を大きくしている人や、
     *   名前が折り返した端末では、帯はもっと高くなる。
     *
     *   余白のほうは 58px で固定してあったので、
     *   その差だけ頁のいちばん下が帯に隠れていた。
     *   目次の長い作品で下まで送ると、そこに押し具がある。
     *
     * ★ 測った値は --mtb-h に入れ、CSS の側で使う。
     */
    const barRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const bar = barRef.current
        if (!bar) return

        function tell() {
            const height = bar?.offsetHeight ?? 0
            if (height > 0) {
                document.documentElement.style.setProperty('--mtb-h', `${height}px`)
            }
        }

        tell()

        /* 文字の大きさや向きが変わったら、測り直す */
        const watcher =
            typeof ResizeObserver !== 'undefined' ? new ResizeObserver(tell) : null
        watcher?.observe(bar)
        window.addEventListener('resize', tell)

        return () => {
            watcher?.disconnect()
            window.removeEventListener('resize', tell)
        }
    })

    if (HIDE_ON.some((path) => pathname.startsWith(path))) return null

    /* 全画面で読む頁でも出さない */
    if (/\/read$/.test(pathname)) return null

    /*
     * 作品を書いているあいだは、その作品の中の行き先にする。
     *
     * ★ プレビューだけ別の頁で開く。
     *   書きかけの画面を閉じさせない。
     */
    const inWorkspace = pathname.match(WORKSPACE_PATTERN)

    const TABS = inWorkspace
        ? ([
              { href: `/workspace/${inWorkspace[1]}`, label: '執筆', icon: 'pen', exact: true },
              { href: `/workspace/${inWorkspace[1]}/settings`, label: '設定', icon: 'gear' },
              { href: `/workspace/${inWorkspace[1]}/resource`, label: '資料', icon: 'folder' },
              { href: `/workspace/${inWorkspace[1]}/post`, label: '投稿', icon: 'send' },
              { href: `/novel/${inWorkspace[1]}`, label: 'プレビュー', icon: 'eye', blank: true },
          ] as const)
        : isReader
          ? READER_TABS
          : WRITER_TABS

    return (
        <nav
            ref={barRef}
            className="mtb"
            aria-label={inWorkspace ? 'この作品の行き先' : '主な行き先'}
        >
            {TABS.map((tab: any) => {
                /*
                 * いま居る所を濃くする。
                 *
                 * ホームだけは完全一致で見る。
                 * 前方一致にすると、どの道でもホームが濃くなる。
                 */
                const isHere =
                    tab.blank
                        ? false
                        : tab.exact
                          ? pathname === tab.href
                          : tab.href === '/'
                            ? pathname === '/'
                            : pathname.startsWith(tab.href)

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        target={tab.blank ? '_blank' : undefined}
                        rel={tab.blank ? 'noopener' : undefined}
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
        /*
         * ここから下は、作品を書いているときの絵。
         *
         * ★ ほかと同じ線の太さ・同じ大きさで描く。
         *   1 つだけ濃いと、そこが目立って押されやすくなる。
         */
        case 'gear':
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
                </svg>
            )
        case 'folder':
            /* 資料。閉じた紙ばさみ。中に紙が 1 枚覗く */
            return (
                <svg {...common}>
                    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h7A1.5 1.5 0 0 1 19 9v8.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5Z" />
                    <path d="M7.5 11.5h8" />
                </svg>
            )
        case 'send':
            /* 投稿。外へ送る紙飛行機 */
            return (
                <svg {...common}>
                    <path d="M21 3 10.5 13.5" />
                    <path d="M21 3l-6.8 18-3.7-7.5L3 9.8Z" />
                </svg>
            )
        case 'eye':
            /* プレビュー。読者の目 */
            return (
                <svg {...common}>
                    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
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
