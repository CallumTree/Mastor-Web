/** The client's pack through the screens: works order + PCI → review shows what each file is and what doesn't add up → import. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`
const tr = (...cells: string[]) => `<w:tr>${cells.map(c => `<w:tc>${p(c)}</w:tc>`).join('')}</w:tr>`
const tbl = (...rows: string[]) => `<w:tbl>${rows.join('')}</w:tbl>`
function docx(xml: string, name: string) {
  const cfb = XLSX.CFB.utils.cfb_new()
  XLSX.CFB.utils.cfb_add(cfb, 'word/document.xml', new TextEncoder().encode(xml))
  return new File([XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array' }) as ArrayBuffer], name)
}
const order = docx(`<w:document><w:body>${tbl(tr('Contract Reference:', 'MH7'), tr('Title of Work:', 'Elm Road Pembroke Painting'), tr('Contract Value', '£600.00'))}
${p('Property Address: 3 Elm Road, Pembroke, SA71 4PY')}${p('Location: All Elv')}
${tbl(tr('Description', 'Comments', 'Code', 'Quantity', 'Units', 'Rate', 'Cost'), tr('Walls: Wash Down And Apply Masonry Paint', '', '4360BD', '93', 'SM', '£5.62', '£522.66'))}
${p('Property Address: 5 Elm Road, Pembroke, SA71 4PY')}${p('Location: Rear')}
${tbl(tr('Description', 'Comments', 'Code', 'Quantity', 'Units', 'Rate', 'Cost'), tr('Gutter: Clean Out', '', '4350AA', '21.8', 'LM', '£3.19', '£69.54'))}
</w:body></w:document>`, 'MH7 Elm Road Painting.docx')
const pci = new File(['Pre-construction information. Working days Mon-Fri 8-4.'], 'Pre-construction Information.txt', { type: 'text/plain' })

describe('client pack', () => {
  it('sorts the files, flags what doesn’t add up, imports with addresses and keeps the documents', async () => {
    const job: Job = { id: 'je', name: 'Elm Road', client: 'PCC', address: '', contractRef: '', poNumber: '', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    render(<App />)
    click(await screen.findByRole('button', { name: /Elm Road/ }))
    nav('scope')
    click(await screen.findByRole('button', { name: /import boq/i }))
    fireEvent.change(document.querySelector('input[type=file][multiple]')!, { target: { files: [order, pci] } })
    await screen.findByText(/check before importing/i)
    expect(screen.getByText('In the pack · 2 files')).toBeTruthy()
    expect(screen.getByText(/Works order MH7 · Elm Road Pembroke Painting · 2 lines · 2 properties/)).toBeTruthy()
    expect(screen.getByText('Kept with the job’s documents')).toBeTruthy()
    expect(screen.getByText(/Contract value £600\.00, the lines add to £592\.20/)).toBeTruthy()
    expect(screen.getByText('Read exactly from the documents — no AI')).toBeTruthy()
    click(screen.getByRole('button', { name: 'Import 2 items' }))

    await waitFor(async () => expect((await db.scope('je')).length).toBe(2))
    const lines = await db.scope('je')
    expect(lines.every(l => l.contract === 'MH7')).toBe(true)
    expect(lines.find(l => l.code === '4360BD')!.unit).toBe('SM')
    const saved = (await db.jobs()).find(j => j.id === 'je')!
    expect(saved.contractRef).toBe('MH7')
    expect(saved.address).toBe('Elm Road, Pembroke')
    expect(saved.properties).toEqual({ 3: '3 Elm Road, Pembroke, SA71 4PY', 5: '5 Elm Road, Pembroke, SA71 4PY' })
    const docs = await db.list('docs', 'je')
    expect(docs.map(d => d.kind)).toEqual(['Client pack', 'Client pack'])
    expect(await screen.findByText('3 Elm Road')).toBeTruthy()   // scope headed by the address, not just "No. 3"
  })
})
