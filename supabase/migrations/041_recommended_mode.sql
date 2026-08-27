-- ============================================================
-- 原石航路 Studio
-- 作者がすすめる読む向き
--
-- 縦書きを前提に組んだ作品もあれば、
-- 横書きで読んでほしい作品もある。
--
-- 決めていない作品もあるので、
-- 未設定を残しておく（null）。
--
-- 何度実行しても壊れない。
-- ============================================================

alter table public.novels
    add column if not exists recommended_mode text;

/*
 * 入る値は 'vertical' か 'horizontal' だけ。
 * ほかの字が入ると、画面の出し分けで迷う。
 */
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'novels_recommended_mode_check'
    ) then
        alter table public.novels
            add constraint novels_recommended_mode_check
            check (recommended_mode in ('vertical', 'horizontal'));
    end if;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    case
        when exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'novels'
              and column_name = 'recommended_mode'
        ) then 'すすめる読む向きの欄を用意できました'
        else '欄がありません ← 失敗'
    end as 状態;
