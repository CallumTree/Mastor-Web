import * as XLSX from 'xlsx'
import { readSchedule } from '../src/lib/sheet'
import { tidyLocation } from '../src/lib/boq'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// Laid out like the Prescelly Road "Full Spec Sheet": title, totals row, header, '£ -' blanks, workstream £ columns
const H = ['NUMBER', 'CODE', 'QTY', 'RATE', 'LOCATION', 'DESCRIPTION', 'PPR', 'PAINT', 'EST IMP', 'KITCHEN', 'BATHROOM', 'ROOFING', 'SCAFFOLD', 'WHQS', 'WINDOWS', 'DECARB', 'COMP DOORS', 'HOURS']
const blank = '£ -'
const row = (n: number, code: string, qty: number, rate: number, loc: string, desc: string, stream: string, cost: number, hrs: number) =>
  [n, code, qty, rate, loc, desc, ...H.slice(6, 17).map(s => (s === stream ? `£ ${cost.toFixed(2)}` : blank)), hrs]
const rows = [
  ['', '', '', '', '', 'Total', '£ 5,775.35', '£ 9,250.83', '£ 1,740.77'],
  ['SITE', 'PRESCELLY ROAD'],
  H,
  row(1, '4360BD', 71, 8.55, 'PROPERTY', 'WASHDOWN AND APPLY 1 COAT OF MASONRY PAINT TO RENDER', 'PAINT', 607.05, 0),
  row(1, '4350AA', 27, 3.7753, 'ALL ELVS', 'GUTTER:CLEAN OUT PRIOR TO DECORATION', 'PAINT', 101.93, 2.16),
  row(1, '2402AA', 1, 350, 'FRONT ELEVATION', 'SCAFFOLD TOWER:PROVIDE NE 5M HIGH STEEL', 'SCAFFOLD', 350, 0),
  row(1, '3745ZB', 1, 2613.65, 'KITCHEN', 'KITCHEN:UPGRADE TO STANDARD 3P OR 4P/2 BED', 'KITCHEN', 2613.65, 44),
  row(2, '9801WR', 1, 3622.36, 'BATHROOM', 'Wetroom Complete EXCLUDING MATERIALS', 'BATHROOM', 3622.36, 40),
  row(13, '0030AB', 7, 115.2295, 'Rear Elv', 'PATH:RENEW NE 100MM CONCRETE BED AND SUBBASE', 'PPR', 806.61, 14.56),
  row(11, 'RE191561', 1, 304.3, 'HALL', 'Gateway Ei1000G', 'DECARB', 304.3, 0.5),
]
// round-trip through a real .xlsx, like an upload
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Spec')
const back = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' })
const parsed = readSchedule(XLSX.utils.sheet_to_json(back.Sheets['Spec'], { header: 1, blankrows: false, defval: null }))!
ok(!!parsed && parsed.lines.length === 7, `finds the header under the title/totals rows; 7 lines (got ${parsed?.lines.length})`)
ok(parsed.ref === 'PRESCELLY ROAD', 'picks up the site name')
ok(parsed.lines.map(l => l.property).join(',') === '1,1,1,1,2,13,11', 'property from the NUMBER column, never from LOCATION')
ok(parsed.lines[0].room === 'Property' && parsed.lines[1].room === 'All elevations' && parsed.lines[5].room === 'Rear elevation', 'locations tidied: PROPERTY / ALL ELVS / Rear Elv')
ok(parsed.lines[0].workstream === 'Paint' && parsed.lines[2].workstream === 'Scaffold' && parsed.lines[6].workstream === 'Decarb', 'workstream = the £ column the cost sits in')
ok(parsed.lines[1].rate === 3.7753 && parsed.lines[1].cost === 101.93 && parsed.lines[1].issues.length === 0, 'unrounded SoR rates kept; 27 × 3.7753 = £101.93 checks out')
ok(parsed.lines[3].hours === 44 && parsed.lines[0].hours === 0, 'hours read')
ok(parsed.lines[0].description.startsWith('Washdown and apply'), 'SHOUTY descriptions made readable')
ok(readSchedule([['Some', 'random'], ['sheet', 'nothing']]) === null, 'unrecognised layout → null (falls back to the AI reader)')
ok(tidyLocation('F/Elev') === 'Front elevation' && tidyLocation('ALL ELEVATIONS') === 'All elevations' && tidyLocation('Bed2') === 'Bedroom 2', 'F/Elev, ALL ELEVATIONS, Bed2')
const wrapped = readSchedule([H, row(1, '4360BD', 71, 8.55, 'PROPERTY', 'WASHDOWN AND APPLY 1 COAT OF MASONRY PAINT', 'PAINT', 607.05, 0), [null, null, null, null, null, 'TO RENDER'], row(2, '4350AA', 27, 3.7753, 'PROPERTY', 'GUTTER:CLEAN OUT', 'PAINT', 101.93, 2.16)])!
ok(wrapped.lines.length === 2 && wrapped.lines[0].description.endsWith('masonry paint to render'), 'a wrapped description row joins the line above (PDF→Excel conversions)')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
