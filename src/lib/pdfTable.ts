/**
 * Direct PDF table reader (no AI) for council schedules that are proper tables:
 * finds the header row (NUMBER/CODE/QTY/RATE/LOCATION/DESCRIPTION/…/HOURS), carries the column
 * positions across every page, and assigns each piece of text to the line whose SoR code it sits beside.
 * Checks itself against the sheet's own column totals. Returns null if the layout isn't recognised
 * or the read doesn't check out — the caller then falls back to the AI reader.
 */
import type { ParsedBoq, ParsedLine } from './boq'
import { tidyLocation } from './boq'

export interface Tok { x: number; y: number; s: string }
export interface PdfPage { items: Tok[] }

/** Pull positioned text out of a PDF with pdf.js (module passed in so browser + tests share this). */
export async function pdfPages(data: Uint8Array, pdfjs: { getDocument: (o: object) => { promise: Promise<any> } }): Promise<PdfPage[]> {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise
  const pages: PdfPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n)
    const h = p.getViewport({ scale: 1 }).height
    const tc = await p.getTextContent()
    pages.push({ items: (tc.items as { str: string; transform: number[] }[]).filter(i => i.str && i.str.trim()).map(i => ({ x: i.transform[4], y: h - i.transform[5], s: i.str.trim() })) })
  }
  return pages
}

const U = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase()
const amount = (s: string): number | null => { const t = s.replace(/[£,\s]/g, ''); if (!t || t === '-' || t === '–') return null; const v = parseFloat(t); return isFinite(v) && /^-?[\d.]+$/.test(t) ? v : null }
const isNum = (s: string) => /^-?[\d,]*\.?\d+$/.test(s.replace(/[£\s]/g, ''))
const KNOWN = /^(NUMBER|NO\.?|PLOT|HOUSE|UNIT NO\.?|CODE|SOR( CODE)?|QTY|QUANTITY|RATE|UNIT RATE|UOM|UNITS?|LOCATION|ROOM|AREA|DESCRIPTION|COMMENTS?|COST|TOTAL|AMOUNT|HOURS|HRS)$/
const sentence = (d: string) => (d === d.toUpperCase() ? d.charAt(0) + d.slice(1).toLowerCase() : d).replace(/:(\S)/, ': $1')
const title = (t: string) => t.toLowerCase().replace(/\b(ppr|whqs)\b/g, m => m.toUpperCase()).replace(/\b[a-z]/g, c => c.toUpperCase())

export interface PdfRead extends ParsedBoq { columnCheck: { stream: string; sheet: number; read: number }[] }

