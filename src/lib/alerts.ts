/**
 * "Action needed" on a job: what is wrong, what is owed and what to do next. Pure, so the job home screen
 * and the Claude connector say exactly the same thing.
 */
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation, WorkOrder } from './types'
import { money, ukDate } from './format'
import { amending, lineValue, pennies, reviewStage, upliftAmounts, valRef, valTotals } from './valuation'
import { valCourt, voCourt, VO_CHASE_AMBER } from './chase'
import { lastText, siteDaysSince, valRhythm, weekText } from './rhythm'

/** stop = red (overdue or missing) · warn = yellow (needs doing) · do = the next step */
export type AlertKind = 'stop' | 'warn' | 'do'
/** Where the alert is dealt with in the app. */
export type AlertPlace = 'gap' | 'setup' | 'vals' | 'vos' | 'scope'
/** `deadline` alerts also go on the week across all jobs (office only): money overdue, a review or VO late with the client, the valuation week. */
export interface JobAlert { kind: AlertKind; text: string; hint: string; place: AlertPlace; site?: boolean; deadline?: boolean }
export interface PoGap { withUplifts: number; diff: number; needed: number }

export const isOverdue = (o: WorkOrder, now = Date.now()) => o.status === 'open' && o.dueAt != null && o.dueAt < now

