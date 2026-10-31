/**
 * Ask, the assistant inside the app: the real handler over HTTP, against a fake Supabase holding one job
 * and a scripted Claude. It must refuse without a sign-in, read with the connector's own tools, stop at
 * every change and show it as a card (nothing saved until Do it), save on Do it only (marked “by Claude”),
 * answer Claude that nothing changed on Cancel, count each question once against the AI limit — and
 * api/agent.js must be the current build of server/agent.
 */
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import type { Job, ScopeItem, Valuation } from '../src/lib/types'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

process.env.ANTHROPIC_API_KEY = 'ak'
const SB = 'https://susecnvepvwmqhziferf.supabase.co'

const job: Job = { id: 'j1', name: 'Windsor Road WHQS', client: 'PCC', address: 'Windsor Road', contractRef: 'MH21180', poNumber: 'PO1', contractValue: 0, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
const S = (id: string, property: string, valuationId: string | null): ScopeItem =>
  ({ id, jobId: 'j1', code: '4360BD', description: `Masonry paint ${id}`, room: 'Walls', qty: 10, unit: 'SM', rate: 5.62, valuationId, order: 1, property, workstream: 'Paint', createdAt: 1 })
const scope = [S('s1', '3', 'vb'), S('s3', '4', null), S('s4', '5', null)]
const vals: Valuation[] = [{ id: 'vb', jobId: 'j1', number: 1, status: 'Open', createdAt: 2, issuedAt: null }]
const TABLES: Record<string, () => unknown[]> = { jobs: () => [job], scope_items: () => scope, valuations: () => vals, variations: () => [], diary_entries: () => [], work_orders: () => [], job_documents: () => [], costs: () => [], company_settings: () => [] }

// ---------- a scripted Claude: what it says next, by what it has seen ----------
const asked: any[] = []
let failReply = false   // Claude errors on its reply after a change has run
const reply = (content: any[], stop: string) => ({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } })
function claude(body: any) {
  const last = body.messages[body.messages.length - 1]
  const said = (t: string) => typeof last.content === 'string' ? last.content.includes(t) : last.content.some((b: any) => b.type === 'text' && b.text.includes(t))
  const results = Array.isArray(last.content) ? last.content.filter((b: any) => b.type === 'tool_result') : []
  if (failReply && results.length) return null
  if (said('one more')) return reply([{ type: 'tool_use', id: 'w3', name: 'add_to_valuation', input: { job: 'j1', scope_line_ids: ['s4'] } }], 'tool_use')
  if (results.some((r: any) => r.content.some((c: any) => /Cancel/.test(c.text)))) return reply([{ type: 'text', text: 'Left it as it is.' }], 'end_turn')
  if (results.some((r: any) => r.tool_use_id === 'w1' || r.tool_use_id === 'w2')) return reply([{ type: 'text', text: 'Done: No. 4 paint is in VAL I.' }], 'end_turn')
  if (results.length) return reply([{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: 'I’ll add No. 4 masonry paint, £56.20.' }, { type: 'tool_use', id: 'w1', name: 'add_to_valuation', input: { job: 'j1', scope_line_ids: ['s3'] } }], 'tool_use')
  if (said('after all')) return reply([{ type: 'tool_use', id: 'w2', name: 'add_to_valuation', input: { job: 'j1', scope_line_ids: ['s3'] } }], 'tool_use')
  return reply([{ type: 'tool_use', id: 'r1', name: 'get_scope', input: { job: 'j1', show: 'to_do' } }], 'tool_use')
}

