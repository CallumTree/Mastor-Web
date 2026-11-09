import { it, expect } from 'vitest'
import { db, rates } from '../src/lib/db'
import { fileIds, makeBackup, restoreBackup } from '../src/lib/backup'
import type { CompanySettings, Job } from '../src/lib/types'
import { blankSettings } from '../src/lib/types'

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

it('the backup carries the company details, the rate books and the client’s VO documents', async () => {
  const settings: CompanySettings = { ...blankSettings(), name: 'Example Builders Ltd', nextInvoiceNumber: 1042 }
  await db.putSettings(settings)
  await rates.put('book1', [{ bookId: 'book1', code: '2032AA', short: 'SLATE: STRIP AND RENEW', unit: 'SM', rate: 71.37 } as never])
  await db.putJob({ id: 'bv', name: 'VO Row', client: '', address: '', contractRef: '', poNumber: '', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 })
  await db.putVariation({ id: 'v1', jobId: 'bv', number: 1, description: 'Gutter', room: '', qty: 1, unit: 'IT', rate: 10, code: '', reason: '', clientRef: 'VO-1', status: 'Instructed', photoIds: [], dateRaised: 1, attachments: [{ id: 'doc1', name: 'VO-1.pdf', type: 'application/pdf' }] })
  const text = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); makeBackup().then(b => r.readAsText(b)) })
  const b = JSON.parse(text)
  expect(b.settings?.name).toBe('Example Builders Ltd')
  expect(b.rates?.some((x: { code: string }) => x.code === '2032AA')).toBe(true)
  expect(fileIds(b.jobs, b.variations, b.diary ?? [], b.more)).toContain('doc1')   // the client’s VO document goes with it
  // a later, older backup never winds the invoice numbers back on a device that has its own details
  await db.putSettings({ ...settings, nextInvoiceNumber: 1050 })
  await restoreBackup(text)
  expect((await db.settings())?.nextInvoiceNumber).toBe(1050)
})