export function readPdfSchedule(pages: PdfPage[]): PdfRead | null {
  // ---- header row
  let hp = -1, headY = 0
  for (let i = 0; i < pages.length && hp < 0; i++) {
    const code = pages[i].items.find(t => /^(CODE|SOR( CODE)?)$/.test(U(t.s)))
    if (!code) continue
    const near = pages[i].items.filter(t => Math.abs(t.y - code.y) <= 4).map(t => U(t.s))
    if (near.some(s => /^(QTY|QUANTITY)$/.test(s)) && near.some(s => /RATE/.test(s)) && near.some(s => /DESCRIPTION/.test(s))) { hp = i; headY = code.y }
  }
  if (hp < 0) return null
  const head = pages[hp].items.filter(t => Math.abs(t.y - headY) <= 4).sort((a, b) => a.x - b.x)
  const hx = (re: RegExp) => head.find(t => re.test(U(t.s)))?.x ?? null
  const X = {
    prop: hx(/^(NUMBER|NO\.?|PLOT|HOUSE|UNIT NO\.?)$/), code: hx(/^(CODE|SOR( CODE)?)$/)!, qty: hx(/^(QTY|QUANTITY)$/)!, rate: hx(/^(UNIT )?RATE$/)!,
    unit: hx(/^(UOM|UNITS?)$/), loc: hx(/^(LOCATION|ROOM|AREA)$/), desc: hx(/^DESCRIPTION$/)!, cost: hx(/^(COST|TOTAL|AMOUNT)$/), hours: hx(/^(HOURS|HRS)$/),
  }
  const streams = head.filter(t => !KNOWN.test(U(t.s)) && t.x > X.desc).map(t => ({ name: title(U(t.s)), x: t.x }))
  const firstMoney = Math.min(...[...streams.map(s => s.x), X.cost ?? Infinity, X.hours ?? Infinity]) - 6
  // description column's real left edge = most common start position right of location
  const fromX = (X.loc ?? X.rate) + 14
  const starts = new Map<number, number>()
  for (const p of pages) for (const t of p.items) if (t.x > fromX && t.x < firstMoney && !isNum(t.s)) starts.set(Math.round(t.x), (starts.get(Math.round(t.x)) ?? 0) + 1)
  const descLeft = [...starts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? X.desc
  const qtyRateMid = (X.qty + X.rate) / 2
  const nearestStream = (x: number) => streams.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b), streams[0])

  // ---- column totals printed above the header (used to check the read)
  const sheetTotals = new Map<string, number>()
  if (streams.length) for (const t of pages[hp].items) if (t.y < headY - 12 && t.x >= firstMoney && (X.hours == null || t.x < X.hours - 8)) { const v = amount(t.s); if (v != null) sheetTotals.set(nearestStream(t.x).name, v) }
  let ref = ''
  for (const t of pages[hp].items) if (t.y < headY && /^(SITE|SCHEME|CONTRACT)$/i.test(t.s.trim())) ref = pages[hp].items.filter(o => Math.abs(o.y - t.y) < 3 && o.x > t.x).sort((a, b) => a.x - b.x).map(o => o.s).join(' ')

  // ---- lines: anchor on the SoR code; everything else belongs to the code it sits beside
  const lines: ParsedLine[] = []
  pages.forEach((p, pi) => {
    const body = p.items.filter(t => pi !== hp || t.y > headY + 4)
    const isCode = (t: Tok) => t.x >= X.code - 12 && t.x < X.qty - 4 && /[A-Z]/i.test(t.s) && /^[0-9A-Z]{3,10}$/i.test(t.s) && !(X.prop != null && Math.abs(t.x - X.prop) < 6)
    const codes = body.filter(isCode).sort((a, b) => a.y - b.y)
    codes.forEach((c, i) => {
      const top = i ? (codes[i - 1].y + c.y) / 2 : c.y - 12, bot = i < codes.length - 1 ? (c.y + codes[i + 1].y) / 2 : c.y + 12
      const mine = body.filter(t => t !== c && t.y > top && t.y <= bot)
      const inX = (a: number, b: number) => mine.filter(t => t.x >= a && t.x < b).sort((m, n) => m.y - n.y || m.x - n.x)
      const prop = X.prop != null ? mine.find(t => t.x < c.x - 4 && /^\d{1,4}[A-Z]?$/i.test(t.s))?.s ?? '' : ''
      const qty = amount(inX(X.qty - 10, qtyRateMid).find(t => isNum(t.s))?.s ?? '')
      const rate = amount(inX(qtyRateMid, (X.loc ?? descLeft) - 12).find(t => isNum(t.s))?.s ?? '')
      const unit = X.unit != null ? inX(X.unit - 6, X.unit + 30).map(t => t.s).join(' ') : ''
      const location = X.loc != null ? inX(X.loc - 14, descLeft - 3).map(t => t.s).join(' ') : ''
      const description = sentence(inX(descLeft - 3, firstMoney).map(t => t.s).join(' ').replace(/\s+/g, ' '))
      let workstream = '', cost: number | null = null
      for (const t of inX(firstMoney, X.hours != null ? X.hours - 8 : Infinity)) { const v = amount(t.s); if (v != null && v !== 0) { cost = v; workstream = streams.length ? nearestStream(t.x).name : ''; break } }
      if (X.cost != null && !streams.length) cost = amount(inX(X.cost - 20, (X.hours ?? Infinity) - 8).find(t => isNum(t.s))?.s ?? '')
      const hours = X.hours != null ? amount(inX(X.hours - 8, Infinity).find(t => isNum(t.s))?.s ?? '') : null
      const issues: string[] = []
      if (rate == null) issues.push('no rate'); if (qty == null) issues.push('no qty')
      if (qty != null && rate != null && cost != null) { const calc = Math.round(qty * rate * 100 + 1e-7) / 100; if (Math.abs(calc - cost) > 0.005) issues.push(`document cost £${cost.toFixed(2)} ≠ qty × rate £${calc.toFixed(2)}`) }
      lines.push({ include: true, code: c.s, room: tidyLocation(location) || 'General', description: description || c.s, qty, unit, rate, cost, property: prop, workstream, hours, note: '', issues })
    })
  })
  if (lines.length < 3) return null
  // ---- trust check: most lines must add up, or this isn't a layout we understand
  const good = lines.filter(l => l.qty != null && l.rate != null && l.cost != null && !l.issues.length).length
  if (good / lines.length < 0.8) return null
  // …and the words must come through too: a read that gets the money right but loses the descriptions is a
  // layout we don't understand (e.g. room-heading BoQs) — hand it to the AI rather than half-read it
  const described = lines.filter(l => l.description && l.description !== l.code && l.description.replace(/[^a-z]/gi, '').length >= 6).length
  if (described / lines.length < 0.9) return null
  const read = new Map<string, number>()
  for (const l of lines) if (l.workstream && l.cost != null) read.set(l.workstream, Math.round(((read.get(l.workstream) ?? 0) + l.cost) * 100) / 100)
  const columnCheck = [...sheetTotals.entries()].filter(([, v]) => v > 0).map(([stream, sheet]) => ({ stream, sheet, read: read.get(stream) ?? 0 }))
  return { ref, lines, truncated: false, columnCheck }
}
