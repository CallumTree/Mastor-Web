-- =====================================================================
-- MASTOR — cloud database. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- Multi-company from day one: every row belongs to a company, and Row Level Security
-- means a signed-in user can only ever read or write their own company's rows.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','director','qs','site_manager','operative')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Is the signed-in user a member of company c?
create or replace function public.is_member(c uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.memberships m where m.company_id = c and m.user_id = auth.uid())
$$;

-- First sign-in: create a company and make the caller its owner.
create or replace function public.create_company(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.companies(name) values (coalesce(nullif(trim(p_name), ''), 'My company')) returning id into new_id;
  insert into public.memberships(company_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;
revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;

-- Record tables. Each app record is stored whole in `data`; `deleted` lets other devices
-- learn about deletions; `updated_at` (set by the server) drives syncing.
do $$
declare t text;
begin
  foreach t in array array['jobs','scope_items','variations','valuations'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        company_id uuid not null references public.companies(id) on delete cascade,
        job_id text,
        data jsonb not null,
        deleted boolean not null default false,
        updated_at timestamptz not null default now()
      );
      create index if not exists %1$s_company_updated on public.%1$I (company_id, updated_at);
      alter table public.%1$I enable row level security;
      drop policy if exists %1$s_member on public.%1$I;
      create policy %1$s_member on public.%1$I for all to authenticated
        using (public.is_member(company_id)) with check (public.is_member(company_id));
    $f$, t);
  end loop;
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['jobs','scope_items','variations','valuations'] loop
    execute format('drop trigger if exists %1$s_touch on public.%1$I; create trigger %1$s_touch before insert or update on public.%1$I for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

alter table public.companies enable row level security;
drop policy if exists companies_member on public.companies;
create policy companies_member on public.companies for select to authenticated using (public.is_member(id));

alter table public.memberships enable row level security;
drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships for select to authenticated using (user_id = auth.uid());

-- Photos: private bucket, one folder per company.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists photos_member_read on storage.objects;
drop policy if exists photos_member_write on storage.objects;
drop policy if exists photos_member_update on storage.objects;
create policy photos_member_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy photos_member_write on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy photos_member_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- v2: site diary
do $$ declare t text := 'diary_entries'; begin execute format('create table if not exists public.%1$I (id text primary key, company_id uuid not null references public.companies(id) on delete cascade, job_id text, data jsonb not null, deleted boolean not null default false, updated_at timestamptz not null default now()); create index if not exists %1$s_company_updated on public.%1$I (company_id, updated_at); alter table public.%1$I enable row level security; drop policy if exists %1$s_member on public.%1$I; create policy %1$s_member on public.%1$I for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id)); drop trigger if exists %1$s_touch on public.%1$I; create trigger %1$s_touch before insert or update on public.%1$I for each row execute function public.touch_updated_at();', t); end $$;

-- v3: company settings (invoice details)
do $$ declare t text := 'company_settings'; begin execute format('create table if not exists public.%1$I (id text not null, company_id uuid not null references public.companies(id) on delete cascade, job_id text, data jsonb not null, deleted boolean not null default false, updated_at timestamptz not null default now(), primary key (company_id, id)); create index if not exists %1$s_company_updated on public.%1$I (company_id, updated_at); alter table public.%1$I enable row level security; drop policy if exists %1$s_member on public.%1$I; create policy %1$s_member on public.%1$I for all to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id)); drop trigger if exists %1$s_touch on public.%1$I; create trigger %1$s_touch before insert or update on public.%1$I for each row execute function public.touch_updated_at();', t); end $$;

-- =====================================================================
-- v4: AI reading is for signed-in members only, with a daily limit per company.
-- The serverless readers (api/parse-boq, api/parse-vo) call use_ai() with the caller's own
-- sign-in token before anything is sent to the AI: no token, no company or over the limit = no read.
-- =====================================================================
alter table public.companies add column if not exists ai_daily_limit integer not null default 60;

create table if not exists public.ai_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  day date not null default current_date,
  kind text not null,
  count integer not null default 0,
  primary key (company_id, day, kind)
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_member_read on public.ai_usage;
create policy ai_usage_member_read on public.ai_usage for select to authenticated using (public.is_member(company_id));

create or replace function public.use_ai(p_kind text) returns integer
language plpgsql security definer set search_path = public as $$
declare c uuid; lim integer; used integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select m.company_id into c from public.memberships m where m.user_id = auth.uid() order by m.created_at limit 1;
  if c is null then raise exception 'no company' using errcode = '28000'; end if;
  select ai_daily_limit into lim from public.companies where id = c;
  select coalesce(sum(count), 0) into used from public.ai_usage where company_id = c and day = current_date;
  if used >= lim then raise exception 'ai_daily_limit' using errcode = 'P0001', hint = lim::text; end if;
  insert into public.ai_usage(company_id, day, kind, count) values (c, current_date, left(coalesce(p_kind, 'other'), 20), 1)
    on conflict (company_id, day, kind) do update set count = public.ai_usage.count + 1;
  return lim - used - 1;
end $$;
revoke all on function public.use_ai(text) from public;
grant execute on function public.use_ai(text) to authenticated;

-- =====================================================================
-- v5: team. An owner or director adds someone by email with a role; when that person signs in
-- with that (confirmed) email, they join the company. No email is sent by the app — the
-- inviter shares the link themselves.
-- =====================================================================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','director','qs','site_manager','operative')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists invites_open_email on public.invites (company_id, lower(email)) where accepted_at is null;
alter table public.invites enable row level security;   -- no direct access: only through the functions below

-- Can the signed-in user manage company c's team?
create or replace function public.can_manage(c uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.memberships m where m.company_id = c and m.user_id = auth.uid() and m.role in ('owner','director'))
$$;

create or replace function public.my_company_id() returns uuid
language sql security definer stable set search_path = public as $$
  select m.company_id from public.memberships m where m.user_id = auth.uid() order by m.created_at limit 1
$$;

-- The team: members (with their email) and open invites. Members only.
create or replace function public.company_team() returns table (kind text, id text, email text, role text, since timestamptz, is_me boolean)
language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.my_company_id();
begin
  if c is null then return; end if;
  return query
    select 'member'::text, m.user_id::text, u.email::text, m.role, m.created_at, m.user_id = auth.uid()
      from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = c
    union all
    select 'invite'::text, i.id::text, i.email, i.role, i.created_at, false
      from public.invites i where i.company_id = c and i.accepted_at is null
    order by 1 desc, 5;
end $$;

create or replace function public.invite_member(p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_company_id(); e text := lower(trim(p_email)); new_id uuid;
begin
  if c is null or not public.can_manage(c) then raise exception 'Only an owner or director can add people.'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address doesn’t look right.'; end if;
  if p_role not in ('owner','director','qs','site_manager','operative') then raise exception 'Unknown role.'; end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = c and lower(u.email) = e)
    then raise exception 'They’re already on your team.'; end if;
  insert into public.invites(company_id, email, role, invited_by) values (c, e, p_role, auth.uid())
    on conflict (company_id, lower(email)) where accepted_at is null do update set role = excluded.role
    returning id into new_id;
  return new_id;
end $$;

create or replace function public.cancel_invite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.invites i where i.id = p_id and i.accepted_at is null and public.can_manage(i.company_id);
end $$;

create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_company_id();
begin
  if c is null or not public.can_manage(c) then raise exception 'Only an owner or director can change roles.'; end if;
  if p_role not in ('owner','director','qs','site_manager','operative') then raise exception 'Unknown role.'; end if;
  if p_role <> 'owner' and (select role from public.memberships where company_id = c and user_id = p_user) = 'owner'
     and (select count(*) from public.memberships where company_id = c and role = 'owner') = 1
    then raise exception 'The company needs at least one owner.'; end if;
  update public.memberships set role = p_role where company_id = c and user_id = p_user;
end $$;

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_company_id();
begin
  if c is null or not public.can_manage(c) then raise exception 'Only an owner or director can remove people.'; end if;
  if p_user = auth.uid() then raise exception 'You can’t remove yourself.'; end if;
  if (select role from public.memberships where company_id = c and user_id = p_user) = 'owner'
     and (select count(*) from public.memberships where company_id = c and role = 'owner') = 1
    then raise exception 'The company needs at least one owner.'; end if;
  delete from public.memberships where company_id = c and user_id = p_user;
end $$;

-- On sign-in: join any company that invited this (confirmed) email. Returns the company joined, if any.
create or replace function public.accept_invites() returns uuid
language plpgsql security definer set search_path = public as $$
declare e text; confirmed timestamptz; inv record;
begin
  if auth.uid() is null then return null; end if;
  select lower(u.email), u.email_confirmed_at into e, confirmed from auth.users u where u.id = auth.uid();
  if e is null or confirmed is null then return null; end if;           -- only a confirmed email can claim an invite
  if exists (select 1 from public.memberships where user_id = auth.uid()) then return null; end if; -- one company per person for now
  select * into inv from public.invites where lower(email) = e and accepted_at is null order by created_at limit 1;
  if inv.id is null then return null; end if;
  insert into public.memberships(company_id, user_id, role) values (inv.company_id, auth.uid(), inv.role) on conflict do nothing;
  update public.invites set accepted_at = now() where id = inv.id;
  return inv.company_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['company_team()','invite_member(text, text)','cancel_invite(uuid)','set_member_role(uuid, text)','remove_member(uuid)','accept_invites()','can_manage(uuid)','my_company_id()'] loop
    execute format('revoke all on function public.%s from public; grant execute on function public.%s to authenticated;', f, f);
  end loop;
end $$;

-- =====================================================================
-- v6: costs and margin, small works orders, dayworks sheets, job documents.
-- Same shape as the other record tables (company-only, synced by updated_at).
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['costs','work_orders','dayworks','job_documents'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        company_id uuid not null references public.companies(id) on delete cascade,
        job_id text,
        data jsonb not null,
        deleted boolean not null default false,
        updated_at timestamptz not null default now()
      );
      create index if not exists %1$s_company_updated on public.%1$I (company_id, updated_at);
      alter table public.%1$I enable row level security;
      drop policy if exists %1$s_member on public.%1$I;
      create policy %1$s_member on public.%1$I for all to authenticated
        using (public.is_member(company_id)) with check (public.is_member(company_id));
      drop trigger if exists %1$s_touch on public.%1$I;
      create trigger %1$s_touch before insert or update on public.%1$I for each row execute function public.touch_updated_at();
    $f$, t);
  end loop;
end $$;

-- =====================================================================
-- v7: founding sign-ups from the front page. Fifty numbered places (I to L); after that people
-- still sign up, on the waiting list (place is null). Nobody outside reads the table: the page
-- only claims a place and asks how many are taken, through the two functions below.
-- =====================================================================
create table if not exists public.early_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  place int unique,                      -- 1–50 = founding place; null = waiting list
  name text not null,
  firm text not null,
  email text not null,
  phone text not null default '',
  work text not null default '',         -- the work they do (PPR / WHQS, responsive, …)
  size text not null default '',         -- how many people
  note text not null default '',
  source text not null default ''
);
create unique index if not exists early_signups_email on public.early_signups (lower(email));
alter table public.early_signups enable row level security;   -- no policies: reached only through the functions

