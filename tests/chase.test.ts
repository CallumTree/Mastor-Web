import { voCourt, valCourt, voStage, voStatusAfter } from '../src/lib/chase'
import type { Job, ScopeItem, Valuation, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const DAY = 86_400_000, now = Date.UTC(2026, 9, 1, 12)
const job: Job = { id: 'j', name: 'J', client: '', address: '', contractRef: '', poNumber: 'P', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 0 }
const vo = (p: Partial<Variation>): Variation => ({ id: 'v', jobId: 'j', number: 1, description: '', room: '', qty: 1, unit: 'nr', rate: 100, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: now, valuationId: null, ...p })
ok(voCourt(vo({ rate: null }), [], now).text === 'Price it', 'unpriced → price it (us)')
ok(voCourt(vo({}), [], now).who === 'us' && voCourt(vo({}), [], now).text.startsWith('Send'), 'priced, not sent → send to client (us)')
ok(voCourt(vo({ submittedAt: now - 3 * DAY }), [], now).tone === 'ok', 'sent 3 days ago → with client, fine')
ok(voCourt(vo({ submittedAt: now - 8 * DAY }), [], now).tone === 'due', '8 days → amber')
ok(voCourt(vo({ submittedAt: now - 15 * DAY }), [], now).tone === 'late', '15 days → red')
ok(voCourt(vo({ valuationId: 'x' }), [{ id: 'x', jobId: 'j', number: 2, status: 'Open', createdAt: 0, issuedAt: null }], now).text === 'Claimed in VAL II', 'claimed → done')
const scope: ScopeItem[] = [{ id: 's', jobId: 'j', code: '', description: '', room: '', qty: 1, unit: 'nr', rate: 1000, valuationId: 'v1', order: 1, createdAt: 0 }]
const val = (p: Partial<Valuation>): Valuation => ({ id: 'v1', jobId: 'j', number: 1, status: 'Issued', createdAt: 0, issuedAt: now - 10 * DAY, ...p })
ok(valCourt(val({}), job, scope, [], now).text.startsWith('Due') && valCourt(val({}), job, scope, [], now).tone === 'ok', 'issued 10 days ago, 30-day terms → due, fine')
ok(valCourt(val({ issuedAt: now - 26 * DAY }), job, scope, [], now).tone === 'due', '4 days left → amber')
ok(valCourt(val({ issuedAt: now - 35 * DAY }), job, scope, [], now).text === 'Overdue 5 days', '35 days → overdue 5 days')
ok(valCourt(val({ issuedAt: now - 35 * DAY }), { ...job, paymentTermsDays: 45 }, scope, [], now).tone !== 'late', 'per-job 45-day terms respected')
ok(valCourt(val({ paidAt: now, paidAmount: 1000 }), job, scope, [], now).tone === 'done', 'paid in full → done')
const part = valCourt(val({ issuedAt: now - 35 * DAY, paidAt: now, paidAmount: 600 }), job, scope, [], now)
ok(part.owed === 400 && part.tone === 'late' && part.text.includes('Part paid'), 'part paid → £400 outstanding, still overdue')
// the VO's stage follows its facts; nobody sets it
ok(voStage(vo({ rate: null })) === 'Logged', 'no price → logged')
ok(voStage(vo({})) === 'Priced', 'priced, not sent → priced')
ok(voStage(vo({ submittedAt: now })) === 'With client', 'sent for instruction → with client')
ok(voStage(vo({ submittedAt: now, clientRef: 'VO 12' })) === 'Instructed', 'a client ref → instructed')
ok(voStage(vo({ status: 'Instructed', clientRef: '' })) === 'Instructed', 'a signed dayworks sheet (instructed, no ref) stays instructed')
ok(voStage(vo({ clientRef: 'VO 12', valuationId: 'x' })) === 'Claimed', 'in a valuation → claimed')
ok(voStage(vo({ status: 'Rejected', clientRef: 'VO 12' })) === 'Rejected', 'rejected beats everything')
ok(voStatusAfter(vo({}), vo({ clientRef: 'VO 3' })) === 'Instructed', 'typing a client ref instructs it')
ok(voStatusAfter(vo({ clientRef: 'VO 3', status: 'Instructed' }), vo({ clientRef: '', status: 'Instructed' })) === 'Identified', 'taking the ref away undoes it')
ok(voStatusAfter(vo({ status: 'Instructed' }), vo({ status: 'Instructed', description: 'x' })) === 'Instructed', 'an instruction without a ref is left alone')
ok(voStatusAfter(vo({ clientRef: 'VO 3', status: 'Instructed' }), vo({ clientRef: 'VO 3', status: 'Rejected' })) === 'Rejected', 'client rejected it')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
