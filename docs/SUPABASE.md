# Supabase に繋ぐ

端末の中だけで動いている状態から、
どの端末からでも開ける状態に移す手順です。

---

## 1. 部品を入れる

```bash
npm install
```

`@supabase/ssr` と `@supabase/supabase-js` が入ります。

---

## 2. テーブルを作る

Supabase ダッシュボード → **SQL Editor** に、
`supabase/migrations/002_studio_schema.sql` の中身を貼って実行します。

GENSEKIKORO（投稿サイト）のスキーマに**足すだけ**の内容です。
既存のテーブルは消さず、列の追加も既定値つきにしてあります。
動いているサイトは壊れません。

**単体で動きます。** GENSEKIKORO を先に入れる必要はありません。
土台のテーブル（profiles・novels・episodes）も、無ければここで作ります。

### 途中で止まるとき

`002` が最後まで通らない場合は、
**`002a_tables_only.sql` を流してください。**

こちらは仕掛けを外してあります。

| 外したもの | なぜ |
|---|---|
| check 制約 | 既存データと合わないと落ちる |
| 外部キー | 参照先の形が違うと落ちる |
| 土台への変更 | すでにあるものを壊さない |

**動くことを優先した形**です。整えるのは動いたあとでかまいません。

最後まで通ると、こう出ます。

```
テーブルが揃いました
```

### 実行するとき

SQL Editor は**途中でエラーが出ると、そこで止まります。**
それより下のテーブルは作られません。

最後まで通ると、こう出ます。

```
すべてのテーブルが揃いました
```

足りないものがあれば、名前が出ます。

```
足りないテーブル: writing_rooms, contests
```

この場合は、**エラーの出た行より上**に原因があります。
出力の赤い文言をそのまま見てください。

### 「more than one relationship」と言われたら

```
Could not embed because more than one relationship
was found for 'profiles' and 'novels'
```

`novels.author_id` が **2 か所を指している**状態です。
`profiles` と `auth.users` の両方に繋がっていると、
どちらを辿ればよいか決められません。

SQL Editor で次を流すと直ります。

```sql
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.confrelid
    where con.conrelid = 'public.novels'::regclass
      and con.contype = 'f'
      and rel.relname = 'profiles'
  loop
    execute format('alter table public.novels drop constraint %I', c.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
```

`profiles` を指すほうを外します。
中身は同じ id なので、消しても困りません。

### 「permission denied」と言われたら

```
permission denied for table writing_rooms
```

**テーブルに触れる許可**が無い状態です。
RLS を入れただけでは足りません。

| | 何を決めるか |
|---|---|
| GRANT | そのテーブルに触れてよいか |
| RLS | どの行に触れてよいか |

別の仕組みなので、両方が要ります。

```sql
grant usage on schema public to anon, authenticated;
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant all on tables to anon, authenticated;

notify pgrst, 'reload schema';
```

**これで誰でも読めるようになるわけではありません。**
行の制限は RLS が受け持ちます。

### 「schema cache に無い」と言われたら

```
Could not find the 'age_rating' column of 'novels' in the schema cache
```

**列はあるのに、API が気づいていない**状態です。
Supabase の API はテーブルの形を覚えていて、
列を足しただけでは覚え直しません。

SQL Editor で次を実行すると直ります。

```sql
notify pgrst, 'reload schema';
```

移行SQLの最後にも入れてありますが、
途中でエラーが出て止まると、そこまで届きません。

それでも直らないときは、
**Settings → API → Restart server** で入れ直せます。

---

## 3. 鍵を入れる

