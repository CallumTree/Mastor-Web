/** The client's pack through the screens: works order + PCI → review shows what each file is and what doesn't add up → import. */
import { describe, it, expect, afterAll, vi } from 'vitest'
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

  it('reads the PCI and surveys: quoted facts become notes, missing work becomes a VO, unproven items stay unticked', async () => {
    const survey = 'Situation Report: Preliminary Roost Assessment. Windsor Road. It is recommended that, during maintenance works on the properties within this report, a Woodstone bat box is erected below the eaves of the side of each property. Roof tiles to be removed should be lifted by hand and checked underneath.'
    vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('read-pack')
      ? new Response(JSON.stringify({ cut: [], facts: [
          { category: 'H&S', text: 'Lift roof tiles by hand and check underneath for bats.', document: 'Bat survey.txt', page: null, quote: 'lifted by hand and checked underneath', properties: ['3'] },
          { category: 'Client', text: 'Handover in March.', document: 'Bat survey.txt', page: null, quote: 'handover March 2027', properties: [] },
        ], extras: [
          { text: 'Fit a Woodstone bat box below the eaves.', why: 'The bat survey recommends one per property.', document: 'Bat survey.txt', page: null, quote: 'a Woodstone bat box is erected below the eaves', properties: ['3'] },
        ] }), { status: 200 })
      : new Response('{}', { status: 404 })))
    const job: Job = { id: 'jb', name: 'Bat Road', client: 'PCC', address: '', contractRef: '', poNumber: '', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 2 }
    await db.putJob(job)
    cleanup(); render(<App />)
    click(await screen.findByRole('button', { name: /Bat Road/ }))
    nav('scope')
    click(await screen.findByRole('button', { name: /import boq/i }))
    fireEvent.change(document.querySelector('input[type=file][multiple]')!, { target: { files: [order, new File([survey], 'Bat survey.txt', { type: 'text/plain' })] } })
    await screen.findByText('From the documents · read by AI')
    expect(screen.getByText(/1 piece of work the documents ask for that isn’t in the scope/)).toBeTruthy()
    const boxes = () => [...document.querySelectorAll('.pack-fact input')] as HTMLInputElement[]
    expect(boxes().map(b => b.checked)).toEqual([true, true, false])   // bat box, tile lifting (quotes found); handover (quote not in the document)
    expect(screen.getByText(/Quote not found in the document/)).toBeTruthy()
    click(screen.getByRole('button', { name: 'Import 2 items' }))

    await waitFor(async () => expect((await db.variations('jb')).length).toBe(1))
    const vo = (await db.variations('jb'))[0]
    expect(vo.description).toBe('Fit a Woodstone bat box below the eaves.')
    expect(vo.status).toBe('Identified')
    expect(vo.rate).toBeNull()
    expect(vo.room).toBe('No. 3')
    expect(vo.reason).toMatch(/Bat survey: “a Woodstone bat box is erected below the eaves”/)
    const notes = (await db.diary('jb')).filter(d => d.type === 'note')
    expect(notes.length).toBe(1)
    expect(notes[0].category).toBe('H&S')
    expect(notes[0].pinned).toBe(true)
    expect(notes[0].note).toMatch(/^Lift roof tiles by hand.*\(no\. 3\)\n— Bat survey: “lifted by hand/s)
    vi.unstubAllGlobals()
  })
})
