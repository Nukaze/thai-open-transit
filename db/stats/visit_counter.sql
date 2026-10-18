-- db/stats/visit_counter.sql
--
-- View counter for the public site. Runs in its OWN Supabase project
-- ("stats"), never in the dataset database: the public site may write here,
-- so this project holds nothing but counts (see docs/adr/0002).
-- No IPs, no user agents stored, nothing personal: one row per 30-minute
-- UTC bucket per language and device class.
--
-- Run once in the stats project's SQL Editor. Safe to re-run.

-- Earlier draft of this file (never deployed): daily visits.
drop function if exists public.record_visit();
drop table if exists public.visits_daily;

-- 30-minute buckets: fine enough for commute and lunch peaks, and they line
-- up with half-hour time zones. Worst case is 48 buckets x 9 combinations a
-- day, about 160 MB after 10 years, well inside the free tier.
-- fillfactor 80 leaves room on each page so the constant `views + 1` updates
-- stay HOT (views is not indexed), keeping dead-tuple bloat low.
create table if not exists public.visits (
  bucket timestamptz not null,
  lang   text        not null default 'unknown'
         check (lang in ('th', 'en', 'unknown')),
  device text        not null default 'unknown'
         check (device in ('mobile', 'desktop', 'unknown')),
  views  bigint      not null default 0 check (views >= 0),
  primary key (bucket, lang, device)
) with (fillfactor = 80);

-- RLS on with no policies: the anon / publishable key can neither read nor
-- write the table directly. The two functions below are the only way in.
alter table public.visits enable row level security;
revoke all on table public.visits from anon, authenticated;

-- Stored in UTC, "today" is the Bangkok calendar day (CLAUDE.md: store UTC,
-- display Asia/Bangkok).
create or replace function public.bangkok_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

-- Read-only. Also what the keep-alive workflow and bots call, so neither
-- ever adds views. "Today" is every bucket from Bangkok midnight (as a UTC
-- instant) on; no bucket can lie in the future.
create or replace function public.get_stats()
returns table (total bigint, today bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(v.views), 0)::bigint,
    coalesce(sum(v.views) filter (
      where v.bucket >= public.bangkok_today()::timestamp at time zone 'Asia/Bangkok'
    ), 0)::bigint
  from public.visits v;
$$;

-- Counts one page view and returns the new totals.
--
-- Bot filter, second layer (the browser skips the call for bots first):
-- ignores requests whose user agent is missing or names a crawler or an HTTP
-- library, e.g. a plain `curl` against this endpoint. Deliberately loose:
-- only words that never appear in a real browser's user agent, so a normal
-- visitor is never dropped ("bot/" as a version token, since CUBOT phones
-- carry "bot" in their model name). A bot faking a browser user agent still counts;
-- accepted, the number is decorative.
create or replace function public.record_view(p_lang text, p_device text)
returns table (total bigint, today bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- PostgREST sets request.headers per request (names lowercased). Outside a
  -- request it is NULL or '' (and ''::json would throw), so nullif first.
  ua text := coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'user-agent',
    '');
begin
  if ua = ''
     or ua ~* '(bot/|crawl|spider|slurp|headless|lighthouse|curl|wget|python|httpie|go-http|okhttp|axios|node-fetch|java/)'
  then
    return query select * from public.get_stats();
    return;
  end if;

  insert into public.visits (bucket, lang, device, views)
  values (
    date_bin('30 minutes', now(), timestamptz '2000-01-01 00:00:00+00'),
    case when p_lang in ('th', 'en') then p_lang else 'unknown' end,
    case when p_device in ('mobile', 'desktop') then p_device else 'unknown' end,
    1
  )
  on conflict (bucket, lang, device)
    do update set views = public.visits.views + 1;

  return query select * from public.get_stats();
end;
$$;

-- Only these two are callable from the browser.
revoke all on function public.bangkok_today() from public, anon, authenticated;
revoke all on function public.get_stats() from public, anon, authenticated;
revoke all on function public.record_view(text, text) from public, anon, authenticated;
grant execute on function public.get_stats() to anon;
grant execute on function public.record_view(text, text) to anon;
