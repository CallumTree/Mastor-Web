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
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
