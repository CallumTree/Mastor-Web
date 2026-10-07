import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App'
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const closed = () => waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

async function issueOne(desc: string, rate: string, valNo: number) {
  nav('scope')
  click(await screen.findByRole('button', { name: 'Add item' }))
  type('Description *', desc); type('Qty', '1'); type('Rate (£)', rate)
  click(screen.getAllByRole('button', { name: 'Add item' }).at(-1)!); await closed()
  await waitFor(() => expect(screen.getByText(desc)).toBeTruthy())
  click((await screen.findAllByRole('button', { name: /add to valuation/i }))[0])
  nav('vals')
  click(await screen.findByRole('button', { name: `Issue VAL ${'I'.repeat(valNo)}` }))
  click(await screen.findByRole('button', { name: new RegExp(`issue val ${'i'.repeat(valNo)} for`, 'i') }))
  await screen.findAllByRole('button', { name: 'Create invoice' })
}

describe('VAT invoicing', () => {
  it('needs company details first, numbers carry on and never repeat, payment expects VAT', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', 'Invoice Close'); type('Client', 'Pembrokeshire County Council'); type(/PO number/i, 'PC1')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Invoice Close')

    await issueOne('Bathroom upgrade', '1000', 1)
    click(screen.getByRole('button', { name: 'Create invoice' }))
    await screen.findByText(/before your first invoice/i)
    click(screen.getByRole('button', { name: /open company settings/i }))
    type('Company name *', 'Tree & Sons Ltd'); type(/address \*/i, 'The Reclamation Yard, Milford Haven')
    type('VAT number *', 'GB123456789'); type('Sort code *', '12-34-56'); type('Account no. *', '12345678')
    type('Prefix', 'TS-'); type(/next invoice number/i, '1042')
    await screen.findByText('TS-1042')
    click(screen.getByRole('button', { name: 'Save' })); await closed()

    click(screen.getByRole('button', { name: 'Create invoice' }))
    await screen.findByText('£200.00')                                  // VAT @ 20% on £1,000
    click(screen.getByRole('button', { name: 'Create invoice TS-1042' })); await closed()
    await screen.findByText('TS-1042')
    expect(screen.getByText(/£1,200\.00 incl\. VAT/)).toBeTruthy()

    // payment defaults to the invoice total incl. VAT
    click(screen.getByRole('button', { name: /mark as paid/i }))
    expect((screen.getByLabelText(/amount received/i) as HTMLInputElement).value).toBe('1200')
    fireEvent.click(document.querySelector('.sheet-bg')!); await closed()

    // second valuation → next number
    await issueOne('Kitchen upgrade', '500', 2)
    click(screen.getAllByRole('button', { name: 'Create invoice' })[0])
    click(await screen.findByRole('button', { name: 'Create invoice TS-1043' })); await closed()
    await screen.findByText('TS-1043')
  })
})
