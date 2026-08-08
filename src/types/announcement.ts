export const TYPE_OPTIONS: Record<string, { label: string; color: string }> = {
  info:        { label: 'お知らせ',         color: '#3b82f6' },
  important:   { label: '重要なお知らせ',   color: '#ef4444' },
  contest:     { label: 'コンテスト',       color: '#F26A21' },
  update:      { label: 'アップデート',     color: '#8b5cf6' },
  maintenance: { label: 'メンテナンス',     color: '#f59e0b' },
  campaign:    { label: 'キャンペーン',     color: '#ec4899' },
  event:       { label: 'イベント',         color: '#10b981' },
  award:       { label: '受賞・書籍化',     color: '#eab308' },
  new_feature: { label: '新機能',           color: '#06b6d4' },
  notice:      { label: '告知',             color: '#6366f1' },
  sns:         { label: 'SNS',              color: '#1d9bf0' },
  report:      { label: 'レポート',         color: '#14b8a6' },
  other:       { label: 'その他',           color: '#94a3b8' },
}

export function getAnnouncementType(t: string) {
  return TYPE_OPTIONS[t] ?? TYPE_OPTIONS['info']
}

export const TYPE_OPTIONS_ARRAY = Object.entries(TYPE_OPTIONS).map(([value, { label, color }]) => ({ value, label, color }))
