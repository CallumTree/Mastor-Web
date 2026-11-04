/** The general scope reader: schedules, BoQs and scopes of works it has never seen, read by what their columns mean.
 *  Every document here is made up — no client's document or licensed rate file is used. */
import { readTable, readWorkbook, readDocxTables, readPdfTable, pdfRows, propertyOf, type Cell } from '../src/lib/scopeTable'
import { readSchedule } from '../src/lib/sheet'
import { docxEvents } from '../src/lib/worksOrder'
import { pdfPages, type Tok } from '../src/lib/pdfTable'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// ---- 1. A priced trade BoQ: title rows, section headings, a wrapped item, collection and VAT rows
const boq: Cell[][] = [
  ['Riverside Health Centre — refurbishment of ground floor'],
  ['Contract ref: RHC-2026-04'],
  [],
  ['Item', 'Description', 'Qty', 'Unit', 'Rate £', 'Amount £'],
  ['C', 'DEMOLITIONS AND ALTERATIONS'],
  ['C1', 'Take up existing vinyl floor covering', 42, 'm2', 6.5, 273],
  [null, 'and dispose of off site'],
  ['C2', 'Remove suspended ceiling grid and tiles', 42, 'm2', 9.25, 388.5],
  ['C3', 'Overhead door: remove and set aside for reuse', 1, 'nr', 120, 120],
  [null, 'Carried to collection', null, null, null, 781.5],
  [],
  ['D', 'Finishes'],
  ['D1', 'Supply and lay safety flooring to treatment room', 18.5, 'm2', 38, 703],
  ['D2', 'Collection of waste from site by licensed carrier', 1, 'item', null, 180],
  ['D3', 'Make good plaster to walls after removal of fittings', 12, 'm2', 22, 254],
  [null, 'Total', null, null, null, 1137],
  [null, 'VAT @ 20%', null, null, null, 383.70],
  [null, 'Grand total', null, null, null, 2302.20],
]
const a = readTable(boq)!
ok(!!a && a.lines.length === 6, `six items; collection, totals and VAT left out — got ${a?.lines.length}`)
ok(a.ref === 'RHC-2026-04', `contract ref from above the header — got "${a?.ref}"`)
ok(a.lines[0].description === 'Take up existing vinyl floor covering and dispose of off site', 'a description that runs on to the next row is joined back up')
ok(a.lines[0].workstream === 'Demolitions and alterations' && a.lines[3].workstream === 'Finishes', 'section headings ("C · DEMOLITIONS…", "D · Finishes") name the lines under them')
ok(a.lines[2].description.startsWith('Overhead door') && a.lines[4].description.startsWith('Collection of waste'), 'real work that starts "Overhead…" or "Collection…" is kept')
ok(a.lines[1].qty === 42 && a.lines[1].unit === 'm2' && a.lines[1].rate === 9.25 && a.lines[1].cost === 388.5, 'qty, unit, rate and amount from the right columns')
ok(a.lines[4].rate === null && a.lines[4].cost === 180 && a.lines[4].issues.includes('total only: £180.00'), 'an amount with no rate stays an amount — the rate is never worked out from it')
ok(a.lines[5].issues.some(i => i.startsWith('document cost £254.00 ≠ qty × rate £264.00')), 'a line that doesn’t add up is flagged, not corrected')

