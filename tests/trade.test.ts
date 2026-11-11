/** Trade cores: a trade's colour is the same on every job, and any other workstream keeps a stable one. */
import { CORES, jobCores, tradeCore } from '../src/lib/trade'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

ok(tradeCore('Kitchen') === 'clay' && tradeCore('Bathroom') === 'teal' && tradeCore('Wet room') === 'teal' && tradeCore('Electrical') === 'bronze', 'kitchens clay, bathrooms and wet rooms teal, electrics bronze')
ok(tradeCore('Roofing') === 'slate' && tradeCore('PPR Paint') === 'rose' && tradeCore('Decarb') === 'olive' && tradeCore('Windows & doors') === 'moss' && tradeCore('Scaffold') === 'graphite', 'roofing slate, paint rose, decarb olive, windows moss, scaffold graphite')
const f = tradeCore('Fencing')
ok(CORES.includes(f) && f !== 'graphite' && tradeCore('fencing') === f, 'any other trade: a stable core, never graphite (kept for prelims)')

const jc = jobCores(['Kitchen', 'PPR Repairs', 'WHQS', 'Roofing', 'Kitchen', 'Fencing'])
ok(jc.get('Kitchen') === 'clay' && jc.get('Roofing') === 'slate', 'in a job, named trades keep their own core')
ok(new Set(jc.values()).size === jc.size && ![...jc.values()].includes('graphite'), 'in a job, no two trades share a core (and none takes graphite)')
ok(jc.get('PPR Repairs') === 'bronze' && jobCores(['Kitchen', 'PPR Repairs']).get('PPR Repairs') === 'bronze', 'an unnamed trade takes the first core free in its job, the same each time')
const many = jobCores(['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9'])
ok(many.size === 9 && [...many.values()].every(c => CORES.includes(c)), 'more trades than cores: the extra ones share, nothing breaks')

console.log(`\ntrade: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
