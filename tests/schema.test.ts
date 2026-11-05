// The cloud database's AI metering (supabase/schema.sql v8), run for real in an in-memory Postgres: plans, the
// allowance and daily guard, fair use, the economy lane, Mercury's reads, and what a member can't do.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'
const db = new PGlite()
const q = (s: string, p?: unknown[]) => db.query<any>(s, p)
await db.exec(`
create role authenticated; create role anon; create role service_role;
create schema auth; create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`)
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', ''))
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', ''))   // safe to run twice
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const err = async (sql: string, p?: unknown[]) => { try { await q(sql, p); return null } catch (e) { return (e as Error).message } }
const U = '11111111-1111-1111-1111-111111111111'
await q(`insert into auth.users (id, email) values ($1, 'a@x.uk')`, [U])
const C = (await q(`insert into public.companies (name, created_at) values ('Firm', now() - interval '3 months') returning id`)).rows[0].id
await q(`insert into public.memberships (company_id, user_id) values ($1, $2)`, [C, U])
await db.exec(`set test.uid = ''`)
ok(/not signed in/.test(await err(`select public.ai_check('site')`)), 'no sign-in: refused')
await db.exec(`set test.uid = '${U}'`)
const chk = async (k: string) => (await q(`select public.ai_check($1) as r`, [k])).rows[0].r
let r = await chk('site')
ok(r.plan === 'pilot' && r.lane === 'normal' && r.company === C, 'a new firm is on the pilot: a site read goes ahead')
await q(`select public.ai_spend('site', 'claude-opus-5-5', 120.5, 'msgbatch_1')`)
await q(`select public.ai_spend('site', 'claude-opus-5-5', 120.5, 'msgbatch_1')`)
let m = (await q(`select public.ai_month() as r`)).rows[0].r
ok(Number(m.used) === 120.5 && m.site_reads === 1, 'the same batch collected twice counts once')
ok(/ai_spend_invalid/.test(await err(`select public.ai_spend('site', 'x', -5)`)), 'negative cost refused (no buying allowance back)')
await q(`select public.ai_spend('ask', 'claude-haiku-5-5', 0.4)`)
m = (await q(`select public.ai_month() as r`)).rows[0].r
ok(Number(m.used) === 120.5, 'everyday questions sit outside the allowance')
// daily guard: pilot 800 a day
await q(`select public.ai_spend('pack', 'claude-opus-5-5', 700)`)
ok(/ai_daily_credits/.test(await err(`select public.ai_check('boq')`)), 'past the day’s 800 credits: heavy reads refused')
ok((await chk('ask')).lane === 'normal', 'but everyday questions still go')
// monthly allowance: move today's spend to earlier this month, so the daily guard isn't what stops it
await q(`update public.ai_ledger set at = date_trunc('month', now()) + interval '1 hour' where kind <> 'ask'`)
await q(`select public.ai_spend('vo', 'claude-sonnet-5', 3200)`)
await q(`update public.ai_ledger set at = date_trunc('month', now()) + interval '1 hour'`)
ok(/ai_month/.test(await err(`select public.ai_check('site')`)), 'past the pilot’s 4,000 credits: refused, no economy lane')
await q(`update public.companies set plan = 'jupiter' where id = $1`, [C])
r = await chk('site')
ok(r.lane === 'economy', 'Jupiter past its allowance: site reading carries on in the economy lane')
ok(/ai_month/.test(await err(`select public.ai_check('pack')`)), 'Jupiter past its allowance: other heavy reads pause')
await q(`update public.companies set plan = 'minerva' where id = $1`, [C])
ok(/ai_month/.test(await err(`select public.ai_check('site')`)), 'Minerva past its allowance: site reading pauses')
// fair use
await q(`update public.ai_usage set count = 50 where kind = 'ask'`)
ok(/ai_daily_questions/.test(await err(`select public.ai_check('ask')`)), 'Minerva: the 51st question of the day is refused')
// Mercury
await q(`update public.companies set plan = 'mercury' where id = $1`, [C])
ok(/ai_plan/.test(await err(`select public.ai_check('ask')`)), 'Mercury: no Clerk')
ok(/ai_plan/.test(await err(`select public.ai_check('site')`)), 'Mercury: no automatic site reading')
await q(`delete from public.ai_usage`); await q(`delete from public.ai_ledger`)
ok((await chk('check')).plan === 'mercury', 'Mercury: the AI setup check still runs')
for (let i = 0; i < 5; i++) await chk(i % 2 ? 'pack' : 'boq')
ok(/ai_month_reads/.test(await err(`select public.ai_check('pack')`)), 'Mercury: the 6th document read of the month is refused')
m = (await q(`select public.ai_month() as r`)).rows[0].r
ok(m.reads === 5 && m.reads_allowed === 5, 'the month shows 5 of 5 reads')
await q(`update public.companies set created_at = now() where id = $1`, [C])
ok((await chk('pack')).plan === 'mercury', 'a firm in its first month gets more reads (20)')
// collect needs only sign-in
await q(`update public.companies set plan = 'mercury' where id = $1`, [C])
ok((await chk('collect')).company === C, 'collecting a read already paid for: sign-in only')
// the old function is the new check
await q(`update public.companies set plan = 'pilot' where id = $1`, [C])
ok((await q(`select public.use_ai('boq') as n`)).rows[0].n === 0, 'use_ai() still answers, through the metered check')
// a member can't change their own plan or write the ledger directly (RLS as authenticated)
await db.exec(`grant usage on schema public to authenticated; grant select, insert, update on all tables in schema public to authenticated; set role authenticated`)
const before = (await q(`select plan from public.companies where id = $1`, [C])).rows[0]?.plan
await q(`update public.companies set plan = 'jupiter' where id = $1`, [C]).catch(() => {})
await db.exec(`reset role`)
ok((await q(`select plan from public.companies where id = $1`, [C])).rows[0].plan === 'pilot' && before === 'pilot', 'a member can’t move their firm to another plan')
await db.exec(`set role authenticated`)
ok(!!(await err(`insert into public.ai_ledger (company_id, kind, credits) values ($1, 'site', 0)`, [C])), 'a member can’t write the ledger directly')
await db.exec(`reset role`)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
