'use client'
import { useState, useRef, useEffect } from 'react'
import ReadingSettings, { Settings } from '@/components/novel/episode/reading-settings'
import { splitRuby } from '@/lib/utils/ruby'
import { withTateChuYoko } from '@/components/novel/episode/tate-chu-yoko'
import { usePathname, useRouter } from 'next/navigation'

interface Props {
  title: string
  body: string
  preface?: string | null
  afterword?: string | null
  authorName?: string
  /**
   * 作者がすすめる読む向き。
   *
   * 読む人の設定は変えない。印を出すだけ。
   */
  recommendedMode?: 'vertical' | 'horizontal' | null
  /** 話ごとの挿絵。本文の前に出る */
  illustUrl?: string | null
  illustIsAi?: boolean | null
}

const DEFAULTS: Settings = { font: 'serif', fontSize: 16, lineHeight: 2.1, writingMode: 'horizontal' }

function fontFamilyOf(font: Settings['font']): string {
  return font === 'serif'   ? "'Noto Serif JP', serif"
       : font === 'rounded' ? "'Zen Maru Gothic', 'Noto Sans JP', sans-serif"
       : font === 'ud'      ? "'BIZ UDPGothic', 'Noto Sans JP', sans-serif"
       :                      "'Noto Sans JP', sans-serif"
}

/**
 * 読む側の横書き用に、見た目だけ整える。
 * 本文は書き換えない。読む瞬間の見え方だけ。
 */
function normalizeForHorizontalReading(text: string): string {
  let next = text

  /* 全角 1 つ（…）は半角 3 つ（...）。数を保つ */
  next = next.replace(/…+/g, (m) => '.'.repeat(m.length * 3))

  /*
   * 横棒は長音（ー）で見せる。
   *
   * 半角ハイフンやダッシュを並べて線にした所を、
   * 同じ本数の「ーーーー」に置き換える。
   * 1 つだけのハイフンは触らない（ジャン-ピエール などのため）。
   */
  next = next.replace(/[-–—―－]{2,}/g, (m) => 'ー'.repeat(m.length))

  /* 全角英数字・記号を半角へ */
  next = next.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

  /*
   * 全角空白を半角へ。ただし行頭の字下げは残す。
   * 詰めると段落の切れ目が分からなくなる。
   */
  return next
    .split('\n')
    .map((line) => {
      const indent = line.startsWith('　') ? '　' : ''
      const body = indent ? line.slice(1) : line
      return indent + body.replace(/　/g, ' ')
    })
    .join('\n')
}

function renderBody(text: string): string {
  /* 整えるのはルビを取り出したあと。先だと ｜《》 が壊れる */
  let result = splitRuby(text).map((part) => {
    if (part.type === 'ruby') {
      return `<ruby>${normalizeForHorizontalReading(part.body)}<rt>${normalizeForHorizontalReading(part.ruby)}</rt></ruby>`
    }
    if (part.type === 'dot') {
      return `<em style="font-style:normal;font-weight:700;border-bottom:2px solid var(--color-brand)">${normalizeForHorizontalReading(part.body)}</em>`
    }
    return part.body
  }).join('')

  result = result
    .split(/(<[^>]+>)/)
    .map((piece) => (piece.startsWith('<') ? piece : normalizeForHorizontalReading(piece)))
    .join('')

  result = result.replace(/\n/g, '<br/>')
  return result
}

/**
 * 読む側の縦書き用に、見た目だけ整える。
 *
 * 執筆画面の「縦書き用に整える」と同じ考えで直すが、
 * こちらは本文を書き換えない。読む瞬間の見た目だけ。
 * 保存されているものは書き手のまま残す。
 *
 *   半角英数字 → 全角   縦組みで横倒しにならないように
 *   ... → ……           三点リーダは二つ重ねが慣習
 *   -- → ——            ダッシュも同じ
 *   半角空白 → 全角空白
 *
 * 字下げは入れない。
 * 書き手が段落の形を決めているので、読む側で足すと
 * 意図した見た目が崩れる。
 */
