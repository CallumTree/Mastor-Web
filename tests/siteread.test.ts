/** Site capture → scope: WAV voice notes, the read endpoint (storage → Gemini → Claude), and checking every suggestion. */
import 'fake-indexeddb/auto'
import read from '../api/read-site.js'
import { encodeWav } from '../src/lib/voice'
import { buildRequest, verifySuggestions, voFromSuggestion, unread, openSuggestions, decide, dueToRead, collectSite, STALE_MS, type PendingRead } from '../src/lib/siteRead'
import type { DiaryEntry, ScopeItem } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// ---- voice notes become a small WAV every transcriber reads
const wav = encodeWav(new Float32Array(16000).fill(0.5))
const head = new Uint8Array(await wav.arrayBuffer())
ok(wav.type === 'audio/wav' && wav.size === 44 + 32000, 'one second at 16 kHz mono = 32KB of 16-bit samples')
ok(String.fromCharCode(...head.slice(0, 4)) === 'RIFF' && String.fromCharCode(...head.slice(8, 12)) === 'WAVE' && new DataView(head.buffer).getUint32(24, true) === 16000, 'RIFF/WAVE header at 16 kHz')

// ---- what goes out, and what comes back is checked
const D = (id: string, type: DiaryEntry['type'], extra: Partial<DiaryEntry> = {}): DiaryEntry => ({ id, jobId: 'j', date: '2026-10-17', type, note: '', labour: null, weather: '', mediaId: type === 'note' || type === 'day' ? null : 'm-' + id, originalMediaId: null, room: '', voId: null, createdAt: 1, ...extra })
const S = (id: string, property: string, code: string, valuationId: string | null = null): ScopeItem => ({ id, jobId: 'j', code, description: code + ' work', room: 'Front', qty: 93, unit: 'SM', rate: 5.62, valuationId, order: 1, property, workstream: 'PPR Paint', createdAt: 1 })
const diary = [D('p1', 'photo'), D('v1', 'voice'), D('d1', 'day', { note: 'Scaffold struck at number 3, all clear' }), D('old', 'photo', { read: { at: 1, suggestions: [] } }), D('n0', 'day', { note: 'ok' }),
  D('f1', 'note', { note: 'Dylan agreed the partition can be claimed', category: 'Commercial' })]
