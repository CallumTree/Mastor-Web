/**
 * The client's review, through the real screens: send VAL I for review (locked), the client asks for changes
 * (on the job's notes), a line comes out while it's open to amend, it goes again, the client agrees, and the
 * invoice is next. When the next one goes in is said once, on its card.
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
    await db.putJob({ id: 'jr', name: '18 Example Place', client: 'Example Council', address: '', contractRef: 'PP18', poNumber: 'PO18', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job)
    await db.putValuation({ id: 'v1', jobId: 'jr', number: 1, status: 'Open', createdAt: 1, issuedAt: null })
    await db.putScope({ id: 'k', jobId: 'jr', code: 'K1', description: 'Kitchen refit', room: 'Kitchen', qty: 1, unit: 'nr', rate: 4000, valuationId: 'v1', order: 1, createdAt: 1 })
    await db.putScope({ id: 'w', jobId: 'jr', code: 'W1', description: 'Wet room', room: 'Bathroom', qty: 1, unit: 'nr', rate: 3000, valuationId: 'v1', order: 2, createdAt: 1 })

    render(<App />)
    click(await screen.findByRole('button', { name: /18 Example Place/ }))
    nav('vals')
    // when it goes in is said once, on the valuation's own card (this job is long overdue: late)
    await screen.findByText(/^Late · due /)

    // send it: locked while the client reviews it
    click(await screen.findByRole('button', { name: /^send val i for £7,000\.00/i }))   // one deliberate tap, no second screen
    expect(document.querySelector('.sheet')).toBeNull()
    // sending hands over the certificate and closes: no second sheet to dismiss
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    await screen.findAllByText(/^With client · For review · sent today/)
    expect(document.querySelector('.vo-row-wrap .ref-roman')?.textContent).toBe('VAL I')   // the last one sent heads the list
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
    click(await screen.findByRole('button', { name: /^send val i again for £4,000\.00/i }))
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    await screen.findAllByText(/^With client · For review · sent today · sent 2nd time/)

    // agreed: the row opens the invoice; with no company details yet, agreement is recorded on its own, on purpose
    click(screen.getByRole('button', { name: 'Agreed — create invoice' }))
    await screen.findByText(/before your first invoice/i)
    click(screen.getByRole('button', { name: /^record val i agreed, invoice it later$/i }))
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    await screen.findByText(/^Agreed .* · create the invoice$/)
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy()
    const [v] = await db.valuations('jr')
    expect(v.review?.rounds).toBe(2); expect(v.review?.agreedAt).toBeTruthy(); expect(v.issuedAt).toBeTruthy()
  })
})
