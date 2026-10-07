/** Council VO instructions in: Excel (read directly) and a handwritten scan (AI reply mocked) that matches an open VO. */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import App from '../src/App'
import { db } from '../src/lib/db'
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const closed = () => waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
const SCAN_REPLY = JSON.stringify({ ref: '11284', date: '2026-01-22', issued_by: '', address: '57 Coombs Drive, Milford Haven', po_number: 'H/PC21812', description: 'Chimney demolish and make good; scaffold',
  lines: [{ code: '120021', description: 'Chimney: demolish and make good', qty: 1, unit: 'IT', rate: null, cost: 540.02, unclear: '' }, { code: 'SCA003', description: 'Scaffolding', qty: 1, unit: 'IT', rate: null, cost: 250, unclear: '' }] })
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('parse-vo') ? new Response(JSON.stringify({ text: SCAN_REPLY }), { status: 200 }) : new Response('{}', { status: 404 }))) })

async function newJob(name: string, po: string) {
  click(await screen.findByRole('button', { name: /new job/i }))
  type('Job name *', name); type(/PO number/i, po)
  click(screen.getByRole('button', { name: 'Create job' }))
  await screen.findByText(name)
}
async function importFile(file: File) {
  nav('vos')
  click(await screen.findByRole('button', { name: 'Variations options' }))
  click(screen.getByRole('button', { name: /import council instruction/i }))
  fireEvent.change([...document.querySelectorAll('input[type=file]')].find(i => !(i as HTMLInputElement).capture)!, { target: { files: [file] } })
  await screen.findByText(/check before adding/i)
}

describe('council VO instructions', () => {
  it('Excel VO (like 51 Precelly Place VO 5): read free, new instructed VO with the council ref', async () => {
    render(<App />); await screen.findByRole('img', { name: 'MASTOR' })
    await newJob('51 Precelly Place', 'PC30001')
    const rows = [['51 Precelly Place - VO 5'], ['Officer:', 'Dan Lawrence'], ['Date:', '23/02/2025'], ['Framework: ', 'Minor Works Framwork LOT 4'], ['ADDRESS: ', '51 Precelly Place'], ['Description: ', 'VO 5 - Scaffolding'], [],
      ['CODE', 'DESCRIPTION', 'UNIT', 'RATE', 'QUANTITY', 'COST'], [null, '51 Precelly Place'], ['SCA003', 'Scaffolding to all elevations', 'IT', 250, 6, 1500], [], [null, null, 'Total NETT:', null, null, 1500],
      [null, null, 'BCIS ', 0.1468, 220.2, 1720.2], [null, 'Framework (Tree & Sons)', null, 0.35, 602.07, 2322.27]]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'BOQ')
    await importFile(new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], '51 Precelly Place - VO 5.xlsx'))
    expect(screen.getByText('VO 5')).toBeTruthy()
    expect(screen.getByText(/read exactly from the spreadsheet/i)).toBeTruthy()
    expect(screen.getByText('£1,500.00')).toBeTruthy()
    click(screen.getByRole('button', { name: 'Add 1 to variations' })); await closed()
    await screen.findByText('Scaffolding to all elevations')
    const [v] = await db.variations((await db.jobs()).find(j => j.name === '51 Precelly Place')!.id)
    expect(v.clientRef).toBe('VO 5'); expect(v.status).toBe('Instructed'); expect(v.qty).toBe(6); expect(v.rate).toBe(250)
    expect(v.attachments?.[0].name).toBe('51 Precelly Place - VO 5.xlsx')
    cleanup()
  })

  it('handwritten site instruction 11284: matches PO, attaches line 1 to the VO already raised, adds line 2', async () => {
    render(<App />)
    click(await screen.findByRole('button', { name: /all jobs/i }).catch(() => screen.findByRole('button', { name: /new job/i })))
    await newJob('57 Coombs Drive', 'PC21812')
    nav('vos')
    click(await screen.findByRole('button', { name: /log variation/i }))
    type(/extra work/i, 'Chimney stack unsafe — demolish and make good'); type('Where', 'Roof')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!); await closed()
    await importFile(new File([new Uint8Array([255, 216, 255])], 'VO11284.jpg', { type: 'image/jpeg' }))
    expect(screen.getByText('11284')).toBeTruthy()
    expect(screen.getByText(/varies order H\/PC21812 — this job/i)).toBeTruthy()
    expect((screen.getByLabelText('Line 1 goes to') as HTMLSelectElement).selectedOptions[0].textContent).toMatch(/VO I .*likely match/)
    expect((screen.getByLabelText('Line 2 goes to') as HTMLSelectElement).value).toBe('new')
    click(screen.getByRole('button', { name: 'Add 2 to variations' })); await closed()
    const vs = (await db.variations((await db.jobs()).find(j => j.name === '57 Coombs Drive')!.id)).sort((a, b) => a.number - b.number)
    expect(vs.length).toBe(2)
    expect(vs[0].clientRef).toBe('11284'); expect(vs[0].status).toBe('Instructed'); expect(vs[0].rate).toBe(540.02); expect(vs[0].code).toBe('120021')
    expect(vs[0].description).toBe('Chimney stack unsafe — demolish and make good')   // your own wording kept
    expect(vs[0].photoIds.length).toBe(1)                                               // the scan, as evidence
    expect(vs[1].code).toBe('SCA003'); expect(vs[1].rate).toBe(250); expect(vs[1].photoIds[0]).not.toBe(vs[0].photoIds[0])  // own copy
  })
})
