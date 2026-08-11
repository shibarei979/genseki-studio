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

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  subject: string
  body: string
  is_read: boolean
  created_at: string
}

export default function MessagesClient({ messages }: { messages: Message[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState(messages)
  const [openId, setOpenId] = useState<string | null>(null)

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
          {rows.map(row => (
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
