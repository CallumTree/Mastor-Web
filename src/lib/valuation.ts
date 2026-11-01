import { roman } from './format'
/**
 * Valuation rules — the single source of truth for what's claimed where.
 *
 *  - An item is LIVE when valuationId is null, CLAIMED when it points at a valuation.
 *  - Ticking a live item puts it in the job's one Open valuation (created if needed).
 *  - Unticking / removing from an Open valuation sends it straight back to live.
 *  - Issued valuations are locked: their items can't be unticked or edited — except while the client
 *    has asked for changes, when the valuation is open to amend (and takes the ticks) until it's sent again.
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
/** Sent, and the client asked for changes: open to amend until it's sent again. */
export const amending = (v: Valuation) => v.status === 'Issued' && !!v.review?.changesAt && !v.review.agreedAt
/** Where a tick goes: the valuation being amended, else the open one. */
export const claimTarget = (vals: Valuation[]) => vals.find(amending) ?? openValuation(vals)

export async function ensureOpenValuation(jobId: string): Promise<Valuation> {
  const vals = await db.valuations(jobId)
  const open = claimTarget(vals)
  if (open) return open
  const v: Valuation = { id: uid(), jobId, number: vals.reduce((m, x) => Math.max(m, x.number), 0) + 1, status: 'Open', createdAt: Date.now(), issuedAt: null }
  await db.putValuation(v)
  return v
}

