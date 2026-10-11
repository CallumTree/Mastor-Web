/**
 * Schedule of rates, through the real screens: import a Word SoR, search it, price a variation and a
 * scope line from it, and spot a duplicate edition.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import App from '../src/App'

const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1)!, { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)

/** A minimal .docx: just word/document.xml, laid out like the M3NHF schedules. */
function sorDocx(name: string, rows: string[][]): File {
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t.replace(/&/g, '&amp;')}</w:t></w:r></w:p></w:tc>`
  const xml = '<?xml version="1.0"?><w:document><w:body>'
    + '<w:p><w:r><w:t>M3NHF Schedule of Rates</w:t></w:r></w:p><w:p><w:r><w:t>VERSION 8</w:t></w:r></w:p><w:p><w:r><w:t>Planned Maintenance</w:t></w:r></w:p>'
    + '<w:tbl>' + rows.map(r => `<w:tr>${r.map(cell).join('')}</w:tr>`).join('') + '</w:tbl></w:body></w:document>'
  const zip = XLSX.CFB.utils.cfb_new()
  XLSX.CFB.utils.cfb_add(zip, '/word/document.xml', new TextEncoder().encode(xml))
  const bytes = XLSX.CFB.write(zip, { type: 'array', fileType: 'zip' }) as number[]
  return new File([new Uint8Array(bytes)], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
const ROWS = [
  ['', 'FENCING AND GATES', '', ''], ['', 'Fencing - Boarded', '', ''],
  ['0171AD', 'FENCING:RENEW 1.8M BOARD - TIMBER POST', 'LM', '133.91'],
  ['', 'Fencing:Renew or provide new 1.65m high tanalised timber vertical board fencing.', '', ''],
  ['', 'PLASTERING', '', ''], ['', 'Plaster - Walls', '', ''],
  ['3051AB', 'PLASTER:RENEW WALL HARDWALL', 'SM', '42.10'],
  ['', 'Plaster:Hack off and renew wall plaster in hardwall.', '', ''],
]
const pick = (files: File[]) => fireEvent.change(document.querySelector('input[type=file][accept*=".docx"]')!, { target: { files } })

describe('schedule of rates', () => {
  it('import → search → price a VO and a scope line from it; a second copy is spotted', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })

    // --- import from the jobs board
    click(screen.getByRole('button', { name: /schedule of rates/i }))
    await screen.findByText(/no rate books yet/i)
    pick([sorDocx('CURRENT_Planned_v8.docx', ROWS)])
    await screen.findByText('2 rates')
    expect((screen.getByLabelText('Book name') as HTMLInputElement).value).toBe('Planned Maintenance v8')
    click(screen.getByRole('button', { name: 'Add 1 book' }))
    await screen.findByText('Your rate books · 1')

    // --- search by words, read the full description
    expect(screen.getAllByLabelText(/search by code or words/i).length).toBe(1)
    type(/search by code or words/i, 'fencing 1.8m')
    click(await screen.findByRole('button', { name: /0171AD/ }))
    expect(screen.getByText(/tanalised timber vertical board/)).toBeTruthy()
    expect(screen.getByText(/FENCING AND GATES · Fencing - Boarded/)).toBeTruthy()

    // --- the same schedule again (e.g. the Medium edition) is not added twice
    pick([sorDocx('CURRENT_Planned_v8_Mediums.docx', ROWS)])
    await screen.findByText(/already in your library as “Planned Maintenance v8”/i)
    expect((screen.getByRole('button', { name: 'Add 0 books' }) as HTMLButtonElement).disabled).toBe(true)
    click(screen.getByRole('button', { name: 'Cancel' }))
    click(screen.getByRole('button', { name: 'Close' }))

    // --- a job with a variation, priced from the book
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', '4 Rates Road')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('4 Rates Road')
    nav('vos')
    click(await screen.findByRole('button', { name: /log variation/i }))
    type(/extra work/i, 'Replace fence panels to rear')
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    click(await screen.findByRole('button', { name: /Replace fence panels to rear/ }))
    type('SoR code', '0171ad')
    click(await screen.findByRole('button', { name: 'Use £133.91' }))
    expect((screen.getByLabelText(/Rate \(£\)/) as HTMLInputElement).value).toBe('133.91')
    expect((screen.getByLabelText('Unit') as HTMLInputElement).value).toBe('LM')
    expect(screen.getByText('From Planned Maintenance v8')).toBeTruthy()
    type('SoR code', '9999ZZ')
    await screen.findByText('9999ZZ isn’t in your rate books.')     // an unknown code is never priced
    type('SoR code', '0171AD')
    click(await screen.findByRole('button', { name: 'Use £133.91' }))
    type('Qty', '12')
    click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('£1,606.92')

    // --- a scope line found by description fills code, description, unit and rate
    nav('scope')
    click(await screen.findByRole('button', { name: /add item/i }))
    click(screen.getByRole('button', { name: /find a rate by description/i }))
    type(/search by code or words/i, 'hardwall')
    click(await screen.findByRole('button', { name: /3051AB/ }))
    click(screen.getByRole('button', { name: 'Use this rate' }))
    expect((screen.getByLabelText('SoR code') as HTMLInputElement).value).toBe('3051AB')
    expect((screen.getByLabelText('Description *') as HTMLTextAreaElement).value).toBe('PLASTER:RENEW WALL HARDWALL')
    expect((screen.getByLabelText(/Rate \(£\)/) as HTMLInputElement).value).toBe('42.1')
    type('Qty', '10')
    click(screen.getAllByRole('button', { name: 'Add item' }).at(-1)!)
    await waitFor(() => expect(screen.getAllByText('£421.00').length).toBeGreaterThan(0))
  })
})
