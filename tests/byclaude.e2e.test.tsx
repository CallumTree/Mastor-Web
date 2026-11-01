/** Claude's changes (synced in from the connector) are marked “by Claude” until a person saves them. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App'
import { db, local, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(() => wipeLocal())

describe('by Claude', () => {
  it('shows on what Claude ticked, asks for a check before issue, and goes when a person saves it', async () => {
    const at = Date.now()
    await db.putJob({ id: 'jc', name: 'Claude Close', client: 'PCC', address: '', contractRef: 'CC1', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job)
    // as a sync pull lands them: straight into local storage, mark and all
    await local.put('valuations', { id: 'vc', jobId: 'jc', number: 1, status: 'Open', createdAt: at, issuedAt: null, byClaude: at })
    await local.put('scope', { id: 'sc', jobId: 'jc', code: '4360BD', description: 'Masonry paint', room: 'Walls', qty: 10, unit: 'SM', rate: 5, valuationId: 'vc', order: 1, createdAt: 1, byClaude: at })
    await local.put('scope', { id: 'sp', jobId: 'jc', code: '4361BD', description: 'Gloss doors', room: 'Walls', qty: 2, unit: 'NO', rate: 20, valuationId: null, order: 2, createdAt: 1 })
    await local.put('diary', { id: 'nc', jobId: 'jc', date: '2026-10-20', type: 'note', note: 'Dylan agreed the skip position', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: at, category: 'Client', byClaude: at })

    render(<App />)
    click(await screen.findByRole('button', { name: /Claude Close/ }))
    await screen.findByText('Dylan agreed the skip position')
    expect(screen.getAllByText('by Claude').length).toBe(1)          // the note, on Home

    nav('vals')
    await screen.findByText('Masonry paint')
    expect(screen.getAllByText('by Claude').length).toBe(1)          // the line in VAL I
    click(screen.getByRole('button', { name: 'Send VAL I for review' }))
    await screen.findByText(/Claude added 1 line \(marked “by Claude”\) — check it before you send it/)
    fireEvent.click(document.querySelector('.sheet-bg')!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())

    nav('scope')
    await screen.findByText('Masonry paint')
    expect(screen.getAllByText('by Claude').length).toBe(1)
    // a person takes it out and puts it back: it's theirs now
    click(screen.getByRole('button', { name: 'Remove from valuation' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Add to valuation' }).length).toBe(2))
    click(screen.getAllByRole('button', { name: 'Add to valuation' })[0])
    await waitFor(() => expect(screen.queryByText('by Claude')).toBeNull())
    expect((await db.scope('jc')).every(i => i.byClaude == null)).toBe(true)
  })
})
