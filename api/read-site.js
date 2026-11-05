/**
 * POST /api/read-site — reads a day's site captures against the job's scope.
 *  1. Media is fetched from the company's private storage with the caller's own sign-in
 *     (so only members can read it, and nothing large passes through this request).
 *  2. Voice notes and videos are transcribed by Gemini (GEMINI_API_KEY, GEMINI_MODEL).
 *  3. Claude reads the transcripts, notes and photos against the scope lines and live VOs and
 *     suggests: lines now complete, extra work (VOs), and site notes. Suggestions only — the
 *     device checks them and a person approves each one in Vals.
 *  4. The reading goes through Anthropic's Message Batches API at half price: suggestions already wait
 *     for a person, so an answer within the hour is as good as one now. The app collects it later with
 *     { collect: id } (src/lib/autoRead.ts). SITE_READ_NOW=1 in Vercel reads at once, at full price.
 * What each read really cost is written to the firm's AI ledger (api/_cost.js).
 * Body: { companyId, items: [{ key, kind, mediaId, note, room, date }], lines: [{ key, text, claimed }], vos: [text] }
 * Returns: { transcripts: { key: text }, pending: batch id, failed: { key: reason } } (or suggestions, read at once)
 * Body { collect: id } returns { pending: id } while it's being read, then { suggestions }, or { again: true } to read afresh.
 */
import { guard, aiCheck, spend, bearer, SB_URL, SB_KEY, anthropicKey, geminiKey } from './_guard.js'
import { claudeCredits, geminiCredits } from './_cost.js'

export const config = { maxDuration: 300 }

export const CLAUDE_MODEL = process.env.ANTHROPIC_SITE_MODEL || 'claude-opus-5-5'
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const GEMINI = 'https://generativelanguage.googleapis.com'
const ANTHROPIC = 'https://api.anthropic.com/v1'
const anthropicHeaders = key => ({ 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' })
const INLINE_MAX = 14 * 1024 * 1024   // larger clips go through Gemini's file upload

const TRANSCRIBE = `Transcribe exactly what is said in this recording from a UK building site, in English, word for word.
Keep trade terms, SoR codes, house numbers, room names and measurements exactly as spoken.
If it is a video, after the transcript add one line starting "SEEN:" describing only the building work visible (no guesses).
If nothing is said, reply with "(no speech)" and, for a video, the SEEN line.`

const SYSTEM = `You help a UK social-housing maintenance contractor keep the job's master schedule up to date from site.
You get the day's captures (photos, voice-note and video transcripts, written notes) and the job's scope lines and live VOs.
Suggest, for a person to approve:
- complete: scope lines the captures SAY are finished, in words (a voice note, a video's speech, a caption or the day's note). Only lines that are not already claimed. Use the line keys given (L1, L2…).
  Be strict, because a person will claim money on it: "started", "half done", "nearly", "should be done" or "going on tomorrow" is not complete. A photo alone is never enough: it can't show that a line is finished, or which house it is.
  When the scope covers more than one house, give the house number for every complete, and only lines in that house; if the words don't make clear which house, don't suggest it.
- vo: work done or needed that NO scope line or live VO covers (e.g. rotten joists found under a bath). Describe it plainly. qty and unit only if a measurement is actually said or written (never estimate from a photo). code: an SoR code only if one is said; otherwise "".
- note: a site event worth keeping in the diary (delays, access refused, damage found, materials short, client instruction given verbally). One plain sentence.
For every suggestion: item = the capture key (M1…); quote = the exact words from the transcript or note that support it (a few consecutive words, copied exactly), or "" if it comes only from what a photo shows; basis = "said" (from words), "seen" (from a photo/video only) or "both".
property = the house number if known, else "". Never invent anything not in the captures. Fewer, certain suggestions are better than many doubtful ones: if nothing applies, return no suggestions.`

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['suggestions'],
  properties: { suggestions: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['item', 'kind', 'lines', 'text', 'property', 'room', 'qty', 'unit', 'code', 'quote', 'basis'],
    properties: {
      item: { type: 'string' }, kind: { type: 'string', enum: ['complete', 'vo', 'note'] }, lines: { type: 'array', items: { type: 'string' } },
      text: { type: 'string' }, property: { type: 'string' }, room: { type: 'string' },
      qty: { anyOf: [{ type: 'number' }, { type: 'null' }] }, unit: { type: 'string' }, code: { type: 'string' },
      quote: { type: 'string' }, basis: { type: 'string', enum: ['said', 'seen', 'both'] },
    } } } },
}

