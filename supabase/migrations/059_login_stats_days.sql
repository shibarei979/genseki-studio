-- ============================================================
-- 原石航路 Studio
-- ログインの数え上げに、日数を渡せるようにする
--
-- いまは today / week / month / prev_month で固定。
-- 管理画面で 90日 を選んでも、この 4 つは動かなかった。
--
-- ★ 数え方は変えない。
--   auth.users の last_sign_in_at を見るところは同じ。
--   別のやり方にすると、前の数字と比べられなくなる。
-- ============================================================

create or replace function public.get_login_stats(days integer default 30)
returns json
language sql
security definer
set search_path = public
as $function$
  select json_build_object(
    /* 今日と 7 日は、期間に関わらず出す。毎日見る数字なので */
    'today', (select count(*) from auth.users
              where last_sign_in_at >= current_date),

    'week',  (select count(*) from auth.users
              where last_sign_in_at >= current_date - interval '7 days'),

    /* 選ばれた期間に来た人 */
    'month', (select count(*) from auth.users
              where last_sign_in_at >= current_date - (days || ' days')::interval),

    /*
     * その 1 つ前の、同じ長さの期間に来た人。
     *
     * 90日を選べば「90日前から180日前まで」。
     * 長さをそろえないと比べられない。
     */
    'prev_month', (select count(*) from auth.users
                   where last_sign_in_at >= current_date - (days * 2 || ' days')::interval
                     and last_sign_in_at <  current_date - (days || ' days')::interval)
  );
$function$;

notify pgrst, 'reload schema';

-- ============================================================
-- 確認
-- ============================================================
select
    public.get_login_stats(7)   as "7日",
    public.get_login_stats(30)  as "30日",
    public.get_login_stats(90)  as "90日";
