/**
 * ============================================================
 * 原石航路 Studio
 * マイページの言い方
 *
 * GENSEKIKORO のものをそのまま移した。
 * 分けたページのどこからでも使えるよう、外へ出しただけ。
 * ============================================================
 */

/** 「3分前」「2時間前」「2026/8/9」 */
export function fmtDate(s: string) {
  const d = new Date(s), now = new Date(), diff = now.getTime() - d.getTime()
  if (diff < 60*60*1000) return `${Math.floor(diff/60000)}分前`
  if (diff < 24*60*60*1000) return `${Math.floor(diff/3600000)}時間前`
  if (diff < 7*24*60*60*1000) return `${Math.floor(diff/86400000)}日前`
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
}

/** 「1.2万文字」「5,120文字」 */
export function fmtChars(n: number) {
  return n >= 10000 ? `${(n/10000).toFixed(1)}万文字` : `${n.toLocaleString()}文字`
}

/** 「2026/08/09 13:45」 */
export function fmtDateTime(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

/** 「2026/08/09」 */
export function fmtDateShort(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}
