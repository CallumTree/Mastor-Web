/**
 * POST /api/parse-boq  — reads a Bill of Quantities / works order with Claude.
 * Body: { kind: 'pdf', data: <base64> } | { kind: 'text', text: <string> }
 * Returns: { text: <TSV lines> }  (parsed + reviewed on the device before anything is saved)
 *
 * The API key lives only in Vercel's environment (ANTHROPIC_API_KEY) — never in the app.
 */
export const config = { maxDuration: 300 }

const PROMPT = `You are reading a UK construction Bill of Quantities / Schedule of Rates works order for a contractor.
Extract EVERY line item that carries a quantity or a rate (repair items, SoR codes, provisional sums, dayworks, prelims if itemised).

OUTPUT FORMAT — one JSON object per line (JSON Lines), nothing else, no markdown, no commentary:
First line:  {"ref": "works order / contract / site reference if printed, else empty"}
Then one object per item, every key present (use "" or null when a value isn't printed):
{"code": "4360BD", "location": "Property", "description": "Washdown and apply 1 coat masonry paint to render", "qty": 71, "unit": "", "rate": 8.55, "cost": 607.05, "property": "1", "workstream": "PPR Paint", "hours": 0, "note": ""}

RULES — accuracy matters more than completeness:
- Copy numbers exactly as printed, as JSON numbers. rate = the UNIT rate (e.g. 133.9055); cost = the printed LINE total (e.g. 1740.77). No £ signs or commas.
- unit: only if the document has a unit column (SM, LM, NO, IT…). If there is no unit column, unit is "" — never put a number in unit.
- NEVER invent or estimate a code, quantity, unit or rate. If it is not printed, use null (numbers) or "" (text).
- If only a line total is printed with no rate, rate is null and the total goes in cost.
- location = the location/room/elevation the item is in (e.g. Kitchen, Bathroom, Front Elevation, Property). If none, "General".
- description: a short one-line version of the SoR description (the heading before the colon plus the key work,
  e.g. "Wall: take down half-brick wall, remove spoil"). If the Comments column has text for this item, append it
  after " — " exactly as written (e.g. "... — Remove partition to airing cupboard in kitchen"). The comment is the
  site-specific instruction and must never be dropped.
- The same code can legitimately appear more than once (different location or a different comment). Output every one.
- Keep codes exactly as printed, including leading zeros (e.g. 0390AC).
- - Do NOT output subtotals, "carried forward", "brought forward", summary pages or grand totals as items.
- property: the house / unit / plot NUMBER this line belongs to. Schedules covering several properties have a
  NUMBER (or No., Plot, House) column — copy that number exactly (e.g. 1, 2, 13, 4A). This is NOT the location:
  a location column may literally say "PROPERTY" — that word goes in location, never in property.
  Single-property documents (one address): property is "".
- workstream: if the schedule splits costs into work categories (columns such as PPR Paint, PPR Repairs, Est Imp,
  Kitchen, Bathroom, Roofing, Scaffold, WHQS, Windows, Decarb, Comp Doors), the category this line's cost sits in,
  using the column's heading. Otherwise empty.
- hours: labour hours for the line if an hours column is printed, else empty. Never estimate.
- Keep lines in the order they appear in the document.
- note: anything the contractor should check (unclear figure, possible duplicate, illegible). Otherwise empty.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'AI is not set up yet — add ANTHROPIC_API_KEY in Vercel (Settings → Environment Variables), then redeploy.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let content
  if (body?.kind === 'pdf' && body.data) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.data } },
      { type: 'text', text: PROMPT },
    ]
  } else if (body?.kind === 'text' && body.text) {
    content = [{ type: 'text', text: PROMPT + '\n\n--- DOCUMENT ---\n' + String(body.text).slice(0, 400000) }]
  } else {
    return res.status(400).json({ error: 'No document received.' })
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', max_tokens: 32000, messages: [{ role: 'user', content }] }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const truncated = data.stop_reason === 'max_tokens'
    return res.status(200).json({ text, truncated })
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
  }
}
