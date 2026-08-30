'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useLoginRequired } from '@/hooks/use-login-required'
import { REPORT_REASON_LABEL, type ReportReason, type ReportTarget } from '@/types'

/**
 * ============================================================
 * 原石航路 Studio
 * ReportButton — 通報する
 *
 * 作品・話・感想・つぶやき・作者ページから呼ぶ。
 * 執筆室には前からある窓（report-dialog）がある。
 *
 * ★ 通報した人が誰かは、相手に見せない。
 *
 *   相手に伝わると報復が始まり、
 *   嫌がらせを受けている人ほど名乗れなくなる。
 *   運営が間に入るための仕組みなので、そこは閉じる。
 *   運営には見える。いたずらを繰り返す人を止めるため。
 *
 * ★ 通報したときの本文を写して送る。
 *
 *   あとから消されても、何を見て通報したかが残る。
 *   これが無いと、消し逃げされたときに判断できない。
 * ============================================================
 */

/** 通報できる理由。並びの順に出す */
const REASONS: ReportReason[] = [
    'abuse',
    'harassment',
    'spam',
    'sexual',
    'danger',
    'copyright',
    'rating',
    'other',
]

interface Props {
    /** 何を通報するか */
    target: ReportTarget
    /** 通報されるものの id */
    targetId?: string | null
    /** 通報される人 */
    accusedId: string
    accusedName?: string | null
    /** 通報した時点の本文。あとから消されても残る */
    quotedBody?: string
    /** 通報する人。ログインしていなければ null */
    userId: string | null
    userName?: string | null
    /** 押し具の見た目。控えめにしたいときは "quiet" */
    look?: 'quiet' | 'plain'
}

export default function ReportButton({
    target, targetId, accusedId, accusedName,
    quotedBody, userId, userName, look = 'quiet',
}: Props) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState<ReportReason>('abuse')
    const [note, setNote] = useState('')
    const [sending, setSending] = useState(false)
    const [done, setDone] = useState(false)

    const { guard, prompt } = useLoginRequired(userId)

    /*
     * 自分は通報できない。
     * 出しておくと、押して初めて断られる。
     */
    if (userId && userId === accusedId) return null

    async function send() {
        if (sending) return
        setSending(true)

        const { error } = await createClient().from('reports').insert({
            target,
            target_id: targetId ?? null,
            reason,
            note: note.trim(),
            accused_id: accusedId,
            accused_name: accusedName ?? '',
            /* 消し逃げに備えて、いまの本文を写す */
            quoted_body: (quotedBody ?? '').slice(0, 2000),
            reporter_id: userId,
            reporter_name: userName ?? '',
        })

        setSending(false)

        if (error) {
            window.alert(`送れませんでした：${error.message}`)
            return
        }

        setDone(true)
    }

    return (
        <>
            <button
                type="button"
                onClick={guard('通報する', () => setOpen(true))}
                className={
                    look === 'quiet'
                        ? 'shrink-0 text-[11px] text-faint hover:text-[var(--color-danger)]'
                        : 'shrink-0 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]'
                }
            >
                通報
            </button>

            {prompt}

            {open && (
                <div
                    onClick={() => { setOpen(false); setDone(false) }}
                    style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:300,
                        display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{background:'var(--color-bg-card)',borderRadius:14,padding:'18px 18px 16px',
                            maxWidth:460,width:'100%',maxHeight:'88vh',overflowY:'auto'}}
                    >
                        {done ? (
                            <>
                                <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>
                                    受け取りました
                                </div>
                                <p style={{fontSize:12.5,lineHeight:1.9,color:'var(--color-text-muted)',marginBottom:16}}>
                                    運営が確認します。
                                    結果をお知らせできないことがありますが、
                                    見ていないわけではありません。
                                    <br /><br />
                                    {/*
                                      * 誰が通報したかは相手に伝わらない、と明記する。
                                      * ここを不安に思って通報をためらう人がいる。
                                      */}
                                    通報したことは、相手に伝わりません。
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); setDone(false) }}
                                    style={{width:'100%',padding:'10px',borderRadius:8,border:'none',
                                        background:'var(--color-brand)',color:'#fff',fontSize:13,
                                        fontWeight:600,cursor:'pointer'}}
                                >
                                    閉じる
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:4}}>
                                    通報する
                                </div>
                                <p style={{fontSize:11.5,lineHeight:1.8,color:'var(--color-text-muted)',marginBottom:12}}>
                                    運営だけが受け取ります。通報したことは相手に伝わりません。
                                </p>

                                <div style={{fontSize:12,fontWeight:600,color:'var(--color-text)',marginBottom:6}}>
                                    理由
                                </div>
                                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                                    {REASONS.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setReason(key)}
                                            style={{fontSize:12,padding:'6px 12px',borderRadius:14,cursor:'pointer',
                                                border:`1.5px solid ${reason===key?'var(--color-brand)':'var(--color-brand-border)'}`,
                                                background: reason===key?'var(--color-brand-light)':'var(--color-bg-card)',
                                                color: reason===key?'var(--color-brand)':'var(--color-text-muted)',
                                                fontWeight: reason===key?700:500}}
                                        >
                                            {REPORT_REASON_LABEL[key]}
                                        </button>
                                    ))}
                                </div>

                                <div style={{fontSize:12,fontWeight:600,color:'var(--color-text)',marginBottom:6}}>
                                    補足（任意）
                                </div>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={4}
                                    maxLength={1000}
                                    placeholder="どこが問題かを書いていただけると、確認が早くなります。"
                                    style={{width:'100%',padding:'10px 12px',fontSize:13,lineHeight:1.8,
                                        color:'var(--color-text)',background:'var(--color-bg)',
                                        border:'1px solid var(--color-brand-border)',borderRadius:8,
                                        resize:'vertical',fontFamily:'inherit',marginBottom:14}}
                                />

                                <div style={{display:'flex',gap:8}}>
                                    <button
                                        type="button"
                                        onClick={() => void send()}
                                        disabled={sending}
                                        style={{flex:1,padding:'10px',borderRadius:8,border:'none',
                                            background:'var(--color-danger)',color:'#fff',fontSize:13,
                                            fontWeight:600,cursor:'pointer',opacity:sending?.5:1}}
                                    >
                                        {sending ? '送っています…' : '通報する'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        style={{padding:'10px 18px',borderRadius:8,cursor:'pointer',
                                            border:'1px solid var(--color-brand-border)',
                                            background:'var(--color-bg-card)',color:'var(--color-text-muted)',fontSize:13}}
                                    >
                                        やめる
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
