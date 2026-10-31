/**
 * How much time Mastor could give back: the visitor's own workload against how long each task takes
 * now and with Mastor. Everything per job is multiplied by the jobs they have on the go, so every count
 * reads the way a builder would say it ("20 days on site a month, on each job"). Every number is an
 * estimate, shown and editable. Nothing is claimed as measured.
 */
import { useState, type ReactNode } from 'react'

interface Task { id: string; what: string; per: string; perJob: boolean; often: string; now: string; after: string; why: string }

/** Our estimates (minutes), to be replaced with measured pilot figures. */
export const JOBS = '2'
export const TASKS: Task[] = [
  { id: 'diary', what: 'Writing up the site diary', per: 'days on site a month, each job', perJob: true, often: '20', now: '20', after: '5', why: 'Voice notes are written out for you and the weather fills itself in.' },
  { id: 'val', what: 'Building a valuation', per: 'valuations a month, each job', perJob: true, often: '1', now: '180', after: '30', why: 'Tick what’s done. Uplifts, totals and the QS checks are worked out.' },
  { id: 'vo', what: 'Logging and pricing a VO', per: 'VOs a month, each job', perJob: true, often: '3', now: '30', after: '10', why: 'Raised from the photo or voice note, priced from your schedule, on the register.' },
  { id: 'inv', what: 'Raising the invoice', per: 'invoices a month, each job', perJob: true, often: '1', now: '25', after: '5', why: 'Made from the issued valuation on your own numbering, out to Xero or QuickBooks.' },
  { id: 'chase', what: 'Working out who owes what', per: 'times a week, all jobs', perJob: false, often: '1', now: '60', after: '15', why: 'Owed, overdue and whose court each VO is in, across every job, on one screen.' },
]

const WEEKS_A_MONTH = 52 / 12
const num = (v: string) => { const x = Number(v.replace(',', '.')); return Number.isFinite(x) && x >= 0 ? x : 0 }
const hrs = (min: number) => Math.round(min / 6) / 10   // one decimal place
const typed = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 6)   // numbers only, as typed (so "1." can become "1.5")

export function Forecast({ aside }: { aside?: ReactNode }) {
  const [jobs, setJobs] = useState(JOBS)
  const [tasks, setTasks] = useState(TASKS)
  const set = (id: string, k: 'often' | 'now' | 'after', v: string) => setTasks(ts => ts.map(t => (t.id === id ? { ...t, [k]: typed(v) } : t)))
  const times = (t: Task) => num(t.often) * (t.perJob ? num(jobs) : WEEKS_A_MONTH)   // how many times a month, across the firm
  const saved = (t: Task) => Math.max(0, num(t.now) - num(t.after)) * times(t)
  const month = tasks.reduce((s, t) => s + saved(t), 0)
  const changed = jobs !== JOBS || tasks.some((t, i) => t.often !== TASKS[i].often || t.now !== TASKS[i].now || t.after !== TASKS[i].after)

  return (
    <div className="forecast">
      <div className="fc-side">
        <div className="fc-sum" aria-live="polite">
          <div className="fc-head"><span className="fc-label">Back each month · estimated</span><span className="fc-big">{hrs(month)} hours</span></div>
          <div className="fc-row">
            <div><span className="fc-label">Each year</span><span className="fc-val">{Math.round(month * 12 / 60)} hours</span></div>
            <div><span className="fc-label">Working days a year</span><span className="fc-val">{Math.round(month * 12 / 60 / 8)} days</span></div>
          </div>
        </div>
        <p className="fc-note">
          These are our estimates, not measurements. Put in your own numbers.{changed && <> <button type="button" className="fc-reset" onClick={() => { setJobs(JOBS); setTasks(TASKS) }}>Back to our estimates</button></>}
        </p>
        {aside}
      </div>
      <div>
        <label className="fc-jobs">
          <span><b>Jobs on the go</b><small>Running at the same time. Everything “each job” below is multiplied by this.</small></span>
          <input inputMode="decimal" value={jobs} onChange={e => setJobs(typed(e.target.value))} />
        </label>
        <div className="fc-table" role="table" aria-label="Time per task, now and with Mastor">
          <div className="fc-tr fc-th" role="row">
            <span role="columnheader">Task</span><span role="columnheader">How often</span><span role="columnheader">Now, minutes</span><span role="columnheader">With Mastor</span><span role="columnheader" className="r">Back a month</span>
          </div>
          {tasks.map(t => (
            <div className="fc-tr" role="row" key={t.id}>
              <span role="cell" className="fc-task"><b>{t.what}</b><small>{t.why}</small></span>
              <span role="cell"><label className="fc-in"><input inputMode="decimal" value={t.often} onChange={e => set(t.id, 'often', e.target.value)} aria-label={`${t.what}: ${t.per}`} /><small>{t.per}</small></label></span>
              <span role="cell"><label className="fc-in"><input inputMode="decimal" value={t.now} onChange={e => set(t.id, 'now', e.target.value)} aria-label={`${t.what}: minutes each time now`} /><small>min each time now</small></label></span>
              <span role="cell"><label className="fc-in"><input inputMode="decimal" value={t.after} onChange={e => set(t.id, 'after', e.target.value)} aria-label={`${t.what}: minutes each time with Mastor`} /><small>min with Mastor</small></label></span>
              <span role="cell" className="fc-saved r"><span className="fc-saved-l">Back a month: </span>{hrs(saved(t))} h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
