/**
 * The client's review, through the real screens: send VAL I for review (locked), the client asks for changes
 * (on the job's notes), a line comes out while it's open to amend, it goes again, the client agrees, and the
 * invoice is next. The valuation week says when the last one went.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(async () => { cleanup(); await wipeLocal() })

describe('the client’s review', () => {
  it('sent → changes asked → a line out → sent again → agreed → invoice next', async () => {
    await db.putJob({ id: 'jr', name: '18 Precelly Place', client: 'PCC', address: '', contractRef: 'PP18', poNumber: 'PO18', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job)
    await db.putValuation({ id: 'v1', jobId: 'jr', number: 1, status: 'Open', createdAt: 1, issuedAt: null })
    await db.putScope({ id: 'k', jobId: 'jr', code: 'K1', description: 'Kitchen refit', room: 'Kitchen', qty: 1, unit: 'nr', rate: 4000, valuationId: 'v1', order: 1, createdAt: 1 })
    await db.putScope({ id: 'w', jobId: 'jr', code: 'W1', description: 'Wet room', room: 'Bathroom', qty: 1, unit: 'nr', rate: 3000, valuationId: 'v1', order: 2, createdAt: 1 })

    render(<App />)
    click(await screen.findByRole('button', { name: /18 Precelly Place/ }))
    nav('vals')
    const week = await screen.findByLabelText('Valuation week')
    expect(within(week).getByText('None yet')).toBeTruthy()

    // send it: locked while the client reviews it
    click(await screen.findByRole('button', { name: 'Send VAL I for review' }))
    click(await screen.findByRole('button', { name: /^send val i for £7,000\.00/i }))
    click(await screen.findByRole('button', { name: 'Done' }))
    await screen.findAllByText(/^With client · For review · 0 days/)
    expect(within(screen.getByLabelText('Valuation week')).getByText(/^VAL I · /)).toBeTruthy()   // when the last one went
    expect(screen.queryByRole('button', { name: /mark as paid/i })).toBeNull()

    // the client wants changes: say what, and it opens to amend
    click(screen.getByRole('button', { name: 'Client wants changes' }))
    fireEvent.change(screen.getByLabelText('What did they ask for?'), { target: { value: 'Wet room not finished — take it out' } })
    click(screen.getByRole('button', { name: 'Open VAL I to amend' }))
    await screen.findByText('Wet room not finished — take it out')
    expect(screen.getByText('Changes')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2)
    click(within(screen.getByText('Wet room').closest('.val-line') as HTMLElement).getByRole('button', { name: 'Remove from valuation' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(1))
    expect((await db.scope('jr')).find(i => i.id === 'w')!.valuationId).toBeNull()   // back to live, for the next one

    // on record in the job's notes
    expect((await db.diary('jr')).some(e => e.type === 'note' && e.category === 'Commercial' && e.note === 'VAL I: the client asked for changes — Wet room not finished — take it out')).toBe(true)

    // sent again for the new figure
    click(screen.getByRole('button', { name: 'Send VAL I again' }))
    click(await screen.findByRole('button', { name: /^send val i for £4,000\.00/i }))
    await screen.findByText(/VAL I sent again for £4,000\.00 — locked/)
    click(screen.getByRole('button', { name: 'Done' }))
    await screen.findAllByText(/^With client · For review · 0 days · sent 2nd time/)

    // agreed: the invoice is next
    click(screen.getByRole('button', { name: 'Client agreed' }))
    await screen.findByText(/^Agreed .* · create the invoice$/)
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy()
    const [v] = await db.valuations('jr')
    expect(v.review?.rounds).toBe(2); expect(v.review?.agreedAt).toBeTruthy(); expect(v.issuedAt).toBeTruthy()
  })
})
