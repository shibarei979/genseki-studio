/**
 * ============================================================
 * 原石航路 Studio
 * MessagesClient — 運営からのお知らせ
 *
 * 一覧を並べ、押すと本文が開く。
 *
 * ------------------------------------------------------------
 * 既読の扱い
 *
 * 開いたときに読んだ印を付ける。
 * 別に「読んだ」ボタンを置くと、押し忘れたものが
 * いつまでも未読として残る。
 *
 * 印は運営側の画面にも出る。届いたかどうかが分かる。
 * ============================================================
 */

'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  subject: string
  body: string
  is_read: boolean
  created_at: string
  /** 誰が書いたか。null なら運営 */
  from_user_id?: string | null
  /** どのやりとりに属するか。null なら最初の 1 通 */
  parent_id?: string | null
}

export default function MessagesClient({
  messages,
  openId: initialOpenId = null,
  userId,
}: {
  messages: Message[]
  /** ベルから来たとき、開いた状態にする便り */
  openId?: string | null
  /** 返信を書くときの名乗り */
  userId?: string
}) {
  const supabase = createClient()
  const [rows, setRows] = useState(messages)
  const [openId, setOpenId] = useState<string | null>(initialOpenId)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  /*
   * ベルから来たときは、その便りを開いて既読にする。
   * 押してから開くのと同じ扱いにしないと、
   * ベルの印が残り続ける。
   */
  useEffect(() => {
    if (!initialOpenId) return
    const target = messages.find(m => m.id === initialOpenId)
    if (!target || target.is_read) return

    setRows(prev => prev.map(r => r.id === target.id ? { ...r, is_read: true } : r))
    void supabase.from('admin_messages').update({ is_read: true }).eq('id', target.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId])

  async function open(row: Message) {
    /* もう一度押したら閉じる */
    if (openId === row.id) { setOpenId(null); return }

    setOpenId(row.id)
    if (row.is_read) return

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_read: true } : r))
    await supabase.from('admin_messages').update({ is_read: true }).eq('id', row.id)
  }

  const unread = rows.filter(r => !r.is_read).length

  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[18px] font-semibold text-ink">運営からのお知らせ</h1>
        {unread > 0 && (
          <span className="rounded-full bg-forest-tint px-2.5 py-0.5 text-[11px] text-forest">
            未読 {unread}
          </span>
        )}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        あなたに宛てて送られたものです。全員向けの告知は
        <a href="/notices" className="mx-1 text-forest hover:underline">お知らせ</a>
        にあります。
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line px-6 py-14 text-center text-[12px] leading-relaxed text-muted">
          届いているものはありません。
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.filter(row => !row.parent_id).map(row => (
            <li
              key={row.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <button
                type="button"
                onClick={() => void open(row)}
                aria-expanded={openId === row.id}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-canvas"
              >
                {/*
                 * 未読の印。
                 * 文字ではなく点にする。件名の頭に「未読」と付けると、
                 * 件名そのものが読みにくくなる。
                 */}
                <span
                  className={[
                    'h-2 w-2 shrink-0 rounded-full',
                    row.is_read ? 'bg-transparent' : 'bg-forest',
                  ].join(' ')}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      'block truncate text-[13px]',
                      row.is_read ? 'text-muted' : 'font-semibold text-ink',
                    ].join(' ')}
                  >
                    {row.subject || '（件名なし）'}
                  </span>
                </span>

                <span className="shrink-0 text-[11px] tabular-nums text-faint">
                  {formatDate(row.created_at)}
                </span>
              </button>

              {openId === row.id && (
                <div className="border-t border-line px-5 py-4">
                  <p className="whitespace-pre-wrap text-[13px] leading-[1.9] text-ink">
                    {row.body}
                  </p>

                  {/*
                   * このやりとりの続き。
                   * 自分が書いたものは右寄せにして、
                   * どちらの言葉か一目で分かるようにする。
                   */}
                  {rows
                    .filter(r => r.parent_id === row.id)
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))
                    .map(reply => (
                      <div
                        key={reply.id}
                        className={[
                          'mt-3 rounded-lg px-3.5 py-2.5',
                          reply.from_user_id
                            ? 'ml-8 bg-forest-tint'
                            : 'mr-8 bg-canvas',
                        ].join(' ')}
                      >
                        <p className="text-[10px] text-muted">
                          {reply.from_user_id ? 'あなた' : '運営'}・
                          {formatDate(reply.created_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.8] text-ink">
                          {reply.body}
                        </p>
                      </div>
                    ))}

                  {/* 返信 */}
                  {userId && (
                    replyTo === row.id ? (
                      <div className="mt-3">
                        <textarea
                          value={replyBody}
                          onChange={e => setReplyBody(e.target.value)}
                          rows={3}
                          placeholder="返信を書く"
                          className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-forest"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setReplyTo(null); setReplyBody('') }}
                            className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-muted hover:text-ink"
                          >
                            やめる
                          </button>
                          <button
                            type="button"
                            disabled={sending || !replyBody.trim()}
                            onClick={async () => {
                              setSending(true)
                              const { data, error } = await supabase
                                .from('admin_messages')
                                .insert({
                                  to_user_id: userId,
                                  from_user_id: userId,
                                  parent_id: row.id,
                                  subject: `Re: ${row.subject}`,
                                  body: replyBody.trim(),
                                  is_read: true,
                                })
                                .select()
                                .single()
                              setSending(false)

                              if (error) {
                                window.alert(`送れませんでした：${error.message}`)
                                return
                              }
                              setRows(prev => [...prev, data as Message])
                              setReplyTo(null)
                              setReplyBody('')
                            }}
                            className="rounded-lg bg-forest px-4 py-1.5 text-[11px] font-medium text-white hover:bg-forest-dark disabled:opacity-50"
                          >
                            {sending ? '送っています…' : '返信する'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setReplyTo(row.id); setReplyBody('') }}
                        className="mt-3 text-[11px] text-forest hover:underline"
                      >
                        返信する
                      </button>
                    )
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

/** 「08/10」の形。今年でなければ年も出す */
function formatDate(value: string): string {
  const date = new Date(value)
  const stamp = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  return date.getFullYear() === new Date().getFullYear()
    ? stamp
    : `${date.getFullYear()}/${stamp}`
}
