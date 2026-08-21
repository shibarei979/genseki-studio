import Link from 'next/link'

/**
 * ============================================================
 * 原石航路
 * ReaderSidebar — 読者向けホームの左の柱
 *
 * その人自身のものを置く。
 *
 *   続きを読む   途中の作品。読みに来た人が真っ先に用があるもの
 *   執筆室       静かに書きたくなったとき。読む人でも入れる
 *   お知らせ     運営からの連絡
 *
 * 右の広い側には新しい出会いを並べる。
 * 自分のものと、新しいものを左右で分ける。
 * ============================================================
 */

export interface SidebarReading {
  novelId: string
  episodeId: string
  title: string
  updatedAt: string
  episodeLabel: string
}

export interface SidebarNotice {
  id: string
  href: string
  date: string
  title: string
}

export default function ReaderSidebar({
  reading,
  notices,
}: {
  /** 一番最近読んでいた作品。無ければ出さない */
  reading: SidebarReading | null
  notices: SidebarNotice[]
}) {
  return (
    <aside className="reader-side">
      {/* 続きを読む */}
      {reading && (
        <section className="rs_card">
          <h2 className="rs_head">読みかけの作品</h2>

          <div className="rs_reading">
            <div className="rs_cover" aria-hidden="true" />
            <div className="rs_meta">
              <p className="rs_title">{reading.title}</p>
              <p className="rs_sub">{reading.episodeLabel}</p>
            </div>
          </div>

          <Link
            href={`/novel/${reading.novelId}/episode/${reading.episodeId}`}
            className="rs_button"
          >
            続きを読む
          </Link>
        </section>
      )}

      {/* 執筆室 */}
      <section className="rs_card rs_room">
        <h2 className="rs_head">執筆室に入る</h2>
        <p className="rs_note">
          静かな環境で、
          <br />
          創作に集中しましょう。
        </p>
        <Link href="/rooms" className="rs_button rs_button-ghost">
          執筆室へ →
        </Link>
      </section>

      {/* お知らせ */}
      <section className="rs_card">
        <div className="rs_head-row">
          <h2 className="rs_head">お知らせ</h2>
          <Link href="/announcements" className="rs_more">
            すべて見る ›
          </Link>
        </div>

        {notices.length === 0 ? (
          <p className="rs_note">まだお知らせはありません。</p>
        ) : (
          <ul className="rs_notices">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link href={notice.href} className="rs_notice">
                  <span className="rs_date">{notice.date}</span>
                  <span className="rs_notice-title">{notice.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
