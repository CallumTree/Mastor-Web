/** VOs live in Scope, at their house: added at a house, they sit in that house's block with its lines, count in its
 *  total and tick into the valuation like any line; a client's VO schedule is read like a spec list, a VO per line. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job, ScopeItem } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(async () => { cleanup(); vi.unstubAllGlobals(); await wipeLocal() })

const line = (id: string, property: string, code: string, description: string, qty: number, rate: number, order: number): ScopeItem =>
  ({ id, jobId: 'jv', code, description, room: 'General', qty, unit: 'SM', rate, valuationId: null, order, createdAt: 1, property, workstream: 'Roofing' })

describe('VOs in Scope', () => {
  it('a VO at a house sits with that house’s lines, counts in its total and ticks like a line', async () => {
    const job: Job = { id: 'jv', name: 'Elm Row', client: '', address: '', contractRef: '', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1,
      kind: 'scheme', properties: { 3: '3 Elm Row, Anytown', 5: '5 Elm Row, Anytown' } }
    await db.putJob(job)
    await db.putScope(line('a', '3', '2032AA', 'Slate: strip and renew', 18, 71.37, 1))
    await db.putScope(line('b', '5', '2032AA', 'Slate: strip and renew', 22, 71.37, 2))
    render(<App />)
    click(await screen.findByRole('button', { name: /^Elm Row/ }))
    await screen.findByRole('heading', { name: 'Elm Row' })
    expect(screen.getAllByRole('button').filter(b => b.closest('nav')).map(b => b.textContent)).toEqual(['', 'Home', 'Diary', 'Scope', 'Vals'])   // the capture key, then four tabs: no VOs tab
    nav('scope')

    // add a VO at No. 5, from Scope
    click(await screen.findByRole('button', { name: /^add vo$/i }))
    click(await screen.findByRole('button', { name: '5 Elm Row' }))
    type(/extra work/i, 'Replace gutter at the back'); type('Where', 'Rear')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await waitFor(async () => expect((await db.variations('jv'))[0]).toMatchObject({ property: '5', room: 'Rear', number: 1 }))

    // No. 5's row says it has a VO; open it and the VO is there, with the house's lines
    const five = await screen.findByRole('button', { name: 'Property 5, 1 VO' })
    expect(screen.getByRole('button', { name: 'Property 3' })).toBeTruthy()   // No. 3 has none
    click(five)
    const vo = (await screen.findByText('Replace gutter at the back')).closest('.vo-line') as HTMLElement
    expect(within(vo).getByText('VO I')).toBeTruthy()
    expect(within(vo).queryByRole('button', { name: /add to valuation/i })).toBeNull()   // unpriced: nothing to tick yet

    // price it, tick it: No. 5's total takes it in
    click(within(vo).getByRole('button', { name: /VO I: Replace gutter/ }))
    type('Qty', '4'); type('Rate (£)', '25')
    click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(screen.getByText('Replace gutter at the back').closest('.vo-line') as HTMLElement).getByRole('button', { name: /add to valuation/i })).toBeTruthy())
    click(within(screen.getByText('Replace gutter at the back').closest('.vo-line') as HTMLElement).getByRole('button', { name: /add to valuation/i }))
    await waitFor(async () => expect((await db.variations('jv'))[0].valuationId).toBeTruthy())
    expect(within(screen.getByRole('button', { name: 'Property 5, 1 VO' })).getByText('£1,670.14')).toBeTruthy()   // 22 × 71.37 + 4 × 25

    // the VOs view: the register at a glance
    click(screen.getByRole('button', { name: /^VOs/ }))
    expect(await screen.findByLabelText('Variation summary')).toBeTruthy()
    click(screen.getByRole('button', { name: 'All' }))

    // the client's VO schedule, laid out like a spec list: a VO per line, at its house, instructed under their ref
    click(screen.getByRole('button', { name: /^import vos$/i }))
    const sheet = XLSX.utils.aoa_to_sheet([['Code', 'Description', 'Qty', 'Unit', 'Rate', 'Total'],
      ['No. 3 Elm Row'], ['4350AA', 'Gutter: renew in uPVC', 9, 'LM', 31.2, 280.8],
      ['No. 5 Elm Row'], ['5110AB', 'Fascia: renew', 6, 'LM', 44, 264]])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet, 'VOs')
    fireEvent.change(document.querySelector('input[type=file][accept*=".pdf"]')!, { target: { files: [new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'Client VO schedule.xlsx')] } })
    await screen.findByText('Import VOs · check them')
    type(/client’s VO reference/i, 'VO-77')
    click(screen.getByRole('button', { name: 'Add 2 VOs' }))
    await waitFor(async () => expect((await db.variations('jv')).length).toBe(3))
    const added = (await db.variations('jv')).filter(v => v.clientRef === 'VO-77').sort((a, b) => a.number - b.number)
    expect(added.map(v => [v.number, v.property, v.code, v.qty, v.rate, v.status])).toEqual([[2, '3', '4350AA', 9, 31.2, 'Instructed'], [3, '5', '5110AB', 6, 44, 'Instructed']])
    expect(added[0].attachments?.[0].name).toBe('Client VO schedule.xlsx')   // the schedule kept as each VO's evidence
    expect(await screen.findByRole('button', { name: 'Property 3, 1 VO' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Property 5, 2 VOs' })).toBeTruthy()
  })
})
