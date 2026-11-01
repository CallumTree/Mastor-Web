/**
 * The valuation rhythm. Valuations go in during the first week of each month (the 1st to the 7th), so
 * the client's review, any changes and the invoice are done inside that week. A month with less than
 * two weeks' work since the last valuation was sent (or since the job started) waits for the next one:
 * a job started on the 27th first comes up at the start of the month after next. Pure, so the job, the
 * jobs screen and Clerk all say the same thing.
 */
import type { DiaryEntry, Job, Valuation } from './types'
import { addDays, dayKey, fromKey } from './dates'
import { valRef } from './valuation'

export const VAL_WEEK = 7         // the 1st to the 7th
export const VAL_MIN_DAYS = 14    // less work than this since the last one waits for the next month
export const VAL_SOON = 3         // days before the week when it shows on the week line

export type RhythmState = 'later' | 'soon' | 'due' | 'late'
export interface Rhythm {
  /** the last valuation sent to the client, if any */
  last: Valuation | null
  /** the next valuation's number (the open one's, if it's started) */
  next: number
  /** its week, YYYY-MM-DD */
  from: string; until: string
  state: RhythmState
  /** moved on by "Wait till next month" */
  waited: boolean
  /** the day the two weeks count from: the last send, or the job's start */
  since: string
}

const SITE = new Set<DiaryEntry['type']>(['day', 'photo', 'video', 'voice'])
/** The job's start: when it was added, or its first site day if that's earlier. */
export function jobStart(job: Job, diary: DiaryEntry[] = []) {
  const days = diary.filter(e => e.jobId === job.id && SITE.has(e.type) && e.date).map(e => e.date).sort()
  const added = dayKey(new Date(job.createdAt))
  return days[0] && days[0] < added ? days[0] : added
}

/** The 1st of the month on or after a day. */
export const firstOnOrAfter = (k: string) => {
  if (k.endsWith('-01')) return k
  const [y, m] = k.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

export function valRhythm(job: Job, vals: Valuation[], opts: { now?: number; today?: string; diary?: DiaryEntry[] } = {}): Rhythm | null {
  if (job.status === 'Complete') return null
  const now = opts.now ?? Date.now(), today = opts.today ?? dayKey(new Date(now))
  const last = vals.filter(v => v.status === 'Issued' && v.issuedAt).sort((a, b) => b.issuedAt! - a.issuedAt!)[0] ?? null
  const since = last ? dayKey(new Date(last.issuedAt!)) : jobStart(job, opts.diary)
  let from = firstOnOrAfter(addDays(since, VAL_MIN_DAYS)), waited = false
  const w = job.valWait
  if (w && w.at > (last?.issuedAt ?? 0) && w.until > from) { from = w.until; waited = true }
  const until = addDays(from, VAL_WEEK - 1)
  const state: RhythmState = today > until ? 'late' : today >= from ? 'due' : today >= addDays(from, -VAL_SOON) ? 'soon' : 'later'
  const open = vals.find(v => v.status === 'Open')
  return { last, next: open?.number ?? vals.reduce((m, v) => Math.max(m, v.number), 0) + 1, from, until, state, waited, since }
}

/** "Wait till next month": the next valuation moves to the following month's week. */
export const waitAMonth = (job: Job, r: Rhythm, now = Date.now()): Job => ({ ...job, valWait: { until: firstOnOrAfter(addDays(r.from, 1)), at: now } })

/** "1–7 Dec" */
export const weekText = (r: Pick<Rhythm, 'from'>) => {
  const d = fromKey(r.from)
  return `1–${VAL_WEEK} ${d.toLocaleDateString('en-GB', { month: 'short' })}`
}
/** "VAL II, sent 3 Oct" — or that this is the first one */
export const lastText = (r: Rhythm) => r.last
  ? `last one ${valRef(r.last.number)}, sent ${new Date(r.last.issuedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  : 'the first on this job'
/** Site days since the two weeks began counting: work that wants claiming. */
export const siteDaysSince = (r: Rhythm, diary: DiaryEntry[], jobId: string) =>
  new Set(diary.filter(e => e.jobId === jobId && SITE.has(e.type) && e.date > r.since).map(e => e.date)).size
