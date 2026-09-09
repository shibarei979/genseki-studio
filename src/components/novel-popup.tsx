'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import NovelPreviewPopup from '@/components/novel-preview-popup'
import NovelBookPopup from '@/components/novel-book-popup'
import { getRepository } from '@/lib/repository'

/**
 * ============================================================
 * 原石航路
 * NovelPopup — 作品を押したときの小窓
 *
 * 札と本の見開き、どちらを出すかを設定から決める。
 *
 * 呼ぶ側はこれ 1 つを使えばよい。
 * ランキング・検索・おすすめ・ホームで、
 * それぞれ判定を書くと、直すとき全部を回ることになる。
 * ============================================================
 */

interface Props {
  novel: {
    id: string
    title: string
    genre: string
    novel_type?: string
    summary?: string | null
    catchcopy?: string | null
    display_name?: string
    like_count?: number
    tags?: string[]
  }
  children: React.ReactNode
}

export default function NovelPopup({ novel, children }: Props) {
  /*
   * どちらを出すか。
   *
   * 決まるまでは札。
   * 初めて来た人には、情報が多いほうが親切。
   */
  const [style, setStyle] = useState<'card' | 'book' | 'none'>('card')

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getRepository().getProfile()
        const saved = (profile as { work_popup_style?: string })?.work_popup_style
        if (saved === 'book') setStyle('book')
        if (saved === 'none') setStyle('none')
      } catch {
        /* 読めなくても札で出す。押せないより出るほうがよい */
      }
    })()
  }, [])

  /*
   * 「出さない」を選んだ人。
   *
   * ★ 小窓を挟まず、そのまま作品の頁へ送る。
   *
   *   小窓は作品を選ぶための道具だが、
   *   要らない人には一手増えるだけになる。
   *   小窓の中の「今後は出さない」から、ここへ来る。
   *
   *   戻したいときは、マイページの設定から。
   */
  if (style === 'none') {
    return (
      <Link href={`/novel/${novel.id}`} style={{textDecoration:'none',color:'inherit',display:'contents'}}>
        {children}
      </Link>
    )
  }

  if (style === 'book') {
    return <NovelBookPopup novel={novel}>{children}</NovelBookPopup>
  }

  return <NovelPreviewPopup novel={novel}>{children}</NovelPreviewPopup>
}