`.env.local` を作り、次の 2 行を入れます。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
```

値は **Settings → API** にあります。

- `Project URL` → 上の行
- `anon public` → 下の行

`service_role` の鍵は**入れないでください。** ブラウザから見えてしまいます。

---

## 3.5 いまどうなっているか調べる

うまく動かないときは、
`supabase/migrations/000_check.sql` を SQL Editor に貼ってください。

**何も書き換えません。読むだけです。**

分かること:

1. テーブルは揃っているか
2. `novels` に必要な列はあるか
3. 権限（GRANT）はあるか
4. 中身は入っているか

「無い」と出たものが原因です。

---

## 3.8 Google で入れるようにする

Supabase ダッシュボードで設定します。

**1. Authentication → Providers → Google を入りにする**

Google Cloud で OAuth の鍵を作り、次の 2 つを入れます。

- クライアント ID
- クライアントシークレット

**2. Google Cloud 側に戻り先を登録する**

APIとサービス → 認証情報 → OAuth クライアント →
「承認済みのリダイレクト URI」に、Supabase が示す URL を入れます。

```
https://xxxxx.supabase.co/auth/v1/callback
```

**3. Supabase の URL Configuration**

Authentication → URL Configuration の
「Redirect URLs」に、こちらの戻り先を入れます。

```
http://localhost:3000/auth/callback
https://（本番のドメイン）/auth/callback
```

これを入れ忘れると、Google から戻ってきたときに弾かれます。

---

## 3.9 ほかの端末の人が見えるようにする

執筆室は Supabase Realtime を使います。
**設定は不要です。** 用意されている仕組みをそのまま使うので、
テーブルを作ったり、有効にしたりする必要はありません。

使っているのは 2 つ。

| | 何に |
|---|---|
| presence | 誰がいるか。切れたら自動で消える |
| broadcast | 発言。流すだけで残さない |

発言を表に残していないのは、書く場の会話が
その場限りのもので、あとから読み返すものではないためです。

### 無料枠

Supabase の無料枠は、同時接続 200・1日あたり 200万メッセージです。
執筆室の使い方なら、まず超えません。

---

## 4. 動かす

```bash
rm -rf .next
npm run dev
```

`/login` からメールと合言葉で登録できます。

---

## 切り替えの仕組み

環境変数が**両方入っていれば** Supabase を、
どちらか欠けていれば端末の中の保存先を使います。

```
src/lib/repository/index.ts
  hasSupabase() → supabaseRepository か localRepository か
```

画面はどちらが動いているかを知りません。
`getRepository()` を呼ぶだけです。

**入れ忘れて真っ白になることはありません。** 黙って端末の中に落ちます。

---

## 端末の中にある原稿を持ち込む

1. 繋ぐ前に、マイページ → 設定 → データ → **書き出す**
2. 繋いでログインする
3. 同じ場所から **読み込む**

作品と話が移ります。
資料は移りません（id の繋ぎ直しが要るため、まだ作っていません）。

---

## 名前の対応

| Studio | Supabase |
|---|---|
| works | novels |
| work_id | novel_id |
| status | draft_status |

投稿サイトと同じテーブルを使っているので、
**ここで書いた原稿がそのまま投稿できます。**

---

## 誰が何を読めるか

RLS（行ごとの権限）で決めています。

| もの | 読める人 | 書ける人 |
|---|---|---|
| 作品・話・資料 | 作者本人 | 作者本人 |
| コンテスト | 誰でも（準備中を除く） | 運営 |
| 応募 | 出した本人と運営 | 出した本人 |
| お知らせ | 誰でも（公開後） | 運営 |
| バナー・NGワード・機能 | 誰でも | 運営 |

運営かどうかは `profiles.user_role = 'admin'` で見ています。
## Google でログインできるようにする

**Supabase ダッシュボード → Authentication → Providers → Google**

1. **Google** を有効にする
2. Google Cloud Console で「OAuth クライアント ID」を作る
3. クライアント ID と秘密鍵を Supabase に貼る

Google Cloud 側の **承認済みリダイレクト URI** には、
Supabase が示す道筋を入れます。

```
https://xxxxx.supabase.co/auth/v1/callback
```

Supabase ダッシュボードの **Authentication → URL Configuration** で、
戻り先も許しておきます。

```
Site URL       http://localhost:3000
Redirect URLs  http://localhost:3000/auth/callback
               https://（本番の道筋）/auth/callback
```

**この設定をしないと、Google のボタンを押しても弾かれます。**

---

## 運営

**`gensekikoro@gmail.com` は、誰にも解除できない運営です。**

移行SQLに書いてあるので、手で設定する必要はありません。

- そのメールで登録すると、**登録した瞬間に運営**になります
- すでに登録していれば、移行SQLを流した時点で運営になります
- 権限を落とすことも、停止することも、行を消すこともできません

守りは Supabase 側の引き金です。画面をすり抜けて直に叩かれても通りません。

### 2 人目からは

`/admin/users` で切り替えられます。

```
名無しの書き手   [書き手][運営]  停止
```

---

---

## 停止するとどうなるか

- 書いたものは**消えません**
- 読むことはできます
- 新しく書いたり、直したりできなくなります

RLS の `is_active()` で止めているので、
画面をすり抜けて直に叩かれても書けません。
