/**
 * Operatives never see money: no £ anywhere on the jobs board, the job, the scope or the VOs,
 * no Vals tab, no job setup, no commercial notes — but they can still log and measure variations.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, meta, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const noMoney = () => expect(document.body.textContent).not.toMatch(/£/)

// this file's job, data and operative sign-in must not leak into the next test file on this worker
afterAll(async () => { cleanup(); await wipeLocal() })

describe('operative', () => {
  it('sees the work, never the money', async () => {
    const job: Job = { id: 'j1', name: '7 Hill Street', client: 'PCC', address: '', contractRef: 'PCC/7', poNumber: '', contractValue: 12000, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    await db.putScope({ id: 's1', jobId: 'j1', code: '0171AD', description: 'Renew fence', room: 'Rear', qty: 12, unit: 'LM', rate: 133.91, valuationId: null, order: 1, createdAt: 1 })
    await db.putVariation({ id: 'v1', jobId: 'j1', number: 1, description: 'Extra post', room: 'Rear', qty: 1, unit: 'NO', rate: 55, code: '0171ZZ', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 1 })
    await db.putDiary({ id: 'n1', jobId: 'j1', date: '2026-10-01', type: 'note', note: 'Agreed £400 extra for skip', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, category: 'Commercial', createdAt: 1 })
    await db.putDiary({ id: 'n2', jobId: 'j1', date: '2026-10-01', type: 'note', note: 'Dog in garden — keep gate shut', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, category: 'Site', createdAt: 2 })
    await meta.set('company', { id: 'c', name: 'Tree & Sons', user: 'u', role: 'operative' })

    render(<App />)
    await screen.findByText('7 Hill Street')
    noMoney()
    expect(screen.queryByRole('button', { name: /director dashboard/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /schedule of rates/i })).toBeNull()

    click(screen.getByRole('button', { name: /7 Hill Street/ }))
    await screen.findByText('Dog in garden — keep gate shut')
    noMoney()
    expect(screen.queryByText(/Agreed £400/)).toBeNull()                // commercial note hidden
    expect(screen.queryByRole('button', { name: 'Job setup' })).toBeNull()
    expect(screen.getAllByRole('button').filter(b => b.closest('nav')).map(b => b.textContent)).not.toContain('Vals')

    nav('scope')
    await screen.findByText('Renew fence')
    expect(screen.getByText(/12 LM/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /add to valuation/i })).toBeNull()
    noMoney()

    nav('vos')
    await screen.findByText('Extra post')
    noMoney()
    click(screen.getByRole('button', { name: /Extra post/ }))
    await screen.findByLabelText('Qty')
    expect(screen.queryByLabelText(/Rate/)).toBeNull()
    expect(screen.queryByLabelText('SoR code')).toBeNull()
    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '2' } })
    click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const v = (await db.variations('j1'))[0]
      expect(v.qty).toBe(2)
      expect(v.rate).toBe(55)   // the rate they never saw is kept
    })

    click(screen.getByRole('button', { name: 'All jobs' }))
    click(await screen.findByRole('button', { name: 'Settings' }))
    await screen.findByText('Open team')
    expect(screen.queryByText('Company settings')).toBeNull()
    noMoney()
  })
})
