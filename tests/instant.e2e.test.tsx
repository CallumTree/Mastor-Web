/** Saves show at once: a tick is on screen before the device write lands, and a write that fails is said and undone. */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'

const told = vi.hoisted(() => ({ said: [] as string[] }))
vi.mock('../src/components/Problem', async orig => ({ ...(await orig<typeof import('../src/components/Problem')>()), tell: (_e: unknown, text: string) => { told.said.push(text) } }))
afterAll(async () => { cleanup(); vi.restoreAllMocks(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

describe('instant saves', () => {
  it('a tick shows before the write lands; a failed write is said and the screen goes back', async () => {
    await db.putJob({ id: 'ji', name: 'Quick Lane', client: 'Example Council', address: '', contractRef: '', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 })
    await db.putValuation({ id: 'v1', jobId: 'ji', number: 1, status: 'Open', createdAt: 1, issuedAt: null })
    await db.putScope({ id: 'a', jobId: 'ji', code: '4360BD', description: 'Masonry paint', room: 'Front', qty: 10, unit: 'SM', rate: 5, valuationId: null, order: 1, createdAt: 1 })
    await db.putScope({ id: 'b', jobId: 'ji', code: '4350AA', description: 'Gutter clean', room: 'Front', qty: 4, unit: 'LM', rate: 3, valuationId: null, order: 2, createdAt: 1 })

    render(<App />)
    click(await screen.findByRole('button', { name: /Quick Lane/ }))
    nav('scope')
    const ticks = await screen.findAllByRole('button', { name: 'Add to valuation' })
    expect(ticks.length).toBe(2)

    // hold the device write: the tick must already be on screen
    let land!: () => void
    const real = db.putScopeMany
    const spy = vi.spyOn(db, 'putScopeMany').mockImplementationOnce(async items => { await new Promise<void>(r => { land = r }); return real(items) })
    click(ticks[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(1))
    expect((await db.scope('ji')).find(i => i.id === 'a')!.valuationId).toBeNull()        // not written yet
    // a second tick made meanwhile stays on screen too (the re-read waits for the last write)
    click(screen.getAllByRole('button', { name: 'Add to valuation' })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2))
    land()
    await waitFor(async () => expect((await db.scope('ji')).every(i => i.valuationId === 'v1')).toBe(true))
    expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2)

    // a write that fails: said in plain words, and the tick comes back as the device has it
    spy.mockImplementationOnce(async () => { throw new Error('disk full') })
    click(screen.getAllByRole('button', { name: 'Remove from valuation' })[0])
    await waitFor(() => expect(told.said.some(t => /didn’t save on this device/.test(t))).toBe(true))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2))
    expect((await db.scope('ji')).every(i => i.valuationId === 'v1')).toBe(true)
  })
})
