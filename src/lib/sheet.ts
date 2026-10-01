/**
 * Direct spreadsheet reader (no AI). Finds the header row of a council schedule and reads every line
 * exactly. Handles single-property BoQs and multi-property schemes (a NUMBER / No. / Plot column),
 * and schedules that split costs into workstream columns (PPR Paint, Kitchen, Scaffold, Decarb…).
 * Returns null if it can't recognise the layout — the caller then falls back to the AI reader.
 */
import type { ParsedBoq, ParsedLine } from './boq'
import { tidyLocation } from './boq'

type Cell = string | number | null | undefined
const norm = (c: Cell) => String(c ?? '').replace(/\s+/g, ' ').trim()
const up = (c: Cell) => norm(c).toUpperCase()
const money = (c: Cell): number | null => {
  if (typeof c === 'number') return isFinite(c) ? c : null
  const s = norm(c).replace(/[£,\s]/g, '')
  if (!s || s === '-' || s === '–') return null
  const v = parseFloat(s)
  return isFinite(v) ? v : null
}
const pick = (head: string[], ...names: RegExp[]) => head.findIndex(h => names.some(n => n.test(h)))
const KNOWN = /^(NUMBER|NO\.?|PLOT|HOUSE|UNIT|PROP(ERTY)? ?NO\.?|CODE|SOR|SOR CODE|ITEM|QTY|QUANTITY|RATE|UNIT RATE|UOM|UNITS?|LOCATION|ROOM|AREA|DESCRIPTION|COMMENTS?|NOTES?|COST|TOTAL|AMOUNT|HOURS|HRS)$/

export function readSchedule(rows: Cell[][]): ParsedBoq | null {
  // header row = first row with CODE + QTY + RATE + DESCRIPTION-ish columns
  const h = rows.findIndex(r => { const u = r.map(up); return u.some(x => /^(CODE|SOR( CODE)?)$/.test(x)) && u.some(x => /^(QTY|QUANTITY)$/.test(x)) && u.some(x => /RATE/.test(x)) && u.some(x => /DESCRIPTION/.test(x)) })
  if (h < 0) return null
  const head = rows[h].map(up)
  const col = {
    prop: pick(head, /^(NUMBER|NO\.?|PLOT|HOUSE|UNIT NO\.?|PROP(ERTY)? ?NO\.?)$/),
    code: pick(head, /^(CODE|SOR( CODE)?)$/),
    qty: pick(head, /^(QTY|QUANTITY)$/),
    rate: pick(head, /^(UNIT )?RATE$/),
    unit: pick(head, /^(UOM|UNITS?)$/),
    loc: pick(head, /^(LOCATION|ROOM|AREA)$/),
    desc: pick(head, /^DESCRIPTION$/),
    comment: pick(head, /^COMMENTS?$/),
    cost: pick(head, /^(COST|TOTAL|AMOUNT|LINE TOTAL)$/),
    hours: pick(head, /^(HOURS|HRS)$/),
  }
  // any other titled column holding £ values = a workstream column
  const streams = head.map((t, i) => ({ t, i })).filter(({ t, i }) => t && !KNOWN.test(t) && !Object.values(col).includes(i))
  const title = (t: string) => t.toLowerCase().replace(/\b(ppr|whqs)\b/g, m => m.toUpperCase()).replace(/\b\w/g, c => c.toUpperCase()).replace(/\bImp\b/, 'Imp')
  let ref = ''
  for (const r of rows.slice(0, h)) { const t = r.map(norm).filter(Boolean); const i = t.findIndex(x => /^(SITE|CONTRACT|SCHEME|JOB)/i.test(x)); if (i >= 0) ref = t.slice(i).join(' ').replace(/^(SITE|CONTRACT( REFERENCE)?|SCHEME|JOB)[:\s]*/i, ''); }

  const lines: ParsedLine[] = []
  for (const r of rows.slice(h + 1)) {
    const code = norm(r[col.code]); const description = col.desc >= 0 ? norm(r[col.desc]) : ''
    if (!code && !description) continue
    if (/^(sub)?total|carried forward|brought forward/i.test(description) || /^total/i.test(code)) continue
    const qty = money(r[col.qty]), rate = money(r[col.rate])
    // workstream = the stream column that holds this line's money
    let workstream = '', streamCost: number | null = null
    for (const s of streams) { const v = money(r[s.i]); if (v && v > 0) { workstream = title(s.t); streamCost = v; break } }
    const cost = col.cost >= 0 ? money(r[col.cost]) : streamCost
    const comment = col.comment >= 0 ? norm(r[col.comment]) : ''
    const issues: string[] = []
    if (rate == null) issues.push('no rate'); if (qty == null) issues.push('no qty'); if (!code) issues.push('no code')
    if (qty != null && rate != null && cost != null) {
      const calc = Math.round(qty * rate * 100 + 1e-7) / 100
      if (Math.abs(calc - cost) > 0.005) issues.push(`document cost £${cost.toFixed(2)} ≠ qty × rate £${calc.toFixed(2)}`)
    }
    const hours = col.hours >= 0 ? money(r[col.hours]) : null
    lines.push({
      include: true, code, room: tidyLocation(col.loc >= 0 ? norm(r[col.loc]) : '') || 'General',
      description: (description.charAt(0) + description.slice(1).toLowerCase()).replace(/:(\S)/, ': $1') + (comment ? ` — ${comment}` : ''),
      qty, unit: col.unit >= 0 ? norm(r[col.unit]) || 'item' : 'item', rate, cost,
      property: col.prop >= 0 ? norm(r[col.prop]).replace(/\.0+$/, '') : '', workstream, hours: hours ?? null, note: '', issues,
    })
  }
  return lines.length ? { ref, lines, truncated: false } : null
}
