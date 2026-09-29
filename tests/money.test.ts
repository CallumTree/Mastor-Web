import { lineValue, pennies } from '../src/lib/valuation'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
ok(lineValue(0.5, 15.03) === 7.52, '0.5 × 15.03 = 7.515 → £7.52 (half up, like the council)')
ok(lineValue(95.25, 25.47) === 2426.02, '95.25 × 25.47 → £2,426.02')
ok(lineValue(73.3, 10.46) === 766.72, '73.3 × 10.46 → £766.72')
ok(pennies(-7.515) === -7.52, 'negative half-penny rounds away from zero')
// the full CAP00290 BoQ, line by line
const lines: [number, number][] = [[1,2437.35],[1,328.47],[10,51.29],[1,161.56],[5,17.04],[1,53.16],[5,20.86],[1,47],[1,10.98],[1,130.96],[2,28.83],[1,51.89],[1,2505.61],[4.32,23.66],[1,21.11],[12,14.27],[5,13.44],[2,10.14],[2.9,60.86],[11.4,23.6],[2,43.74],[1,21.47],[1,211.9],[1,2119.73],[11,87.84],[1,158.38],[28.6,22.55],[8,86.87],[8,113.04],[20.41,47],[73.3,10.46],[8.41,6.78],[1,738.6],[1,304.3],[1,127.31],[1,61.19],[51,6.7],[51,16.91],[73.3,45.43],[51,15.85],[153,16.54],[51,12.58],[95.25,25.47],[5,37.84],[12,5.8],[1,81.96],[21,25.92],[52,13],[51,29.09],[52,15.03],[132,6.78],[52,12.58],[52,12.58],[52,20.47],[2.8,35.56],[2.8,89.14],[0.5,15.03],[3.3,25.47]]
const total = pennies(lines.reduce((t, [q, r]) => t + lineValue(q, r), 0))
ok(lines.length === 58, '58 lines')
ok(total === 34613.81, `CAP00290 totals exactly £34,613.81 (got ${total})`)
// Pembrokeshire PO PC26061: nett × 1.2028 × 1.05, rounded once — every line must match the PO exactly
import { upliftAmounts } from '../src/lib/valuation'
for (const [area, nett, po] of [['Internal Improvement', 22940.60, 28972.60], ['Kitchen', 2505.61, 3164.44], ['Bathroom', 3981.43, 5028.31], ['Estate Improvement', 2370.92, 2994.33]] as const) {
  const u = upliftAmounts(nett, 20.28, 5)
  ok(u.gross === po && pennies(nett + u.u1 + u.u2) === po, `PO line ${area}: £${nett} → £${u.gross} (PO says £${po})`)
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
