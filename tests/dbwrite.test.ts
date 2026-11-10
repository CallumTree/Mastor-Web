// A change and its place in the outbox are one write: both land, or neither does. Bulk ticks are one write too.
import 'fake-indexeddb/auto'
import { db, outbox, setQueueing } from '../src/lib/db'
import { claimMany } from '../src/lib/valuation'
import type { ScopeItem } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const line = (id: string, extra: Partial<ScopeItem> = {}): ScopeItem => ({ id, jobId: 'j', code: 'C' + id, description: 'Line ' + id, room: '', qty: 2, unit: 'NO', rate: 10, valuationId: null, order: 1, createdAt: 1, ...extra })

// before sign-in nothing is queued, and the record still saves
await db.putScope(line('a'))
ok((await db.scope('j')).length === 1 && (await outbox.count()) === 0, 'not signed in with a company yet: saved on the phone, nothing queued')

let nudges = 0
setQueueing(true, () => { nudges++ })
await db.putScope(line('b'))
let out = await outbox.all()
ok(out.length === 1 && out[0].kind === 'record' && out[0].id === 'b' && (out[0] as { data: ScopeItem }).data.description === 'Line b' && nudges === 1, 'a save and its outbox entry land together; sync is nudged once')

// a bad record in a batch takes the whole write with it: nothing half-saved, nothing queued
const before = (await db.scope('j')).length
let threw = false
try { await db.putScopeMany([line('c'), { ...line('d'), id: undefined as never }]) } catch { threw = true }
ok(threw && (await db.scope('j')).length === before && (await outbox.count()) === 1, 'a write that fails part-way leaves nothing behind: no record without its outbox entry')

// tick all: forty lines, one write, one nudge
await db.putScopeMany(Array.from({ length: 40 }, (_, i) => line('t' + i)))
const n0 = nudges, q0 = await outbox.count()
await claimMany((await db.scope('j')).filter(i => i.id.startsWith('t')))
const ticked = (await db.scope('j')).filter(i => i.id.startsWith('t'))
const val = (await db.valuations('j'))[0]
ok(ticked.every(i => i.valuationId === val.id) && (await outbox.count()) - q0 === 41 && nudges - n0 === 2, 'Tick all on 40 lines: the valuation, then all 40 in one write (41 entries, 2 nudges, not 80 writes)')

// deleting a diary photo removes the record, its file and queues the delete, together
await db.putPhoto('m1', new Blob(['x']))
await db.putDiary({ id: 'p1', jobId: 'j', date: '2026-11-10', type: 'photo', note: '', labour: null, weather: '', mediaId: 'm1', originalMediaId: null, room: '', voId: null, createdAt: 1 })
await db.deleteDiary((await db.diary('j'))[0])
out = await outbox.all()
ok((await db.diary('j')).length === 0 && !(await db.photo('m1')) && out.at(-1)!.kind === 'record' && (out.at(-1) as { data: unknown }).data === null, 'a deleted photo: record, file and the queued delete in one write')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
