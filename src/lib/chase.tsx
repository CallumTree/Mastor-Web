/**
 * Ball in court: who each VO and valuation is waiting on, for how long, and whether it's late.
 * Pure functions (pass `now`) so they're easy to test.
 */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { valTotals, valRef } from './valuation'
import { money, ukDate } from './format'

export type Tone = 'ok' | 'due' | 'late' | 'done'
export interface Court { who: 'us' | 'client' | 'none'; text: string; tone: Tone; days?: number }
const DAY = 86_400_000
export const VO_CHASE_AMBER = 7, VO_CHASE_RED = 14
export const termsOf = (job: Job) => (job.paymentTermsDays && job.paymentTermsDays > 0 ? job.paymentTermsDays : 30)
const daysSince = (t: number, now: number) => Math.floor((now - t) / DAY)

export function voCourt(v: Variation, vals: Valuation[], now = Date.now()): Court {
  if (v.status === 'Rejected') return { who: 'none', text: 'Rejected', tone: 'done' }
  if (v.valuationId) {
    const val = vals.find(x => x.id === v.valuationId)
    return { who: 'none', text: val ? `Claimed in ${valRef(val.number)}` : 'Claimed', tone: 'done' }
  }
  if (v.rate == null || v.qty == null) return { who: 'us', text: v.rate == null ? 'Price it' : 'Measure it', tone: daysSince(v.dateRaised, now) > 7 ? 'due' : 'ok' }
  if (v.status === 'Identified') {
    if (!v.submittedAt) return { who: 'us', text: 'Send to client for instruction', tone: 'due' }
    const d = daysSince(v.submittedAt, now)
    return { who: 'client', text: `Awaiting instruction · ${d} day${d === 1 ? '' : 's'}`, days: d, tone: d >= VO_CHASE_RED ? 'late' : d >= VO_CHASE_AMBER ? 'due' : 'ok' }
  }
  if (v.status === 'Instructed') return { who: 'us', text: 'Instructed — do the work', tone: 'ok' }
  return { who: 'us', text: 'Complete — tick into a valuation', tone: 'due' }
}

/** Terms run from the invoice date once invoiced, otherwise from the valuation issue date. */
export function dueAt(val: Valuation, job: Job) { const from = val.invoiceDate ?? val.issuedAt; return from ? from + termsOf(job) * DAY : null }

export function valCourt(val: Valuation, job: Job, scope: ScopeItem[], vos: Variation[], now = Date.now()): Court & { owed: number } {
  if (val.status === 'Open') return { who: 'us', text: 'Open — review and issue', tone: 'ok', owed: 0 }
  const net = valTotals(job, val.id, scope, vos).gross
  // once a VAT invoice is raised, what's owed is the invoice total (net + VAT)
  const p = (x: number) => Math.round(x * 100 + 1e-7) / 100
  const gross = val.invoiceNumber ? p(net + p(net * (val.invoiceVatRate ?? 20) / 100)) : net   // same rounding as the invoice
  const paid = val.paidAmount ?? 0
  const owed = Math.max(0, Math.round((gross - paid) * 100) / 100)
  if (val.paidAt && owed < 0.01) return { who: 'none', text: `Paid ${ukDate(val.paidAt)}`, tone: 'done', owed: 0 }
  const due = dueAt(val, job)!
  const left = Math.ceil((due - now) / DAY)
  const prefix = val.paidAt ? `Part paid · ${money(owed)} outstanding · ` : ''
  if (left < 0) return { who: 'client', text: `${prefix}Overdue ${-left} day${left === -1 ? '' : 's'}`, tone: 'late', days: -left, owed }
  if (left <= 7) return { who: 'client', text: `${prefix}Due ${left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}`, tone: 'due', days: left, owed }
  return { who: 'client', text: `${prefix}Due ${ukDate(due)}`, tone: 'ok', days: left, owed }
}

export const toneColour: Record<Tone, string> = { ok: 'var(--ink-muted)', due: 'var(--amber)', late: 'var(--red)', done: 'var(--green)' }
export function CourtLine({ c }: { c: Court }) {
  const who = c.who === 'client' ? 'With client' : c.who === 'us' ? 'With us' : ''
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: toneColour[c.tone], display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: toneColour[c.tone], flex: 'none' }} />
      {who && <span style={{ letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 10 }}>{who} ·</span>}
      <span>{c.text}</span>
    </div>
  )
}
