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

OUTPUT FORMAT — plain text only, no commentary, no markdown:
First line:  REF<TAB>the works order / contract reference if printed, else blank
Then one line per item, 11 tab-separated fields:
CODE<TAB>ROOM<TAB>DESCRIPTION<TAB>QTY<TAB>UNIT<TAB>RATE<TAB>COST<TAB>PROPERTY<TAB>WORKSTREAM<TAB>HOURS<TAB>NOTE

RULES — accuracy matters more than completeness:
- Copy numbers exactly as printed. RATE is the unit rate; COST is the printed line total. No £ signs or commas.
- NEVER invent or estimate a code, quantity, unit or rate. If it is not printed, leave that field empty.
- If only a line total is printed with no rate, leave RATE empty and put the total in COST.
- ROOM = the location/room heading the item sits under (e.g. Kitchen, Bathroom, External). If none, "General".
- DESCRIPTION: a short one-line version of the SoR description (the heading before the colon plus the key work,
  e.g. "Wall: take down half-brick wall, remove spoil"). If the Comments column has text for this item, append it
  after " — " exactly as written (e.g. "... — Remove partition to airing cupboard in kitchen"). The comment is the
  site-specific instruction and must never be dropped.
- The same code can legitimately appear more than once (different location or a different comment). Output every one.
- Keep codes exactly as printed, including leading zeros (e.g. 0390AC).
- Do NOT output subtotals, "carried forward", "brought forward", summary pages or grand totals as items.
- PROPERTY: on schedules covering several properties/units (a NUMBER column, plot or house number), the property
  it belongs to, exactly as printed (e.g. 1, 13, 4A). Single-property documents: leave empty.
- WORKSTREAM: if the schedule splits costs into work categories (columns such as PPR Paint, PPR Repairs, Est Imp,
  Kitchen, Bathroom, Roofing, Scaffold, WHQS, Windows, Decarb, Comp Doors), the category this line's cost sits in,
  using the column's heading. Otherwise empty.
- HOURS: labour hours for the line if an hours column is printed, else empty. Never estimate.
- Keep lines in the order they appear in the document.
- NOTE: anything the contractor should check (unclear figure, possible duplicate, illegible). Otherwise empty.`

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
