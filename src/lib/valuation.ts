import { roman } from './format'
/**
 * Valuation rules — the single source of truth for what's claimed where.
 *
 *  - An item is LIVE when valuationId is null, CLAIMED when it points at a valuation.
 *  - Ticking a live item puts it in the job's one Open valuation (created if needed).
 *  - Unticking / removing from an Open valuation sends it straight back to live.
 *  - Issued valuations are locked: their items can't be unticked or edited.
 *  Because the link lives on the item itself, the work order and the valuation can
 *  never disagree — they're two views of the same field.
 */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { db, uid } from './db'

export const valRef = (n: number) => `VAL ${roman(n)}`
/** Each line rounded to the penny (half up), exactly as the council prices it — then lines are summed. */
export const pennies = (x: number) => Math.round(x * 100 + 1e-7 * Math.sign(x)) / 100
export const lineValue = (qty: number | null, rate: number | null) => (qty != null && rate != null ? pennies(qty * rate) : 0)
export const isPriced = (x: { qty: number | null; rate: number | null }) => x.qty != null && x.rate != null

export function openValuation(vals: Valuation[]) { return vals.find(v => v.status === 'Open') ?? null }

export async function ensureOpenValuation(jobId: string): Promise<Valuation> {
  const vals = await db.valuations(jobId)
  const open = openValuation(vals)
  if (open) return open
  const v: Valuation = { id: uid(), jobId, number: vals.reduce((m, x) => Math.max(m, x.number), 0) + 1, status: 'Open', createdAt: Date.now(), issuedAt: null }
  await db.putValuation(v)
  return v
}

export function lockedIn(item: { valuationId?: string | null }, vals: Valuation[]): Valuation | null {
  if (!item.valuationId) return null
  const v = vals.find(x => x.id === item.valuationId)
  return v && v.status === 'Issued' ? v : null
}

export async function toggleScope(item: ScopeItem, vals: Valuation[]) {
  if (lockedIn(item, vals)) return // issued = locked
  if (item.valuationId) await db.putScope({ ...item, valuationId: null })
  else if (!isPriced(item)) return // nothing to claim without a qty and rate
  else { const v = await ensureOpenValuation(item.jobId); await db.putScope({ ...item, valuationId: v.id }) }
}

/** Tick a batch (e.g. a whole property) into the open valuation. Skips unpriced and already-claimed lines. */
export async function claimMany(items: ScopeItem[]) {
  const live = items.filter(i => !i.valuationId && isPriced(i))
  if (!live.length) return
  const v = await ensureOpenValuation(live[0].jobId)
  for (const i of live) await db.putScope({ ...i, valuationId: v.id })
}

export async function toggleVariation(vo: Variation, vals: Valuation[]) {
  if (lockedIn(vo, vals)) return
  if (vo.valuationId) await db.putVariation({ ...vo, valuationId: null })
  else if (isPriced(vo) && vo.status !== 'Rejected') { const v = await ensureOpenValuation(vo.jobId); await db.putVariation({ ...vo, valuationId: v.id }) }
}

/** Deleting an open valuation returns everything in it to live. Issued ones can't be deleted. */
export async function deleteOpenValuation(v: Valuation, scope: ScopeItem[], vos: Variation[]) {
  if (v.status !== 'Open') return
  for (const s of scope.filter(s => s.valuationId === v.id)) await db.putScope({ ...s, valuationId: null })
  for (const x of vos.filter(x => x.valuationId === v.id)) await db.putVariation({ ...x, valuationId: null })
  await db.deleteValuation(v.id)
}

export async function issueValuation(v: Valuation) {
  await db.putValuation({ ...v, status: 'Issued', issuedAt: Date.now() })
}

/**
 * Uplifts compound (uplift 2 on top of uplift 1) and — as Pembrokeshire's POs do — the total is
 * rounded ONCE: base × (1+u1) × (1+u2). Uplift 1 is shown to the penny; uplift 2 is the balance,
 * so the printed lines always add up to the total exactly.
 */
export function upliftAmounts(base: number, u1pct: number, u2pct: number) {
  const gross = pennies(base * (1 + (u1pct || 0) / 100) * (1 + (u2pct || 0) / 100))
  const u1 = pennies(base * (u1pct || 0) / 100)
  const u2 = pennies(gross - base - u1)
  return { u1, u2, gross }
}

export interface ValTotals { scopeBase: number; voBase: number; base: number; gross: number; lines: number }
export function valTotals(job: Job, valId: string, scope: ScopeItem[], vos: Variation[]): ValTotals {
  const s = scope.filter(x => x.valuationId === valId)
  const o = vos.filter(x => x.valuationId === valId)
  const scopeBase = s.reduce((t, x) => t + lineValue(x.qty, x.rate), 0)
  const voBase = o.reduce((t, x) => t + lineValue(x.qty, x.rate), 0)
  const base = pennies(scopeBase + voBase)
  const u = upliftAmounts(base, job.uplift1, job.uplift2)
  return { scopeBase, voBase, base, gross: u.gross, lines: s.length + o.length }
}
