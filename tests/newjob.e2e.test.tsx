/** A new job from the client's pack: choose the files, the job's details come from them, type only the PO, create — lines, addresses and documents in one go. */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import * as XLSX from 'xlsx'
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'
import { jobFromPack, nameFromFile, schemeStreet } from '../src/lib/packJob'

afterAll(async () => { cleanup(); vi.unstubAllGlobals(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`
const tr = (...cells: string[]) => `<w:tr>${cells.map(c => `<w:tc>${p(c)}</w:tc>`).join('')}</w:tr>`
const tbl = (...rows: string[]) => `<w:tbl>${rows.join('')}</w:tbl>`
function docx(xml: string, name: string) {
  const cfb = XLSX.CFB.utils.cfb_new()
  XLSX.CFB.utils.cfb_add(cfb, 'word/document.xml', new TextEncoder().encode(xml))
  return new File([XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array' }) as ArrayBuffer], name)
}
const head = tr('Description', 'Comments', 'Code', 'Quantity', 'Units', 'Rate', 'Cost')
const order = docx(`<w:document><w:body>${tbl(tr('Contract Reference:', 'MH9'), tr('Title of Work:', 'Ash Grove Anytown Painting'), tr('Contract Value', '£592.20'))}
${p('Property Address: 3 Ash Grove, Anytown, AB1 2CD')}${p('Location: All Elv')}${tbl(head, tr('Walls: Wash Down And Apply Masonry Paint', '', '4360BD', '93', 'SM', '£5.62', '£522.66'))}
${p('Property Address: 5 Ash Grove, Anytown, AB1 2CD')}${p('Location: Rear')}${tbl(head, tr('Gutter: Clean Out', '', '4350AA', '21.8', 'LM', '£3.19', '£69.54'))}
</w:body></w:document>`, 'MH9 Ash Grove Painting.docx')
const pciText = 'Pre-construction information. Client: Seaview Homes Housing Association. The principal contractor shall keep the site secure at all times and agree working hours with the client. Residents remain in occupation throughout the works; access to each property is to be arranged with the tenant at least two days ahead.'
const pci = new File([pciText], 'PCI.txt', { type: 'text/plain' })

describe('new job from the client’s pack', () => {
  it('names what it can only from the pack', () => {
    expect(schemeStreet({ 3: '3 Ash Grove, Anytown, AB1 2CD', 5: '5 Ash Grove, Anytown, AB1 2CD', 1: '1 Bay View, Anytown, AB1 2CE' })).toBe('Ash Grove, Anytown')
    expect(nameFromFile('Park Road - Schedule of Works v2.xlsx')).toBe('Park Road')
    expect(nameFromFile('BoQ_final.pdf')).toBe('')
    const read = jobFromPack({ ref: '', lines: [], truncated: false, orders: [{ file: '', contract: 'X', project: '', title: '', contractValue: null, lines: [], properties: [], problems: [] }], agreed: 0, findings: [], addresses: {}, files: [], facts: undefined })
    expect(read.contractValue).toBeNull()   // a works order without a printed value: left blank, never summed from the lines
    expect(read.client).toBe('')            // no PCI: the client is for a person to type
  })

  it('fills the job from the works order and the PCI, the PO is typed, one tap creates it all', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('read-pack')
      ? new Response(JSON.stringify({ cut: [], facts: [], extras: [], client: { text: 'Seaview Homes Housing Association', document: 'PCI.txt', page: null, quote: 'Client: Seaview Homes Housing Association' } }), { status: 200 })
      : new Response('{}', { status: 404 })))
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    fireEvent.change(await screen.findByLabelText(/new job: choose the client’s files/i), { target: { files: [order, pci] } })
    await screen.findByText('New job · check it')

    expect((screen.getByLabelText(/^Job name \*/) as HTMLInputElement).value).toBe('Ash Grove')
    expect((screen.getByLabelText(/^Client(?!’s)/) as HTMLInputElement).value).toBe('Seaview Homes Housing Association')
    expect((screen.getByLabelText(/^Site address/) as HTMLInputElement).value).toBe('Ash Grove, Anytown')
    expect((screen.getByLabelText(/^Contract ref/) as HTMLInputElement).value).toBe('MH9')
    expect((screen.getByLabelText(/PO value/) as HTMLInputElement).value).toBe('592.2')
    expect(screen.getAllByText('From 2 properties in the works orders').length).toBe(2)   // the name and the address
    expect(screen.getByText(/From the works order — check it against the PO/)).toBeTruthy()
    expect(screen.getByText('Matches your contract value')).toBeTruthy()   // the BoQ against the value just read

    type(/PO number/i, 'PO4471')
    click(screen.getByRole('button', { name: 'Create the job · 2 items' }))
    await screen.findByRole('heading', { name: 'Ash Grove' })   // straight into the new job

    const job = (await db.jobs()).find(j => j.name === 'Ash Grove')!
    expect(job).toMatchObject({ client: 'Seaview Homes Housing Association', contractRef: 'MH9', poNumber: 'PO4471', contractValue: 592.2, address: 'Ash Grove, Anytown', kind: 'scheme' })
    expect(job.properties).toEqual({ 3: '3 Ash Grove, Anytown, AB1 2CD', 5: '5 Ash Grove, Anytown, AB1 2CD' })
    await waitFor(async () => expect((await db.scope(job.id)).length).toBe(2))
    expect((await db.list('docs', job.id)).map(d => d.kind)).toEqual(['Client pack', 'Client pack'])
  })

  it('a client named in a quote the PCI doesn’t hold is left blank', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('read-pack')
      ? new Response(JSON.stringify({ cut: [], facts: [], extras: [], client: { text: 'Bayside Council', document: 'PCI.txt', page: null, quote: 'Client: Bayside Council' } }), { status: 200 })
      : new Response('{}', { status: 404 })))
    cleanup(); render(<App />)
    fireEvent.change(await screen.findByLabelText(/new job: choose the client’s files/i), { target: { files: [order, pci] } })
    await screen.findByText('New job · check it')
    expect((screen.getByLabelText(/^Client(?!’s)/) as HTMLInputElement).value).toBe('')
    click(screen.getByRole('button', { name: /choose different files/i }))
    click(within(document.querySelector('.sheet') as HTMLElement).getByRole('button', { name: /set it up by hand/i }))
    expect(await screen.findByRole('button', { name: 'Create job' })).toBeTruthy()
  })

  it('a new job for a client you have worked for brings their invoice address and uplifts, said so; no "type of work"', async () => {
    cleanup(); await wipeLocal()
    await db.putJob({ id: 'old', name: 'Elm Row', client: 'Example Council', clientAddress: 'Finance, Civic Centre, Anytown', address: '', contractRef: '', poNumber: 'PO1', contractValue: 0, uplift1: 4.2, uplift2: 2.5, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 })
    render(<App />)
    click(await screen.findByRole('button', { name: /set it up by hand/i }))
    expect(screen.queryByText('Type of work')).toBeNull()
    fireEvent.change(screen.getByLabelText('Job name *'), { target: { value: 'Ash Grove' } })
    fireEvent.change(screen.getByLabelText(/^Client(?!’s)/), { target: { value: 'example  council' } })
    expect((await screen.findByLabelText(/^Client’s invoice address/) as HTMLInputElement).value).toBe('Finance, Civic Centre, Anytown')
    expect(screen.getByText('From your last job for Example Council: check it')).toBeTruthy()
    expect((screen.getByLabelText(/^Uplift 1/) as HTMLInputElement).value).toBe('4.2')
    expect((screen.getByLabelText(/^Uplift 2/) as HTMLInputElement).value).toBe('2.5')
    click(screen.getByRole('button', { name: 'Create job' }))
    await waitFor(async () => expect((await db.jobs()).find(j => j.name === 'Ash Grove')).toMatchObject({ clientAddress: 'Finance, Civic Centre, Anytown', uplift1: 4.2, uplift2: 2.5, workType: 'PPR' }))
  })
})
