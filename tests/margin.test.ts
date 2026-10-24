import { byTrade, jobMargin, labourDays } from '../src/lib/margin'
import type { Cost, DiaryEntry, Job, ScopeItem, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const job = { id: 'j', uplift1: 10, uplift2: 0 } as Job
const line = (id: string, qty: number | null, rate: number | null, workstream = ''): ScopeItem => ({ id, jobId: 'j', code: id, description: id, room: '', qty, unit: 'NO', rate, valuationId: null, order: 1, workstream, createdAt: 0 })
const scope = [line('a', 10, 100, 'Roofing'), line('b', 1, 1000, 'Scaffold'), line('c', null, 50, 'Roofing')]
const vos = [{ id: 'v', jobId: 'j', qty: 2, rate: 50, status: 'Instructed' }, { id: 'r', jobId: 'j', qty: 1, rate: 999, status: 'Rejected' }] as Variation[]
const cost = (id: string, status: Cost['status'], amount: number | null, trade = '', who = id): Cost => ({ id, jobId: 'j', kind: 'subbie', status, who, trade, description: '', amount, date: 1, createdAt: 1 })
const costs = [cost('q1', 'quote', 800, 'Scaffold', 'Haven'), cost('q2', 'quote', 650, 'Scaffold', 'Cleddau'), cost('c1', 'committed', 500, 'Roofing'), cost('p1', 'paid', 200), cost('u1', 'committed', null)]
const day = (labour: number): DiaryEntry => ({ id: String(labour), jobId: 'j', date: '2026-10-0' + labour, type: 'day', note: '', labour, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: 0 })

console.log('Job margin')
let m = jobMargin(job, scope, vos, costs, [])
ok(m.base === 2100 && m.value === 2310, `value = (1000 + 1000 + VO 100) × 1.10 = £2,310, rejected VO left out (${m.value})`)
ok(m.unpriced === 1, 'the line without a qty is counted as unpriced, not valued')
ok(m.committed === 500 && m.paid === 200 && m.costs === 700, 'agreed + paid counted; quotes not')
ok(m.quotes === 2 && m.unknownCosts === 1, 'quotes and costs without an amount are counted, not guessed')
ok(m.margin === 1610 && m.pct === 69.7, `margin £1,610 = 69.7% (${m.pct})`)
const diary = [day(2), day(3)]
ok(labourDays(diary) === 5, 'operative-days from the diary')
ok(jobMargin(job, scope, vos, costs, diary).labourEstimate === null, 'no day rate: no labour estimate')
m = jobMargin(job, scope, vos, costs, diary, 180)
ok(m.labourEstimate === 900 && m.costs === 1600 && m.margin === 710, 'with a £180 day rate: 5 days = £900 estimate, included')

ok(m.provisional.includes('1 unpriced'), 'unpriced lines make the margin provisional')
ok(jobMargin(job, scope, vos, costs, diary).provisional.includes('diary labour not costed'), 'diary labour without a day rate makes it provisional')
ok(jobMargin({ ...job, contractValue: 9999 } as Job, scope, vos, costs, diary, 180).provisional.includes('BoQ ≠ PO'), 'a BoQ that doesn’t reconcile with the PO makes it provisional')
ok(jobMargin({ ...job, contractValue: 9999, poGapAccepted: { diff: 1, note: 'x', at: 1 } } as Job, [line('a', 10, 100)], [], costs, [], 180).provisional.length === 0, 'settled: no unknowns, PO difference accepted')

console.log('By trade (subbie comparison)')
const t = byTrade(job, scope, costs)
const scaff = t.find(x => x.trade === 'Scaffold')!
ok(scaff.base === 1000 && scaff.value === 1100, 'client pays £1,000 base, £1,100 with uplifts')
ok(scaff.quotes[0].cost.who === 'Cleddau' && scaff.quotes[0].marginValue === 450 && scaff.quotes[0].marginBase === 350, 'cheapest quote first: £450 margin with uplifts, £350 on base')
const roof = t.find(x => x.trade === 'Roofing')!
ok(roof.accepted === 500 && roof.unpriced === 1, 'roofing: £500 agreed, one unpriced line flagged')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
