/** Completion evidence PDF: an order's work, before/after photos and sign-off — and no prices. */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { db, wipeLocal } from '../src/lib/db'
import { buildEvidence, orderEvidence } from '../src/lib/evidence'
import type { Job, ScopeItem, WorkOrder } from '../src/lib/types'

afterAll(() => wipeLocal())
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDOooor5s+4P//Z'
const JPEG2 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkaKKK+8PEP//Z'
const text = (b: Blob) => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(b) })

describe('completion evidence', () => {
  it('lists the work and embeds the photos, without prices', async () => {
    const bytes = Uint8Array.from(atob(JPEG), c => c.charCodeAt(0)), bytes2 = Uint8Array.from(atob(JPEG2), c => c.charCodeAt(0))
    // the in-memory test database can't round-trip a Blob, so the photo store is stood in for
    vi.spyOn(db, 'photo').mockImplementation(async id => (id === 'b1' ? new Blob([bytes], { type: 'image/jpeg' }) : id === 'a1' ? new Blob([bytes2], { type: 'image/jpeg' }) : undefined))
    const job = { id: 'j', name: 'PCC Responsive', client: 'Pembrokeshire County Council', contractRef: 'PCC-R26' } as Job
    const o: WorkOrder = { id: 'o', jobId: 'j', ref: 'R-104882', address: '14 Bush Street', priority: 'Urgent', raisedAt: Date.UTC(2026, 9, 1), dueAt: null, status: 'complete', completedAt: Date.UTC(2026, 9, 3), note: 'Tenant out', beforeIds: ['b1'], afterIds: ['a1'], signedBy: 'Mrs Evans', createdAt: 1 }
    const line = { id: 'l', jobId: 'j', orderId: 'o', code: '015003', description: 'FLOOR:RENEW INTERNAL CONCRETE', room: '14 Bush Street', qty: 2.5, unit: 'SM', rate: 228.62, valuationId: null, order: 1, createdAt: 1 } as ScopeItem
    const pdf = await text(await buildEvidence(orderEvidence(job, o, [line], 'Tree & Sons')))
    for (const s of ['Completion evidence', 'Order R-104882', '14 Bush Street', 'Mrs Evans', '015003', 'FLOOR:RENEW INTERNAL CONCRETE', '2.50 SM', 'Before 1', 'After 1', 'TREE & SONS']) expect(pdf).toContain(s)
    expect((pdf.match(/\/Subtype \/Image/g) ?? []).length).toBe(2)
    expect(pdf).not.toContain('228.62')
    expect(pdf).not.toContain('£')
  })
})
