/**
 * The job's line: book a key date for a property and trade, add the to-do that leads up to it from the
 * date itself, follow each to the other, tick it off; office-only items stay off an operative's line; and
 * the jobs screen shows the week across every job.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import App from '../src/App'
import { db, meta, wipeLocal } from '../src/lib/db'
import { dayKey, addDays } from '../src/lib/dates'
import type { Job } from '../src/lib/types'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

describe('the job line', () => {
  it('a key date and the to-do that leads up to it, each linked to the other', async () => {
    const job: Job = { id: 'jl', name: 'Hill Terrace', client: 'PCC', address: '', contractRef: 'HT1', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1, properties: { '6': '6 Hill Terrace', '8': '8 Hill Terrace' } }
    await db.putJob(job)
    await db.putScope({ id: 'k1', jobId: 'jl', code: 'KIT1', description: 'Kitchen units', room: 'Kitchen', qty: 1, unit: 'IT', rate: 100, valuationId: null, order: 1, property: '6', workstream: 'Kitchen', createdAt: 1 })
    render(<App />)
    click(await screen.findByRole('button', { name: /Hill Terrace/ }))
    nav('diary')
    await screen.findByText(/Nothing booked yet/)

    // book the key date: tomorrow, No. 6, Kitchen
    click(screen.getByRole('button', { name: '+ Date' }))
    fireEvent.change(await screen.findByPlaceholderText(/Kitchen refit starts/), { target: { value: 'Kitchen refit starts' } })
    click(screen.getByRole('button', { name: 'Tomorrow' })); click(screen.getByRole('button', { name: 'No. 6' })); click(screen.getByRole('button', { name: /Kitchen$/ }))
    click(screen.getByRole('button', { name: 'Book it' }))
    const date = await screen.findByRole('button', { name: /Kitchen refit starts/ })
    expect(date.textContent).toMatch(/No\. 6 · Kitchen/)
    const [ev] = (await db.diary('jl')).filter(e => e.type === 'event')
    expect(ev.date).toBe(addDays(dayKey(), 1)); expect(ev.property).toBe('6'); expect(ev.trade).toBe('Kitchen')

    // from the date: a to-do the day before, already linked to it
    click(date)
    click(await screen.findByRole('button', { name: /To-do, day before/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Speak to the tenant/), { target: { value: 'Speak to the tenant about the start' } })
    click(screen.getByRole('button', { name: /^(Save|Add it)$/ }))   // already on the line (linked), so either label
    const link = await screen.findByRole('button', { name: /^\w{3} \d+ \w{3} · Kitchen refit starts$/ })   // the to-do's link to its date
    const todo = (await db.diary('jl')).find(e => e.type === 'todo')!
    expect(todo.linkId).toBe(ev.id); expect(todo.date).toBe(dayKey())   // the day before tomorrow is today
    expect(await screen.findByText(/^\s*1 to-do$/)).toBeTruthy()          // and the date shows its to-do
    click(link)                                                           // the link finds its date on the line
    await waitFor(() => expect(document.querySelector(`#pl-${ev.id}.flash`)).toBeTruthy())

    // tick it off
    click(screen.getByRole('button', { name: /^Done: Speak to the tenant/ }))
    await waitFor(async () => expect((await db.diary('jl')).find(e => e.id === todo.id)!.doneAt).toBeTruthy())

    // an office-only to-do with no date: in the tray for the office…
    click(screen.getByRole('button', { name: '+ To-do' }))
    fireEvent.change(await screen.findByPlaceholderText(/Speak to the tenant/), { target: { value: 'Chase VO I reference' } })
    click(screen.getByRole('checkbox', { name: /Office only/ }))
    click(screen.getByRole('button', { name: 'Add it' }))
    expect(await screen.findByText('1 to-do with no date')).toBeTruthy()

    // …the jobs screen has the week across all jobs
    click(screen.getByRole('button', { name: /Jobs/ }))
    const week = await screen.findByRole('region', { name: 'The week across all jobs' })
    expect(within(week).getByText('Kitchen refit starts')).toBeTruthy()
    click(within(week).getByText('Kitchen refit starts'))
    expect(await screen.findByRole('button', { name: '+ Date' })).toBeTruthy()   // opens the job on its line

    // an operative: the office-only to-do isn't on their line
    await meta.set('company', { id: 'c', name: 'Tree & Sons', user: 'u', role: 'operative' })
    cleanup(); render(<App />)
    await screen.findByRole('heading', { name: 'Hill Terrace' })
    nav('home'); nav('diary')
    await screen.findByText('Kitchen refit starts')
    expect(screen.queryByText('1 to-do with no date')).toBeNull()
    expect(screen.queryByText(/Chase VO I reference/)).toBeNull()
  })
})
