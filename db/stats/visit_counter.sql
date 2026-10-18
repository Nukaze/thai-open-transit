-- db/stats/visit_counter.sql
--
-- Visit counter for the public site. Runs in its OWN Supabase project
-- ("stats"), never in the dataset database: the public site may write here,
-- so this project holds nothing but daily counts (see docs/adr/0002).
-- No IPs, no user agents, nothing personal: one row per Bangkok day.
--
-- Run once in the stats project's SQL Editor. Safe to re-run.

create table if not exists public.visits_daily (
  day   date   primary key,
  count bigint not null default 0 check (count >= 0)
);

-- RLS on with no policies: the anon / publishable key can neither read nor
-- write the table directly. The two functions below are the only way in.
alter table public.visits_daily enable row level security;
revoke all on table public.visits_daily from anon, authenticated;

-- "Today" is the Bangkok calendar day (CLAUDE.md: display Asia/Bangkok).
create or replace function public.bangkok_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

-- Read-only. Also what the keep-alive workflow calls, so pings never add
-- visits.
create or replace function public.get_stats()
returns table (total bigint, today bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(v.count), 0)::bigint,
    coalesce(sum(v.count) filter (where v.day = public.bangkok_today()), 0)::bigint
  from public.visits_daily v;
$$;

-- Counts one visit for today and returns the new totals. The browser only
-- calls this on its first visit of a Bangkok day (deduped client-side).
create or replace function public.record_visit()
returns table (total bigint, today bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.visits_daily (day, count)
  values (public.bangkok_today(), 1)
  on conflict (day) do update set count = public.visits_daily.count + 1;

  return query select * from public.get_stats();
end;
$$;

-- Only these two are callable from the browser.
revoke all on function public.bangkok_today() from public, anon, authenticated;
revoke all on function public.get_stats() from public, anon, authenticated;
revoke all on function public.record_visit() from public, anon, authenticated;
grant execute on function public.get_stats() to anon;
grant execute on function public.record_visit() to anon;
