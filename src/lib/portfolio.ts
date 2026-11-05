/** Director-level figures across every job. Pure functions — no storage, easy to test. */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { isCertified, isWithClient, jobWorth, valTotals } from './valuation'
import { valCourt } from './chase'
import { registerSummary, VO_GROUP_SHORT } from './voRegister'

export interface JobFigures {
  job: Job
  target: number        // PO value (all-in) if set, else BoQ × uplifts
  variations: number    // priced, non-rejected VOs incl. uplifts
  revised: number       // target + variations
  certified: number     // valuations the client agreed (isCertified)
  withClient: number    // sent, not agreed yet
  inValuation: number   // current open valuation
  remaining: number     // still to claim
  unpricedVos: number
}

export interface Portfolio {
  jobs: JobFigures[]
  active: number
  revised: number; certified: number; withClient: number; inValuation: number; pipeline: number; variations: number; unpricedVos: number
  certifiedThisYear: number
  paidThisYear: number; owed: number; overdue: number; overdueCount: number
  byMonth: { label: string; value: number }[]   // certified per month, this year (the month the client agreed it)
  /** Variations in the same groups as each job's register (so the two always agree), valued incl. uplifts. */
  voGroups: { key: string; label: string; value: number; count: number; unpriced: number }[]
}

export function portfolio(jobs: Job[], scope: ScopeItem[], vos: Variation[], vals: Valuation[], now = new Date()): Portfolio {
  const figures: JobFigures[] = jobs.map(job => {
    const js = scope.filter(s => s.jobId === job.id)
    const jv = vos.filter(v => v.jobId === job.id)
    const jvals = vals.filter(v => v.jobId === job.id)
    // the same worth as the job's own Vals and Home (jobWorth), so the director's figures and the job's agree
    const worth = jobWorth(job, js, jv)
    const target = worth.contract, variations = worth.vos
    const sum = (vs: Valuation[]) => vs.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
    const certified = sum(jvals.filter(isCertified)), withClient = sum(jvals.filter(isWithClient))
    const open = jvals.find(v => v.status === 'Open')
    const inValuation = open ? valTotals(job, open.id, scope, vos).gross : 0
    const revised = worth.total
    return { job, target, variations, revised, certified, withClient, inValuation, remaining: Math.max(0, revised - certified - withClient - inValuation),
      unpricedVos: registerSummary(job, jv, jvals, now.getTime()).unpriced }
  })
  const activeFigs = figures.filter(x => x.job.status === 'Active')
  const sum = (xs: JobFigures[], k: keyof Omit<JobFigures, 'job'>) => xs.reduce((t, x) => t + (x[k] as number), 0)

  const year = now.getFullYear()
  const months = Array.from({ length: now.getMonth() + 1 }, (_, m) => ({ label: new Date(year, m, 1).toLocaleDateString('en-GB', { month: 'short' }), value: 0 }))
  for (const v of vals) {
    if (!isCertified(v)) continue
    const at = v.review?.agreedAt ?? v.invoiceDate ?? v.issuedAt   // certified when the client agreed it (older ones: when sent)
    if (!at) continue
    const d = new Date(at)
    if (d.getFullYear() !== year) continue
    const job = jobs.find(j => j.id === v.jobId); if (!job) continue
    months[d.getMonth()].value += valTotals(job, v.id, scope, vos).gross
  }

  const voGroups = Object.keys(VO_GROUP_SHORT).map(key => ({ key, label: VO_GROUP_SHORT[key], value: 0, count: 0, unpriced: 0 }))
  for (const job of jobs) {
    const jv = vos.filter(v => v.jobId === job.id); if (!jv.length) continue
    for (const r of registerSummary(job, jv, vals.filter(v => v.jobId === job.id), now.getTime()).rows) {
      const g = voGroups.find(x => x.key === r.key)!
      g.value += r.gross; g.count += r.count; g.unpriced += r.unpriced
    }
  }

  let paidThisYear = 0, owed = 0, overdue = 0, overdueCount = 0
  for (const v of vals) {
    const job = jobs.find(j => j.id === v.jobId); if (!job || v.status !== 'Issued') continue
    if (v.paidAt && new Date(v.paidAt).getFullYear() === year) paidThisYear += v.paidAmount ?? 0
    const c = valCourt(v, job, scope, vos, now.getTime())
    owed += c.owed
    if (c.tone === 'late' && !c.review) { overdue += c.owed; overdueCount++ }   // a review running long is chased, not money overdue
  }

  return {
    paidThisYear, owed, overdue, overdueCount,
    jobs: figures, active: activeFigs.length,
    revised: sum(activeFigs, 'revised'), certified: sum(figures, 'certified'), withClient: sum(figures, 'withClient'), inValuation: sum(figures, 'inValuation'),
    pipeline: sum(activeFigs, 'remaining'), variations: sum(figures, 'variations'), unpricedVos: sum(figures, 'unpricedVos'),
    certifiedThisYear: months.reduce((t, m) => t + m.value, 0), byMonth: months, voGroups,
  }
}
