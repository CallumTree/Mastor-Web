/**
 * The valuation rhythm and the client's review: valuations go in the first week of each month, a thin first
 * month waits for the next, "wait till next month" moves it on; a sent valuation is with the client for
 * review, changes open it to amend, agreed means the invoice is next, and only then do payment terms run.
 */
import { valRhythm, waitAMonth, firstOnOrAfter } from '../src/lib/rhythm'
import { valCourt, dueAt } from '../src/lib/chase'
import { jobAlerts } from '../src/lib/alerts'
import { portfolio } from '../src/lib/portfolio'
import { amending, askChanges, claimTarget, lockedIn, markAgreed, reviewStage } from '../src/lib/valuation'
import type { DiaryEntry, Job, ScopeItem, Valuation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const DAY = 86_400_000
const at = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime() }
const job = (p: Partial<Job> = {}): Job => ({ id: 'j', name: 'No. 18', client: 'PCC', address: '', contractRef: '', poNumber: 'P1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: at('2026-10-27'), ...p })
const sent = (k: string, p: Partial<Valuation> = {}): Valuation => ({ id: 'v1', jobId: 'j', number: 1, status: 'Issued', createdAt: at(k) - DAY, issuedAt: at(k), review: { sentAt: at(k), rounds: 1 }, ...p })
const site = (date: string): DiaryEntry => ({ id: 'd' + date, jobId: 'j', date, type: 'day', note: '', labour: 3, weather: 'Dry', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: 1 })

ok(firstOnOrAfter('2026-11-01') === '2026-11-01' && firstOnOrAfter('2026-11-10') === '2026-12-01' && firstOnOrAfter('2026-12-15') === '2027-01-01', 'the 1st on or after a day, across the year end')

// --- the user's example: started on the 27th, the 1st is only days later → it waits for the next month
let r = valRhythm(job(), [], { today: '2026-11-01' })!
ok(r.from === '2026-12-01' && r.until === '2026-12-07' && r.state === 'later' && r.next === 1, 'started 27 Oct → first valuation 1–7 Dec, not 1 Nov')
r = valRhythm(job({ createdAt: at('2026-10-10') }), [], { today: '2026-11-01' })!
ok(r.from === '2026-11-01' && r.state === 'due', 'started 10 Oct (three weeks in) → due this week')
r = valRhythm(job({ createdAt: at('2026-11-05') }), [], { today: '2026-11-05', diary: [site('2026-10-12')] })!
ok(r.since === '2026-10-12' && r.from === '2026-11-01', 'a site day before the job was added counts as the start')

// --- after one is sent
const v3oct = sent('2026-10-03')
ok(valRhythm(job(), [v3oct], { today: '2026-10-29' })!.state === 'soon', 'sent 3 Oct → 29 Oct is "soon" (three days before)')
r = valRhythm(job(), [v3oct], { today: '2026-11-03' })!
ok(r.from === '2026-11-01' && r.state === 'due' && r.next === 2 && r.last === v3oct, 'sent 3 Oct → VAL II due 1–7 Nov')
ok(valRhythm(job(), [v3oct], { today: '2026-11-08' })!.state === 'late', 'not sent by the 7th → late')
ok(valRhythm(job(), [sent('2026-10-28')], { today: '2026-11-02' })!.from === '2026-12-01', 'sent 28 Oct → next is December, not days later')
ok(valRhythm(job({ status: 'Complete' }), [v3oct], { today: '2026-11-03' }) === null, 'a finished job has no monthly valuation')
ok(valRhythm(job(), [v3oct, { id: 'v2', jobId: 'j', number: 2, status: 'Open', createdAt: at('2026-10-20'), issuedAt: null }], { today: '2026-11-03' })!.next === 2, 'the open one is the next')

// --- wait till next month
r = valRhythm(job(), [v3oct], { today: '2026-11-03' })!
const waited = waitAMonth(job(), r, at('2026-11-03'))
ok(waited.valWait?.until === '2026-12-01', 'wait → moves to 1 Dec')
r = valRhythm(waited, [v3oct], { today: '2026-11-03' })!
ok(r.from === '2026-12-01' && r.waited && r.state === 'later', 'waited: no longer due this week')
ok(!valRhythm(waited, [sent('2026-11-20')], { today: '2026-11-21' })!.waited, 'a valuation sent after the wait clears it')

// --- the client's review
const scope: ScopeItem[] = [{ id: 's', jobId: 'j', code: '', description: 'Kitchen', room: '', qty: 1, unit: 'nr', rate: 1000, valuationId: 'v1', order: 1, createdAt: 0 }]
const now = at('2026-11-06')
let c = valCourt(sent('2026-11-03'), job(), scope, [], now)
ok(c.who === 'client' && c.text === 'For review · 3 days' && c.tone === 'ok' && c.review === true && c.owed === 1000, 'sent 3 days ago → with the client for review')
ok(valCourt(sent('2026-10-29'), job(), scope, [], now).tone === 'due', 'a week with the client → chase')
c = valCourt(sent('2026-10-20'), job(), scope, [], now)
ok(c.tone === 'late' && c.review === true, 'two weeks → late, but a review')
ok(dueAt(sent('2026-10-01'), job()) === null, 'no payment clock while it is being reviewed')
ok(portfolio([job()], scope, [], [sent('2026-10-01')], new Date(now)).overdueCount === 0, 'a long review is not money overdue')

const changed = askChanges(sent('2026-11-03'), ' No. 18 kitchen not finished ', at('2026-11-05'))
ok(amending(changed) && reviewStage(changed) === 'changes' && changed.review?.changes === 'No. 18 kitchen not finished', 'changes asked → open to amend, with what they asked')
ok(lockedIn(scope[0], [changed]) === null && claimTarget([changed]) === changed, 'its lines can come out, and ticks go into it')
ok(valCourt(changed, job(), scope, [], now).text.startsWith('Changes asked') && valCourt(changed, job(), scope, [], now).who === 'us', 'the ball is with us')
ok(lockedIn(scope[0], [sent('2026-11-03')]) !== null, 'a sent one under review stays locked')

const agreed = markAgreed(sent('2026-11-03'), at('2026-11-05'))
c = valCourt(agreed, job(), scope, [], now)
ok(reviewStage(agreed) === 'agreed' && c.who === 'us' && /^Agreed .* · create the invoice$/.test(c.text), 'agreed → create the invoice')
ok(!amending(markAgreed(changed)), 'agreeing after changes closes the amend')
const invoiced = { ...agreed, invoiceNumber: 'TS-1', invoiceDate: at('2026-11-06') }
ok(dueAt(invoiced, job()) === at('2026-11-06') + 30 * DAY && valCourt(invoiced, job(), scope, [], now).text.startsWith('Due'), 'invoiced → terms run from the invoice date')
const legacy: Valuation = { id: 'v1', jobId: 'j', number: 1, status: 'Issued', createdAt: 0, issuedAt: at('2026-09-01') }
ok(reviewStage(legacy) === 'agreed' && valCourt(legacy, job(), scope, [], now).tone === 'late', 'issued before the review step: as before (terms from issue)')

// --- what the job says
const open: Valuation = { id: 'v2', jobId: 'j', number: 2, status: 'Open', createdAt: at('2026-10-10'), issuedAt: null }
const s2: ScopeItem[] = [...scope.map(i => ({ ...i })), { ...scope[0], id: 's2', valuationId: 'v2' }]
const A = (today: string, vals: Valuation[], diary: DiaryEntry[] = [], j = job()) => jobAlerts(j, s2, [], vals, [], at(today), diary).alerts
const paidV1 = markAgreed({ ...v3oct, invoiceNumber: 'TS-1', invoiceDate: at('2026-10-05'), paidAt: at('2026-10-20'), paidAmount: 1200 })   // £1,000 + VAT
ok(!A('2026-10-20', [paidV1, open]).some(a => a.place === 'vals'), 'mid-month: lines ticked in, but no nagging')
let a = A('2026-11-03', [paidV1, open]).find(a => a.text.includes('VAL II'))
ok(a?.kind === 'do' && a.deadline === true && a.text === 'Valuation week · VAL II £1,000.00 ready to send' && a.hint.includes('last one VAL I, sent 3 Oct'), 'valuation week → send VAL II, and when the last one went')
a = A('2026-11-09', [paidV1, open]).find(a => a.text.includes('VAL II'))
ok(a?.kind === 'warn' && a.text === 'VAL II was due 1–7 Nov', 'past the 7th → late, said plainly')
const s1 = scope.map(i => ({ ...i }))
a = jobAlerts(job(), s1, [], [paidV1], [], at('2026-11-03'), [site('2026-10-15'), site('2026-10-16')]).alerts.find(a => a.deadline)
ok(a?.place === 'scope' && a.text.startsWith('Valuation week · tick in') && a.hint.startsWith('2 site days since VAL I'), 'nothing ticked but work on site → tick in what’s done')
ok(!jobAlerts(job(), s1, [], [paidV1], [], at('2026-11-03'), []).alerts.some(a => a.deadline), 'no work since → nothing to say')
ok(A('2026-10-20', [paidV1, open], [], job({ status: 'Complete' })).some(a => a.kind === 'do' && a.text === 'VAL II: £1,000.00 ready'), 'finished job: the final valuation is ready whenever')
ok(A('2026-11-06', [sent('2026-10-20')]).some(a => a.kind === 'stop' && a.deadline && a.text === 'VAL I with the client 17 days'), 'a review two weeks old → chase for agreement')
ok(A('2026-11-06', [agreed]).some(a => a.kind === 'do' && a.text === 'VAL I agreed · create the invoice'), 'agreed → the invoice is the next step')
ok(A('2026-11-06', [changed]).some(a => a.text === 'VAL I: the client asked for changes' && a.hint.startsWith('“No. 18 kitchen not finished”')), 'changes asked → say what')

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
