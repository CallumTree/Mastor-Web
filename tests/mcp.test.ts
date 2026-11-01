/**
 * Mastor as a Claude connector: the real server over HTTP, against a fake Supabase holding one job.
 * It must refuse without a sign-in (pointing Claude at where to sign in), speak MCP, report the app's own
 * figures and alerts, keep money from operatives, hand photos over as images, transcribe a voice note
 * once, make changes only under the app's own rules (marked “by Claude”, never issuing anything) — and
 * api/mcp.js must be the current build of server/mcp.
 */
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation } from '../src/lib/types'
import { jobAlerts } from '../src/lib/alerts'
import { pennies, upliftAmounts, valTotals } from '../src/lib/valuation'
import { money } from '../src/lib/format'
import { invoiceAmounts } from '../src/lib/invoice'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

process.env.GEMINI_API_KEY = 'gk'
const SB = 'https://susecnvepvwmqhziferf.supabase.co'

// ---------- the fake company: one job, two properties, VAL I issued, VAL II open, a VO, a day on site ----------
const job: Job = { id: 'j1', name: 'Windsor Road WHQS', client: 'PCC', address: 'Windsor Road, Pembroke', contractRef: 'MH21180', poNumber: '', contractValue: 0, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
const other: Job = { ...job, id: 'j2', name: 'Windsor Court', contractRef: 'MH9', createdAt: 2 }
const S = (id: string, property: string, qty: number | null, rate: number | null, valuationId: string | null): ScopeItem =>
  ({ id, jobId: 'j1', code: '4360BD', description: `Masonry paint ${id}`, room: 'Walls', qty, unit: 'SM', rate, valuationId, order: 1, property, workstream: 'Paint', createdAt: 1 })
const scope = [S('s1', '3', 10, 5.62, 'va'), S('s2', '4', 20, 5.62, 'vb'), S('s3', '4', 30, 5.62, null), { ...S('t1', '', 5, 10, null), jobId: 'j2' }]
const vals: Valuation[] = [{ id: 'va', jobId: 'j1', number: 1, status: 'Issued', createdAt: 1, issuedAt: Date.now() - 40 * 864e5 } as Valuation, { id: 'vb', jobId: 'j1', number: 2, status: 'Open', createdAt: 2, issuedAt: null }]
const vos: Variation[] = [{ id: 'vo1', jobId: 'j1', number: 1, description: 'Renew rotten joists under bath', room: 'No. 4 bathroom', qty: 2, unit: 'LM', rate: null, code: '', reason: 'Found when bath removed', clientRef: '', status: 'Identified', photoIds: [], dateRaised: Date.now(), valuationId: null },
  { id: 'vo2', jobId: 'j1', number: 2, description: 'Extra skirting', room: 'No. 3', qty: 3, unit: 'LM', rate: 10, code: 'SK1', reason: '', clientRef: 'PCC-1', status: 'Instructed', photoIds: [], dateRaised: 1, valuationId: 'va' }]
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())   // the diary's day is the UK day
const E = (id: string, type: DiaryEntry['type'], extra: Partial<DiaryEntry> = {}): DiaryEntry =>
  ({ id, jobId: 'j1', date: today, type, note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: 1, ...extra })
let diary: DiaryEntry[] = [
  E('d-day', 'day', { weather: 'Dry, 12°C', labour: 3, note: 'Scaffold up at No. 4' }),
  E('d-photo', 'photo', { mediaId: 'm-photo', note: 'Rot under bath', room: 'Bathroom' }),
  E('d-voice', 'voice', { mediaId: 'm-voice' }),
  E('d-note', 'note', { note: 'Dylan agreed the airing cupboard partition', category: 'Client', pinned: true }),
  E('d-money', 'note', { note: 'Agreed day rate £280', category: 'Commercial' }),
]
const JOBS = [job, other]
const TABLES: Record<string, () => { id: string; jobId?: string; data?: unknown }[]> = {
  jobs: () => JOBS, scope_items: () => scope, valuations: () => vals, variations: () => vos, diary_entries: () => diary,
  work_orders: () => [], job_documents: () => DOCS,
  costs: () => [], company_settings: () => [],
}

// documents as filed: a typed PO (two pages), a scan with no text layer, a spreadsheet and a photo — all made up here
const poPdf = (() => { const d = new jsPDF(); d.text('PURCHASE ORDER', 20, 20); d.text('Order Number: PC10001', 120, 30); d.text('Contractor Uplift 30%:', 20, 60); d.text('»1,000.00', 120, 60)
  d.addPage(); d.text('Deliver to: Unit 1, Example Park', 20, 20); return Buffer.from(d.output('arraybuffer')) })()
