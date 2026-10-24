/**
 * Mastor as a Claude connector: the real server over HTTP, against a fake Supabase holding one job.
 * It must refuse without a sign-in (pointing Claude at where to sign in), speak MCP, report the app's own
 * figures and alerts, keep money from operatives, hand photos over as images, transcribe a voice note
 * once — and api/mcp.js must be the current build of server/mcp.
 */
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation } from '../src/lib/types'
import { jobAlerts } from '../src/lib/alerts'
import { valTotals } from '../src/lib/valuation'
import { money } from '../src/lib/format'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

process.env.GEMINI_API_KEY = 'gk'
const SB = 'https://susecnvepvwmqhziferf.supabase.co'

// ---------- the fake company: one job, two properties, VAL I issued, VAL II open, a VO, a day on site ----------
const job: Job = { id: 'j1', name: 'Windsor Road WHQS', client: 'PCC', address: 'Windsor Road, Pembroke', contractRef: 'MH21180', poNumber: '', contractValue: 0, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
const other: Job = { ...job, id: 'j2', name: 'Windsor Court', contractRef: 'MH9', createdAt: 2 }
const S = (id: string, property: string, qty: number | null, rate: number | null, valuationId: string | null): ScopeItem =>
  ({ id, jobId: 'j1', code: '4360BD', description: `Masonry paint ${id}`, room: 'Walls', qty, unit: 'SM', rate, valuationId, order: 1, property, workstream: 'Paint', createdAt: 1 })
const scope = [S('s1', '3', 10, 5.62, 'va'), S('s2', '4', 20, 5.62, 'vb'), S('s3', '4', 30, 5.62, null)]
const vals: Valuation[] = [{ id: 'va', jobId: 'j1', number: 1, status: 'Issued', createdAt: 1, issuedAt: Date.now() - 40 * 864e5 } as Valuation, { id: 'vb', jobId: 'j1', number: 2, status: 'Open', createdAt: 2, issuedAt: null }]
const vos: Variation[] = [{ id: 'vo1', jobId: 'j1', number: 1, description: 'Renew rotten joists under bath', room: 'No. 4 bathroom', qty: 2, unit: 'LM', rate: null, code: '', reason: 'Found when bath removed', clientRef: '', status: 'Identified', photoIds: [], dateRaised: Date.now(), valuationId: null }]
const today = new Date().toISOString().slice(0, 10)
const E = (id: string, type: DiaryEntry['type'], extra: Partial<DiaryEntry> = {}): DiaryEntry =>
  ({ id, jobId: 'j1', date: today, type, note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: 1, ...extra })
let diary: DiaryEntry[] = [
  E('d-day', 'day', { weather: 'Dry, 12°C', labour: 3, note: 'Scaffold up at No. 4' }),
  E('d-photo', 'photo', { mediaId: 'm-photo', note: 'Rot under bath', room: 'Bathroom' }),
  E('d-voice', 'voice', { mediaId: 'm-voice' }),
  E('d-note', 'note', { note: 'Dylan agreed the airing cupboard partition', category: 'Client', pinned: true }),
  E('d-money', 'note', { note: 'Agreed day rate £280', category: 'Commercial' }),
]
const TABLES: Record<string, () => { id: string; jobId?: string; data?: unknown }[]> = {
  jobs: () => [job, other], scope_items: () => scope, valuations: () => vals, variations: () => vos, diary_entries: () => diary,
  work_orders: () => [], job_documents: () => [{ id: 'doc1', jobId: 'j1', name: 'RAMS.pdf', kind: 'RAMS', fileId: 'f', type: 'application/pdf', size: 1, addedAt: 1 }],
  costs: () => [], company_settings: () => [],
}

// ---------- fake Supabase + Gemini (everything else goes to the real network: the test's own server) ----------
const realFetch = globalThis.fetch
const hits: string[] = []
let patched: any = null
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input instanceof Request ? input.url : input)
  const token = String(init.headers?.authorization ?? '').replace('Bearer ', '')
  if (url.startsWith(SB + '/auth/v1/user')) {
    const user = token === 'office' ? { id: 'u1', email: 'callum@treeandsons.co.uk' } : token === 'op' ? { id: 'u2', email: 'dai@treeandsons.co.uk' } : null
    return user ? new Response(JSON.stringify(user)) : new Response('{"msg":"bad jwt"}', { status: 401 })
  }
  if (url.startsWith(SB + '/rest/v1/memberships')) return new Response(JSON.stringify([{ company_id: 'c1', role: url.includes('u2') ? 'operative' : 'director', companies: { name: 'Tree & Sons' } }]))
  if (url.startsWith(SB + '/rest/v1/rpc/use_ai')) { hits.push('use_ai'); return new Response('1') }
  if (url.startsWith(SB + '/rest/v1/') && init.method === 'PATCH') { patched = JSON.parse(init.body); diary = diary.map(e => (e.id === patched.data.id ? patched.data : e)); return new Response(null, { status: 204 }) }
  if (url.startsWith(SB + '/rest/v1/')) {
    const table = url.slice((SB + '/rest/v1/').length).split('?')[0]
    const jobId = /job_id=eq\.([^&]+)/.exec(url)?.[1]
    const rows = (TABLES[table]?.() ?? []).filter(r => !jobId || (r as any).jobId === decodeURIComponent(jobId))
    return new Response(JSON.stringify(rows.map(data => ({ data }))))
  }
  if (url.startsWith(SB + '/storage/v1/object/photos/c1/m-photo.jpg')) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
  if (url.startsWith(SB + '/storage/v1/object/photos/c1/m-voice.jpg')) return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
  if (url.includes(':generateContent')) { hits.push('gemini'); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Number four masonry paint is finished.' }] } }] })) }
  return realFetch(input, init)
}) as typeof fetch

