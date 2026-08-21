import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'

const navLinks: {href:string;label:string;active?:boolean}[] = [
  { href: '/about',    label: '原石航路とは' },
  { href: '/guide',    label: '投稿ガイド' },
  { href: '/faq',      label: 'よくある質問', active: true },
  { href: '/help',     label: 'ヘルプ・FAQ' },
  { href: '/contact',  label: 'お問い合わせ' },
  { href: '/feedback', label: 'ご意見・ご要望' },
]

const faqCategories = [
  {
    label: 'サービスについて', icon: '',
    items: [
      { q: '原石航路はどんなサイトですか？', a: '誰でも小説を投稿でき、誰でも作品を読めるライトノベル投稿サイトです。人気順だけでなく、まだ見つかっていない作品や新人作品を発掘しやすい仕組みが特徴です。' },
      { q: '無料で使えますか？', a: '基本的な投稿・閲覧・いいね・保存・コメント・発掘する機能は無料で利用できる想定です。今後、機能追加や運営方針の変更により一部仕様が変わる場合があります。' },
      { q: '「いいね」と「発掘する」は何が違いますか？', a: '「いいね」は作品が好き・面白い・応援したいと感じたときに使う反応です。「発掘する」は、まだ読者は少ないけれどもっと読まれてほしい・これは新しい・埋もれているのがもったいないと感じたときに使う反応です。' },
      { q: '「保存」は何に使いますか？', a: '後で読みたい作品や、続きを追いたい作品を覚えておくための機能です。' },
      { q: '原石発掘とは何ですか？', a: 'まだ読者に見つかっていない作品や、独創性・読者反応の高い作品を見つけやすくするための機能です。PV数だけでなく、発掘する反応・保存率・コメント率・新人補正なども参考にします。' },
    ]
  },
  {
    label: '投稿について', icon: '✍️',
    items: [
      { q: '誰でも投稿できますか？', a: 'アカウント登録を行えば誰でも作品を投稿できます。ただし、利用規約や投稿ガイドラインに違反する作品は非公開化や削除の対象になる場合があります。' },
      { q: '短編も投稿できますか？', a: '投稿できます。投稿時に「短編」を選択してください。1話完結の作品・掌編・読み切り作品などに向いています。' },
      { q: '連載作品は投稿できますか？', a: '投稿できます。新しい作品を始める場合は「新連載」を選択し、第2話以降は「連載中の作品に追加」を選択してください。' },
      { q: '本文の文字数制限はありますか？', a: '本文は最低500文字・最大100,000文字を想定しています。前書きとあとがきはそれぞれ最大20,000文字です。' },
      { q: 'あらすじは必須ですか？', a: 'あらすじは任意です。ただし、あらすじがあると読者が作品を見つけやすく読み始めやすくなります。できるだけ設定することをおすすめします。' },
      { q: 'タグはいくつまで設定できますか？', a: 'タグは最大30個まで設定できます。作品の特徴・舞台・主人公・テーマ・雰囲気などを表すタグを設定してください。' },
      /*
       * 投稿の仕組み。
       *
       * 「投稿ボタンを押すとすぐ公開される」としか読めない、
       * という指摘があった。話ごとに出すこと、下書きは残ること、
       * 予約や一括があることを書く。
       */
      { q: '書いた話は、すぐに公開されますか？', a: '公開されるのは「この話を投稿する」を押した話だけです。押していない話は下書きのまま残り、読者には表示されません。書けた話から1つずつ投稿していけます。' },
      { q: '「未着手」「執筆中」「完成」は投稿に関係しますか？', a: '関係しません。これは書き手が自分の進み具合を見るための印です。「完成」にしても自動で公開されることはなく、逆に「執筆中」のままでも投稿ボタンを押せば公開されます。' },
      { q: '公開する日時を決められますか？', a: '予約投稿ができます。投稿の画面で日時を指定すると、その時刻に自動で公開されます。5分ごとに確認しているため、指定した時刻から数分ほど遅れる場合があります。' },
      { q: '何話もまとめて投稿できますか？', a: '投稿ページの「まとめて投稿する」から、「◯話目〜◯話目」と範囲を指定して一度に投稿できます。その範囲のうち、まだ投稿していない話だけが公開されます。なお、名前の無い話が含まれている場合は投稿できません。' },
      { q: '投稿した話を下書きに戻せますか？', a: '戻せます。投稿ページで話を選び、非公開にすると下書きの状態に戻ります。まとめて非公開にすることもできます。' },
      { q: '投稿後に編集できますか？', a: '投稿後も作品やエピソードを編集・削除できます。内容を大きく変更する場合は、前書きやあとがきで補足することをおすすめします。' },
      /*
       * ルビ。
       *
       * 他のサイトから原稿を移してくる人が必ず通る所。
       * 縦線は半角でも全角でも動く。
       */
      { q: 'ルビ（ふりがな）はどう書きますか？', a: '｜漢字《かんじ》のように書きます。縦線は半角の「|」でも全角の「｜」でも構いません。ほかの投稿サイトから原稿をそのまま移しても、書き換えずにお使いいただけます。' },
      { q: '傍点は打てますか？', a: '《《強調したい言葉》》のように、二重の山括弧で囲むと傍点が付きます。' },
      { q: 'AIを使ってもいいですか？', a: '誤字脱字修正・表現の言い換え・文法校正・アイデア出しなど補助的な利用は可能です。ただし、AI生成文章をそのまま投稿することや、作品の大部分をAIに依存することは禁止です。' },
    ]
  },
  {
    label: '閲覧・評価について', icon: '📖',
    items: [
      { q: 'R18作品が表示されません', a: 'R18作品はログイン済みかつ18歳以上であることを確認したユーザーにのみ表示されます。' },
      { q: 'いいねを取り消せますか？', a: 'もう一度いいねボタンを押すことで解除できます。' },
      { q: '保存した作品はどこで見られますか？', a: 'マイページ内の保存作品一覧から確認できます。' },
      { q: '違反作品を見つけたらどうすればいいですか？', a: '通報機能またはお問い合わせフォームからご連絡ください。運営が確認し必要に応じて対応します。' },
    ]
  },
  {
    label: 'ランキングについて', icon: '🏆',
    items: [
      { q: '新人ランキングとは何ですか？', a: '投稿開始から1ヶ月以内の作者または作品を対象としたランキングです。単純なPV数だけでなく、いいね率・保存率・発掘率・コメント率・更新頻度なども参考にします。' },
      { q: 'ランキングはどのくらいの頻度で更新されますか？', a: '日間・週間・月間・年間のランキングがあります。それぞれの集計期間に応じて更新されます。' },
    ]
  },
]

export default function FaqPage() {

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
          <h1 style={{fontSize:24,fontWeight:700,color:'var(--color-text)',marginBottom:4}}>よくある質問</h1>
          <p style={{fontSize:13,color:'var(--color-text-muted)'}}>原石航路についてよくある質問をまとめています</p>
        </div>

        {faqCategories.map((cat, ci) => (
          <div key={ci} style={{marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <h2 style={{fontSize:16,fontWeight:700,color:'var(--color-text)'}}>{cat.label}</h2>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cat.items.map((item, i) => (
                <details key={i} style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:10,overflow:'hidden'}}>
                  <summary style={{padding:'14px 18px',fontSize:14,fontWeight:600,color:'var(--color-text)',cursor:'pointer',
                    display:'flex',alignItems:'center',gap:10,listStyle:'none'}}>
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

        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'20px 24px',textAlign:'center',marginTop:8}}>
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
