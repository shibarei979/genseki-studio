'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

interface Episode {
  id: string
  title: string
  body: string
  ep_number: number
}

interface Props {
  novelId: string
  novelTitle: string
  authorName: string
}

// ルビ・強調記法を除去してプレーンテキスト化
function toPlainText(text: string): string {
  return (text || '')
    .replace(/｜([^《]+)《[^》]+》/g, '$1')
    .replace(/《《([^》]+)》》/g, '$1')
}

export default function ExportButton({ novelId, novelTitle, authorName }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useState(() => { setMounted(true) })

  async function fetchEpisodes(): Promise<Episode[]> {
    const { data } = await supabase
      .from('episodes')
      .select('id, title, body, ep_number')
      .eq('novel_id', novelId)
      .eq('published', true)
      .order('ep_number', { ascending: true })
    return (data as Episode[]) || []
  }

  // PVに話数分を加算
  async function addPageViews(episodes: Episode[]) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const rows = episodes.map(ep => ({ episode_id: ep.id, user_id: user?.id || null }))
      if (rows.length > 0) {
        await supabase.from('page_views').insert(rows)
      }
    } catch (e) {}
  }

  async function exportTxt() {
    setLoading(true)
    const episodes = await fetchEpisodes()
    let content = `${novelTitle}\n作者：${authorName}\n\n${'='.repeat(30)}\n\n`
    episodes.forEach(ep => {
      content += `${ep.title}\n\n${toPlainText(ep.body)}\n\n${'―'.repeat(20)}\n\n`
    })
    downloadFile(content, `${novelTitle}.txt`, 'text/plain;charset=utf-8')
    await addPageViews(episodes)
    setLoading(false)
    setOpen(false)
  }

  async function exportDocx() {
    setLoading(true)
    const episodes = await fetchEpisodes()
    const docx = await import('docx')
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx

    const children: any[] = [
      new Paragraph({ text: novelTitle, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `作者：${authorName}`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }),
    ]

    episodes.forEach(ep => {
      children.push(new Paragraph({ text: ep.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
      children.push(new Paragraph({ text: '' }))
      const lines = toPlainText(ep.body).split('\n')
      lines.forEach(line => {
        children.push(new Paragraph({ children: [new TextRun(line)] }))
      })
    })

    const doc = new Document({ sections: [{ children }] })
    const blob = await Packer.toBlob(doc)
    downloadBlob(blob, `${novelTitle}.docx`)
    await addPageViews(episodes)
    setLoading(false)
    setOpen(false)
  }

  async function exportPdf() {
    setLoading(true)
    const episodes = await fetchEpisodes()

    // 縦書きHTMLを生成してブラウザ印刷（PDF保存）を促す
    const win = window.open('', '_blank')
    if (!win) { setLoading(false); return }

    let bodyHtml = ''
    episodes.forEach(ep => {
      const paras = toPlainText(ep.body).split('\n').map(l => l || '　').join('<br/>')
      bodyHtml += `<div class="episode"><h2>${escapeHtml(ep.title)}</h2><div class="body">${escapeHtml2(paras)}</div></div>`
    })

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="utf-8"/>
        <title>${escapeHtml(novelTitle)}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Noto Serif JP', serif; }
          .cover { text-align: center; page-break-after: always; padding-top: 200px; }
          .cover h1 { font-size: 32px; margin-bottom: 20px; }
          .cover p { font-size: 16px; color: #555; }
          .episode { writing-mode: vertical-rl; text-orientation: mixed; height: 240mm; page-break-after: always; column-fill: auto; }
          .episode h2 { font-size: 20px; font-weight: bold; margin-bottom: 1em; }
          .body { font-size: 16px; line-height: 2; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="writing-mode:horizontal-tb;padding:16px;background:var(--color-brand-light);text-align:center;">
          <button onclick="window.print()" style="padding:10px 24px;font-size:14px;background:var(--color-brand);color:var(--base-color-1);border:none;border-radius:8px;cursor:pointer;">PDFとして保存 / 印刷</button>
          <p style="font-size:12px;color:#777;margin-top:8px;">印刷ダイアログで「PDFに保存」を選んでください</p>
        </div>
        <div class="cover">
          <h1>${escapeHtml(novelTitle)}</h1>
          <p>作者：${escapeHtml(authorName)}</p>
        </div>
        ${bodyHtml}
      </body>
      </html>
    `)
    win.document.close()

    await addPageViews(episodes)
    setLoading(false)
    setOpen(false)
  }

  function downloadFile(content: string, filename: string, type: string) {
    // TextEncoderで明示的にUTF-8バイト列に変換し、先頭にBOMを付与
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const utf8 = new TextEncoder().encode(content)
    const merged = new Uint8Array(bom.length + utf8.length)
    merged.set(bom, 0)
    merged.set(utf8, bom.length)
    const blob = new Blob([merged], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, filename)
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function escapeHtml2(s: string) {
    // <br/>は残す
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;br\/&gt;/g, '<br/>')
  }

  return (
    <>
      <button onClick={()=>setOpen(true)}
        style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:16,border:'1px solid var(--color-brand-border)',background:'var(--color-bg-card)',color:'var(--color-text-muted)',fontSize:12,cursor:'pointer'}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ダウンロード
      </button>

      {open && mounted && createPortal(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={()=>!loading && setOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--color-bg-card)',borderRadius:16,width:'100%',maxWidth:380,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)'}}>
              <div style={{fontSize:15,fontWeight:700,color:'var(--color-text)'}}>作品をダウンロード</div>
              <div style={{fontSize:12,color:'var(--color-text-muted)',marginTop:2}}>形式を選んでください</div>
            </div>
            <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
              <button onClick={exportTxt} disabled={loading}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:10,border:'1.5px solid var(--color-brand-border)',background:'var(--color-bg-card)',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--color-text)'}}>
                <span>テキスト（.txt）</span>
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>軽量・どこでも開ける</span>
              </button>
              <button onClick={exportDocx} disabled={loading}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:10,border:'1.5px solid var(--color-brand-border)',background:'var(--color-bg-card)',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--color-text)'}}>
                <span>Word（.docx）</span>
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>編集向け</span>
              </button>
              <button onClick={exportPdf} disabled={loading}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:10,border:'1.5px solid var(--color-brand-border)',background:'var(--color-bg-card)',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--color-text)'}}>
                <span>縦書きPDF</span>
                <span style={{fontSize:11,color:'var(--color-text-faint)'}}>印刷・製本向け</span>
              </button>
            </div>
            <div style={{padding:'0 20px 16px'}}>
              {loading && <div style={{fontSize:12,color:'var(--color-brand)',textAlign:'center',marginBottom:8}}>準備中...</div>}
              <button onClick={()=>!loading && setOpen(false)}
                style={{width:'100%',padding:'10px',border:'1px solid var(--color-brand-border)',borderRadius:8,background:'var(--color-bg-card)',color:'var(--color-text-muted)',fontSize:13,cursor:'pointer'}}>
                閉じる
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
