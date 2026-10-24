import { portfolio } from '../src/lib/portfolio'
import { registerSummary } from '../src/lib/voRegister'
import type { Job, ScopeItem, Valuation, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const job = (id: string, cv: number, status: 'Active' | 'Complete' = 'Active'): Job => ({ id, name: id, client: '', address: '', contractRef: '', poNumber: 'P', contractValue: cv, uplift1: 10, uplift2: 0, workType: 'PPR', status, photoId: null, createdAt: 0 })
const s = (id: string, jobId: string, qty: number, rate: number, valuationId: string | null): ScopeItem => ({ id, jobId, code: '', description: '', room: 'K', qty, unit: 'nr', rate, valuationId, order: 1, createdAt: 0 })
const now = new Date(2026, 8, 20)
const jobs = [job('A', 1100), job('B', 0), job('C', 500, 'Complete')]
const scope = [s('a1', 'A', 1, 400, 'vA1'), s('a2', 'A', 1, 200, 'vA2'), s('a3', 'A', 1, 400, null), s('b1', 'B', 2, 100, null), s('c1', 'C', 1, 454.55, 'vC1')]
const vals: Valuation[] = [
  { id: 'vA1', jobId: 'A', number: 1, status: 'Issued', createdAt: 0, issuedAt: new Date(2026, 2, 5).getTime() },
  { id: 'vA2', jobId: 'A', number: 2, status: 'Open', createdAt: 0, issuedAt: null },
  { id: 'vC1', jobId: 'C', number: 1, status: 'Issued', createdAt: 0, issuedAt: new Date(2025, 11, 1).getTime() },
]
const vos: Variation[] = [
  { id: 'o1', jobId: 'A', number: 1, description: '', room: '', qty: 2, unit: 'm', rate: 50, code: '', reason: '', clientRef: '', status: 'Instructed', photoIds: [], dateRaised: 0, valuationId: null },
  { id: 'o2', jobId: 'A', number: 2, description: '', room: '', qty: null, unit: 'm', rate: null, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 0, valuationId: null },
]
const p = portfolio(jobs, scope, vos, vals, now)
const A = p.jobs.find(j => j.job.id === 'A')!
const close = (a: number, b: number) => Math.abs(a - b) < 0.005
ok(close(A.certified, 440), `job A certified £440 (400 + 10%) — got ${A.certified}`)
ok(close(A.inValuation, 220), 'job A open valuation £220')
ok(close(A.variations, 110), 'job A priced VO £110 incl. uplift; unpriced one excluded')
ok(close(A.remaining, 1100 + 110 - 440 - 220), 'job A remaining = PO + VOs − certified − in valuation')
ok(close(p.jobs.find(j => j.job.id === 'B')!.target, 220), 'job with no PO value falls back to BoQ × uplifts')
ok(p.active === 2, 'complete job not counted as active')
ok(close(p.certifiedThisYear, 440), 'certified this year excludes last year’s valuation')
ok(close(p.byMonth[2].value, 440) && p.byMonth.length === 9, 'lands in March; months Jan→Sep')
ok(p.unpricedVos === 1, 'counts unpriced VOs')
const g = (k: string) => p.voGroups.find(x => x.key === k)!
ok(close(g('instructed').value, 110) && g('instructed').count === 1, 'dashboard VO groups valued incl. uplifts')
ok(g('awaiting').count === 1 && g('awaiting').unpriced === 1 && g('awaiting').value === 0, 'unpriced VO counted in its group, not valued')
const regA = registerSummary(jobs[0], vos, vals.filter(v => v.jobId === 'A'), now.getTime())
ok(regA.rows.every(r => g(r.key).count === r.count), 'dashboard groups match the job’s Variation Register exactly')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
