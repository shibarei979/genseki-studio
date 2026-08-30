'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import AdminShell from '@/components/admin/admin-shell'

/**
 * ============================================================
 * 原石航路 Studio
 * AdminFeaturedClient — 受賞作品・運営のおすすめを選ぶ
 *
 * ホームの枠に出す作品を、運営が手で選ぶ。
 *
 * ★ 受賞が 1 つでもあれば、ホームは受賞だけを出す。
 *   受賞とただの推薦が混ざると、
 *   どれが賞を取ったのか分からなくなる。
 *
 * ★ 賞の名前は必ず入れる。
 *   「第一回プレリリースコンテスト 大賞」のように。
 *   無いと、ただの推薦と見分けが付かない。
 * ============================================================
 */

interface Row {
    id: string
    novel_id: string
    kind: 'award' | 'pick'
    label: string
    sort_order: number
    is_visible: boolean
    /* 作品の題名。別に引いて添える */
    title?: string
    author?: string
}

export default function AdminFeaturedClient() {
    const supabase = createClient()

    const [rows, setRows] = useState<Row[]>([])
    const [loading, setLoading] = useState(true)

    /* 作品を探す */
    const [query, setQuery] = useState('')
    const [found, setFound] = useState<{ id: string; title: string }[]>([])
    const [searching, setSearching] = useState(false)

    useEffect(() => {
        void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function load() {
        setLoading(true)

        const { data } = await supabase
            .from('featured_novels')
            .select('*')
            .order('kind')
            .order('sort_order')

        const list = (data || []) as Row[]

        /*
         * 題名を別に引く。
         *
         * 繋いで一度に読む書き方は使わない。
         * 作品の表と繋ぐと、決まりの絡みで空が返ることがある。
         */
        if (list.length > 0) {
            const { data: novels } = await supabase
                .from('novels')
                .select('id, title')
                .in('id', list.map((r) => r.novel_id))

            const byId = new Map(
                (novels || []).map((n: { id: string; title: string }) => [n.id, n.title]),
            )
            for (const row of list) row.title = byId.get(row.novel_id) || '（題名なし）'
        }

        setRows(list)
        setLoading(false)
    }

    async function search() {
        const word = query.trim()
        if (!word || searching) return

        setSearching(true)
        const { data } = await supabase
            .from('novels')
            .select('id, title')
            .eq('published', true)
            .ilike('title', `%${word}%`)
            .limit(20)

        setFound((data || []) as { id: string; title: string }[])
        setSearching(false)
    }

    async function add(novelId: string, kind: 'award' | 'pick') {
        const { error } = await supabase.from('featured_novels').insert({
            novel_id: novelId,
            kind,
            label: '',
            sort_order: rows.filter((r) => r.kind === kind).length,
        })

        if (error) {
            window.alert(`足せませんでした：${error.message}`)
            return
        }
        setFound([])
        setQuery('')
        await load()
    }

    async function saveLabel(id: string, label: string) {
        const { error } = await supabase
            .from('featured_novels')
            .update({ label, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) window.alert(`保存できませんでした：${error.message}`)
    }

    async function move(id: string, direction: -1 | 1) {
        const target = rows.find((r) => r.id === id)
        if (!target) return

        const same = rows.filter((r) => r.kind === target.kind)
        const at = same.findIndex((r) => r.id === id)
        const other = same[at + direction]
        if (!other) return

        await Promise.all([
            supabase.from('featured_novels').update({ sort_order: other.sort_order }).eq('id', target.id),
            supabase.from('featured_novels').update({ sort_order: target.sort_order }).eq('id', other.id),
        ])
        await load()
    }

    async function remove(id: string) {
        if (!confirm('この作品を枠から外しますか？')) return
        const { error } = await supabase.from('featured_novels').delete().eq('id', id)
        if (error) {
            window.alert(`外せませんでした：${error.message}`)
            return
        }
        await load()
    }

    const awards = rows.filter((r) => r.kind === 'award')
    const picks = rows.filter((r) => r.kind === 'pick')

    return (
        <AdminShell
            title="受賞作品・運営のおすすめ"
            description="ホームの枠に出す作品を選ぶ"
        >
        <div style={{maxWidth:900}}>
            {/*
              * いまホームに何が出るかを、先に伝える。
              * 選んでから「出ていない」と気づくのでは遅い。
              */}
            <div style={{
                border:'1px solid var(--admin-border)',
                background:'var(--admin-bg-card)',
                borderRadius:12, padding:'14px 16px', marginBottom:20,
                fontSize:12.5, lineHeight:1.9, color:'var(--admin-text-muted)',
            }}>
                いまホームに出るのは
                <strong style={{color:'var(--admin-text)'}}>
                    　{awards.length > 0 ? '受賞作品' : '運営のおすすめ'}　
                </strong>
                です。
                <br />
                受賞作品を 1 つでも登録すると、そちらだけが出ます。
                どちらも空のときは、枠ごと出ません。
            </div>

            {/* 作品を探して足す */}
            <div style={{
                border:'1px solid var(--admin-border)',
                background:'var(--admin-bg-card)',
                borderRadius:12, padding:'16px 18px', marginBottom:24,
            }}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--admin-text)',marginBottom:10}}>
                    作品を足す
                </div>

                <div style={{display:'flex',gap:8,marginBottom:12}}>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
                        placeholder="作品の題名で探す"
                        style={{flex:1,padding:'8px 12px',fontSize:13,borderRadius:8,
                            border:'1px solid var(--admin-border)'}}
                    />
                    <button type="button" onClick={() => void search()} disabled={searching}
                        style={{padding:'8px 18px',fontSize:13,borderRadius:8,border:'none',
                            background:'var(--admin-stat-blue)',color:'#fff',cursor:'pointer'}}>
                        {searching ? '探しています…' : '探す'}
                    </button>
                </div>

                {found.map((n) => (
                    <div key={n.id} style={{display:'flex',alignItems:'center',gap:8,
                        padding:'8px 0',borderTop:'1px solid var(--admin-border)'}}>
                        <span style={{flex:1,fontSize:13,color:'var(--admin-text)'}}>
                            {n.title || '（題名なし）'}
                        </span>
                        <button type="button" onClick={() => void add(n.id, 'award')}
                            style={{padding:'5px 12px',fontSize:12,borderRadius:7,cursor:'pointer',
                                border:'1px solid var(--admin-border)',background:'var(--admin-bg)'}}>
                            受賞に足す
                        </button>
                        <button type="button" onClick={() => void add(n.id, 'pick')}
                            style={{padding:'5px 12px',fontSize:12,borderRadius:7,cursor:'pointer',
                                border:'1px solid var(--admin-border)',background:'var(--admin-bg)'}}>
                            おすすめに足す
                        </button>
                    </div>
                ))}
            </div>

            {loading ? (
                <p style={{fontSize:13,color:'var(--admin-text-faint)'}}>読み込んでいます…</p>
            ) : (
                <>
                    <Section
                        title="受賞作品"
                        note="賞の名前を必ず入れてください。無いと、ただの推薦と見分けが付きません。"
                        rows={awards}
                        needLabel
                        onLabel={saveLabel}
                        onMove={move}
                        onRemove={remove}
                    />
                    <Section
                        title="運営のおすすめ"
                        note="受賞作品が 1 つも無いときに、ホームへ出ます。"
                        rows={picks}
                        onLabel={saveLabel}
                        onMove={move}
                        onRemove={remove}
                    />
                </>
            )}
        </div>
        </AdminShell>
    )
}

function Section({
    title, note, rows, needLabel, onLabel, onMove, onRemove,
}: {
    title: string
    note: string
    rows: Row[]
    needLabel?: boolean
    onLabel: (id: string, label: string) => Promise<void>
    onMove: (id: string, direction: -1 | 1) => Promise<void>
    onRemove: (id: string) => Promise<void>
}) {
    return (
        <div style={{marginBottom:26}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--admin-text)',marginBottom:4}}>
                {title}
            </div>
            <p style={{fontSize:11.5,color:'var(--admin-text-faint)',marginBottom:10,lineHeight:1.7}}>
                {note}
            </p>

            {rows.length === 0 ? (
                <p style={{fontSize:12.5,color:'var(--admin-text-faint)',
                    border:'1px dashed var(--admin-border)',borderRadius:10,padding:'14px 16px'}}>
                    まだ選んでいません。
                </p>
            ) : (
                <div style={{border:'1px solid var(--admin-border)',borderRadius:12,
                    background:'var(--admin-bg-card)',overflow:'hidden'}}>
                    {rows.map((row, at) => (
                        <div key={row.id} style={{display:'flex',alignItems:'center',gap:10,
                            padding:'12px 14px',
                            borderTop: at === 0 ? 'none' : '1px solid var(--admin-border)'}}>
                            <span style={{width:20,fontSize:12,color:'var(--admin-text-faint)'}}>
                                {at + 1}
                            </span>

                            <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,color:'var(--admin-text)',
                                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                    {row.title}
                                </div>
                                {needLabel && (
                                    <input
                                        defaultValue={row.label}
                                        onBlur={(e) => void onLabel(row.id, e.target.value)}
                                        placeholder="賞の名前（例：第一回プレリリースコンテスト 大賞）"
                                        style={{marginTop:6,width:'100%',padding:'5px 9px',fontSize:12,
                                            borderRadius:6,border:'1px solid var(--admin-border)'}}
                                    />
                                )}
                            </div>

                            <button type="button" onClick={() => void onMove(row.id, -1)}
                                style={{padding:'4px 9px',fontSize:12,borderRadius:6,cursor:'pointer',
                                    border:'1px solid var(--admin-border)',background:'var(--admin-bg)'}}>
                                ↑
                            </button>
                            <button type="button" onClick={() => void onMove(row.id, 1)}
                                style={{padding:'4px 9px',fontSize:12,borderRadius:6,cursor:'pointer',
                                    border:'1px solid var(--admin-border)',background:'var(--admin-bg)'}}>
                                ↓
                            </button>
                            <button type="button" onClick={() => void onRemove(row.id)}
                                style={{padding:'4px 10px',fontSize:12,borderRadius:6,cursor:'pointer',
                                    border:'1px solid var(--admin-border)',background:'var(--admin-bg)',
                                    color:'var(--admin-stat-rose)'}}>
                                外す
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