export function lockedIn(item: { valuationId?: string | null }, vals: Valuation[]): Valuation | null {
  if (!item.valuationId) return null
  const v = vals.find(x => x.id === item.valuationId)
  return v && v.status === 'Issued' && !amending(v) ? v : null
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

/**
 * Sends the valuation to the client for review and locks it. Returns the sent record, so the next step
 * works from it, not the open copy. Sent again after changes, it keeps its first send date (issuedAt).
 */
export async function issueValuation(v: Valuation, now = Date.now()): Promise<Valuation> {
  const issued: Valuation = amending(v)
    ? { ...v, review: { ...v.review!, sentAt: now, rounds: v.review!.rounds + 1, changesAt: null } }
    : { ...v, status: 'Issued', issuedAt: now, review: { sentAt: now, rounds: 1 } }
  await db.putValuation(issued)
  return issued
}

/** The client's answer. Changes open it to amend; agreeing locks it for good and the invoice is next. */
export const askChanges = (v: Valuation, changes: string, now = Date.now()): Valuation =>
  ({ ...v, review: { sentAt: v.review?.sentAt ?? v.issuedAt ?? now, rounds: v.review?.rounds ?? 1, agreedAt: null, changesAt: now, changes: changes.trim() || undefined } })
export const markAgreed = (v: Valuation, now = Date.now()): Valuation =>
  v.review?.agreedAt ? v : ({ ...v, review: { sentAt: v.review?.sentAt ?? v.issuedAt ?? now, rounds: v.review?.rounds ?? 1, changes: v.review?.changes, changesAt: null, agreedAt: now } })
/** Where the valuation is with the client. Valuations from before the review step count as agreed. */
export function reviewStage(v: Valuation): 'open' | 'review' | 'changes' | 'agreed' {
  if (v.status === 'Open') return 'open'
  if (!v.review || v.review.agreedAt || v.invoiceNumber || v.paidAt) return 'agreed'
  return v.review.changesAt ? 'changes' : 'review'
}

export interface IssueGroup { name: string; lines: number; base: number }
export interface IssueCheck { kind: 'warn' | 'ok'; text: string }
export interface IssuePlan {
  totals: ValTotals; u1: number; u2: number
  previous: number; cumulative: number; target: number; pct: number | null
  groups: IssueGroup[]; checks: IssueCheck[]
}

/**
 * What a valuation certifies, and what a client QS would query before it's locked: a missing PO,
 * VOs the client hasn't instructed, claiming more than the contract and VOs are worth, a property
 * claimed past its scope. Warnings never block issuing — the contractor decides.
 */
export function issuePlan(job: Job, val: Valuation, vals: Valuation[], scope: ScopeItem[], vos: Variation[]): IssuePlan {
  const totals = valTotals(job, val.id, scope, vos)
  const { u1, u2 } = upliftAmounts(totals.base, job.uplift1, job.uplift2)
  const previous = pennies(vals.filter(v => v.status === 'Issued' && v.id !== val.id).reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0))
  const cumulative = pennies(previous + totals.gross)
  const live = vos.filter(v => v.status !== 'Rejected')
  const f = (1 + (job.uplift1 || 0) / 100) * (1 + (job.uplift2 || 0) / 100)
  const scopeGross = pennies(scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) * f)
  const target = pennies((job.contractValue || scopeGross) + live.reduce((t, v) => t + lineValue(v.qty, v.rate), 0) * f)
  const mine = scope.filter(i => i.valuationId === val.id), myVos = vos.filter(v => v.valuationId === val.id)
  const multi = new Set(scope.map(i => i.property).filter(Boolean)).size > 1
  const groupOf = (i: ScopeItem) => (multi ? (i.property ? `No. ${i.property}` : 'Unassigned') : i.workstream || i.room || 'General')
  const groups = new Map<string, IssueGroup>()
  const add = (name: string, base: number) => { const g = groups.get(name) ?? { name, lines: 0, base: 0 }; g.lines++; g.base = pennies(g.base + base); groups.set(name, g) }
  for (const i of mine) add(groupOf(i), lineValue(i.qty, i.rate))
  for (const v of myVos) add('Variations', lineValue(v.qty, v.rate))

  const checks: IssueCheck[] = []
  if (!job.poNumber) checks.push({ kind: 'warn', text: 'No PO number on this job — the certificate and invoice will go out without one.' })
  const uninstructed = myVos.filter(v => v.status === 'Identified')
  if (uninstructed.length) checks.push({ kind: 'warn', text: `${uninstructed.map(v => `VO ${roman(v.number)}`).join(', ')} ${uninstructed.length === 1 ? 'isn’t' : 'aren’t'} instructed by the client yet — they may not certify ${uninstructed.length === 1 ? 'it' : 'them'}.` })
  const noRef = myVos.filter(v => v.status !== 'Identified' && !v.clientRef)
  if (noRef.length) checks.push({ kind: 'warn', text: `${noRef.map(v => `VO ${roman(v.number)}`).join(', ')} ${noRef.length === 1 ? 'has' : 'have'} no client VO reference.` })
  if (target > 0 && cumulative > target + 0.5) checks.push({ kind: 'warn', text: `Cumulative claims ${gbp(pennies(cumulative - target))} more than the contract and VOs are worth (${gbp(target)}).` })
  if (multi) {
    for (const p of new Set(mine.map(i => i.property).filter((x): x is string => !!x))) {
      const all = scope.filter(i => i.property === p), priced = all.filter(isPriced)
      const unpriced = all.length - priced.length
      if (unpriced && priced.every(i => i.valuationId)) checks.push({ kind: 'warn', text: `No. ${p} has every priced line claimed, but ${unpriced} line${unpriced === 1 ? ' is' : 's are'} still unpriced — price ${unpriced === 1 ? 'it' : 'them'} before the property is finished.` })
    }
  }
  const claude = mine.filter(i => i.byClaude).length + myVos.filter(v => v.byClaude).length
  if (claude) checks.push({ kind: 'warn', text: `Claude added ${claude} line${claude === 1 ? '' : 's'} (marked “by Claude”) — check ${claude === 1 ? 'it' : 'them'} before you send it.` })
  if (!checks.length) checks.push({ kind: 'ok', text: 'Nothing for the client to query — ready to send.' })
  return { totals, u1, u2, previous, cumulative, target, pct: target > 0 ? Math.round((cumulative / target) * 1000) / 10 : null, groups: [...groups.values()].sort((a, b) => (a.name === 'Variations' ? 1 : b.name === 'Variations' ? -1 : a.name.localeCompare(b.name, 'en', { numeric: true }))), checks }
}
const gbp = (n: number) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