// ---- 2. A housing scope of works with no rates: properties and rooms as heading rows
const scope: Cell[][] = [
  ['Scheme: Kitchen and bathroom replacements, phase 2'],
  ['Ref', 'Location', 'Work required', 'Notes'],
  ['12 Acacia Avenue, Anytown'],
  ['Kitchen'],
  ['K1', '', 'Strip out existing kitchen units and worktops', ''],
  ['K2', '', 'Fit new kitchen to tenant choice', 'Tenant has chosen Shaker, oak'],
  ['B1', 'Bathroom', 'Replace bath with level-access shower', ''],
  [],
  ['14 Acacia Avenue'],
  ['Kitchen'],
  ['K1', '', 'Strip out existing kitchen units and worktops', ''],
  ['E1', 'Rear elevation', 'Renew back door in composite', ''],
]
const b = readTable(scope)!
ok(!!b && b.lines.length === 5, `five lines from a scope with no figures — got ${b?.lines.length}`)
ok(b.lines.map(l => l.property).join(',') === '12,12,12,14,14', `the property heading carries down to its lines — got ${b?.lines.map(l => l.property)}`)
ok(b.lines[0].room === 'Kitchen' && b.lines[2].room === 'Bathroom' && b.lines[4].room === 'Rear elevation', 'room from the heading, or from the location column where it is filled')
ok(b.lines[1].description === 'Fit new kitchen to tenant choice — Tenant has chosen Shaker, oak', 'the note goes with the line, as written')
ok(b.lines.every(l => l.qty === null && l.rate === null && l.issues.includes('no rate')), 'no quantity or rate is made up: blank and flagged')
ok(b.ref === 'Kitchen and bathroom replacements, phase 2', 'scheme name')

// ---- 3. A police / fire estates layout with its own column names
const estates: Cell[][] = [
  ['Asset Ref', 'Area', 'Specification', 'Quantity', 'U/M', 'Unit Price', 'Total Price'],
  ['FS-0412', 'Appliance bay', 'Clean and repaint floor markings in yellow', 64, 'lm', 3.4, 217.6],
  ['FS-0413', 'Appliance bay', 'Renew roller shutter door bottom seal', 2, 'nr', 85, 170],
  ['FS-0420', 'Mess room', 'Redecorate walls and ceiling, two coats emulsion', 48, 'm2', 7.1, 340.8],
  ['', '', 'Overheads & profit 8%', null, null, null, 58.27],
  ['', '', 'Total', null, null, null, 786.67],
]
const c = readTable(estates)!
ok(!!c && c.lines.length === 3, `three lines; overheads and total rows left out — got ${c?.lines.length}`)
ok(c.lines[0].code === 'FS-0412' && c.lines[0].room === 'Appliance bay' && c.lines[0].unit === 'lm', '"Asset Ref" is the code, "Area" the location, "U/M" the unit')
ok(c.lines[2].rate === 7.1 && c.lines[2].cost === 340.8 && c.lines[2].issues.length === 0, '"Unit Price" is the rate, "Total Price" the amount')

// ---- 4. "Unit" holding dwellings, and "No." holding item numbers
const dwell = readTable([
  ['No.', 'Unit', 'Description', 'Qty', 'UOM', 'Rate', 'Total'],
  ['1.01', '4A', 'Renew smoke alarm, mains wired with battery back-up', 1, 'nr', 64, 64],
  ['1.02', '7', 'Renew smoke alarm, mains wired with battery back-up', 2, 'nr', 64, 128],
  ['1.03', '12', 'Test and certify electrical installation', 1, 'item', 145, 145],
])!
ok(!!dwell && dwell.lines.map(l => l.property).join(',') === '4A,7,12', `"Unit" holding 4A, 7, 12 is the dwelling — got ${dwell?.lines.map(l => l.property)}`)
ok(dwell.lines.map(l => l.code).join(',') === '1.01,1.02,1.03', '"No." holding 1.01, 1.02 is the item number, not a house number')
ok(dwell.lines[1].unit === 'nr' && dwell.lines[1].qty === 2, 'UOM is the unit of measure')

// ---- 5. Money split into work columns, and the figures one row below a two-row description
const streams = readTable([
  ['Ref', 'Description', 'Qty', 'Rate', 'Roofing', 'Windows'],
  ['R10', 'Strip and re-cover main roof in natural slate', 86, 72.5, 6235, null],
  ['W04', 'Replace window in uPVC, double glazed', 4, 410, null, 1640],
  ['W05', 'Take out existing timber sill and'],
  [null, 'renew in uPVC to match', 4, 55, null, 220],
])!
ok(!!streams && streams.lines[0].workstream === 'Roofing' && streams.lines[0].cost === 6235 && streams.lines[1].workstream === 'Windows', 'a money column with its own heading is the work type; its figure is the line amount')
ok(streams.lines.length === 3 && streams.lines[2].code === 'W05' && streams.lines[2].description === 'Take out existing timber sill and renew in uPVC to match' && streams.lines[2].qty === 4, 'figures printed on the second row of a description go with the whole item')

