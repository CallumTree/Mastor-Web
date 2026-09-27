/**
 * Storage — IndexedDB on this device.
 * TEST MODE: data lives on this phone/browser only. The whole app talks to this file
 * alone, so moving to a real shared database (Supabase) later is a one-file change.
 */
import type { Job, ScopeItem, Valuation, Variation } from './types'

const DB_NAME = 'mastor'
const VERSION = 2 // v2: scope + valuations
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('variations')) {
        const s = db.createObjectStore('variations', { keyPath: 'id' })
        s.createIndex('jobId', 'jobId')
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos')
      if (!db.objectStoreNames.contains('scope')) db.createObjectStore('scope', { keyPath: 'id' }).createIndex('jobId', 'jobId')
      if (!db.objectStoreNames.contains('valuations')) db.createObjectStore('valuations', { keyPath: 'id' }).createIndex('jobId', 'jobId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
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

export const db = {
  jobs: () => tx<Job[]>('jobs', 'readonly', s => s.getAll()),
  putJob: (j: Job) => tx('jobs', 'readwrite', s => s.put(j)),
  deleteJob: async (id: string) => {
    const vos = await db.variations(id)
    for (const v of vos) await db.deleteVariation(v)
    for (const s of await db.scope(id)) await db.deleteScope(s.id)
    for (const v of await db.valuations(id)) await tx('valuations', 'readwrite', st => st.delete(v.id))
    await tx('jobs', 'readwrite', s => s.delete(id))
  },
  scope: (jobId: string) => tx<ScopeItem[]>('scope', 'readonly', s => s.index('jobId').getAll(jobId)),
  putScope: (i: ScopeItem) => tx('scope', 'readwrite', s => s.put(i)),
  deleteScope: (id: string) => tx('scope', 'readwrite', s => s.delete(id)),
  valuations: (jobId: string) => tx<Valuation[]>('valuations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putValuation: (v: Valuation) => tx('valuations', 'readwrite', s => s.put(v)),
  deleteValuation: (id: string) => tx('valuations', 'readwrite', s => s.delete(id)),
  variations: (jobId: string) => tx<Variation[]>('variations', 'readonly', s => s.index('jobId').getAll(jobId)),
  putVariation: (v: Variation) => tx('variations', 'readwrite', s => s.put(v)),
  deleteVariation: async (v: Variation) => {
    for (const p of v.photoIds) await tx('photos', 'readwrite', s => s.delete(p))
    await tx('variations', 'readwrite', s => s.delete(v.id))
  },
  putPhoto: (id: string, blob: Blob) => tx('photos', 'readwrite', s => s.put(blob, id)),
  photo: (id: string) => tx<Blob | undefined>('photos', 'readonly', s => s.get(id)),
  deletePhoto: (id: string) => tx('photos', 'readwrite', s => s.delete(id)),
}

/** Next VO number = highest existing + 1. Never count-based (that reuses numbers after a delete). */
export async function nextVoNumber(jobId: string): Promise<number> {
  const vos = await db.variations(jobId)
  return vos.reduce((m, v) => Math.max(m, v.number), 0) + 1
}
