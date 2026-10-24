import { buildVoRegister, groupValue, registerFileName, registerSummary } from '../src/lib/voRegister'
import type { Job, Valuation, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const DAY = 864e5, now = Date.UTC(2026, 9, 8)
const job: Job = { id: 'j', name: '51 Prescelly Place', client: 'PCC', address: 'Haverfordwest', contractRef: 'PCL_600', poNumber: 'PC26100', contractValue: 0, uplift1: 20.28, uplift2: 5, workType: 'Internal', status: 'Active', photoId: null, createdAt: 0 }
const val: Valuation = { id: 'v1', jobId: 'j', number: 2, status: 'Issued', createdAt: 0, issuedAt: now - 10 * DAY }
const vo = (n: number, o: Partial<Variation>): Variation => ({ id: 'vo' + n, jobId: 'j', number: n, description: `Variation ${n}`, room: 'Kitchen', qty: 1, unit: 'nr', rate: 100, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: now - 30 * DAY, ...o })
const vos = [
  vo(1, { status: 'Complete', valuationId: 'v1', clientRef: 'VO11284', qty: 2, rate: 150.5, photoIds: ['a', 'b'], attachments: [{ id: 'x', name: 'VO11284.pdf', type: 'application/pdf' }] }),
  vo(2, { status: 'Complete', rate: 80 }),
  vo(3, { status: 'Instructed', clientRef: 'VO5' }),
  vo(4, { submittedAt: now - 20 * DAY }),            // with client 20 days → overdue
  vo(5, { rate: null }),                              // unpriced — counted, never valued
  vo(6, { status: 'Rejected', rate: 999 }),
]
const s = registerSummary(job, vos, [val], now)
const r = (k: string) => s.rows.find(x => x.key === k)!
ok(r('claimed').count === 1 && r('claimed').base === 301, `claimed: 1 VO, £301.00 (got ${r('claimed').base})`)
ok(r('ready').base === 80 && r('instructed').base === 100, 'complete-unclaimed and instructed valued separately')
ok(r('awaiting').count === 2 && r('awaiting').unpriced === 1 && r('awaiting').base === 100, 'unpriced VO counted but not valued at £0')
ok(r('rejected').count === 1, 'rejected listed')
ok(s.base === 581, `total excludes rejected (got ${s.base})`)
ok(s.gross === Math.round(581 * 1.2028 * 1.05 * 100) / 100, `uplifts applied once to the total (got ${s.gross})`)
ok(s.overdue === 1, 'one instruction overdue')
ok(r('awaiting').unsent === 1, 'awaiting: one not yet sent to the client (VO 5), one with them (VO 4)')
ok(r('claimed').gross === Math.round(301 * 1.2028 * 1.05 * 100) / 100, `each group also carries its value incl. uplifts (got ${r('claimed').gross})`)
ok(groupValue(0, 0, 0) === '—', 'empty group reads "—", not £0.00')
ok(groupValue(0, 2, 2) === 'Unpriced', 'all-unpriced group reads "Unpriced", not £0.00')
ok(groupValue(100, 2, 1) === '£100.00', 'part-priced group shows the priced value')
;(async () => {
  const blob = await buildVoRegister({ job, vos, vals: [val], company: 'Tree & Sons Ltd', now })
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1')
  ok(text.startsWith('%PDF'), 'produces a PDF')
  ok(text.includes('Variation Register') && text.includes('VO11284') && text.includes('PC26100'), 'title, council ref and PO on it')
  ok(text.includes('VAL II') && text.includes('VO I'), 'Roman refs for VO and the valuation it was claimed in')
  ok(text.includes('Unpriced') && text.includes('Not issued'), 'gaps shown plainly, not as £0')
  const empty = await buildVoRegister({ job, vos: [], vals: [], now })
  ok((await empty.size) > 1000, 'empty job still prints a register')
  ok(registerFileName(job, now) === 'PCL_600_VO-Register_2026-10-08.pdf', 'file named by contract ref and date')
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
