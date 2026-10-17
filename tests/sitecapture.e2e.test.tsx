/** From site to the valuation: a voice note is read against the scope, suggestions wait in Vals, approving claims the line and raises the VO. */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

vi.mock('../src/lib/sync', async orig => ({ ...(await orig<typeof import('../src/lib/sync')>()), currentCompany: () => 'c1', settle: async () => {} }))
afterAll(async () => { cleanup(); vi.unstubAllGlobals(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

describe('site capture', () => {
  it('voice note → suggestions in Vals → approve adds the line to the valuation and raises the VO; reject drops it', async () => {
    let sent: any = null
    vi.stubGlobal('fetch', vi.fn(async (u: string, init: any) => {
      if (!String(u).includes('read-site')) return new Response('{}', { status: 404 })
      sent = JSON.parse(init.body)
      return new Response(JSON.stringify({ transcripts: { M1: 'Number four front elevation is all painted. Found rotten joists under the bath, two metres. Tenant says the boiler is leaking.' }, failed: {}, suggestions: [
        { item: 'M1', kind: 'complete', lines: ['L1'], text: 'No. 4 masonry paint complete', property: '4', room: 'Front', qty: null, unit: '', code: '', quote: 'number four front elevation is all painted', basis: 'said' },
        { item: 'M1', kind: 'vo', lines: [], text: 'Renew rotten joists under the bath', property: '4', room: 'Bathroom', qty: 2, unit: 'LM', code: '', quote: 'rotten joists under the bath, two metres', basis: 'said' },
        { item: 'M1', kind: 'note', lines: [], text: 'Tenant reports a leaking boiler', property: '4', room: '', qty: null, unit: '', code: '', quote: 'boiler is leaking', basis: 'said' },
      ] }), { status: 200 })
    }))
    const job: Job = { id: 'js', name: 'Windsor Road', client: 'PCC', address: '', contractRef: '', poNumber: 'PO9', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    await db.putScope({ id: 's1', jobId: 'js', code: '4360BD', description: 'Masonry paint', room: 'Front', qty: 93, unit: 'SM', rate: 5.62, valuationId: null, order: 1, property: '4', workstream: 'PPR Paint', createdAt: 1 })
    await db.putScope({ id: 's2', jobId: 'js', code: '2032AA', description: 'Slates', room: 'Roof', qty: 60, unit: 'SM', rate: 80.43, valuationId: null, order: 2, property: '4', workstream: 'Roofing', createdAt: 1 })
    const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await db.putDiary({ id: 'voice1', jobId: 'js', date, type: 'voice', note: '', labour: null, weather: '', mediaId: 'wav1', originalMediaId: null, room: '', voId: null, createdAt: 5 })

    render(<App />)
    click(await screen.findByRole('button', { name: /Windsor Road/ }))
    nav('diary')
    expect(await screen.findByRole('button', { name: 'Open voice note' })).toBeTruthy()
    click(screen.getByRole('button', { name: /Read today against the scope · 1 new/ }))
    expect(await screen.findByText('3 suggestions waiting in Vals for review.')).toBeTruthy()
    expect(sent.companyId).toBe('c1')
    expect(sent.items[0]).toMatchObject({ key: 'M1', kind: 'voice', mediaId: 'wav1' })
    expect(screen.getByText('3 to review')).toBeTruthy()   // on the voice note's tile

    nav('vals')
    expect(await screen.findByText('From site · 3 to review')).toBeTruthy()
    click(screen.getByRole('button', { name: 'Add it to VAL I' }))
    await waitFor(async () => expect((await db.scope('js')).find(s => s.id === 's1')!.valuationId).toBeTruthy())
    const line = (await db.scope('js')).find(s => s.id === 's1')!
    expect(line.evidence).toEqual(['voice1'])
    expect((await db.scope('js')).find(s => s.id === 's2')!.valuationId).toBeNull()   // only what was said is claimed

    click(await screen.findByRole('button', { name: 'Raise as a VO' }))
    await waitFor(async () => expect((await db.variations('js')).length).toBe(1))
    const vo = (await db.variations('js'))[0]
    expect(vo).toMatchObject({ description: 'Renew rotten joists under the bath', status: 'Identified', rate: null, qty: 2, unit: 'LM', room: 'No. 4 · Bathroom' })

    click(await screen.findByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(screen.queryByText(/From site ·/)).toBeNull())
    const notes = (await db.diary('js')).filter(d => d.type === 'note')
    expect(notes.length).toBe(0)
    const read = (await db.diary('js')).find(d => d.id === 'voice1')!
    expect(read.transcript).toMatch(/^Number four front elevation/)
    expect(read.read!.suggestions.map(s => s.state)).toEqual(['approved', 'approved', 'rejected'])
  })
})
