-- Phase 1 only: storage and database access controls. No UI/API deployment.
create schema if not exists stop_private;
revoke all on schema stop_private from public;
grant usage on schema stop_private to anon, authenticated, service_role;

create table stop_private.comment_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on stop_private.comment_admins from public, anon, authenticated;
grant all on stop_private.comment_admins to service_role;
alter table stop_private.comment_admins enable row level security;

create function stop_private.is_comment_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from stop_private.comment_admins where user_id = (select auth.uid()));
$$;
create function stop_private.comment_stop_is_public(p_stop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.stops where id = p_stop and status = 'published');
$$;
revoke all on function stop_private.is_comment_admin(), stop_private.comment_stop_is_public(uuid) from public;
grant execute on function stop_private.is_comment_admin(), stop_private.comment_stop_is_public(uuid) to anon, authenticated, service_role;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300 and content !~ '^[[:space:]]*$'),
  display_name text not null default 'زائر' check (char_length(display_name) between 1 and 40 and display_name !~ '^[[:space:]]*$'),
  commenter_code uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_public_list on public.comments(stop_id, created_at desc) where status = 'approved';
create index comments_moderation_queue on public.comments(status, created_at);
create index comments_rate_by_code on public.comments(commenter_code, created_at desc);
create index comments_rate_by_stop on public.comments(stop_id, created_at desc);
-- Cross-identity duplicate prevention: changing the name/code cannot repost the same text.
create unique index comments_no_duplicates on public.comments
  (stop_id, md5(lower(regexp_replace(content, '[[:space:]]+', ' ', 'g'))));

create function stop_private.validate_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.content := btrim(regexp_replace(new.content, '[[:space:]]+', ' ', 'g'));
  new.display_name := btrim(regexp_replace(new.display_name, '[[:space:]]+', ' ', 'g'));
  if new.content is null or char_length(new.content) not between 1 and 300 then
    raise exception 'comment_content_invalid' using errcode = '23514';
  end if;
  if new.display_name is null or char_length(new.display_name) not between 1 and 40 then
    raise exception 'comment_name_invalid' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'comments_must_start_pending' using errcode = '23514'; end if;
    if not stop_private.comment_stop_is_public(new.stop_id) then
      raise exception 'comment_stop_unavailable' using errcode = '23514';
    end if;
    -- Serialize a code across STOPs, then a STOP across codes. No raw IPs stored.
    perform pg_advisory_xact_lock(hashtextextended('comment-code:' || new.commenter_code::text, 0));
    perform pg_advisory_xact_lock(hashtextextended('comment-stop:' || new.stop_id::text, 0));
    if (select count(*) from public.comments where commenter_code = new.commenter_code and created_at > now() - interval '1 hour') >= 5
       or (select count(*) from public.comments where stop_id = new.stop_id and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'comment_rate_limited' using errcode = '23514';
    end if;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.stop_id is distinct from old.stop_id
       or new.commenter_code is distinct from old.commenter_code or new.created_at is distinct from old.created_at then
      raise exception 'comment_identity_immutable' using errcode = '23514';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function stop_private.validate_comment() from public, anon, authenticated;
create trigger comments_validate before insert or update on public.comments
  for each row execute function stop_private.validate_comment();

alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (stop_id, content, display_name, commenter_code) on public.comments to anon, authenticated;
grant update (content, display_name, status), delete on public.comments to authenticated;
grant all on public.comments to service_role;

create policy comments_public_read on public.comments for select to anon, authenticated
  using (status = 'approved' and stop_private.comment_stop_is_public(stop_id));
create policy comments_submit on public.comments for insert to anon, authenticated
  with check (status = 'pending' and stop_private.comment_stop_is_public(stop_id));
create policy comments_admin_read on public.comments for select to authenticated
  using ((select stop_private.is_comment_admin()));
create policy comments_admin_update on public.comments for update to authenticated
  using ((select stop_private.is_comment_admin())) with check ((select stop_private.is_comment_admin()));
create policy comments_admin_delete on public.comments for delete to authenticated
  using ((select stop_private.is_comment_admin()));

-- Same sole administrator already configured by ADMIN_USER_ID for STOP.ma.
insert into stop_private.comment_admins(user_id) values ('7d205d2d-e946-4815-afe2-c54a6c6bff49');
