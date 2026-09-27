/**
 * Cloud sync. The phone copy is always written first (works with no signal); this sends the
 * outbox to Supabase when it can, and pulls changes made on other devices.
 * Rule: a cloud row never overwrites a local record that still has unsent changes.
 */
import { supabase } from './supabase'
import { db, local, meta, outbox, setQueueing, type RecordTable } from './db'

const CLOUD: Record<RecordTable, string> = { jobs: 'jobs', scope: 'scope_items', variations: 'variations', valuations: 'valuations' }
const TABLES = Object.keys(CLOUD) as RecordTable[]

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
export interface SyncStatus { state: SyncState; pending: number; message?: string; at?: number }

let status: SyncStatus = { state: 'idle', pending: 0 }
const statusListeners = new Set<(s: SyncStatus) => void>()
const changeListeners = new Set<() => void>()
export const onSyncStatus = (f: (s: SyncStatus) => void) => { statusListeners.add(f); f(status); return () => { statusListeners.delete(f) } }
export const onRemoteChange = (f: () => void) => { changeListeners.add(f); return () => { changeListeners.delete(f) } }
const setStatus = (s: Partial<SyncStatus>) => { status = { ...status, ...s }; statusListeners.forEach(f => f(status)) }

let companyId: string | null = null
let running = false, again = false
let timer: ReturnType<typeof setTimeout> | null = null

export async function startSync(cid: string) {
  companyId = cid
  setQueueing(true, () => schedule())
  // First time on this company: send everything already on the phone (existing jobs come with you)
  if (!(await meta.get(`uploaded:${cid}`))) { await queueEverything(); await meta.set(`uploaded:${cid}`, true) }
  window.addEventListener('online', () => schedule())
  setInterval(() => schedule(), 60_000)
  schedule(0)
}

/** For tests and 'sync now' buttons: resolves once any sync in progress has finished. */
export async function settle() { await syncNow(); while (running || again || timer) { await new Promise(r => setTimeout(r, 15)); if (!running && !again) { if (timer) { clearTimeout(timer); timer = null } await syncNow() } } }

export function stopSync() { companyId = null; setQueueing(false) }

export function schedule(delay = 800) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void syncNow() }, delay)
}

async function queueEverything() {
  for (const j of await db.jobs()) {
    await outbox.add({ kind: 'record', table: 'jobs', id: j.id, jobId: j.id, data: j })
    for (const s of await db.scope(j.id)) await outbox.add({ kind: 'record', table: 'scope', id: s.id, jobId: j.id, data: s })
    for (const v of await db.variations(j.id)) {
      await outbox.add({ kind: 'record', table: 'variations', id: v.id, jobId: j.id, data: v })
      for (const p of v.photoIds) await outbox.add({ kind: 'photo', id: p })
    }
    for (const v of await db.valuations(j.id)) await outbox.add({ kind: 'record', table: 'valuations', id: v.id, jobId: j.id, data: v })
    if (j.photoId) await outbox.add({ kind: 'photo', id: j.photoId })
  }
}

export async function syncNow() {
  if (!companyId) return
  if (running) { again = true; return }
  running = true
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus({ state: 'offline', pending: await outbox.count() }); return }
    setStatus({ state: 'syncing', pending: await outbox.count() })
    await push()
    const changed = await pull()
    if (changed) changeListeners.forEach(f => f())
    setStatus({ state: 'synced', pending: await outbox.count(), at: Date.now(), message: undefined })
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    setStatus({ state: offline ? 'offline' : 'error', pending: await outbox.count(), message: (e as Error).message })
  } finally {
    running = false
    if (again) { again = false; schedule(200) }
  }
}

async function push() {
  const ops = (await outbox.all()).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  for (const op of ops) {
    if (op.kind === 'record') {
      const row = { id: op.id, company_id: companyId, job_id: op.jobId, data: op.data ?? {}, deleted: op.data === null }
      const { error } = await supabase.from(CLOUD[op.table]).upsert(row, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    } else {
      const blob = await db.photo(op.id)
      if (blob) {
        const { error } = await supabase.storage.from('photos').upload(`${companyId}/${op.id}.jpg`, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
        if (error) throw new Error(error.message)
      }
    }
    await outbox.remove(op.seq!)
  }
}

async function pull(): Promise<boolean> {
  const pending = new Set((await outbox.all()).filter(o => o.kind === 'record').map(o => o.id))
  let changed = false
  for (const t of TABLES) {
    let since = (await meta.get<string>(`pulled:${companyId}:${t}`)) ?? '1970-01-01T00:00:00Z'
    for (;;) {
      const { data, error } = await supabase.from(CLOUD[t]).select('id, data, deleted, updated_at')
        .eq('company_id', companyId!).gt('updated_at', since).order('updated_at', { ascending: true }).limit(500)
      if (error) throw new Error(error.message)
      if (!data?.length) break
      for (const row of data as { id: string; data: unknown; deleted: boolean; updated_at: string }[]) {
        if (!pending.has(row.id)) {
          if (row.deleted) await local.delete(t, row.id)
          else await local.put(t, row.data)
          changed = true
        }
        since = row.updated_at
      }
      await meta.set(`pulled:${companyId}:${t}`, since)
      if (data.length < 500) break
    }
  }
  return changed
}

/** A photo taken on another device: fetch it from the cloud once and keep a local copy. */
export async function fetchPhoto(id: string): Promise<Blob | null> {
  if (!companyId) return null
  const { data, error } = await supabase.storage.from('photos').download(`${companyId}/${id}.jpg`)
  if (error || !data) return null
  await local.putPhoto(id, data)
  return data
}

// ---------- account ----------
export async function myCompany(): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from('memberships').select('company_id, companies(name)').limit(1)
  if (error) throw new Error(error.message)
  const row = data?.[0] as { company_id: string; companies: { name: string } | { name: string }[] | null } | undefined
  if (!row) return null
  const c = Array.isArray(row.companies) ? row.companies[0] : row.companies
  return { id: row.company_id, name: c?.name ?? '' }
}
export async function createCompany(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_company', { p_name: name })
  if (error) throw new Error(error.message)
  return data as string
}
