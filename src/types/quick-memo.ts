/**
 * ============================================================
 * 原石航路 Studio
 * QuickMemo Types（執筆メモ）
 *
 * 作品に属さないメモ。
 * 資料のメモは作品ごとに分かれているが、
 * 「まだどの作品のものか決まっていない思いつき」を置く場所が要る。
 * 作品を作る前に浮かんだ案を捨てずに済ませるため。
 * ============================================================
 */

export interface QuickMemo {
    id: string;
    title: string;
    body: string;
    /** 結びつけた作品。決まっていなければ null */
    work_id: string | null;
    created_at: string;
    updated_at: string;
}
