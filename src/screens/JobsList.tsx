import { Wordmark } from '../components/Wordmark'
import type { Job, Variation } from '../lib/types'
import { money } from '../lib/format'
import { IconChart, IconCog, IconPlus } from '../components/Icons'
import { SyncBadge } from '../components/SyncBadge'
import { Plate } from '../components/Sign'

/**
 * Jobs — the site board. Black head with the wordmark; every job a row with what it needs shown as
 * signs (red = blocks invoicing, yellow = needs doing). Same list on a phone and a laptop: rows on a
 * phone, a ruled schedule with columns from 1024px.
 */
export function JobsList({ jobs, vos, onOpen, onNew, onDashboard, onSettings }: {
  jobs: Job[]; vos: Variation[]; onOpen: (j: Job) => void; onNew: () => void; onDashboard: () => void; onSettings: () => void
}) {
  const sorted = [...jobs].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'Active' ? -1 : 1))
  const active = sorted.filter(j => j.status === 'Active').length

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
          {sorted.length > 0 ? <button onClick={onDashboard} aria-label="Director dashboard" className="icon-btn on-dark"><IconChart size={22} /></button> : <span className="icon-gap" />}
        </div>
        <div className="cover-sync"><SyncBadge /></div>
      </header>

      <div className="cover-body">
        {sorted.length > 0 ? (
          <section className="jobs" aria-label="Jobs">
            <div className="jobs-head" aria-hidden="true"><span>Job</span><span>Client</span><span className="num">Contract</span><span>Needs</span><span>Status</span></div>
            {sorted.map(j => {
              const unpriced = vos.filter(v => v.jobId === j.id && v.rate === null && v.status !== 'Rejected').length
              return (
                <button key={j.id} className="job-row" onClick={() => onOpen(j)}>
                  <span className="jr-job"><b>{j.name}</b><small className="mono">{j.contractRef || j.workType}</small></span>
                  <span className="jr-client">{j.client || '—'}</span>
                  <span className="jr-value num">{j.contractValue > 0 ? money(j.contractValue) : '—'}</span>
                  <span className="jr-needs">
                    {!j.poNumber && <Plate kind="stop">No PO</Plate>}
                    {unpriced > 0 && <Plate kind="warn">{unpriced} unpriced VO{unpriced === 1 ? '' : 's'}</Plate>}
                  </span>
                  <span className="jr-status"><span className={'badge ' + (j.status === 'Active' ? 'b-green' : 'b-slate')}>{j.status}</span></span>
                </button>
              )
            })}
          </section>
        ) : (
          <div className="cover-empty">No jobs yet. Add your first job to get started.</div>
        )}
        <div className="cover-actions"><button className="btn btn-primary" onClick={onNew}><IconPlus /> New job</button></div>
      </div>
    </main>
  )
}
