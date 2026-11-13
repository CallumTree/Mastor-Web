/**
 * End-to-end user journeys, driven through the real screens.
 * The AI is replaced by a stand-in that returns the real CR00290 lines (58 items, £34,613.81).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from '../src/App'

const TSV = readFileSync(join(process.cwd(), 'tests/boq-rooms.tsv'), 'utf8')
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/api/parse-boq')) return new Response(JSON.stringify({ text: TSV, truncated: false }), { status: 200 })
    return new Response('{}', { status: 404 })
  }))
})

// issued = locked: the lock is a drawn icon next to the text

describe('Park Road, end to end', () => {
  it('create job → import BoQ → scope → valuations → issue → VAL II → VOs → survives reload', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })

    // --- new job
    click(await screen.findByRole('button', { name: /set it up by hand/i }))   // no client pack in this test: the job is set up by hand
    type('Job name *', '32 Park Road')
    type('Client', 'Example Council')
    type(/^Client’s invoice address/, 'Finance, Civic Centre, Anytown, AB1 2CD')
    type(/PO number/i, 'PO26061')
    type(/PO value/i, '40159.68')
    type('Uplift 1 (%)', '12.643')
    type('Uplift 2 (%)', '3')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('32 Park Road')

    // --- import BoQ
    nav('scope')
    click(await screen.findByRole('button', { name: 'Import' })); click(within(document.querySelector('.sheet') as HTMLElement).getByRole('button', { name: /^Scope/ }))
    const input = document.querySelector('input[type=file][accept*=".pdf"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'CR00290.csv', { type: 'text/csv' })] } })
    await screen.findByText(/check before importing/i)
    expect(screen.getByText('£34,613.81')).toBeTruthy()
    expect(screen.getByText(/matches your contract value once uplifts are applied/i)).toBeTruthy()
    click(screen.getByRole('button', { name: 'Import 58 items' }))

    // --- scope saved
    await waitFor(() => expect(screen.getAllByRole('button', { name: /add to valuation/i }).length).toBeGreaterThan(0))
    expect(screen.getAllByText('Bathroom').length).toBeGreaterThan(0)
    const ticks = () => screen.getAllByRole('button', { name: /add to valuation/i })
    expect(ticks().length).toBe(58)

    // --- tick two into VAL I
    click(ticks()[0]); await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(1))
    click(ticks()[0]); await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2))

    // --- valuation shows both; remove one → back to live
    nav('vals')
    await screen.findByRole('button', { name: /^send val i for £/i })
    const removes = screen.getAllByRole('button', { name: /remove from valuation/i })
    expect(removes.length).toBe(2)
    click(removes[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /remove from valuation/i }).length).toBe(1))
    nav('scope')
    await waitFor(() => expect(ticks().length).toBe(57))

    // --- issue VAL I → locked
    nav('vals')
    click(await screen.findByRole('button', { name: /^send val i for £/i }))   // one deliberate tap: the figure is on the button
    await screen.findAllByText(/^With client · For review/)
    nav('scope')
    const locked = await screen.findAllByRole('button', { name: 'In an issued valuation (locked)' })   // ticked lines carry the lock, not a label
    expect(locked.length).toBe(1)

    // --- next tick opens VAL II
    click(ticks()[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(1))   // into VAL II, the one open now

    // --- log a variation, price it, tick it into VAL II
    nav('scope')
    click(await screen.findByRole('button', { name: /^add vo$/i }))
    type(/extra work/i, 'Replace rotten joists under bath')
    type('Where', 'Bathroom')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await screen.findByText('VO I')
    expect(screen.getByText(/price it/i)).toBeTruthy()
    click(screen.getByRole('button', { name: /Replace rotten joists under bath/ }))
    type('Qty', '2'); type('Rate (£)', '85.50'); type('SoR code', '3051AB')
    click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByText(/^price it$/i)).toBeNull())
    // the VO sits in Scope with the lines: tick it there, like any line
    click(within(screen.getByText('Replace rotten joists under bath').closest('.vo-line') as HTMLElement).getByRole('button', { name: /add to valuation/i }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2))
    nav('vals')
    expect((await screen.findAllByText(/VO I/)).length).toBeGreaterThan(0)   // its line in VAL II (and the check above the send button that it isn't instructed yet)

    // --- everything survives a full reload
    cleanup()
    render(<App />)
    await screen.findByRole('heading', { name: '32 Park Road' })   // still in the job after the reload
    nav('scope')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'In an issued valuation (locked)' }).length).toBe(1))   // after a reload: VAL I's line locked
    expect(screen.getAllByRole('button', { name: 'Remove from valuation' }).length).toBe(2)   // the line and the VO ticked into VAL II, side by side

    // --- the money across all jobs reflects it
    cleanup()
    render(<App />)
    click(await screen.findByRole('button', { name: 'Jobs' }))   // the reload kept the job open; back to the list
    click(await screen.findByRole('button', { name: /money across all jobs/i }))
    await screen.findByRole('heading', { name: 'Money across all jobs' })
    expect(screen.getByText('Certified this year')).toBeTruthy()
    // in Chase payment (VAL I is owed) and in the jobs list
    expect(screen.getAllByText('32 Park Road').length).toBe(2)
    expect(screen.getByText(/Chase payment · 1/)).toBeTruthy()
  })
})
