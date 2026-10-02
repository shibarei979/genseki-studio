import type { Metadata } from 'next'

import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'

/**
 * ============================================================
 * 原石航路 Studio
 * 特定商取引法に基づく表記
 *
 * ★ 有料サービス（カード払いの会員サービス）を始めるために置く。
 * ★ 氏名・住所・電話番号は、法律（特定商取引法 第11条 ただし書）にしたがい
 *   「請求があれば遅滞なく開示する」としている。
 *   運営者の名前や住所を載せる形に変えるときは、ここの行を書き換える。
 * ============================================================
 */

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: '原石航路の有料サービスに関する、特定商取引法に基づく表記です。',
}

const ROWS: [string, string][] = [
  ['販売事業者', '原石航路運営\n（氏名は、ご請求があった場合、遅滞なく開示します）'],
  ['運営統括責任者', 'ご請求があった場合、遅滞なく開示します'],
  ['所在地', 'ご請求があった場合、遅滞なく開示します'],
  ['電話番号', 'ご請求があった場合、遅滞なく開示します\nお問い合わせは、下記のメールアドレスまでお願いいたします'],
  ['メールアドレス', 'gensekikoro@gmail.com'],
  ['販売価格', '各有料サービスの申込画面に、税込価格で表示します'],
  ['商品代金以外の必要料金', '本サービスの利用に必要なインターネット接続料金・通信料金は、お客様のご負担となります'],
  ['支払方法', 'クレジットカード'],
  ['支払時期', '申込時にお支払いが確定します。期間ごとに更新される有料サービスは、各更新日にお支払いが確定します'],
  ['提供時期', 'お支払いの手続きが完了した時点から、ただちにご利用いただけます'],
  [
    '申込の撤回・返品・解約',
    'デジタルサービスの性質上、お支払い後の申込の撤回・返金には応じておりません（法令上必要な場合を除きます）。\n期間ごとに更新される有料サービスは、次の更新日の前日までに所定の画面から解約の手続きを行うことで、次回以降の請求は発生しません。解約した場合も、お支払い済みの期間の終わりまでご利用いただけます（日割りでの返金はありません）。',
  ],
  ['動作環境', '最新版の主要なウェブブラウザ（Google Chrome、Safari、Microsoft Edge、Firefox など）'],
  ['その他', '本表記に定めのない事項は、利用規約の定めによります'],
]

export default function TokushoPage() {
  return (
    <div className="page-with-footer m9-doc" style={{ minHeight: '100vh', fontFamily: "'Noto Sans JP',sans-serif" }}>
      <Header />

      <div className="m9-doc-body" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 60px' }}>
        <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid var(--color-brand-border)' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>特定商取引法に基づく表記</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            「原石航路」の有料サービスに関する表記です。
          </p>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-faint)' }}>制定日：2026年10月02日</div>
        </div>

        <dl style={{ margin: 0, border: '1px solid var(--color-brand-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg-card)' }}>
          {ROWS.map(([label, value], index) => (
            <div
              key={label}
              className="tk-row"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-brand-border)',
              }}
            >
              <dt
                style={{
                  flex: '1 1 160px',
                  padding: '14px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  background: 'var(--color-brand-light)',
                }}
              >
                {label}
              </dt>
              <dd
                style={{
                  flex: '999 1 300px',
                  margin: 0,
                  padding: '14px 18px',
                  fontSize: 13,
                  lineHeight: 1.9,
                  color: 'var(--color-text)',
                  whiteSpace: 'pre-line',
                }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Footer />
    </div>
  )
}
