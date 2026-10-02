import { parseBoqTsv } from '../src/lib/boq'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const sample = [
  'REF\tCAP00290',
  '4310AB\tKitchen\tRenew base unit 600mm\t2\tnr\t145.20\t',
  '4311\tKitchen\tRenew worktop\t3.5\tm\t£1,020.00\t',
  '\tBathroom\tMake good plaster\t\tm2\t\ttotal only: 240.00',
  '5500\tGeneral\tSubtotal\t\t\t\t',
  '6100\t\tSkim ceiling\t12\tm2\t9.80\t',
].join('\n')
const r = parseBoqTsv(sample)
ok(r.ref === 'CAP00290', 'reads the works order reference')
ok(r.lines.length === 4, `keeps 4 items, drops the subtotal (got ${r.lines.length})`)
ok(r.lines[0].qty === 2 && r.lines[0].rate === 145.2, 'numbers read exactly')
ok(r.lines[1].rate === 1020, 'strips £ and commas')
ok(r.lines[2].rate === null && r.lines[2].qty === null, 'missing values stay missing — never filled in')
ok(r.lines[2].issues.includes('no rate') && r.lines[2].issues.some(i => i.startsWith('total only')), 'flags why it needs checking')
ok(r.lines[3].room === 'General', 'no room → General')
ok(parseBoqTsv('```\nREF\tX\nA\tK\tThing\t1\tnr\t2\t\n```').lines.length === 1, 'tolerates code fences')
const r8 = parseBoqTsv(['REF\tX', '4210AA\tLiving Room\tHack off plaster — Hack off 0.5m2 to head of doorway\t.5\tSM\t15.03\t7.52\t', '9999\tK\tOdd one\t3\tnr\t10.00\t31.00\t'].join('\n'))
ok(r8.lines[0].qty === 0.5 && r8.lines[0].cost === 7.52 && r8.lines[0].issues.length === 0, 'reads ".5", printed cost matches penny-rounded qty × rate — no flag')
ok(r8.lines[0].description.includes('— Hack off 0.5m2'), 'comment kept on the description')
ok(r8.lines[1].issues.some(i => i.includes('document cost £31.00')), 'flags when the document cost disagrees with qty × rate')
const md = parseBoqTsv('| CODE | ROOM | DESCRIPTION | QTY | UNIT | RATE | COST | NOTE |\n|---|---|---|---|---|---|---|---|\n| 4310AB | Bathroom | Wall tiles | 10 | SM | 51.29 | 512.90 | |')
ok(md.lines.length === 1 && md.lines[0].rate === 51.29 && md.lines[0].cost === 512.9, 'also reads a markdown table reply (header + separator skipped)')
const multi = parseBoqTsv(['REF\tPRESCELLY ROAD',
  '4360BD\tPROPERTY\tWashdown and 1 coat masonry paint\t71\tSM\t8.55\t607.05\t1\tPPR Paint\t0.00\t',
  '3745ZB\tKITCHEN\tKitchen upgrade 3P/4P 2 bed\t1\tIT\t2613.65\t2613.65\tNo. 13\tKitchen\t44\t',
  '2402AA\tFRONT ELEVATION\tScaffold tower ne 5m\t1\tIT\t350\t350.00\t4\tScaffold\t\t'].join('\n'))
ok(multi.lines.length === 3 && multi.lines[0].property === '1' && multi.lines[0].workstream === 'PPR Paint', 'reads property + workstream')
ok(multi.lines[1].property === '13' && multi.lines[1].hours === 44, '"No. 13" → 13, hours read')
ok(multi.lines[2].hours === null && multi.lines[2].issues.length === 0, 'blank hours stays blank; cost check still works')
const nine = parseBoqTsv('4360BD\tPROPERTY\tPaint\t71\tSM\t8.55\t607.05\t4\tPPR Paint')
ok(nine.lines[0].property === '4' && nine.lines[0].workstream === 'PPR Paint', 'line missing hours + note still keeps its property number')
const word = parseBoqTsv('4360BD\tPROPERTY\tPaint\t71\tSM\t8.55\t607.05\tPROPERTY\tPPR Paint\t0\t')
ok(word.lines[0].property === '', 'the word PROPERTY is never taken as a property number')
// --- labelled JSON lines (current AI reader): Prescelly has no unit column
const js = parseBoqTsv([
  '{"ref": "PRESCELLY ROAD"}',
  '{"code": "0171BD", "location": "SIDE ELEVATION", "description": "Fencing: renew 1.8m close board timber post", "qty": 13, "unit": "", "rate": 133.9055, "cost": 1740.77, "property": "5", "workstream": "Est Imp", "hours": 21.71, "note": ""}',
  '{"code": "4600FB", "location": "REAR ELEVATION", "description": "Garden: clear exceptional debris", "qty": 4, "unit": "", "rate": 204.2933, "cost": 817.17, "property": "2", "workstream": "PPR Repairs", "hours": 14, "note": ""}',
  '```',
].join('\n'))
ok(js.ref === 'PRESCELLY ROAD' && js.lines.length === 2, 'reads labelled JSON lines (ignores code fences)')
ok(js.lines[0].qty === 13 && js.lines[0].rate === 133.9055 && js.lines[0].cost === 1740.77 && js.lines[0].issues.length === 0, 'fencing: 13 × £133.9055 = £1,740.77 — no false £22,630')
ok(js.lines[0].property === '5' && js.lines[1].property === '2' && js.lines[0].room === 'Side elevation', 'property numbers kept; location separate')
// --- the exact shift from the screenshots: rate landed in "unit", cost landed in "rate"
const shifted = parseBoqTsv([
  '{"code": "0171BD", "location": "SIDE ELEVATION", "description": "Fencing", "qty": 13, "unit": "133.9055", "rate": 1740.77, "cost": null, "property": "5", "workstream": "", "hours": null, "note": ""}',
  '0390CE\tFRONT ELEVATION\tDrain channels: clear\t10\t8.8709\t88.71\t\t2\tPPR Repairs\t3.3\t',
].join('\n'))
ok(shifted.lines[0].rate === 133.9055 && shifted.lines[0].cost === 1740.77 && shifted.lines[0].unit === '', 'repairs a shifted line: rate back from "unit", £1,740.77 back to cost')
ok(shifted.lines[1].rate === 8.8709 && shifted.lines[1].cost === 88.71 && shifted.lines[1].qty === 10, 'drain channels: 10 × £8.8709 = £88.71 (was showing £887.10)')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
