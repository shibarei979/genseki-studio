'use client'

/**
 * ============================================================
 * 原石航路
 * LoginPromptModal — ログインしていない人への案内
 *
 * ★ 「止める」窓から「誘う」窓へ。
 *
 *   前は「〇〇にはログインが必要です」と一文だけ出していた。
 *   断られた印象だけが残り、登録すると何が得られるかが伝わらなかった。
 *
 *   押した操作に合わせて、言葉と絵を変える。
 *     しおりを保存しました   … 先に挟んだあと（D）。どの端末でも続きから
 *     保存・ブックマーク     … 本棚に残す
 *     感想・いいね・フォロー … 作者を応援する（F）
 *     そのほか               … 登録すると使えること
 *
 * ★ 呼び出し方はこれまでと同じ（show / onClose / message）。
 *   使っている所を一つずつ直さなくても、全部この見た目になる。
 *
 * ★ 動きははっきり。ただし、繰り返す動き（ハート・光・影）は数回で止める。
 *   ずっと動いていると、読んでいる人の目が休まらない。
 * ============================================================
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

import { guestBookmarks } from '@/lib/guest-bookmarks'
import {
  BellIcon,
  BookArt,
  BookIcon,
  ChatIcon,
  FollowIcon,
  HeartIcon,
  SaveArt,
  StarIcon,
  SupportArt,
} from '@/components/login-invite-art'

interface Props {
  show: boolean
  onClose: () => void
  message?: string
}

/** しおりを先に挟んだあとに出すときの言葉。呼ぶ側もこれを渡す */
export const SAVED_MESSAGE = 'しおりを保存しました'

type Kind = 'saved' | 'save' | 'support' | 'general'

/** 押した操作の言葉から、どの案内にするかを決める */
function kindOf(message: string): Kind {
  if (message === SAVED_MESSAGE) return 'saved'
  if (/保存|ブックマーク|しおり|本棚/.test(message)) return 'save'
  if (/感想|いいね|フォロー|拡散|応援/.test(message)) return 'support'
  return 'general'
}

/** 見出しと、その下のひと言 */
function wordsOf(message: string, kind: Kind): { title: string; lead: string } {
  if (kind === 'saved') {
    return { title: 'しおりを保存しました', lead: 'この端末だけに保存されています' }
  }
  if (kind === 'save') {
    return {
      title: 'この作品を、本棚に残しませんか',
      lead: '会員登録すると、どの端末でも続きから読めます。',
    }
  }
  if (kind === 'support') {
    if (/フォロー/.test(message)) {
      return { title: 'この作者を、フォローしませんか', lead: '新しい作品が出たら、お知らせが届きます。' }
    }
    if (/感想/.test(message)) {
      return { title: '感想で、作者を応援しませんか', lead: 'あなたの言葉が、作者の創作の励みになります。' }
    }
    if (/拡散/.test(message)) {
      return { title: 'この作品を、広めませんか', lead: '気に入った物語を、ほかの読者にも届けられます。' }
    }
    return { title: 'この作品を、応援しませんか', lead: 'いいねや感想は、作者の創作の励みになります。' }
  }

  /* 「〇〇にはログインが必要です」→「〇〇には、会員登録が必要です」 */
  const what = message.replace(/には?ログインが必要です。?$/, '').trim()
  return {
    title: what && what !== message ? `${what}には、会員登録が必要です` : message || '会員登録が必要です',
    lead: '登録は無料です。登録のあと、この頁に戻ってきます。',
  }
}

