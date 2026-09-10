'use client'

import React from 'react'

import ReadingSummary from '@/components/mypage/reading-summary'

/**
 * ============================================================
 * 原石航路 Studio
 * ReadingSummaryBoundary — まとめが落ちても、履歴は守る
 *
 * ★ まとめは添え物で、閲覧履歴が本体。
 *
 *   添え物のどこかで落ちると、React はその頁ごと
 *   真っ白にする。履歴まで開けなくなるのは、割に合わない。
 *
 *   落ちたら、まとめだけを黙って引っ込める。
 *
 * ★ 黙って消すのは、まとめが「無くても困らない」ものだから。
 *   本体（履歴・投稿・設定）で同じことはしない。
 *   そちらは、何が起きたか知らせるべきもの。
 * ============================================================
 */
export default class ReadingSummaryBoundary extends React.Component<
    Record<string, never>,
    { failed: boolean }
> {
    constructor(props: Record<string, never>) {
        super(props)
        this.state = { failed: false }
    }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        /* 記録は残す。黙って消えるだけだと、直しようがない */
        console.error('reading summary failed', error)
    }

    render() {
        if (this.state.failed) return null
        return <ReadingSummary />
    }
}
