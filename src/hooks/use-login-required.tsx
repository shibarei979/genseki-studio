'use client'

/**
 * ============================================================
 * 原石航路
 * useLoginRequired — ログインが要る操作を包む
 *
 * 読むだけなら誰でもできる。
 * 書く・つぶやく・部屋に入るときにログインを求める。
 *
 * 押した時点で何をしようとしたか分かるよう、
 * 用件を添えた窓を出す。
 * 「ログインが必要です」だけだと、何のことか伝わらない。
 *
 * 使い方:
 *   const { guard, prompt } = useLoginRequired(userId)
 *   <button onClick={guard('つぶやく', () => post())}>つぶやく</button>
 *   {prompt}
 * ============================================================
 */

import { useState } from 'react'
import LoginPromptModal from '@/components/login-prompt-modal'

export function useLoginRequired(userId: string | null | undefined) {
  const [message, setMessage] = useState<string | null>(null)

  /**
   * ログインしていれば実行し、していなければ窓を出す。
   *
   * @param what 何をしようとしたか（「つぶやく」「感想を書く」など）
   */
  function guard<T extends unknown[]>(
    what: string,
    run: (...args: T) => void,
  ) {
    return (...args: T) => {
      if (!userId) {
        setMessage(`${what}にはログインが必要です`)
        return
      }
      run(...args)
    }
  }

  const prompt = (
    <LoginPromptModal
      show={message !== null}
      onClose={() => setMessage(null)}
      message={message ?? ''}
    />
  )

  return { guard, prompt, isLoggedIn: Boolean(userId) }
}