// ---- 6. A workbook: summary sheet, a sheet per house, and a copy sheet
const house = (n: string): Cell[][] => [
  ['Item', 'Description', 'Qty', 'Unit', 'Rate', 'Total'],
  ['1', `Renew front door in composite (${n})`, 1, 'nr', 950, 950],
  ['2', 'Renew rainwater goods in black uPVC', 14, 'lm', 18, 252],
]
const wb = readWorkbook([
  { name: 'Summary', rows: [['House', 'Total'], ['3 Mill Lane', 1202], ['5 Mill Lane', 1202]] },
  { name: '3 Mill Lane', rows: house('No 3') },
  { name: '5 Mill Lane', rows: house('No 5') },
  { name: '5 Mill Lane (2)', rows: house('No 5') },
])!
ok(!!wb && wb.lines.length === 4, `every house sheet read, the summary and the repeated copy left out — got ${wb?.lines.length}`)
ok(wb.lines.map(l => l.property).join(',') === '3,3,5,5', 'a sheet named for a house gives its lines the property')
const trades = readWorkbook([
  { name: 'Electrical', rows: house('E') },
  { name: 'Plumbing', rows: house('P') },
])!
ok(trades.lines[0].workstream === 'Electrical' && trades.lines[2].workstream === 'Plumbing', 'a sheet named for a trade gives its lines the work type')
const titled = readWorkbook([{ name: 'BoQ', rows: house('B') }, { name: 'Pricing schedule', rows: house('P') }])!
ok(titled.lines.every(l => l.workstream === '' && l.property === ''), 'a sheet named for the document itself ("BoQ", "Pricing schedule") names nothing')

// the client's own exact layout still comes first, untouched
const council: Cell[][] = [['NUMBER', 'CODE', 'QTY', 'RATE', 'LOCATION', 'DESCRIPTION', 'PAINT', 'HOURS'], [1, '4360BD', 71, 8.55, 'PROPERTY', 'WASHDOWN AND APPLY MASONRY PAINT', 607.05, 0], [2, '4350AA', 27, 3.7753, 'ALL ELVS', 'GUTTER:CLEAN OUT', 101.93, 2.16]]
ok(JSON.stringify(readWorkbook([{ name: 'Spec', rows: council }])) === JSON.stringify(readSchedule(council)), 'a schedule the exact reader knows is read by it, exactly as before')

// ---- 7. Word: tables with headings between them, a table that runs on without a header, and a survey that isn't a schedule
const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
const tr = (...cells: string[]) => `<w:tr>${cells.map(x => `<w:tc><w:tcPr/>${p(x)}</w:tc>`).join('')}</w:tr>`
const tbl = (...rows: string[]) => `<w:tbl>${rows.join('')}</w:tbl>`
const docx = (...parts: string[]) => `<w:document><w:body>${parts.join('')}</w:body></w:document>`
const word = docxEvents(docx(
  p('Schedule of works'), p('Project: Station Road fire station, welfare upgrade'),
  p('Ground floor'),
  tbl(tr('Item', 'Description', 'Qty', 'Unit', 'Rate', 'Total'), tr('1', 'Strip out existing showers and make good', '3', 'nr', '180.00', '540.00'), tr('2', 'Install new shower cubicle complete', '3', 'nr', '1,250.00', '3,750.00')),
  p('First floor'),
  tbl(tr('3', 'Renew WC and basin to accessible toilet', '1', 'nr', '1,480.00', '1,480.00'), tr('4', 'Provide grab rails and alarm pull cord', '1', 'item', '', '320.00')),
))
const w = readDocxTables(word)!
ok(!!w && w.lines.length === 4, `four lines across two Word tables — got ${w?.lines.length}`)
ok(w.ref === 'Station Road fire station, welfare upgrade', `project from the paragraphs above — got "${w?.ref}"`)
ok(w.lines[0].workstream === 'Ground floor' && w.lines[2].workstream === 'First floor', 'the paragraph above each table names it')
ok(w.lines[1].rate === 1250 && w.lines[2].cost === 1480 && w.lines[3].rate === null && w.lines[3].cost === 320, 'a table without its own header row uses the one before; £ and commas read')
const survey = docxEvents(docx(
  p('Asbestos register'),
  tbl(tr('Ref', 'Location', 'Description', 'Material', 'Risk'), tr('S01', 'Kitchen', 'Floor tiles under vinyl', 'Chrysotile', 'Low'), tr('S02', 'Loft', 'Water tank lid', 'Cement', 'Low'), tr('S03', 'Hall', 'Textured coating to ceiling', 'Chrysotile', 'Low')),
))
ok(readDocxTables(survey, { strict: true }) === null, 'sorting a pack: a survey laid out in a table is not taken as a schedule')
ok(readDocxTables(word, { strict: true })?.lines.length === 4, 'sorting a pack: a priced schedule in Word still is')
const wordScope = docxEvents(docx(
  p('Scope of works: 7 Quarry Row'),
  tbl(tr('Ref', 'Location', 'Work required'), tr('1', 'Kitchen', 'Strip out units and worktops, dispose of off site'), tr('2', 'Kitchen', 'Fit new kitchen to agreed layout'), tr('3', 'Bathroom', 'Replace bath with walk-in shower tray'), tr('4', 'Hall', 'Renew front door in composite')),
))
const ws = readDocxTables(wordScope, { strict: true })
ok(ws?.lines.length === 4 && ws.lines.every(l => l.qty === null && l.property === '7'), 'sorting a pack: a scope of works with no figures still counts, because its lines say what work to do')

