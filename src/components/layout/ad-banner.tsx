"use client";

// 広告バナーコンポーネント
// AD_URL_1, AD_URL_2 に広告コードを入れると表示される
// 未設定の場合は非表示

import { useMemberFeatures } from "@/lib/subscription/use-member-features";

const AD_URL_1 = '' // 広告1のコード・URLをここに入力
const AD_URL_2 = '' // 広告2のコード・URLをここに入力

/*
 * ★ 広告なし（Pro）の人には出さない。
 *   特典の種類「広告を出さない」を持つ人。運営も出さない。
 *
 * ★ 今は広告の中身が空なので、誰にも何も出ていない。
 *   広告を入れるときは、会員かどうかが分かる前に一瞬出てしまう点に注意。
 *   （払っている人ほど気になる。答えが返るまで隠す形にするとよい）
 */
export default function AdBanner() {
  const { noAds } = useMemberFeatures()

  // 両方未設定なら非表示
  if (!AD_URL_1 && !AD_URL_2) return null
  if (noAds) return null

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'16px 32px',display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
      {AD_URL_1 && (
        <div style={{width:280,height:280,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',flexShrink:0}}>
          {/* 広告1 */}
        </div>
      )}
      {AD_URL_2 && (
        <div style={{width:280,height:280,background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',flexShrink:0}}>
          {/* 広告2 */}
        </div>
      )}
    </div>
  )
}
