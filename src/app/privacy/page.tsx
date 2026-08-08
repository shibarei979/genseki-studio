import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import Link from 'next/link'

export default function PrivacyPage() {

  const sections = [
    { num: 1, title: '適用', body: `本ポリシーは、本サービスにおけるユーザー情報の取扱いに適用されます。ユーザーは、本サービスを利用することにより、本ポリシーに同意したものとみなされます。本サービスにおいて別途定める利用規約、投稿ガイドライン、その他の規定がある場合、それらも本ポリシーとあわせて適用されるものとします。` },
    { num: 2, title: '取得する情報', body: `本サービスは、以下の情報を取得する場合があります。\n\n【登録時・利用時に入力する情報】\n①メールアドレス\n②ユーザー名\n③パスワード\n④プロフィール情報\n⑤年齢確認に関する情報\n⑥その他ユーザーが任意で入力する情報\n\n【利用に伴い取得される情報】\n①投稿作品、エピソード、コメント、タグ、あらすじ等の投稿コンテンツ\n②いいね、保存、発掘する、閲覧履歴、コメント履歴等の利用履歴\n③ランキング、推薦、原石発掘等の機能利用に関する情報\n④ログイン日時、アクセス日時、操作履歴\n\n【技術的に取得される情報】\n①IPアドレス\n②Cookie、端末識別子、ブラウザ情報\n③使用端末、OS、ブラウザ、画面サイズ等の情報\n④リファラー、アクセス元URL\n⑤エラー情報、クラッシュ情報、通信ログ\n\n【外部サービス連携により取得する情報】\n①Googleログイン等の外部認証サービスを利用する場合の認証情報\n②外部サービス上で公開または許可されたユーザー情報\n③外部サービス連携に必要な識別子` },
    { num: 3, title: '利用目的', body: `本サービスは、取得した情報を以下の目的で利用します。\n\n①本サービスの提供、維持、運営のため\n②ユーザー登録、ログイン、本人確認、年齢確認のため\n③作品投稿、コメント、いいね、保存、発掘する等の機能を提供するため\n④ランキング、推薦、原石発掘等を提供・改善するため\n⑤ユーザーの利用状況を分析し、サービス改善、表示改善、不具合修正を行うため\n⑥不正利用、規約違反、権利侵害の防止・調査・対応のため\n⑦年齢制限作品の表示制御、R15・R18作品の閲覧制限を行うため\n⑧ユーザーからの問い合わせ、通報、権利侵害申告に対応するため\n⑨重要なお知らせ、規約変更、機能変更、メンテナンス情報等を通知するため\n⑩広告配信、アクセス解析、効果測定のため\n⑪法令、裁判所、行政機関等からの要請に対応するため\n⑫その他、上記に付随する目的のため` },
    { num: 4, title: '投稿コンテンツの公開範囲', body: `ユーザーが投稿した作品、あらすじ、タグ、コメント、プロフィール情報等は、本サービス上で公開される場合があります。公開範囲は、ユーザーが設定した公開状態、年齢区分、サービス仕様に従います。R18作品は、ログイン済みかつ18歳以上であることを確認したユーザーにのみ表示されます。ユーザーは、投稿コンテンツに個人情報や第三者の情報を含めないよう十分注意するものとします。` },
    { num: 5, title: '第三者提供', body: `本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。\n\n①ユーザー本人の同意がある場合\n②法令に基づく場合\n③人の生命、身体または財産の保護のために必要がある場合\n④国の機関、地方公共団体、裁判所、警察その他公的機関から適法な要請を受けた場合\n⑤不正利用、権利侵害、トラブル対応のために必要な範囲で開示する場合\n⑥事業譲渡、合併、サービス移管その他これに類する場合に、必要な範囲で引き継ぐ場合` },
    { num: 6, title: '外部サービス・委託先の利用', body: `本サービスは、サービス提供に必要な範囲で、サーバー、データベース、認証、メール配信、アクセス解析、広告配信、ストレージ等の外部サービスを利用する場合があります。外部サービスの利用に伴い、ユーザー情報の一部が外部サービス提供事業者に送信または保存される場合があります。ユーザーが外部サービスを利用する場合、当該外部サービスの利用規約およびプライバシーポリシーも適用されます。` },
    { num: 7, title: 'Cookie等の利用', body: `本サービスは、ログイン状態の保持、利便性向上、アクセス解析、広告配信、不正利用防止のため、Cookieまたはこれに類する技術を利用する場合があります。ユーザーは、ブラウザ設定によりCookieの利用を拒否できます。ただし、Cookieを拒否した場合、本サービスの一部機能が正常に利用できない場合があります。外部サービスによる情報取得、利用停止方法等については、各外部サービスの規約およびプライバシーポリシーをご確認ください。` },
    { num: 8, title: '広告配信', body: `本サービスは、サイト運営のため、広告を掲載する場合があります。広告配信事業者は、ユーザーの興味・関心に応じた広告を表示するため、Cookie等を利用する場合があります。広告配信事業者による情報の取扱いについては、当該事業者のプライバシーポリシーに従うものとします。本サービスは、広告内容、広告先サイト、外部サービスの安全性、正確性、適法性について保証しません。` },
    { num: 9, title: '安全管理措置', body: `本サービスは、取得した個人情報について、不正アクセス、漏えい、滅失、毀損、改ざん等を防止するため、必要かつ適切な安全管理措置を講じるよう努めます。\n\n安全管理措置には、以下の内容を含みます。\n①アクセス権限の管理\n②パスワード、認証情報の適切な管理\n③通信の暗号化\n④データベースおよびストレージの管理\n⑤不正アクセスや異常利用の監視\n⑥外部サービス利用時の設定確認\n⑦必要に応じたバックアップおよび復旧対応\n⑧個人情報の取扱いに関する運営内ルールの整備` },
    { num: 10, title: '情報の保存期間', body: `本サービスは、利用目的の達成に必要な範囲で、ユーザー情報を保存します。退会後も、法令対応、不正利用防止、トラブル対応、サービス運営上必要な範囲で、一部情報を保持する場合があります。投稿コンテンツ、コメント、評価履歴等は、退会後もサービス運営上必要な範囲で保持または表示される場合があります。保存の必要がなくなった情報については、合理的な範囲で削除または匿名化するよう努めます。` },
    { num: 11, title: 'ユーザーによる確認・修正・削除', body: `登録ユーザーは、本サービス所定の方法により、登録情報やプロフィール情報を確認、修正、削除できます。投稿コンテンツの削除を希望する場合、ユーザーは本サービス所定の方法により削除手続きを行うものとします。退会により投稿コンテンツが当然に削除されるものではありません。投稿コンテンツの削除を希望する場合、退会前に削除手続きを行うものとします。` },
    { num: 12, title: '開示・訂正・利用停止等の請求', body: `ユーザーは、法令に基づき、自己の個人情報について、開示、訂正、追加、削除、利用停止、消去、第三者提供の停止等を請求できます。請求を行う場合、ユーザーは運営者所定の方法により手続きを行うものとします。運営者は、本人確認を行った上で、法令に従い合理的な範囲で対応します。` },
    { num: 13, title: '未成年者の個人情報', body: `未成年者が本サービスを利用する場合、親権者等の法定代理人の同意を得た上で利用するものとします。未成年者は、R18作品を閲覧、投稿、評価、保存、コメントすることはできません。` },
    { num: 14, title: 'プライバシーポリシーの変更', body: `本ポリシーは、法令改正、サービス内容の変更、運営上の必要に応じて変更される場合があります。変更後も本サービスを利用した場合、ユーザーは変更後のポリシーに同意したものとみなされます。` },
    { num: 15, title: '問い合わせ窓口', body: `本ポリシーに関する問い合わせ、個人情報の開示・訂正・削除・利用停止等の請求については、本サービス所定の問い合わせ窓口よりご連絡ください。\n\n原石航路 運営\nメールアドレス：（準備中）` },
  ]

  return (
    <div className="page-with-footer" style={{minHeight:'100vh',fontFamily:"'Noto Sans JP',sans-serif"}}>
      <Header />

      <div style={{maxWidth:860,margin:'0 auto',padding:'40px 24px 60px'}}>
        {/* タイトル */}
        <div style={{marginBottom:32,paddingBottom:20,borderBottom:'2px solid var(--color-brand-border)'}}>
          <h1 style={{fontSize:28,fontWeight:700,color:'var(--color-text)',marginBottom:8}}>プライバシーポリシー</h1>
          <p style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.7}}>
            原石航路は、本サービスを利用するユーザーの個人情報および関連情報を適切に取り扱うため、<br/>
            以下のとおりプライバシーポリシーを定めます。
          </p>
          <div style={{marginTop:12,fontSize:12,color:'var(--color-text-faint)'}}>制定日：2026年07月01日</div>
        </div>

        {/* 目次 */}
        <div style={{background:'var(--color-bg)',border:'1px solid var(--color-brand-border)',borderRadius:12,padding:'20px 24px',marginBottom:32}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--color-text)',marginBottom:12}}>目次</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
            {sections.map(s => (
              <a key={s.num} href={`#section-${s.num}`}
                style={{fontSize:12,color:'var(--color-brand)',textDecoration:'none',padding:'3px 0',borderBottom:'1px solid var(--color-brand-light)'}}>
                第{s.num}条　{s.title}
              </a>
            ))}
          </div>
        </div>

        {/* 条文 */}
        <div style={{display:'flex',flexDirection:'column'}}>
          {sections.map(s => (
            <div key={s.num} id={`section-${s.num}`}
              style={{borderBottom:'1px solid var(--color-brand-border)',padding:'24px 0'}}>
              <h2 style={{fontSize:15,fontWeight:700,color:'var(--color-text)',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{background:'var(--color-brand)',color:'var(--color-text-inverse)',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,flexShrink:0}}>
                  第{s.num}条
                </span>
                {s.title}
              </h2>
              <div style={{fontSize:13,color:'var(--color-text)',lineHeight:1.9,whiteSpace:'pre-line'}}>
                {s.body}
              </div>
            </div>
          ))}
        </div>

        {/* 関連リンク */}
        <div style={{marginTop:40,padding:'20px',background:'var(--color-bg)',borderRadius:12,border:'1px solid var(--color-brand-border)',textAlign:'center'}}>
          <div style={{fontSize:12,color:'var(--color-text-muted)',marginBottom:12}}>関連ページ</div>
          <div style={{display:'flex',gap:16,justifyContent:'center',flexWrap:'wrap'}}>
            <Link href="/terms" style={{fontSize:13,color:'var(--color-brand)',textDecoration:'none'}}>利用規約</Link>
            <Link href="/" style={{fontSize:13,color:'var(--color-brand)',textDecoration:'none'}}>ホーム</Link>
            <Link href="/auth/register" style={{fontSize:13,color:'var(--color-brand)',textDecoration:'none'}}>新規登録</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
