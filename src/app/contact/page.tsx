import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'
import ContactForm from '@/components/contact/contact-form'

const navLinks = [
  { href: '/about',    label: '原石航路とは' },
  { href: '/guide',    label: '投稿ガイド' },
  { href: '/faq',      label: 'よくある質問' },
  { href: '/help',     label: 'ヘルプ・FAQ' },
  { href: '/contact',  label: 'お問い合わせ', active: true },
  { href: '/feedback', label: 'ご意見・ご要望' },
]

export default function ContactPage() {

  return (
    <div className="page-with-footer" style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div style={{background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto'}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 24px',display:'flex'}}>
          {navLinks.map(n => (
            <Link key={n.href} href={n.href}
              style={{padding:'12px 18px',fontSize:13,color:(n as any).active?'var(--color-brand)':'var(--color-text-muted)',textDecoration:'none',whiteSpace:'nowrap',
                borderBottom:(n as any).active?'2px solid var(--color-brand)':'2px solid transparent',fontWeight:(n as any).active?700:400}}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{maxWidth:720,margin:'0 auto',padding:'40px 24px 60px'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:24,fontWeight:700,color:'var(--color-text)',marginBottom:4}}>お問い合わせ</h1>
          <p style={{fontSize:13,color:'var(--color-text-muted)'}}>ご不明な点はお気軽にお問い合わせください</p>
        </div>

        {/* 確認事項 */}
        <div style={{background:'var(--color-brand-light)',border:'1px solid var(--color-tag-border)',borderRadius:12,padding:'16px 20px',marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-brand)',marginBottom:8}}>お問い合わせ前にご確認ください</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {['よくある質問に同じ内容がないか','ヘルプ・FAQに解決方法がないか','ブラウザの再読み込みで解決しないか','ログアウト・再ログインで解決しないか'].map((item,i) => (
              <div key={i} style={{fontSize:12,color:'var(--color-text)',display:'flex',gap:6}}>
                <span style={{color:'var(--color-brand)'}}>✓</span>{item}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10,marginTop:10}}>
            <Link href="/faq" style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none',border:'1px solid var(--color-tag-border)',borderRadius:8,padding:'4px 12px',background:'var(--color-bg)'}}>よくある質問</Link>
            <Link href="/help" style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none',border:'1px solid var(--color-tag-border)',borderRadius:8,padding:'4px 12px',background:'var(--color-bg)'}}>ヘルプ・FAQ</Link>
          </div>
        </div>

        {/* お問い合わせフォーム */}
        <ContactForm />
      </div>
      <Footer />
    </div>
  )
}
