/**
 * Responsive contract: add a works order priced from the SoR, mark it done, then claim completed
 * orders into the month's valuation.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, rates, wipeLocal } from '../src/lib/db'
import { blankSettings } from '../src/lib/types'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1)!, { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

describe('small works orders', () => {
  it('new order from the SoR → done → claimed in the monthly valuation', async () => {
    await db.putSettings({ ...blankSettings(), name: 'Tree & Sons', rateBooks: [{ id: 'rb', name: 'Responsive v8', source: 'r.docx', notes: [], lines: 1, importedAt: 1 }] })
    await rates.put('rb', [{ bookId: 'rb', code: '015003', short: 'FLOOR:RENEW INTERNAL CONCRETE', long: '', unit: 'SM', rate: 228.62, section: 'FOUNDATIONS', subsection: '' }])

    render(<App />)
    click(await screen.findByRole('button', { name: /new job/i }))
    click(screen.getByLabelText(/Responsive or voids contract/))
    type('Job name *', 'PCC Responsive 2026')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('No orders yet')
    nav('orders')

    click(await screen.findByRole('button', { name: /^New order$/ }))
    type(/^Order number/, 'R-104882')
    type(/^Address/, '14 Bush Street, Pembroke Dock')
    click(screen.getByRole('button', { name: 'Urgent' }))
    type('Add an SoR code', '015003')
    click(await screen.findByRole('button', { name: 'Use £228.62' }))
    type('Qty for 015003', '2.5')
    expect(screen.getByText(/Work · 1 line · £571.55/)).toBeTruthy()
    click(screen.getByRole('button', { name: 'Mark done' }))

    click(await screen.findByRole('button', { name: /Complete · 1/ }))
    await screen.findByText('14 Bush Street, Pembroke Dock')
    expect(screen.getByText('No after photos')).toBeTruthy()

    click(screen.getByRole('button', { name: 'Claim 1 completed' }))
    await screen.findByText('Done · claimed')
    nav('vals')
    await waitFor(() => expect(screen.getAllByText('£571.55').length).toBeGreaterThan(0))
    const lines = await db.scope((await db.jobs())[0].id)
    expect(lines[0].property).toBe('R-104882')
    expect(lines[0].valuationId).toBeTruthy()
  })
})
