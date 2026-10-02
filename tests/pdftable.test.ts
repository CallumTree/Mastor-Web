import { existsSync, readFileSync } from 'node:fs'
import { readPdfSchedule, pdfPages, type Tok } from '../src/lib/pdfTable'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// Synthetic layout matching the council spec sheet: totals row, SITE, header (page 1 only),
// each line spread over three heights, workstream £ columns, a second page with no header.
const S = [['PPR PAINT', 379], ['PPR REPAIRS', 410], ['KITCHEN', 483], ['SCAFFOLD', 584]] as const
const header: Tok[] = [['NUMBER', 73], ['CODE', 102], ['QTY', 131], ['RATE', 158], ['LOCATION', 194], ['DESCRIPTION', 288], ...S, ['HOURS', 758]].map(([s, x]) => ({ s: s as string, x: x as number, y: 91 }))
const line = (y: number, n: string, code: string, qty: string, rate: string, loc: string, desc: string, stream: string, cost: string, hrs: string): Tok[] => [
  { s: desc, x: 234, y: y - 4 }, { s: n, x: 81, y }, { s: rate, x: 152, y }, { s: loc, x: 195, y }, { s: hrs, x: 762, y },
  { s: code, x: 95, y: y + 3 }, { s: qty, x: 133, y: y + 3 },
  ...S.flatMap(([name, x]) => [{ s: '£', x: x - 4, y: y + 3 }, { s: name === stream ? cost : '-', x: name === stream ? x + 11 : x + 22, y: y + 3 }]),
]
const p1: Tok[] = [
  ...S.map(([name, x]) => ({ s: name === 'PPR PAINT' ? '708.98' : name === 'KITCHEN' ? '2,613.65' : name === 'SCAFFOLD' ? '350.00' : '115.23', x: x + 7, y: 60 })),
  { s: 'SITE', x: 78, y: 75 }, { s: 'PRESCELLY ROAD', x: 95, y: 75 }, ...header,
  ...line(103, '1', '4360BD', '71', '8.55', 'PROPERTY', 'WASHDOWN AND APPLY 1 COAT OF MASONRY PAINT', 'PPR PAINT', '607.05', '0.00'),
  ...line(118, '1', '4350AA', '27', '3.7753', 'ALL ELVS', 'GUTTER:CLEAN OUT PRIOR TO DECORATION', 'PPR PAINT', '101.93', '2.16'),
  ...line(133, '1', '2402AA', '1', '350', 'FRONT ELEVATION', 'SCAFFOLD TOWER:PROVIDE NE 5M HIGH STEEL', 'SCAFFOLD', '350.00', '0.00'),
]
const p2: Tok[] = [
  ...line(40, '2', '3745ZB', '1', '2613.65', 'KITCHEN', 'KITCHEN:UPGRADE TO STANDARD 3P OR 4P/2 BED', 'KITCHEN', '2,613.65', '44.00'),
  ...line(55, '13', '0030AB', '1', '115.2295', 'SIDE ELEVATION', 'PATH:RENEW NE 100MM CONCRETE BED AND SUBBASE', 'PPR REPAIRS', '115.23', '2.08'),
]
const r = readPdfSchedule([{ items: p1 }, { items: p2 }])!
ok(!!r && r.lines.length === 5, `5 lines across two pages (header only on page 1) — got ${r?.lines.length}`)
ok(r.ref === 'PRESCELLY ROAD', 'site name')
ok(r.lines.map(l => l.property).join(',') === '1,1,1,2,13', 'house number from NUMBER — never from LOCATION')
ok(r.lines[0].room === 'Property' && r.lines[1].room === 'All elevations' && r.lines[2].room === 'Front elevation', 'locations kept separate and tidied')
ok(r.lines[1].qty === 27 && r.lines[1].rate === 3.7753 && r.lines[1].cost === 101.93, 'qty, 4-dp rate and cost from the right columns')
ok(r.lines[3].cost === 2613.65 && r.lines[3].workstream === 'Kitchen' && r.lines[3].hours === 44, 'thousands separator, workstream from the £ column, hours')
ok(r.lines[0].description.startsWith('Washdown and apply'), 'description joined and readable')
ok(r.columnCheck.every(c => Math.abs(c.sheet - c.read) < 0.005), 'every column adds up to the sheet totals')
ok(readPdfSchedule([{ items: [{ s: 'Dear Sir', x: 50, y: 50 }] }]) === null, 'not a schedule → null (AI takes over)')

// The real Prescelly Road sheet, when it's available on this machine
const REAL = '/mnt/user-data/uploads/Full_Spec_Sheet.pdf'
;(async () => {
  if (existsSync(REAL)) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const real = readPdfSchedule(await pdfPages(new Uint8Array(readFileSync(REAL)), pdfjs as never))!
    ok(real.lines.length === 112 && [...new Set(real.lines.map(l => l.property))].join(',') === '1,2,4,5,11,13', 'REAL Prescelly PDF: 112 lines, properties 1, 2, 4, 5, 11, 13')
    ok(real.lines.every(l => !l.issues.length) && real.columnCheck.every(c => Math.abs(c.sheet - c.read) <= 0.05), 'REAL Prescelly PDF: no flags, all 9 column totals match the sheet')
  }
  const CAP = '/mnt/user-data/uploads/CAP00290-_32_College_Park__Nayland-_Internal_Improvements.pdf'
  if (existsSync(CAP)) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    ok(readPdfSchedule(await pdfPages(new Uint8Array(readFileSync(CAP)), pdfjs as never)) === null, 'REAL College Park (room-heading layout): steps aside for the AI instead of half-reading')
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