// ---------- fake Supabase and Anthropic ----------
const realFetch = globalThis.fetch
const hits: string[] = [], upserts: { table: string; rows: any[] }[] = []
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.startsWith('https://api.anthropic.com/v1/messages')) {
    const req = input instanceof Request ? input : new Request(url, init)
    const body = JSON.parse(await req.text())
    asked.push({ body, beta: req.headers.get('anthropic-beta'), key: req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace('Bearer ', '') })
    const out = claude(body)
    return out ? new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'boom' } }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
  const h = init.headers instanceof Headers ? Object.fromEntries(init.headers) : init.headers ?? {}
  const token = String(h.authorization ?? '').replace('Bearer ', '')
  if (url.startsWith(SB + '/auth/v1/user')) return token === 'office' ? new Response(JSON.stringify({ id: 'u1', email: 'callum@treeandsons.co.uk' })) : new Response('{}', { status: 401 })
  if (url.startsWith(SB + '/rest/v1/memberships')) return new Response(JSON.stringify([{ company_id: 'c1', role: 'director', companies: { name: 'Tree & Sons' } }]))
  if (url.startsWith(SB + '/rest/v1/rpc/use_ai')) { hits.push('use_ai'); return new Response('1') }
  if (url.startsWith(SB + '/rest/v1/') && init.method === 'POST') {
    const table = url.slice((SB + '/rest/v1/').length).split('?')[0], rows = JSON.parse(init.body), store = TABLES[table]() as any[]
    upserts.push({ table, rows })
    for (const r of rows) { const i = store.findIndex(x => x.id === r.id); if (i >= 0) store[i] = r.data; else store.push(r.data) }
    return new Response(null, { status: 201 })
  }
  if (url.startsWith(SB + '/rest/v1/')) {
    const table = url.slice((SB + '/rest/v1/').length).split('?')[0]
    return new Response(JSON.stringify((TABLES[table]?.() ?? []).map(data => ({ data }))))
  }
  return realFetch(input, init)
}) as typeof fetch

