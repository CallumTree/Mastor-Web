/** Costs & margin through the screens: compare two scaffold quotes, accept one, see the margin. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1)!, { target: { value } })

describe('costs and margin', () => {
  it('quotes are compared against what the client pays; the accepted one sets the margin', async () => {
    const job: Job = { id: 'jc', name: '9 Quay Street', client: 'PCC', address: '', contractRef: 'Q9', poNumber: 'PO1', contractValue: 0, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    await db.putScope({ id: 's1', jobId: 'jc', code: '2401AA', description: 'Scaffold', room: 'Front', qty: 100, unit: 'SM', rate: 20, valuationId: null, order: 1, workstream: 'Scaffold', createdAt: 1 })
    await db.putScope({ id: 's2', jobId: 'jc', code: '4360BD', description: 'Paint', room: 'Front', qty: 100, unit: 'SM', rate: 10, valuationId: null, order: 2, workstream: 'Paint', createdAt: 1 })
    render(<App />)
    click(await screen.findByRole('button', { name: /9 Quay Street/ }))
    click(await screen.findByRole('button', { name: /costs and margin/i }))
    await screen.findByText(/Costs & margin/)
    expect(screen.getAllByText('£3,300.00').length).toBe(2)      // value (2,000 + 1,000) × 1.10, and margin with no costs yet

    for (const [who, amt] of [['Haven Scaffolding', '1500'], ['Cleddau Access', '1250']]) {
      click(screen.getByRole('button', { name: '+ Add a quote for Scaffold' }))
      type(/^Who/, who); type(/^Amount/, amt)
      click(screen.getByRole('button', { name: 'Add cost' }))
      await waitFor(() => expect(screen.getAllByText(who).length).toBe(2))   // in the trade comparison and the cost list
    }
    const scaff = screen.getByText('Scaffold', { selector: '.trade-head b' }).closest('.trade') as HTMLElement
    // client pays £2,200 for scaffold with uplifts; cheapest quote listed first
    expect(within(scaff).getAllByText(/Scaffolding|Access/)[0].textContent).toBe('Cleddau Access')
    expect(within(scaff).getByText('£950.00')).toBeTruthy()  // 2,200 − 1,250
    click(within(scaff).getAllByRole('button', { name: 'Accept' })[0])
    await waitFor(() => expect(screen.getByText('£2,050.00')).toBeTruthy())   // margin 3,300 − 1,250
    expect(screen.getByText('62.1% of value')).toBeTruthy()
  })
})
