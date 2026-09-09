'use client'

import { useEffect } from 'react'

import { getRepository } from '@/lib/repository'

/**
 * ============================================================
 * 原石航路
 * WorkPopupFlag — 作品の見せ方を、画面全体に伝える
 *
 * 本棚は home.js が独自に見開きを開く。
 * React の設定はそのままでは届かない。
 *
 * body に印を付けておけば、home.js から見える。
 * 「札」のときは、home.js が見開きを開かず、
 * React 側の小窓（NovelPopup）に任せる。
 * ============================================================
 */

export default function WorkPopupFlag() {
    useEffect(() => {
        void (async () => {
            let style = 'card'

            try {
                const profile = await getRepository().getProfile()
                const saved = (profile as { work_popup_style?: string })
                    ?.work_popup_style
                if (saved === 'book') style = 'book'

                /*
                 * ★ 「出さない」も、本棚には「札」として伝える。
                 *
                 *   home.js は「札」のときだけ見開きを開かず、
                 *   React 側の小窓に任せる作り。
                 *   そこへ任せてもらえれば、React 側が
                 *   小窓を出さずに作品の頁へ送る。
                 *
                 *   home.js は触らない決まりなので、
                 *   こちらで札に読み替える。
                 */
                if (saved === 'none') style = 'card'
            } catch {
                /* 読めなければ札。押せないより出るほうがよい */
            }

            document.body.dataset.workPopup = style
        })()

        return () => {
            delete document.body.dataset.workPopup
        }
    }, [])

    return null
}
