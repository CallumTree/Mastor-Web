/**
 * What a job is worth against what it costs. Pure functions, so they're easy to test.
 * Value = scope + live priced variations + priced dayworks, with the job's uplifts (what the client pays).
 * Costs = committed and paid costs; quotes are compared, never counted. Labour can be estimated from
 * the site diary's headcount × your day rate — always labelled as an estimate.
 * Anything unknown (unpriced lines, costs without an amount) is counted and shown, never guessed.
 */
import type { Cost, DiaryEntry, Job, ScopeItem, Variation } from './types'
import { isPriced, lineValue, pennies, upliftAmounts } from './valuation'

export interface Margin {
  base: number; value: number; unpriced: number
  committed: number; paid: number; quotes: number; unknownCosts: number
  labourDays: number; labourEstimate: number | null
  costs: number            // committed + paid + labour estimate
  margin: number; pct: number | null
}

export function labourDays(diary: DiaryEntry[]) {
  return diary.filter(d => d.type === 'day').reduce((t, d) => t + (d.labour ?? 0), 0)
}

export function jobMargin(job: Job, scope: ScopeItem[], vos: Variation[], costs: Cost[], diary: DiaryEntry[], dayRate?: number | null, dayworksValue = 0): Margin {
  const live = vos.filter(v => v.status !== 'Rejected')
  const base = pennies(scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) + live.reduce((t, v) => t + lineValue(v.qty, v.rate), 0) + dayworksValue)
  const value = upliftAmounts(base, job.uplift1, job.uplift2).gross
  const unpriced = scope.filter(i => !isPriced(i)).length + live.filter(v => !isPriced(v)).length
  const counted = costs.filter(c => c.status !== 'quote')
  const committed = pennies(counted.filter(c => c.status === 'committed').reduce((t, c) => t + (c.amount ?? 0), 0))
  const paid = pennies(counted.filter(c => c.status === 'paid').reduce((t, c) => t + (c.amount ?? 0), 0))
  const days = labourDays(diary)
  const labourEstimate = dayRate && dayRate > 0 && days > 0 ? pennies(days * dayRate) : null
  const total = pennies(committed + paid + (labourEstimate ?? 0))
  const margin = pennies(value - total)
  return {
    base, value, unpriced, committed, paid,
    quotes: costs.filter(c => c.status === 'quote').length,
    unknownCosts: counted.filter(c => c.amount == null).length,
    labourDays: days, labourEstimate, costs: total, margin,
    pct: value > 0 ? Math.round((margin / value) * 1000) / 10 : null,
  }
}

/** Per trade: what the client pays for that workstream, and each quote's margin against it. */
export interface TradeLine {
  trade: string
  base: number; value: number; lines: number; unpriced: number
  accepted: number | null          // committed + paid for this trade (null = none yet)
  quotes: { cost: Cost; marginBase: number | null; marginValue: number | null }[]
}
export function byTrade(job: Job, scope: ScopeItem[], costs: Cost[]): TradeLine[] {
  const trades = [...new Set([...scope.map(i => i.workstream).filter((x): x is string => !!x), ...costs.map(c => c.trade).filter(Boolean)])]
  return trades.map(trade => {
    const ls = scope.filter(i => i.workstream === trade)
    const base = pennies(ls.reduce((t, i) => t + lineValue(i.qty, i.rate), 0))
    const value = upliftAmounts(base, job.uplift1, job.uplift2).gross
    const tc = costs.filter(c => c.trade === trade)
    const counted = tc.filter(c => c.status !== 'quote')
    return {
      trade, base, value, lines: ls.length, unpriced: ls.filter(i => !isPriced(i)).length,
      accepted: counted.length ? pennies(counted.reduce((t, c) => t + (c.amount ?? 0), 0)) : null,
      quotes: tc.filter(c => c.status === 'quote').sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity)).map(cost => ({
        cost,
        marginBase: cost.amount != null && base > 0 ? pennies(base - cost.amount) : null,
        marginValue: cost.amount != null && value > 0 ? pennies(value - cost.amount) : null,
      })),
    }
  })
}

export const pctOf = (part: number | null, whole: number) => (part != null && whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
