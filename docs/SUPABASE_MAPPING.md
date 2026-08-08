# GENSEKIKORO のスキーマとの対応

> このアプリ（制作ツール）と、投稿サイト GENSEKIKORO の
> データベースをどう繋ぐかの整理。

---

## 1. そのまま使えるもの

| こちら | GENSEKIKORO | 備考 |
|--------|-------------|------|
| `profile` | `profiles` | `display_name` `bio` `x_account` `icon_url` がそのまま対応 |
| `works` | `novels` | `catchphrase`→`catchcopy`、`age_rating`→`is_r15`/`is_r18` |
| `episodes` | `episodes` | `work_id`→`novel_id`。`scheduled_at` `published` は向こうが上位互換 |
| `publish-settings` | `novels` の列 | `published` `allow_comments` `is_serial` に散っている |
| ミッションの受け取り | `user_missions` | そのまま使える |

**`novels` と `episodes` を共有できるのが最大の利点です。**
制作ツールで書いた原稿が、そのまま投稿サイトに載ります。

---

## 2. 作り直しが要るもの

### 資料まわり

GENSEKIKORO は**種類ごとにテーブルが分かれています**。

```
novel_characters  人物
novel_plots       プロット
novel_timeline    時系列
novel_relations   関係
novel_memos       メモ
```

一方こちらは**ページ自体を作者が作れる**設計です。

```
resource_pages    ページの定義（入力欄の構成を fields に持つ）
resource_entries  その中の項目（値を values に持つ）
```

**この違いは埋められません。** 向こうの形にすると、
「証拠品」「部活動」「怪異」といった作者独自の資料タイプが作れなくなります。
逆にこちらの形は、向こうの5テーブルを内包できます。

そこで**こちらの設計を残し、新しいテーブルとして足す**方針を取ります。
`novel_characters` などは投稿サイト側がすでに使っているので消しません。
将来どちらかへ寄せるときは、`resource_entries` から
`novel_characters` へ書き出す処理を1つ書けば済みます。

### 向こうに存在しないもの

| こちら | 用途 |
|--------|------|
| `episode_versions` | バージョン履歴 |
| `entry_mentions` | 本文から資料へのリンク |
| `work_display_settings` | 縦書き・文字サイズ・テーマ |
| `work_ai_settings` | AI補助の設定 |
| `writing_logs` | 執筆の記録（日ごとの文字数） |
| `plot_stages` / `plot_scenes` | プロットのボード |
| `writing_rooms` | 執筆室 |
| `quick_memos` | 作品に属さないメモ |

これらは `002_studio_schema.sql` で足します。

---

## 3. 名前の対応

コード側の型を変えずに済ませるため、
読み書きするときに名前を変換します（`supabase-repository.ts`）。

```
works.id            → novels.id
works.title         → novels.title
works.catchphrase   → novels.catchcopy
works.summary       → novels.summary
works.genre         → novels.genre
works.tags          → novels.tags
works.age_rating    → novels.is_r15 / is_r18
works.cover_url     → novels.cover_url
works.author_note   → （新しい列 author_note を足す）
works.keywords      → （新しい列 keywords を足す）

episodes.work_id    → episodes.novel_id
episodes.status     → （新しい列 draft_status を足す）
episodes.char_count → （新しい列 char_count を足す）
```

`novels` と `episodes` には**列を足すだけ**にします。
既存の投稿サイトを壊さないためです。
