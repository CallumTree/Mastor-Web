/**
 * POST /api/parse-boq  — reads a bill of quantities, schedule, scope of works or works order with Claude, when the
 *   layout reader on the device (src/lib/scopeTable.ts) can't read it exactly.
 * Body: { kind: 'pdf', data: <base64> } | { kind: 'text', text: <string> }
 * Returns: { text: <TSV lines> }  (parsed + reviewed on the device before anything is saved)
 *
 * The API key lives only in Vercel's environment (ANTHROPIC_API_KEY) — never in the app.
 */
import { guard, spend, bearer, anthropicKey } from './_guard.js'
import { claudeCredits } from './_cost.js'

export const config = { maxDuration: 300 }

const PROMPT = `You are reading a UK construction document for a contractor: a bill of quantities, schedule of rates, schedule
of works, scope of works, specification, works order or quotation. It could come from any client (a council, housing
association, NHS trust, police or fire service, school, university, private landlord or main contractor) and be laid
out in any way: a table with columns, sections with headings, numbered clauses, or plain paragraphs.
Work out the layout first: what each column or heading means, how properties, rooms or trades are grouped, and which
rows are headings, notes or totals rather than work. Then extract EVERY item of work: priced items, measured items with
no price yet, provisional sums, dayworks, itemised preliminaries, and in a scope of works every instruction to do
work, even when no quantity or rate is given.

OUTPUT FORMAT — one JSON object per line (JSON Lines), nothing else, no markdown, no commentary:
First line:  {"ref": "works order / contract / project / site reference if printed, else empty"}
Then one object per item, every key present (use "" or null when a value isn't printed):
{"code": "D3", "location": "Bathroom", "description": "Make good plaster to walls after removal of fittings", "qty": 12, "unit": "m2", "rate": 22, "cost": 264, "property": "14", "workstream": "Finishes", "hours": null, "note": ""}

RULES — accuracy matters more than completeness:
- Copy numbers exactly as printed, as JSON numbers. rate = the UNIT rate (e.g. 133.9055); cost = the printed LINE
  total (e.g. 1740.77). No £ signs or commas.
- NEVER invent, estimate or calculate a code, quantity, unit, rate or total. If it is not printed, use null (numbers)
  or "" (text). If only a line total is printed, rate is null and the total goes in cost. A scope of works with no
  figures gives items with qty, rate and cost all null.
- code: the item's own reference as printed (SoR code, item number, clause number, asset ref), exactly, including
  leading zeros (e.g. 0390AC, 2.3a). If none, "".
- unit: the unit of measure only if printed (m, m2, lm, nr, item, sum, hr…). Never put a number in unit. A column
  headed "Unit" that holds house or flat numbers (4A, 12) is the property, not the unit.
- location = the room, area or elevation the item is in (Kitchen, Bathroom, Front elevation, Ward 3, Appliance bay),
  from its column or the heading above it. If none, "General".
- description: a short one-line version of the item (the heading before the colon plus the key work, e.g.
  "Wall: take down half-brick wall, remove spoil"). Join a description that wraps over several rows. If a comments or
  notes column has text for this item, append it after " — " exactly as written; it is the site-specific instruction
  and must never be dropped.
- property: the house / flat / plot / block this line belongs to, as printed in its column or the heading above it
  (e.g. 1, 13, 4A, "Block C"). For an address heading such as "12 Acacia Avenue", use the number (12). This is not the
  location: a location column may literally say "PROPERTY" — that word goes in location. Single-property
  documents: property is "".
- workstream: the work category the line belongs to, if the document has one: a column the cost sits in (e.g.
  Roofing, Kitchen, Windows, Electrical), a section heading (e.g. Demolitions, Finishes, Mechanical) or a sheet name.
  Use the document's own words. Otherwise empty.
- hours: labour hours for the line if an hours column is printed, else null. Never estimate.
- The same code can legitimately appear more than once (different property, location or comment). Output every one.
- Do NOT output headings, notes, subtotals, "carried forward", "brought forward", collection or summary pages, grand
  totals, VAT, overheads and profit, or percentage adjustments as items.
- Keep lines in the order they appear in the document.
- note: anything the contractor should check (unclear figure, possible duplicate, illegible). Otherwise empty.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = anthropicKey()
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
  if (!(await guard(req, res, 'boq'))) return

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', max_tokens: 32000, messages: [{ role: 'user', content }] }),
    })
    const data = await r.json()
    if (data?.usage) await spend(bearer(req), 'boq', data.model, claudeCredits(data.model, data.usage))
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || `AI request failed (${r.status})` })
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const truncated = data.stop_reason === 'max_tokens'
    return res.status(200).json({ text, truncated })
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service. Check signal and try again.' })
  }
}
