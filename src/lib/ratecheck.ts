/**
 * Check a job's BoQ rates against the company's schedule of rates.
 *
 * Client BoQs rarely carry the raw SoR rate: a framework usually applies its own adjustment (a tendered
 * percentage, or an older SoR version), so a plain "below the SoR = underpaid" would flag almost every
 * line. Instead this finds the adjustment most lines follow, then reports only what stands out:
 *   - lines that don't follow the pattern (and what they'd be at the pattern),
 *   - codes the SoR doesn't have, units that disagree, lines without a rate.
 * It never calls a line underpaid without that evidence.
 */
import type { RateBook, RateItem } from './types'

export interface CheckLine { id: string; code: string; description: string; qty: number | null; unit: string; rate: number | null }
export type CheckStatus = 'match' | 'pattern' | 'off' | 'differs' | 'unit' | 'missing' | 'norate' | 'nocode'
export interface CheckRow {
  line: CheckLine
  status: CheckStatus
  sor?: { rate: number; unit: string; book: string }
  ratio?: number        // BoQ rate ÷ SoR rate
  expected?: number     // SoR rate × the pattern, when the line breaks the pattern
  diff?: number         // (BoQ rate − expected) × qty: negative = priced below the pattern
}
export interface CheckResult {
  book: RateBook | null
  rows: CheckRow[]
  pattern: { ratio: number; lines: number } | null   // the adjustment most lines follow (1 = exact SoR)
  counts: Record<CheckStatus, number>
  below: number          // £ total of lines priced below the pattern (qty known) — 0 when there is no pattern
  above: number          // £ total of lines priced above the pattern
  boqTotal: number       // the compared lines (qty known) at the BoQ's rates…
  sorTotal: number       // …and at the SoR's rates
}

const TOL = 0.006 // half a penny either way: SoR books are rounded to the penny, BoQs often carry 4 places
const normUnit = (u: string) => u.trim().toUpperCase().replace(/^(NR|NO\.?|EA|EACH)$/, 'NO').replace(/^(ITEM|IT)$/, 'IT').replace(/^(M2|SQM)$/, 'SM').replace(/^(M|LIN M)$/, 'LM')
const round4 = (n: number) => Math.round(n * 10000) / 10000

/** The book that holds the most of these codes (ties: the one listed first). */
export function bestBook(lines: CheckLine[], books: RateBook[], items: RateItem[]): RateBook | null {
  const codes = new Set(lines.map(l => l.code.trim().toUpperCase()).filter(Boolean))
  let best: RateBook | null = null, hits = 0
  for (const b of books) {
    const n = items.reduce((t, i) => t + (i.bookId === b.id && codes.has(i.code) ? 1 : 0), 0)
    if (n > hits) { best = b; hits = n }
  }
  return best
}

export function checkRates(lines: CheckLine[], book: RateBook | null, items: RateItem[]): CheckResult {
  const byCode = new Map(items.filter(i => book && i.bookId === book.id).map(i => [i.code, i]))
  const rows: CheckRow[] = lines.map(line => {
    const code = line.code.trim().toUpperCase()
    if (!code) return { line, status: 'nocode' }
    const s = byCode.get(code)
    if (!s) return { line, status: 'missing' }
    const sor = { rate: s.rate, unit: s.unit, book: book!.name }
    if (line.rate == null) return { line, status: 'norate', sor }
    if (line.unit && s.unit && normUnit(line.unit) !== normUnit(s.unit)) return { line, status: 'unit', sor }
    if (Math.abs(line.rate - s.rate) <= TOL) return { line, status: 'match', sor, ratio: 1 }
    return { line, status: 'off', sor, ratio: s.rate ? line.rate / s.rate : undefined }
  })

  // the pattern: the adjustment shared by the most lines (to 0.1%); exact SoR counts as ratio 1
  const buckets = new Map<number, number>()
  for (const r of rows) if (r.ratio != null && (r.status === 'match' || r.status === 'off')) {
    const k = Math.round(r.ratio * 1000) / 1000
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  let pattern: CheckResult['pattern'] = null
  for (const [ratio, n] of buckets) if (!pattern || n > pattern.lines) pattern = { ratio, lines: n }
  const compared = rows.filter(r => r.status === 'match' || r.status === 'off').length
  // a pattern only counts when it is clearly the norm: at least 3 lines and half of those compared
  // (exact SoR needs no minimum: it isn't a guess)
  if (pattern && ((pattern.lines < 3 && pattern.ratio !== 1) || pattern.lines * 2 < compared)) pattern = null

  let below = 0, above = 0, boqTotal = 0, sorTotal = 0
  for (const r of rows) {
    if (r.status !== 'match' && r.status !== 'off') continue
    if (r.line.qty != null) { boqTotal += r.line.qty * r.line.rate!; sorTotal += r.line.qty * r.sor!.rate }
    // no clear pattern: say the line differs, but don't call it under- or over-priced
    if (!pattern) { if (r.status === 'off') r.status = 'differs'; continue }
    const p = pattern.ratio
    const expected = round4(r.sor!.rate * p)
    if (Math.abs(r.line.rate! - expected) <= Math.max(TOL, expected * 0.0005)) { r.status = r.status === 'match' && p === 1 ? 'match' : 'pattern'; continue }
    r.status = 'off'; r.expected = expected
    if (r.line.qty != null) {
      r.diff = Math.round((r.line.rate! - expected) * r.line.qty * 100) / 100
      if (r.diff < 0) below += -r.diff; else above += r.diff
    }
  }
  if (pattern?.ratio === 1) for (const r of rows) if (r.status === 'pattern') r.status = 'match'

  const counts = { match: 0, pattern: 0, off: 0, differs: 0, unit: 0, missing: 0, norate: 0, nocode: 0 } as Record<CheckStatus, number>
  for (const r of rows) counts[r.status]++
  const p2 = (n: number) => Math.round(n * 100) / 100
  return { book, rows, pattern, counts, below: p2(below), above: p2(above), boqTotal: p2(boqTotal), sorTotal: p2(sorTotal) }
}

/** "SoR rates exactly", "SoR −13.0%", "SoR +4.5%". */
export function patternText(p: CheckResult['pattern']) {
  if (!p) return 'no single adjustment'
  if (p.ratio === 1) return 'the SoR rates exactly'
  const pct = Math.round((p.ratio - 1) * 1000) / 10
  return `SoR ${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
}
