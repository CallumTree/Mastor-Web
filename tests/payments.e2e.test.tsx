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
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', 'Pay Street'); type(/PO number/i, 'PO9'); type(/payment terms/i, '30')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Pay Street')

    // a priced VO → "send to client" → then waiting on the client
    nav('vos')
    click(await screen.findByRole('button', { name: /log variation/i }))
    type(/extra work/i, 'Extra socket'); type('Qty (if known)', '1')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    click(await screen.findByRole('button', { name: /Extra socket/ }))
    type('Rate (£)', '100'); click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/send to client for instruction/i)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    click(screen.getByRole('button', { name: /Extra socket/ }))
    click(await screen.findByRole('button', { name: /mark as sent to client/i }))
    click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/awaiting instruction · 0 days/i)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())

    // claim it, issue, it becomes due
    click(screen.getByRole('button', { name: /add to valuation/i }))
    nav('vals')
    click(await screen.findByRole('button', { name: 'Issue VAL I' }))
    click(await screen.findByRole('button', { name: /issue val i for/i }))
    await screen.findByText(/^Due /)

    // part payment → still owed; then paid in full
    click(screen.getByRole('button', { name: /mark as paid/i }))
    type(/amount received/i, '60')
    await screen.findByText(/will still show as owed/i)
    click(screen.getByRole('button', { name: /save payment/i }))
    await screen.findByText(/part paid · £40\.00 outstanding/i)
    click(screen.getByRole('button', { name: /edit payment/i }))
    type(/amount received/i, '100')
    click(screen.getByRole('button', { name: /save payment/i }))
    await screen.findByText(/^Paid /)

    // dashboard
    click(screen.getByRole('button', { name: /all jobs/i }))
    click(await screen.findByRole('button', { name: /director dashboard/i }))
    await screen.findByText('Paid this year')
    await waitFor(() => expect(screen.getAllByText('£100').length).toBeGreaterThan(0))
  })
})
