import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'

type NavLink = { href: string; label: string; active?: boolean }
type SectionItem = { label: string; desc: string }
type Section = {
  id: string; title: string; content?: string; note?: string
  items?: SectionItem[]; list?: string[]; examples?: string[]
}

const navLinks: NavLink[] = [
  { href: '/about',    label: '原石航路とは' },
  { href: '/guide',    label: '投稿ガイド', active: true },
  { href: '/faq',      label: 'よくある質問' },
  { href: '/help',     label: 'ヘルプ・FAQ' },
  { href: '/contact',  label: 'お問い合わせ' },
  { href: '/feedback', label: 'ご意見・ご要望' },
]

const sections: Section[] = [
  { id:'register', title:'原石航路で作品を投稿するには',
    content:'アカウント登録後に作品を投稿できます。投稿できる作品は、ユーザー自身が創作したオリジナル作品、または正当な権利を持っている作品に限ります。他者の作品・文章・設定・画像などを無断で使用することはできません。' },
  { id:'type', title:'投稿タイプ',
    items:[
      { label:'新連載', desc:'新しい作品の第1話を投稿する場合に選択します。' },
      { label:'連載中の作品に追加', desc:'すでに投稿している作品に新しい話を追加する場合に選択します。' },
    ] },
  { id:'length', title:'作品の長さ',
    items:[
      { label:'長編', desc:'複数話にわたる作品、または連載を前提とした作品です。' },
      { label:'短編', desc:'1話で完結する作品です。' },
    ] },
  { id:'input', title:'投稿時に入力する内容',
    list:['作品タイトル（必須）','あらすじ','作品の長さ（必須）','ジャンル（必須）','タグ','話タイトル（必須）','前書き','挿絵','本文（必須）','あとがき','公開・下書き設定'],
    note:'必須項目は作品タイトル・作品の長さ・ジャンル・話タイトル・本文です。' },
  { id:'chars', title:'文字数について',
    list:['前書き：最大20,000文字','本文：最低500文字、最大100,000文字','あとがき：最大20,000文字'],
    note:'本文が500文字未満の場合、公開できません。' },
  { id:'tags', title:'タグについて',
    content:'タグは作品の特徴を読者に伝えるためのものです。1作品につき最大10個まで設定できます。',
    examples:['魔法','現代ファンタジー','学園','契約','復讐','成長','群像劇','バディ','ダークファンタジー'] },
  { id:'preface', title:'前書き・あとがきについて',
    items:[
      { label:'前書き', desc:'本文の前に表示される作者からの補足欄です。' },
      { label:'あとがき', desc:'本文の後に表示される作者からの補足欄です。' },
    ],
    note:'誹謗中傷・過度な宣伝・出会い目的の誘導は書かないでください。' },
  { id:'illust', title:'挿絵について',
    content:'投稿画面では本文の上に表示する挿絵を追加できます。対応形式：JPG・PNG・GIF・WEBP。自分で制作した画像、または正当な利用許可を得た画像のみ投稿できます。' },
  { id:'age', title:'年齢区分について',
    items:[
      { label:'全年齢', desc:'年齢を問わず閲覧できます。' },
      { label:'R15', desc:'暴力表現・軽度の性的表現を含む作品に設定してください。' },
      { label:'R18', desc:'成人向け表現を含む作品。ログイン済み18歳以上のみ表示されます。' },
    ] },
  { id:'ai', title:'AI利用について',
    content:'AI生成文章を主たる内容とする作品の投稿は禁止しています。表紙や挿絵にAIで作った画像を使うことはできますが、申告が必要です。',
    items:[
      { label:'許可される利用', desc:'誤字脱字の修正・文法校正・アイデア出しなど補助的な利用' },
      { label:'禁止される利用', desc:'AI生成文章のそのまま投稿・作品の大部分をAIに依存すること' },
      { label:'表紙・挿絵', desc:'AIで作った画像も使えます。設定で申告すると、表紙に印が出ます' },
      { label:'申告しない場合', desc:'画像の削除・作品の非公開などの対応をとることがあります' },
    ] },
]

export default function GuidePage() {

  return (
    <div className="page-with-footer" style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      {/* サブナビ */}
      <div style={{background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto'}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 16px',display:'flex'}}>
          {navLinks.map(n => (
            <Link key={n.href} href={n.href}
              style={{padding:'10px 14px',fontSize:12,color:n.active?'var(--color-brand)':'var(--color-text-muted)',textDecoration:'none',whiteSpace:'nowrap',
                borderBottom:n.active?'2px solid var(--color-brand)':'2px solid transparent',fontWeight:n.active?700:400}}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px 16px 60px',display:'flex',gap:24,alignItems:'flex-start'}}>

        {/* 目次（デスクトップのみ） */}
        <div className="desktop-only" style={{width:180,flexShrink:0,position:'sticky',top:80}}>
          <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'14px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>目次</div>
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`}
                style={{display:'block',fontSize:11,color:'var(--color-brand)',textDecoration:'none',padding:'4px 0',borderBottom:'1px solid var(--color-brand-light)'}}>
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* 本文 */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:22,fontWeight:700,color:'var(--color-text)',marginBottom:4}}>投稿ガイド</h1>
            <p style={{fontSize:12,color:'var(--color-text-muted)'}}>原石航路への作品投稿方法をご説明します</p>
          </div>

          {sections.map(s => (
            <div key={s.id} id={s.id} style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'16px',marginBottom:12}}>
              <h2 style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:4,height:16,background:'var(--color-brand)',borderRadius:2,display:'inline-block',flexShrink:0}}/>
                {s.title}
              </h2>
              {s.content && (
                <p style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,marginBottom:s.items||s.list||s.examples?10:0}}>
                  {s.content}
                </p>
              )}
              {s.items && (
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:s.note?10:0}}>
                  {s.items.map((item,i) => (
                    <div key={i} style={{background:'var(--color-bg-card)',borderRadius:8,padding:'10px 12px',borderLeft:'3px solid var(--color-brand)'}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--color-brand)',marginBottom:3}}>{item.label}</div>
                      <div style={{fontSize:12,color:'var(--color-text)',lineHeight:1.7}}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              {s.list && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:s.note?10:0}}>
                  {s.list.map((item,i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--color-text)',padding:'5px 8px',background:'var(--color-bg-card)',borderRadius:6}}>
                      <span style={{color:'var(--color-brand)',fontWeight:700,fontSize:10,flexShrink:0}}>▶</span>{item}
                    </div>
                  ))}
                </div>
              )}
              {s.examples && (
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
                  {s.examples.map((ex,i) => (
                    <span key={i} style={{fontSize:11,padding:'2px 8px',background:'var(--color-brand-light)',color:'var(--color-brand)',border:'1px solid var(--color-tag-border)',borderRadius:10}}>#{ex}</span>
                  ))}
                </div>
              )}
              {s.note && (
                <div style={{fontSize:12,color:'var(--color-brand)',background:'var(--color-brand-light)',border:'1px solid var(--color-tag-border)',borderRadius:8,padding:'8px 10px',marginTop:8}}>
                  ⚠ {s.note}
                </div>
              )}
            </div>
          ))}

          <div style={{textAlign:'center',marginTop:24}}>
            <Link href="/post" style={{display:'inline-block',padding:'12px 32px',background:'var(--color-brand)',color:'var(--color-bg-card)',borderRadius:24,fontSize:14,fontWeight:700,textDecoration:'none'}}>
              作品を投稿する →
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
