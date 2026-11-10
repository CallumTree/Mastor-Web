/** Ball in court + payments through the real screens. */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App'

const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

describe('payments and chasing', () => {
  it('VO sent to client, valuation issued → due → part paid → paid; dashboard follows', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    click(await screen.findByRole('button', { name: /set it up by hand/i }))   // no client pack in this test: the job is set up by hand
    type('Job name *', 'Pay Street'); type(/PO number/i, 'PO9'); type(/payment terms/i, '30')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Pay Street')

    // a priced VO → "send to client" → then waiting on the client
    nav('scope')
    click(await screen.findByRole('button', { name: /^add vo$/i }))
    type(/extra work/i, 'Extra socket'); type('Qty (if known)', '1')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    click(await screen.findByRole('button', { name: /Extra socket/ }))
    type('Rate (£)', '100'); click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/send to client for instruction/i)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    click(screen.getByRole('button', { name: /Extra socket/ }))
    click(await screen.findByRole('button', { name: /mark as sent to client/i }))   // saved on the tap: it records a date and sends nothing
    await screen.findByText(/awaiting instruction · 0 days/i)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())

    // claim it, issue, it becomes due
    click(screen.getByRole('button', { name: /add to valuation/i }))
    nav('vals')
    click(await screen.findByRole('button', { name: /^send val i for £/i }))   // one deliberate tap: the figure is on the button
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    await screen.findAllByText(/^With client · For review · sent today/)
    expect(screen.queryByRole('button', { name: /mark as paid/i })).toBeNull()   // nothing to pay until it's agreed
    click(screen.getByRole('button', { name: 'Agreed — create invoice' }))
    fireEvent.click(document.querySelector('.sheet-bg')!)                     // closing records nothing: a mis-tap commits no agreement
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    expect(screen.getByRole('button', { name: 'Agreed — create invoice' })).toBeTruthy()
    click(screen.getByRole('button', { name: 'Agreed — create invoice' }))
    click(await screen.findByRole('button', { name: /^record val i agreed, invoice it later$/i }))   // agreed on purpose, invoiced later
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    await screen.findByText(/^Agreed .* · create the invoice$/)

    // part payment → still owed; then paid in full
    click(screen.getByRole('button', { name: /mark as paid/i }))
    type(/amount received/i, '60')
    await screen.findByText(/will still show as owed/i)
    // the typed amount is the white block; "paid in full" steps back so a hurried tap can't record money that didn't land
    expect(screen.getByRole('button', { name: 'Save £60.00 received' }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: /^paid in full/i }).className).toContain('btn-secondary')
    click(screen.getByRole('button', { name: 'Save £60.00 received' }))
    await screen.findByText(/part paid · £40\.00 outstanding/i)
    click(screen.getByRole('button', { name: /edit payment/i }))
    type(/amount received/i, '100')
    click(screen.getByRole('button', { name: 'Save £100.00 received' }))
    await screen.findByText(/^Paid /)

    // dashboard
    click(screen.getByRole('button', { name: 'Jobs' }))
    click(await screen.findByRole('button', { name: /money across all jobs/i }))
    await screen.findByText('Paid this year')
    await waitFor(() => expect(screen.getAllByText('£100.00').length).toBeGreaterThan(0))   // in pence, like every other screen
  })
})
