/** Site capture → scope: WAV voice notes, the read endpoint (storage → Gemini → Claude), and checking every suggestion. */
import 'fake-indexeddb/auto'
import read from '../api/read-site.js'
import { encodeWav } from '../src/lib/voice'
import { buildRequest, verifySuggestions, voFromSuggestion, unread, openSuggestions, decide } from '../src/lib/siteRead'
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
const diary = [D('p1', 'photo'), D('v1', 'voice'), D('d1', 'day', { note: 'Scaffold struck at number 3, all clear' }), D('old', 'photo', { read: { at: 1, suggestions: [] } }), D('n0', 'day', { note: 'ok' })]
const items = unread(diary, '2026-10-17')
ok(items.map(e => e.id).join() === 'p1,v1,d1', 'unread: new photo, voice note and a real written note; already-read and one-word notes skipped')
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
const v = found.get('v1')!, p = found.get('p1')!
ok(v[0].kind === 'complete' && v[0].lineIds.join() === 's1' && v[0].verified, 'complete: only real, unclaimed lines kept; quote found in the transcript')
ok(v[1].kind === 'vo' && v[1].qty === 2 && v[1].verified, 'extra work: measurement as said, quote found')
ok(!v[2].verified, 'a quote not in what was said is marked unverified')
ok(p.length === 1 && p[0].basis === 'seen' && !p[0].verified, 'from the photo alone: kept, marked for a look; a suggestion for an already-claimed line is dropped')
ok(!found.has('d1') && [...found.values()].flat().length === 4, 'unknown captures and empty suggestions are dropped')
const vo = voFromSuggestion(v[1], diary[1], 'j', 7)
ok(vo.number === 7 && vo.status === 'Identified' && vo.rate === null && vo.qty === 2 && vo.room === 'No. 4 · Bathroom' && vo.reason === 'From site 2026-10-17: “rotten joists under the bath”', 'approved extra work → Identified VO, unpriced, with the words that raised it')
const withRead = { ...diary[1], read: { at: 1, suggestions: v } }
ok(openSuggestions([withRead]).length === 3 && openSuggestions([decide(withRead, v[0].id, 'approved')]).length === 2, 'review list: open suggestions only')

// ---- the endpoint
process.env.ANTHROPIC_API_KEY = 'k'
const calls: string[] = []
let claude: any = null, gemini: any = null, storageAuth = ''
const files: Record<string, { body: Uint8Array; type: string }> = { 'm-p1': { body: new Uint8Array([255, 216, 255]), type: 'image/jpeg' }, 'm-v1': { body: new Uint8Array(wav.size), type: 'audio/wav' } }
globalThis.fetch = (async (url: string, init: any) => {
  url = String(url)
  if (url.includes('/rpc/use_ai')) { calls.push('guard'); return new Response('1', { status: 200 }) }
  if (url.includes('/storage/v1/object/photos/c1/')) {
    calls.push('storage'); storageAuth = init.headers.authorization
    const id = decodeURIComponent(url.split('/').pop()!.replace('.jpg', '')); const f = files[id]
    return f ? new Response(f.body, { status: 200, headers: { 'content-type': f.type } }) : new Response('nope', { status: 404 })
  }
  if (url.includes('generativelanguage')) { calls.push('gemini'); gemini = JSON.parse(init.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Number four front is painted.' }] } }] }), { status: 200 }) }
  calls.push('claude'); claude = JSON.parse(init.body)
  return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ suggestions: [{ item: 'M2', kind: 'complete', lines: ['L1'], text: 'Done', property: '4', room: '', qty: null, unit: '', code: '', quote: 'number four front is painted', basis: 'said' }] }) }] }), { status: 200 })
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

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
