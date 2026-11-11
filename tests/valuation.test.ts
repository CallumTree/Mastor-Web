import 'fake-indexeddb/auto'
import { db, uid } from '../src/lib/db'
import { toggleScope, toggleVariation, issueValuation, deleteOpenValuation, valTotals, lockedIn, isCertified, isWithClient, jobWorth, shareOut, upliftedValues } from '../src/lib/valuation'
import type { Valuation } from '../src/lib/types'
import type { Job, ScopeItem, Variation } from '../src/lib/types'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const job: Job = { id: 'j1', name: 'T', client: '', address: '', contractRef: '', poNumber: 'PO1', contractValue: 1000, uplift1: 10, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 0 }
const item = (n: number, qty: number | null, rate: number | null): ScopeItem => ({ id: 's' + n, jobId: 'j1', code: 'C' + n, description: 'item ' + n, room: 'Kitchen', qty, unit: 'nr', rate, valuationId: null, order: n, createdAt: 0 })
const get = async () => ({ scope: await db.scope('j1'), vals: await db.valuations('j1'), vos: await db.variations('j1') })

;(async () => {
  await db.putJob(job)
  for (const i of [item(1, 2, 50), item(2, 1, 100), item(3, null, 20)]) await db.putScope(i)
  const vo: Variation = { id: 'v1', jobId: 'j1', number: 1, description: 'extra', room: 'Bath', qty: 3, unit: 'm', rate: 10, code: '', reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 0, valuationId: null }
  const unpricedVo: Variation = { ...vo, id: 'v2', number: 2, rate: null }
  await db.putVariation(vo); await db.putVariation(unpricedVo)

  console.log('Tick → open valuation')
  let d = await get()
  await toggleScope(d.scope.find(s => s.id === 's1')!, d.vals)
  d = await get()
  ok(d.vals.length === 1 && d.vals[0].status === 'Open' && d.vals[0].number === 1, 'first tick creates VAL I (Open)')
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'item points at VAL I')

  await toggleScope(d.scope.find(s => s.id === 's2')!, d.vals)
  await toggleVariation((await db.variations('j1')).find(v => v.id === 'v1')!, (await get()).vals)
  d = await get()
  ok(d.vals.length === 1, 'further ticks reuse the same open valuation')
  const t = valTotals(job, d.vals[0].id, d.scope, d.vos)
  ok(t.scopeBase === 200 && t.voBase === 30 && Math.abs(t.gross - 253) < 1e-9, `totals: scope 200 + VO 30 = 230 base, 253 incl 10% (got ${t.gross})`)

  await toggleVariation(d.vos.find(v => v.id === 'v2')!, d.vals)
  ok(!(await db.variations('j1')).find(v => v.id === 'v2')!.valuationId, 'unpriced VO cannot enter a valuation')

  await toggleScope((await db.scope('j1')).find(s => s.id === 's3')!, (await get()).vals)
  ok((await db.scope('j1')).find(s => s.id === 's3')!.valuationId === null, 'scope item with no rate cannot be claimed')

  console.log('Untick → back to live')
  d = await get()
  await toggleScope(d.scope.find(s => s.id === 's2')!, d.vals)
  d = await get()
  ok(d.scope.find(s => s.id === 's2')!.valuationId === null, 'unticking returns item to live')
  ok(valTotals(job, d.vals[0].id, d.scope, d.vos).scopeBase === 100, 'valuation total drops accordingly')

  console.log('Issue → locked')
  await issueValuation(d.vals[0]); d = await get()
  ok(d.vals[0].status === 'Issued', 'VAL I issued')
  ok(!!lockedIn(d.scope.find(s => s.id === 's1')!, d.vals), 'its items report locked')
  await toggleScope(d.scope.find(s => s.id === 's1')!, d.vals); d = await get()
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'locked item cannot be unticked')

  console.log('Next tick → VAL II')
  await toggleScope(d.scope.find(s => s.id === 's2')!, d.vals); d = await get()
  const v2 = d.vals.find(v => v.number === 2)
  ok(!!v2 && v2.status === 'Open', 'new tick after issue opens VAL II')
  ok(d.scope.find(s => s.id === 's2')!.valuationId === v2!.id, 'item lands in VAL II')

  console.log('Delete open valuation → everything back to live')
  await deleteOpenValuation(v2!, d.scope, d.vos); d = await get()
  ok(!d.vals.find(v => v.number === 2), 'VAL II deleted')
  ok(d.scope.find(s => s.id === 's2')!.valuationId === null, 'its item is live again')
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'VAL I untouched')
  await deleteOpenValuation(d.vals[0], d.scope, d.vos); d = await get()
  ok(d.vals.length === 1, 'issued valuation cannot be deleted')

  // certified means agreed: sent for review is with the client, not certified; an invoice, a payment or the agreement
  // itself certifies it; a valuation from before reviews counts as certified
  const v0: Valuation = { id: 'x', jobId: 'j1', number: 1, status: 'Issued', createdAt: 1, issuedAt: 1 } as Valuation
  const sent = { ...v0, review: { sentAt: 1, rounds: 1 } }
  ok(isWithClient(sent) && !isCertified(sent), 'sent for review: with the client, not certified')
  ok(isWithClient({ ...sent, review: { ...sent.review, changesAt: 2 } }), 'changes asked: still not certified')
  ok(isCertified({ ...sent, review: { ...sent.review, agreedAt: 3 } }) && isCertified({ ...sent, invoiceNumber: 'T-1' }) && isCertified({ ...sent, paidAt: 4 }), 'agreed, invoiced or paid: certified')
  ok(isCertified(v0) && !isCertified({ ...v0, status: 'Open' }) && !isWithClient({ ...v0, status: 'Open' }), 'no review record (older): certified; open: neither')

  // what the job is worth, one figure for every screen: the contract (or the scope with uplifts) + live priced VOs with uplifts
  const w = jobWorth({ ...job, contractValue: 1000, uplift1: 10, uplift2: 0 }, [], [{ qty: 1, rate: 33.33, status: 'Instructed' }, { qty: 1, rate: 500, status: 'Rejected' }] as Variation[])
  ok(w.contract === 1000 && w.vos === 36.66 && w.total === 1036.66 && !w.fromScope, `contract + VOs with uplifts, rejected left out (${w.total})`)
  const ws = jobWorth({ ...job, contractValue: 0, uplift1: 10, uplift2: 0 }, [item(9, 3, 33.33)], [])
  ok(ws.fromScope && ws.contract === 109.99 && ws.total === 109.99, `no contract value: the scope at its rates with uplifts, to the penny like a valuation (${ws.contract})`)

  // every line and VO with uplifts, shared out so the screens add up to the job's figures to the penny
  const parts = shareOut(106.35, [33.33, 33.33, 33.34, 0.01])
  ok(Math.round(parts.reduce((t, x) => t + x, 0) * 100) === 10635 && parts.every(x => Math.round(x * 100) === x * 100), 'a total shared out: whole pennies that add up exactly')
  const uj = { contractValue: 0, uplift1: 4.2, uplift2: 1.3 } as Job
  const us = Array.from({ length: 53 }, (_, k) => ({ id: 's' + k, qty: (k % 7) + 0.37, rate: 3.17 + k * 1.11 })) as ScopeItem[]
  const uvos = [{ id: 'x1', qty: 1, rate: 170, status: 'Identified' }, { id: 'x2', qty: 2.5, rate: 13.33, status: 'Instructed' }, { id: 'x3', qty: 1, rate: 50, status: 'Rejected' }] as Variation[]
  const uv = upliftedValues(uj, us, uvos), uw = jobWorth(uj, us, uvos)
  const add = (ids: string[]) => Math.round(ids.reduce((t, id) => t + uv.get(id)! * 100, 0))
  ok(add(us.map(i => i.id)) === Math.round(uw.contract * 100), 'scope lines with uplifts add up to the job’s contract (from the scope)')
  ok(add(['x1', 'x2']) === Math.round(uw.vos * 100) && uv.get('x3') === 52.78, 'VOs that count add up to its variations; a rejected one has its own value, counted nowhere')

  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
