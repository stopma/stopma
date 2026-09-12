create table public.categories (id text primary key, label text not null check(char_length(label) between 1 and 40), active boolean not null default true);
insert into public.categories(id,label) values ('society','المجتمع'),('road','الطريق'),('environment','البيئة'),('administration','الإدارة'),('sport','الرياضة'),('other','أخرى');
create table public.stops (id uuid primary key default gen_random_uuid(), text text not null check(char_length(text) between 12 and 400), category text not null references public.categories(id) default 'other', status text not null default 'pending' check(status in ('pending','published','rejected')), votes_count integer not null default 0 check(votes_count>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index stops_ranking on public.stops(status,votes_count desc,created_at desc);
create table public.votes (id uuid primary key default gen_random_uuid(),stop_id uuid not null references public.stops(id) on delete cascade,visitor_identifier text not null,created_at timestamptz not null default now(),unique(stop_id,visitor_identifier));
create table public.visitors (identifier text primary key,first_seen timestamptz not null default now(),last_seen timestamptz not null default now());
create index visitor_presence on public.visitors(last_seen);
create table public.daily_visits(day date not null,identifier text not null references public.visitors(identifier) on delete cascade,primary key(day,identifier));
create table public.rate_limits(key text primary key, hits integer not null, expires_at timestamptz not null);
create table public.moderation_log(id bigint generated always as identity primary key,stop_id uuid references public.stops(id) on delete set null,admin_id uuid not null,action text not null,created_at timestamptz not null default now());
alter table public.categories enable row level security;
alter table public.stops enable row level security;
alter table public.votes enable row level security;
alter table public.visitors enable row level security;
alter table public.daily_visits enable row level security;
alter table public.rate_limits enable row level security;
alter table public.moderation_log enable row level security;
-- No browser access: all operations pass through validated server endpoints.
revoke all on public.categories,public.stops,public.votes,public.visitors,public.daily_visits,public.rate_limits,public.moderation_log from anon,authenticated;
grant all on public.categories,public.stops,public.votes,public.visitors,public.daily_visits,public.rate_limits,public.moderation_log to service_role;
grant usage, select on all sequences in schema public to service_role;
create function public.take_rate(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path=public as $$
declare n integer;
begin
 insert into rate_limits(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds)) on conflict(key) do update set hits=case when rate_limits.expires_at<=now() then 1 else rate_limits.hits+1 end, expires_at=case when rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else rate_limits.expires_at end returning hits into n;
 return n<=p_limit;
end $$;
create function public.cast_vote(p_stop uuid,p_visitor text) returns jsonb language plpgsql set search_path=public as $$
declare n integer; inserted integer;
begin
 perform 1 from stops where id=p_stop and status='published' for update;
 if not found then raise exception 'not_found'; end if;
 insert into votes(stop_id,visitor_identifier) values(p_stop,p_visitor) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then update stops set votes_count=votes_count+1 where id=p_stop; end if;
 select votes_count into n from stops where id=p_stop;
 return jsonb_build_object('count',n,'already',inserted=0);
end $$;
create function public.record_visit(p_visitor text) returns void language plpgsql set search_path=public as $$
begin
 insert into visitors(identifier) values(p_visitor) on conflict(identifier) do update set last_seen=now();
 insert into daily_visits(day,identifier) values((now() at time zone 'Africa/Casablanca')::date,p_visitor) on conflict do nothing;
end $$;
create function public.site_stats() returns jsonb language sql set search_path=public as $$
 select jsonb_build_object('total',(select count(*) from visitors),'online',(select count(*) from visitors where last_seen>now()-interval '2 minutes'),'today',(select count(*) from daily_visits where day=(now() at time zone 'Africa/Casablanca')::date),'pending',(select count(*) from stops where status='pending'),'published',(select count(*) from stops where status='published'),'votes',(select count(*) from votes));
$$;
create function public.moderate_stop(p_id uuid,p_text text,p_category text,p_status text,p_admin uuid) returns void language plpgsql set search_path=public as $$
begin
 update stops set text=p_text,category=p_category,status=p_status,updated_at=now() where id=p_id;
 if not found then raise exception 'not_found'; end if;
 insert into moderation_log(stop_id,admin_id,action) values(p_id,p_admin,p_status);
end $$;
-- Run daily using Supabase Cron. No raw IPs, emails, or user agents stored.
create function public.cleanup_data() returns void language plpgsql set search_path=public as $$
begin
 delete from rate_limits where expires_at<now();
 delete from daily_visits where day<current_date-30;
 delete from stops where status='rejected' and updated_at<now()-interval '30 days';
 delete from stops where status='pending' and created_at<now()-interval '90 days';
 delete from moderation_log where created_at<now()-interval '180 days';
end $$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