const items = unread(diary, '2026-10-17')
ok(items.map(e => e.id).join() === 'p1,v1,d1', 'unread: new photo, voice note and the day’s own note; already-read, one-word and filed notes skipped')
const scope = [S('s1', '4', '4360BD'), S('s2', '4', '4350AA'), S('s3', '3', '4360BD', 'val1')]
const { req, itemKey, lineKey } = buildRequest('c1', items, scope, [])
ok(req.items.map(i => `${i.key}:${i.kind}:${i.mediaId ?? '-'}`).join() === 'M1:photo:m-p1,M2:voice:m-v1,M3:day:-', 'captures sent as short keys with their stored media')
ok(req.lines[0].key === 'L1' && req.lines[0].text === 'No. 4 · Front · PPR Paint · 4360BD 4360BD work · 93 SM' && req.lines[2].claimed, 'scope lines keyed, claimed ones marked')
const found = verifySuggestions([
  { item: 'M2', kind: 'complete', lines: ['L1', 'L3', 'L99'], text: 'No. 4 masonry paint done', property: '4', quote: 'number four front is painted', basis: 'said' },
  { item: 'M2', kind: 'vo', lines: [], text: 'Rotten joists under bath', property: '4', room: 'Bathroom', qty: 2, unit: 'LM', quote: 'rotten joists under the bath', basis: 'said' },
  { item: 'M2', kind: 'note', lines: [], text: 'Invented', quote: 'tenant refused access', basis: 'said' },
  { item: 'M1', kind: 'complete', lines: ['L2'], text: 'Gutters cleaned', quote: '', basis: 'seen' },
  { item: 'M1', kind: 'complete', lines: ['L3'], text: 'Already claimed line', quote: '', basis: 'seen' },
  { item: 'M9', kind: 'note', lines: [], text: 'No such capture', quote: '', basis: 'seen' },
  { item: 'M3', kind: 'vo', lines: [], text: '', quote: '', basis: 'said' },
], { M2: 'Number four front is painted. Found rotten joists under the bath, about two metres.' }, itemKey, lineKey)
const v = found.get('v1')!
ok(v[0].kind === 'complete' && v[0].lineIds.join() === 's1' && v[0].verified, 'complete: only real, unclaimed lines in the house named; quote found in the transcript')
ok(v[1].kind === 'vo' && v[1].qty === 2 && v[1].verified, 'extra work: measurement as said, quote found')
ok(v.length === 2, 'a quote that wasn’t said is dropped, not just marked')
ok(!found.has('p1'), '“done” from a photo alone is dropped: a photo can’t show a line is finished, or which house')
ok(!found.has('d1') && [...found.values()].flat().length === 2, 'unknown captures and empty suggestions are dropped')
// a scheme of several houses: "done" must name the house, and only that house's lines count
const many = verifySuggestions([
  { item: 'M2', kind: 'complete', lines: ['L1', 'L2'], text: 'Painted', property: '', quote: 'number four front is painted', basis: 'said' },
  { item: 'M2', kind: 'complete', lines: ['L1', 'L4'], text: 'No. 4 painted', property: 'No. 4', quote: 'number four front is painted', basis: 'said' },
  { item: 'M1', kind: 'vo', lines: [], text: 'Cracked lintel over the back door', property: '4', quote: '', basis: 'seen' },
], { M2: 'Number four front is painted.' }, itemKey, new Map([...lineKey, ['L4', S('s4', '5', '4360BD')]]))
const m = many.get('v1') ?? []
ok(m.length === 1 && m[0].lineIds.join() === 's1', 'several houses: a "done" with no house is dropped; one naming No. 4 keeps only No. 4’s lines')
ok(many.get('p1')?.[0].kind === 'vo' && many.get('p1')?.[0].basis === 'seen', 'extra work spotted in a photo is kept, marked for a look')
const vo = voFromSuggestion(v[1], diary[1], 'j', 7)
ok(vo.number === 7 && vo.status === 'Identified' && vo.rate === null && vo.qty === 2 && vo.property === '4' && vo.room === 'Bathroom' && vo.reason === 'From site 2026-10-17: “rotten joists under the bath”', 'approved extra work → Identified VO at its house, unpriced, with the words that raised it')
const withRead = { ...diary[1], read: { at: 1, suggestions: v } }
ok(openSuggestions([withRead]).length === 2 && openSuggestions([decide(withRead, v[0].id, 'approved')]).length === 1, 'review list: open suggestions only')

