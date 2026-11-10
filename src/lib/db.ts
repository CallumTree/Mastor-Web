/**
 * Local storage — IndexedDB on the device. Always written first, so the app works with no signal.
 * Every change is also queued in the OUTBOX; sync.ts sends the queue to the cloud when it can.
 * Writes coming *from* the cloud use the `local` helpers, which don't queue anything.
 */
import type { CompanySettings, Cost, Dayworks, DiaryEntry, Job, JobDocument, RateItem, ScopeItem, Valuation, Variation, WorkOrder } from './types'
import { clearThumbs } from './thumbs'

const DB_NAME = 'mastor'
const VERSION = 7 // v2: scope + valuations · v3: outbox + meta (cloud sync) · v4: diary · v5: company settings · v6: rate books · v7: costs, orders, dayworks, documents
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
      for (const s of JOB_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }).createIndex('jobId', 'jobId')
      if (!db.objectStoreNames.contains('rates')) {
        const r = db.createObjectStore('rates', { keyPath: ['bookId', 'code'] })
        r.createIndex('code', 'code'); r.createIndex('bookId', 'bookId')
      }
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
export type RecordTable = 'jobs' | 'scope' | 'variations' | 'valuations' | 'diary' | 'settings' | JobStore
/** Newer per-job records, all stored and synced the same way. */
export const JOB_STORES = ['costs', 'orders', 'dayworks', 'docs'] as const
export type JobStore = typeof JOB_STORES[number]
type JobRecord = { costs: Cost; orders: WorkOrder; dayworks: Dayworks; docs: JobDocument }
export type OutboxOp =
  | { seq?: number; kind: 'record'; table: RecordTable; id: string; jobId: string | null; data: unknown | null } // data null = delete
  | { seq?: number; kind: 'photo'; id: string }
  | { seq?: number; kind: 'ratebook'; id: string } // a rate book's lines, uploaded as one file

let queueing = false // switched on by sync once signed in with a company
let onQueued: (() => void) | null = null
export function setQueueing(on: boolean, notify?: () => void) { queueing = on; onQueued = notify ?? null }

async function enqueue(op: OutboxOp) {
  if (!queueing) return
  await tx('outbox', 'readwrite', s => s.add(op))
  onQueued?.()
}

/**
 * A change and its place in the outbox, written in ONE transaction: both land or neither does. (Written apart, an app
 * killed between the two would leave a change on this phone that never reaches the cloud.) `change` gets each store by
 * name; `ops` are queued only while signed in with a company, as before. Sync is nudged once it has all committed.
 */
