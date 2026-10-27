/** A reload keeps you where you were: the open job and its tab are in the address, and "Jobs" goes back to the list. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })
afterAll(() => wipeLocal())

describe('keeping your place', () => {
  it('comes back to the same job and tab after a reload, and Jobs goes back to the list', async () => {
    await db.putJob({ id: 'jp', name: 'Reload Row', client: 'PCC', address: '', contractRef: 'RR1', poNumber: '', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 } as Job)
    render(<App />)
    click(await screen.findByText('Reload Row'))
    nav('scope')
    expect(new URLSearchParams(location.search).get('job')).toBe('jp')
    expect(new URLSearchParams(location.search).get('tab')).toBe('scope')

    cleanup(); render(<App />)   // the page reloads
    expect(await screen.findByRole('heading', { name: /scope/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reload Row' })).toBeTruthy()

    click(screen.getByRole('button', { name: 'Jobs' }))
    await screen.findByText('Reload Row')
    expect(location.search).toBe('')
  })
})
