import { useEffect, useMemo, useState } from 'react'
import type { DiaryEntry, Job } from '../lib/types'
import { dayKey, addDays, prettyDay } from '../lib/dates'
import { dayParts, fullDay, isOpen, jobLine, lateBy, newPlan, placeOf, shortDay, todosFor, visible, weekLine, type LineDay } from '../lib/plan'
import { useAccess } from '../lib/access'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'
import { TradeMark } from '../components/Trade'
import { ByClaude } from '../components/Sign'
import { IconChevron, IconLinkFrom, IconLinkTo } from '../components/Icons'

const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true"><path d="M5 12l5 5L19 7" /></svg>

/** A to-do's tick: the app's own tick, green once done. */
function PlanTick({ e, onToggle }: { e: DiaryEntry; onToggle: () => void }) {
  return (
    <button className="tick" aria-pressed={!!e.doneAt} aria-label={e.doneAt ? `Not done: ${e.note}` : `Done: ${e.note}`} onClick={ev => { ev.stopPropagation(); onToggle() }}>
      <span className={'tick-box' + (e.doneAt ? ' on' : '')}>{e.doneAt ? <Check /> : null}</span>
    </button>
  )
}

/** One to-do or key date on the line. A to-do shows the date it leads up to; a date shows its to-dos. */
function PlanRow({ e, entries, today, late, flash, onToggle, onOpen, onJump, job }: {
  e: DiaryEntry; entries: DiaryEntry[]; today: string; late?: boolean; flash?: boolean
  onToggle: (e: DiaryEntry) => void; onOpen: (e: DiaryEntry) => void; onJump: (target: DiaryEntry) => void; job?: string
}) {
  const link = e.linkId ? entries.find(x => x.id === e.linkId) : undefined
  const todos = e.type === 'event' ? todosFor(e, entries) : []
  const open = todos.filter(isOpen).length
  const where = placeOf(e)
  return (
    <div className={'pl-item' + (e.type === 'event' ? ' ev' : '') + (e.doneAt ? ' done' : '') + (flash ? ' flash' : '')} id={`pl-${e.id}`}>
      {e.type === 'todo' ? <PlanTick e={e} onToggle={() => onToggle(e)} /> : null}
      <div className="grow">
        <button className="pl-open" onClick={() => onOpen(e)}>
          <span className="pl-t">{e.trade && <TradeMark name={e.trade} />}{e.note}</span>
          <span className="pl-m">
            {job && <span className="pl-job">{job}</span>}
            {[e.time, where, e.type === 'todo' && !e.date ? 'no date' : ''].filter(Boolean).join(' · ')}
            {e.office && <span className="badge b-slate pl-off">Office</span>}
            {late && e.date && <span className="plate plate-stop pl-late"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" /><rect x="3" y="5.2" width="6" height="1.6" /></svg>{lateBy(e.date, today)}</span>}
            {e.type === 'event' && todos.length > 0 && <span className="pl-count"><IconLinkFrom size={14} /> {todos.length} to-do{todos.length === 1 ? '' : 's'}{open && open < todos.length ? `, ${open} open` : ''}</span>}
          </span>
        </button>
        {link && <button className="pl-link" onClick={() => onJump(link)}><IconLinkTo size={14} /> {link.date ? `${shortDay(link.date)} · ` : ''}{link.note}</button>}
        <ByClaude at={e.byClaude} />
      </div>
    </div>
  )
}

/** The day on the line: weekday over date, and the month where the line turns into a new one. */
const DayLabel = ({ date, today, prev }: { date: string; today: string; prev?: string }) => {
  const p = dayParts(date)
  const month = date !== today && date.slice(0, 7) !== (prev ?? today).slice(0, 7)
  return <>
    <div className="ln-l" aria-hidden="true"><span>{date === today ? 'Today' : p.wd}</span><b>{p.n}</b>{month ? <em>{p.mon}</em> : null}</div>
    <span className="sr-only">{date === today ? `Today, ${fullDay(date)}` : fullDay(date)}</span>
  </>
}

/**
 * The job's line: a few site days behind, today lit (with anything late), and every booked day ahead.
 * Tapping a site day opens the diary editor for that day; a to-do's link jumps to its date and back.
 */
export function JobLine({ job, entries, properties, trades, onSave, onDelete, onOpenDay }: {
  job: Job; entries: DiaryEntry[]; properties: string[]; trades: string[]
  onSave: (e: DiaryEntry) => void; onDelete: (e: DiaryEntry) => void; onOpenDay: (date: string) => void
}) {
  const { money } = useAccess()
  const today = dayKey()
  const [behind, setBehind] = useState(1)   // the last site day; "Earlier days" for more
  const [days, setDays] = useState(30)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [showUndated, setShowUndated] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const line = useMemo(() => jobLine(entries, today, { money, behind, days }), [entries, today, money, behind, days])
  const hasEarlier = useMemo(() => new Set(entries.filter(e => e.date && e.date < today && e.type !== 'note').map(e => e.date)).size > line.before.length, [entries, today, line.before.length])

  const toggle = (e: DiaryEntry) => onSave({ ...e, doneAt: e.doneAt ? null : Date.now(), byClaude: null })
  const jump = (t: DiaryEntry) => {
    const el = document.getElementById(`pl-${t.id}`)
    if (!el) { setEditing(t); return }   // further out than the line shows: open it instead
    el.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setFlash(t.id); window.setTimeout(() => setFlash(f => (f === t.id ? null : f)), 1600)
  }

  const row = (e: DiaryEntry, late?: boolean) => <PlanRow key={e.id} e={e} entries={entries} today={today} late={late} flash={flash === e.id} onToggle={toggle} onOpen={setEditing} onJump={jump} />
  const siteLine = (d: LineDay) => {
    const s = d.site
    const bits = [s?.weather, s?.labour != null ? `${s.labour} on site` : '', d.captures ? `${d.captures} photo${d.captures === 1 ? '' : 's'}, video or voice` : '', s?.note ? 'note' : ''].filter(Boolean)
    return bits.join(' · ')
  }

  return (
    <div className="stack" style={{ gap: 0 }}>
      <div className="row ln-head">
        <h1 className="tab-title grow">Diary</h1>
        <button className="btn btn-secondary ln-add" onClick={() => setEditing(newPlan(job, 'todo'))}>+ To-do</button>
        <button className="btn btn-secondary ln-add" onClick={() => setEditing(newPlan(job, 'event', { date: addDays(today, 1) }))}>+ Date</button>
      </div>

      {line.undated.length > 0 && (
        <div className={'ln-tray' + (showUndated ? ' open' : '')}>
          <button className="ln-tray-h" aria-expanded={showUndated} onClick={() => setShowUndated(v => !v)}>
            <b>{line.undated.length} to-do{line.undated.length === 1 ? '' : 's'} with no date</b>
            {!showUndated && <span>{line.undated.slice(0, 2).map(e => e.note).join(' · ')}</span>}
          </button>
          {showUndated && <div className="ln-tray-b">{line.undated.map(e => row(e))}</div>}
        </div>
      )}

      {hasEarlier && <button className="ln-more" onClick={() => setBehind(b => b + 7)}>Earlier days</button>}
      <div className="ln" role="list" aria-label="The job's days">
        {line.before.map((d, i) => (
          <div key={d.date} className="ln-day past" role="listitem">
            <DayLabel date={d.date} today={today} prev={i ? line.before[i - 1].date : '0000-00'} />
            <div className="ln-c">
              {(d.site || d.captures > 0) && <button className="ln-past" onClick={() => onOpenDay(d.date)}><span className="grow"><b>Site day</b> · {siteLine(d) || 'open the day'}</span><IconChevron size={14} /></button>}
              {d.items.map(e => row(e))}
            </div>
          </div>
        ))}

        <div className="ln-day now" role="listitem" aria-current="date">
          <DayLabel date={today} today={today} />
          <div className="ln-c">
            <button className="ln-site" onClick={() => onOpenDay(today)}>
              <span className="grow"><b>{line.today.site || line.today.captures ? 'Today’s site day' : 'Start today’s site diary'}</b><small>{siteLine(line.today) || prettyDay(today)}</small></span><IconChevron size={16} />
            </button>
            {line.late.map(e => row(e, true))}
            {line.today.items.map(e => row(e))}
          </div>
        </div>

        {line.ahead.map((d, i) => (
          <div key={d.date} className="ln-day ahead" role="listitem">
            <DayLabel date={d.date} today={today} prev={i ? line.ahead[i - 1].date : today} />
            <div className="ln-c">{d.items.map(e => row(e))}</div>
          </div>
        ))}
        {line.ahead.length === 0 && (
          <div className="ln-day ahead empty" role="listitem">
            <div className="ln-l" aria-hidden="true" />
            <div className="ln-c"><div className="ln-empty">Nothing booked yet. Add the key dates (a start, a delivery, a test) and the to-dos that lead up to them.</div></div>
          </div>
        )}
      </div>
      {line.later > 0 && <button className="ln-more ahead" onClick={() => setDays(d => d + 60)}>{line.later} more after {shortDay(addDays(today, days))}</button>}

      {editing && <PlanSheet job={job} item={editing} entries={entries} properties={properties} trades={trades}
        onClose={() => setEditing(null)}
        onSave={e => { onSave({ ...e, byClaude: null }); setEditing(null) }}
        onAddLinked={(event, todo) => { onSave({ ...event, byClaude: null }); onSave(todo); setEditing(todo) }}
        onDelete={e => { onDelete(e); for (const t of todosFor(e, entries)) onSave({ ...t, linkId: null }); setEditing(null) }} />}
    </div>
  )
}

/** Add or change a to-do or key date: what, when, where on the job, and what it leads up to. */
function PlanSheet({ job, item, entries, properties, trades, onSave, onDelete, onClose, onAddLinked }: {
  job: Job; item: DiaryEntry; entries: DiaryEntry[]; properties: string[]; trades: string[]
  onSave: (e: DiaryEntry) => void; onDelete: (e: DiaryEntry) => void; onClose: () => void
  onAddLinked: (event: DiaryEntry, todo: DiaryEntry) => void
}) {
  const { money } = useAccess()
  const today = dayKey()
  const isNew = !entries.some(x => x.id === item.id)
  const [e, setE] = useState<DiaryEntry>(item)
  useEffect(() => setE(item), [item])
  const set = (p: Partial<DiaryEntry>) => setE(x => ({ ...x, ...p }))
  const events = entries.filter(x => x.type === 'event' && x.id !== e.id && visible(x, money)).sort((a, b) => a.date.localeCompare(b.date))
  const todos = e.type === 'event' ? todosFor(e, entries).filter(t => visible(t, money)) : []
  const ok = e.note.trim().length > 1 && (e.type === 'todo' || !!e.date)
  const quick: [string, string][] = [['Today', today], ['Tomorrow', addDays(today, 1)], ['Next week', addDays(today, 7)]]
  const kind = e.type === 'event' ? 'date' : 'to-do'

  return (
    <Sheet onClose={onClose} label={isNew ? `New ${kind}` : `Change ${kind}`}>
      <div className="stack">
        <h2 className="label bracket">{isNew ? (e.type === 'event' ? 'Book a key date' : 'Add a to-do') : e.type === 'event' ? 'Key date' : 'To-do'}</h2>
        {isNew && (
          <div className="seg" role="group" aria-label="Kind">
            <button className={e.type === 'todo' ? 'on' : ''} aria-pressed={e.type === 'todo'} onClick={() => set({ type: 'todo', time: e.time })}>To-do</button>
            <button className={e.type === 'event' ? 'on' : ''} aria-pressed={e.type === 'event'} onClick={() => set({ type: 'event', linkId: null, date: e.date || addDays(today, 1) })}>Key date</button>
          </div>
        )}
        <Field label={e.type === 'event' ? 'What’s happening' : 'What needs doing'}>
          <textarea rows={2} value={e.note} autoFocus={isNew} onChange={x => set({ note: x.target.value })}
            placeholder={e.type === 'event' ? 'e.g. Kitchen refit starts' : 'e.g. Speak to the tenant about the start date'} />
        </Field>

        <div>
          <div className="field"><span>{e.type === 'event' ? 'Day' : 'Do it by'}</span></div>
          <div className="chips">
            {e.type === 'todo' && <button className={'chip' + (!e.date ? ' on' : '')} aria-pressed={!e.date} onClick={() => set({ date: '' })}>No date</button>}
            {quick.map(([l, d]) => <button key={l} className={'chip' + (e.date === d ? ' on' : '')} aria-pressed={e.date === d} onClick={() => set({ date: d })}>{l}</button>)}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 10 }}>
            <div className="grow"><Field label="Date"><input type="date" value={e.date} onChange={x => set({ date: x.target.value })} /></Field></div>
            <div style={{ width: 132 }}><Field label="Time (optional)"><input type="time" value={e.time ?? ''} onChange={x => set({ time: x.target.value || undefined })} /></Field></div>
          </div>
        </div>

        {properties.length > 0 && (
          <div>
            <div className="field"><span>Property</span></div>
            <div className="chips">
              <button className={'chip' + (!e.property ? ' on' : '')} aria-pressed={!e.property} onClick={() => set({ property: undefined })}>Whole job</button>
              {properties.map(p => <button key={p} className={'chip' + (e.property === p ? ' on' : '')} aria-pressed={e.property === p} onClick={() => set({ property: p })}>No. {p}</button>)}
            </div>
          </div>
        )}
        {trades.length > 0 && (
          <div>
            <div className="field"><span>Trade</span></div>
            <div className="chips">
              <button className={'chip' + (!e.trade ? ' on' : '')} aria-pressed={!e.trade} onClick={() => set({ trade: undefined })}>None</button>
              {trades.map(t => <button key={t} className={'chip' + (e.trade === t ? ' on' : '')} aria-pressed={e.trade === t} onClick={() => set({ trade: t })}><TradeMark name={t} />{t}</button>)}
            </div>
          </div>
        )}

        {e.type === 'todo' && events.length > 0 && (
          <Field label="Leads up to" hint="The key date this to-do is for: each shows the other on the line.">
            <select value={e.linkId ?? ''} onChange={x => set({ linkId: x.target.value || null })}>
              <option value="">Nothing</option>
              {events.map(v => <option key={v.id} value={v.id}>{shortDay(v.date)} · {v.note}{v.property ? ` · No. ${v.property}` : ''}</option>)}
            </select>
          </Field>
        )}

        {e.type === 'event' && !isNew && (
          <div>
            <div className="field"><span>To-dos for this date</span></div>
            {todos.length > 0 && <div className="panel" style={{ padding: '2px 0' }}>{todos.map(t => (
              <div key={t.id} className="pl-item">
                <span className={'tick-box sm' + (t.doneAt ? ' on' : '')} aria-hidden="true">{t.doneAt ? <Check /> : null}</span>
                <span className="grow pl-t">{t.note}<small className="pl-m">{t.doneAt ? 'done' : t.date ? (t.date < today ? lateBy(t.date, today) : `by ${shortDay(t.date)}`) : 'no date'}</small></span>
              </div>
            ))}</div>}
            <div className="chips" style={{ marginTop: 8 }}>
              {([['Day before', -1], ['Week before', -7]] as const).map(([l, n]) => (
                <button key={l} className="chip" onClick={() => onAddLinked(e, newPlan(job, 'todo', { linkId: e.id, date: addDays(e.date, n) < today ? today : addDays(e.date, n), property: e.property, trade: e.trade, office: e.office }))}>+ To-do, {l.toLowerCase()}</button>
              ))}
            </div>
          </div>
        )}

        {money && (
          <label className="row ln-office">
            <input type="checkbox" checked={!!e.office} onChange={x => set({ office: x.target.checked })} />
            <span className="grow"><b>Office only</b><small>Site doesn’t see it: money, chasing, valuations.</small></span>
          </label>
        )}

        <button className="btn btn-primary" disabled={!ok} onClick={() => onSave({ ...e, note: e.note.trim() })}>{isNew ? (e.type === 'event' ? 'Book it' : 'Add it') : 'Save'}</button>
        {!isNew && e.type === 'todo' && <button className="btn btn-secondary" onClick={() => onSave({ ...e, note: e.note.trim(), doneAt: e.doneAt ? null : Date.now() })}>{e.doneAt ? 'Not done after all' : 'Mark done'}</button>}
        {!isNew && <ConfirmDelete label={`Delete this ${kind}…`} confirmLabel={`Delete ${kind}`} note={e.type === 'event' && todos.length ? 'Its to-dos stay, unlinked.' : undefined} onConfirm={() => onDelete(e)} />}
      </div>
    </Sheet>
  )
}

