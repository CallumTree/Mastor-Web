/**
 * Sync engine against a stand-in cloud that behaves like Supabase (upsert, filtered select, storage).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

const cloud: Record<string, Record<string, unknown>[]> = {}
const bucket: Record<string, Blob> = {}
let clock = 0
const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString()
let online = true

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from(t: string) {
      cloud[t] ??= []
      return {
        upsert(row: Record<string, unknown>) {
          if (!online) return Promise.resolve({ error: { message: 'Failed to fetch' } })
          const i = cloud[t].findIndex(r => r.id === row.id)
          const r = { ...row, updated_at: stamp() }
          if (i >= 0) cloud[t][i] = r; else cloud[t].push(r)
          return Promise.resolve({ error: null })
        },
        select() {
          let rows = cloud[t].slice()
          const q = {
            eq(k: string, v: unknown) { rows = rows.filter(r => r[k] === v); return q },
            gt(k: string, v: string) { rows = rows.filter(r => String(r[k]) > v); return q },
            order(k: string) { rows.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : 1)); return q },
            limit(n: number) { return Promise.resolve(online ? { data: rows.slice(0, n), error: null } : { data: null, error: { message: 'Failed to fetch' } }) },
          }
          return q
        },
      }
    },
    storage: { from: () => ({
      upload: (p: string, b: Blob) => { bucket[p] = b; return Promise.resolve({ error: null }) },
      download: (p: string) => Promise.resolve(bucket[p] ? { data: bucket[p], error: null } : { data: null, error: { message: 'not found' } }),
    }) },
  },
}))

import { db, outbox } from '../src/lib/db'
import { startSync, settle, onRemoteChange, onSyncStatus, fetchPhoto, type SyncStatus } from '../src/lib/sync'
import type { Job } from '../src/lib/types'

const CO = '11111111-1111-1111-1111-111111111111'
const job = (id: string, name: string): Job => ({ id, name, client: '', address: '', contractRef: '', poNumber: '', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 0 })
let last: SyncStatus = { state: 'idle', pending: 0 }

beforeAll(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  onSyncStatus(s => { last = s })
})

describe('cloud sync', () => {
  it('jobs already on the phone upload on first sign-in (College Park comes with you)', async () => {
    await db.putJob(job('j-existing', 'College Park'))          // written before sync started: not queued
    await db.putPhoto('ph1', new Blob(['jpeg'], { type: 'image/jpeg' }))
    await db.putJob({ ...job('j-existing', 'College Park'), photoId: 'ph1' })
    await startSync(CO)
    await settle()
    expect(cloud.jobs.find(r => r.id === 'j-existing')).toBeTruthy()
    expect(cloud.jobs.find(r => r.id === 'j-existing')!.company_id).toBe(CO)
    expect(bucket[`${CO}/ph1.jpg`]).toBeTruthy()
    expect(await outbox.count()).toBe(0)
    expect(last.state).toBe('synced')
  })

  it('a change made on the phone reaches the cloud', async () => {
    await db.putJob(job('j2', 'Kensington'))
    await settle()
    expect((cloud.jobs.find(r => r.id === 'j2')!.data as Job).name).toBe('Kensington')
  })

  it('a change made on another device arrives, and the screen is told to refresh', async () => {
    let told = 0; const off = onRemoteChange(() => told++)
    cloud.jobs.push({ id: 'j3', company_id: CO, job_id: 'j3', data: job('j3', 'From the laptop'), deleted: false, updated_at: stamp() })
    await settle()
    expect((await db.jobs()).find(j => j.id === 'j3')?.name).toBe('From the laptop')
    expect(told).toBeGreaterThan(0); off()
  })

  it('no signal: changes are kept on the phone and queued, then sync when signal returns', async () => {
    online = false
    await db.putJob(job('j2', 'Kensington — edited on site'))
    await settle()
    expect(last.state).toBe('offline')
    expect(last.pending).toBeGreaterThan(0)
    expect((await db.jobs()).find(j => j.id === 'j2')?.name).toBe('Kensington — edited on site')
    online = true
    await settle()
    expect(await outbox.count()).toBe(0)
    expect((cloud.jobs.find(r => r.id === 'j2')!.data as Job).name).toBe('Kensington — edited on site')
  })

  it('an unsent local edit is never overwritten by an older cloud copy', async () => {
    online = false
    await db.putJob(job('j3', 'Mine, not sent yet'))
    const row = cloud.jobs.find(r => r.id === 'j3')!
    row.data = job('j3', 'Someone else'); row.updated_at = stamp()
    online = true
    await settle()
    expect((await db.jobs()).find(j => j.id === 'j3')?.name).toBe('Mine, not sent yet')
  })

  it('deletes travel between devices', async () => {
    await db.deleteJob('j2')
    await settle()
    expect(cloud.jobs.find(r => r.id === 'j2')!.deleted).toBe(true)
    const r = cloud.jobs.find(x => x.id === 'j3')!; r.deleted = true; r.updated_at = stamp()
    await settle()
    expect((await db.jobs()).find(j => j.id === 'j3')).toBeUndefined()
  })

  it('a photo taken on another device is fetched from the cloud', async () => {
    bucket[`${CO}/ph-remote.jpg`] = new Blob(['x'], { type: 'image/jpeg' })
    expect(await db.photo('ph-remote')).toBeUndefined()
    expect(await fetchPhoto('ph-remote')).toBeTruthy()
    expect(await db.photo('ph-remote')).toBeTruthy()
  })
})