function normalizeForReading(text: string): string {
  let next = text

  /* 三点リーダとダッシュは、全角化より先に揃える */
  /*
   * 三点リーダ。点の数を保って直す。
   *
   * 半角 3 つ（...）が全角 1 つ（…）にあたる。
   * 数を見ずに「……」へ揃えると、縦横を切り替えるたびに
   * 点が増えたり減ったりする。
   */
  next = next.replace(/\.{3,}/g, (m) => '…'.repeat(Math.max(1, Math.round(m.length / 3))))
  /* 全角 1 つ（—）は半角 2 つ（--）。本数を保つ */
  next = next.replace(/[—―]+/g, (m) => '--'.repeat(m.length))

  /*
   * 長音が続くところはダッシュに直す。
   *
   * 「ーーー」と伸ばし棒を並べて線のかわりにする書き方がある。
   * 縦書きだと 1 本ずつ切れて見えるので、ダッシュに揃える。
   *
   * ただし、あとにかなが続くときは触らない。
   * 前後にかなが無いときだけ、線とみなす。
   * 「ぎゅーーーっと」「ぎゅーーー」は伸ばしなので触らない。
   * 「ーーー、そして」「「ーーー」」は線なので揃える。
   */
  next = next.replace(/(^|[^ぁ-んァ-ヶー])(ー{2,})(?![ぁ-んァ-ヶー])/g, (_m, pre) => `${pre}——`)

  /* 半角英数字・記号を全角へ */
  next = next.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))

  /* 半角空白も全角へ */
  next = next.replace(/ /g, '　')

  return next
}

export function VerticalText({ text }: { text: string }) {
  /*
   * 整えるのは、ルビを切り出したあと。
   *
   * 先にかけると ｜ や 《》 まで全角になり、
   * ルビの印として読めなくなる。
   */
  let processed = text
  /*
   * 三点リーダも置き換えない。
   *
   * 「・・・」に差し替えると、字形も間隔も変わるうえ、
   * コピーした本文まで別の字になる。
   * 縦書きでの向きは、下で 1 字ずつ回して合わせる。
   */
  /*
   * 伸ばし棒は置き換えない。
   * 「コーヒー」が「コ｜ヒ｜」になるのを防ぐ。
   * 向きはブラウザの縦組みに任せる。
   */
  /*
   * ルビと傍点は、1 文字ずつに分ける前に取り出す。
   * そのまま分けると ｜漢字《かんじ》 の記号が
   * 素の文字として並んでしまう。
   */
  const parts = splitRuby(processed)

  function renderChars(text: string, keyPrefix: string) {
    /*
     * 1 文字ずつ回すのをやめた。
     * 回すと「――――」が 1 本ずつ立って細く並ぶ。
     * 執筆画面と同じく、ブラウザの縦組みに任せる。
     */
    return text.split('\n').map((line, i, all) => (
      <span key={`${keyPrefix}-${i}`}>
        {/*
          * 英数字は縦中横で立てる。
          * そのままだと「35歳」の 35 も (Pr. I) も寝たまま出る。
          */}
        {withTateChuYoko(line, `${keyPrefix}-${i}`)}
        {i < all.length - 1 ? <br/> : null}
      </span>
    ))
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'ruby') {
          return (
            <ruby key={`r-${i}`} style={{ rubyPosition: 'over' }}>
              {normalizeForReading(part.body)}
              <rt style={{ fontSize: '0.5em' }}>{normalizeForReading(part.ruby ?? '')}</rt>
            </ruby>
          )
        }
        if (part.type === 'dot') {
          return (
            <span
              key={`d-${i}`}
              style={{
                textEmphasis: 'filled dot',
                WebkitTextEmphasis: 'filled dot',
                textEmphasisPosition: 'over right',
                WebkitTextEmphasisPosition: 'over right',
              } as React.CSSProperties}
            >
              {normalizeForReading(part.body)}
            </span>
          )
        }
        return <span key={`t-${i}`}>{renderChars(normalizeForReading(part.body), `t${i}`)}</span>
      })}
    </>
  )
}

