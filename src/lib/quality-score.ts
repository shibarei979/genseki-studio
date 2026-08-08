// 作品の質スコアを計算する共通ユーティリティ
// 質スコア = 読了率20% + 保存率25% + いいね率35% + 独創性20%
// 率はすべてPVで正規化（母数の偏りを消す）

export interface QualityInput {
  views: number          // 総PV（novel_views.view_count または page_views件数）
  readCount: number      // 読了延べ数（read_episodes）
  bookmarkCount: number  // 保存数
  likeCount: number      // いいね数
  originalityScore: number // 独創性スコア（0-100）
}

export interface QualityResult {
  score: number        // 総合質スコア（0-100目安）
  readRate: number     // 読了率（0-1）
  bookmarkRate: number // 保存率（0-1）
  likeRate: number     // いいね率（0-1）
  originality: number  // 独創性（0-1）
}

// 率が1を超えないようにクランプ（1人が複数回読了する場合など）
function clampRate(numerator: number, views: number): number {
  if (views <= 0) return 0
  return Math.min(1, numerator / views)
}

export function calcQualityScore(input: QualityInput): QualityResult {
  const readRate     = clampRate(input.readCount, input.views)
  const bookmarkRate = clampRate(input.bookmarkCount, input.views)
  const likeRate     = clampRate(input.likeCount, input.views)
  const originality  = Math.max(0, Math.min(1, (input.originalityScore || 0) / 100))

  // 重み：読了20% + 保存25% + いいね35% + 独創性20%
  const raw =
    readRate     * 0.20 +
    bookmarkRate * 0.25 +
    likeRate     * 0.35 +
    originality  * 0.20

  // 0-100スケールに変換
  const score = Math.round(raw * 100 * 10) / 10

  return {
    score,
    readRate,
    bookmarkRate,
    likeRate,
    originality,
  }
}

// パーセント表示用ヘルパー
export function toPercent(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}