const scanPdf = (() => { const d = new jsPDF(); d.addImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'PNG', 10, 10, 100, 100); return Buffer.from(d.output('arraybuffer')) })()
const sheet = (() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Task', 'Start'], ['Scaffold up', '03/11/2026']]), 'Programme'); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })) })()
const FILES: Record<string, { body: Buffer; type: string }> = {
  'f-po': { body: poPdf, type: 'application/pdf' }, 'f-scan': { body: scanPdf, type: 'application/pdf' },
  'f-xlsx': { body: sheet, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, 'f-pic': { body: Buffer.from([0x89, 0x50, 0x4e, 0x47]), type: 'image/png' },
}
const D = (id: string, name: string, kind: string, fileId: string, type: string) => ({ id, jobId: 'j1', name, kind, fileId, type, size: 1, addedAt: 1 })
const DOCS = [D('doc1', 'RAMS', 'RAMS', 'f-missing', 'application/pdf'), D('doc-po', 'Order PC10001', 'Purchase order', 'f-po', 'application/pdf'),
  D('doc-scan', 'Signed instruction', 'Other', 'f-scan', 'application/pdf'), D('doc-prog', 'Programme', 'Programme', 'f-xlsx', FILES['f-xlsx'].type), D('doc-pic', 'Drawing photo', 'Drawing', 'f-pic', 'image/png')]

// a schedule of rates the app has synced: the same codes the scope uses, so it's this job's book
const BOOK = [
  { code: '4360BD', short: 'MASONRY PAINT: TWO COATS', long: '', unit: 'SM', rate: 5.62, section: 'PAINTING', subsection: 'External' },
  { code: 'WR100', short: 'WET ROOM: FORM LEVEL ACCESS SHOWER', long: 'Tanking, floor former, linear drain and non-slip vinyl', unit: 'IT', rate: 1500, section: 'BATHROOMS', subsection: 'Wet rooms' },
  { code: 'LIN12', short: 'LINTEL: RENEW CONCRETE, N.E. 1.2M', long: '', unit: 'NO', rate: 85.4, section: 'MASONRY', subsection: 'Lintels' },
  { code: 'WC01', short: 'WC: RENEW CLOSE COUPLED SUITE', long: '', unit: 'NO', rate: 310, section: 'BATHROOMS', subsection: 'Sanitaryware' },
]

// ---------- fake Supabase + Gemini (everything else goes to the real network: the test's own server) ----------
const realFetch = globalThis.fetch
const hits: string[] = []
let patched: any = null
const upserts: { table: string; rows: any[] }[] = []
let copied: any = null
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input instanceof Request ? input.url : input)
  const token = String(init.headers?.authorization ?? '').replace('Bearer ', '')
  if (url.startsWith(SB + '/auth/v1/user')) {
    const user = token === 'office' ? { id: 'u1', email: 'callum@treeandsons.co.uk' } : token === 'op' ? { id: 'u2', email: 'dai@treeandsons.co.uk' } : null
    return user ? new Response(JSON.stringify(user)) : new Response('{"msg":"bad jwt"}', { status: 401 })
  }
  if (url.startsWith(SB + '/rest/v1/memberships')) return new Response(JSON.stringify([{ company_id: 'c1', role: url.includes('u2') ? 'operative' : 'director', companies: { name: 'Tree & Sons' } }]))
  if (url.startsWith(SB + '/rest/v1/rpc/use_ai')) { hits.push('use_ai'); return new Response('1') }
  if (url.startsWith(SB + '/rest/v1/') && init.method === 'POST' && url.includes('on_conflict=id')) {   // a save: upsert into the fake tables
    const table = url.slice((SB + '/rest/v1/').length).split('?')[0], rows = JSON.parse(init.body), store = TABLES[table]() as any[]
    upserts.push({ table, rows })
    for (const r of rows) { const i = store.findIndex(x => x.id === r.id); if (i >= 0) store[i] = r.data; else store.push(r.data) }
    return new Response(null, { status: 201 })
  }
  if (url === SB + '/storage/v1/object/copy') { copied = JSON.parse(init.body); return new Response('{}') }
  if (url.startsWith(SB + '/rest/v1/') && init.method === 'PATCH') { patched = JSON.parse(init.body); diary = diary.map(e => (e.id === patched.data.id ? patched.data : e)); return new Response(null, { status: 204 }) }
  if (url.startsWith(SB + '/rest/v1/')) {
    const table = url.slice((SB + '/rest/v1/').length).split('?')[0]
    const jobId = /job_id=eq\.([^&]+)/.exec(url)?.[1]
    const rows = (TABLES[table]?.() ?? []).filter(r => !jobId || (r as any).jobId === decodeURIComponent(jobId))
    return new Response(JSON.stringify(rows.map(data => ({ data }))))
  }
  if (url.startsWith(SB + '/storage/v1/object/photos/c1/rates/b1.json')) return new Response(JSON.stringify(BOOK))
  const file = /\/storage\/v1\/object\/photos\/c1\/([^/?]+)\.jpg/.exec(url)?.[1]
  if (file && FILES[file]) return new Response(new Uint8Array(FILES[file].body), { headers: { 'content-type': FILES[file].type } })
  if (file?.startsWith('f-')) return new Response('{"error":"not_found"}', { status: 400 })
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
const READS = ['mastor_overview', 'get_job', 'get_scope', 'get_variations', 'get_valuations', 'get_site_diary', 'view_site_media', 'invoice_figures', 'find_rate', 'read_document']
const WRITES = ['add_to_valuation', 'remove_from_valuation', 'log_variation', 'update_variation', 'add_note', 'update_site_day', 'update_job', 'add_to_plan', 'tick_off']
ok(tools.length === READS.length + WRITES.length && [...READS, ...WRITES].every(n => tools.some(t => t.name === n)), 'nineteen tools: ten that read, nine that change')
ok(tools.every(t => t.annotations?.readOnlyHint === READS.includes(t.name)), 'only the read tools say they’re read-only, so Claude asks before every change')
ok(!tools.some(t => /issue_|create_invoice|delete/.test(t.name)), 'no tool issues a valuation, creates an invoice or deletes anything')

// the app's own figures and alerts
const ov = json(await call('office', 'mastor_overview', {}))
const wr = ov.jobs.find((j: any) => j.id === 'j1')
ok(ov.money.readyToClaim === money(valTotals(job, 'vb', scope, vos).gross), 'overview: ready to claim = the open valuation’s value')
const alerts = jobAlerts(job, scope, vos, vals, []).alerts
ok(wr.actionNeeded.length === alerts.length && alerts.every(a => wr.actionNeeded.some((x: string) => x.includes(a.text))), 'overview: the same “action needed” as the job’s home screen')
// (the open valuation is only a next step in its valuation week, so which alerts there are depends on the date)
ok(alerts.filter(a => a.kind === 'do').every(a => wr.actionNeeded.some((x: string) => x.startsWith(`NEXT: ${a.text}`))) && wr.actionNeeded.some((x: string) => /^URGENT: No PO number/.test(x)), 'next step and urgent items are labelled as such')

const gj = json(await call('office', 'get_job', { job: 'MH21180' }))
ok(gj.id === 'j1' && gj.notesAndDecisions[0].pinned === true && gj.notesAndDecisions.some((x: any) => x.category === 'Commercial'), 'get_job by contract ref: pinned note first, commercial notes for the office')
ok(gj.documents.some((x: any) => x.name === 'RAMS' && x.id === 'doc1') && gj.documents.some((x: any) => x.kind === 'Purchase order') && gj.counts.siteCaptures === 2, 'documents (with ids, the PO among them) and capture counts')
const amb = await call('office', 'get_job', { job: 'windsor' })
ok(amb.isError === true && /matches 2 jobs/.test(amb.content[0].text), 'ambiguous job: an error that lists both, so Claude asks')

const sc = json(await call('office', 'get_scope', { job: 'j1', show: 'to_do' }))
ok(sc.lines.length === 1 && sc.lines[0].id === 's3' && sc.lines[0].value === money(30 * 5.62) && sc.lines[0].status === 'to do', 'get_scope: to-do filter, values from the app')
const no4 = json(await call('office', 'get_scope', { job: 'j1', property: '4' }))
const b4 = pennies(20 * 5.62 + 30 * 5.62)
ok(no4.totalsOfTheseLines.lines === 2 && no4.totalsOfTheseLines.scope === money(b4) && no4.totalsOfTheseLines.claimed === money(20 * 5.62) && no4.totalsOfTheseLines.stillToDo === money(30 * 5.62)
  && no4.totalsOfTheseLines.inclUplifts === money(upliftAmounts(b4, 10, 0).gross) && no4.jobTotals.lines === 3, 'get_scope: Mastor totals the lines asked for (No. 4), with uplifts, beside the job’s')
ok(!('totalsOfTheseLines' in json(await call('office', 'get_scope', { job: 'j1' }))), 'unfiltered: just the job’s totals')
const vs = json(await call('office', 'get_valuations', { job: 'j1' }))
ok(vs.valuations[1].ref === 'VAL II' && vs.valuations[1].checksBeforeIssue.some((c: string) => /No PO number/.test(c)) && /person/.test(vs.valuations[1].note), 'get_valuations: open VAL II with the QS checks, issuing left to a person')
ok(/^VAL I on /.test(vs.valuationWeek.lastSent) && /^VAL II goes in 1–7 /.test(vs.valuationWeek.next) && /first week of each month/.test(vs.valuationWeek.rule) && /before the review step/.test(vs.valuations[0].review),
  'get_valuations: when the last one went, when the next goes in, and where each is with the client')
ok(vs.valuations[0].ref === 'VAL I' && /overdue|late|days/i.test(vs.valuations[0].position), 'issued VAL I: where payment stands')

// operatives: no money, anywhere
const opv = json(await call('op', 'mastor_overview', {}))
ok(!('money' in opv) && !opv.jobs[0].figures && opv.jobs[0].actionNeeded.every((x: string) => !/PO|VAL|£/.test(x)), 'operative overview: no money, only site actions')
const opScope = json(await call('op', 'get_scope', { job: 'j1' }))
ok(opScope.lines.every((l: any) => !('rate' in l) && !('value' in l)) && !('jobTotals' in opScope) && !('totalsOfTheseLines' in opScope), 'operative scope: no rates or values')
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

// ---------- changes: the app's rules, marked “by Claude”, nothing issued ----------
const saved = (table: string, id: string) => upserts.filter(u => u.table === table).flatMap(u => u.rows).filter(r => r.id === id).at(-1)
const err = (res: any) => (res.isError ? res.content[0].text as string : '')
ok(/operative/.test(err(await call('op', 'add_to_valuation', { job: 'j1', scope_line_ids: ['s3'] }))), 'operative: can’t tick lines into a valuation')

let w = json(await call('office', 'add_to_valuation', { job: 'j1', scope_line_ids: ['s3', 's1', 's2', 'nope'], vos: ['VO I', 'VO IX'] }))
ok(w.valuation === 'VAL II' && w.added.length === 1 && w.added[0].includes(money(30 * 5.62)) && w.addedAtBaseRates === money(30 * 5.62), 'add_to_valuation: the priced to-do line goes into the open VAL II, valued by Mastor')
ok(w.notAdded.some((x: string) => /certified in VAL I, so it’s locked/.test(x)) && w.notAdded.some((x: string) => /already in the open valuation/.test(x)) && w.notAdded.some((x: string) => /^nope: no scope line/.test(x))
  && w.notAdded.some((x: string) => /^VO I: not priced yet/.test(x)) && w.notAdded.some((x: string) => /^VO IX: no such VO/.test(x)), 'locked, already-claimed, unknown and unpriced lines are left, each with its reason')
const s3 = saved('scope_items', 's3')
ok(s3 && s3.company_id === 'c1' && s3.job_id === 'j1' && s3.deleted === false && s3.data.valuationId === 'vb' && typeof s3.data.byClaude === 'number', 'saved as the person, into VAL II, marked by Claude')
ok(w.openValuationNow.ref === 'VAL II' && w.openValuationNow.checksBeforeIssue.some((c: string) => /Claude added 1 line/.test(c)) && /Nothing has been sent/.test(w.note), 'the open valuation now, with “check Claude’s lines” among the checks — and not sent')
ok(saved('scope_items', 's1') === undefined && saved('scope_items', 's2') === undefined, 'nothing else touched')

w = json(await call('office', 'add_to_valuation', { job: 'j2', scope_line_ids: ['t1'] }))
const started = upserts.find(u => u.table === 'valuations')?.rows[0]
ok(/^VAL I \(started now/.test(w.valuation) && started?.data.number === 1 && started.data.status === 'Open' && started.job_id === 'j2' && saved('scope_items', 't1').data.valuationId === started.data.id, 'no valuation open: it starts the next one (open, never issued)')

ok(/operative/.test(err(await call('op', 'update_variation', { job: 'j1', vo: 'VO I', rate: 40 }))), 'operative: can’t price a VO')
w = json(await call('office', 'update_variation', { job: 'j1', vo: 'I', rate: 45.5, code: 'JST1', client_ref: 'PCC-7', status: 'Instructed', sent_to_client: true }))
ok(w.changed.includes('rate: unpriced → £45.50') && w.changed.includes('status: Identified → Instructed') && w.value === `${money(91)} base` && saved('variations', 'vo1').data.byClaude, 'update_variation: priced and instructed, changes listed, value from Mastor')
ok(/locked/.test(err(await call('office', 'update_variation', { job: 'j1', vo: 'VO II', qty: 4 }))), 'a VO certified in an issued valuation is locked')
ok(/No VO IX/.test(err(await call('office', 'update_variation', { job: 'j1', vo: 'VO IX', qty: 4 }))), 'an unknown VO is said plainly')
w = json(await call('office', 'add_to_valuation', { job: 'j1', vos: ['vo1'] }))
ok(w.added[0].startsWith('VO I Renew rotten joists') && vos[0].valuationId === 'vb', 'the priced VO can now be ticked in')
ok(/Take it out first/.test(err(await call('office', 'update_variation', { job: 'j1', vo: 'VO I', status: 'Rejected' }))) && /Take it out first/.test(err(await call('office', 'update_variation', { job: 'j1', vo: 'VO I', rate: null }))), 'a claimed VO can’t be rejected or unpriced while it’s in the valuation')
w = json(await call('office', 'remove_from_valuation', { job: 'j1', vos: ['VO I'], scope_line_ids: ['s1'] }))
ok(w.removed.length === 1 && vos[0].valuationId === null && w.notRemoved.some((x: string) => /locked/.test(x)), 'remove_from_valuation: back to live; issued lines stay put')

w = json(await call('office', 'log_variation', { job: 'j1', description: 'Replace cracked lintel over back door', where: 'No. 4 rear', reason: 'Found when render came off', qty: 1, unit: 'NO', evidence_entry_id: 'd-photo' }))
const vo3 = vos.find(v => v.number === 3)
ok(w.logged === 'VO III Replace cracked lintel over back door' && vo3?.status === 'Identified' && vo3.rate === null && /unpriced/.test(w.value) && vo3.byClaude, 'log_variation: next number, Identified, no rate made up')
ok(copied?.sourceKey === 'c1/m-photo.jpg' && vo3?.photoIds.length === 1 && copied.destinationKey === `c1/${vo3.photoIds[0]}.jpg` && diary.find(e => e.id === 'd-photo')?.voId === vo3.id, 'the site photo is copied to the VO as its own evidence, and the capture shows it raised the VO')
ok(/already the evidence for VO III/.test(err(await call('office', 'log_variation', { job: 'j1', description: 'Lintel again', evidence_entry_id: 'd-photo' }))), 'one capture can’t raise two VOs')
ok(/operative/.test(err(await call('op', 'log_variation', { job: 'j1', description: 'Extra socket', rate: 30 }))), 'operative: can log a VO but not with a rate')
w = json(await call('op', 'log_variation', { job: 'j1', description: 'Extra socket in bedroom 2', qty: 1, unit: 'NO' }))
ok(w.logged === 'VO IV Extra socket in bedroom 2' && !('value' in w), 'operative logs it unpriced, sees no money')
ok(/unit/.test(err(await call('office', 'log_variation', { job: 'j1', description: 'Extra paint', qty: 3 }))), 'a quantity needs its unit')

w = json(await call('office', 'add_note', { job: 'j1', text: 'Dylan agreed skip on the drive', category: 'Client', pinned: true }))
const note = diary.find(e => e.note === 'Dylan agreed skip on the drive')
ok(note?.type === 'note' && note.category === 'Client' && note.pinned === true && note.byClaude && w.added.category === 'Client', 'add_note: a pinned client note, marked by Claude')
ok(/operative/.test(err(await call('op', 'add_note', { job: 'j1', text: 'Day rate agreed', category: 'Commercial' }))), 'operative: no commercial notes')

w = json(await call('office', 'update_site_day', { job: 'j1', labour: 4, note: 'Skips swapped' }))
const dayRows = diary.filter(e => e.type === 'day' && e.date === w.date)
ok(w.labourOnSite === 4 && w.note === 'Scaffold up at No. 4\nSkips swapped' && w.weather === 'Dry, 12°C' && dayRows.length === 1 && dayRows[0].byClaude, 'update_site_day: the day’s own record updated (no second one), labour set, note added to, weather kept')
ok(/hasn’t happened yet/.test(err(await call('office', 'update_site_day', { job: 'j1', date: '2999-01-01', labour: 2 }))), 'no filling in days ahead')

const inv = json(await call('office', 'invoice_figures', { job: 'j1' }))
const valI = invoiceAmounts(job, vals[0], scope, vos, 20)
ok(inv.valuations[0].ref === 'VAL I' && inv.valuations[0].wouldBe.total === money(valI.total) && inv.valuations[0].wouldBe.net === money(valI.net), 'invoice_figures: what VAL I’s invoice would be, from the app’s invoice sums')
ok(/can’t be invoiced until a person issues it/.test(inv.valuations[1].invoice) && inv.missingForAVatInvoice.includes('company details') && /in the Mastor app/.test(inv.note), 'the open one can’t be invoiced; missing details named; creating it stays in the app')
ok(/operative/.test(err(await call('op', 'invoice_figures', { job: 'j1' }))), 'operative: no invoice figures')

const allRows = upserts.flatMap(u => u.rows.map(r => ({ table: u.table, ...r })))
ok(allRows.filter(r => r.table === 'valuations').every(r => r.data.status === 'Open' && !r.data.issuedAt && !r.data.invoiceNumber) && vals.every(v => !v.invoiceNumber) && vals[1].status === 'Open',
  'after all that: nothing issued, no invoice created')
ok(allRows.every(r => r.table === 'valuations' || r.data.byClaude || r.table === 'diary_entries'), 'every change Claude made carries the “by Claude” mark')

// finding a rate: the schedule and past work, never a guess
TABLES.company_settings = () => [{ id: 'company', rateBooks: [{ id: 'b1', name: 'Planned Maint v8', source: 'sor.docx', notes: [], lines: 4, importedAt: 1 }] } as any]
vos.push({ id: 'vo-wr', jobId: 'j2', number: 1, description: 'Form wet room: tanking, former and drain', room: 'No. 12 bathroom', qty: 1, unit: 'IT', rate: 1450, code: 'WR100', reason: '', clientRef: '', status: 'Instructed', photoIds: [], dateRaised: 5, valuationId: null })
const fr = json(await call('office', 'find_rate', { job: 'j1', what: 'wet room at No. 18' }))
const top = fr.matches[0]
ok(fr.schedule === 'Planned Maint v8' && top.code === 'WR100' && top.suggestedRate === 1500 && top.rateFrom === 'Planned Maint v8' && /£1,?500\.00 per IT in Planned Maint v8/.test(top.schedule),
  'find_rate: a wet room finds the schedule’s wet room code, from the job’s own book')
ok(/Windsor Court · VO I/.test(top.usedBefore[0]) && /£1,?450\.00/.test(top.usedBefore[0]) && /used at £1,?450\.00, the schedule says £1,?500\.00/.test(top.rateCheck), 'it shows where it was used before, and flags that it was priced differently there')
ok(!fr.matches.some((x: any) => x.code === 'WC01'), 'a WC isn’t a wet room: no loose matches')
const past = json(await call('office', 'find_rate', { job: 'j2', what: 'skirting' }))
ok(past.matches[0].code === 'SK1' && /not in any rate book/.test(past.matches[0].schedule) && past.matches[0].rateFrom === 'Windsor Road WHQS · VO II · No. 3' && past.matches[0].suggestedRate === 10,
  'work no schedule covers: the rate a VO was already priced at, and where')
const byCode = json(await call('office', 'find_rate', { job: 'j1', code: 'lin12' }))
ok(byCode.matches[0].code === 'LIN12' && byCode.matches[0].usedBefore === 'not used on a job yet', 'find_rate by code')
const none = json(await call('office', 'find_rate', { job: 'j1', what: 'asbestos survey' }))
ok(typeof none.matches === 'string' && /nothing fits/.test(none.matches), 'nothing fits: it says so rather than offering the nearest thing')
ok(/operative/.test(err(await call('op', 'find_rate', { job: 'j1', what: 'wet room' }))), 'operative: no rates')
w = json(await call('office', 'log_variation', { job: 'j1', description: 'Form wet room', where: 'No. 18 bathroom', qty: 1, unit: 'IT', rate: top.suggestedRate, code: top.code, rate_from: top.rateFrom }))
const wet = vos.find(v => v.description === 'Form wet room' && v.jobId === 'j1')
ok(wet?.code === 'WR100' && wet.rate === 1500 && wet.rateBook === 'Planned Maint v8' && /£1,?500\.00 base/.test(w.value), 'log_variation keeps where the rate came from, for the VO screen to show')
ok(/operative/.test(err(await call('op', 'log_variation', { job: 'j1', description: 'Wet room', rate_from: 'Planned Maint v8' }))), 'operative: no rate source either')

// the job's documents: read as filed, the source of truth
const po = await call('office', 'read_document', { job: 'j1', document: 'purchase order' })
const poText = po.content[0].text as string
ok(/Order PC10001 \(Purchase order\)/.test(poText) && /— page 1 —/.test(poText) && /— page 2 —/.test(poText) && /quote it by name and page/.test(poText), 'read_document: a PDF comes back as its text, page by page, with how to quote it')
ok(/Order Number: PC10001/.test(poText) && /Contractor Uplift 30%:\s+£1,000\.00/.test(poText), 'lines keep their reading order (a label and its figure on one line), and a council font’s » is the £ it prints')
const found = (await call('office', 'read_document', { job: 'j1', document: 'doc-po', find: 'deliver' })).content[0].text as string
ok(/pages mentioning deliver: 2/.test(found) && !/— page 1 —/.test(found) && /Unit 1, Example Park/.test(found), 'find: only the pages that mention the words')
ok(/— page 2 —/.test((await call('office', 'read_document', { job: 'j1', document: 'doc-po', pages: '2' })).content[0].text) , 'pages: just the pages asked for')
const scan = await call('office', 'read_document', { job: 'j1', document: 'Signed instruction' })
ok(/scanned PDF/.test(scan.content[0].text) && scan.content[1]?.type === 'resource' && scan.content[1].resource.mimeType === 'application/pdf' && Buffer.from(scan.content[1].resource.blob, 'base64').subarray(0, 5).toString() === '%PDF-', 'a scan with no text layer comes back as the PDF itself, to read')
ok(/sheet Programme[\s\S]*Scaffold up,03\/11\/2026/.test((await call('office', 'read_document', { job: 'j1', document: 'Programme' })).content[0].text), 'a spreadsheet comes back as its sheets')
const pic = await call('office', 'read_document', { job: 'j1', document: 'Drawing photo' })
ok(pic.content[1]?.type === 'image' && pic.content[1].mimeType === 'image/png', 'a photo of a document stays an image')
const rams = await call('office', 'read_document', { job: 'j1', document: 'RAMS' })
ok(/Not uploaded from the phone yet/.test(rams.content[0].text), 'a document still on the phone: says so')
ok(/matches 0|No document matches/.test(err(await call('office', 'read_document', { job: 'j1', document: 'asbestos survey' }))) , 'no such document: an error that lists what there is')
ok(/No document matches/.test(err(await call('op', 'read_document', { job: 'j1', document: 'purchase order' }))) && !json(await call('op', 'get_job', { job: 'j1' })).documents.some((x: any) => x.kind === 'Purchase order'),
  'operative: purchase orders are neither listed nor readable')
ok(/Signed instruction/.test((await call('op', 'read_document', { job: 'j1', document: 'Signed instruction' })).content[0].text), 'operative: other documents read as normal')

// the job's PO details, set from the order (office only), with the PO check after
const jobsBefore = TABLES.jobs().length
w = json(await call('office', 'update_job', { job: 'j1', po_number: 'PC10001', po_value: 370.92, uplift1: 10, uplift2: 0, source: 'Order PC10001, page 1' }))
const j1 = (TABLES.jobs() as any[]).find(j => j.id === 'j1')
ok(j1.poNumber === 'PC10001' && j1.contractValue === 370.92 && j1.byClaude && w.changed.some((c: string) => /poNumber: none|poNumber: not set/.test(c) || /poNumber/.test(c)) && w.from === 'Order PC10001, page 1', 'update_job: PO number and value set from the order, marked by Claude, source kept')
ok(/^reconciles: the BoQ with 10% \+ 0% comes to the PO value, £370\.92$/.test(w.poCheck), 'then the app’s own PO check: the BoQ with the uplifts comes to the PO value')
ok(TABLES.jobs().length === jobsBefore && upserts.some(u => u.table === 'jobs' && u.rows[0].job_id === 'j1'), 'saved over the job itself (its own job id), not as a new job')
w = json(await call('office', 'update_job', { job: 'j1', po_value: 400 }))
ok(/doesn’t reconcile: the BoQ with 10% \+ 0% comes to £370\.92; the PO value is £400\.00 \(under by £29\.08\)/.test(w.poCheck), 'a value that doesn’t reconcile: says by how much')
ok(/nothing, as the job already says that/.test(json(await call('office', 'update_job', { job: 'j1', po_number: 'PC10001' })).changed), 'nothing to change: says so, saves nothing')
ok(/operative/.test(err(await call('op', 'update_job', { job: 'j1', po_number: 'X1' }))), 'operative: can’t change PO details')

// the job's line: key dates and the to-dos that lead up to them
const today0 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
const plus = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(Date.now() + n * 864e5))
w = json(await call('office', 'add_to_plan', { job: 'j1', kind: 'key_date', what: 'Kitchen refit starts', date: plus(2), property: 'No. 6', trade: 'Kitchen', time: '08:00' }))
const ev = diary.find(e => e.id === w.id)!
ok(ev.type === 'event' && ev.date === plus(2) && ev.property === '6' && ev.trade === 'Kitchen' && ev.time === '08:00' && !!ev.byClaude && w.added.kind === 'key date', 'add_to_plan: a key date on its day, for No. 6 · Kitchen, marked by Claude')
w = json(await call('office', 'add_to_plan', { job: 'j1', kind: 'todo', what: 'Speak to the tenant about the start', date: plus(-1), leads_up_to: ev.id }))
const td = diary.find(e => e.id === w.id)!
ok(td.type === 'todo' && td.linkId === ev.id && /Kitchen refit starts/.test(w.added.leadsUpTo), 'a to-do that leads up to the key date: linked, and says which')
const money1 = json(await call('office', 'add_to_plan', { job: 'j1', kind: 'todo', what: 'Chase VO II reference', office_only: true }))
let plan = json(await call('office', 'get_job', { job: 'j1' })).plan
ok(plan.late.some((x: any) => x.id === td.id && x.leadsUpTo === 'Kitchen refit starts') && plan.todayAndAhead.some((x: any) => x.id === ev.id) && plan.noDate.some((x: any) => x.id === money1.id && x.office), 'get_job: the plan, late first, then today and ahead, then no date')
ok(/key date needs its day/.test(err(await call('office', 'add_to_plan', { job: 'j1', kind: 'key_date', what: 'Skip swap' }))), 'a key date without a day: refused')
ok(/operative/.test(err(await call('op', 'add_to_plan', { job: 'j1', kind: 'todo', what: 'Chase the money', office_only: true }))), 'operative: can’t add office-only items')
const opPlan = json(await call('op', 'get_job', { job: 'j1' })).plan
ok(!opPlan.noDate.some((x: any) => x.id === money1.id) && opPlan.late.some((x: any) => x.id === td.id), 'operative: office-only items hidden, the rest shown')
ok(/No to-do with id/.test(err(await call('op', 'tick_off', { job: 'j1', todo: money1.id }))), 'operative: can’t tick off an office-only to-do')
w = json(await call('op', 'tick_off', { job: 'j1', todo: td.id }))
ok(w.now === 'done' && diary.find(e => e.id === td.id)!.doneAt, 'tick_off: an operative ticks a site to-do off')
plan = json(await call('office', 'get_job', { job: 'j1' })).plan
ok(!plan.late.some((x: any) => x.id === td.id), 'once done it is no longer late')
ok(/already done/.test(json(await call('office', 'tick_off', { job: 'j1', todo: td.id })).changed), 'ticking it again changes nothing')
const sd = json(await call('office', 'get_site_diary', { job: 'j1', from: plus(-3), to: plus(3) }))
ok(!JSON.stringify(sd).includes('Kitchen refit starts') && !JSON.stringify(sd).includes('Speak to the tenant'), 'the site diary stays the site diary: the plan isn’t in it')
void today0

srv.close(); meta.close()

// the bundle Vercel runs is the current build of server/mcp
const { options } = await import('../scripts/build-mcp.mjs')
const fresh = await build({ ...options, write: false, outfile: 'api/mcp.js', logLevel: 'silent' })
ok(fresh.outputFiles[0].text === readFileSync('api/mcp.js', 'utf8'), 'api/mcp.js is up to date (run npm run build:mcp after changing server/mcp or the src/lib it uses)')

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
