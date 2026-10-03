/**
 * Local storage — IndexedDB on the device. Always written first, so the app works with no signal.
 * Every change is also queued in the OUTBOX; sync.ts sends the queue to the cloud when it can.
 * Writes coming *from* the cloud use the `local` helpers, which don't queue anything.
 */
import type { CompanySettings, DiaryEntry, Job, ScopeItem, Valuation, Variation } from './types'

const DB_NAME = 'mastor'
const VERSION = 5 // v2: scope + valuations · v3: outbox + meta (cloud sync) · v4: diary · v5: company settings
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('variations')) db.createObjectStore('variations', { keyPath: 'id' }).createIndex('jobId', 'jobId')
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos')
      if (!db.objectStoreNames.contains('scope')) db.createObjectStore('scope', { keyPath: 'id' }).createIndex('jobId', 'jobId')
      if (!db.objectStoreNames.contains('valuations')) db.createObjectStore('valuations', { keyPath: 'id' }).createIndex('jobId', 'jobId')
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('diary')) db.createObjectStore('diary', { keyPath: 'id' }).createIndex('jobId', 'jobId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Mastor is open in another tab — close it and reload.'))
  })
  return dbp
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

// ---------- outbox (changes waiting to go to the cloud) ----------
export type RecordTable = 'jobs' | 'scope' | 'variations' | 'valuations' | 'diary' | 'settings'
export type OutboxOp =
  | { seq?: number; kind: 'record'; table: RecordTable; id: string; jobId: string | null; data: unknown | null } // data null = delete
  | { seq?: number; kind: 'photo'; id: string }

let queueing = false // switched on by sync once signed in with a company
let onQueued: (() => void) | null = null
export function setQueueing(on: boolean, notify?: () => void) { queueing = on; onQueued = notify ?? null }

async function enqueue(op: OutboxOp) {
  if (!queueing) return
  await tx('outbox', 'readwrite', s => s.add(op))
  onQueued?.()
}
export const outbox = {
  all: () => tx<OutboxOp[]>('outbox', 'readonly', s => s.getAll()),
  add: (op: OutboxOp) => tx('outbox', 'readwrite', s => s.add(op)),
  remove: (seq: number) => tx('outbox', 'readwrite', s => s.delete(seq)),
  count: () => tx<number>('outbox', 'readonly', s => s.count()),
}
export const meta = {
  get: <T,>(k: string) => tx<T | undefined>('meta', 'readonly', s => s.get(k)),
  set: (k: string, v: unknown) => tx('meta', 'readwrite', s => s.put(v, k)),
}

// ---------- local-only writes (used when applying changes that came from the cloud) ----------
export const local = {
  put: (table: RecordTable, row: unknown) => tx(table, 'readwrite', s => s.put(row)),
  delete: (table: RecordTable, id: string) => tx(table, 'readwrite', s => s.delete(id)),
  putPhoto: (id: string, blob: Blob) => tx('photos', 'readwrite', s => s.put(blob, id)),
}

// ---------- the app's storage API (local write + queue for the cloud) ----------
export const db = {
  jobs: () => tx<Job[]>('jobs', 'readonly', s => s.getAll()),
  putJob: async (j: Job) => { await tx('jobs', 'readwrite', s => s.put(j)); await enqueue({ kind: 'record', table: 'jobs', id: j.id, jobId: j.id, data: j }) },
  deleteJob: async (id: string) => {
    for (const v of await db.variations(id)) await db.deleteVariation(v)
    for (const s of await db.scope(id)) await db.deleteScope(s.id)
    for (const v of await db.valuations(id)) await db.deleteValuation(v.id)
    for (const d of await db.diary(id)) await db.deleteDiary(d)
    await tx('jobs', 'readwrite', s => s.delete(id))
    await enqueue({ kind: 'record', table: 'jobs', id, jobId: id, data: null })
  },
  scope: (jobId: string) => tx<ScopeItem[]>('scope', 'readonly', s => s.index('jobId').getAll(jobId)),
  putScope: async (i: ScopeItem) => { await tx('scope', 'readwrite', s => s.put(i)); await enqueue({ kind: 'record', table: 'scope', id: i.id, jobId: i.jobId, data: i }) },
  deleteScope: async (id: string) => { await tx('scope', 'readwrite', s => s.delete(id)); await enqueue({ kind: 'record', table: 'scope', id, jobId: null, data: null }) },
  valuations: (jobId: string) => tx<Valuation[]>('valuations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putValuation: async (v: Valuation) => { await tx('valuations', 'readwrite', s => s.put(v)); await enqueue({ kind: 'record', table: 'valuations', id: v.id, jobId: v.jobId, data: v }) },
  deleteValuation: async (id: string) => { await tx('valuations', 'readwrite', s => s.delete(id)); await enqueue({ kind: 'record', table: 'valuations', id, jobId: null, data: null }) },
  variations: (jobId: string) => tx<Variation[]>('variations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putVariation: async (v: Variation) => { await tx('variations', 'readwrite', s => s.put(v)); await enqueue({ kind: 'record', table: 'variations', id: v.id, jobId: v.jobId, data: v }) },
  deleteVariation: async (v: Variation) => {
    for (const p of v.photoIds) await tx('photos', 'readwrite', s => s.delete(p))
    await tx('variations', 'readwrite', s => s.delete(v.id))
    await enqueue({ kind: 'record', table: 'variations', id: v.id, jobId: v.jobId, data: null })
  },
  diary: (jobId: string) => tx<DiaryEntry[]>('diary', 'readonly', s => s.index('jobId').getAll(jobId)),
  putDiary: async (d: DiaryEntry) => { await tx('diary', 'readwrite', s => s.put(d)); await enqueue({ kind: 'record', table: 'diary', id: d.id, jobId: d.jobId, data: d }) },
  deleteDiary: async (d: DiaryEntry) => {
    for (const m of [d.mediaId, d.originalMediaId]) if (m) await tx('photos', 'readwrite', s => s.delete(m))
    await tx('diary', 'readwrite', s => s.delete(d.id))
    await enqueue({ kind: 'record', table: 'diary', id: d.id, jobId: d.jobId, data: null })
  },
  settings: () => tx<CompanySettings | undefined>('settings', 'readonly', s => s.get('company')),
  putSettings: async (c: CompanySettings) => { await tx('settings', 'readwrite', s => s.put(c)); await enqueue({ kind: 'record', table: 'settings', id: c.id, jobId: null, data: c }) },
  putPhoto: async (id: string, blob: Blob) => { await tx('photos', 'readwrite', s => s.put(blob, id)); await enqueue({ kind: 'photo', id }) },
  photo: (id: string) => tx<Blob | undefined>('photos', 'readonly', s => s.get(id)),
  deletePhoto: (id: string) => tx('photos', 'readwrite', s => s.delete(id)),
}

/** Sign-out: remove every local copy so the next person on this phone sees nothing of yours. */
export async function wipeLocal() {
  for (const store of ['jobs', 'scope', 'variations', 'valuations', 'diary', 'settings', 'photos', 'outbox', 'meta']) await tx(store, 'readwrite', s => s.clear())
}

/** Next VO number = highest existing + 1. Never count-based (that reuses numbers after a delete). */
export async function nextVoNumber(jobId: string): Promise<number> {
  const vos = await db.variations(jobId)
  return vos.reduce((m, v) => Math.max(m, v.number), 0) + 1
}