// ---------- the real handler behind a real HTTP server ----------
const { default: handler } = await import('../server/mcp/handler')
const { default: resource } = await import('../api/oauth-resource.js')
const vercelish = (fn: (req: any, res: any) => unknown) => http.createServer((req, res) => {
  let raw = ''; req.on('data', c => (raw += c)); req.on('end', async () => {
    const r = req as any, s = res as any
    r.body = raw ? JSON.parse(raw) : undefined
    s.status = (n: number) => { res.statusCode = n; return s }
    s.json = (b: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)) }
    await fn(r, s)
  })
})
const srv = vercelish(handler).listen(0), meta = vercelish(resource).listen(0)
await new Promise(r => setTimeout(r, 50))
const base = `http://127.0.0.1:${(srv.address() as any).port}`
let n = 0
const rpc = async (token: string, method: string, params: unknown = {}) => {
  const r = await realFetch(base, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) })
  return { status: r.status, auth: r.headers.get('www-authenticate'), body: await r.json().catch(() => null) as any }
}
const call = async (token: string, name: string, args: unknown) => (await rpc(token, 'tools/call', { name, arguments: args })).body?.result
const json = (res: any) => JSON.parse(res.content[0].text)

// sign-in
let r = await rpc('', 'tools/list')
ok(r.status === 401 && /resource_metadata="https:\/\/[^"]+\/\.well-known\/oauth-protected-resource"/.test(r.auth ?? ''), 'no sign-in: 401 pointing Claude at the protected-resource metadata')
r = await rpc('expired', 'tools/list')
ok(r.status === 401 && /expired/.test(r.body?.error ?? ''), 'a bad or expired sign-in: 401, says connect again')
const m = await (await realFetch(`http://127.0.0.1:${(meta.address() as any).port}`)).json() as any
ok(/\/api\/mcp$/.test(m.resource) && m.authorization_servers[0] === `${SB}/auth/v1`, 'metadata names /api/mcp and Supabase Auth as its sign-in')

