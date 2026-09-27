/** Director-level figures across every job. Pure functions — no storage, easy to test. */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { upliftFactor } from './format'
import { lineValue, valTotals } from './valuation'

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
  byMonth: { label: string; value: number }[]   // certified per month, this year
  voByStatus: { status: string; value: number; count: number }[]
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
      unpricedVos: jv.filter(v => v.rate == null && v.status !== 'Rejected').length }
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

  const statuses = ['Identified', 'Instructed', 'Complete', 'Rejected'] as const
  const voByStatus = statuses.map(status => {
    const list = vos.filter(v => v.status === status && jobs.some(j => j.id === v.jobId))
    const value = list.reduce((t, v) => { const j = jobs.find(x => x.id === v.jobId)!; return t + lineValue(v.qty, v.rate) * upliftFactor(j.uplift1, j.uplift2) }, 0)
    return { status, value, count: list.length }
  })

  return {
    jobs: figures, active: activeFigs.length,
    revised: sum(activeFigs, 'revised'), certified: sum(figures, 'certified'), inValuation: sum(figures, 'inValuation'),
    pipeline: sum(activeFigs, 'remaining'), variations: sum(figures, 'variations'), unpricedVos: sum(figures, 'unpricedVos'),
    certifiedThisYear: months.reduce((t, m) => t + m.value, 0), byMonth: months, voByStatus,
  }
}
