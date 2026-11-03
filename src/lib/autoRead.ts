/**
 * Site captures read on their own. While the office has Mastor open, each job-day's photos, video, voice
 * notes and day note are read against the scope once they've uploaded and the day has gone quiet (or is
 * over) — no button to remember. The suggestions wait in Vals for a person, exactly as before; nothing is
 * claimed or raised on its own (siteRead.ts checks every suggestion first and drops the weak ones).
 *
 * Office devices only, so the read happens once (operatives' phones just upload), one job-day at a time,
 * within the company's daily AI limit. A day whose captures haven't uploaded yet is tried again later;
 * when reading can't go on today (not set up, signed out, the limit reached) it stops until the next open.
 */
import { db } from './db'
import { dayKey } from './dates'
import { currentCompany, settle } from './sync'
import { dueToRead, readSite } from './siteRead'

const RETRY_MS = 30 * 60_000
let running = false
let stopped: string | null = null
const tried = new Map<string, number>()

/** Why reading stopped for now (shown in Vals), or null while it's running normally. */
export const autoReadStopped = () => stopped

/** Reads whatever is due; `onRead` runs after each day is read so the screen can refresh. Returns how many days were read. */
export async function autoRead(onRead: () => Promise<void> | void, now: () => number = Date.now): Promise<number> {
  if (running || stopped) return 0
  const company = currentCompany()
  if (!company) return 0
  running = true
  let n = 0
  try {
    for (let guard = 0; guard < 24; guard++) {
      const jobs = (await db.jobs()).filter(j => j.status !== 'Complete')
      const entries = (await Promise.all(jobs.map(j => db.diary(j.id)))).flat()
      // the same first capture tried lately and still unread means it hasn't uploaded yet: leave it a while
      const due = dueToRead(entries, dayKey(), now()).filter(d => now() - (tried.get(`${d.jobId}|${d.items[0].id}`) ?? 0) >= RETRY_MS)
      if (!due.length) break
      const d = due[0]
      tried.set(`${d.jobId}|${d.items[0].id}`, now())
      await settle()   // what this device captured goes up first
      const r = await readSite(company, d.items, await db.scope(d.jobId), await db.variations(d.jobId))
      for (const e of r.updated) await db.putDiary(e)
      if (r.updated.length) { n++; await onRead() }
      if (r.stop) { stopped = r.error ?? 'Site reading is off for now.'; await onRead(); break }
    }
  } catch (e) {
    console.warn('auto read', e)
  } finally { running = false }
  return n
}

/** For tests: start afresh. */
export function resetAutoRead() { running = false; stopped = null; tried.clear() }
