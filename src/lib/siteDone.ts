/**
 * "Done" on site: an operative marks a scope line finished from their phone. The mark is its own diary record
 * (type 'done'), never an edit to the scope line, so a phone with an old copy can't undo the office's changes; it
 * carries one 'complete' suggestion, which the office approves in Vals → From site like anything read from site,
 * and approving it ticks the line into the open valuation. Nothing about money is in it.
 */
import type { DiaryEntry, Job, ScopeItem } from './types'
import { dayKey } from './dates'
import { uid } from './db'

export const isDoneMark = (e: DiaryEntry) => e.type === 'done'

export function doneMark(job: Job, item: ScopeItem, now = Date.now()): DiaryEntry {
  const what = `${item.code ? item.code + ' ' : ''}${item.description}`
  return {
    id: uid(), jobId: job.id, date: dayKey(new Date(now)), type: 'done', note: what, labour: null, weather: '', mediaId: null, originalMediaId: null,
    room: item.room, property: item.property ?? '', voId: null, createdAt: now, lineId: item.id,
    read: { at: now, suggestions: [{ id: uid(), kind: 'complete', text: `Marked done on site: ${what}${item.property ? ` · No. ${item.property}` : ''}`, lineIds: [item.id],
      property: item.property ?? '', room: item.room, qty: null, unit: '', code: item.code, quote: '', basis: 'seen', verified: true, state: 'open' }] },
  }
}

/** Each line's standing mark: the latest one not rejected by the office. */
export function doneMarks(diary: DiaryEntry[]): Map<string, DiaryEntry> {
  const out = new Map<string, DiaryEntry>()
  for (const e of [...diary].filter(isDoneMark).sort((a, b) => a.createdAt - b.createdAt)) {
    if (!e.lineId) continue
    if (e.read?.suggestions.every(s => s.state === 'rejected')) out.delete(e.lineId)
    else out.set(e.lineId, e)
  }
  return out
}
/** A mark the office hasn't decided yet can be taken back by whoever made it (tapped by mistake). */
export const undecided = (e: DiaryEntry) => !!e.read?.suggestions.every(s => s.state === 'open')
