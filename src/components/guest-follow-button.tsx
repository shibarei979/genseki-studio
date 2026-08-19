'use client'

/**
 * ============================================================
 * 原石航路
 * GuestFollowButton — 未ログインのときのフォロー
 *
 * 押し具ごと隠すと、その人をフォローできること自体が
 * 伝わらない。出しておいて、押されたときにログインを求める。
 *
 * ログインしている人には、ふつうの FollowButton を出す。
 * こちらは未ログインのときだけ使う。
 * ============================================================
 */

import { useState } from 'react'
import LoginPromptModal from '@/components/login-prompt-modal'

export default function GuestFollowButton({
  followerCount,
}: {
  followerCount: number
}) {
  const [asking, setAsking] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 16px',
          borderRadius: 18,
          border: '1px solid var(--color-brand)',
          background: 'var(--color-brand)',
          color: 'var(--color-text-inverse)',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        フォローする
        {followerCount > 0 && (
          <span style={{ fontWeight: 400, opacity: 0.85 }}>{followerCount}</span>
        )}
      </button>

      <LoginPromptModal
        show={asking}
        onClose={() => setAsking(false)}
        message="フォローするにはログインが必要です"
      />
    </>
  )
}