export default function LoginPromptModal({
  show,
  onClose,
  message = 'この機能を使うにはログインが必要です',
}: Props) {
  /* 登録・ログインのあとに戻る頁 */
  const [here, setHere] = useState('/')

  /* この端末の本棚に、何冊あるか（しおりを保存したときに見せる） */
  const [shelfCount, setShelfCount] = useState(0)

  useEffect(() => {
    if (!show) return
    setHere(window.location.pathname + window.location.search)
    setShelfCount(guestBookmarks().length)

    /*
     * ★ 開いている間は、後ろの頁を動かさない。
     *   スマホで小窓の上をなぞると、後ろの本文が流れていた。
     */
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = before
    }
  }, [show, onClose])

  if (!show || typeof document === 'undefined') return null

  const kind = kindOf(message)
  const { title, lead } = wordsOf(message, kind)
  const next = encodeURIComponent(here)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(18, 30, 38, 0.42)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="login-invite-card"
        style={{
          position: 'relative',
          width: 372,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          /* ★ 上に淡い青を敷き、絵のまわりに空気をつくる */
          background: 'linear-gradient(180deg, #f1f6f9 0px, #ffffff 170px)',
          border: '1px solid #e6edf1',
          borderRadius: 22,
          padding: '30px 28px 22px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(16, 38, 54, 0.22), 0 2px 6px rgba(16, 38, 54, 0.06)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            width: 30,
            height: 30,
            border: 0,
            borderRadius: 999,
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ×
        </button>

        {kind === 'saved' ? (
          /* ============ D しおりを保存しました ============ */
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <svg width="44" height="36" viewBox="0 0 44 36" aria-hidden="true">
                <path d="M15 4 h14 v26 l-7 -6 l-7 6 z" fill="#1f4e6b" className="login-invite-drop" />
                <path className="login-invite-rays" d="M6 10 l4 2 M38 10 l-4 2 M4 20 h4 M40 20 h-4" stroke="#9fb8c9" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em', color: '#172a36' }}>
              {title}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#4d5a62' }}>{lead}</p>

            {shelfCount >= 2 && (
              /*
               * ★ この端末の本棚に、何冊たまっているか。
               *   冊数が増えるほど、「消えたら困る」と感じてもらえる。
               */
              <p className="login-invite-shelf">
                この端末の本棚　<b>{shelfCount}</b> 冊
              </p>
            )}

            <div className="login-invite-art" style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 12px' }}>
              <div className="login-invite-float">
                <SaveArt />
              </div>
            </div>

            <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.9, color: '#26343d' }}>
              会員登録をすると、
              <br />
              どの端末でも続きから読めます
            </p>
          </>
        ) : (
          <>
            <div className="login-invite-art" style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div className="login-invite-float">
                {kind === 'save' ? <SaveArt /> : kind === 'support' ? <SupportArt /> : <BookArt />}
              </div>
              {kind === 'support' &&
                /* 手紙から、小さなハートがふわりと三つ昇る */
                [0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="login-invite-heart"
                    style={{ left: `${44 + i * 6}%`, animationDelay: `${0.7 + i * 0.35}s`, fontSize: 12 + (i % 2) * 4 }}
                  >
                    ♥
                  </span>
                ))}
            </div>

            <h2 style={{ margin: '8px 0 8px', fontSize: 19, fontWeight: 700, lineHeight: 1.55, letterSpacing: '0.02em', color: '#172a36' }}>
              {title}
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: '#4d5a62' }}>{lead}</p>

            {kind === 'support' ? (
              /* 応援のしかた。押せる印ではなく、登録するとできることの見本 */
              <div style={{ display: 'flex', justifyContent: 'center', gap: 22, margin: '22px 0 24px' }}>
                {[
                  { icon: <ChatIcon />, label: '感想を送る', bg: '#eaf1f5' },
                  { icon: <HeartIcon />, label: 'いいねで応援', bg: '#f8e9ec' },
                  { icon: <FollowIcon />, label: 'フォローする', bg: '#eaf1f5' },
                ].map((one, index) => (
                  <div key={one.label} className="login-invite-pop" style={{ animationDelay: `${0.18 + index * 0.09}s` }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        margin: '0 auto 8px',
                        boxShadow: '0 4px 10px rgba(31, 78, 107, 0.08)',
                        borderRadius: 999,
                        background: one.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {one.icon}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#4d5a62' }}>{one.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: '20px 0 22px', padding: '10px 16px', textAlign: 'left', background: '#f5f8fa', borderRadius: 14 }}>
                {[
                  { icon: <BookIcon />, text: 'どの端末でも、続きから読める' },
                  { icon: <BellIcon />, text: '好きな作品の更新をお知らせ' },
                  { icon: <StarIcon />, text: 'お気に入りの作品を本棚で管理' },
                ].map((one, index) => (
                  <li
                    key={one.text}
                    className="login-invite-rise"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 0',
                      fontSize: 13.5,
                      color: '#26343d',
                      animationDelay: `${0.12 + index * 0.08}s`,
                    }}
                  >
                    {one.icon}
                    {one.text}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <Link
          href={`/login?mode=signup&next=${next}`}
          className="login-invite-cta"
          style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'block',
            padding: '14px 10px',
            borderRadius: 12,
            /* ★ お手本と同じ、紺から深い青へのやわらかな段階 */
            background: 'linear-gradient(135deg, #2f6f93 0%, #1f4e6b 55%, #183f57 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textDecoration: 'none',
            boxShadow: '0 8px 18px rgba(31, 78, 107, 0.28)',
          }}
        >
          {kind === 'support' ? '会員登録して応援する' : '無料で会員登録する'}
        </Link>

        <Link
          href={`/login?next=${next}`}
          style={{ display: 'block', marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', textDecoration: 'none' }}
        >
          ログインはこちら
        </Link>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 6,
            border: 0,
            background: 'transparent',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          あとで
        </button>
      </div>

      <style>{`
        .login-invite-rise { animation: loginInviteRise .35s ease-out both; }
        .login-invite-drop { animation: loginInviteDrop .45s .1s ease-out both; transform-origin: 22px 4px; }

        /* ---- 効果（はっきり見えるように。ただし光や星のきらめきは使わない） ---- */
        /* 小窓が、少し弾んで出る */
        .login-invite-card { animation: loginInviteSpring .55s cubic-bezier(.2,1.35,.4,1) both !important; }
        /* 絵が、ぽんと出てから、ゆっくり上下に揺れる */
        .login-invite-art { animation: loginInvitePopArt .6s .12s cubic-bezier(.3,1.5,.5,1) both; }
        .login-invite-float { animation: loginInviteFloat 3.6s ease-in-out 1s infinite; }
        /* 本のしおりが、上から弾んで下りる */
        .lia-ribbon { transform-box: fill-box; transform-origin: 50% 0; animation: loginInviteDrop .7s .45s cubic-bezier(.3,1.6,.5,1) both; }
        /* 手紙のハートが、三度鼓動する */
        .lia-heart { transform-box: fill-box; transform-origin: 50% 50%; animation: loginInviteBeat .8s .5s ease-in-out 3; }
        /* 手紙から昇る小さなハート */
        .login-invite-heart { position: absolute; bottom: 38px; color: #e28b98; opacity: 0; pointer-events: none;
          animation: loginInviteRiseHeart 2.2s ease-out 3; }
        /* 保存の印のまわりの線が、ぱっと広がる */
        .login-invite-rays { transform-box: fill-box; transform-origin: 50% 50%; animation: loginInviteRays .7s .35s cubic-bezier(.3,1.6,.5,1) both; }
        /* 応援の印が、順にぽんと出る */
        .login-invite-pop { animation: loginInvitePop .5s cubic-bezier(.3,1.7,.5,1) both; }
        /* 登録の押し具：光がときどき横切り、やわらかく息をする */
        .login-invite-cta { animation: loginInviteBreath 2.8s ease-in-out 1.2s 4; transition: transform .15s; }
        .login-invite-cta::after {
          content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
          transform: skewX(-18deg); animation: loginInviteSheen 3.2s .8s ease-in-out 3; pointer-events: none;
        }
        .login-invite-cta:hover { transform: translateY(-2px); }
        .login-invite-cta:hover::after { animation: loginInviteSheenOnce .8s ease-in-out both; }
        .login-invite-shelf { display: inline-block; margin: 10px 0 0; padding: 4px 12px; border-radius: 999px; background: #eaf1f5;
          font-size: 12px; color: var(--color-brand); animation: loginInvitePop .45s .6s cubic-bezier(.3,1.7,.5,1) both; }
        .login-invite-shelf b { font-size: 14px; }
        @keyframes loginInviteRise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes loginInviteDrop { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes loginInviteSpring { from { opacity: 0; transform: translateY(24px) scale(.92) } to { opacity: 1; transform: none } }
        @keyframes loginInvitePopArt { from { opacity: 0; transform: scale(.7) } to { opacity: 1; transform: none } }
        @keyframes loginInviteFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes loginInviteBeat { 0%, 100% { transform: scale(1) } 35% { transform: scale(1.3) } 65% { transform: scale(.95) } }
        @keyframes loginInviteRiseHeart { 0% { opacity: 0; transform: translateY(0) scale(.6) } 20% { opacity: .9 } 100% { opacity: 0; transform: translateY(-46px) scale(1) } }
        @keyframes loginInviteRays { from { opacity: 0; transform: scale(.3) } to { opacity: 1; transform: none } }
        @keyframes loginInvitePop { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
        @keyframes loginInviteBreath { 0%, 100% { box-shadow: 0 8px 18px rgba(31,78,107,.28) } 50% { box-shadow: 0 10px 26px rgba(31,78,107,.46) } }
        @keyframes loginInviteSheen { 0% { left: -40% } 35%, 100% { left: 120% } }
        @keyframes loginInviteSheenOnce { from { left: -40% } to { left: 120% } }
        @media (prefers-reduced-motion: reduce) {
          .login-invite-card, .login-invite-rise, .login-invite-drop, .login-invite-float, .lia-ribbon,
          .lia-heart, .login-invite-rays, .login-invite-pop, .login-invite-cta, .login-invite-cta::after,
          .login-invite-art, .login-invite-shelf { animation: none !important; }
          .login-invite-heart { display: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