async function download(companyId, mediaId, token) {
  const r = await fetch(`${SB_URL}/storage/v1/object/photos/${encodeURIComponent(companyId)}/${encodeURIComponent(mediaId)}.jpg`, { headers: { apikey: SB_KEY, authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  return { bytes: Buffer.from(await r.arrayBuffer()), type: (r.headers.get('content-type') || '').split(';')[0] }
}

/** Gemini: small files inline, larger ones through the resumable file upload. Returns the words and what it cost, in credits. */
export async function transcribe(bytes, mime, key) {
  let part
  if (bytes.length <= INLINE_MAX) part = { inline_data: { mime_type: mime, data: bytes.toString('base64') } }
  else {
    const start = await fetch(`${GEMINI}/upload/v1beta/files`, { method: 'POST', headers: { 'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime, 'content-type': 'application/json' }, body: JSON.stringify({ file: { display_name: 'site-capture' } }) })
    const url = start.headers.get('x-goog-upload-url'); if (!url) throw new Error('upload refused')
    const up = await fetch(url, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'content-length': String(bytes.length) }, body: bytes })
    let file = (await up.json()).file
    for (let i = 0; file && file.state === 'PROCESSING' && i < 30; i++) { await new Promise(r => setTimeout(r, 2000)); file = await (await fetch(`${GEMINI}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': key } })).json() }
    if (!file || file.state !== 'ACTIVE') throw new Error('the clip couldn’t be processed')
    part = { file_data: { mime_type: mime, file_uri: file.uri } }
  }
  const r = await fetch(`${GEMINI}/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [part, { text: TRANSCRIBE }] }], generationConfig: { temperature: 0 } }) })
  const d = await r.json()
  if (!r.ok) throw new Error(d?.error?.message || `transcription failed (${r.status})`)
  return { text: (d.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim(), credits: geminiCredits(d.usageMetadata) }
}

/** The model's answer → suggestions, or a plain reason it can't be used. */
function answer(m) {
  if (m.stop_reason === 'refusal') return { error: 'The reader declined these captures. Tick the work in Scope by hand.' }
  if (m.stop_reason === 'max_tokens') return { error: 'Too much to read in one go — tick the work in Scope by hand.' }
  try { return { suggestions: JSON.parse((m.content || []).filter(b => b.type === 'text').map(b => b.text).join('')).suggestions || [] } }
  catch { return { error: 'The reader’s answer couldn’t be read.', again: true } }
}

/** Picks up a read sent earlier. Only the firm that sent it can collect it: its id is in the request's custom_id. */
async function collect(req, res, id, key) {
  if (!/^msgbatch_[A-Za-z0-9_-]{6,100}$/.test(String(id))) return res.status(400).json({ error: 'Unknown read.' })
  const token = bearer(req)
  const c = await aiCheck(token, 'collect')
  if (!c.ok) return res.status(c.status).json({ error: c.error })
  if (!c.company) return res.status(200).json({ again: true })
  try {
    const b = await fetch(`${ANTHROPIC}/messages/batches/${id}`, { headers: anthropicHeaders(key) })
    if (b.status === 404) return res.status(200).json({ again: true })
    const batch = await b.json()
    if (!b.ok) return res.status(502).json({ error: batch?.error?.message || `AI request failed (${b.status})` })
    if (batch.processing_status !== 'ended') return res.status(200).json({ pending: id })
    const r = await fetch(`${ANTHROPIC}/messages/batches/${id}/results`, { headers: anthropicHeaders(key) })
    if (!r.ok) return res.status(502).json({ error: `Couldn’t collect the read (${r.status}). It’s tried again shortly.` })
    const mine = (await r.text()).split('\n').map(l => { try { return JSON.parse(l) } catch { return null } }).find(l => l?.custom_id === `site-${c.company}`)
    if (!mine) return res.status(404).json({ error: 'That read isn’t one of your company’s.' })
    if (mine.result?.type !== 'succeeded') return res.status(200).json({ again: true })
    const m = mine.result.message
    await spend(token, 'site', m.model, claudeCredits(m.model, m.usage, { batch: true }), id)
    return res.status(200).json(answer(m))
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI service. It’s tried again shortly.' })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = anthropicKey()
  if (!key) return res.status(503).json({ error: 'AI is not set up yet — add ANTHROPIC_API_KEY in Vercel, then redeploy.' })
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  if (body?.collect) return collect(req, res, body.collect, key)
  const items = Array.isArray(body?.items) ? body.items.slice(0, 12) : []
  if (!items.length || !body.companyId) return res.status(400).json({ error: 'Nothing to read.' })
  const needsAudio = items.some(i => i.kind === 'voice' || i.kind === 'video')
  if (needsAudio && !geminiKey()) return res.status(503).json({ error: 'Voice and video reading isn’t set up yet — add GEMINI_API_KEY in Vercel, then redeploy.' })
  const c = await guard(req, res, 'site')
  if (!c) return
  const token = bearer(req)

  const transcripts = {}, failed = {}, content = []
  let heard = 0
  for (const it of items) {
    const head = `<capture key="${it.key}" kind="${it.kind}" date="${it.date}"${it.room ? ` room="${String(it.room).replace(/"/g, "'")}"` : ''}>`
    if (it.kind === 'day' || it.kind === 'note' || !it.mediaId) { content.push({ type: 'text', text: `${head}\nWritten note: ${it.note}\n</capture>` }); continue }
    const file = await download(body.companyId, it.mediaId, token)
    if (!file) { failed[it.key] = 'A capture hasn’t finished uploading yet — wait for “Synced”, then read again.'; continue }
    try {
      if (it.kind === 'photo') {
        content.push({ type: 'text', text: `${head}${it.note ? `\nCaption: ${it.note}` : ''}` })
        content.push({ type: 'image', source: { type: 'base64', media_type: file.type.startsWith('image/') ? file.type : 'image/jpeg', data: file.bytes.toString('base64') } })
        content.push({ type: 'text', text: '</capture>' })
      } else {
        const mime = it.kind === 'voice' ? 'audio/wav' : (file.type.startsWith('video/') ? file.type : 'video/mp4')
        const t = await transcribe(file.bytes, mime, geminiKey())
        transcripts[it.key] = t.text
        heard += t.credits
        content.push({ type: 'text', text: `${head}\nTranscript: ${t.text}${it.note ? `\nCaption: ${it.note}` : ''}\n</capture>` })
      }
    } catch (e) { failed[it.key] = `Couldn’t transcribe a ${it.kind} (${e.message}). It stays unread — try again later.` }
  }
  if (heard) await spend(token, 'site', GEMINI_MODEL, heard)
  if (!content.length) return res.status(200).json({ transcripts, suggestions: [], failed })
  const lines = (body.lines || []).map(l => `${l.key}${l.claimed ? ' [claimed]' : ''} | ${l.text}`).join('\n')
  content.push({ type: 'text', text: `<scope>\n${lines.slice(0, 120_000)}\n</scope>\n<live_vos>\n${(body.vos || []).join('\n') || '(none)'}\n</live_vos>\n\nSuggest what these captures show.` })

  // past the plan's allowance, Jupiter's economy lane reads with less effort
  const params = { model: CLAUDE_MODEL, max_tokens: 16000, output_config: { effort: c.lane === 'economy' ? 'medium' : 'high', format: { type: 'json_schema', schema: SCHEMA } }, system: SYSTEM, messages: [{ role: 'user', content }] }

  // half price through a batch, once the database can say whose read it is (v8)
  if (c.company && process.env.SITE_READ_NOW !== '1') {
    try {
      const r = await fetch(`${ANTHROPIC}/messages/batches`, { method: 'POST', headers: anthropicHeaders(key), body: JSON.stringify({ requests: [{ custom_id: `site-${c.company}`, params }] }) })
      const d = await r.json()
      if (!r.ok || !d?.id) return res.status(502).json({ error: d?.error?.message || `AI request failed (${r.status})` })
      return res.status(200).json({ transcripts, pending: d.id, failed })
    } catch {
      return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
    }
  }
  try {
    const r = await fetch(`${ANTHROPIC}/messages`, {
      method: 'POST',
      headers: { ...anthropicHeaders(key), 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({ ...params, fallbacks: 'default' }),
    })
    const data = await r.json()
    if (data?.usage) await spend(token, 'site', data.model, claudeCredits(data.model, data.usage))
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    const out = answer(data)
    if (out.error) return res.status(502).json({ error: out.error })
    return res.status(200).json({ transcripts, suggestions: out.suggestions, failed })
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
  }
}
