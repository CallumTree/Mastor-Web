import { it, expect } from 'vitest'
import { db } from '../src/lib/db'
import { makeBackup, restoreBackup } from '../src/lib/backup'
import type { Job } from '../src/lib/types'

it('backup → wipe → restore brings every job back intact', async () => {
  const job: Job = { id: 'bj', name: 'Backup Park', client: 'C', address: '', contractRef: 'X1', poNumber: 'P1', contractValue: 100, uplift1: 1, uplift2: 2, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
  await db.putJob(job)
  await db.putScope({ id: 'bs', jobId: 'bj', code: 'A1', description: 'd', room: 'K', qty: 2, unit: 'nr', rate: 3, valuationId: null, order: 1, createdAt: 1 })
  const text = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); makeBackup().then(b => r.readAsText(b)) })
  await db.deleteJob('bj')
  expect((await db.jobs()).find(j => j.id === 'bj')).toBeUndefined()
  const r = await restoreBackup(text)
  expect(r.jobs).toBeGreaterThan(0)
  expect((await db.jobs()).find(j => j.id === 'bj')?.name).toBe('Backup Park')
  expect((await db.scope('bj')).length).toBe(1)
})
