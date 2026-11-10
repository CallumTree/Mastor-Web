/**
 * Where you are in the app (the open job and its tab), kept in the address and on this phone. A reload, an update, or
 * the phone dropping the app in the background brings you back to the same job and tab; so does opening the installed
 * app cold (it starts at /app, with no address to come back to). Opening a job lands on the tab you last used in it.
 * The address is replaced rather than added to, so the back button isn't filled with tabs.
 */
export type PlaceKey = 'job' | 'tab'

const KEY = 'mastor.place'
interface Saved { job: string | null; tabs: Record<string, string> }
const saved = (): Saved => {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') return { job: s.job ?? null, tabs: s.tabs ?? {} } } catch { /* private window: the address only */ }
  return { job: null, tabs: {} }
}

export const placeParam = (k: PlaceKey) => new URLSearchParams(location.search).get(k)

/** The job to open with: the one in the address, else the one this phone was last in (none if it was on the jobs list). */
export function startJob() {
  const q = new URLSearchParams(location.search)
  if (q.has('job')) return q.get('job')
  const job = saved().job
  if (job) setPlace({ job, tab: lastTab(job) })
  return job
}
/** The tab last used in a job on this phone, or null (Home). */
export const lastTab = (job: string) => { const t = saved().tabs[job]; return t && t !== 'home' ? t : null }

export function setPlace(p: Partial<Record<PlaceKey, string | null>>) {
  const u = new URL(location.href)
  for (const [k, v] of Object.entries(p)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
  if (u.href !== location.href) history.replaceState(history.state, '', u)
  try {
    const s = saved(), job = u.searchParams.get('job'), tab = u.searchParams.get('tab') ?? 'home'
    s.job = job
    // Clerk isn't a place to come back to: the tab before it is kept
    if (job && tab !== 'ask') { delete s.tabs[job]; s.tabs[job] = tab }
    const keep = Object.entries(s.tabs).slice(-50)
    localStorage.setItem(KEY, JSON.stringify({ job: s.job, tabs: Object.fromEntries(keep) }))
  } catch { /* storage refused: the address still holds it */ }
}
/** Sign-out: forget where this phone was. */
export function forgetPlace() { try { localStorage.removeItem(KEY) } catch { /* nothing kept */ } }