// ---- when a day is read on its own: once it has gone quiet, or is over; only the last week
const T = Date.UTC(2026, 9, 17, 15), MIN = 60_000
const day = (id: string, date: string, createdAt: number, extra: Partial<DiaryEntry> = {}) => D(id, 'photo', { date, createdAt, ...extra })
const dueIds = (es: DiaryEntry[]) => dueToRead(es, '2026-10-17', T).map(d => `${d.jobId}|${d.date}|${d.items.map(i => i.id).join('+')}`).join(' ')
ok(dueIds([day('a', '2026-10-17', T - 10 * MIN)]) === '', 'a capture ten minutes ago: still on site, not yet')
ok(dueIds([day('a', '2026-10-17', T - 50 * MIN)]) === 'j|2026-10-17|a', 'nothing new for 45 minutes: read')
ok(dueIds([day('a', '2026-10-17', T - 50 * MIN), day('b', '2026-10-17', T - 5 * MIN)]) === '', 'a new capture restarts the wait')
ok(dueIds([day('y', '2026-10-16', T - 30 * MIN)]) === 'j|2026-10-16|y', 'yesterday is over: read')
ok(dueIds([day('o', '2026-10-05', 1)]) === '', 'older than a week: left as it was')
ok(dueIds([day('r', '2026-10-16', 1, { read: { at: 1, suggestions: [] } })]) === '', 'already read: never again')
ok(dueIds([day('w', '2026-10-16', 1, { read: { at: T - 2 * 3600_000, suggestions: [], pending: 'msgbatch_x' } })]) === '', 'with the reader: not sent again')
ok(dueIds([day('w', '2026-10-16', 1, { read: { at: T - STALE_MS - MIN, suggestions: [], pending: 'msgbatch_x' } })]) === 'j|2026-10-16|w', 'with the reader for a day and a half (its answer lost): read afresh')
ok(dueIds([day('b2', '2026-10-16', 9), day('b1', '2026-10-16', 3), { ...day('x', '2026-10-15', 1), jobId: 'k' }]) === 'k|2026-10-15|x j|2026-10-16|b1+b2', 'oldest day first, captures in the order made, per job')

