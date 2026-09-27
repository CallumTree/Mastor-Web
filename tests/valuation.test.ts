import 'fake-indexeddb/auto'
import { db, uid } from '../src/lib/db'
import { toggleScope, toggleVariation, issueValuation, deleteOpenValuation, valTotals, lockedIn } from '../src/lib/valuation'
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
  ok(d.vals.length === 1 && d.vals[0].status === 'Open' && d.vals[0].number === 1, 'first tick creates VAL-001 (Open)')
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'item points at VAL-001')

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
  ok(d.vals[0].status === 'Issued', 'VAL-001 issued')
  ok(!!lockedIn(d.scope.find(s => s.id === 's1')!, d.vals), 'its items report locked')
  await toggleScope(d.scope.find(s => s.id === 's1')!, d.vals); d = await get()
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'locked item cannot be unticked')

  console.log('Next tick → VAL-002')
  await toggleScope(d.scope.find(s => s.id === 's2')!, d.vals); d = await get()
  const v2 = d.vals.find(v => v.number === 2)
  ok(!!v2 && v2.status === 'Open', 'new tick after issue opens VAL-002')
  ok(d.scope.find(s => s.id === 's2')!.valuationId === v2!.id, 'item lands in VAL-002')

  console.log('Delete open valuation → everything back to live')
  await deleteOpenValuation(v2!, d.scope, d.vos); d = await get()
  ok(!d.vals.find(v => v.number === 2), 'VAL-002 deleted')
  ok(d.scope.find(s => s.id === 's2')!.valuationId === null, 'its item is live again')
  ok(d.scope.find(s => s.id === 's1')!.valuationId === d.vals[0].id, 'VAL-001 untouched')
  await deleteOpenValuation(d.vals[0], d.scope, d.vos); d = await get()
  ok(d.vals.length === 1, 'issued valuation cannot be deleted')

  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
