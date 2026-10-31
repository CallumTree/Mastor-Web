/** Trade cores: a trade's colour is the same on every job, and any other workstream keeps a stable one. */
import { CORES, tradeCore } from '../src/lib/trade'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

ok(tradeCore('Kitchen') === 'clay' && tradeCore('Bathroom') === 'teal' && tradeCore('Wet room') === 'teal' && tradeCore('Electrical') === 'bronze', 'kitchens clay, bathrooms and wet rooms teal, electrics bronze')
ok(tradeCore('Roofing') === 'slate' && tradeCore('PPR Paint') === 'rose' && tradeCore('Decarb') === 'olive' && tradeCore('Windows & doors') === 'violet' && tradeCore('Scaffold') === 'graphite', 'roofing slate, paint rose, decarb olive, windows violet, scaffold graphite')
const f = tradeCore('Fencing')
ok(CORES.includes(f) && f !== 'graphite' && tradeCore('fencing') === f, 'any other trade: a stable core, never graphite (kept for prelims)')

console.log(`\ntrade: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
