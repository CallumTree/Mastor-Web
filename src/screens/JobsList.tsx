import { Wordmark } from '../components/Wordmark'
import { WORK_LABEL, type DiaryEntry, type Job, type ScopeItem, type Variation, type WorkOrder } from '../lib/types'
import { jobWorth } from '../lib/valuation'
import { isOverdue } from './Orders'
import { money } from '../lib/format'
import { IconChart, IconCog, IconPlus } from '../components/Icons'
import { SyncBadge } from '../components/SyncBadge'
import { Plate } from '../components/Sign'
import { WeekLine } from './Plan'
import { useAccess } from '../lib/access'
import { SetupList, type SetupStep } from '../components/Setup'

/**
 * Jobs — the site board. Black head with the wordmark; every job a row with what it needs shown as
 * signs (red = blocks invoicing, yellow = needs doing). Same list on a phone and a laptop: rows on a
 * phone, a ruled schedule with columns from 1024px.
 */
export function JobsList({ jobs, scope = [], vos, orders = [], diary = [], alerts = [], setup, onOpen, onOpenLine, onToggle, onNew, onByHand, onDashboard, onSettings }: {
  jobs: Job[]; scope?: ScopeItem[]; vos: Variation[]; orders?: WorkOrder[]; diary?: DiaryEntry[]; onOpen: (j: Job) => void
  /** Mastor's own urgent items per job, for the week (office only) */
  alerts?: { jobId: string; text: string; hint: string }[]
  /** tick a to-do off from the week */
  onToggle?: (e: DiaryEntry) => void
  /** open a job on its line of days (from the week across all jobs) */
  onOpenLine?: (j: Job, tab?: string) => void; onNew: (files: File[]) => void; onByHand: () => void; onDashboard: () => void; onSettings: () => void
  /** a new firm's first steps (office only), until they're done */
  setup?: SetupStep[]
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
          {m && sorted.length > 0 ? <button onClick={onDashboard} aria-label="Money across all jobs" className="icon-btn on-dark"><IconChart size={22} /></button> : <span className="icon-gap" />}
        </div>
        <SyncBadge wrap="cover-sync" />
      </header>

      <div className="cover-body">
        {m && setup && <SetupList steps={setup} />}
        {sorted.length > 0 && <WeekLine jobs={jobs} entries={diary} alerts={alerts} onToggle={onToggle} onOpen={(id, tab) => { const j = jobs.find(x => x.id === id); if (j) (onOpenLine ? onOpenLine(j, tab) : onOpen(j)) }} />}
        {sorted.length > 0 ? (
          <section className="jobs" aria-label="Jobs">
            <div className="jobs-head" aria-hidden="true"><span>Job</span><span>Client</span><span className="num">{m ? 'Contract' : ''}</span><span>Needs</span><span>Status</span></div>
            {sorted.map(j => {
              const unpriced = vos.filter(v => v.jobId === j.id && v.rate === null && v.status !== 'Rejected').length
              return (
                <button key={j.id} className="job-row" onClick={() => onOpen(j)}>
                  <span className="jr-job"><b>{j.name}</b><small className="mono">{j.contractRef || WORK_LABEL[j.workType] || j.workType}</small></span>
                  <span className="jr-client">{j.client || '—'}</span>
                  <span className="jr-value num">{m ? (() => { const c = jobWorth(j, scope.filter(i => i.jobId === j.id), vos.filter(v => v.jobId === j.id)).contract; return c > 0 ? money(c) : '—' })() : ''}</span>
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
          <div className="cover-empty">{m ? 'No jobs yet. Add your first job to get started.' : 'No jobs yet. The office adds them; they’ll be here when they do.'}</div>
        )}
        {m && <div className="cover-actions">
          {/* New job is the file picker: what the client sent is how a job starts. No pack yet: by hand, beside it */}
          <label className="btn btn-primary"><IconPlus /> New job
            <input type="file" className="sr-only" multiple aria-label="New job: choose the client’s files" accept=".pdf,.xlsx,.xlsm,.xls,.docx,.doc,.csv,.txt,application/pdf"
              onChange={e => { const f = [...(e.target.files ?? [])]; if (f.length) onNew(f); e.target.value = '' }} />
          </label>
          <button className="linkish tap new-hand" onClick={onByHand}>Set it up by hand</button>
        </div>}
      </div>
    </main>
  )
}