// ---- 8. PDF: text with positions laid back into columns
const at = (s: string, x: number, y: number): Tok => ({ s, x, y, w: s.length * 4.5 })
const right = (s: string, edge: number, y: number): Tok => ({ s, x: edge - s.length * 4.5, y, w: s.length * 4.5 })
const head = (y: number) => [at('Item', 40, y), at('Description', 80, y), at('Qty', 331, y), at('Unit', 360, y), at('Rate', 401, y), at('Total', 462, y)]
const row = (y: number, item: string, desc: string, qty: string, unit: string, rate: string, total: string) =>
  [at(item, 40, y), at(desc, 80, y), right(qty, 345, y), at(unit, 360, y), right(rate, 420, y), right(total, 484, y)]
const pages = [
  { items: [at('Bill of quantities', 40, 40), at('Contract: Hillside School roof', 40, 55), ...head(90),
    ...row(110, '1.1', 'Strip existing felt roof covering', '120', 'm2', '8.00', '960.00'),
    at('to classroom block', 80, 120),
    ...row(135, '1.2', 'Lay new single-ply membrane', '120', 'm2', '46.50', '5,580.00'),
    ...row(150, '1.3', 'Renew lead flashings', '18', 'lm', '42.00', '756.00'),
    at('Page 1 of 2', 260, 800)] },
  { items: [...head(40),
    ...row(60, '1.4', 'Replace rainwater outlets', '4', 'nr', '95.00', '380.00'),
    ...row(75, '1.5', 'Edge trims in aluminium', '64', 'lm', '21.00', '1,344.00'),
    at('Page 2 of 2', 260, 800)] },
]
const rows = pdfRows(pages)!
ok(!!rows && rows.some(r => r[1] === 'Strip existing felt roof covering' && r[2] === '120' && r[5] === '960.00'), 'each piece of text lands in its column (figures by their right edge)')
const pdf = readPdfTable(pages)!
ok(!!pdf && pdf.lines.length === 5, `five lines over two pages; repeated header and page numbers left out — got ${pdf?.lines.length}`)
ok(pdf.lines[0].description === 'Strip existing felt roof covering to classroom block', 'a wrapped line in the PDF is joined back up')
ok(pdf.lines[1].cost === 5580 && pdf.lines[4].rate === 21 && pdf.ref === 'Hillside School roof', 'figures and contract read')
const listPdf = [{ items: [at('Ref', 40, 90), at('Location', 80, 90), at('Description', 200, 90), at('S01', 40, 110), at('Kitchen', 80, 110), at('Floor tiles under vinyl', 200, 110), at('S02', 40, 125), at('Loft', 80, 125), at('Water tank lid', 200, 125), at('S03', 40, 140), at('Hall', 80, 140), at('Textured coating', 200, 140)] }]
ok(readPdfTable(listPdf) === null, 'a PDF table without figures goes to the AI reader, which reads PDFs well and flags its lines')

