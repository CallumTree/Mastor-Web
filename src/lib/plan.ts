/**
 * The plan on a job's line: to-dos and key dates, kept as diary records (types todo and event) so they
 * sync like the rest of the diary. A to-do can lead up to a key date (linkId), so each shows the other.
 * Open to-dos that are past their day are late, and sit at today until they're ticked off.
 */
import type { DiaryEntry, Job } from './types'
import { addDays, fromKey } from './dates'

export const isPlan = (e: DiaryEntry) => e.type === 'todo' || e.type === 'event'
/** what a person may see: operatives never see office-only items */
export const visible = (e: DiaryEntry, money: boolean) => isPlan(e) && (money || !e.office)
export const isOpen = (e: DiaryEntry) => e.type === 'todo' && !e.doneAt

export function newPlan(job: Job, type: 'todo' | 'event', patch: Partial<DiaryEntry> = {}): DiaryEntry {
  return { id: crypto.randomUUID(), jobId: job.id, date: '', type, note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: Date.now(), ...patch }
}

/** "1 day late", "3 days late" */
export function lateBy(date: string, today: string) {
  const n = Math.round((fromKey(today).getTime() - fromKey(date).getTime()) / 864e5)
  return `${n} day${n === 1 ? '' : 's'} late`
}
/** "Mon 2 Nov" */
export const shortDay = (k: string) => { const d = fromKey(k); return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}` }
/** the day label on the line: "MON" over "2" */
export const dayParts = (k: string) => { const d = fromKey(k); return { wd: d.toLocaleDateString('en-GB', { weekday: 'short' }), n: d.getDate(), mon: d.toLocaleDateString('en-GB', { month: 'short' }) } }
/** the day in full, for screen readers: "Tuesday 3 November" */
export const fullDay = (k: string) => { const d = fromKey(k); return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}` }

/** where on the job an item is: "No. 6 · Kitchen" */
export const placeOf = (e: DiaryEntry) => [e.property ? `No. ${e.property}` : '', e.trade ?? ''].filter(Boolean).join(' · ')

const byTime = (a: DiaryEntry, b: DiaryEntry) =>
  (a.type === b.type ? 0 : a.type === 'event' ? -1 : 1) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt - b.createdAt

export interface LineDay { date: string; site: DiaryEntry | null; captures: number; items: DiaryEntry[] }
export interface Line { undated: DiaryEntry[]; late: DiaryEntry[]; before: LineDay[]; today: LineDay; ahead: LineDay[]; later: number }

/**
 * A job's line around today: the last site days behind (with what was done on them), today (with
 * anything late carried to it), and every booked day ahead up to `days` days out; beyond that, a count.
 */
export function jobLine(entries: DiaryEntry[], today: string, opts: { money: boolean; behind?: number; days?: number }): Line {
  const plan = entries.filter(e => visible(e, opts.money))
  const until = addDays(today, opts.days ?? 30)
  const late = plan.filter(e => isOpen(e) && e.date && e.date < today).sort((a, b) => a.date.localeCompare(b.date))
  const at = (d: string, pick: (e: DiaryEntry) => boolean): LineDay => ({
    date: d, site: entries.find(e => e.type === 'day' && e.date === d) ?? null,
    captures: entries.filter(e => e.date === d && (e.type === 'photo' || e.type === 'video' || e.type === 'voice')).length,
    items: plan.filter(e => e.date === d && pick(e)).sort(byTime),
  })
  const siteDays = [...new Set(entries.filter(e => e.date && e.date < today && !isPlan(e) && e.type !== 'note').map(e => e.date))]
  const planDaysBefore = [...new Set(plan.filter(e => e.date && e.date < today && !isOpen(e)).map(e => e.date))]
  const before = [...new Set([...siteDays, ...planDaysBefore])].sort().reverse().slice(0, opts.behind ?? 2).reverse()
    .map(d => at(d, e => !isOpen(e)))   // what happened then; anything still open is late, at today
  const aheadDays = [...new Set(plan.filter(e => e.date > today && e.date <= until).map(e => e.date))].sort()
  return {
    undated: plan.filter(e => e.type === 'todo' && !e.date && !e.doneAt).sort((a, b) => a.createdAt - b.createdAt),
    late,
    before,
    today: at(today, () => true),
    ahead: aheadDays.map(d => at(d, () => true)),
    later: plan.filter(e => e.date > until && (e.type === 'event' || isOpen(e))).length,
  }
}

/** The to-dos that lead up to a key date. */
export const todosFor = (event: DiaryEntry, entries: DiaryEntry[]) => entries.filter(e => e.type === 'todo' && e.linkId === event.id)

/** Every job's week, for the jobs screen: late and today first, then the next `days` days. */
export function weekLine(jobs: Job[], entries: DiaryEntry[], today: string, opts: { money: boolean; days?: number }) {
  const live = new Set(jobs.filter(j => j.status !== 'Complete').map(j => j.id))
  const plan = entries.filter(e => live.has(e.jobId) && visible(e, opts.money))
  const until = addDays(today, opts.days ?? 7)
  const late = plan.filter(e => isOpen(e) && e.date && e.date < today).sort((a, b) => a.date.localeCompare(b.date))
  const days = [...new Set(plan.filter(e => e.date >= today && e.date <= until && (e.type === 'event' || isOpen(e))).map(e => e.date))].sort()
  return {
    late,
    days: days.map(d => ({ date: d, items: plan.filter(e => e.date === d && (e.type === 'event' || isOpen(e))).sort(byTime) })),
    count: late.length + plan.filter(e => e.date >= today && e.date <= until && (e.type === 'event' || isOpen(e))).length,
  }
}
