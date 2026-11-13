// The AI readers refuse anything that isn't a signed-in member whose plan includes this AI and has allowance
// left (supabase/schema.sql v8 ai_check), and write what each call really cost (ai_spend). Until the database
// has v8 they fall back to the old daily count (use_ai), and refuse rather than read unmetered if neither exists.
import boq from '../api/parse-boq.js'
import vo from '../api/parse-vo.js'
import { aiCheck } from '../api/_guard.js'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

process.env.ANTHROPIC_API_KEY = 'test-key'
type Reply = { status: number; body: unknown }
let check: Reply = { status: 200, body: { company: 'c1', plan: 'pilot', lane: 'normal' } }
let old: Reply = { status: 200, body: 5 }
let aiCalls = 0, rpcAuth = ''
const spent: { p_kind: string; p_model: string; p_credits: number }[] = []
const usage = { input_tokens: 10_000, output_tokens: 2_000 }
globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body?: string }) => {
  const u = String(url)
  if (u.includes('/rest/v1/rpc/ai_check')) { rpcAuth = init.headers.authorization; return new Response(JSON.stringify(check.body), { status: check.status }) }
  if (u.includes('/rest/v1/rpc/use_ai')) return new Response(JSON.stringify(old.body), { status: old.status })
  if (u.includes('/rest/v1/rpc/ai_spend')) { spent.push(JSON.parse(init.body!)); return new Response(null, { status: 204 }) }
  aiCalls++
  return new Response(JSON.stringify({ model: 'claude-sonnet-5', content: [{ type: 'text', text: '{"ref":""}' }], stop_reason: 'end_turn', usage }), { status: 200 })
}) as typeof fetch

const call = async (h: typeof boq, body: unknown, token?: string) => {
  const out = { status: 0, json: null as unknown }
  const res = { status(s: number) { out.status = s; return res }, json(j: unknown) { out.json = j; return res } }
  await h({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body } as never, res as never)
  return out
}
const error = (r: { json: unknown }) => (r.json as { error: string }).error
const doc = { kind: 'text', text: 'CODE QTY RATE' }

let r = await call(boq, doc)
ok(r.status === 401 && aiCalls === 0, 'no sign-in token: refused before the AI is called')
r = await call(boq, doc, 'tok')
ok(r.status === 200 && aiCalls === 1 && rpcAuth === 'Bearer tok', 'signed-in member: read goes ahead, checked with their own token')
// 10,000 in + 2,000 out on Sonnet: $0.02 + $0.02 = $0.04 → 3.2p at 0.80
ok(spent.length === 1 && spent[0].p_kind === 'boq' && spent[0].p_model === 'claude-sonnet-5' && Math.abs(spent[0].p_credits - 3.2) < 0.001, 'what the read really cost is written to the ledger (3.2 credits)')

const refused = async (body: unknown, status: number, re: RegExp, m: string, h = boq) => {
  check = { status: 400, body }
  const n = aiCalls
  const x = await call(h, h === vo ? { kind: 'pdf', data: 'JVBER' } : doc, 'tok')
  ok(x.status === status && aiCalls === n && re.test(error(x)), m)
}
await refused({ code: 'P0001', message: 'ai_month', hint: '1500' }, 429, /this month’s AI allowance.*1st.*carries on/, 'allowance used: refused until the 1st, records carry on')
await refused({ code: 'P0001', message: 'ai_daily_credits', hint: '300' }, 429, /most AI reading for one day.*midnight/, 'the day’s guard reached: refused until midnight')
await refused({ code: 'P0001', message: 'ai_month_reads', hint: '5' }, 429, /this month’s 5 document reads/, 'Mercury’s 5 reads used: says how many')
await refused({ code: 'P0001', message: 'ai_plan', hint: 'mercury' }, 403, /The VO ticket reader isn’t on your plan.*Arch and Dome/, 'not on the plan: names what, and which plans have it', vo)
await refused({ message: 'JWT expired' }, 401, /expired/, 'expired sign-in: refused')
check = { status: 401, body: { message: 'JWT expired' } }
r = await call(boq, doc, 'old')
ok(r.status === 401, 'a 401 from the database is an expired sign-in')
await refused({ code: '28000', message: 'no company' }, 403, /company/, 'signed in without a company: refused')

// the database without v8: the old daily count still guards it
check = { status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }
old = { status: 200, body: 5 }
let n = aiCalls
r = await call(boq, doc, 'tok')
ok(r.status === 200 && aiCalls === n + 1, 'database not updated yet: falls back to the old daily count')
old = { status: 400, body: { code: 'P0001', message: 'ai_daily_limit', hint: '60' } }
r = await call(boq, doc, 'tok')
ok(r.status === 429 && aiCalls === n + 1 && /all 60 of today’s/.test(error(r)), 'and its limit still says how many')
old = { status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }
r = await call(boq, doc, 'tok')
ok(r.status === 503 && aiCalls === n + 1, 'neither check in the database: refused rather than read unmetered')

check = { status: 200, body: { company: 'c1', plan: 'pilot', lane: 'normal' } }
n = aiCalls
r = await call(boq, { kind: 'pdf', data: 'x'.repeat(4_500_000) }, 'tok')
ok(r.status === 413 && aiCalls === n, 'oversized upload: refused')
r = await call(boq, {}, 'tok')
ok(r.status === 400 && aiCalls === n, 'empty request: refused without counting a read')

const c = await aiCheck('tok', 'collect')
ok(c.ok && c.company === 'c1', 'aiCheck answers with the firm, for collecting a read')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
