/**
 * The 12 Nov fixes, through the real screens: one Send per valuation, above its lines, with what the client's QS would
 * query beside it; Vals' lines add up to the valuation exactly; and a firm that isn't VAT-registered invoices without VAT.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import { money } from '../src/lib/format'
import { valTotals } from '../src/lib/valuation'
import { blankSettings, type Job, type ScopeItem, type Variation } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const pence = (t: string) => Math.round(Number(t.replace(/[£,]/g, '')) * 100)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(async () => { cleanup(); await wipeLocal() })

const job = { id: 'jx', name: 'Send Street', client: 'Example Council', clientAddress: 'Finance, Civic Centre, Anytown', address: '', contractRef: 'SS1', poNumber: 'PO-SS1', contractValue: 0, uplift1: 7.5, uplift2: 3.1, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job
const lines = Array.from({ length: 8 }, (_, k) => ({ id: 'l' + k, jobId: 'jx', code: 'C' + k, description: `Line ${k}`, room: 'Kitchen', workstream: 'Kitchen', property: '3', qty: k + 1.5, unit: 'nr', rate: 13.37 + k * 7.11, valuationId: 'xv1', order: k, createdAt: 1 }) as ScopeItem)
const vo = { id: 'xvo', jobId: 'jx', number: 1, description: 'Extra socket', room: '', property: '3', qty: 1, unit: 'nr', rate: 170, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 1, valuationId: 'xv1' } as Variation

describe('the 12 Nov fixes', () => {
  it('one Send above the lines, with its checks; the lines add up to the valuation', async () => {
    await db.putJob(job)
    await db.putValuation({ id: 'xv1', jobId: 'jx', number: 1, status: 'Open', createdAt: Date.now(), issuedAt: null })
    for (const l of lines) await db.putScope(l)
    await db.putVariation(vo)

    render(<App />)
    click(await screen.findByRole('button', { name: /Send Street/ }))
    nav('vals')
    const sends = await screen.findAllByRole('button', { name: /^Send VAL I for £/ })
    expect(sends.length).toBe(1)
    // the uninstructed VO is said beside the one Send, and the Send comes before the first line
    const warn = await screen.findByText(/VO I isn’t instructed/)
    const first = screen.getByText('Line 0')
    expect(warn.compareDocumentPosition(sends[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sends[0].compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // every line is its share with uplifts: together, exactly the valuation's total
    const total = valTotals(job, 'xv1', lines, [vo]).gross
    const amts = [...document.querySelectorAll('.val-line .amt')].map(a => pence(a.textContent ?? ''))
    expect(amts.length).toBe(9)
    expect(amts.reduce((t, a) => t + a, 0)).toBe(Math.round(total * 100))
    expect(sends[0].textContent).toContain(money(total))
  })

  it('a firm that isn’t VAT-registered invoices without VAT or a VAT number', async () => {
    cleanup()
    await db.putSettings({ ...blankSettings(), name: 'Small Builds', address: '2 Yard Lane, Anytown', sortCode: '12-34-56', accountNumber: '12345678', invoicePrefix: 'SB-', nextInvoiceNumber: 7, vatRegistered: false, updatedAt: 1 })
    await db.putValuation({ id: 'xv1', jobId: 'jx', number: 1, status: 'Issued', createdAt: 1, issuedAt: Date.now(), review: { sentAt: Date.now(), rounds: 1 } })
    render(<App />)
    click(await screen.findByRole('button', { name: /Send Street/ }))
    nav('vals')
    click((await screen.findAllByRole('button', { name: 'Agreed — create invoice' }))[0])
    await screen.findByText('No VAT: not VAT-registered')
    expect(screen.getByText('Create invoice')).toBeTruthy()
    click(screen.getByRole('button', { name: 'Create invoice SB-7' }))
    await waitFor(async () => {
      const v = (await db.valuations('jx')).find(x => x.id === 'xv1')!
      expect(v.invoiceNumber).toBe('SB-7')
      expect(v.invoiceVatRate).toBe(0)
    })
  })
})
