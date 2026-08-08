import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'

export default function AboutPage() {

  const features = [
    { icon: '✍️', title: '誰でも投稿できる', desc: 'アカウント登録をすれば誰でも作品を投稿できます。長編・短編・連載作品・読み切り作品など、さまざまな形の小説を投稿できます。' },
    { icon: '⛏️', title: '読者が作品を発掘できる', desc: '「発掘する」は、まだ知られていないけれど面白い、もっと読まれてほしいと感じたときに押す反応です。読者が作品を見つけ、応援し、広げる側にもなれます。' },
    { icon: '💎', title: '原石発掘で作品を見つけやすい', desc: 'PV数だけでなく、保存率・発掘反応・新人補正・独創性なども参考にして作品を紹介します。埋もれた名作が見つかりやすくなっています。' },
    { icon: '🕊️', title: '作家の自由を大切にする', desc: 'ジャンルそのものを独創性評価の対象にはしません。作品のテーマ・主人公・舞台・タグの組み合わせ・読者の反応を参考にして作品の魅力を見つけます。' },
  ]

  const values = [
    'まだ見つかっていない作品を発掘すること',
    '新人作家にも見つけられる機会をつくること',
    '読者が作品の成長に参加できること',
    'PV数だけでなく、読者の熱量を大切にすること',
    '独創性と読者満足度の両方を評価すること',
    '作家の自由を妨げないこと',
    '安心して読める・投稿できる場所をつくること',
  ]

  const navLinks = [
    { href: '/about',    label: '原石航路とは', active: true },
    { href: '/guide',    label: '投稿ガイド' },
    { href: '/faq',      label: 'よくある質問' },
    { href: '/help',     label: 'ヘルプ・FAQ' },
    { href: '/contact',  label: 'お問い合わせ' },
    { href: '/feedback', label: 'ご意見・ご要望' },
  ]

  return (
    <div className="page-with-footer" style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      {/* ヒーロー */}
      <div style={{background:'linear-gradient(135deg,var(--color-brand),var(--color-brand))',padding:'56px 32px',textAlign:'center'}}>
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <div style={{fontSize:13,color:'color-mix(in srgb, var(--base-color-1) 80%, transparent)',fontWeight:600,marginBottom:8,letterSpacing:2}}>GENSEKI KORO</div>
          <h1 style={{fontFamily:"'Noto Serif JP',serif",fontSize:36,fontWeight:700,color:'var(--color-text-inverse)',lineHeight:1.4,marginBottom:16}}>
            次のブームは、<br/>ここから生まれる
          </h1>
          <p style={{fontSize:15,color:'color-mix(in srgb, var(--base-color-1) 90%, transparent)',lineHeight:1.9}}>
            原石航路は、まだ知られていない物語の原石を、<br/>読者とともに発掘するライトノベル投稿サイトです。
          </p>
          <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24,flexWrap:'wrap'}}>
            <Link href="/post" style={{padding:'12px 28px',background:'var(--color-bg)',color:'var(--color-brand)',borderRadius:24,textDecoration:'none',fontSize:14,fontWeight:700}}>
              作品を投稿する
            </Link>
            <Link href="/search" style={{padding:'12px 28px',background:'color-mix(in srgb, var(--base-color-1) 20%, transparent)',color:'var(--color-text-inverse)',border:'1.5px solid color-mix(in srgb, var(--color-text-inverse) 50%, transparent)',borderRadius:24,textDecoration:'none',fontSize:14,fontWeight:600}}>
              作品を探す
            </Link>
          </div>
        </div>
      </div>

      {/* サブナビ */}
      <div style={{background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto'}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 24px',display:'flex',gap:0}}>
          {navLinks.map(n => (
            <Link key={n.href} href={n.href}
              style={{padding:'12px 18px',fontSize:13,color:n.active?'var(--color-brand)':'var(--color-text-muted)',textDecoration:'none',whiteSpace:'nowrap',
                borderBottom:n.active?'2px solid var(--color-brand)':'2px solid transparent',fontWeight:n.active?700:400}}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'40px 24px 60px'}}>

        {/* 説明文 */}
        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'28px 32px',marginBottom:28}}>
          <p style={{fontSize:14,color:'var(--color-text)',lineHeight:2,marginBottom:16}}>
            誰でも小説を投稿でき、誰でも作品を読むことができます。異世界、ファンタジー、SF、恋愛、学園、ミステリー、ホラー、歴史・時代、日常、アクション、コメディなど、さまざまなジャンルの作品を楽しめます。
          </p>
          <p style={{fontSize:14,color:'var(--color-text)',lineHeight:2}}>
            原石航路が目指しているのは、単に人気作品を並べるサイトではありません。<br/>
            <strong>まだ読まれていないけれど面白い作品。今は小さな反応しかないけれど、読者に深く刺さっている作品。</strong><br/>
            そうした物語が埋もれないように、読者と一緒に見つけていく場所です。
          </p>
        </div>

        {/* 特徴 */}
        <h2 style={{fontSize:20,fontWeight:700,color:'var(--color-text)',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:4,height:22,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
          原石航路の特徴
        </h2>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:32}}>
          {features.map((f, i) => (
            <div key={i} style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'22px',display:'flex',gap:14,alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:6}}>{f.title}</div>
                <div style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.8}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 価値観 */}
        <h2 style={{fontSize:20,fontWeight:700,color:'var(--color-text)',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:4,height:22,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
          原石航路が大切にしたいこと
        </h2>
        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'24px 28px',marginBottom:32}}>
          {values.map((v, i) => (
            <div key={i} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:i<values.length-1?'1px solid var(--color-brand-light)':'none',alignItems:'center'}}>
              <span style={{width:24,height:24,background:'var(--color-brand)',color:'var(--color-text-inverse)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</span>
              <span style={{fontSize:14,color:'var(--color-text)'}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{background:'linear-gradient(135deg,var(--color-brand-light),var(--color-bg))',border:'1px solid var(--color-tag-border)',borderRadius:12,padding:'24px 28px',textAlign:'center'}}>
          <p style={{fontSize:15,color:'var(--color-text)',lineHeight:1.9,marginBottom:16}}>
            原石航路は、人気作品だけを読む場所ではありません。<br/>
            <strong>人気になる前の作品を、読者と一緒に見つける場所です。</strong>
          </p>
          <Link href="/post" style={{display:'inline-block',padding:'12px 32px',background:'var(--color-brand)',color:'var(--color-text-inverse)',borderRadius:24,textDecoration:'none',fontSize:14,fontWeight:700}}>
            今すぐ投稿する
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
