import type { Cost, DiaryEntry, Job, ScopeItem, Valuation, Variation, WorkOrder } from '../lib/types'
import { portfolio } from '../lib/portfolio'
import { jobMargin } from '../lib/margin'
import { valCourt, voCourt } from '../lib/chase'
import { valRef } from '../lib/valuation'
import { money } from '../lib/format'
import { TitleBlock } from '../components/Ui'
import { IconBack } from '../components/Icons'
import { Plate } from '../components/Sign'
import { isOverdue } from './Orders'

/**
 * Director dashboard: what needs doing across every job, in the order it costs you money —
 * who owes you and how late, what's ready to claim, what can't be claimed until it's priced,
 * and what each job is making. No charts: every row leads to an action.
 */
const k = (n: number) => (Math.abs(n) >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : Math.abs(n) >= 1e4 ? `£${(n / 1e3).toFixed(1)}k` : money(n).replace(/\.00$/, ''))
const signedK = (n: number) => (n < 0 ? `−${k(-n)}` : k(n))

export function Dashboard({ jobs, scope, vos, vals, costs = [], diary = [], orders = [], dayRate, onBack, onOpenJob }: {
  jobs: Job[]; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]; costs?: Cost[]; diary?: DiaryEntry[]; orders?: WorkOrder[]; dayRate?: number | null
  onBack: () => void; onOpenJob: (j: Job) => void
}) {
  const p = portfolio(jobs, scope, vos, vals)
  const active = jobs.filter(j => j.status === 'Active')
  const of = <T extends { jobId: string }>(xs: T[], j: Job) => xs.filter(x => x.jobId === j.id)

  // chase: issued valuations still owed, latest first by how late they are
  const chase = vals.filter(v => v.status === 'Issued').map(v => {
    const job = jobs.find(j => j.id === v.jobId)!
    return { v, job, c: valCourt(v, job, of(scope, job), of(vos, job)) }
  }).filter(x => x.job && x.c.owed > 0.005).sort((a, b) => (b.c.tone === 'late' ? b.c.days ?? 0 : -1) - (a.c.tone === 'late' ? a.c.days ?? 0 : -1))
  const vosWaiting = vos.filter(v => { const c = voCourt(v, of(vals, jobs.find(j => j.id === v.jobId) ?? ({ id: '' } as Job))); return c.who === 'client' && c.tone !== 'ok' })
  // claim / price: per active job
  const work = active.map(job => {
    const js = of(scope, job), jv = of(vos, job)
    const open = of(vals, job).find(v => v.status === 'Open')
    const ready = p.jobs.find(x => x.job.id === job.id)?.inValuation ?? 0
    const unpriced = js.filter(i => i.qty == null || i.rate == null).length + jv.filter(v => v.status !== 'Rejected' && (v.qty == null || v.rate == null)).length
    const lateOrders = of(orders, job).filter(o => isOverdue(o)).length
    const m = jobMargin(job, js, jv, of(costs, job), of(diary, job), dayRate)
    return { job, open, ready, unpriced, lateOrders, m, hasCosts: of(costs, job).length > 0 || m.labourEstimate != null }
  })
  const withCosts = work.filter(w => w.hasCosts)
  const marginTotal = withCosts.reduce((t, w) => t + w.m.margin, 0)
  const valueTotal = withCosts.reduce((t, w) => t + w.m.value, 0)
  const unpricedTotal = work.reduce((t, w) => t + w.unpriced, 0)

  return (
    <main className="page dash" style={{ paddingBottom: 48 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back to jobs"><IconBack size={20} /></button>
        <h1 className="tab-title grow">Needs action</h1>
      </div>

      <TitleBlock
        head={['Owed to you', money(p.owed)]}
        rows={[
          [['Overdue', p.overdueCount ? `${k(p.overdue)} · ${p.overdueCount}` : '—', p.overdueCount ? 'var(--red)' : undefined], ['Ready to claim', k(p.inValuation)]],
          [['Unpriced lines', unpricedTotal ? String(unpricedTotal) : '—'], ['Margin', withCosts.length ? `${signedK(marginTotal)}${valueTotal > 0 ? ` · ${Math.round((marginTotal / valueTotal) * 1000) / 10}%` : ''}` : '—']],
          [['Certified this year', k(p.certifiedThisYear)], ['Paid this year', k(p.paidThisYear)]],
        ]} />
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Values include uplifts.{p.unpricedVos ? ` ${p.unpricedVos} unpriced VO${p.unpricedVos === 1 ? '' : 's'} not counted until priced.` : ''}{withCosts.length && withCosts.length < work.length ? ` Margin covers the ${withCosts.length} job${withCosts.length === 1 ? '' : 's'} with costs recorded.` : ''}
      </div>

      <div className="dash-secs">
        <section>
          <h2 className="sec-h">Chase payment · {chase.length}</h2>
          {chase.length === 0 ? <div className="card empty">Nothing owed on issued valuations.</div> : (
            <div className="panel chk">
              {chase.map(({ v, job, c }) => (
                <button key={v.id} className="chk-row order-row" onClick={() => onOpenJob(job)}>
                  <span className="mono">{valRef(v.number)}</span>
                  <span className="grow">{job.name}<small>{v.invoiceNumber ? `Invoice ${v.invoiceNumber}` : 'Not invoiced yet'}</small>
                    <span className="order-plates">{c.tone === 'late' ? <Plate kind="stop">{c.text}</Plate> : c.tone === 'due' ? <Plate kind="warn">{c.text}</Plate> : <Plate kind="wait">{c.text}</Plate>}</span>
                  </span>
                  <span className="amt dash-amt">{money(c.owed)}</span>
                </button>
              ))}
            </div>
          )}
          {vosWaiting.length > 0 && <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>{vosWaiting.length} variation{vosWaiting.length === 1 ? '' : 's'} waiting on the client for instruction — chase them from each job.</div>}
        </section>

        <section>
          <h2 className="sec-h">Jobs · claim, price, margin</h2>
          {work.length === 0 ? <div className="card empty">No active jobs.</div> : (
            <div className="panel chk">
              {work.map(w => (
                <button key={w.job.id} className="chk-row order-row" onClick={() => onOpenJob(w.job)}>
                  <span className="grow">{w.job.name}<small>{w.job.contractRef || w.job.client || ''}</small>
                    <span className="order-plates">
                      {w.ready > 0 && <Plate kind="do">{k(w.ready)} ready to claim{w.open ? ` · ${valRef(w.open.number)}` : ''}</Plate>}
                      {w.unpriced > 0 && <Plate kind="warn">{w.unpriced} unpriced</Plate>}
                      {w.lateOrders > 0 && <Plate kind="stop">{w.lateOrders} overdue order{w.lateOrders === 1 ? '' : 's'}</Plate>}
                      {!w.ready && !w.unpriced && !w.lateOrders && <Plate kind="ok">Nothing waiting</Plate>}
                    </span>
                  </span>
                  <span className={'amt dash-amt' + (w.hasCosts && w.m.margin < 0 ? ' neg' : '')}>{w.hasCosts ? <>{signedK(w.m.margin)}<small>{w.m.pct != null ? `${w.m.pct}% margin` : 'margin'}</small></> : <small>No costs yet</small>}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
