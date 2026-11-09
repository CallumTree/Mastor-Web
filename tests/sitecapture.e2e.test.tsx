/** From site to the valuation: a voice note is read against the scope, suggestions wait in Vals, approving claims the line and raises the VO. */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, meta, wipeLocal } from '../src/lib/db'
import { resetAutoRead } from '../src/lib/autoRead'
import type { Job } from '../src/lib/types'

vi.mock('../src/lib/sync', async orig => ({ ...(await orig<typeof import('../src/lib/sync')>()), currentCompany: () => 'c1', settle: async () => {} }))
afterAll(async () => { cleanup(); vi.unstubAllGlobals(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const openToday = async () => click(await screen.findByRole('button', { name: /today’s site (day|diary)/i }))   // the Diary tab opens on the job's line; today's site day is one tap
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
    const job: Job = { id: 'js', name: 'Station Road', client: 'Example Council', address: '', contractRef: '', poNumber: 'PO9', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    await db.putScope({ id: 's1', jobId: 'js', code: '4360BD', description: 'Masonry paint', room: 'Front', qty: 93, unit: 'SM', rate: 5.62, valuationId: null, order: 1, property: '4', workstream: 'PPR Paint', createdAt: 1 })
    await db.putScope({ id: 's2', jobId: 'js', code: '2032AA', description: 'Slates', room: 'Roof', qty: 60, unit: 'SM', rate: 80.43, valuationId: null, order: 2, property: '4', workstream: 'Roofing', createdAt: 1 })
    const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await db.putDiary({ id: 'voice1', jobId: 'js', date, type: 'voice', note: '', labour: null, weather: '', mediaId: 'wav1', originalMediaId: null, room: '', voId: null, createdAt: 5 })

    // no button: the day has gone quiet (the voice note is long since uploaded), so the office's Mastor reads it on its own
    render(<App />)
    click(await screen.findByRole('button', { name: /Station Road/ }))
    await waitFor(() => expect(sent).toBeTruthy())
    expect(sent.companyId).toBe('c1')
    expect(sent.items[0]).toMatchObject({ key: 'M1', kind: 'voice', mediaId: 'wav1' })
    nav('diary')
    await openToday()
    expect(await screen.findByText('3 to review')).toBeTruthy()   // on the voice note's tile
    expect(screen.queryByRole('button', { name: /read today/i })).toBeNull()

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
    expect(vo).toMatchObject({ description: 'Renew rotten joists under the bath', status: 'Identified', rate: null, qty: 2, unit: 'LM', property: '4', room: 'Bathroom' })   // at its house, so it sits with No. 4’s scope

    click(await screen.findByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(screen.queryByText(/From site ·/)).toBeNull())
    const notes = (await db.diary('js')).filter(d => d.type === 'note')
    expect(notes.length).toBe(0)
    const read = (await db.diary('js')).find(d => d.id === 'voice1')!
    expect(read.transcript).toMatch(/^Number four front elevation/)
    expect(read.read!.suggestions.map(s => s.state)).toEqual(['approved', 'approved', 'rejected'])
  })

  it('read at half price: Vals says the capture is with the reader, and the next pass collects what it found', async () => {
    cleanup(); await wipeLocal(); resetAutoRead()
    let ready = false, sends = 0, collects = 0
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async (u: string, init: any) => {
      if (!String(u).includes('read-site')) return new Response('{}', { status: 404 })
      const b = JSON.parse(init.body)
      if (b.collect) {
        collects++
        expect(b.collect).toBe('msgbatch_e2e001')
        return json(ready ? { suggestions: [{ item: 'M1', kind: 'complete', lines: ['L1'], text: 'No. 7 gutters cleared', property: '7', room: '', qty: null, unit: '', code: '', quote: 'gutters at number seven are cleared', basis: 'said' }] } : { pending: b.collect })
      }
      sends++
      return json({ transcripts: { M1: 'The gutters at number seven are cleared.' }, failed: {}, pending: 'msgbatch_e2e001' })
    }))
    await db.putJob({ id: 'jb', name: 'Mill Lane', client: 'Example Council', address: '', contractRef: '', poNumber: 'PO7', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 })
    await db.putScope({ id: 'g1', jobId: 'jb', code: '3010GU', description: 'Clear gutters', room: 'Roof', qty: 12, unit: 'LM', rate: 4.5, valuationId: null, order: 1, property: '7', workstream: 'Roofing', createdAt: 1 })
    const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await db.putDiary({ id: 'voice7', jobId: 'jb', date, type: 'voice', note: '', labour: null, weather: '', mediaId: 'wav7', originalMediaId: null, room: '', voId: null, createdAt: 5 })

    render(<App />)
    click(await screen.findByRole('button', { name: /Mill Lane/ }))
    nav('vals')
    expect(await screen.findByText('1 site capture is with the reader. What it shows arrives here, usually within the hour.')).toBeTruthy()
    const sent = (await db.diary('jb')).find(d => d.id === 'voice7')!
    expect(sent.read?.pending).toBe('msgbatch_e2e001')
    expect(sent.transcript).toMatch(/gutters at number seven/)       // the words come back at once
    expect((await meta.get<{ batch: string }[]>('siteReads'))?.[0].batch).toBe('msgbatch_e2e001')

    // the next pass (the app comes back to the front): collected, checked, waiting for a person
    ready = true
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(await screen.findByText('From site · 1 to review')).toBeTruthy()
    expect(sends).toBe(1)                                             // sent once, never again while it was with the reader
    expect(collects).toBeGreaterThan(0)
    expect(await meta.get('siteReads')).toEqual([])
    expect(screen.queryByText(/with the reader/)).toBeNull()
    click(screen.getByRole('button', { name: 'Add it to VAL I' }))
    await waitFor(async () => expect((await db.scope('jb'))[0].valuationId).toBeTruthy())
  })
})
