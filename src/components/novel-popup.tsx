'use client'

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
  const [style, setStyle] = useState<'card' | 'book'>('card')

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getRepository().getProfile()
        const saved = (profile as { work_popup_style?: string })?.work_popup_style
        if (saved === 'book') setStyle('book')
      } catch {
        /* 読めなくても札で出す。押せないより出るほうがよい */
      }
    })()
  }, [])

  if (style === 'book') {
    return <NovelBookPopup novel={novel}>{children}</NovelBookPopup>
  }

  return <NovelPreviewPopup novel={novel}>{children}</NovelPreviewPopup>
}
