/**
 * The 11 Nov review's fixes, through the real screens: the job's money is the same figure on the jobs list, Home and
 * Scope (with uplifts, the houses adding up to Home's figures); a job's trades never share a colour; and marking a
 * valuation sent can be taken back for a few seconds.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import { money } from '../src/lib/format'
import { jobWorth } from '../src/lib/valuation'
import type { Job, ScopeItem, Variation } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const pounds = (t: string) => Number(t.replace(/[£,]/g, ''))
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(async () => { cleanup(); await wipeLocal() })

const job = { id: 'jl', name: 'Launch Row', client: 'Example Council', address: '', contractRef: 'LR1', poNumber: 'PO-LR1', contractValue: 0, uplift1: 10, uplift2: 2.5, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job
const line = (id: string, property: string, workstream: string, qty: number, rate: number, order: number) =>
  ({ id, jobId: 'jl', code: id.toUpperCase(), description: `${workstream} work ${id}`, room: 'Property', workstream, property, qty, unit: 'nr', rate, valuationId: null, order, createdAt: 1 }) as ScopeItem
const scope = [
  line('a', '1', 'Kitchen', 1, 1000, 1), line('b', '1', 'PPR Repairs', 3, 33.33, 2), line('c', '1', 'WHQS', 2, 250.55, 3), line('d', '1', 'Roofing', 1, 77.77, 4),
  line('e', '2', 'Kitchen', 1, 812.4, 5),
]
const vo = { id: 'vo1', jobId: 'jl', number: 1, description: 'Extra socket', room: '', property: '1', qty: 1, unit: 'nr', rate: 170, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 1 } as Variation

describe('the 11 Nov fixes', () => {
  it('one figure for the job everywhere, houses that add up, a colour per trade', async () => {
    await db.putJob(job)
    for (const i of scope) await db.putScope(i)
    await db.putVariation(vo)
    const worth = jobWorth(job, scope, [vo])

    render(<App />)
    // the jobs list's Contract is Home's Contract (the scope with uplifts, there being no contract value)
    const row = await screen.findByRole('button', { name: /Launch Row/ })
    expect(row.querySelector('.jr-value')!.textContent).toBe(money(worth.contract))
    click(row)
    await screen.findAllByText(money(worth.contract))

    // Scope: both houses with uplifts, adding up to Home's contract and variations to the penny
    nav('scope')
    const amounts = await waitFor(() => { const a = [...document.querySelectorAll('.prop-amt .mono')]; expect(a.length).toBe(2); return a })
    const sum = amounts.reduce((t, a) => t + pounds(a.textContent ?? ''), 0)
    expect(Math.round(sum * 100)).toBe(Math.round(worth.total * 100))

    // the house sheet: the VO at its value with uplifts (Home's Variations), four trades in four colours, and a key
    click(screen.getByRole('button', { name: /^Property 1/ }))
    const sheet = document.querySelector('.house-sheet') as HTMLElement
    await within(sheet).findAllByText(money(worth.vos))
    const cores = [...sheet.querySelectorAll('.trade-h .core')].map(c => c.className)

    expect(cores.length).toBe(4)
    expect(new Set(cores).size).toBe(4)
    expect(sheet.querySelector('.trade-jump')).toBeNull()   // four trades or fewer: the headings are the key, no chips
    // the one main action in the sheet is the white block
    expect(within(sheet).getByRole('button', { name: /Tick all remaining lines/ }).className).toContain('btn-primary')
    // and no row says "Property" where it means the whole house
    expect(sheet.textContent).not.toMatch(/· Property/)
  })

  it('sending a valuation can be taken back for a few seconds', async () => {
    await db.putValuation({ id: 'lv1', jobId: 'jl', number: 1, status: 'Open', createdAt: 1, issuedAt: null })
    await db.putScope({ ...scope[0], valuationId: 'lv1' })
    cleanup(); render(<App />)
    click(await screen.findByRole('button', { name: /Launch Row/ }))
    nav('vals')
    click(await screen.findByRole('button', { name: /^Send VAL I for £/ }))
    await screen.findByText('VAL I marked sent')
    await waitFor(async () => expect((await db.valuations('jl')).find(v => v.id === 'lv1')!.status).toBe('Issued'))
    click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await db.valuations('jl')).find(v => v.id === 'lv1')!.status).toBe('Open'))
    await screen.findByRole('button', { name: /^Send VAL I for £/ })   // open again, ready to send
    expect(screen.queryAllByText(/^With client · For review/).length).toBe(0)
  })
})
