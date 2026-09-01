'use client'

import { useCallback, useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * ============================================================
 * 原石航路 Studio
 * 付箋（話の中のしおり）
 *
 * ★ 文の番号で持つ。
 *
 *   本文は縦書きでも横書きでも、画面の幅で行が変わる。
 *   行で持つと、携帯で付けた付箋がパソコンで別の場所を指す。
 *   文なら、どこで見ても同じ場所になる。
 *
 * ★ そのときの文も一緒に持つ。
 *
 *   作者が前のほうに文を足すと、番号がずれる。
 *   照らし合わせて、違っていたら知らせる。
 * ============================================================
 */

export interface EpisodeMark {
    id: string
    sentence: number
    text: string
}

export function useEpisodeMarks(novelId: string, episodeId: string) {
    /*
     * 作品の id。
     *
     * ★ 渡された値をあてにしない。
     *
     *   渡し忘れると空の文字列になり、
     *   uuid として使えず保存が落ちる。
     *   実際、それで「付けられませんでした」が出た。
     *
     * 住所は /novel/{作品id}/episode/{話id} の形なので、
     * そこから取れる。
     */
    const parts =
        typeof window !== 'undefined'
            ? window.location.pathname.split('/')
            : []

    const workId = novelId || (parts[2] ?? '')

    /*
     * 話の id も同じ。
     *
     * ★ 渡されていなかった。
     *   読む画面の呼び出しに episodeId が無く、
     *   空のまま保存しようとして落ちていた。
     *
     * 住所は /novel/{作品id}/episode/{話id} の形。
     */
    const epId = episodeId || (parts[4] ?? '')

    const [marks, setMarks] = useState<EpisodeMark[]>([])
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        void (async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            const { data } = await supabase
                .from('episode_marks')
                .select('id, sentence, text')
                .eq('user_id', user.id)
                .eq('episode_id', epId)
                .order('sentence')

            setMarks((data ?? []) as EpisodeMark[])
        })()
    }, [epId])

    const add = useCallback(async (sentence: number, text: string) => {
        if (!userId) {
            window.alert('付箋を使うには、ログインが要ります。')
            return
        }
        if (!workId || !epId) {
            window.alert('この画面では付箋を使えません。')
            return
        }

        /*
         * 先に画面へ出す。
         * 保存を待たせると、押しても反応が無いように見える。
         */
        const temp: EpisodeMark = { id: `tmp-${sentence}`, sentence, text }
        setMarks(prev => [...prev, temp].sort((a, b) => a.sentence - b.sentence))

        const { data, error } = await createClient()
            .from('episode_marks')
            .insert({ user_id: userId, novel_id: workId, episode_id: epId, sentence, text })
            .select('id, sentence, text')
            .single()

        if (error || !data) {
            setMarks(prev => prev.filter(one => one.id !== temp.id))

            /*
             * ★ 理由をそのまま見せる。
             *
             *   「付けられませんでした」だけでは、
             *   表が無いのか、決まりで弾かれたのか分からない。
             *   直すときに、まずそこで詰まる。
             */
            console.error('付箋の保存に失敗:', error)
            window.alert(
                '付箋を付けられませんでした。\n\n'
                + (error?.message ?? '理由が返ってきませんでした'),
            )
            return
        }

        setMarks(prev => prev.map(one => (one.id === temp.id ? (data as EpisodeMark) : one)))
    }, [userId, workId, epId])

    const remove = useCallback(async (id: string) => {
        const before = marks
        setMarks(prev => prev.filter(one => one.id !== id))

        const { error } = await createClient()
            .from('episode_marks')
            .delete()
            .eq('id', id)

        if (error) {
            setMarks(before)
            window.alert('外せませんでした。')
        }
    }, [marks])

    return { marks, add, remove, canUse: Boolean(userId) }
}
