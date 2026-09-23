import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import NovelManageActions from '@/components/mypage/novel/novel-manage-actions'

export const dynamic = 'force-dynamic'

const AI_LABEL: Record<string, string> = { none: 'AI譛ｪ菴ｿ逕ｨ', assist: '陬懷勧逧・茜逕ｨ', full: '蜈ｨ髱｢逧・茜逕ｨ' }

export default async function NovelManagePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()

  const { data: novel } = await supabase
    .from('novels')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (!novel) notFound()
  if (novel.author_id !== user.id) redirect('/mypage')  // 閾ｪ蛻・・菴懷刀縺ｮ縺ｿ

  // 隧ｱ荳隕ｧ繧貞・縺ｫ蜿門ｾ暦ｼ・V髮・ｨ医↓隧ｱID縺悟ｿ・ｦ・ｼ・  const { data: epsData } = await supabase.from('episodes').select('id, ep_number, title, body, published, is_published, scheduled_at, created_at, updated_at, posted_at').eq('novel_id', params.id).order('ep_number', { ascending: true })
  const episodes = epsData || []
  const epIds = episodes.map((e: any) => e.id)

  // 繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ險倬鹸・壽怙鬮倬・ｽ阪→迴ｾ蝨ｨ縺ｮ鬆・ｽ・  const [bestRankRes, currentRankRes] = await Promise.all([
    supabase.from('ranking_history').select('period, rank').eq('novel_id', params.id).order('rank', { ascending: true }).limit(1),
    supabase.from('ranking_history').select('period, rank').eq('novel_id', params.id).gt('to_time', new Date().toISOString()).order('rank', { ascending: true }).limit(1),
  ])
  const PERIOD_LABEL: Record<string, string> = { daily: '譌･髢・, weekly: '騾ｱ髢・, monthly: '譛磯俣', quarterly: '蝗帛濠譛・, yearly: '蟷ｴ髢・, all: '邏ｯ險・ }
  const bestRank = bestRankRes.data?.[0] || null
  const currentRank = currentRankRes.data?.[0] || null

  // 邨ｱ險医ｒ荳ｦ蛻怜叙蠕暦ｼ・V縺ｯpage_views縺九ｉ髮・ｨ茨ｼ・  const [likeRes, bookmarkRes, discoverRes, commentRes, pvRes] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('novel_id', params.id),
    supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('novel_id', params.id),
    supabase.from('discovers').select('*', { count: 'exact', head: true }).eq('novel_id', params.id).eq('is_pending', false),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('novel_id', params.id).neq('user_id', user.id),
    epIds.length > 0
      ? supabase.from('page_views').select('*', { count: 'exact', head: true }).eq('is_author', false).or('is_bot.is.null,is_bot.eq.false').in('episode_id', epIds)
      : Promise.resolve({ count: 0 } as any),
  ])
  const totalChars = episodes.reduce((s: number, e: any) => s + (e.body?.length || 0), 0)
  /* 蜈ｬ髢九・蜊ｰ縺ｯ is_published縲Ｑublished 縺ｯ菴懊▲縺滓凾轤ｹ縺ｧ遶九▽縺ｮ縺ｧ菴ｿ繧上↑縺・*/
  const publishedEps = episodes.filter((e: any) => e.is_published === true)
  /*
   * 笘・謗ｲ霈画律縺ｯ縲瑚ｪｭ繧√ｋ繧医≧縺ｫ縺ｪ縺｣縺滓律縲阪〒隕九ｋ縲・   *
   *   蜑阪・ created_at・郁ｩｱ繧剃ｽ懊▲縺滓律・峨〒隕九※縺・◆縲・   *   縺ｾ縺ｨ繧√※譖ｸ縺・※豈取律 莠育ｴ・兜遞ｿ縺吶ｋ莠ｺ縺ｯ縲・   *   蜈ｨ驛ｨ縺ｮ隧ｱ縺悟酔縺俶律縺ｫ菴懊ｉ繧後※縺・ｋ縲・   *   縺昴・縺溘ａ蛻晏屓縺ｨ譛譁ｰ縺悟酔縺俶律縺ｫ荳ｦ繧薙〒縺・◆縲・   *
   *   posted_at 縺悟・縺｣縺ｦ縺・↑縺・商縺・ｩｱ縺ｯ縲∽ｽ懊▲縺滓律縺ｧ莉｣縺医ｋ縲・   */
  const postedAt = (e: any) => e.posted_at || e.created_at
  const postedDates = publishedEps.map(postedAt).filter(Boolean).sort()
  const firstDate = postedDates[0] ?? null
  const lastDate = postedDates.length > 0 ? postedDates[postedDates.length - 1] : null

  const fmt = (s?: string | null) => {
    if (!s) return '窶・
    const d = new Date(s)
    return `${d.getFullYear()}蟷ｴ${String(d.getMonth() + 1).padStart(2, '0')}譛・{String(d.getDate()).padStart(2, '0')}譌･ ${String(d.getHours()).padStart(2, '0')}譎・{String(d.getMinutes()).padStart(2, '0')}蛻・
  }

  const secStyle = { background: 'var(--color-bg-card)', border: '1px solid var(--color-brand-border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' as const }
  const secHead = { padding: '12px 18px', borderBottom: '1px solid var(--color-brand-light)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' as const }
  const row = { display: 'flex', padding: '10px 18px', borderBottom: '1px solid var(--color-brand-light)', fontSize: 13 }
  const rowLabel = { width: 130, flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 12 }
  const rowValue = { flex: 1, color: 'var(--color-text)', lineHeight: 1.6 }

  return (
    <div style={{ minHeight:'100vh'}}>
      <Header />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

        {/* 繝代Φ縺上★・九ち繧､繝医Ν */}
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          <Link href="/mypage" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>繝槭う繝壹・繧ｸ</Link>
          <span style={{ margin: '0 6px' }}>窶ｺ</span>菴懷刀邂｡逅・        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-inverse)', background: novel.is_serial ? 'var(--color-info)' : 'var(--color-text-faint)', padding: '3px 10px', borderRadius: 4 }}>{novel.is_serial ? '騾｣霈我ｸｭ' : '螳檎ｵ・}</span>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{novel.title}</h1>
          </div>
          <Link href={`/novel/${novel.id}`} style={{ fontSize: 12, color: 'var(--color-brand)', textDecoration: 'none', border: '1px solid var(--color-brand-border)', borderRadius: 14, padding: '6px 14px' }}>菴懷刀繝壹・繧ｸ繧定ｦ九ｋ 竊・/Link>
        </div>

        {/*
          * 謫堺ｽ懊・繧ｿ繝ｳ縲・          *
          * 笘・蝓ｷ遲・ｮ､縺ｸ逶ｴ縺ｫ陦後￥縲・          *
          *   蜑阪・ /post?novel= 縺ｨ /post?edit= 繧呈欠縺励※縺・◆縲・          *   縺ｩ縺｡繧峨・蜷亥峙繧りｪｭ繧謇縺檎┌縺上・          *   菴懷刀縺ｮ荳隕ｧ縺ｫ逹縺上□縺代□縺｣縺溘・          *   縺ｩ縺ｮ菴懷刀縺九ｉ譚･縺溘°蛻・°縺｣縺ｦ縺・ｋ縺ｮ縺ｫ縲・          *   繧ゅ≧荳蠎ｦ縺昴・菴懷刀繧帝∈縺ｰ縺輔ｌ縺ｦ縺・◆縲・          *
          *   ?new=1 繧剃ｻ倥￠繧九→縲∫捩縺・◆蜈医〒譁ｰ縺励＞隧ｱ縺・1 縺､縺ｧ縺阪ｋ縲・          */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <Link href={`/workspace/${novel.id}?new=1`} style={{ background: 'var(--color-brand)', color: 'var(--color-text-inverse)', fontSize: 12.5, fontWeight: 700, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>・・譁ｰ縺励＞隧ｱ繧定ｿｽ蜉</Link>
          <Link href={`/workspace/${novel.id}`} style={{ border: '1px solid var(--color-brand-border)', color: 'var(--color-brand)', fontSize: 12.5, fontWeight: 600, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>菴懷刀繝ｻ隧ｱ繧堤ｷｨ髮・/Link>
          <Link href="/mypage/analytics" style={{ border: '1px solid var(--color-brand-border)', color: 'var(--color-brand)', fontSize: 12.5, fontWeight: 600, padding: '9px 18px', borderRadius: 16, textDecoration: 'none' }}>繧｢繧ｯ繧ｻ繧ｹ隗｣譫・/Link>
        </div>

        {/* 菴懷刀諠・ｱ・壹ョ繝ｼ繧ｿ・玖ｪｭ閠・・蜿榊ｿ・*/}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div style={{ ...secStyle, marginBottom: 0 }}>
            <div style={secHead}>繝・・繧ｿ</div>
            <div style={row}><span style={rowLabel}>謚慕ｨｿ迥ｶ諷・/span><span style={rowValue}>{novel.published ? '蜈ｬ髢倶ｸｭ' : '荳区嶌縺・}縲・novel.is_serial ? '騾｣霈我ｸｭ' : '螳檎ｵ・}縲・/span></div>
            <div style={row}><span style={rowLabel}>隧ｱ謨ｰ</span><span style={rowValue}>{publishedEps.length}隧ｱ{episodes.length !== publishedEps.length ? `・井ｸ区嶌縺・{episodes.length - publishedEps.length}隧ｱ・荏 : ''}</span></div>
            <div style={row}><span style={rowLabel}>謚慕ｨｿ譁・ｭ玲焚</span><span style={rowValue}>{totalChars.toLocaleString()}譁・ｭ・/span></div>
            {/*
              * 遏ｭ縺・ｽ乗園縲・              * X 縺ｮ繝励Ο繝輔ぅ繝ｼ繝ｫ縺ｪ縺ｩ縲∝ｭ玲焚縺ｮ蟆代↑縺・園縺ｫ雋ｼ繧九◆繧√・繧ゅ・縲・              */}
            {novel.short_code && (
              <div style={row}>
                <span style={rowLabel}>遏ｭ縺・ｽ乗園</span>
                <span style={rowValue}>gensekikoro.com/w/{novel.short_code}</span>
              </div>
            )}
            <div style={row}><span style={rowLabel}>蛻晏屓謗ｲ霈画律</span><span style={rowValue}>{fmt(firstDate)}</span></div>
            <div style={row}><span style={rowLabel}>譛譁ｰ謗ｲ霈画律</span><span style={rowValue}>{fmt(lastDate)}</span></div>
            <div style={row}><span style={rowLabel}>迴ｾ蝨ｨ縺ｮ鬆・ｽ・/span><span style={{ ...rowValue, fontWeight: currentRank ? 700 : 400, color: currentRank ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>{currentRank ? `${currentRank.rank}菴搾ｼ育ｷ丞粋繝ｻ${PERIOD_LABEL[currentRank.period] || currentRank.period}・荏 : '蝨丞､・}</span></div>
            <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>譛鬮倬・ｽ・/span><span style={rowValue}>{bestRank ? `${bestRank.rank}菴搾ｼ育ｷ丞粋繝ｻ${PERIOD_LABEL[bestRank.period] || bestRank.period}・荏 : '窶・}</span></div>
          </div>
          <div style={{ ...secStyle, marginBottom: 0 }}>
            <div style={secHead}>隱ｭ閠・・蜿榊ｿ・/div>
            <div style={row}><span style={rowLabel}>PV</span><span style={{ ...rowValue, fontWeight: 700 }}>{(pvRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>縺・＞縺ｭ</span><span style={rowValue}>{(likeRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>菫晏ｭ・/span><span style={rowValue}>{(bookmarkRes.count || 0).toLocaleString()}</span></div>
            <div style={row}><span style={rowLabel}>逋ｺ謗倥・諡｡謨｣</span><span style={rowValue}>{(discoverRes.count || 0).toLocaleString()}</span></div>
            <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>繧ｳ繝｡繝ｳ繝・/span><span style={rowValue}>{(commentRes.count || 0).toLocaleString()}</span></div>
          </div>
        </div>

        {/* 菴懷刀險ｭ螳・*/}
        <div style={secStyle}>
          <div style={secHead}>
            菴懷刀險ｭ螳・            <Link href={`/workspace/${novel.id}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>笨・邱ｨ髮・/Link>
          </div>
          <div style={row}><span style={rowLabel}>菴懷刀繧ｿ繧､繝医Ν</span><span style={rowValue}>{novel.title}</span></div>
          <div style={row}><span style={rowLabel}>菴懷刀遞ｮ蛻･</span><span style={rowValue}>{novel.novel_type || '髟ｷ邱ｨ'}</span></div>
          <div style={row}><span style={rowLabel}>繧ｸ繝｣繝ｳ繝ｫ</span><span style={rowValue}>{novel.genre}</span></div>
          <div style={row}><span style={rowLabel}>AI蛻ｩ逕ｨ迥ｶ豕・/span><span style={rowValue}>{AI_LABEL[novel.ai_usage || 'none'] || 'AI譛ｪ菴ｿ逕ｨ'}</span></div>
          <div style={row}><span style={rowLabel}>縺ゅｉ縺吶§</span><span style={{ ...rowValue, whiteSpace: 'pre-wrap' as const }}>{novel.summary || '・域悴險ｭ螳夲ｼ・}</span></div>
          <div style={{ ...row, borderBottom: 'none' }}><span style={rowLabel}>繧ｿ繧ｰ</span><span style={rowValue}>{(novel.tags || []).length > 0 ? (novel.tags || []).join(' ・・') : '・域悴險ｭ螳夲ｼ・}</span></div>
        </div>

        {/* 蜈ｬ髢九・迥ｶ諷玖ｨｭ螳夲ｼ医◎縺ｮ蝣ｴ縺ｧ蛻・崛・・*/}
        <NovelManageActions novelId={novel.id} novelTitle={novel.title} initialPublished={!!novel.published} initialIsSerial={!!novel.is_serial} initialAllowComments={novel.allow_comments !== false} />

        {/* 繧ｨ繝斐た繝ｼ繝我ｸ隕ｧ */}
        <div style={secStyle}>
          <div style={secHead}>
            繧ｨ繝斐た繝ｼ繝我ｸ隕ｧ・・episodes.length}隧ｱ・・            <Link href={`/workspace/${novel.id}?new=1`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>・・隧ｱ繧定ｿｽ蜉</Link>
          </div>
          {episodes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-faint)' }}>縺ｾ縺隧ｱ縺後≠繧翫∪縺帙ｓ</div>
          ) : (
            episodes.map((ep: any, i: number) => (
              <div key={ep.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: i === episodes.length - 1 ? 'none' : '1px solid var(--color-brand-light)', gap: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-inverse)', background: ep.published === false ? 'var(--color-text-faint)' : 'var(--color-info)', padding: '2px 7px', borderRadius: 3, flexShrink: 0 }}>{ep.published === false ? '荳区嶌縺・ : '蜈ｬ髢・}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>ep.{ep.ep_number}</span>
                <Link href={`/novel/${novel.id}/episode/${ep.id}`} style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</Link>
                <span style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>{(ep.body?.length || 0).toLocaleString()}蟄・/span>
                <span className="desktop-only" style={{ fontSize: 11, color: 'var(--color-text-faint)', flexShrink: 0 }}>{fmt(ep.created_at).split(' ')[0]}</span>
              </div>
            ))
          )}
        </div>

      </div>
      <Footer />
    </div>
  )
}
