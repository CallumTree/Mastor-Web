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