const { default: handler, asResult } = await import('../server/agent/handler')
const srv = http.createServer((req, res) => {
  let raw = ''; req.on('data', c => (raw += c)); req.on('end', async () => {
    const r = req as any, s = res as any
    r.body = raw ? JSON.parse(raw) : undefined
    s.status = (n: number) => { res.statusCode = n; return s }
    s.json = (b: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)) }
    await handler(r, s)
  })
}).listen(0)
await new Promise(r => setTimeout(r, 50))
const base = `http://127.0.0.1:${(srv.address() as any).port}`
const ask = async (token: string, body: unknown) => {
  const r = await realFetch(base, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  const text = await r.text()
  const lines = r.headers.get('content-type')?.includes('ndjson') ? text.trim().split('\n').map(l => JSON.parse(l)) : [JSON.parse(text)]
  return { status: r.status, lines, done: lines.find((l: any) => l.type === 'done') as any }
}

// sign-in and checks
let r = await ask('', { messages: [{ role: 'user', content: 'hi' }] })
ok(r.status === 401 && /Sign in/.test(r.lines[0].error), 'no sign-in: refused')
r = await ask('office', { messages: [{ role: 'assistant', content: 'hi' }] })
ok(r.status === 400, 'a conversation must start with a question')
r = await ask('office', { messages: [{ role: 'user', content: 'hi' }], decision: 'approve' })
ok(r.status === 400 && /no change waiting/.test(r.lines[0].error), 'Do it with nothing waiting: refused')
ok(hits.length === 0 && asked.length === 0, 'nothing refused reaches the AI or the limit')

// a question: reads, then stops at the change
r = await ask('office', { messages: [{ role: 'user', content: 'Tick No. 4 paint into the open val' }], jobId: 'j1' })
ok(r.status === 200 && r.lines.some((l: any) => l.type === 'status' && /Reading the scope/.test(l.text)), 'reads the scope with the connector’s tool, saying so while it works')
ok(r.done?.pending.length === 1 && r.done.pending[0].name === 'add_to_valuation' && /Tick lines/.test(r.done.pending[0].title), 'stops at the change and hands it back as a card')
ok(upserts.length === 0, 'nothing is saved before Do it')
ok(hits.length === 1, 'the question counts once against the daily AI limit')
const first = asked[0]
ok(first.key === 'ak' && first.body.model === 'claude-opus-5-5' && first.body.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(first.beta ?? ''), 'Claude Opus 5.5, with refusal fallbacks')
ok(first.body.tools.length === 16 && /You are Clerk/.test(first.body.system) && /Do it and Cancel/.test(first.body.system), 'the connector’s sixteen tools, and told that changes wait for Do it')
ok(/<context>Today is .*"j1"/.test(first.body.messages[0].content[0].text) && first.body.messages[0].content[1].text === 'Tick No. 4 paint into the open val', 'the first question carries the date and the open job')
let convo = r.done.messages
ok(convo[1].content[0].name === 'get_scope' && convo[2].content[0].type === 'tool_result' && convo[3].content[0].type === 'thinking', 'the conversation comes back whole, thinking blocks untouched')

// Cancel
r = await ask('office', { messages: convo, decision: 'cancel' })
ok(upserts.length === 0, 'Cancel: nothing saved')
ok(r.done?.pending.length === 0 && /Left it/.test(r.done.messages.at(-1).content[0].text), 'Cancel: Claude is told and answers')
ok(hits.length === 1, 'answering a card doesn’t count as another question')
convo = r.done.messages

// ask again, then Do it
r = await ask('office', { messages: [...convo, { role: 'user', content: 'Add it after all' }] })
ok(r.done?.pending[0]?.id === 'w2' && upserts.length === 0, 'asked again: a new card, still nothing saved')
r = await ask('office', { messages: r.done.messages, decision: 'approve' })
const saved = upserts.find(u => u.table === 'scope_items')?.rows[0]?.data
ok(saved?.id === 's3' && saved.valuationId === 'vb' && typeof saved.byClaude === 'number', 'Do it: the line goes into the open valuation, marked by Claude')
ok(/Done/.test(r.done?.messages.at(-1).content[0].text ?? ''), 'and Claude confirms')
ok(hits.length === 2, 'two questions, two counts')

// the change runs, then Claude's reply fails: the phone still gets the saved change, so the card can't come back
r = await ask('office', { messages: [...r.done.messages, { role: 'user', content: 'Add one more' }] })
ok(r.done?.pending[0]?.id === 'w3', 'another card')
failReply = true
r = await ask('office', { messages: r.done.messages, decision: 'approve' })
const err = r.lines.find((l: any) => l.type === 'error'), cp = r.lines.find((l: any) => l.type === 'checkpoint')
ok(upserts.some(u => u.rows[0]?.data?.id === 's4' && u.rows[0].data.valuationId === 'vb'), 'Do it saves even though the reply then fails')
ok(cp && cp.messages.at(-1).content[0].tool_use_id === 'w3', 'a checkpoint with the saved change goes to the phone before Claude replies')
ok(err && err.messages?.at(-1).content[0].tool_use_id === 'w3', 'the error carries the conversation with the change answered, so the card is gone')

srv.close()

// the deployed file is this build
const { options } = await import('../scripts/build-mcp.mjs')
const fresh = await build({ ...options, entryPoints: ['server/agent/handler.ts'], write: false, outfile: 'api/agent.js', logLevel: 'silent' })
const scanned = asResult('t1', { content: [{ type: 'text', text: 'A scanned PDF' }, { type: 'resource', resource: { uri: 'mastor://documents/d', mimeType: 'application/pdf', blob: 'JVBERi0=' } }] })
ok(Array.isArray(scanned.content) && (scanned.content[1] as any).type === 'document' && (scanned.content[1] as any).source.media_type === 'application/pdf' && (scanned.content[1] as any).source.data === 'JVBERi0=',
  'a scanned document reaches Claude as the PDF itself')
ok(fresh.outputFiles[0].text === readFileSync('api/agent.js', 'utf8'), 'api/agent.js is up to date (run npm run build:mcp after changing server/ or the src/lib it uses)')

console.log(`\nagent: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
