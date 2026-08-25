-- ============================================================
-- 原石航路 Studio
-- 新しく投稿された話も、朗読の順番待ちに入れる
--
-- 手で入れて回るのは続かない。
-- 投稿された時点で、自動で列に並ぶようにする。
--
-- 何度実行しても壊れない。
-- ============================================================

create or replace function public.add_to_voice_queue()
returns trigger
language plpgsql
security definer
as $$
begin
    /* 公開されていて、本文のある話だけ */
    if (new.is_published = true or new.published = true)
       and coalesce(length(new.body), 0) >= 200 then

        insert into public.voice_queue (episode_id, published_at, char_count)
        values (
            new.id,
            coalesce(new.published_at, new.created_at, now()),
            coalesce(length(new.body), 0)
        )
        on conflict (episode_id) do update
            set char_count = excluded.char_count;
    end if;

    return new;
end;
$$;

drop trigger if exists episodes_voice_queue on public.episodes;
create trigger episodes_voice_queue
    after insert or update of is_published, published, body
    on public.episodes
    for each row
    execute function public.add_to_voice_queue();

notify pgrst, 'reload schema';

select '新しい話も順番待ちに入るようになりました' as 状態;
