/**
 * POST /api/read-site — reads a day's site captures against the job's scope.
 *  1. Media is fetched from the company's private storage with the caller's own sign-in
 *     (so only members can read it, and nothing large passes through this request).
 *  2. Voice notes and videos are transcribed by Gemini (GEMINI_API_KEY, GEMINI_MODEL).
 *  3. Claude reads the transcripts, notes and photos against the scope lines and live VOs and
 *     suggests: lines now complete, extra work (VOs), and site notes. Suggestions only — the
 *     device checks them and a person approves each one in Vals.
 * Body: { companyId, items: [{ key, kind, mediaId, note, room, date }], lines: [{ key, text, claimed }], vos: [text] }
 * Returns: { transcripts: { key: text }, suggestions: [...], failed: { key: reason } }
 */
import { guard, SB_URL, SB_KEY, anthropicKey, geminiKey } from './_guard.js'

export const config = { maxDuration: 300 }

export const CLAUDE_MODEL = process.env.ANTHROPIC_SITE_MODEL || 'claude-opus-5-5'
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const GEMINI = 'https://generativelanguage.googleapis.com'
const INLINE_MAX = 14 * 1024 * 1024   // larger clips go through Gemini's file upload

const TRANSCRIBE = `Transcribe exactly what is said in this recording from a UK building site, in English, word for word.
Keep trade terms, SoR codes, house numbers, room names and measurements exactly as spoken.
If it is a video, after the transcript add one line starting "SEEN:" describing only the building work visible (no guesses).
If nothing is said, reply with "(no speech)" and, for a video, the SEEN line.`

const SYSTEM = `You help a UK social-housing maintenance contractor keep the job's master schedule up to date from site.
You get the day's captures (photos, voice-note and video transcripts, written notes) and the job's scope lines and live VOs.
Suggest, for a person to approve:
- complete: scope lines the captures show or say are finished. Only lines that are not already claimed. Use the line keys given (L1, L2…). Be strict: "started", "half done" or "nearly" is not complete. If you are not sure which property or line, don't suggest it.
- vo: work done or needed that NO scope line or live VO covers (e.g. rotten joists found under a bath). Describe it plainly. qty and unit only if a measurement is actually said or written (never estimate from a photo). code: an SoR code only if one is said; otherwise "".
- note: a site event worth keeping in the diary (delays, access refused, damage found, materials short, client instruction given verbally). One plain sentence.
For every suggestion: item = the capture key (M1…); quote = the exact words from the transcript or note that support it (a few consecutive words, copied exactly), or "" if it comes only from what a photo shows; basis = "said" (from words), "seen" (from a photo/video only) or "both".
property = the house number if known, else "". Never invent anything not in the captures. If nothing applies, return no suggestions.`

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

/** Gemini: small files inline, larger ones through the resumable file upload. */
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
  return (d.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = anthropicKey()
  if (!key) return res.status(503).json({ error: 'AI is not set up yet — add ANTHROPIC_API_KEY in Vercel, then redeploy.' })
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const items = Array.isArray(body?.items) ? body.items.slice(0, 12) : []
  if (!items.length || !body.companyId) return res.status(400).json({ error: 'Nothing to read.' })
  const needsAudio = items.some(i => i.kind === 'voice' || i.kind === 'video')
  if (needsAudio && !geminiKey()) return res.status(503).json({ error: 'Voice and video reading isn’t set up yet — add GEMINI_API_KEY in Vercel, then redeploy.' })
  if (!(await guard(req, res, 'site'))) return
  const token = String(req.headers.authorization).slice(7).trim()

  const transcripts = {}, failed = {}, content = []
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
        transcripts[it.key] = t
        content.push({ type: 'text', text: `${head}\nTranscript: ${t}${it.note ? `\nCaption: ${it.note}` : ''}\n</capture>` })
      }
    } catch (e) { failed[it.key] = `Couldn’t transcribe a ${it.kind} (${e.message}). It stays unread — try again later.` }
  }
  if (!content.length) return res.status(200).json({ transcripts, suggestions: [], failed })
  const lines = (body.lines || []).map(l => `${l.key}${l.claimed ? ' [claimed]' : ''} | ${l.text}`).join('\n')
  content.push({ type: 'text', text: `<scope>\n${lines.slice(0, 120_000)}\n</scope>\n<live_vos>\n${(body.vos || []).join('\n') || '(none)'}\n</live_vos>\n\nSuggest what these captures show.` })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 16000, fallbacks: 'default', output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } }, system: SYSTEM, messages: [{ role: 'user', content }] }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    if (data.stop_reason === 'refusal') return res.status(502).json({ error: 'The reader declined these captures. Tick the work in Scope by hand.' })
    if (data.stop_reason === 'max_tokens') return res.status(502).json({ error: 'Too much to read in one go — read fewer captures at a time.' })
    let out
    try { out = JSON.parse((data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')) } catch { return res.status(502).json({ error: 'The reader’s answer couldn’t be read. Try again.' }) }
    return res.status(200).json({ transcripts, suggestions: out.suggestions || [], failed })
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
  }
}
