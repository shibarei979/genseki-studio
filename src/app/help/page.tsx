import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'

const navLinks: {href:string;label:string;active?:boolean}[] = [
  { href: '/about',    label: '原石航路とは' },
  { href: '/guide',    label: '投稿ガイド' },
  { href: '/faq',      label: 'よくある質問' },
  { href: '/help',     label: 'ヘルプ・FAQ', active: true },
  { href: '/contact',  label: 'お問い合わせ' },
  { href: '/feedback', label: 'ご意見・ご要望' },
]

const helpCategories = [
  {
    label: 'アカウントについて', icon: '👤',
    items: [
      { q: 'アカウント登録ができません', a: '入力したメールアドレスに誤りがないか確認してください。迷惑メールフォルダに確認メールが届いていないかも確認してください。それでも登録できない場合はお問い合わせください。' },
      { q: 'ログインできません', a: 'メールアドレスやパスワードに誤りがないか確認してください。Googleログインを利用している場合は、登録時と同じ方法でログインしてください。' },
      { q: 'パスワードを忘れました', a: 'ログイン画面の「パスワードを忘れた方はこちら」から再設定を行ってください。登録メールアドレス宛に再設定用のリンクが届きます。' },
      { q: 'メールアドレスを変更したい', a: 'マイページの設定（歯車アイコン）から「メールアドレスを変更」を選択してください。現在のパスワードの確認が必要です。' },
      { q: 'パスワードを変更したい', a: 'マイページの設定（歯車アイコン）から「パスワードを変更」を選択してください。現在のパスワードの確認が必要です。' },
    ]
  },
  {
    label: '投稿について', icon: '📝',
    items: [
      { q: '投稿画面で何を入力すればいいですか？', a: '作品タイトル・作品の長さ・ジャンル・話タイトル・本文は必須です。あらすじ・前書き・挿絵・あとがきは任意です。' },
      { q: '下書き保存した作品はどこで確認できますか？', a: 'マイページから確認できます。下書きは公開されていないため他のユーザーには表示されません。' },
      { q: '投稿ボタンを押したらすぐ公開されますか？', a: '基本的には投稿ボタンを押すと作品またはエピソードが公開されます。公開前にタイトル・本文・ジャンル・タグ・年齢区分をよく確認してください。' },
      { q: '連載作品に続きを追加したいです', a: '投稿画面で「連載中の作品に追加」を選択してください。追加したい作品を選び、新しい話タイトルと本文を入力してください。' },
      { q: '本文の文字サイズ変更は読者にも反映されますか？', a: '投稿画面の文字サイズ変更は作者が書きやすくするための編集補助機能です。読者側の表示文字サイズを強制するものではありません。' },
    ]
  },
  {
    label: '閲覧について', icon: '📚',
    items: [
      { q: '作品を探すにはどうすればいいですか？', a: '検索バー・ジャンル一覧・タグ・ランキング・原石発掘などから作品を探せます。' },
      { q: 'R18作品が表示されません', a: 'R18作品はログイン済みかつ18歳以上であることを確認したユーザーにのみ表示されます。' },
      { q: '保存した作品はどこで見られますか？', a: 'マイページ内の保存作品一覧から確認できます。' },
    ]
  },
  {
    label: '評価・コメントについて', icon: '💬',
    items: [
      { q: 'いいねを取り消せますか？', a: 'もう一度いいねボタンを押すことで解除できます。' },
      { q: '発掘するを押すとどうなりますか？', a: '作品に「発掘する」反応が記録されます。原石発掘や原石レコメンドなどの参考になる場合があります。' },
      { q: 'コメントを削除できますか？', a: 'コメント欄の自分のコメントに「削除」ボタンが表示されます。押すと確認の後、削除されます。' },
      { q: '誹謗中傷コメントを見つけました', a: '通報機能またはお問い合わせフォームからご連絡ください。運営が確認し必要に応じて削除や利用制限を行います。' },
    ]
  },
  {
    label: 'その他', icon: '⚙️',
    items: [
      { q: '退会したいです', a: 'マイページの設定（歯車アイコン）から「退会する」を選択してください。退会しても投稿作品は自動的に削除されません。削除したい場合は退会前に削除手続きを行ってください。' },
      { q: 'バグを見つけました', a: 'お問い合わせページからご連絡ください。発生したページ・操作方法・使用端末・使用ブラウザ・エラー文などを添えていただけると対応がスムーズです。' },
    ]
  },
]

export default function HelpPage() {

  return (
    <div className="page-with-footer" style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div style={{background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-border)',overflowX:'auto'}}>
        <div style={{maxWidth:860,margin:'0 auto',padding:'0 24px',display:'flex'}}>
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
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:24,fontWeight:700,color:'var(--color-text)',marginBottom:4}}>ヘルプ・FAQ</h1>
          <p style={{fontSize:13,color:'var(--color-text-muted)'}}>困ったときはこちらをご確認ください</p>
        </div>

        {/* クイックリンク */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:28}}>
          {helpCategories.map((cat,i) => (
            <a key={i} href={`#cat-${i}`}
              style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:10,padding:'14px',textDecoration:'none',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'var(--color-text)'}}>{cat.label}</span>
            </a>
          ))}
        </div>

        {helpCategories.map((cat,ci) => (
          <div key={ci} id={`cat-${ci}`} style={{marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <h2 style={{fontSize:16,fontWeight:700,color:'var(--color-text)'}}>{cat.label}</h2>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cat.items.map((item,i) => (
                <details key={i} style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:10,overflow:'hidden'}}>
                  <summary style={{padding:'14px 18px',fontSize:14,fontWeight:600,color:'var(--color-text)',cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:10}}>
                    <span style={{color:'var(--color-brand)',fontWeight:700,fontSize:16,flexShrink:0}}>Q</span>
                    {item.q}
                  </summary>
                  <div style={{padding:'12px 18px 14px',borderTop:'1px solid var(--color-brand-light)',display:'flex',gap:10,alignItems:'flex-start',background:'var(--color-bg)'}}>
                    <span style={{color:'#2563eb',fontWeight:700,fontSize:16,flexShrink:0}}>A</span>
                    <p style={{fontSize:13,color:'var(--color-text)',lineHeight:1.8,margin:0}}>{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}

        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'20px 24px',textAlign:'center'}}>
          <p style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:12}}>解決しない場合はお問い合わせください</p>
          <Link href="/contact" style={{padding:'10px 24px',background:'var(--color-brand)',color:'var(--color-text-inverse)',borderRadius:20,textDecoration:'none',fontSize:13,fontWeight:700}}>
            お問い合わせはこちら
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
