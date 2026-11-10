import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../src/App'
import { text } from './text'
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const closed = () => waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

async function issueOne(desc: string, rate: string, valNo: number) {
  nav('scope')
  click(await screen.findByRole('button', { name: 'Scope options' })); click(screen.getByRole('button', { name: /^add a scope line/i }))
  type('Description *', desc); type('Qty', '1'); type('Rate (£)', rate)
  click(screen.getAllByRole('button', { name: 'Add line' }).at(-1)!); await closed()
  await waitFor(() => expect(screen.getByText(desc)).toBeTruthy())
  click((await screen.findAllByRole('button', { name: /add to valuation/i }))[0])
  nav('vals')
  click(await screen.findByRole('button', { name: new RegExp(`^send val ${'i'.repeat(valNo)} for £`, 'i') }))   // one deliberate tap: the figure is on the button
  // sent for review and locked; this client agreed it straight away, so the invoice is the next step on its row
  await closed()
  await screen.findAllByText(/^With client · For review/)
  return () => click(screen.getAllByRole('button', { name: 'Agreed — create invoice' })[0])
}

describe('VAT invoicing', () => {
  it('needs company details first, numbers carry on and never repeat, payment expects VAT', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    click(screen.getByRole('button', { name: /new job/i }))
    click(await screen.findByRole('button', { name: /set it up by hand/i }))   // no client pack in this test: the job is set up by hand
    type('Job name *', 'Invoice Close'); type('Client', 'Example Council'); type(/^Client’s invoice address/, 'Finance, Civic Centre, Anytown, AB1 2CD'); type(/PO number/i, 'PC1')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Invoice Close')

    const invoiceFirst = await issueOne('Bathroom upgrade', '1000', 1)
    invoiceFirst()
    await screen.findByText(/before your first invoice/i)
    click(screen.getByRole('button', { name: /open company settings/i }))
    type('Company name *', 'Example Builders Ltd'); type(/address \*/i, '1 Station Yard, Anytown')
    type('VAT number *', 'GB123456789'); type('Sort code *', '12-34-56'); type('Account no. *', '12345678')
    type('Prefix', 'TS-'); type(/next invoice number/i, '1042')
    await screen.findByText('TS-1042')
    click(screen.getByRole('button', { name: 'Save' })); await closed()

    // nothing was recorded when the details were missing: the row still asks for agreement, and creating the invoice records it
    click(await screen.findByRole('button', { name: 'Agreed — create invoice' }))
    await screen.findByText('£200.00')                                  // VAT @ 20% on £1,000
    click(screen.getByRole('button', { name: 'Create invoice TS-1042' })); await closed()
    await screen.findByText('TS-1042')
    expect(screen.getAllByText(text(/£1,200\.00 incl\. VAT/)).some(el => !el.closest('.ledger'))).toBe(true)   // on the valuation (the ledger also says what's owed)

    // payment is never assumed: the amount is blank, and 'paid in full' at the invoice total incl. VAT is one tap
    click(screen.getByRole('button', { name: /mark as paid/i }))
    const amount = screen.getByLabelText(/amount received/i) as HTMLInputElement
    expect(amount.value).toBe('')
    click(screen.getByRole('button', { name: /paid in full · £1,200\.00/i })); await closed()
    await screen.findByText(/^Paid /)

    // second valuation → next number
    ;(await issueOne('Kitchen upgrade', '500', 2))()
    click(await screen.findByRole('button', { name: 'Create invoice TS-1043' })); await closed()
    await screen.findByText('TS-1043')
  })
})
