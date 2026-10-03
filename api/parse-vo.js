/**
 * POST /api/parse-vo — reads a council variation instruction (scan, photo, screenshot, PDF, handwritten ticket).
 * Body: { kind: 'image', data: <base64>, mediaType } | { kind: 'pdf', data: <base64> }
 * Returns: { text: <JSON> } — reviewed on the device before anything is saved.
 */
export const config = { maxDuration: 120 }

const PROMPT = `This is a UK local-authority variation instruction / works order / site instruction sent to a building contractor.
It may be handwritten, scanned, photographed or a screenshot. Read it carefully.

Reply with ONE JSON object only — no markdown, no commentary:
{"ref": "the instruction / VO / works order number, e.g. 11284 or VO 5",
 "date": "date issued as YYYY-MM-DD, or empty",
 "issued_by": "officer / AMO name if written, or empty",
 "address": "address or location of works",
 "po_number": "the order number being varied (often 'Please vary order no.' e.g. H/PC21812), or empty",
 "description": "one-line summary of what's instructed",
 "lines": [{"code": "SoR code as written e.g. 120021 or SCA003", "description": "the work", "location": "where, if stated",
            "qty": number or null, "unit": "IT/NO/SM/LM… or empty", "rate": unit rate number or null, "cost": line total number or null,
            "unclear": "what you're unsure of, if anything, else empty"}]}

Rules:
- Copy codes and numbers exactly as written. "1IT - £540.02" means qty 1, unit IT, cost 540.02.
- NEVER guess a number you can't read — use null and say so in "unclear".
- Ignore signatures, logos and blank pages.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'AI is not set up yet — add ANTHROPIC_API_KEY in Vercel.' })
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let doc
  if (b?.kind === 'image' && b.data) doc = { type: 'image', source: { type: 'base64', media_type: b.mediaType || 'image/jpeg', data: b.data } }
  else if (b?.kind === 'pdf' && b.data) doc = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b.data } }
  else return res.status(400).json({ error: 'No document received.' })
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', max_tokens: 4000, messages: [{ role: 'user', content: [doc, { type: 'text', text: PROMPT }] }] }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    return res.status(200).json({ text: (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n') })
  } catch { return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' }) }
}
