import { bookName, coveredBy, docxXmlRows, rowsToRates, searchRates, sheetToRates } from '../src/lib/rates'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

console.log('Word schedules (M3NHF layout)')
// Planned: [code, short, unit, rate] then the long description under the short one; headings in the description column
const planned = [
  ['', 'FENCING AND GATES', '', ''], ['', '', '', ''], ['', 'Fencing - Boarded', '', ''], ['', '', '', ''],
  ['0171AD', 'FENCING:RENEW 1.8M BOARD - TIMBER POST', 'LM', '133.91'],
  ['', 'Fencing:Renew or provide new 1.65m high tanalised timber vertical board fencing.', '', ''], ['', '', '', ''],
  ['0171AE', 'FENCING:RENEW NE 1.2M BOARD PCC POST', 'LM', '1,117.48'],
  ['', 'Fencing:Renew or supply new ne 1.05m fencing.', '', ''],
  ['0171AF', 'FENCING:RATE TO BE AGREED', 'LM', 'TBA'],            // no readable rate → left out, counted
  ['0171AD', 'FENCING:RENEW 1.8M BOARD - TIMBER POST', 'LM', '999'], // repeated later → first kept
  ['M2', 'Multiskilled gang', '36.89', ''],                          // labour table row, not a rate
]
const p = rowsToRates(planned, 'b1')
ok(p.items.length === 2, `two rates read (${p.items.length})`)
ok(p.skipped === 1, 'line without a readable rate is left out and counted')
const fa = p.items[0]
ok(fa.code === '0171AD' && fa.unit === 'LM' && fa.rate === 133.91, 'code, unit and rate exactly as printed')
ok(fa.long.startsWith('Fencing:Renew or provide new 1.65m'), 'long description taken from the row under')
ok(fa.section === 'FENCING AND GATES' && fa.subsection === 'Fencing - Boarded', 'section and subsection from the headings')
ok(p.items[1].rate === 1117.48, 'thousands separator read')
ok(p.items.find(i => i.code === '0171AD')!.rate === 133.91, 'first copy of a repeated code kept')

// Responsive: [code, priority, short, unit, rate]
const resp = rowsToRates([
  ['', '', 'FOUNDATIONS', '', ''], ['', '', 'Floor - Concrete Internal Renewal', '', ''],
  ['015003', 'R', 'FLOOR:RENEW INTERNAL CONCRETE INSULATION', 'SM', '228.62'],
  ['', '', 'Floor:Break up existing floor complete.', '', ''],
], 'b2')
ok(resp.items.length === 1 && resp.items[0].priority === 'R' && resp.items[0].short.startsWith('FLOOR:RENEW') && resp.items[0].rate === 228.62, 'responsive layout: priority column read, short description kept')

const xml = '<w:body><w:p><w:r><w:t>M3NHF Schedule of Rates</w:t></w:r></w:p><w:p><w:r><w:t>VERSION 8</w:t></w:r></w:p><w:p><w:r><w:t>Planned Maintenance and Property</w:t></w:r></w:p><w:p><w:r><w:t>Reinvestment Works</w:t></w:r></w:p>'
  + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>2401AA</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>SCAFFOLDING:PROVIDE &amp; ERECT</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>SM</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>21.65</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>'
const d = docxXmlRows(xml)
ok(d.rows.length === 1 && d.rows[0][1] === 'SCAFFOLDING:PROVIDE & ERECT' && d.rows[0][3] === '21.65', 'table cells read from document.xml, entities decoded')
ok(bookName(d.title, 'x.docx') === 'Planned Maintenance and Property Reinvestment Works v8', `book named from the cover (${bookName(d.title, 'x.docx')})`)
ok(bookName([], 'CURRENT_2025-2029_-_Scaffolding_Rates.docx') === '2025-2029 - Scaffolding Rates', 'falls back to a tidy file name')

const lab = rowsToRates([['Trade Code', 'Trade Description', 'Labour Rate (£)'], ['M', 'Multiskilled operative', '20.92'], ['M2', 'Multiskilled gang', '36.89']], 'b3')
ok(lab.items.length === 2 && lab.items[0].code === 'M' && lab.items[0].rate === 20.92 && lab.items[0].unit === 'HR' && lab.items[0].section === 'LABOUR RATES', 'labour rates table read for dayworks (M £20.92/hr)')

console.log('Rate spreadsheets (additional rates)')
const kitchen = sheetToRates([
  ['Kitchen Install only prices'], ['Material to be ordered from Kitchen Fittings order sheet'], [],
  ['Document Code', 'Priority', 'Short Description', 'Section', 'Subsection', 'UOM', 'SOR PCC Framework', 'Long Description'],
  ['3710AA', 'X', 'KITCHEN UNIT:RENEW SINGLE BASE', 'Kitchen Units and Worktops', 'Kitchen Units', 'NO', 46.7736, 'Kitchen Unit:Renew any type of single base unit'],
], 'k')!
ok(kitchen.items.length === 1 && kitchen.items[0].rate === 46.77 && kitchen.items[0].unit === 'NO', 'framework rate column read, rounded to the penny')
ok(kitchen.items[0].long.startsWith('Kitchen Unit:Renew') && kitchen.items[0].subsection === 'Kitchen Units', 'long description and subsection columns')
ok(kitchen.notes.includes('Material to be ordered from Kitchen Fittings order sheet'), 'conditions above the header kept as book notes')
const fencing = sheetToRates([
  ['Fencing'], [], [null, 'SOR Code', 'Description', 'UOM', 'Rate'], [null, null, null, null, 'as of March 2026'], [null, null, 'FENCING '],
  [null, 'DIS0194', 'CLOSE BOARDED FENCING', 'Lm', 102.49591391991282],
], 'f')!
ok(fencing.items[0].code === 'DIS0194' && fencing.items[0].rate === 102.5 && fencing.items[0].section === 'FENCING', 'offset columns, section row, rate rounded')
ok(fencing.notes.includes('as of March 2026'), '"as of" line kept as a note')
const elec = sheetToRates([
  ['NEW RATE', 'Rate', 'Description', 'Cost', 'Rate', 'Description', 'Cost', 'TOTAL REWIRE', 'Contractors %', 'CONTRACTOR PRICE'],
  ['8552AAV1', '8551AA', 'Strip 1 Bed Flat', 144.62, '8552AA', 'Rewire 1 Bed Flat - Ground/Mid', 2457.79, 3466.64, null, 3466.64],
], 'e')!
ok(elec.items[0].code === '8552AAV1' && elec.items[0].rate === 3466.64 && elec.items[0].short === 'Rewire 1 Bed Flat - Ground/Mid', 'composite rate: contractor price and the last description')
ok(sheetToRates([['Name', 'Value'], ['a', 1]], 'x') === null, 'a sheet without a code column is not a rate book')

console.log('Duplicates and search')
const a = [{ ...fa }], b = [{ ...fa }, { ...p.items[1] }]
ok(coveredBy(a, b) && !coveredBy(b, a), 'a book wholly inside another at the same rates is spotted')
ok(!coveredBy([{ ...fa, rate: 1 }], b), 'same code at a different rate is not a duplicate')
const all = [...p.items, ...resp.items, ...kitchen.items]
ok(searchRates(all, '0171ae')[0].code === '0171AE', 'exact code first, any case')
ok(searchRates(all, '0171').length === 2, 'code prefix')
ok(searchRates(all, 'renew 1.8m')[0].code === '0171AD', 'every word must match the description')
ok(searchRates(all, '').length === 0, 'empty search shows nothing')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
