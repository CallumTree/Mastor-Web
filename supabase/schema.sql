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
