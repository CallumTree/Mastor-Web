/**
 * End-to-end user journeys, driven through the real screens.
 * The AI is replaced by a stand-in that returns the real CAP00290 lines (58 items, £34,613.81).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from '../src/App'

const TSV = readFileSync(join(process.cwd(), 'tests/cap00290.tsv'), 'utf8')
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/api/parse-boq')) return new Response(JSON.stringify({ text: TSV, truncated: false }), { status: 200 })
    return new Response('{}', { status: 404 })
  }))
})

describe('College Park, end to end', () => {
  it('create job → import BoQ → scope → valuations → issue → VAL-002 → VOs → survives reload', async () => {
    render(<App />)
    await screen.findByText('MASTOR')

    // --- new job
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', '32 College Park')
    type('Client', 'Pembrokeshire County Council')
    type(/PO number/i, 'PC26061')
    type(/PO value/i, '40159.68')
    type('Uplift 1 (%)', '12.643')
    type('Uplift 2 (%)', '3')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('32 College Park')

    // --- import BoQ
    nav('scope')
    click(await screen.findByRole('button', { name: /import boq/i }))
    const input = document.querySelector('input[type=file][accept*=".pdf"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'CAP00290.csv', { type: 'text/csv' })] } })
    await screen.findByText(/check before importing/i)
    expect(screen.getByText('£34,613.81')).toBeTruthy()
    expect(screen.getByText(/matches your contract value once uplifts are applied/i)).toBeTruthy()
    click(screen.getByRole('button', { name: 'Import 58 items' }))

    // --- scope saved
    await screen.findByText('58 items')
    expect(screen.getAllByText('Bathroom').length).toBeGreaterThan(0)
    const ticks = () => screen.getAllByRole('button', { name: /add to valuation/i })
    expect(ticks().length).toBe(58)

    // --- tick two into VAL-001
    click(ticks()[0]); await waitFor(() => expect(screen.getAllByText('VAL-001').length).toBe(1))
    click(ticks()[0]); await waitFor(() => expect(screen.getAllByText('VAL-001').length).toBe(2))

    // --- valuation shows both; remove one → back to live
    nav('vals')
    await screen.findByText(/this valuation \(incl\. uplifts\)/i)
    const removes = screen.getAllByRole('button', { name: /remove from valuation/i })
    expect(removes.length).toBe(2)
    click(removes[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove from valuation/i }).length).toBe(1))
    nav('scope')
    await waitFor(() => expect(ticks().length).toBe(57))

    // --- issue VAL-001 → locked
    nav('vals')
    click(await screen.findByRole('button', { name: 'Issue VAL-001' }))
    click(await screen.findByRole('button', { name: /issue val-001 for/i }))
    await screen.findByText('🔒 Issued')
    nav('scope')
    const locked = await screen.findByText('🔒 VAL-001')
    expect(locked).toBeTruthy()

    // --- next tick opens VAL-002
    click(ticks()[0])
    await screen.findByText('VAL-002')

    // --- log a variation, price it, tick it into VAL-002
    nav('vos')
    click(await screen.findByRole('button', { name: /log variation/i }))
    type(/extra work/i, 'Replace rotten joists under bath')
    type('Where', 'Bathroom')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await screen.findByText('VO-001')
    expect(screen.getByText(/price it/i)).toBeTruthy()
    click(screen.getByText('Replace rotten joists under bath'))
    type('Qty', '2'); type('Rate (£)', '85.50'); type('SoR code', '3051AB')
    click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByText(/^price it$/i)).toBeNull())
    click(screen.getByRole('button', { name: /add to valuation/i }))
    await waitFor(() => expect(screen.getAllByText('VAL-002').length).toBeGreaterThan(0))
    nav('vals')
    await screen.findByText(/VO-001/)

    // --- everything survives a full reload
    cleanup()
    render(<App />)
    click(await screen.findByRole('button', { name: /open job/i }))
    nav('scope')
    await screen.findByText('58 items')
    expect(screen.getAllByText('🔒 VAL-001').length).toBe(1)
    expect(screen.getAllByText('VAL-002').length).toBe(1)

    // --- director dashboard reflects it
    cleanup()
    render(<App />)
    click(await screen.findByRole('button', { name: /director dashboard/i }))
    await screen.findByText(/at a glance/i)
    expect(screen.getByText('Certified this year')).toBeTruthy()
    expect(screen.getByText('32 College Park')).toBeTruthy()
  })
})
