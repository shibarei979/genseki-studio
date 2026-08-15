// 広告バナーコンポーネント
// AD_URL_1, AD_URL_2 に広告コードを入れると表示される
// 未設定の場合は非表示

const AD_URL_1 = '' // 広告1のコード・URLをここに入力
const AD_URL_2 = '' // 広告2のコード・URLをここに入力

export default function AdBanner() {
  // 両方未設定なら非表示
  if (!AD_URL_1 && !AD_URL_2) return null

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