// ---- 9. Not a schedule, and the property names it recognises
ok(readTable([['Dear Sir'], ['Please find attached our quote.'], ['Regards']]) === null, 'a letter is not a schedule → null (the AI reader takes it)')
ok(readTable([['Name', 'Phone'], ['A. Jones', '01234']]) === null, 'a contact list is not a schedule')
ok(propertyOf('Property address: 3 Elm Road, Anytown') === '3' && propertyOf('Plot 14') === '14' && propertyOf('Flat 2B') === '2B' && propertyOf('Kitchen') === null && propertyOf('2 nr doors') === null, 'property headings: address, plot, flat — not a room or a quantity')

ok(readTable([['No.', 'Description', 'Qty', 'Unit'], ...[1, 2, 3, 4, 5].map(n => [n, `Ease and adjust door ${n}`, 1, 'nr'])])!.lines.every((l, i) => l.code === String(i + 1) && l.property === ''),
  '"No." counting 1, 2, 3 down the page is the item number (house numbers repeat over a property’s lines)')

// ---- 10. Real files: an Excel workbook and a PDF written by real software, read back the way the app reads them
;(async () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Voids programme — schedule of works'], ['Project: Brookside voids, batch 7'], [],
    ['Property', 'Room', 'Task', 'Quantity', 'UoM', 'Comments'],
    ['22 Brookside Close', 'Kitchen', 'Renew worktop, roll edge 38mm', 3, 'lm', ''],
    ['22 Brookside Close', 'Kitchen', 'Clean through and sanitise', 1, 'item', 'Heavy grease'],
    ['24 Brookside Close', 'Hall', 'Renew front door lock, euro cylinder', 1, 'nr', 'Keys to housing officer'],
  ]), 'Batch 7')
  const back = XLSX.read(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), { type: 'array' })
  const x = readWorkbook(back.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json<Cell[]>(back.Sheets[n], { header: 1, blankrows: true, defval: null }) })))!
  ok(!!x && x.lines.length === 3 && x.ref === 'Brookside voids, batch 7' && x.lines.map(l => l.property).join(',') === '22,22,24' && x.lines[1].description === 'Clean through and sanitise — Heavy grease',
    'an .xlsx file: title rows, an address column as the property, the task and its comment')

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const items = Array.from({ length: 40 }, (_, i) => [`${i + 1}`, i % 7 === 0 ? `Renew window board in MDF, painted, including removal of existing and making good to plaster reveals (${i})` : `Ease and adjust internal door ${i}`, `${(i % 5) + 1}`, i % 2 ? 'nr' : 'm', '12.40', ((i % 5 + 1) * 12.4).toFixed(2)])
  for (const halign of ['left', 'center', 'right'] as const) {
    const doc = new jsPDF()
    doc.text('Schedule of works — Hilltop primary school', 14, 16)
    autoTable(doc, { head: [['No.', 'Description of works', 'Quantity', 'UoM', 'Unit rate', 'Line total']], body: [['', 'INTERNAL JOINERY', '', '', '', ''], ...items], startY: 24, styles: { fontSize: 8 }, headStyles: { halign }, columnStyles: { 1: { cellWidth: 85 }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } })
    const r = readPdfTable(await pdfPages(new Uint8Array(doc.output('arraybuffer')), pdfjs as never))
    const right = r?.lines.filter((l, i) => l.code === String(i + 1) && l.qty === (i % 5) + 1 && l.unit === (i % 2 ? 'nr' : 'm') && l.rate === 12.4 && l.cost === +(((i % 5) + 1) * 12.4).toFixed(2) && l.workstream === 'Internal joinery').length
    ok(r?.lines.length === 40 && right === 40 && r.lines[7].description.endsWith('making good to plaster reveals (7)'),
      `a real two-page PDF with headings set ${halign}: every line, figure and wrapped description in place — ${right ?? 0}/40`)
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
