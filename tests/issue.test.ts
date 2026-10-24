/** Issuing a valuation: what it certifies, and what a client QS would query before it's locked. */
import { issuePlan } from '../src/lib/valuation'
import type { Job, ScopeItem, Valuation, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const job: Job = { id: 'j', name: 'Elm Road', client: 'PCC', address: '', contractRef: '', poNumber: 'PC1', contractValue: 0, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
const S = (id: string, property: string, qty: number | null, rate: number | null, valuationId: string | null, workstream = 'Paint'): ScopeItem =>
  ({ id, jobId: 'j', code: id, description: id, room: 'Front', qty, unit: 'IT', rate, valuationId, order: 1, property, workstream, createdAt: 1 })
const V = (n: number, status: Variation['status'], clientRef: string, valuationId: string | null, rate = 100): Variation =>
  ({ id: 'v' + n, jobId: 'j', number: n, description: 'Extra', room: '', qty: 1, unit: 'IT', rate, code: '', reason: '', clientRef, status, photoIds: [], dateRaised: 1, valuationId })
const v1: Valuation = { id: 'a', jobId: 'j', number: 1, status: 'Issued', createdAt: 1, issuedAt: 1 } as Valuation
const v2: Valuation = { id: 'b', jobId: 'j', number: 2, status: 'Open', createdAt: 2 } as Valuation

// clean: two properties, VAL I issued, VAL II open
let scope = [S('s1', '3', 1, 1000, 'a'), S('s2', '3', 1, 500, 'b'), S('s3', '4', 2, 250, 'b'), S('s4', '4', 1, 100, null)]
let p = issuePlan(job, v2, [v1, v2], scope, [])
ok(p.totals.base === 1000 && p.totals.gross === 1100 && p.u1 === 100, 'this valuation: base, uplift, gross')
ok(p.previous === 1100 && p.cumulative === 2200, 'previously certified and cumulative')
ok(p.target === 2310 && p.pct === 95.2, 'per cent of contract + VOs')
ok(p.groups.map(g => `${g.name}:${g.lines}:${g.base}`).join(' ') === 'No. 3:1:500 No. 4:1:500', 'grouped by property on a multi-property job')
ok(p.checks.length === 1 && p.checks[0].kind === 'ok', 'nothing to query: ready to issue')

// VOs: one not instructed, one instructed without the client's reference
let vos = [V(1, 'Identified', '', 'b'), V(2, 'Instructed', '', 'b'), V(3, 'Instructed', 'SI 114', 'b')]
p = issuePlan(job, v2, [v1, v2], scope, vos)
ok(p.groups.at(-1)!.name === 'Variations' && p.groups.at(-1)!.lines === 3, 'VOs listed last')
ok(p.checks.some(c => /^VO I isn’t instructed by the client yet/.test(c.text)), 'an uninstructed VO is queried')
ok(p.checks.some(c => /^VO II has no client VO reference/.test(c.text)), 'an instructed VO without the client’s ref is queried')

// no PO, over-claim against a PO value
p = issuePlan({ ...job, poNumber: '', contractValue: 1500 }, v2, [v1, v2], scope, [])
ok(p.checks.some(c => /^No PO number/.test(c.text)), 'missing PO is queried')
ok(p.checks.some(c => /^Cumulative claims £700\.00 more than the contract and VOs are worth \(£1,500\.00\)/.test(c.text)), 'claiming past the contract is queried, with the amount')

// a property with every priced line claimed but a line still unpriced
scope = [S('s1', '3', 1, 1000, 'a'), S('s2', '3', 1, 500, 'b'), S('s5', '3', null, null, null), S('s3', '4', 2, 250, 'b')]
p = issuePlan(job, v2, [v1, v2], scope, [])
ok(p.checks.some(c => /^No\. 3 has every priced line claimed, but 1 line is still unpriced/.test(c.text)), 'a property finished with an unpriced line is queried')

// single property: grouped by trade
p = issuePlan(job, v2, [v2], [S('a1', '', 1, 10, 'b', 'Roofing'), S('a2', '', 1, 20, 'b', 'Paint')], [])
ok(p.groups.map(g => g.name).join(',') === 'Paint,Roofing' && p.previous === 0, 'single property: grouped by trade')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