create or replace function public.founding_places_taken() returns int
language sql security definer stable set search_path = public as $$
  select count(*)::int from public.early_signups where place is not null
$$;

-- Claim the next founding place. The same email again gets its own place back (signing up twice
-- never takes two). Returns the place (null = waiting list) and whether it was already claimed.
create or replace function public.claim_founding_place(p_name text, p_firm text, p_email text, p_phone text default '',
  p_work text default '', p_size text default '', p_note text default '', p_source text default '')
returns table (place int, already boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare existing public.early_signups; next_place int;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_firm), '') = '' or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'signup_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtext('early_signups'));   -- one claim at a time, so no place is given twice
  select * into existing from public.early_signups e where lower(e.email) = lower(trim(p_email));
  if found then return query select existing.place, true; return; end if;
  select count(*) + 1 into next_place from public.early_signups e where e.place is not null;
  if next_place > 50 then next_place := null; end if;
  insert into public.early_signups (place, name, firm, email, phone, work, size, note, source)
  values (next_place, left(trim(p_name), 120), left(trim(p_firm), 160), left(lower(trim(p_email)), 200), left(trim(coalesce(p_phone, '')), 40),
          left(coalesce(p_work, ''), 120), left(coalesce(p_size, ''), 40), left(coalesce(p_note, ''), 1000), left(coalesce(p_source, ''), 200));
  return query select next_place, false;