function save(stores: string[], change: (store: (name: string) => IDBObjectStore) => void, ops: OutboxOp[]): Promise<void> {
  const q = queueing && ops.length > 0
  return open().then(d => new Promise<void>((resolve, reject) => {
    const t = d.transaction(q ? [...new Set([...stores, 'outbox'])] : stores, 'readwrite')
    t.oncomplete = () => { if (q) onQueued?.(); resolve() }
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('The change could not be saved on this device.'))
    try {
      change(name => t.objectStore(name))
      if (q) { const out = t.objectStore('outbox'); for (const op of ops) out.add(op) }
    } catch (e) { try { t.abort() } catch { /* already finished */ } reject(e) }   // a bad record takes the whole write with it: nothing half-saved
  }))
}
const rec = (table: RecordTable, id: string, jobId: string | null, data: unknown | null): OutboxOp => ({ kind: 'record', table, id, jobId, data })
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
/** A person saving a record takes it over from Claude: the “by Claude” mark goes. (Synced copies keep it.) */
const byPerson = <T extends { byClaude?: number | null }>(r: T): T => { if (r.byClaude == null) return r; const { byClaude: _, ...rest } = r; return rest as T }
export const db = {
  jobs: () => tx<Job[]>('jobs', 'readonly', s => s.getAll()),
  putJob: (j: Job) => save(['jobs'], st => st('jobs').put(j), [rec('jobs', j.id, j.id, j)]),
  deleteJob: async (id: string) => {
    for (const v of await db.variations(id)) await db.deleteVariation(v)
    for (const s of await db.scope(id)) await db.deleteScope(s.id)
    for (const v of await db.valuations(id)) await db.deleteValuation(v.id)
    for (const d of await db.diary(id)) await db.deleteDiary(d)
    for (const st of JOB_STORES) for (const r of await db.list(st, id)) await db.remove(st, r)
    await save(['jobs'], st => st('jobs').delete(id), [rec('jobs', id, id, null)])
  },
  scope: (jobId: string) => tx<ScopeItem[]>('scope', 'readonly', s => s.index('jobId').getAll(jobId)),
  putScope: (item: ScopeItem) => db.putScopeMany([item]),
  /** Several lines in one write (Tick all on a 40-line house is one transaction, not 80). */
  putScopeMany: (items: ScopeItem[]) => { const is = items.map(byPerson); return save(['scope'], st => { for (const i of is) st('scope').put(i) }, is.map(i => rec('scope', i.id, i.jobId, i))) },
  deleteScope: (id: string) => save(['scope'], st => st('scope').delete(id), [rec('scope', id, null, null)]),
  valuations: (jobId: string) => tx<Valuation[]>('valuations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putValuation: (val: Valuation) => { const v = byPerson(val); return save(['valuations'], st => st('valuations').put(v), [rec('valuations', v.id, v.jobId, v)]) },
  deleteValuation: (id: string) => save(['valuations'], st => st('valuations').delete(id), [rec('valuations', id, null, null)]),
  variations: (jobId: string) => tx<Variation[]>('variations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putVariation: (vo: Variation) => db.putVariationMany([vo]),
  putVariationMany: (vos: Variation[]) => { const vs = vos.map(byPerson); return save(['variations'], st => { for (const v of vs) st('variations').put(v) }, vs.map(v => rec('variations', v.id, v.jobId, v))) },
  /** `keepMedia`: the record goes now, its photos stay until the Undo offer closes (then dropMedia). */
  deleteVariation: (v: Variation, keepMedia = false) => save(['variations', 'photos'], st => { if (!keepMedia) for (const p of v.photoIds) st('photos').delete(p); st('variations').delete(v.id) }, [rec('variations', v.id, v.jobId, null)]),
  diary: (jobId: string) => tx<DiaryEntry[]>('diary', 'readonly', s => s.index('jobId').getAll(jobId)),
  putDiary: (entry: DiaryEntry) => { const d = byPerson(entry); return save(['diary'], st => st('diary').put(d), [rec('diary', d.id, d.jobId, d)]) },
  deleteDiary: (d: DiaryEntry, keepMedia = false) => save(['diary', 'photos'], st => { if (!keepMedia) for (const m of [d.mediaId, d.originalMediaId]) if (m) st('photos').delete(m); st('diary').delete(d.id) }, [rec('diary', d.id, d.jobId, null)]),
  /** The files of records deleted a moment ago, once Undo is no longer on offer. */
  dropMedia: (ids: string[]) => (ids.length ? save(['photos'], st => { for (const id of ids) st('photos').delete(id) }, []) : Promise.resolve()),
  /** costs, orders, dayworks, docs: list for a job, save, delete */
  list: <K extends JobStore>(store: K, jobId: string) => tx<JobRecord[K][]>(store, 'readonly', s => s.index('jobId').getAll(jobId)),
  put: <K extends JobStore>(store: K, r: JobRecord[K]) => save([store], st => st(store).put(r), [rec(store, r.id, r.jobId, r)]),
  remove: <K extends JobStore>(store: K, r: JobRecord[K]) => save([store], st => st(store).delete(r.id), [rec(store, r.id, r.jobId, null)]),
  settings: () => tx<CompanySettings | undefined>('settings', 'readonly', s => s.get('company')),
  putSettings: (c: CompanySettings) => save(['settings'], st => st('settings').put(c), [rec('settings', c.id, null, c)]),
  putPhoto: (id: string, blob: Blob) => save(['photos'], st => st('photos').put(blob, id), [{ kind: 'photo', id }]),
  photo: (id: string) => tx<Blob | undefined>('photos', 'readonly', s => s.get(id)),
  deletePhoto: (id: string) => tx('photos', 'readwrite', s => s.delete(id)),
}

// ---------- rate books (the lines; the book list itself is in company settings) ----------
let rateCache: RateItem[] | null = null
export const rates = {
  /** Every rate line on this device (cached — 8,000 lines is a few MB, read once). */
  all: async () => (rateCache ??= await tx<RateItem[]>('rates', 'readonly', s => s.getAll())),
  byCode: (code: string) => tx<RateItem[]>('rates', 'readonly', s => s.index('code').getAll(code.trim().toUpperCase())),
  countBook: (bookId: string) => tx<number>('rates', 'readonly', s => s.index('bookId').count(bookId)),
  book: (bookId: string) => tx<RateItem[]>('rates', 'readonly', s => s.index('bookId').getAll(bookId)),
  /** Store a book's lines on this device only (used for books that came from the cloud). */
  putLocal: (items: RateItem[]) => open().then(d => new Promise<void>((resolve, reject) => {
    const t = d.transaction('rates', 'readwrite'), s = t.objectStore('rates')
    for (const i of items) s.put(i)
    t.oncomplete = () => { rateCache = null; resolve() }; t.onerror = () => reject(t.error)
  })),
  /** A newly imported book: store its lines and queue them for the cloud. */
  put: async (bookId: string, items: RateItem[]) => { await rates.putLocal(items); await enqueue({ kind: 'ratebook', id: bookId }) },
  deleteBook: (bookId: string) => open().then(d => new Promise<void>((resolve, reject) => {
    const t = d.transaction('rates', 'readwrite'), idx = t.objectStore('rates').index('bookId')
    const req = idx.openCursor(IDBKeyRange.only(bookId))
    req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue() } }
    t.oncomplete = () => { rateCache = null; resolve() }; t.onerror = () => reject(t.error)
  })),
}

/** Sign-out: remove every local copy so the next person on this phone sees nothing of yours. */
export async function wipeLocal() {
  for (const store of ['jobs', 'scope', 'variations', 'valuations', 'diary', 'settings', 'photos', 'rates', ...JOB_STORES, 'outbox', 'meta']) await tx(store, 'readwrite', s => s.clear())
  rateCache = null
  await clearThumbs().catch(() => {})   // the thumbnail cache lives in its own database
}

/** Next VO number = highest existing + 1. Never count-based (that reuses numbers after a delete). */
export async function nextVoNumber(jobId: string): Promise<number> {
  const vos = await db.variations(jobId)
  return vos.reduce((m, v) => Math.max(m, v.number), 0) + 1
}