/** Every job's week on the jobs screen: late and today first, then the days ahead. Tapping an item opens its job's line. */
export function WeekLine({ jobs, entries, alerts = [], onOpen, onToggle }: {
  jobs: Job[]; entries: DiaryEntry[]; onOpen: (jobId: string) => void
  /** Mastor's own urgent items (overdue valuations…), office only, shown at today as "From Mastor" */
  alerts?: { jobId: string; text: string; hint: string }[]
  /** tick a to-do off from here, without opening the job */
  onToggle?: (e: DiaryEntry) => void
}) {
  const { money } = useAccess()
  const today = dayKey()
  const w = useMemo(() => weekLine(jobs, entries, today, { money }), [jobs, entries, today, money])
  const fromMastor = money ? alerts : []
  if (!w.count && !fromMastor.length) return null
  const name = (id: string) => jobs.find(j => j.id === id)?.name ?? ''
  const stop = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" /><rect x="3" y="5.2" width="6" height="1.6" /></svg>
  const item = (e: DiaryEntry, late?: boolean) => (
    <div key={e.id} className={'pl-item wk-item' + (e.type === 'event' ? ' ev' : '')}>
      {e.type === 'todo' && onToggle && <PlanTick e={e} onToggle={() => onToggle(e)} />}
      <button className="pl-open grow" onClick={() => onOpen(e.jobId)}>
        <span className="pl-t">{e.trade && <TradeMark name={e.trade} />}{e.note}</span>
        <span className="pl-m"><span className="pl-job">{name(e.jobId)}</span>{[e.time, placeOf(e)].filter(Boolean).join(' · ')}
          {e.office && <span className="badge b-slate pl-off">Office</span>}
          {late && e.date && <span className="plate plate-stop pl-late">{stop}{lateBy(e.date, today)}</span>}</span>
      </button>
    </div>
  )
  // Mastor's own deadline: the red plate says what's wrong ("Overdue 2 days"); the grey line says where it's from
  const mastor = (a: { jobId: string; text: string; hint: string }, i: number) => {
    const [fact, ...rest] = a.hint.split(' · ')
    return (
      <div key={`m${i}`} className="pl-item wk-item">
        <button className="pl-open grow" onClick={() => onOpen(a.jobId)}>
          <span className="pl-t">{a.text.replace(/ — /g, ' · ')}</span>
          <span className="pl-m"><span className="pl-job">{name(a.jobId)}</span><span className="plate plate-stop pl-late">{stop}{fact}</span>{['From Mastor', ...rest].join(' · ')}</span>
        </button>
      </div>
    )
  }
  const todays = w.days.find(d => d.date === today)
  return (
    <section className="wk" aria-label="The week across all jobs">
      <div className="row"><h2 className="sec-h grow" style={{ margin: 0 }}>The week · all jobs</h2><span className="hint">{shortDay(today)}</span></div>
      <div className="ln wk-ln" role="list">
        {(w.late.length > 0 || todays || fromMastor.length > 0) && (
          <div className="ln-day now" role="listitem" aria-current="date">
            <DayLabel date={today} today={today} />
            <div className="ln-c">{fromMastor.map(mastor)}{w.late.map(e => item(e, true))}{todays?.items.map(e => item(e))}</div>
          </div>
        )}
        {w.days.filter(d => d.date !== today).map((d, i, all) => (
          <div key={d.date} className="ln-day ahead" role="listitem">
            <DayLabel date={d.date} today={today} prev={i ? all[i - 1].date : today} />
            <div className="ln-c">{d.items.map(e => item(e))}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