export default function MobileEpisodeBody({ illustUrl, illustIsAi, title, body, preface, afterword, authorName, recommendedMode = null }: Props) {
  const [isVertical, setIsVertical] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  /*
   * 全画面で読む頁への道。
   *
   * ★ 話の id は渡されていないので、いまの住所から作る。
   *   /novel/…/episode/… の後ろに /read を足すだけ。
   */
  const router = useRouter()
  const pathname = usePathname()
  const [containerHeight, setContainerHeight] = useState(600)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /*
     * 縦書きの高さ。
     *
     * 引く数が大きいほど 1 列に入る字が減り、
     * 横へ送る回数が増える。
     *
     *   前   200 + 18 + 上下の余白 48 = 266px を引いていた
     *   後   140 + 10 + 上下の余白 32 = 182px
     *
     * スマホは画面が狭いぶん、ここが効く。
     * 画面が 800px なら、534px から 618px になる。
     *
     * 画面の向きを変えたときも数え直す。
     * 横にしたときに、縦のままの高さで出ていた。
     */
    const fit = () => setContainerHeight(window.innerHeight - 140)
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    try {
      const saved = localStorage.getItem('reading_settings')
      if (saved) {
        const s = { ...DEFAULTS, ...JSON.parse(saved) } as Settings
        setSettings(s)
        setIsVertical(s.writingMode === 'vertical')
      }
    } catch {}

    /* 見張りを外す。外さないと、画面を移るたびに増え続ける */
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [])

  useEffect(() => {
    if (isVertical && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
        }
      }, 100)
    }
  }, [isVertical, body])

  function handleSettingsChange(s: Settings) {
    setSettings(s)
    setIsVertical(s.writingMode === 'vertical')
  }

  const fontFamily = fontFamilyOf(settings.font)

  const Afterword = afterword ? (
    <div style={{borderTop:'1px solid var(--color-brand-border)'}}>
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--color-brand-border)',background:'var(--color-bg)',display:'flex',alignItems:'center',gap:8}}>
        <span style={{width:3,height:14,background:'var(--color-brand)',borderRadius:2,display:'inline-block'}}/>
        <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>あとがき</span>
        {authorName && <span style={{fontSize:11,color:'var(--color-text-muted)',marginLeft:'auto'}}>{authorName}</span>}
      </div>
      <div style={{padding:'14px 16px',fontSize:14,color:'var(--color-text)',lineHeight:1.9,whiteSpace:'pre-wrap',fontFamily:"'Noto Sans JP',sans-serif"}}>
        {afterword}
      </div>
    </div>
  ) : null

  // ===== 縦書き =====
  if (isVertical) {

  /*
   * 全画面で読む。
   *
   * ★ 携帯だけ。
   *   画面が小さいので、まわりの飾りを消すと
   *   読める場所がはっきり広がる。
   *
   * 左右を触ると頁を送る。
   * 頁の分け方は PagedReader に任せる。
   */


    return (
      <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-brand-light)',background:'var(--color-bg)',display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
          <ReadingSettings onFullscreen={()=>router.push(`${pathname}/read`)} onChange={handleSettingsChange} isMobile={true} recommendedMode={recommendedMode}/>
        </div>

        {preface && (
          <div style={{padding:'10px 14px',background:'var(--color-bg)',borderBottom:'1px solid var(--color-brand-light)'}}>
            <div style={{fontSize:13,color:'var(--color-text-muted)',lineHeight:1.9,padding:'8px 12px',background:'var(--color-bg-card)',borderLeft:'3px solid var(--color-brand-border)',borderRadius:4,whiteSpace:'pre-wrap'}}>
              {preface}
            </div>
          </div>
        )}

        <style>{`
          .vertical-body, .vertical-body * {
            writing-mode: vertical-rl !important;
            text-orientation: mixed !important;
          }
          .vertical-body .v-char {
            display: inline-block !important;
            writing-mode: vertical-rl !important;
          }
          .vertical-body .v-char-rotate {
            display: inline-block !important;
            writing-mode: vertical-rl !important;
            transform: rotate(90deg) !important;
          }
          .v-scroll-m::-webkit-scrollbar { height: 10px; }
          .v-scroll-m::-webkit-scrollbar-track { background: var(--color-brand-light); border-radius: 5px; }
          .v-scroll-m::-webkit-scrollbar-thumb { background: var(--color-brand); border-radius: 5px; border: 2px solid var(--color-brand-light); }
          .v-scroll-m { scrollbar-width: thin; scrollbar-color: var(--color-brand) var(--color-brand-light); }
        `}</style>

        <div
          ref={scrollRef}
          className="v-scroll-m"
          style={{
            overflowX: 'scroll',
            overflowY: 'hidden',
            height: containerHeight,
            paddingBottom: 4,
          }}
        >
          <div
            className="vertical-body"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              display: 'inline-block',
              /* 上下の余白を詰める。左右はそのまま */
              padding: '16px 16px 16px 32px',
              height: 'calc(100% - 10px)',
              boxSizing: 'border-box',
            }}
          >
            {/*
              * 挿絵。
              *
              * ★ 縦書きの流れの中、題名の右に置く。
              *
              *   縦書きは右から左へ流れる。
              *   絵を右端に置けば、視線の始まりに来る。
              *
              * ★ 絵の入れ物だけ writingMode を戻す。
              *   戻さないと、入れ物まで縦に伸びる。
              *
              * ★ そのあとに見えない仕切りを挟む。
              *   挟まないと、絵の下に題名が入り込んで重なる。
              */}
            {illustUrl && (
              <>
                <div style={{display:'inline-block',verticalAlign:'top',marginLeft:'1.5em',writingMode:'horizontal-tb',position:'relative'}}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={illustUrl} alt="挿絵"
                    style={{maxHeight:260,maxWidth:180,objectFit:'contain',borderRadius:8,display:'block'}}/>
                  {illustIsAi && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src="/images/ai-cover-stamp.png" alt="AIで作った挿絵" title="AIで作った挿絵"
                      style={{position:'absolute',top:-5,right:-5,width:34,height:34,
                        transform:'rotate(-8deg)',opacity:.55,pointerEvents:'none',
                        filter:'drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.25))'}}/>
                  )}
                </div>
                <span aria-hidden="true"
                  style={{display:'inline-block',height:'100%',width:0,verticalAlign:'top'}}/>
              </>
            )}

                        <div style={{display:'inline-block', marginRight:'2em', verticalAlign:'top', writingMode:'vertical-rl'}}>
              <div style={{fontSize: settings.fontSize + 4, fontWeight:700, color:'var(--color-text)', fontFamily, lineHeight:1.8}}>
                {/* 題名にも英数字が入る。「(Pr. I)」など */}
                {withTateChuYoko(title, 'v-title')}
              </div>
            </div>

            {/*
              * 見えない仕切り。
              *
              * 題名が短いと、その下に本文が入り込んで同じ列に並ぶ。
              * 列の残りを埋めて、本文を次の列から始める。
              */}
            <span aria-hidden="true"
              style={{display:'inline-block',height:'100%',width:0,verticalAlign:'top'}}/>
            <div style={{display:'inline-block', fontSize: settings.fontSize, lineHeight: settings.lineHeight, color:'var(--color-text)', fontFamily, wordBreak:'break-all', verticalAlign:'top', writingMode:'vertical-rl'}}>
              <VerticalText text={body}/>
            </div>
          </div>
        </div>

        <div style={{padding:'4px 12px',background:'var(--color-bg)',borderTop:'1px solid var(--color-brand-light)',textAlign:'center',fontSize:10,color:'var(--color-text-faint)'}}>
          ← 左にスワイプして読み進める
        </div>

        {Afterword}
      </div>
    )
  }

  // ===== 横書き =====
  return (
    <div style={{background:'var(--color-bg-card)',border:'1px solid var(--color-brand-border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
      <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-brand-light)',background:'var(--color-bg)',display:'flex',justifyContent:'flex-end',alignItems:'center'}}>
        <ReadingSettings onFullscreen={()=>router.push(`${pathname}/read`)} onChange={handleSettingsChange} isMobile={true} recommendedMode={recommendedMode}/>
      </div>

      <div style={{padding:'20px 16px 28px'}}>
        {/*
          * 話ごとの挿絵。
          *
          * ★ 題名の前に置く。
          *   携帯は上から下へ読むので、
          *   ここが本文の始まりの前になる。
          */}
        {illustUrl && (
          <div style={{position:'relative',display:'inline-block',marginBottom:14}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={illustUrl} alt="挿絵"
              style={{maxHeight:220,maxWidth:'100%',objectFit:'contain',borderRadius:8,display:'block'}}/>
            {illustIsAi && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/images/ai-cover-stamp.png" alt="AIで作った挿絵" title="AIで作った挿絵"
                style={{position:'absolute',top:-5,right:-5,width:34,height:34,
                  transform:'rotate(-8deg)',opacity:.55,pointerEvents:'none',
                  filter:'drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.25))'}}/>
            )}
          </div>
        )}

        <h1 style={{fontFamily, fontSize:settings.fontSize+2, fontWeight:700, color:'var(--color-text)', textAlign:'center', marginBottom:20, lineHeight:1.6}}>
          {title}
        </h1>
        {preface && (
          <div style={{fontSize:settings.fontSize-2, color:'var(--color-text-muted)', lineHeight:1.9, padding:'10px 12px', background:'var(--color-bg)', borderLeft:'3px solid var(--color-brand-border)', borderRadius:4, marginBottom:20, whiteSpace:'pre-wrap'}}>
            {preface}
          </div>
        )}
        <div
          style={{fontSize:settings.fontSize, lineHeight:settings.lineHeight, color:'var(--color-text)', fontFamily, wordBreak:'break-all'}}
          dangerouslySetInnerHTML={{__html: renderBody(body)}}
        />
      </div>

      {Afterword}
    </div>
  )
}
