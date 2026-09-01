'use client'

import { useEffect, useState } from 'react'

import HomeClient from '@/components/home/home-client'
import ReaderHome from '@/components/home/reader-home'

/**
 * ============================================================
 * 原石航路 Studio
 * GuestHome — 入っていない人のホーム
 *
 * ★ 既定は読者向け。
 *
 *   はじめて来た人は、まず読む人。
 *   執筆向けは「書いた本」「執筆室」など、
 *   入っていないと何も出ない枠が多い。
 *   空の棚では、何ができる場所か伝わらない。
 *
 * ★ ヘッダーの切り替えで、執筆向けも覗ける。
 *   その向きは、この端末に覚える。
 *   誰のものでもないので、表には書けない。
 * ============================================================
 */

export default function GuestHome() {
    /*
     * はじめは読者向けを出す。
     *
     * 端末に覚えたものを読むのは、画面が出たあと。
     * 先に読もうとすると、サーバー側で作った形と食い違って
     * 画面がちらつく。
     */
    const [mode, setMode] = useState<'read' | 'write'>('read')

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem('genseki:home-mode')
            if (saved === 'write') setMode('write')
        } catch {
            /* 読めなくても、読者向けで足りる */
        }
    }, [])

    return mode === 'write' ? <HomeClient /> : <ReaderHome />
}
