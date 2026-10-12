import { checkRates, bestBook, patternText } from '../src/lib/ratecheck'
import type { RateItem, RateBook } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const book: RateBook = { id: 'p', name: 'Planned v8', source: '', notes: [], lines: 0, importedAt: 0 }
const sor = (code: string, rate: number, unit = 'SM'): RateItem => ({ bookId: 'p', code, short: code, long: '', unit, rate, section: '', subsection: '' })
const items = Array.from({ length: 10 }, (_, i) => sor(`10${i}0AA`, 100 + i * 10)).concat([sor('2000AA', 50, 'LM'), sor('3000AA', 20)])
const L = (code: string, rate: number | null, qty: number | null = 2, unit = 'SM') => ({ id: code, code, description: code, qty, unit, rate })

console.log('A BoQ priced at a framework adjustment')
const tendered = items.slice(0, 10).map((s, i) => L(s.code, i === 9 ? 150 : Math.round(s.rate * 0.87 * 10000) / 10000))
tendered.push(L('2000AA', 43.5, 3, 'IT'), L('9999ZZ', 10), L('3000AA', null))
let r = checkRates(tendered, book, items)
ok(!!r.pattern && Math.abs(r.pattern.ratio - 0.87) < 0.0005 && r.pattern.lines === 9, `pattern found: ${patternText(r.pattern)} on 9 lines`)
ok(patternText(r.pattern) === 'SoR −13.0%', 'pattern said plainly')
ok(r.counts.pattern === 9 && r.counts.off === 1, 'one line breaks the pattern')
const off = r.rows.find(x => x.status === 'off')!
ok(off.line.code === '1090AA' && off.expected === 165.3 && off.diff === -30.6, `…priced £150 against £165.30 expected: £30.60 below on qty 2 (${off.diff})`)
ok(r.below === 30.6 && r.above === 0, 'money below the pattern totalled')
ok(r.counts.unit === 1 && r.counts.missing === 1 && r.counts.norate === 1, 'unit mismatch, missing code and missing rate reported separately, never priced')

console.log('A BoQ at the SoR exactly')
r = checkRates(items.slice(0, 5).map(s => L(s.code, s.rate)), book, items)
ok(r.pattern?.ratio === 1 && r.counts.match === 5 && patternText(r.pattern) === 'the SoR rates exactly', 'all match')
r = checkRates([L('1000AA', 100.0036)], book, items)
ok(r.rows[0].status === 'match', '4-decimal BoQ rate within half a penny counts as a match')

r = checkRates([L('1000AA', 100)], book, items)
ok(r.pattern?.ratio === 1 && r.counts.match === 1, 'a single exact match is still "the SoR exactly"')

console.log('A BoQ with no single adjustment (older SoR / tendered line by line)')
r = checkRates(items.slice(0, 6).map((s, i) => L(s.code, s.rate * (0.6 + i * 0.07))), book, items)
ok(r.pattern === null && r.counts.differs === 6, 'no pattern: lines just "differ"')
ok(r.below === 0 && r.above === 0, '…and nothing is called under- or over-priced')
ok(r.boqTotal > 0 && r.sorTotal > r.boqTotal, 'totals at BoQ rates and at SoR rates given for comparison')

console.log('Choosing the book')
const other: RateBook = { ...book, id: 'r', name: 'Responsive' }
ok(bestBook([L('1000AA', 1), L('1010AA', 1)], [other, book], items)?.id === 'p', 'the book holding most of the codes')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
