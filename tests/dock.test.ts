// The dock's outline: flat, with a scoop that follows each disc's circle, closing flat when its depth goes to nothing.
import { edgeY, dockPath, captureSlot } from '../src/components/Dock'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const cap = { x: 195, depth: 29, r: 35 }, tab = { x: 300, depth: 23, r: 27 }
ok(Math.abs(edgeY(195, [cap]) - 29) < 0.01, 'the + key’s scoop is 29px deep at its centre')
ok(edgeY(20, [cap, tab]) === 0 && edgeY(380, [cap, tab]) === 0, 'flat away from the scoops')
ok(Math.abs(edgeY(170, [cap]) - edgeY(220, [cap])) < 0.01, 'each scoop is even both sides')
ok(edgeY(195, [{ ...cap, depth: 0 }]) === 0, 'depth 0 (the page scrolling, or Clerk open): the scoop closes flat')
let worst = 0
for (let x = 0; x < 390; x += 1) worst = Math.max(worst, Math.abs(edgeY(x + 1, [cap, { ...tab, x: 262 }]) - edgeY(x, [cap, { ...tab, x: 262 }])))
ok(worst < 6, `side by side, the two scoops run into one edge with no jump (largest step ${worst.toFixed(1)}px)`)
const d = dockPath(380, 64, [cap, tab])
ok(d.startsWith('M0,0') && d.endsWith('L380,64 L0,64 Z'), 'the outline closes down the sides and along the foot')
ok(captureSlot(4) === 2 && captureSlot(3) === 2, 'four tabs: the + key in the middle column of five')
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
