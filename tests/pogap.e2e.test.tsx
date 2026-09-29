import { describe, it, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App'
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

describe('BoQ vs PO difference', () => {
  it('flags, can be accepted with a note, and re-flags if the difference changes', async () => {
    render(<App />)
    await screen.findByText('MASTOR')
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', 'Gap Road'); type(/PO number/i, 'PC1'); type(/PO value/i, '1000'); type('Uplift 1 (%)', '20.28'); type('Uplift 2 (%)', '5')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Gap Road')
    nav('scope')
    click(await screen.findByRole('button', { name: /add item/i }))
    type('Description *', 'Kitchen partition'); type('Qty', '1'); type('Rate (£)', '900')
    click(screen.getAllByRole('button', { name: 'Add item' }).at(-1)!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    nav('home')
    click(await screen.findByText(/doesn't reconcile with the po/i))
    type(/why \(for the record\)/i, 'Added after PO — Dylan aware')
    click(screen.getByRole('button', { name: /accept £136\.65 difference/i }))
    await screen.findByText(/accepted .* — Added after PO — Dylan aware/i)
    await waitFor(() => expect(screen.queryByText(/doesn't reconcile/i)).toBeNull())
    // change the uplifts → the difference changes → flagged again
    click(screen.getByRole('button', { name: /job setup/i }))
    type('Uplift 2 (%)', '6')
    click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/po difference has changed since you accepted it/i)
  })
})
import { expect } from 'vitest'
