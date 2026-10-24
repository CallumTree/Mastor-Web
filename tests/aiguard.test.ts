// The AI readers refuse anything that isn't a signed-in member under the company's daily limit.
import boq from '../api/parse-boq.js'
import vo from '../api/parse-vo.js'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

process.env.ANTHROPIC_API_KEY = 'test-key'
let rpc: { status: number; body: unknown } = { status: 200, body: 5 }
let aiCalls = 0, rpcAuth = ''
globalThis.fetch = (async (url: string, init: { headers: Record<string, string> }) => {
  if (String(url).includes('/rest/v1/rpc/use_ai')) { rpcAuth = init.headers.authorization; return new Response(JSON.stringify(rpc.body), { status: rpc.status }) }
  aiCalls++
  return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"ref":""}' }], stop_reason: 'end_turn' }), { status: 200 })
}) as typeof fetch

const call = async (h: typeof boq, body: unknown, token?: string) => {
  const out = { status: 0, json: null as unknown }
  const res = { status(s: number) { out.status = s; return res }, json(j: unknown) { out.json = j; return res } }
  await h({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body } as never, res as never)
  return out
}
const doc = { kind: 'text', text: 'CODE QTY RATE' }

let r = await call(boq, doc)
ok(r.status === 401 && aiCalls === 0, 'no sign-in token: refused before the AI is called')
r = await call(boq, doc, 'tok')
ok(r.status === 200 && aiCalls === 1 && rpcAuth === 'Bearer tok', 'signed-in member: read goes ahead, checked with their own token')
rpc = { status: 400, body: { code: 'P0001', message: 'ai_daily_limit', hint: '60' } }
r = await call(boq, doc, 'tok')
ok(r.status === 429 && aiCalls === 1 && /all 60 of today’s/.test((r.json as { error: string }).error), 'over the daily limit: refused, says how many')
rpc = { status: 401, body: { message: 'JWT expired' } }
r = await call(vo, { kind: 'pdf', data: 'JVBER' }, 'old')
ok(r.status === 401 && aiCalls === 1, 'expired sign-in: refused (VO reader too)')
rpc = { status: 403, body: { code: '28000', message: 'no company' } }
r = await call(boq, doc, 'tok')
ok(r.status === 403 && aiCalls === 1, 'signed in without a company: refused')
rpc = { status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }
r = await call(boq, doc, 'tok')
ok(r.status === 503 && aiCalls === 1, 'database not updated yet: refused rather than read unmetered')
rpc = { status: 200, body: 5 }
r = await call(boq, { kind: 'pdf', data: 'x'.repeat(4_500_000) }, 'tok')
ok(r.status === 413 && aiCalls === 1, 'oversized upload: refused')
r = await call(boq, {}, 'tok')
ok(r.status === 400 && aiCalls === 1, 'empty request: refused without counting a read')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
