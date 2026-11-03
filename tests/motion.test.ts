/** Motion helpers: how a figure rolls from one value to the next. */
import { rollParts, reducedMotion, ROLL_MS, ROLL_STEP } from '../src/lib/motion'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

let r = rollParts('£8,087.19', '£9,371.79')
ok(r.slots.map(s => s.to).join('') === '£9,371.79' && r.slots.map(s => s.from).join('') === '£8,087.19', 'every character kept, lined up as written')
ok(r.slots.filter(s => s.delay >= 0).map(s => s.from + s.to).join(' ') === '89 03 87 71 17', 'only the characters that changed roll')
ok(r.slots[0].delay === -1 && r.slots[2].delay === -1 && r.slots[6].delay === -1 && r.slots[8].delay === -1, 'the £, the comma, the point and the unchanged last penny stay put')
const moving = r.slots.filter(s => s.delay >= 0)
ok(moving.every((s, i, a) => i === 0 || s.delay < a[i - 1].delay), 'the rightmost changed character goes first, then leftwards')
ok(!r.down && r.ms === ROLL_MS + (moving.length - 1) * ROLL_STEP, 'a rise rolls up; the whole roll takes one roll plus a step per extra character')

r = rollParts('£12,473.66', '£0.00')
ok(r.down, 'a fall rolls down')
ok(r.slots.length === 10 && r.slots.slice(0, 5).every(s => s.to === '') && r.slots.map(s => s.to).join('') === '£0.00', 'a shorter figure lines up from the right; the spare places shrink away')

r = rollParts('3', '3')
ok(r.slots.every(s => s.delay === -1), 'nothing changed: nothing moves')
ok(reducedMotion() === true, 'no browser to ask (tests, old phones): movement left out')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
