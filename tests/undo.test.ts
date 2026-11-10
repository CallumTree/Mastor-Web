// Act, then Undo: one offer at a time; Undo puts it back and what was held back never happens; left alone, it happens.
import { offerUndo, takeUndo, settle, currentUndo } from '../src/lib/undo'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const log: string[] = []

offerUndo('Photo deleted', () => { log.push('back') }, () => { log.push('file gone') }, 40)
ok(currentUndo()?.text === 'Photo deleted', 'the offer says what just happened')
await takeUndo()
await wait(60)
ok(log.join() === 'back' && !currentUndo(), 'Undo: put back, and the held-back part (the file’s removal) never runs')

log.length = 0
offerUndo('Photo deleted', () => { log.push('back') }, () => { log.push('file gone') }, 30)
await wait(60)
ok(log.join() === 'file gone' && !currentUndo(), 'left alone: the offer closes and the held-back part runs')
await takeUndo()
ok(log.join() === 'file gone', 'Undo after it has closed does nothing')

log.length = 0
offerUndo('3 lines ticked', () => { log.push('unticked') }, () => { log.push('first settled') }, 500)
offerUndo('Line deleted', () => { log.push('line back') }, undefined, 500)
await wait(5)
ok(log.join() === 'first settled' && currentUndo()?.text === 'Line deleted', 'a new action closes the offer before it: one at a time')
settle()
ok(!currentUndo(), 'going to the background closes it too')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
