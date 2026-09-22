/**
 * ============================================================
 * 原石航路
 * ログインしていない人のしおり
 *
 * ★ 押したら、まず本当に挟む（この端末に覚える）。
 *   前は押すと「ログインが必要です」と止めていた。
 *   先に挟んでおけば、「せっかく挟んだものを残したい」が登録の理由になる。
 *
 * ★ 登録・ログインしたら、アカウントへ移す。
 *   移し終えたら、この端末の分は消す（二重に数えない）。
 * ============================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const KEY = 'guest-bookmarks'

/** この端末に挟んである作品 */
export function guestBookmarks(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((one): one is string => typeof one === 'string') : []
  } catch {
    return []
  }
}

export function hasGuestBookmark(novelId: string): boolean {
  return guestBookmarks().includes(novelId)
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-300)))
  } catch {
    /* 覚えられなくても、画面の見た目は変わっている */
  }
}

/** 挟む・外す。挟んだら true */
export function toggleGuestBookmark(novelId: string): boolean {
  const list = guestBookmarks()
  if (list.includes(novelId)) {
    save(list.filter((one) => one !== novelId))
    return false
  }
  save([...list, novelId])
  return true
}

/**
 * この端末のしおりを、アカウントへ移す。
 * 移した作品の id を返す。
 *
 * ★ すでにアカウントにあるものは、そのまま（重ねて入れない）。
 * ★ 一件ずつ入れる。どれかが入らなくても、ほかは移す（入らなかった分は端末に戻す）。
 */

/* 同じ頁で何か所から呼ばれても、移すのは一度だけ */
let moving: Promise<string[]> | null = null

export function moveGuestBookmarks(supabase: SupabaseClient, userId: string): Promise<string[]> {
  if (!moving) moving = moveOnce(supabase, userId)
  return moving
}

async function moveOnce(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const list = guestBookmarks()
  if (list.length === 0) return []

  /*
   * ★ 先にこの端末の分を空にする。
   *   別のタブが同じ時に移そうとしても、二重に入れない。
   *   入れられなかった分は、あとで戻す。
   */
  save([])

  const { data: have, error: readError } = await supabase
    .from('bookmarks')
    .select('novel_id')
    .eq('user_id', userId)
    .in('novel_id', list)

  if (readError) {
    save(list)
    return []
  }

  const already = new Set((have ?? []).map((row: { novel_id: string }) => row.novel_id))
  const moved: string[] = []
  const failed: string[] = []

  for (const novelId of list) {
    if (already.has(novelId)) continue
    const { error } = await supabase.from('bookmarks').insert({ novel_id: novelId, user_id: userId })
    if (error) failed.push(novelId)
    else moved.push(novelId)
  }

  if (failed.length > 0) save([...guestBookmarks(), ...failed])
  return moved
}
