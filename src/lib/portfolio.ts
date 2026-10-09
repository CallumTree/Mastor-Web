/** Director-level figures across every job. Pure functions — no storage, easy to test. */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { upliftFactor } from './format'
import { lineValue, valTotals } from './valuation'
import { valCourt } from './chase'
import { registerSummary, VO_GROUP_SHORT } from './voRegister'

export interface JobFigures {
  job: Job
  target: number        // PO value (all-in) if set, else BoQ × uplifts
  variations: number    // priced, non-rejected VOs incl. uplifts
  revised: number       // target + variations
  certified: number     // issued valuations
  inValuation: number   // current open valuation
  remaining: number     // still to claim
  unpricedVos: number
}

export interface Portfolio {
  jobs: JobFigures[]
  active: number
  revised: number; certified: number; inValuation: number; pipeline: number; variations: number; unpricedVos: number
  certifiedThisYear: number
  paidThisYear: number; owed: number; overdue: number; overdueCount: number
  byMonth: { label: string; value: number }[]   // certified per month, this year
  /** Variations in the same groups as each job's register (so the two always agree), valued incl. uplifts. */
  voGroups: { key: string; label: string; value: number; count: number; unpriced: number }[]
}

export function portfolio(jobs: Job[], scope: ScopeItem[], vos: Variation[], vals: Valuation[], now = new Date()): Portfolio {
  const figures: JobFigures[] = jobs.map(job => {
    const f = upliftFactor(job.uplift1, job.uplift2)
    const js = scope.filter(s => s.jobId === job.id)
    const jv = vos.filter(v => v.jobId === job.id)
    const jvals = vals.filter(v => v.jobId === job.id)
    const target = job.contractValue > 0 ? job.contractValue : js.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) * f
    const variations = jv.filter(v => v.status !== 'Rejected').reduce((t, v) => t + lineValue(v.qty, v.rate), 0) * f
    const certified = jvals.filter(v => v.status === 'Issued').reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
    const open = jvals.find(v => v.status === 'Open')
    const inValuation = open ? valTotals(job, open.id, scope, vos).gross : 0
    const revised = target + variations
    return { job, target, variations, revised, certified, inValuation, remaining: Math.max(0, revised - certified - inValuation),
      unpricedVos: registerSummary(job, jv, jvals, now.getTime()).unpriced }
  })
  const activeFigs = figures.filter(x => x.job.status === 'Active')
  const sum = (xs: JobFigures[], k: keyof Omit<JobFigures, 'job'>) => xs.reduce((t, x) => t + (x[k] as number), 0)

  const year = now.getFullYear()
  const months = Array.from({ length: now.getMonth() + 1 }, (_, m) => ({ label: new Date(year, m, 1).toLocaleDateString('en-GB', { month: 'short' }), value: 0 }))
  for (const v of vals) {
    if (v.status !== 'Issued' || !v.issuedAt) continue
    const d = new Date(v.issuedAt)
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
    if (c.tone === 'late') { overdue += c.owed; overdueCount++ }
  }

  return {
    paidThisYear, owed, overdue, overdueCount,
    jobs: figures, active: activeFigs.length,
    revised: sum(activeFigs, 'revised'), certified: sum(figures, 'certified'), inValuation: sum(figures, 'inValuation'),
    pipeline: sum(activeFigs, 'remaining'), variations: sum(figures, 'variations'), unpricedVos: sum(figures, 'unpricedVos'),
    certifiedThisYear: months.reduce((t, m) => t + m.value, 0), byMonth: months, voGroups,
  }
}
