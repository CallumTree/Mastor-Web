/**
 * POST /api/read-pack — reads the non-schedule documents in a client's pack (PCI, risk register,
 * surveys) for the facts a contractor needs and for work they call for that isn't in the scope.
 * Body: { docs: [{ name, text }], scope: "<one line per scope item>" }
 * Returns: { facts: [...], extras: [...], cut: [names of documents that were too long to send whole] }
 * Every item carries a verbatim quote; the device checks each quote against the document before
 * anything is offered for saving.
 *
 * The API key lives only in Vercel's environment (ANTHROPIC_API_KEY) — never in the app.
 */
import { guard } from './_guard.js'

export const config = { maxDuration: 300 }

const MODEL = process.env.ANTHROPIC_PACK_MODEL || 'claude-opus-5-5'
const PER_DOC = 120_000, TOTAL = 360_000

const SYSTEM = `You read the documents a UK social-housing client sends a maintenance contractor before a job starts:
pre-construction information (PCI), designer's risk registers, asbestos, ecology (bat) and other surveys.
The contractor already has the priced scope (given separately). Your job is to pull out what they must know or act on,
and any work these documents require that the scope does not include.

facts — one item per fact the contractor would write in the job's notes:
- Client: key dates (start, completion, handover), the client's people with role, phone and email, how instructions are given.
- Site: working hours, access and parking, welfare and storage, occupied homes, properties surveyed or not accessed.
- H&S: hazards and controls specific to this job (asbestos to survey or remove, bats, working at height, services) and anything that must happen before work starts.
- Commercial: anything about price, payment, uplifts or what is or isn't included.
Leave out generic CDM wording, legal boilerplate, the contractor's own details and anything that applies to every job.

extras — work a document asks the contractor to do that is NOT in the scope list: e.g. a survey recommends fitting
something, a precaution needs equipment or an attendance, a removal is required first. Only include it if you cannot
find a scope line that covers it. Describe the work plainly; never give a price or quantity unless the document states one.

Rules:
- Use only what the documents say. Never infer, generalise or add advice of your own.
- text: one plain sentence in UK English, written for the contractor.
- document: the document's name exactly as given. page: the [page N] the quote is on, or null if the document has no page markers.
- quote: copy 4 to 30 consecutive words exactly as they appear in the document (same words, same order) that prove the item.
- properties: house numbers the item applies to (e.g. ["3","4"]), or [] if it applies to the whole job.
- One fact per item; no duplicates across documents.`

const SOURCE = {
  document: { type: 'string' },
  page: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  quote: { type: 'string' },
  properties: { type: 'array', items: { type: 'string' } },
}
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['facts', 'extras'],
  properties: {
    facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['category', 'text', 'document', 'page', 'quote', 'properties'],
      properties: { category: { type: 'string', enum: ['Client', 'Site', 'H&S', 'Commercial'] }, text: { type: 'string' }, ...SOURCE } } },
    extras: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'why', 'document', 'page', 'quote', 'properties'],
      properties: { text: { type: 'string' }, why: { type: 'string' }, ...SOURCE } } },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'AI is not set up yet — add ANTHROPIC_API_KEY in Vercel (Settings → Environment Variables), then redeploy.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const docs = Array.isArray(body?.docs) ? body.docs.filter(d => d && d.name && d.text) : []
  if (!docs.length) return res.status(400).json({ error: 'No documents received.' })
  if (!(await guard(req, res, 'pack'))) return

  // send each document whole where possible; say which were cut rather than cutting silently
  const cut = []
  let room = TOTAL
  const parts = docs.map(d => {
    let text = String(d.text)
    const max = Math.min(PER_DOC, room)
    if (text.length > max) { text = text.slice(0, max); cut.push(String(d.name)) }
    room -= text.length
    return { type: 'text', text: `<document name="${String(d.name).replace(/"/g, "'")}">\n${text}\n</document>` }
  }).filter(p => p.text.length > 40)
  parts.push({ type: 'text', text: `<scope>\n${String(body.scope || '(no scope lines)').slice(0, 40_000)}\n</scope>\n\nRead the documents above and return the facts and extras.` })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 16000, fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM, messages: [{ role: 'user', content: parts }],
      }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    if (data.stop_reason === 'refusal') return res.status(502).json({ error: 'The reader declined these documents. Add the facts to the job notes by hand.' })
    if (data.stop_reason === 'max_tokens') return res.status(502).json({ error: 'The documents gave more than the reader could return in one go. Try fewer documents at a time.' })
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    let out
    try { out = JSON.parse(text) } catch { return res.status(502).json({ error: 'The reader’s answer couldn’t be read. Try again.' }) }
    return res.status(200).json({ facts: out.facts || [], extras: out.extras || [], cut })
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
  }
}
