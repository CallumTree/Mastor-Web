/**
 * How much time Mastor could give back: the visitor's own workload against how long each job takes
 * now and with Mastor. Every number is an estimate, shown and editable. Nothing is claimed as measured.
 */
import { useState } from 'react'

interface Task { id: string; what: string; per: string; often: number; now: number; after: number; why: string }

/** Our estimates (minutes), to be replaced with measured pilot figures. */
export const TASKS: Task[] = [
  { id: 'diary', what: 'Writing up the site diary', per: 'site days a month', often: 40, now: 20, after: 5, why: 'Voice notes are written out for you and the weather fills itself in.' },
  { id: 'val', what: 'Building a valuation', per: 'valuations a month', often: 2, now: 180, after: 30, why: 'Tick what’s done. Uplifts, totals and the QS checks are worked out.' },
  { id: 'vo', what: 'Logging and pricing a VO', per: 'VOs a month', often: 6, now: 30, after: 10, why: 'Raised from the photo or voice note, priced from your schedule, on the register.' },
  { id: 'inv', what: 'Raising the invoice', per: 'invoices a month', often: 2, now: 25, after: 5, why: 'Made from the issued valuation on your own numbering, out to Xero or QuickBooks.' },
  { id: 'chase', what: 'Working out who owes what', per: 'weeks a month', often: 4.3, now: 60, after: 15, why: 'Owed, overdue and whose court each VO is in, across every job, on one screen.' },
]

const n = (v: string) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0 }
const hrs = (min: number) => Math.round(min / 6) / 10   // one decimal place

export function Forecast() {
  const [tasks, setTasks] = useState(TASKS)
  const set = (id: string, k: 'often' | 'now' | 'after', v: string) => setTasks(ts => ts.map(t => (t.id === id ? { ...t, [k]: n(v) } : t)))
  const saved = (t: Task) => Math.max(0, t.now - t.after) * t.often
  const month = tasks.reduce((s, t) => s + saved(t), 0)
  const changed = tasks.some((t, i) => t.often !== TASKS[i].often || t.now !== TASKS[i].now || t.after !== TASKS[i].after)

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
          These are our estimates, not measurements. Put in your own numbers.{changed && <> <button type="button" className="fc-reset" onClick={() => setTasks(TASKS)}>Back to our estimates</button></>}
        </p>
      </div>
      <div className="fc-table" role="table" aria-label="Time per task, now and with Mastor">
        <div className="fc-tr fc-th" role="row">
          <span role="columnheader">Task</span><span role="columnheader">How often</span><span role="columnheader">Now, minutes</span><span role="columnheader">With Mastor</span><span role="columnheader" className="r">Back a month</span>
        </div>
        {tasks.map(t => (
          <div className="fc-tr" role="row" key={t.id}>
            <span role="cell" className="fc-task"><b>{t.what}</b><small>{t.why}</small></span>
            <label role="cell" className="fc-in"><input inputMode="decimal" value={t.often} onChange={e => set(t.id, 'often', e.target.value)} aria-label={`${t.what}: ${t.per}`} /><small>{t.per}</small></label>
            <label role="cell" className="fc-in"><input inputMode="decimal" value={t.now} onChange={e => set(t.id, 'now', e.target.value)} aria-label={`${t.what}: minutes each now`} /><small>min each now</small></label>
            <label role="cell" className="fc-in"><input inputMode="decimal" value={t.after} onChange={e => set(t.id, 'after', e.target.value)} aria-label={`${t.what}: minutes each with Mastor`} /><small>min with Mastor</small></label>
            <span role="cell" className="fc-saved r"><span className="fc-saved-l">Back a month: </span>{hrs(saved(t))} h</span>
          </div>
        ))}
      </div>
    </div>
  )
}
