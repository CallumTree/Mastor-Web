/** The right place: an alert opens the tab it's about; the app reopens where you left off; a job opens on its last tab. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const DAY = 86_400_000

describe('the right place', () => {
  it('an overdue review opens Vals; the app reopens in the job and tab you left; each job opens on its last tab', async () => {
    const job = (id: string, name: string) => ({ id, name, client: 'Example Council', address: '', contractRef: '', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR' as const, status: 'Active' as const, photoId: null, createdAt: 1 })
    await db.putJob(job('jr', 'Ridge Row'))
    await db.putJob(job('jt', 'Tor View'))
    await db.putScope({ id: 's1', jobId: 'jr', code: '4360BD', description: 'Masonry paint', room: 'Front', qty: 10, unit: 'SM', rate: 50, valuationId: 'v1', order: 1, createdAt: 1 })
    // VAL I with the client for 40 days and not agreed: a red alert on the week
    await db.putValuation({ id: 'v1', jobId: 'jr', number: 1, status: 'Issued', createdAt: 1, issuedAt: Date.now() - 40 * DAY, review: { sentAt: Date.now() - 40 * DAY, rounds: 1 } } as never)

    render(<App />)
    const week = await screen.findByRole('region', { name: 'The week across all jobs' })
    click(within(week).getByRole('button', { name: /VAL I with the client \d+ days/ }))
    // straight to Vals, not the Diary
    expect(await screen.findByRole('heading', { name: 'Valuations' })).toBeTruthy()

    // the app closed and opened again (no address to come back to): back in Ridge Row, on Vals
    cleanup(); history.replaceState(null, '', '/')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Valuations' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ridge Row' })).toBeTruthy()

    // back to the list, into Tor View (first time: Home), over to Scope; then Ridge Row opens on Vals, Tor View on Scope
    click(screen.getByRole('button', { name: 'Jobs' }))
    click(await screen.findByRole('button', { name: /Tor View/ }))
    await screen.findByRole('heading', { name: 'Tor View' })
    expect(screen.queryByRole('heading', { name: 'Valuations' })).toBeNull()
    nav('scope')
    await screen.findByRole('heading', { name: /^Scope/ })
    click(screen.getByRole('button', { name: 'Jobs' }))
    click(await screen.findByRole('button', { name: /Ridge Row/ }))
    expect(await screen.findByRole('heading', { name: 'Valuations' })).toBeTruthy()
    click(screen.getByRole('button', { name: 'Jobs' }))
    click(await screen.findByRole('button', { name: /Tor View/ }))
    expect(await screen.findByRole('heading', { name: /^Scope/ })).toBeTruthy()

    // left on the jobs list: it opens on the list
    click(screen.getByRole('button', { name: 'Jobs' }))
    await screen.findByRole('button', { name: /Ridge Row/ })
    cleanup(); history.replaceState(null, '', '/')
    render(<App />)
    expect(await screen.findByRole('button', { name: /Ridge Row/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Valuations' })).toBeNull()
  })
})
