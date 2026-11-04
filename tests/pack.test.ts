/** Client pack: works orders read exactly from Word, pieced together with the spec list, every disagreement flagged. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { docxEvents, docxXml, readWorksOrder, contractTrade } from '../src/lib/worksOrder'
import { readPack } from '../src/lib/pack'
import type { ParsedBoq, ParsedLine } from '../src/lib/boq'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// ---- a works order as Word writes it: contract box, address/location paragraphs, line tables, total
const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
const tr = (...cells: string[]) => `<w:tr>${cells.map(c => `<w:tc><w:tcPr/>${p(c)}</w:tc>`).join('')}</w:tr>`
const tbl = (...rows: string[]) => `<w:tbl>${rows.join('')}</w:tbl>`
const HEAD = tr('Description', 'Comments', 'Code', 'Quantity', 'Units', 'Rate', 'Cost')
const box = (ref: string, title: string, value: string) => tbl(tr('Contract Reference:', ref), tr('Project Reference:', '25W000X'), tr('Title of Work:', title), tr('Contract Value', value))
const doc = (...parts: string[]) => `<w:document><w:body>${parts.join('')}</w:body></w:document>`
const paint = doc(
  box('MH1', 'Elm Road Anytown Painting', '£1350.36'),
  p('Property Address:  3 Elm Road, Anytown, AB1 4PY'), p('Location:  All Elv'),
  tbl(HEAD, tr('Walls: Wash Down And Apply Masonry Paint', '', '4360BD', '93', 'SM', '£5.62', '£522.66'), tr('Scaffolding: Provide 5 To 10m', '', 'SCA005', '1', 'IT', '£750.00', '£750.00')),
  p('Location:  Rear'), tbl(HEAD, tr('Gutter: Clean Out', 'Back only', '4350AA', '21.8', 'LM', '£3.19', '£69.54')),
  tbl(tr('', 'Total Cost'), tr('', '£1342.20')),
  p('Property Address:  4 Elm Road, Anytown, AB1 4PY'), p('Location:'),
  tbl(tr('', 'Total Cost'), tr('', '£8.16')),
)
const roof = doc(
  box('MH2', 'Elm Road, Anytown- WHQS', '£5575.80'),
  p('Property Address:  3 Elm Road, Anytown, AB1 4PY'), p('Location:  All Elv'),
  tbl(HEAD, tr('Scaffolding: Provide 5 To 10m', '', 'SCA005', '1', 'IT', '£750.00', '£750.00'), tr('Slate: Renew Fibre Cement', '', '2032AA', '60', 'SM', '£80.43', '£80.43')),
  p('Location:  Kitchen'), tbl(HEAD, tr('Fan: Isolate, Install Two Speed', '', '841013', '1', 'NO', '£378.00', '£378.00')),
)
const ev = docxEvents(paint)
const a = readWorksOrder(ev, 'paint.docx')!
ok(!!a && a.contract === 'MH1' && a.title === 'Elm Road Anytown Painting' && a.contractValue === 1350.36, 'contract box: reference, title, contract value')
ok(a.lines.length === 3 && a.lines[2].location === 'Rear' && a.lines[2].comment === 'Back only' && a.lines[2].qty === 21.8 && a.lines[2].unit === 'LM', 'lines carry their address, location, comment, qty and unit')
ok(a.properties.map(x => x.property).join(',') === '3,4' && a.properties[0].address.startsWith('3 Elm Road'), 'house numbers from the property address')
ok(a.problems.some(x => /No\. 4: prints a total of £8\.16 but lists no lines/.test(x)), 'a property with a printed total but no lines is caught')
ok(a.problems.some(x => /Contract value £1350\.36, the lines add to £1342\.20/.test(x)), 'contract value vs the lines')
ok(!a.problems.some(x => /^No\. 3/.test(x)), 'no. 3 adds up to its printed total')
const b = readWorksOrder(docxEvents(roof), 'roof.docx')!
ok(b.problems.some(x => /2032AA: prints £80\.43, but 60 × £80\.43 = £4825\.80/.test(x)), 'a line printed as the rate instead of qty × rate is caught')
ok(contractTrade('Elm Road, Anytown- WHQS', ['3 Elm Road, Anytown, AB1 4PY']) === 'WHQS', 'trade from the title, address words removed')
ok(readWorksOrder(docxEvents(doc(p('HAZARD IDENTIFICATION'), tbl(tr('AREA', 'ACTION')))), 'ra.docx') === null, 'a risk register is not a works order')

// ---- pieced together with the spec list
const L = (property: string, code: string, qty: number | null, rate: number, room: string, workstream: string): ParsedLine =>
  ({ include: true, code, room, description: `${code} short`, qty, unit: '', rate, cost: null, property, workstream, hours: 1, note: '', issues: [] })
const spec: ParsedBoq = { ref: 'ELM ROAD', truncated: false, lines: [
  L('3', '4360BD', 93, 5.62, 'All elevations', 'PPR Paint'),
  L('3', 'SCA005', 1, 750, 'All elevations', 'PPR Paint'),
  L('3', '4350AA', 21.8, 3.1881, 'Rear', 'PPR Paint'),
  L('3', '2032AA', null, 80.429, 'All elevations', 'Roofing'),
  L('3', '8410XA', 1, 246.629, 'Kitchen', 'Decarb'),
  L('4', '4360BD', 1.45, 5.62, 'All elevations', 'PPR Paint'),
] }
const r = readPack([spec], [a, b])
const line = (code: string, contract?: string) => r.lines.find(l => l.code === code && (!contract || l.contract === contract))!
ok(r.agreed === 3, `3 lines agree in both documents (got ${r.agreed})`)
ok(line('4350AA').rate === 3.19 && line('4350AA').issues.length === 0 && line('4350AA').workstream === 'PPR Paint' && line('4350AA').hours === 1, 'agreed line: the contract’s 2-place rate, the spec list’s workstream and hours, no flag for a rounding difference')
ok(line('4360BD').unit === 'SM' && line('4360BD').contract === 'MH1', 'unit and contract from the works order')
ok(line('2032AA').qty === 60 && line('2032AA').issues.some(i => i === 'qty: works order 60, spec list none'), 'qty differs: works order used, spec list figure shown')
ok(line('841013').issues.some(i => /^code: works order 841013 at £378\.00, spec list 8410XA/.test(i)) && !r.lines.some(l => l.code === '8410XA'), 'different code for the same item: paired, not counted twice')
ok(line('SCA005', 'MH2').issues.some(i => /also on MH1 \(Painting\) for no\. 3/.test(i)), 'the same scaffold on two contracts is flagged')
ok(r.findings.some(f => /SCA005 on both MH1 \(Painting\) and MH2 \(WHQS\) for no\. 3 — £750\.00/.test(f)), 'and summarised with its value')
const four = r.lines.find(l => l.property === '4')!
ok(four.include && four.issues.some(i => /MH1 \(Painting\) prints a total for no\. 4 but lists no lines/.test(i)), 'spec list line where the works order prints a total but no lines: included, and says why')
const extra = readPack([{ ...spec, lines: [...spec.lines, L('3', '0030AB', 2, 98.21, 'Front', 'PPR Repairs')] }], [a, b]).lines.find(l => l.code === '0030AB')!
ok(!extra.include && extra.issues.some(i => /not on the works order, so left out/.test(i)), 'spec list line the works order doesn’t have: left out (the works order is the contract), flagged')
ok(r.addresses['3'] === '3 Elm Road, Anytown, AB1 4PY' && r.ref === 'MH1 · MH2', 'addresses and contract refs for the job')
ok(readPack([spec], []).lines.length === 6, 'spec list alone: read as before')

;(async () => {
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
