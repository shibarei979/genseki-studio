import Link from 'next/link'

import { GENRES } from '@/types'

/**
 * ============================================================
 * 原石航路 Studio
 * RecommendSidebar — このページの中を切り替える柱
 *
 * ★ 外のページへは飛ばない。
 *   住所に ?view= や ?genre= を付けて、このページを作り直す。
 *   外へ飛ぶと戻ってこられず、選び直すのに手間がかかる。
 * ============================================================
 */

/** 見せ方。押すと板の中身が入れ替わる */
/*
 * 見せ方。押すと板の中身が入れ替わる。
 *
 * ★ 名前は短く、違いが出るように。
 *   前は「おすすめ」が 5 つ中 3 つに入っていて、
 *   どれを押せば何が出るのか伝わらなかった。
 */
export const VIEWS = [
    { key: 'foryou',  label: 'おすすめ' },
    { key: 'hidden',  label: 'ここからの作品' },
    { key: 'rising',  label: '伸びている作品' },
    { key: 'new',     label: '新着のおすすめ' },
    { key: 'hot',     label: '急上昇のおすすめ' },
] as const

/** こだわり条件。押すと板の札を絞る */
/*
 * こだわり条件。
 *
 * ★ 完結・連載は入れていない。
 *   おすすめの点数付けが is_serial を持っておらず、
 *   絞れないため。押しても何も起きない押し具は置かない。
 */
export const FILTERS = [
    { key: 'long',  label: '長編作品' },
    { key: 'short', label: '短編作品' },
] as const

/** いまの住所に、変えたいものだけ差し替えた住所を作る */
/*
 * いまの住所に、変えたいものだけ差し替えた住所を作る。
 *
 * ★ 「探す」とジャンルは同時に選べない。
 *
 *   探す   … おすすめの中から、決まった物差しで選ぶ
 *   ジャンル … そのジャンルの中から、おすすめを選ぶ
 *
 *   どちらも「選び方」なので、重ねると意味が食い違う。
 *   片方を押したら、もう片方は外す。
 */
function hrefWith(
    now: { view: string; genre?: string; filter?: string },
    change: Partial<{ view: string; genre: string; filter: string }>,
) {
    const next = { ...now, ...change }

    /* 探すを押したらジャンルを外し、ジャンルを押したら探すを戻す */
    if (change.view !== undefined) next.genre = ''
    if (change.genre) next.view = 'foryou'
    const parts: string[] = []
    if (next.view && next.view !== 'foryou') parts.push(`view=${next.view}`)
    if (next.genre) parts.push(`genre=${encodeURIComponent(next.genre)}`)
    if (next.filter) parts.push(`filter=${next.filter}`)
    return parts.length ? `/recommend?${parts.join('&')}` : '/recommend'
}

export default function RecommendSidebar({
    view,
    genre,
    filter,
}: {
    view: string
    genre?: string
    filter?: string
}) {
    const now = { view, genre, filter }

    return (
        <aside className="rs">
            {/*
              * 携帯で畳む。
              *
              * ★ 印（checkbox）と札（label）だけで作る。
              *   このページはサーバー側で組み立てるので、
              *   状態を持つ部品にすると作りが増える。
              *
              * パソコンでは CSS 側で隠してあるので、出ない。
              */}
            <input type="checkbox" id="rs-more" className="rs-more-check" />
            <div className="rs_group">
                <p className="rs_label">探す</p>
                <ul>
                    {VIEWS.map((one) => (
                        <li key={one.key}>
                            <Link
                                href={hrefWith(now, { view: one.key })}
                                className={`rs_item${!genre && one.key === view ? ' is-on' : ''}`}
                            >
                                {one.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rs_group">
                <p className="rs_label">ジャンルから探す</p>
                <ul>
                    {/*
                      * 選んでいるものをもう一度押すと、絞りが外れる。
                      * 外し方が分からないと、行き止まりになる。
                      */}
                    {GENRES.map((one) => (
                        <li key={one}>
                            <Link
                                href={hrefWith(now, { genre: one === genre ? '' : one })}
                                className={`rs_item${one === genre ? ' is-on' : ''}`}
                            >
                                {one}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="rs_group">
                <p className="rs_label">こだわり条件</p>
                <ul>
                    {FILTERS.map((one) => (
                        <li key={one.key}>
                            <Link
                                href={hrefWith(now, { filter: one.key === filter ? '' : one.key })}
                                className={`rs_item${one.key === filter ? ' is-on' : ''}`}
                            >
                                {one.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 開く・閉じるの札 */}
            <label htmlFor="rs-more" className="rs-more-label">
                <span className="rs-more-open">絞り込みを開く</span>
                <span className="rs-more-close">絞り込みを閉じる</span>
                <span className="rs-more-arrow">⌄</span>
            </label>
        </aside>
    )
}
