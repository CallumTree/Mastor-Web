/** Dayworks: hours priced from the SoR labour rates, materials at cost (+ contract %), signed, claimed as a VO. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, rates, wipeLocal } from '../src/lib/db'
import { blankSettings, type Dayworks, type Job } from '../src/lib/types'
import { dayworksVariation, dwTotals } from '../src/lib/dayworks'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1)!, { target: { value } })

describe('dayworks', () => {
  it('totals: labour × SoR rate, materials and plant at cost plus the contract %, unknowns left out and counted', () => {
    const d = { number: 3, date: '2026-10-02', description: 'Clear cellar', labour: [{ trade: 'M', label: 'Multiskilled', rate: 20.92, hours: 6 }, { trade: 'P', label: 'Plumber', rate: 27.65, hours: 2.5 }, { trade: '', label: 'Other', rate: null, hours: 1 }],
      materials: [{ description: 'Sand', amount: 40 }, { description: 'Pump hire fuel', amount: null }], plant: [{ description: 'Pump', amount: 60 }], materialsPct: 15, signedBy: 'D Rees' } as Dayworks
    const t = dwTotals(d)
    ok(t.labour === 194.65 && t.labourHours === 9.5, `labour 6 × 20.92 + 2.5 × 27.65 = £194.65 (${t.labour})`)
    ok(t.materials === 40 && t.plant === 60 && t.addition === 15 && t.total === 309.65, `+ £40 + £60 + 15% = £309.65 (${t.total})`)
    ok(t.unpriced === 2, 'a trade without a rate and a material without a cost are counted, not guessed')
    const vo = dayworksVariation(d, { id: 'j' } as Job, 7)
    ok(vo.number === 7 && vo.rate === null && vo.code === 'DW3' && vo.status === 'Instructed', 'with unknowns the VO stays unpriced; signed sheet = instructed')
    ok(dayworksVariation({ ...d, labour: d.labour.slice(0, 2), materials: d.materials.slice(0, 1) }, { id: 'j' } as Job, 7).rate === 309.65, 'all known: VO priced at the sheet total')
  })

  it('on site: new sheet from Capture, hours by trade, claim as a variation', async () => {
    await db.putSettings({ ...blankSettings(), name: 'Tree & Sons', rateBooks: [{ id: 'rb', name: 'Planned v8', source: 'p.docx', notes: [], lines: 2, importedAt: 1 }] })
    await rates.put('rb', [{ bookId: 'rb', code: 'M', short: 'Multiskilled operative', long: '', unit: 'HR', rate: 20.92, section: 'LABOUR RATES', subsection: 'Dayworks labour' },
      { bookId: 'rb', code: 'P', short: 'Plumber operative', long: '', unit: 'HR', rate: 27.65, section: 'LABOUR RATES', subsection: 'Dayworks labour' }])
    const job: Job = { id: 'jd', name: '3 Mill Lane', client: 'PCC', address: '', contractRef: 'ML3', poNumber: 'PO9', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    render(<App />)
    click(await screen.findByRole('button', { name: /3 Mill Lane/ }))
    click(await screen.findByRole('button', { name: 'Capture' }))
    click(screen.getByRole('button', { name: /Dayworks/ }))
    await screen.findByText(/Dayworks DW 1/)
    type(/Work done, and why/, 'Clear flooded cellar before survey')
    await waitFor(() => expect(screen.getAllByRole('option').some(o => o.textContent?.startsWith('M — Multiskilled'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Trade 1'), { target: { value: 'M' } })
    type('Hours', '6')
    expect(screen.getAllByText('£125.52').length).toBe(2)   // labour and total: 6 × 20.92
    type(/^Signed by/, 'Dylan Rees')
    click(screen.getByRole('button', { name: 'Claim as a variation · £125.52' }))
    await waitFor(async () => {
      const [vo] = await db.variations('jd')
      expect(vo?.rate).toBe(125.52)
      expect(vo?.description).toBe('Dayworks DW 1 — Clear flooded cellar before survey')
      expect(vo?.status).toBe('Instructed')
      const [dw] = await db.list('dayworks', 'jd')
      expect(dw.voId).toBe(vo.id)
    })
  })
})
function ok(c: boolean, m: string) { expect(c, m).toBe(true) }