/** `site` alerts are the ones an operative sees; the rest are about money, the PO or the client. */
export function jobAlerts(job: Job, scope: ScopeItem[], vos: Variation[], vals: Valuation[], orders: WorkOrder[], now = Date.now(), diary?: DiaryEntry[]) {
  const alerts: JobAlert[] = []
  const live = vos.filter(v => v.status !== 'Rejected')
  const unpriced = live.filter(v => v.rate == null).length
  const unmeasured = live.filter(v => v.qty == null).length
  const open = vals.find(v => v.status === 'Open')
  const fixing = vals.find(amending)
  const openTotals = open ? valTotals(job, open.id, scope, vos) : null

  // Uplifts must turn the BoQ into the PO's all-in figure. A known, accepted difference becomes a note;
  // if the difference changes after it was accepted, it's flagged again.
  const scopeBase = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  let poNote: string | null = null
  let gap: PoGap | null = null
  if (scopeBase > 0 && job.contractValue > 0) {
    const withUplifts = upliftAmounts(pennies(scopeBase), job.uplift1, job.uplift2).gross
    const diff = pennies(withUplifts - job.contractValue)
    if (Math.abs(diff) / job.contractValue > 0.0005) {
      gap = { withUplifts, diff, needed: (job.contractValue / scopeBase - 1) * 100 }
      const acc = job.poGapAccepted
      if (acc && Math.abs(acc.diff - diff) < 0.01) poNote = `PO difference of ${money(Math.abs(diff))} accepted ${ukDate(acc.at)}${acc.note ? ` — ${acc.note}` : ''}`
      else alerts.push({ kind: 'stop', place: 'gap', text: acc ? 'PO difference has changed since you accepted it' : "BoQ doesn't reconcile with the PO",
        hint: `BoQ ${money(scopeBase)} + ${job.uplift1}% + ${job.uplift2}% = ${money(withUplifts)}; PO is ${money(job.contractValue)} (${diff > 0 ? 'over' : 'under'} by ${money(Math.abs(diff))}). Tap to review or accept.` })
    }
  }
  for (const v of vals.filter(x => x.status === 'Issued')) {
    const c = valCourt(v, job, scope, vos, now), ref = valRef(v.number), stage = reviewStage(v)
    if (stage === 'changes') alerts.push({ kind: 'warn', place: 'vals', text: `${ref}: the client asked for changes`, hint: v.review?.changes ? `“${v.review.changes}” · amend it and send it again` : 'Amend it and send it again' })
    else if (stage === 'review') {
      if (c.tone === 'late') alerts.push({ kind: 'stop', place: 'vals', deadline: true, text: `${ref} with the client ${c.days} days`, hint: 'Not agreed yet · chase for agreement' })
      else if (c.tone === 'due') alerts.push({ kind: 'warn', place: 'vals', text: `${ref} with the client ${c.days} days`, hint: 'Chase for agreement' })
    }
    else if (c.tone === 'late') alerts.push({ kind: 'stop', place: 'vals', deadline: true, text: `${ref} overdue — ${money(c.owed)}`, hint: c.text + ' · chase the client' })
    else if (c.tone === 'due' && c.who === 'us') alerts.push({ kind: 'do', place: 'vals', text: `${ref} agreed · create the invoice`, hint: `${money(c.owed)} · send it to accounts` })
    else if (c.tone === 'due') alerts.push({ kind: 'warn', place: 'vals', text: `${ref} payment due soon`, hint: c.text })
  }
  const waiting = vos.filter(v => { const c = voCourt(v, vals, now); return c.who === 'client' && (c.days ?? 0) >= VO_CHASE_AMBER })
  const voLate = waiting.some(v => voCourt(v, vals, now).tone === 'late')
  if (waiting.length) alerts.push({ kind: voLate ? 'stop' : 'warn', place: 'vos', deadline: voLate || undefined,
    text: `${waiting.length} VO${waiting.length === 1 ? '' : 's'} waiting on the client ${VO_CHASE_AMBER}+ days`, hint: 'Chase for an instruction' })
  const toSend = vos.filter(v => voCourt(v, vals, now).text.startsWith('Send')).length
  if (toSend) alerts.push({ kind: 'warn', place: 'vos', text: `${toSend} priced VO${toSend === 1 ? '' : 's'} not sent to the client`, hint: 'Send for instruction so the clock starts' })
  if (!job.poNumber) alerts.push({ kind: 'stop', place: 'setup', text: 'No PO number', hint: 'Invoices will be rejected without it' })
  if (unpriced) alerts.push({ kind: 'warn', place: 'vos', text: `${unpriced} variation${unpriced === 1 ? '' : 's'} unpriced`, hint: 'Add SoR code and rate so they can be claimed' })
  if (unmeasured) alerts.push({ kind: 'warn', place: 'vos', text: `${unmeasured} variation${unmeasured === 1 ? '' : 's'} not measured`, hint: 'Measure on site', site: true })
  // The valuation week: the open valuation comes up in the first week of the month, not every time a line is ticked
  const r = valRhythm(job, vals, { now, diary })
  const lines = (n: number) => `${n} line${n === 1 ? '' : 's'}`
  if (fixing) { /* being amended: its own alert says so */ }
  else if (!r) { if (open && openTotals && openTotals.lines > 0) alerts.push({ kind: 'do', place: 'vals', text: `${valRef(open.number)}: ${money(openTotals.gross)} ready`, hint: `${lines(openTotals.lines)} — check it and send it for review` }) }
  else if (r.state === 'due' || r.state === 'late') {
    const due = r.state === 'due', ref = valRef(r.next)
    if (open && openTotals && openTotals.lines > 0) alerts.push({ kind: due ? 'do' : 'warn', place: 'vals', deadline: true,
      text: due ? `Valuation week · ${ref} ${money(openTotals.gross)} ready to send` : `${ref} was due ${weekText(r)}`,
      hint: `${due ? lines(openTotals.lines) : `${money(openTotals.gross)} ready`} · ${lastText(r)}` })
    else if (diary) {
      const n = siteDaysSince(r, diary, job.id)
      if (n) alerts.push({ kind: due ? 'do' : 'warn', place: 'scope', deadline: true,
        text: due ? `Valuation week · tick in what’s done for ${ref}` : `${ref} was due ${weekText(r)} · nothing ticked in`,
        hint: `${n} site day${n === 1 ? '' : 's'} since ${r.last ? lastText(r).replace(/^last one /, '') : 'the start'}` })
    }
  }
  if (job.kind === 'orders') {
    const late = orders.filter(o => isOverdue(o, now))
    if (late.length) alerts.push({ kind: 'stop', place: 'scope', site: true, text: `${late.length} order${late.length === 1 ? '' : 's'} overdue`, hint: late.slice(0, 3).map(o => `${o.ref} ${o.address}`).join(' · ') })
    const noPhotos = orders.filter(o => o.status === 'complete' && !o.afterIds.length).length
    if (noPhotos) alerts.push({ kind: 'warn', place: 'scope', site: true, text: `${noPhotos} finished order${noPhotos === 1 ? '' : 's'} without after photos`, hint: 'Clients usually ask for them before paying' })
    const ready = orders.filter(o => o.status === 'complete' && scope.some(i => i.orderId === o.id && !i.valuationId && i.qty != null && i.rate != null)).length
    if (ready) alerts.push({ kind: 'warn', place: 'scope', text: `${ready} completed order${ready === 1 ? '' : 's'} not claimed`, hint: 'Claim them into this month’s valuation' })
    if (!orders.length) alerts.push({ kind: 'warn', place: 'scope', site: true, text: 'No orders yet', hint: 'Add each works order as it comes in' })
  } else if (scope.length === 0) alerts.push({ kind: 'warn', place: 'scope', site: true, text: 'No scope yet', hint: 'Add the works order items' })
  return { alerts, gap, poNote }
}