// ---- the endpoint
process.env.ANTHROPIC_API_KEY = 'k'
const calls: string[] = []
let claude: any = null, gemini: any = null, storageAuth = '', batchReq: any = null
let firm: any = { company: 'c1', plan: 'pilot', lane: 'normal' }
let batch: { status: string; result: any } = { status: 'in_progress', result: null }
const spent: any[] = []
const answer = { model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 20_000, output_tokens: 1_000 }, content: [{ type: 'text', text: JSON.stringify({ suggestions: [{ item: 'M2', kind: 'complete', lines: ['L1'], text: 'Done', property: '4', room: '', qty: null, unit: '', code: '', quote: 'number four front is painted', basis: 'said' }] }) }] }
const files: Record<string, { body: Uint8Array; type: string }> = { 'm-p1': { body: new Uint8Array([255, 216, 255]), type: 'image/jpeg' }, 'm-v1': { body: new Uint8Array(wav.size), type: 'audio/wav' } }
globalThis.fetch = (async (url: string, init: any) => {
  url = String(url)
  if (url.includes('/rpc/ai_check')) { calls.push('guard'); return new Response(JSON.stringify(firm), { status: 200 }) }
  if (url.includes('/rpc/ai_spend')) { spent.push(JSON.parse(init.body)); return new Response(null, { status: 204 }) }
  if (url.endsWith('/v1/messages/batches')) { calls.push('batch'); batchReq = JSON.parse(init.body); return new Response(JSON.stringify({ id: 'msgbatch_abc123', processing_status: 'in_progress' }), { status: 200 }) }
  if (url.endsWith('/v1/messages/batches/msgbatch_abc123')) { calls.push('status'); return new Response(JSON.stringify({ id: 'msgbatch_abc123', processing_status: batch.status }), { status: 200 }) }
  if (url.endsWith('/v1/messages/batches/msgbatch_gone99')) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
  if (url.endsWith('/v1/messages/batches/msgbatch_abc123/results')) { calls.push('results'); return new Response(['{"custom_id":"site-c9","result":{"type":"succeeded"}}', JSON.stringify({ custom_id: 'site-c1', result: batch.result })].join('\n'), { status: 200 }) }
  if (url.includes('/storage/v1/object/photos/c1/')) {
    calls.push('storage'); storageAuth = init.headers.authorization
    const id = decodeURIComponent(url.split('/').pop()!.replace('.jpg', '')); const f = files[id]
    return f ? new Response(f.body, { status: 200, headers: { 'content-type': f.type } }) : new Response('nope', { status: 404 })
  }
  if (url.includes('generativelanguage')) { calls.push('gemini'); gemini = JSON.parse(init.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Number four front is painted.' }] } }], usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 200 } }), { status: 200 }) }
  calls.push('claude'); claude = JSON.parse(init.body)
  return new Response(JSON.stringify(answer), { status: 200 })
}) as typeof fetch
const call = async (body: unknown) => {
  const out = { status: 0, json: null as any }
  const res = { status(s: number) { out.status = s; return res }, json(j: unknown) { out.json = j; return res } }
  await read({ method: 'POST', headers: { authorization: 'Bearer tok' }, body } as never, res as never)
  return out
}
let r = await call(req)
ok(r.status === 503 && /GEMINI_API_KEY/.test(r.json.error) && !calls.length, 'voice/video without a Gemini key: says what to set up, reads nothing')
process.env.GEMINI_API_KEY = 'g'
process.env.SITE_READ_NOW = '1'
r = await call(req)
ok(r.status === 200 && calls.join() === 'guard,storage,storage,gemini,claude', 'guard first, media from storage, voice to Gemini, then Claude')
ok(storageAuth === 'Bearer tok', 'media fetched with the caller’s own sign-in (company storage rules apply)')
ok(gemini.contents[0].parts[0].inline_data.mime_type === 'audio/wav', 'voice note sent to Gemini as WAV')
ok(r.json.transcripts.M2 === 'Number four front is painted.' && r.json.suggestions.length === 1, 'transcripts and suggestions returned')
const blocks = claude.messages[0].content
ok(blocks.some((b: any) => b.type === 'image') && blocks.some((b: any) => /Transcript: Number four/.test(b.text ?? '')) && blocks.some((b: any) => /Written note: Scaffold struck/.test(b.text ?? '')), 'Claude gets the photo, the transcript and the note')
ok(blocks.at(-1).text.includes('L3 [claimed] |') && claude.output_config.format.type === 'json_schema' && claude.model === 'claude-opus-5-5', 'scope with claimed lines marked; schema-checked answer')
files['m-v1'] = undefined as never
calls.length = 0
r = await call(req)
ok(r.status === 200 && /hasn’t finished uploading/.test(r.json.failed.M2) && !calls.includes('gemini'), 'media not uploaded yet: that capture stays unread, the rest are read')
files['m-v1'] = { body: new Uint8Array(wav.size), type: 'audio/wav' }

// ---- half price: the day goes as a batch, and is collected later
delete process.env.SITE_READ_NOW
calls.length = 0; spent.length = 0
r = await call(req)
ok(r.status === 200 && r.json.pending === 'msgbatch_abc123' && !r.json.suggestions && calls.join() === 'guard,storage,storage,gemini,batch', 'read as a batch: the app gets an id to collect, not an answer')
const sentReq = batchReq.requests[0]
ok(sentReq.custom_id === 'site-c1' && sentReq.params.model === 'claude-opus-5-5' && sentReq.params.output_config.effort === 'high' && !('fallbacks' in sentReq.params), 'the batch is marked with the firm, so only that firm can collect it')
ok(r.json.transcripts.M2 === 'Number four front is painted.', 'the transcripts come back at once')
// Gemini: 2,000 in at $1 + 200 out at $2.50 = $0.0025 → 0.2p
ok(spent.length === 1 && spent[0].p_kind === 'site' && Math.abs(spent[0].p_credits - 0.2) < 0.001 && !spent[0].p_ref, 'the transcription’s real cost is written at once')
calls.length = 0; spent.length = 0
r = await call({ collect: 'msgbatch_abc123' })
ok(r.status === 200 && r.json.pending === 'msgbatch_abc123' && calls.join() === 'guard,status', 'collected too soon: still pending, nothing charged')
batch = { status: 'ended', result: { type: 'succeeded', message: answer } }
r = await call({ collect: 'msgbatch_abc123' })
ok(r.status === 200 && r.json.suggestions.length === 1, 'collected once read: the suggestions')
// Opus at half price: 20,000 × $4 + 1,000 × $20 = $0.10 → $0.05 → 4p
ok(spent.length === 1 && spent[0].p_ref === 'msgbatch_abc123' && Math.abs(spent[0].p_credits - 4) < 0.001, 'charged at half price, once per batch (its id is the ledger’s ref)')
firm = { company: 'c2', plan: 'pilot', lane: 'normal' }
r = await call({ collect: 'msgbatch_abc123' })
ok(r.status === 404, 'another firm can’t collect it')
firm = { company: 'c1', plan: 'pilot', lane: 'normal' }
r = await call({ collect: '../../v1/files' })
ok(r.status === 400, 'only a batch id is accepted')
r = await call({ collect: 'msgbatch_gone99' })
ok(r.status === 200 && r.json.again, 'a batch that’s gone: read the captures again')
batch = { status: 'ended', result: { type: 'expired' } }
r = await call({ collect: 'msgbatch_abc123' })
ok(r.json.again === true, 'a read that expired: read the captures again')
batch = { status: 'ended', result: { type: 'succeeded', message: { ...answer, stop_reason: 'refusal', content: [] } } }
r = await call({ collect: 'msgbatch_abc123' })
ok(/declined/.test(r.json.error) && !r.json.again, 'a declined read is said once, not tried again and again')
firm = { company: 'c1', plan: 'jupiter', lane: 'economy' }
r = await call(req)
ok(batchReq.requests[0].params.output_config.effort === 'medium', 'Jupiter’s economy lane, past the allowance: read more lightly')
firm = { company: 'c1', plan: 'pilot', lane: 'normal' }

// ---- the app collects it: checked against the scope as it is now
const pend: PendingRead = { batch: 'msgbatch_abc123', jobId: 'j', at: 5, items: { M1: 'p1', M2: 'v1' }, lines: { L1: 's1', L2: 's2' } }
const waitingRead = (e: DiaryEntry) => ({ ...e, read: { at: 5, suggestions: [], pending: 'msgbatch_abc123' } })
const sent = [waitingRead(diary[0]), waitingRead({ ...diary[1], transcript: 'Number four front is painted.' })]
let reply: { status: number; body: any } = { status: 200, body: { pending: 'msgbatch_abc123' } }
let asked: any = null
globalThis.fetch = (async (_u: string, init: any) => { asked = JSON.parse(init.body); return new Response(JSON.stringify(reply.body), { status: reply.status }) }) as typeof fetch
let got = await collectSite(pend, sent, scope)
ok(asked.collect === 'msgbatch_abc123' && got.state === 'waiting', 'not back yet: wait')
reply = { status: 200, body: { suggestions: answer.content.length ? JSON.parse(answer.content[0].text).suggestions : [] } }
got = await collectSite(pend, sent, scope)
ok(got.state === 'done' && got.suggestions === 1 && got.updated.length === 2 && got.updated.every(e => !e.read?.pending) && got.updated[1].read!.suggestions[0].lineIds.join() === 's1', 'back: checked with the words said, waiting in Vals')
got = await collectSite(pend, sent, [S('s1', '4', '4360BD', 'val2'), S('s2', '4', '4350AA')])
ok(got.state === 'done' && got.suggestions === 0, 'a line claimed while it was being read isn’t suggested again')
reply = { status: 200, body: { again: true } }
got = await collectSite(pend, sent, scope)
ok(got.state === 'done' && got.updated.every(e => e.read === undefined), 'lost or expired: the captures go back to be read again')
reply = { status: 401, body: { error: 'Your sign-in has expired — sign in again and retry.' } }
got = await collectSite(pend, sent, scope)
ok(got.state === 'stop' && /expired/.test((got as { error: string }).error), 'signed out: stop until the next open, keep it')
reply = { status: 502, body: { error: 'Could not reach the AI service.' } }
got = await collectSite(pend, sent, scope)
ok(got.state === 'waiting', 'no answer from the server: try again later')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
