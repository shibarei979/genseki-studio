/**
 * ============================================================
 * 原石航路 Studio
 * /welcome  登録したあとに、2つ聞く
 *
 * ★ 前の版（genseki-koro-nextjs）の home-select をそのまま持ってきた。
 *   見た目はそちらのまま。保存先だけ、いまの列に合わせてある。
 *
 *     読者か作家か   user_role      → home_mode
 *     AI作品を見るか  show_ai_works  → そのまま
 *     書く人のAI使用  default_ai_usage → いまは列が無いので保存しない
 * ============================================================
 */
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TEAL = '#2A9D8F'

export default function HomeSelectPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [step, setStep] = useState<'role' | 'ai'>('role')
  const [role, setRole] = useState<'reader' | 'writer' | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    })
  }, [])

  async function handleSelectRole(r: 'reader' | 'writer') {
    if (!userId) return
    setLoading(true)
    /*
     * 読者か作家かを覚える。
     *
     * ★ 前の版は user_role という列に入れていた。
     *   いまの仕組みには無いので、home_mode に入れる。
     *   ホームの見せ方を決めている列で、意味も同じ。
     */
    await supabase
      .from('profiles')
      .update({ home_mode: r === 'reader' ? 'read' : 'write' })
      .eq('user_id', userId)
    setRole(r)
    setStep('ai')
    setLoading(false)
  }

  async function handleReaderAi(show: boolean) {
    if (!userId) return
    setLoading(true)
    await supabase.from('profiles').update({ show_ai_works: show }).eq('user_id', userId)
    router.push('/')
  }

  async function handleWriterAi(usage: 'none' | 'assist' | 'full') {
    if (!userId) return
    setLoading(true)
    /*
     * ★ 前の版は default_ai_usage に入れていた。
     *   いまの仕組みには無い列なので、保存しない。
     *
     *   書く人にも「AI が書いた作品を見るか」は要るので、
     *   そちらは読者と同じ問いにまとめてある。
     */
    void usage
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(165deg, #FFFDFB 0%, #FFF6EC 55%, #FFF0E0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Noto Sans JP', sans-serif",
      padding: '32px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        .bg-blob { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; }
        .bg-dot  { position: absolute; border-radius: 50%; pointer-events: none; }
        @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        .role-illust { position: absolute; bottom: 0; height: min(78vh, 620px); object-fit: contain; pointer-events: none; user-select: none; }
        .role-illust-left  { left: max(-40px, calc(50% - 760px)); }
        .role-illust-right { right: max(-40px, calc(50% - 760px)); }
        @media (max-width: 1100px) { .role-illust { display: none; } }
        .role-card { transition: transform .18s, box-shadow .18s; }
        .role-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
      `}</style>

      {/* 背景装飾 */}
      <div className="bg-blob" style={{ width: 460, height: 460, background: 'rgba(242,106,33,0.10)', top: '-140px', left: '-120px' }}/>
      <div className="bg-blob" style={{ width: 400, height: 400, background: 'rgba(42,157,143,0.09)', bottom: '-130px', right: '-110px' }}/>
      <div className="bg-blob" style={{ width: 300, height: 300, background: 'rgba(245,166,35,0.07)', top: '18%', right: '12%' }}/>
      <div className="bg-dot" style={{ width: 10, height: 10, background: 'rgba(242,106,33,0.28)', top: '16%', left: '18%', animation: 'floaty 6s ease-in-out infinite' }}/>
      <div className="bg-dot" style={{ width: 7, height: 7, background: 'rgba(42,157,143,0.30)', top: '68%', left: '24%', animation: 'floaty 7s ease-in-out infinite .8s' }}/>
      <div className="bg-dot" style={{ width: 12, height: 12, background: 'rgba(245,166,35,0.25)', top: '26%', right: '20%', animation: 'floaty 8s ease-in-out infinite .4s' }}/>
      <div className="bg-dot" style={{ width: 8, height: 8, background: 'rgba(242,106,33,0.22)', bottom: '20%', right: '26%', animation: 'floaty 6.5s ease-in-out infinite 1.2s' }}/>

      {step === 'role' && (
        <>
          {/* 左右のイラスト */}
          <img src="/writer.png" alt="" className="role-illust role-illust-left"/>
          <img src="/reader.png" alt="" className="role-illust role-illust-right"/>

          {/* ロゴ */}
          <img src="/logo.png" alt="原石航路"
            style={{ height: 'clamp(74px, 9vw, 108px)', objectFit: 'contain', marginBottom: 22, zIndex: 1, filter: 'drop-shadow(0 3px 10px rgba(242,106,33,0.16))' }}/>

          <h1 style={{ fontSize: 'clamp(24px, 3.4vw, 34px)', fontWeight: 800, color: '#333', marginBottom: 12, textAlign: 'center', letterSpacing: '0.05em', zIndex: 1 }}>
            ようこそ、原石航路へ
          </h1>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 40, textAlign: 'center', zIndex: 1 }}>
            あなたはどちら？
          </p>

          {/* 2枚のカード */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'stretch', zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* 書く人 */}
            <button onClick={() => handleSelectRole('writer')} disabled={loading} className="role-card"
              style={{ width: 260, background: '#fff', border: '1px solid #F0E4D8', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '36px 24px 28px', flex: 1 }}>
                <div style={{ width: 76, height: 76, margin: '0 auto 22px', borderRadius: '50%', border: `1.5px solid #F5C9A8`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 3c-7 1-12 6-14 12l-3 6 6-3c6-2 11-7 12-14z"/><path d="M14 8c-3 2-6 5-8 9"/>
                  </svg>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-brand)', marginBottom: 10, letterSpacing: '0.06em' }}>書く人</div>
                <div style={{ fontSize: 14, color: '#666' }}>物語を投稿したい</div>
              </div>
              <div style={{ background: 'var(--color-brand)', color: '#fff', padding: '18px 20px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                書く人ではじめる
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>

            {/* 読む人 */}
            <button onClick={() => handleSelectRole('reader')} disabled={loading} className="role-card"
              style={{ width: 260, background: '#fff', border: '1px solid #DDEEEB', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '36px 24px 28px', flex: 1 }}>
                <div style={{ width: 76, height: 76, margin: '0 auto 22px', borderRadius: '50%', border: `1.5px solid #A8D8D2`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: TEAL, marginBottom: 10, letterSpacing: '0.06em' }}>読む人</div>
                <div style={{ fontSize: 14, color: '#666' }}>物語を楽しみたい</div>
              </div>
              <div style={{ background: TEAL, color: '#fff', padding: '18px 20px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                読む人ではじめる
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 40, fontSize: 13, color: '#888', zIndex: 1 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            あとから設定でいつでも変更できます
          </div>
        </>
      )}

      {step === 'ai' && role === 'reader' && (
        <>
          <img src="/logo.png" alt="原石航路"
            style={{ height: 'clamp(62px, 7vw, 86px)', objectFit: 'contain', marginBottom: 20, zIndex: 1, filter: 'drop-shadow(0 3px 10px rgba(242,106,33,0.16))' }}/>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: '#333', marginBottom: 12, textAlign: 'center', letterSpacing: '0.04em' }}>
            <span style={{ color: 'var(--color-brand)' }}>AI作品</span>を表示しますか？
          </h1>
          <p style={{ fontSize: 14.5, color: '#666', marginBottom: 40, textAlign: 'center', lineHeight: 1.9 }}>
            AIが全面的に生成した作品の表示を選べます
          </p>

          <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => handleReaderAi(true)} disabled={loading} className="role-card"
              style={{ width: 250, background: '#fff', border: '1px solid #F0E4D8', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '32px 22px 24px', flex: 1 }}>
                <div style={{ width: 68, height: 68, margin: '0 auto 18px', borderRadius: '50%', border: '1.5px solid #F5C9A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
                  </svg>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-brand)', marginBottom: 10, letterSpacing: '0.04em' }}>表示する</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>AI作品も人間の作品も<br/>すべて楽しみたい</div>
              </div>
              <div style={{ background: 'var(--color-brand)', color: '#fff', padding: '16px 20px', fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                これではじめる
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>

            <button onClick={() => handleReaderAi(false)} disabled={loading} className="role-card"
              style={{ width: 250, background: '#fff', border: '1px solid #DDEEEB', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '32px 22px 24px', flex: 1 }}>
                <div style={{ width: 68, height: 68, margin: '0 auto 18px', borderRadius: '50%', border: '1.5px solid #A8D8D2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 3c-7 1-12 6-14 12l-3 6 6-3c6-2 11-7 12-14z"/><path d="M14 8c-3 2-6 5-8 9"/>
                  </svg>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: TEAL, marginBottom: 10, letterSpacing: '0.04em' }}>表示しない</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>人の手で書かれた<br/>作品だけを読みたい</div>
              </div>
              <div style={{ background: TEAL, color: '#fff', padding: '16px 20px', fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                これではじめる
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          </div>
        </>
      )}

      {step === 'ai' && role === 'writer' && (
        <>
          <img src="/logo.png" alt="原石航路"
            style={{ height: 'clamp(62px, 7vw, 86px)', objectFit: 'contain', marginBottom: 20, zIndex: 1, filter: 'drop-shadow(0 3px 10px rgba(242,106,33,0.16))' }}/>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: '#333', marginBottom: 12, textAlign: 'center', letterSpacing: '0.04em' }}>
            執筆で<span style={{ color: 'var(--color-brand)' }}>AI</span>を使いますか？
          </h1>
          <p style={{ fontSize: 14.5, color: '#666', marginBottom: 40, textAlign: 'center', lineHeight: 1.9 }}>
            投稿時のデフォルト設定になります。作品ごとに変更できます
          </p>

          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center' }}>
            {([
              { v: 'none',   label: 'AI未使用',   desc: 'AIを使わずに\n自分の言葉で執筆する', color: TEAL, border: '#DDEEEB', ring: '#A8D8D2',
                icon: <><path d="M20 3c-7 1-12 6-14 12l-3 6 6-3c6-2 11-7 12-14z"/><path d="M14 8c-3 2-6 5-8 9"/></> },
              { v: 'assist', label: '補助的利用', desc: '校正・アイデア出し等に\nAIを利用する', color: 'var(--color-brand)', border: '#F0E4D8', ring: '#F5C9A8',
                icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/> },
              { v: 'full',   label: '全面的利用', desc: '本文生成などAIが主体\n（AI作品バッジが付きます）', color: '#9B5DE5', border: '#EADDF8', ring: '#C9A8E8',
                icon: <><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></> },
            ] as const).map(opt => (
              <button key={opt.v} onClick={() => handleWriterAi(opt.v as any)} disabled={loading} className="role-card"
                style={{ width: 230, background: '#fff', border: `1px solid ${opt.border}`, borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '30px 20px 22px', flex: 1 }}>
                  <div style={{ width: 62, height: 62, margin: '0 auto 16px', borderRadius: '50%', border: `1.5px solid ${opt.ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={opt.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{opt.icon}</svg>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: opt.color, marginBottom: 10, letterSpacing: '0.04em' }}>{opt.label}</div>
                  <div style={{ fontSize: 12.5, color: '#666', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{opt.desc}</div>
                </div>
                <div style={{ background: opt.color, color: '#fff', padding: '15px 18px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  これではじめる
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'ai' && (
        <button onClick={() => router.push('/')}
          style={{ marginTop: 24, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-faint)', textDecoration: 'underline' }}>
          スキップしてホームへ
        </button>
      )}
    </div>
  )
}