end $$;

revoke all on function public.claim_founding_place(text, text, text, text, text, text, text, text) from public;
grant execute on function public.founding_places_taken() to anon, authenticated;
grant execute on function public.claim_founding_place(text, text, text, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- v8: AI metered at its real cost. Replaces the flat 60 uses a day, which counted a 0.3p Clerk
-- question the same as a 44p site read.
--  - Every AI call is written to ai_ledger with what it really cost, in credits: 1 credit = 1p of
--    Mastor's AI cost at the suppliers' list prices (worked out on the server, api/_cost.js).
--  - Heavy reads (site captures, the client's pack, BoQ and VO readers, Clerk reading a document,
--    voice and video through the Claude connector) draw on the plan's monthly allowance, with a
--    daily guard so a fault can't burn a month in an afternoon.
--  - Everyday Clerk questions sit outside the allowance, under a daily fair-use count.
--  - Running out pauses the AI, never the records, and never charges a card.
-- Each firm is on the founding pilot until billing sets its plan (Jupiter's allowance as a hard cap).
-- Safe to run before or after the app update: the app falls back to use_ai() until this has run.
-- =====================================================================
create table if not exists public.plan_limits (
  plan text primary key,
  monthly_credits int not null,         -- heavy reads a month, in credits (1p of AI each)
  first_month_credits int not null,     -- a new firm's first month, while it moves its jobs in
  daily_credits int not null,           -- most heavy reading in one day
  daily_questions int not null,         -- everyday Clerk questions a day (fair use, outside the allowance)
  monthly_reads int,                    -- Mercury: document reads a month instead of credits (null = credits)
  first_month_reads int,
  economy_credits int not null default 0, -- Jupiter: site reading carries on past the allowance, up to this many more
  kinds text[] not null                 -- the AI this plan includes
);
insert into public.plan_limits (plan, monthly_credits, first_month_credits, daily_credits, daily_questions, monthly_reads, first_month_reads, economy_credits, kinds) values
  ('pilot',   4000, 4000, 800, 100, null, null,    0, '{site,pack,boq,vo,ask,ask_doc,media,check}'),
  ('mercury',    0,    0, 300,  10,    5,   20,    0, '{pack,boq,check}'),   -- no Clerk: its 10 a day are for the setup check
  ('minerva', 1500, 3000, 300,  50, null, null,    0, '{site,pack,boq,vo,ask,ask_doc,media,check}'),
  ('jupiter', 4000, 8000, 800, 100, null, null, 4000, '{site,pack,boq,vo,ask,ask_doc,media,check}')
on conflict (plan) do update set monthly_credits = excluded.monthly_credits, first_month_credits = excluded.first_month_credits,
  daily_credits = excluded.daily_credits, daily_questions = excluded.daily_questions, monthly_reads = excluded.monthly_reads,
  first_month_reads = excluded.first_month_reads, economy_credits = excluded.economy_credits, kinds = excluded.kinds;
alter table public.plan_limits enable row level security;
drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);

-- the firm's plan: set by billing (the service key), never by the firm itself (companies has no update policy)
alter table public.companies add column if not exists plan text not null default 'pilot' references public.plan_limits(plan);

create table if not exists public.ai_ledger (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  model text not null default '',
  credits numeric(10,3) not null check (credits >= 0),
  ref text,                              -- a batch's id: collecting it twice never counts it twice
  unique (company_id, ref)
);
create index if not exists ai_ledger_company_at on public.ai_ledger (company_id, at);
alter table public.ai_ledger enable row level security;   -- members read their own; only the functions write
drop policy if exists ai_ledger_member_read on public.ai_ledger;
create policy ai_ledger_member_read on public.ai_ledger for select to authenticated using (public.is_member(company_id));

-- The caller's company (their first membership), or an error the readers turn into plain words.
create or replace function public.ai_company() returns uuid
language plpgsql security definer stable set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select m.company_id into c from public.memberships m where m.user_id = auth.uid() order by m.created_at limit 1;
  if c is null then raise exception 'no company' using errcode = '28000'; end if;
  return c;
end $$;

-- Before any AI call: may this firm's plan do this now? Counts the use and returns the firm, its plan and its lane.
-- Kinds: site, pack, boq, vo, ask_doc, media = heavy (the allowance); ask, check = everyday (fair use);
-- collect = picking up a site read already paid for (sign-in only).
create or replace function public.ai_check(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c uuid := public.ai_company();
  k text := left(coalesce(p_kind, 'other'), 20);
  today date := (now() at time zone 'Europe/London')::date;
  day_start timestamptz := (today::timestamp) at time zone 'Europe/London';
  month_day date := date_trunc('month', today::timestamp)::date;
  month_start timestamptz := (month_day::timestamp) at time zone 'Europe/London';
  co public.companies; p public.plan_limits;
  first boolean; allowance int; used numeric; n int; lane text := 'normal';
begin
  if k = 'collect' then return jsonb_build_object('company', c, 'lane', lane); end if;
  select * into co from public.companies where id = c;
  select * into p from public.plan_limits where plan = co.plan;
  if not found or not (k = any(p.kinds)) then raise exception 'ai_plan' using errcode = 'P0001', hint = coalesce(co.plan, ''); end if;
  first := co.created_at > now() - interval '1 month';
  if k in ('ask', 'check') then
    select coalesce(sum(count), 0) into n from public.ai_usage where company_id = c and day = today and kind in ('ask', 'check');
    if n >= p.daily_questions then raise exception 'ai_daily_questions' using errcode = 'P0001', hint = p.daily_questions::text; end if;
  else
    if p.monthly_reads is not null then
      allowance := case when first then p.first_month_reads else p.monthly_reads end;
      select coalesce(sum(count), 0) into n from public.ai_usage
        where company_id = c and day >= month_day and kind not in ('ask', 'check', 'collect');
      if n >= allowance then raise exception 'ai_month_reads' using errcode = 'P0001', hint = allowance::text; end if;
    else
      allowance := case when first then p.first_month_credits else p.monthly_credits end;
      select coalesce(sum(credits), 0) into used from public.ai_ledger where company_id = c and at >= month_start and kind not in ('ask', 'check');
      if used >= allowance then
        if k = 'site' and used < allowance + p.economy_credits then lane := 'economy';
        else raise exception 'ai_month' using errcode = 'P0001', hint = allowance::text; end if;
      end if;
    end if;
    select coalesce(sum(credits), 0) into used from public.ai_ledger where company_id = c and at >= day_start and kind not in ('ask', 'check');
    if used >= p.daily_credits then raise exception 'ai_daily_credits' using errcode = 'P0001', hint = p.daily_credits::text; end if;
  end if;
  insert into public.ai_usage (company_id, day, kind, count) values (c, today, k, 1)
    on conflict (company_id, day, kind) do update set count = public.ai_usage.count + 1;
  return jsonb_build_object('company', c, 'plan', co.plan, 'lane', lane);
end $$;

-- After an AI call: what it really cost. One call can't be recorded as more than £100 or less than nothing.
create or replace function public.ai_spend(p_kind text, p_model text, p_credits numeric, p_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.ai_company();
begin
  if p_credits is null or p_credits < 0 or p_credits > 10000 then raise exception 'ai_spend_invalid' using errcode = 'P0001'; end if;
  insert into public.ai_ledger (company_id, kind, model, credits, ref)
    values (c, left(coalesce(p_kind, 'other'), 20), left(coalesce(p_model, ''), 60), round(p_credits, 3), nullif(left(coalesce(p_ref, ''), 120), ''))
    on conflict (company_id, ref) do nothing;
end $$;

-- This month for the firm: its plan, the allowance and what's been used (for Settings → AI this month).
create or replace function public.ai_month() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  c uuid := public.ai_company();
  today date := (now() at time zone 'Europe/London')::date;
  month_day date := date_trunc('month', today::timestamp)::date;
  month_start timestamptz := (month_day::timestamp) at time zone 'Europe/London';
  co public.companies; p public.plan_limits; first boolean;
begin
  select * into co from public.companies where id = c;
  select * into p from public.plan_limits where plan = co.plan;
  first := co.created_at > now() - interval '1 month';
  return jsonb_build_object(
    'plan', co.plan,
    'allowance', case when first then p.first_month_credits else p.monthly_credits end,
    'reads_allowed', case when first then p.first_month_reads else p.monthly_reads end,
    'economy', p.economy_credits,
    'used', (select coalesce(sum(credits), 0) from public.ai_ledger where company_id = c and at >= month_start and kind not in ('ask', 'check')),
    'reads', (select coalesce(sum(count), 0) from public.ai_usage where company_id = c and day >= month_day and kind not in ('ask', 'check', 'collect')),
    'site_reads', (select count(*) from public.ai_ledger where company_id = c and at >= month_start and kind = 'site' and ref is not null),
    'site_credits', (select coalesce(sum(credits), 0) from public.ai_ledger where company_id = c and at >= month_start and kind = 'site'),
    'questions_today', (select coalesce(sum(count), 0) from public.ai_usage where company_id = c and day = today and kind in ('ask', 'check')),
    'questions_allowed', p.daily_questions
  );
end $$;

-- The old check, kept for any copy of the app still calling it: now the same metered check.
create or replace function public.use_ai(p_kind text) returns integer
language plpgsql security definer set search_path = public as $$
begin
  perform public.ai_check(p_kind);
  return 0;
end $$;

revoke all on function public.ai_company() from public;
revoke all on function public.ai_check(text) from public;
revoke all on function public.ai_spend(text, text, numeric, text) from public;
revoke all on function public.ai_month() from public;
grant execute on function public.ai_check(text) to authenticated;
grant execute on function public.ai_spend(text, text, numeric, text) to authenticated;
grant execute on function public.ai_month() to authenticated;