// the MCP handshake
r = await rpc('office', 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
ok(r.status === 200 && r.body.result.serverInfo.name === 'mastor' && /Tree & Sons/.test(r.body.result.instructions) && /never here/.test(r.body.result.instructions), 'initialize: Mastor, the company, and “issuing is never here”')
r = await rpc('office', 'tools/list')
const tools = r.body.result.tools as any[]
ok(tools.map(t => t.name).join(',') === 'mastor_overview,get_job,get_scope,get_variations,get_valuations,get_site_diary,view_site_media', 'seven tools')
ok(tools.every(t => t.annotations?.readOnlyHint === true), 'phase 1: every tool is read-only')

// the app's own figures and alerts
const ov = json(await call('office', 'mastor_overview', {}))
const wr = ov.jobs.find((j: any) => j.id === 'j1')
ok(ov.money.readyToClaim === money(valTotals(job, 'vb', scope, vos).gross), 'overview: ready to claim = the open valuation’s value')
const alerts = jobAlerts(job, scope, vos, vals, []).alerts
ok(wr.actionNeeded.length === alerts.length && alerts.every(a => wr.actionNeeded.some((x: string) => x.includes(a.text))), 'overview: the same “action needed” as the job’s home screen')
ok(wr.actionNeeded.some((x: string) => /^NEXT: VAL II/.test(x)) && wr.actionNeeded.some((x: string) => /^URGENT: No PO number/.test(x)), 'next step and urgent items are labelled as such')

const gj = json(await call('office', 'get_job', { job: 'MH21180' }))
ok(gj.id === 'j1' && gj.notesAndDecisions[0].pinned === true && gj.notesAndDecisions.some((x: any) => x.category === 'Commercial'), 'get_job by contract ref: pinned note first, commercial notes for the office')
ok(gj.documents[0].name === 'RAMS.pdf' && gj.counts.siteCaptures === 2, 'documents and capture counts')
const amb = await call('office', 'get_job', { job: 'windsor' })
ok(amb.isError === true && /matches 2 jobs/.test(amb.content[0].text), 'ambiguous job: an error that lists both, so Claude asks')

const sc = json(await call('office', 'get_scope', { job: 'j1', show: 'to_do' }))
ok(sc.lines.length === 1 && sc.lines[0].id === 's3' && sc.lines[0].value === money(30 * 5.62) && sc.lines[0].status === 'to do', 'get_scope: to-do filter, values from the app')
const vs = json(await call('office', 'get_valuations', { job: 'j1' }))
ok(vs.valuations[1].ref === 'VAL II' && vs.valuations[1].checksBeforeIssue.some((c: string) => /No PO number/.test(c)) && /person/.test(vs.valuations[1].note), 'get_valuations: open VAL II with the QS checks, issuing left to a person')
ok(vs.valuations[0].ref === 'VAL I' && /overdue|late|days/i.test(vs.valuations[0].position), 'issued VAL I: where payment stands')

// operatives: no money, anywhere
const opv = json(await call('op', 'mastor_overview', {}))
ok(!('money' in opv) && !opv.jobs[0].figures && opv.jobs[0].actionNeeded.every((x: string) => !/PO|VAL|£/.test(x)), 'operative overview: no money, only site actions')
const opScope = json(await call('op', 'get_scope', { job: 'j1' }))
ok(opScope.lines.every((l: any) => !('rate' in l) && !('value' in l)) && !('totalsAtBaseRates' in opScope), 'operative scope: no rates or values')
const opVals = await call('op', 'get_valuations', { job: 'j1' })
ok(opVals.isError === true && /operative/.test(opVals.content[0].text), 'operative valuations: refused, in plain words')
const opJob = json(await call('op', 'get_job', { job: 'j1' }))
ok(opJob.notesAndDecisions.every((x: any) => x.category !== 'Commercial') && !('figures' in opJob), 'operative job: commercial notes and figures left out')

// site diary and media
const dy = json(await call('office', 'get_site_diary', { job: 'j1' }))
ok(dy.days[0].weather === 'Dry, 12°C' && dy.days[0].labourOnSite === 3 && dy.days[0].captures.length === 2, 'diary: weather, labour and the day’s captures')
ok(/not read yet/.test(dy.days[0].captures.find((c: any) => c.type === 'voice').transcript), 'an unread voice note says so')
let media = await call('office', 'view_site_media', { job: 'j1', entry_ids: ['d-photo', 'd-voice', 'nope'] })
const img = media.content.find((c: any) => c.type === 'image')
ok(img && img.mimeType === 'image/jpeg' && Buffer.from(img.data, 'base64')[0] === 0xff, 'a photo comes back as an image to look at')
ok(media.content.some((c: any) => /What was said: Number four masonry paint is finished\./.test(c.text ?? '')), 'a voice note is transcribed')
ok(hits.filter(h => h === 'use_ai').length === 1 && patched?.data?.transcript === 'Number four masonry paint is finished.', 'counted as one AI read, and the transcript kept on the diary entry')
ok(media.content.some((c: any) => /nope: no photo/.test(c.text ?? '')), 'an unknown id is said plainly')
media = await call('office', 'view_site_media', { job: 'j1', entry_ids: ['d-voice'] })
ok(hits.filter(h => h === 'gemini').length === 1 && /What was said/.test(media.content[0].text), 'second look: the kept transcript, no new read')

srv.close(); meta.close()

// the bundle Vercel runs is the current build of server/mcp
const { options } = await import('../scripts/build-mcp.mjs')
const fresh = await build({ ...options, write: false, outfile: 'api/mcp.js', logLevel: 'silent' })
ok(fresh.outputFiles[0].text === readFileSync('api/mcp.js', 'utf8'), 'api/mcp.js is up to date (run npm run build:mcp after changing server/mcp or the src/lib it uses)')

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
