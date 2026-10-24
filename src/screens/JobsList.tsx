import { Wordmark } from '../components/Wordmark'
import type { Job, Variation, WorkOrder } from '../lib/types'
import { isOverdue } from './Orders'
import { money } from '../lib/format'
import { IconChart, IconCog, IconPlus, IconScope } from '../components/Icons'
import { SyncBadge } from '../components/SyncBadge'
import { Plate } from '../components/Sign'
import { useAccess } from '../lib/access'

/**
 * Jobs — the site board. Black head with the wordmark; every job a row with what it needs shown as
 * signs (red = blocks invoicing, yellow = needs doing). Same list on a phone and a laptop: rows on a
 * phone, a ruled schedule with columns from 1024px.
 */
export function JobsList({ jobs, vos, orders = [], onOpen, onNew, onDashboard, onSettings, onRates }: {
  jobs: Job[]; vos: Variation[]; orders?: WorkOrder[]; onOpen: (j: Job) => void; onNew: () => void; onDashboard: () => void; onSettings: () => void; onRates: () => void
}) {
  const sorted = [...jobs].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'Active' ? -1 : 1))
  const active = sorted.filter(j => j.status === 'Active').length
  const { money: m } = useAccess()

  return (
    <main className="cover">
      <header className="cover-head">
        <div className="cover-head-in">
          <button onClick={onSettings} aria-label="Settings" className="icon-btn on-dark"><IconCog size={22} /></button>
          <div className="cover-mark">
            <h1 className="sr-only">Mastor — your jobs</h1>
            <Wordmark />
            <div className="cover-sub">{sorted.length ? `${active} active job${active === 1 ? '' : 's'}` : 'Site · Variations · Valuations'}</div>
          </div>
          {m && sorted.length > 0 ? <button onClick={onDashboard} aria-label="Director dashboard" className="icon-btn on-dark"><IconChart size={22} /></button> : <span className="icon-gap" />}
        </div>
        <div className="cover-sync"><SyncBadge /></div>
      </header>

      <div className="cover-body">
        {sorted.length > 0 ? (
          <section className="jobs" aria-label="Jobs">
            <div className="jobs-head" aria-hidden="true"><span>Job</span><span>Client</span><span className="num">{m ? 'Contract' : ''}</span><span>Needs</span><span>Status</span></div>
            {sorted.map(j => {
              const unpriced = vos.filter(v => v.jobId === j.id && v.rate === null && v.status !== 'Rejected').length
              return (
                <button key={j.id} className="job-row" onClick={() => onOpen(j)}>
                  <span className="jr-job"><b>{j.name}</b><small className="mono">{j.contractRef || j.workType}</small></span>
                  <span className="jr-client">{j.client || '—'}</span>
                  <span className="jr-value num">{m ? (j.contractValue > 0 ? money(j.contractValue) : '—') : ''}</span>
                  <span className="jr-needs">
                    {m && !j.poNumber && <Plate kind="stop">No PO</Plate>}
                    {(() => { const late = orders.filter(o => o.jobId === j.id && isOverdue(o)).length; return late ? <Plate kind="stop">{late} overdue order{late === 1 ? '' : 's'}</Plate> : null })()}
                    {j.kind === 'orders' && <Plate kind="wait">{orders.filter(o => o.jobId === j.id && o.status === 'open').length} open orders</Plate>}
                    {m && unpriced > 0 && <Plate kind="warn">{unpriced} unpriced VO{unpriced === 1 ? '' : 's'}</Plate>}
                  </span>
                  <span className="jr-status"><span className={'badge ' + (j.status === 'Active' ? 'b-slate' : 'b-quiet')}>{j.status}</span></span>
                </button>
              )
            })}
          </section>
        ) : (
          <div className="cover-empty">No jobs yet. Add your first job to get started.</div>
        )}
        <div className="cover-actions">
          {m && <button className="btn btn-secondary" onClick={onRates}><IconScope /> Schedule of rates</button>}
          <button className="btn btn-primary" onClick={onNew}><IconPlus /> New job</button>
        </div>
      </div>
    </main>
  )
}
