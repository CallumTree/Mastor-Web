/**
 * What Claude can change in Mastor: the moves a person makes in the app, under the app's own rules
 * (src/lib/valuation.ts). It can tick priced lines into the open valuation and take them out again, log
 * and price VOs, and keep notes and the site day. Every record Claude saves is marked `byClaude`. The app
 * shows that mark until a person saves the record, and the open valuation lists Claude's lines as a check
 * before issuing. Nothing here issues a valuation or raises an invoice. Those stay in the app with a
 * person, always; invoice_figures only says what an invoice would be.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { NOTE_CATEGORIES, type DiaryEntry, type Job, type ScopeItem, type Valuation, type Variation } from '../../src/lib/types'
import { money, qtyText, roman, voRef } from '../../src/lib/format'
import { isPriced, issuePlan, lineValue, lockedIn, openValuation, pennies, valRef } from '../../src/lib/valuation'
import { allocateInvoiceNo, invoiceAmounts, missingForInvoice } from '../../src/lib/invoice'
import { copyMedia, findJob, jobData, records, save, settings, type Ctx, type JobData } from './data'
import { day, JOB_DESC, NO_MONEY, text, ukToday } from './shared'

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
const NOT_ISSUED = 'Nothing has been issued. A person checks Claude’s lines and issues the valuation in the Mastor app.'

const fromRoman = (s: string) => {
  if (!/^[IVXLCDM]+$/.test(s)) return 0
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let n = 0
  for (let i = 0; i < s.length; i++) n += v[s[i]] < (v[s[i + 1]] ?? 0) ? -v[s[i]] : v[s[i]]
  return roman(n) === s ? n : 0
}
/** A VO by its id or how people say it: "VO III", "III", "3", "VO-003". */
function findVo(vos: Variation[], q: string): Variation | null {
  const exact = vos.find(v => v.id === q)
  if (exact) return exact
  const t = q.trim().toUpperCase().replace(/^VO[\s-]*/, '')
  const n = /^\d+$/.test(t) ? Number(t) : fromRoman(t)
  return n ? vos.find(v => v.number === n) ?? null : null
}

const lineLabel = (i: ScopeItem) => `${i.property ? `No. ${i.property} · ` : ''}${i.code ? i.code + ' ' : ''}${i.description}`
const lineWithValue = (i: ScopeItem) => `${lineLabel(i)} — ${qtyText(i.qty!)} ${i.unit} @ ${money(i.rate!)} = ${money(lineValue(i.qty, i.rate))}`
const voWithValue = (v: Variation) => `${voRef(v.number)} ${v.description} — ${qtyText(v.qty!)} ${v.unit} @ ${money(v.rate!)} = ${money(lineValue(v.qty, v.rate))}`

/** The open valuation after a change, in Mastor's own figures and with the checks a client QS would make. */
function openNow(job: Job, d: JobData) {
  const open = openValuation(d.vals)
  if (!open) return 'no valuation open'
  const p = issuePlan(job, open, d.vals, d.scope, d.vos)
  return {
    ref: valRef(open.number), lines: p.totals.lines, baseRates: money(p.totals.base), inclUplifts: money(p.totals.gross),
    cumulative: money(p.cumulative), ofContract: p.pct != null ? `${p.pct}%` : null,
    checksBeforeIssue: p.checks.map(c => `${c.kind === 'warn' ? 'CHECK' : 'OK'}: ${c.text}`),
  }
}

export function registerWrites(server: McpServer, ctx: Ctx) {
  const load = async (q: string) => { const job = findJob(await records<Job>(ctx, 'jobs'), q); return { job, d: await jobData(ctx, job) } }
  const pick = (d: JobData, scopeIds: string[], voQs: string[]) => ({
    lines: [...new Set(scopeIds)].map(id => ({ q: id, i: d.scope.find(x => x.id === id) })),
    vos: [...new Set(voQs)].map(q => ({ q, v: findVo(d.vos, q) })),
  })
  const IDS = {
    scope_line_ids: z.array(z.string()).max(1000).optional().describe('Scope line id values from get_scope'),
    vos: z.array(z.string()).max(200).optional().describe('VOs by reference (VO III) or id, from get_variations'),
  }

  server.registerTool('add_to_valuation', {
    title: 'Tick lines into the open valuation',
    description: 'Claims scope lines and VOs in the job’s open valuation, the same as ticking them in the app. If no valuation is open, it starts the next one. Only priced lines that aren’t claimed yet can be added, and only VOs that aren’t rejected; lines in an issued valuation are locked. Each line added is marked “by Claude” in the app. First tell the person which lines you’ll add, with Mastor’s totals from get_scope, and get their yes. This never issues the valuation.',
    inputSchema: { job: z.string().describe(JOB_DESC), ...IDS },
    annotations: WRITE,
  }, async ({ job: q, scope_line_ids = [], vos: voQs = [] }) => {
    if (!ctx.money) throw new Error(NO_MONEY)
    if (!scope_line_ids.length && !voQs.length) throw new Error('Say which scope lines (scope_line_ids) or VOs (vos) to add.')
    const { job, d } = await load(q)
    const picked = pick(d, scope_line_ids, voQs), skipped: string[] = []
    const lines: ScopeItem[] = [], vos: Variation[] = []
    for (const { q: id, i } of picked.lines) {
      const locked = i && lockedIn(i, d.vals)
      const why = !i ? 'no scope line with this id on this job' : locked ? `certified in ${valRef(locked.number)}, so it’s locked` : i.valuationId ? 'already in the open valuation'
        : i.rate == null ? 'no rate, so price it in the app first' : i.qty == null ? 'no quantity, so measure it first' : null
      if (why) skipped.push(`${i ? lineLabel(i) : id}: ${why}`); else lines.push(i!)
    }
    for (const { q: ref, v } of picked.vos) {
      const locked = v && lockedIn(v, d.vals)
      const why = !v ? 'no such VO on this job' : locked ? `certified in ${valRef(locked.number)}, so it’s locked` : v.valuationId ? 'already in the open valuation'
        : v.status === 'Rejected' ? 'rejected by the client' : !isPriced(v) ? 'not priced yet (needs a quantity and a rate; use update_variation)' : null
      if (why) skipped.push(`${v ? voRef(v.number) : ref}: ${why}`); else vos.push(v!)
    }
    if (!lines.length && !vos.length) return text({ job: job.name, added: 'nothing', skipped })

    const at = Date.now()
    let open = openValuation(d.vals), started = false
    if (!open) {
      open = { id: crypto.randomUUID(), jobId: job.id, number: d.vals.reduce((m, v) => Math.max(m, v.number), 0) + 1, status: 'Open', createdAt: at, issuedAt: null, byClaude: at } satisfies Valuation
      await save(ctx, 'valuations', [open])
      d.vals.push(open); started = true
    }
    const sl = lines.map(i => ({ ...i, valuationId: open!.id, byClaude: at })), vl = vos.map(v => ({ ...v, valuationId: open!.id, byClaude: at }))
    await save(ctx, 'scope', sl)
    await save(ctx, 'variations', vl)
    d.scope = d.scope.map(i => sl.find(x => x.id === i.id) ?? i); d.vos = d.vos.map(v => vl.find(x => x.id === v.id) ?? v)
    return text({
      job: job.name, valuation: valRef(open.number) + (started ? ' (started now, as no valuation was open)' : ''),
      added: [...sl.map(lineWithValue), ...vl.map(voWithValue)],
      addedAtBaseRates: money(pennies([...sl, ...vl].reduce((t, x) => t + lineValue(x.qty, x.rate), 0))),
      ...(skipped.length ? { notAdded: skipped } : {}),
      openValuationNow: openNow(job, d), note: NOT_ISSUED,
    })
  })

  server.registerTool('remove_from_valuation', {
    title: 'Take lines out of the open valuation',
    description: 'Un-ticks scope lines and VOs from the job’s open valuation, so they go back to “to do”. Lines in an issued valuation are locked and can’t be taken out. Get the person’s yes first.',
    inputSchema: { job: z.string().describe(JOB_DESC), ...IDS },
    annotations: WRITE,
  }, async ({ job: q, scope_line_ids = [], vos: voQs = [] }) => {
    if (!ctx.money) throw new Error(NO_MONEY)
    if (!scope_line_ids.length && !voQs.length) throw new Error('Say which scope lines (scope_line_ids) or VOs (vos) to take out.')
    const { job, d } = await load(q)
    const picked = pick(d, scope_line_ids, voQs), skipped: string[] = []
    const why = (x: ScopeItem | Variation | undefined | null) => {
      const locked = x && lockedIn(x, d.vals)
      return !x ? 'not found on this job' : locked ? `certified in ${valRef(locked.number)}, so it’s locked` : !x.valuationId ? 'not in a valuation' : null
    }
    const lines = picked.lines.filter(({ q: id, i }) => { const w = why(i); if (w) skipped.push(`${i ? lineLabel(i) : id}: ${w}`); return !w }).map(x => x.i!)
    const vos = picked.vos.filter(({ q: ref, v }) => { const w = why(v); if (w) skipped.push(`${v ? voRef(v.number) : ref}: ${w}`); return !w }).map(x => x.v!)
    if (!lines.length && !vos.length) return text({ job: job.name, removed: 'nothing', skipped })
    const at = Date.now()
    const sl = lines.map(i => ({ ...i, valuationId: null, byClaude: at })), vl = vos.map(v => ({ ...v, valuationId: null, byClaude: at }))
    await save(ctx, 'scope', sl)
    await save(ctx, 'variations', vl)
    d.scope = d.scope.map(i => sl.find(x => x.id === i.id) ?? i); d.vos = d.vos.map(v => vl.find(x => x.id === v.id) ?? v)
    return text({ job: job.name, removed: [...lines.map(lineLabel), ...vos.map(v => `${voRef(v.number)} ${v.description}`)], ...(skipped.length ? { notRemoved: skipped } : {}), openValuationNow: openNow(job, d) })
  })

  server.registerTool('log_variation', {
    title: 'Log a new VO',
    description: 'Adds a variation to the job’s VO register with the next VO number, status Identified unless the client has already instructed it. Leave quantity and rate out unless the person, a document or the site said them: Mastor never guesses. To use a site photo as its evidence, pass its entryId from get_site_diary. The VO is marked “by Claude” in the app. Get the person’s yes first.',
    inputSchema: {
      job: z.string().describe(JOB_DESC),
      description: z.string().min(3).describe('What the extra work is'),
      where: z.string().optional().describe('Property / room, e.g. “No. 4 bathroom”'),
      reason: z.string().optional().describe('Why it’s needed, e.g. what was found on site'),
      qty: z.number().positive().optional().describe('Only if measured or stated, never estimated'),
      unit: z.string().optional().describe('Unit for the quantity, e.g. LM, SM, NO, IT'),
      rate: z.number().min(0).optional().describe('£ rate (office roles), only from a rate book, quote, the person, or a find_rate match'),
      code: z.string().optional().describe('SoR code the rate came from'),
      rate_from: z.string().optional().describe('Where the rate came from: the rateFrom of a find_rate match, e.g. the schedule’s name or “Windsor Road · VO II”'),
      client_ref: z.string().optional().describe('The client’s VO reference, if they’ve given one'),
      instructed: z.boolean().optional().describe('The client has already instructed it (status Instructed)'),
      evidence_entry_id: z.string().optional().describe('A site photo’s entryId from get_site_diary'),
    },
    annotations: WRITE,
  }, async (a) => {
    if (!ctx.money && (a.rate != null || a.code || a.rate_from)) throw new Error(NO_MONEY + ' Log it without a rate and the office will price it.')
    if (a.qty != null && !a.unit?.trim()) throw new Error('Give the unit for that quantity (e.g. LM, SM, NO).')
    const { job, d } = await load(a.job)
    const entry = a.evidence_entry_id ? d.diary.find(e => e.id === a.evidence_entry_id) : undefined
    if (a.evidence_entry_id && !entry) throw new Error(`No site capture with entryId ${a.evidence_entry_id} on this job.`)
    if (entry?.voId) throw new Error(`That capture is already the evidence for ${voRef(d.vos.find(v => v.id === entry.voId)?.number ?? 0)}.`)
    // the VO keeps its own copy of the photo, as in the app: deleting one never deletes the other's evidence
    const photo = entry?.type === 'photo' && entry.mediaId ? await copyMedia(ctx, entry.mediaId) : null
    const at = Date.now()
    const vo: Variation = {
      id: crypto.randomUUID(), jobId: job.id, number: d.vos.reduce((m, v) => Math.max(m, v.number), 0) + 1,
      description: a.description.trim(), room: (a.where ?? entry?.room ?? '').trim(), qty: a.qty ?? null, unit: a.unit?.trim() ?? '',
      rate: a.rate ?? null, code: a.code?.trim() ?? '', ...(a.rate_from?.trim() && a.rate != null ? { rateBook: a.rate_from.trim() } : {}), reason: a.reason?.trim() ?? '', clientRef: a.client_ref?.trim() ?? '',
      status: a.instructed ? 'Instructed' : 'Identified', photoIds: photo ? [photo] : [], dateRaised: at, valuationId: null, byClaude: at,
    }
    await save(ctx, 'variations', [vo])
    if (entry) await save(ctx, 'diary', [{ ...entry, voId: vo.id }])
    const same = d.vos.find(v => v.description.trim().toLowerCase() === vo.description.toLowerCase())
    return text({
      job: job.name, logged: `${voRef(vo.number)} ${vo.description}`, status: vo.status,
      qty: vo.qty != null ? `${qtyText(vo.qty)} ${vo.unit}` : 'not measured',
      ...(ctx.money ? { value: isPriced(vo) ? `${money(lineValue(vo.qty, vo.rate))} base` : 'unpriced, so it can’t be claimed until it has a quantity and rate' } : {}),
      evidence: entry ? (photo ? 'site photo attached' : entry.type === 'photo' ? 'linked to the capture; the photo couldn’t be copied, so attach it in the app' : `linked to the ${entry.type}`) : undefined,
      ...(same ? { check: `${voRef(same.number)} has the same description. If this is the same work, ask the person whether to keep both.` } : {}),
    })
  })

  server.registerTool('update_variation', {
    title: 'Update a VO',
    description: 'Changes a VO: price it (quantity, unit, rate, SoR code), add the client’s reference, mark it sent to the client, or move its status (Identified, Instructed, Complete, Rejected). A VO certified in an issued valuation is locked. A VO in the open valuation can’t be rejected or unpriced until it’s taken out. The VO is marked “by Claude” in the app. Get the person’s yes first.',
    inputSchema: {
      job: z.string().describe(JOB_DESC),
      vo: z.string().describe('VO reference (VO III) or id'),
      description: z.string().min(3).optional(), where: z.string().optional(), reason: z.string().optional(),
      qty: z.number().positive().nullable().optional().describe('null clears it (not measured)'),
      unit: z.string().optional(),
      rate: z.number().min(0).nullable().optional().describe('£ rate (office roles); null clears it (unpriced)'),
      code: z.string().optional().describe('SoR code (office roles)'),
      rate_from: z.string().optional().describe('Where the rate came from (a find_rate match’s rateFrom); shown beside the rate in the app'),
      client_ref: z.string().optional().describe('The client’s VO reference'),
      status: z.enum(['Identified', 'Instructed', 'Complete', 'Rejected']).optional(),
      sent_to_client: z.boolean().optional().describe('true: sent to the client today (from here it’s in their court); false: not sent'),
    },
    annotations: WRITE,
  }, async (a) => {
    if (!ctx.money && (a.rate !== undefined || a.code !== undefined || a.rate_from !== undefined)) throw new Error(NO_MONEY)
    const { job, d } = await load(a.job)
    const v = findVo(d.vos, a.vo)
    if (!v) throw new Error(`No ${a.vo} on ${job.name}. VOs: ${[...d.vos].sort((x, y) => x.number - y.number).map(x => voRef(x.number)).join(', ') || 'none yet'}.`)
    const locked = lockedIn(v, d.vals)
    if (locked) throw new Error(`${voRef(v.number)} is certified in ${valRef(locked.number)}, so it’s locked and can’t be changed.`)
    const next: Variation = {
      ...v,
      ...(a.description !== undefined ? { description: a.description.trim() } : {}), ...(a.where !== undefined ? { room: a.where.trim() } : {}),
      ...(a.reason !== undefined ? { reason: a.reason.trim() } : {}), ...(a.qty !== undefined ? { qty: a.qty } : {}),
      ...(a.unit !== undefined ? { unit: a.unit.trim() } : {}), ...(a.rate !== undefined ? { rate: a.rate, rateBook: a.rate_from?.trim() || undefined } : a.rate_from !== undefined ? { rateBook: a.rate_from.trim() || undefined } : {}),
      ...(a.code !== undefined ? { code: a.code.trim() } : {}), ...(a.client_ref !== undefined ? { clientRef: a.client_ref.trim() } : {}),
      ...(a.status ? { status: a.status } : {}), ...(a.sent_to_client !== undefined ? { submittedAt: a.sent_to_client ? (v.submittedAt ?? Date.now()) : null } : {}),
    }
    if (next.qty != null && !next.unit) throw new Error('Give the unit for that quantity (e.g. LM, SM, NO).')
    const inVal = v.valuationId ? d.vals.find(x => x.id === v.valuationId) : undefined
    if (inVal && next.status === 'Rejected') throw new Error(`${voRef(v.number)} is in ${valRef(inVal.number)}. Take it out first (remove_from_valuation), then reject it.`)
    if (inVal && !isPriced(next)) throw new Error(`${voRef(v.number)} is in ${valRef(inVal.number)}, so it needs a quantity and rate. Take it out first to clear them.`)
    const shown = (x: Variation) => ({
      description: x.description, where: x.room || '—', reason: x.reason || '—', qty: x.qty != null ? `${qtyText(x.qty)} ${x.unit}` : 'not measured',
      ...(ctx.money ? { rate: x.rate != null ? money(x.rate) : 'unpriced', code: x.code || '—' } : {}),
      clientRef: x.clientRef || 'none', status: x.status, sentToClient: day(x.submittedAt) ?? 'no',
    })
    const before = shown(v), after = shown(next)
    const changes = (Object.keys(after) as (keyof typeof after)[]).filter(k => before[k] !== after[k]).map(k => `${k}: ${before[k]} → ${after[k]}`)
    if (!changes.length) return text({ job: job.name, vo: voRef(v.number), changed: 'nothing, as it already says that' })
    await save(ctx, 'variations', [{ ...next, byClaude: Date.now() }])
    return text({
      job: job.name, vo: `${voRef(v.number)} ${next.description}`, changed: changes,
      ...(ctx.money && isPriced(next) ? { value: `${money(lineValue(next.qty, next.rate))} base` } : {}),
      ...(inVal ? { inValuation: valRef(inVal.number) } : {}),
    })
  })

  server.registerTool('add_note', {
    title: 'Add a note or decision',
    description: 'Adds to the job’s notes & decisions, the record of agreements, client requests, chasers and H&S matters (not the daily site diary). Write it as the person would, with who said or agreed what. It is marked “by Claude” in the app. Get the person’s yes first.',
    inputSchema: {
      job: z.string().describe(JOB_DESC),
      text: z.string().min(3),
      category: z.enum(NOTE_CATEGORIES as [string, ...string[]]).optional().describe('Client, Commercial (office only), Site (default), H&S or Other'),
      pinned: z.boolean().optional().describe('Pin it to the top of the job'),
    },
    annotations: WRITE,
  }, async ({ job: q, text: body, category = 'Site', pinned = false }) => {
    if (!ctx.money && category === 'Commercial') throw new Error(NO_MONEY)
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const at = Date.now()
    const note: DiaryEntry = {
      id: crypto.randomUUID(), jobId: job.id, date: ukToday(), type: 'note', note: body.trim(), labour: null, weather: '', mediaId: null, originalMediaId: null,
      room: '', voId: null, createdAt: at, category: category as DiaryEntry['category'], pinned, byClaude: at,
    }
    await save(ctx, 'diary', [note])
    return text({ job: job.name, added: { date: note.date, category, pinned, text: note.note } })
  })

  server.registerTool('update_site_day', {
    title: 'Fill in a day on site',
    description: 'Sets a day’s site diary: operatives on site, weather, and the day’s note (added to what’s there unless replace_note). Days ahead can’t be filled in. It is marked “by Claude” in the app. Get the person’s yes first.',
    inputSchema: {
      job: z.string().describe(JOB_DESC),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD (default today)'),
      labour: z.number().int().min(0).max(500).optional().describe('Operatives on site'),
      weather: z.string().optional(),
      note: z.string().optional(),
      replace_note: z.boolean().optional().describe('Replace the day’s note instead of adding to it'),
    },
    annotations: WRITE,
  }, async ({ job: q, date, labour, weather, note, replace_note }) => {
    const today = ukToday(), when = date ?? today
    if (when > today) throw new Error(`${when} hasn’t happened yet. The diary records days on site, so fill it in on the day.`)
    if (labour === undefined && weather === undefined && note === undefined) throw new Error('Say what to set: labour, weather or note.')
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const diary = await records<DiaryEntry>(ctx, 'diary', job.id)
    const id = `day:${job.id}:${when}`   // one record per job per day, as the app keys it (src/screens/Diary.tsx)
    const was = diary.find(e => e.id === id) ?? diary.find(e => e.type === 'day' && e.date === when) ?? { id, jobId: job.id, date: when, type: 'day' as const, note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: Date.now() }
    const added = note?.trim()
    const next: DiaryEntry = {
      ...was,
      ...(labour !== undefined ? { labour } : {}), ...(weather !== undefined ? { weather: weather.trim() } : {}),
      ...(added !== undefined ? { note: replace_note || !was.note ? added : `${was.note}\n${added}` } : {}),
      byClaude: Date.now(),
    }
    await save(ctx, 'diary', [next])
    return text({ job: job.name, date: when, labourOnSite: next.labour, weather: next.weather || undefined, note: next.note || undefined })
  })

  server.registerTool('invoice_figures', {
    title: 'What an invoice would be',
    description: 'For issued valuations: the invoice already raised, or, for one not invoiced yet, what its invoice would be (net, VAT, total at the company’s rate), the number the next invoice gets, and anything missing for a legal VAT invoice. This only reads. Creating an invoice gives it its number, so a person does that in the Mastor app.',
    inputSchema: { job: z.string().describe(JOB_DESC), valuation: z.string().optional().describe('VAL II, 2 or id (default: every issued valuation)') },
    annotations: READ,
  }, async ({ job: q, valuation }) => {
    if (!ctx.money) throw new Error(NO_MONEY)
    const { job, d } = await load(q)
    const s = await settings(ctx)
    const want = valuation?.trim().toUpperCase().replace(/^VAL[\s-]*/, '')
    const n = want ? (/^\d+$/.test(want) ? Number(want) : fromRoman(want)) : 0
    const vals = [...d.vals].sort((a, b) => a.number - b.number).filter(v => !valuation || v.id === valuation || v.number === n)
    if (valuation && !vals.length) throw new Error(`No ${valuation} on ${job.name}.`)
    const rate = s?.vatRate ?? 20
    const allVals = s ? await records<Valuation>(ctx, 'valuations') : []
    const missing = missingForInvoice(s ?? undefined)
    return text({
      job: job.name, po: job.poNumber || 'none, so the invoice will go out without a PO and may be rejected',
      ...(s ? { nextInvoiceNumber: allocateInvoiceNo(s, allVals).number } : {}),
      ...(missing.length ? { missingForAVatInvoice: missing } : {}),
      valuations: vals.map(v => {
        if (v.status === 'Open') return { ref: valRef(v.number), invoice: 'not issued yet, so it can’t be invoiced until a person issues it in the app' }
        if (v.invoiceNumber) { const a = invoiceAmounts(job, v, d.scope, d.vos); return { ref: valRef(v.number), invoice: v.invoiceNumber, date: day(v.invoiceDate), net: money(a.net), vat: `${money(a.vat)} (${a.rate}%)`, total: money(a.total) } }
        const a = invoiceAmounts(job, v, d.scope, d.vos, rate)
        return { ref: valRef(v.number), invoice: 'not invoiced yet', wouldBe: { net: money(a.net), vat: `${money(a.vat)} (${a.rate}%)`, total: money(a.total) } }
      }),
      note: 'Creating the invoice gives it its number and moves your sequence on. A person does that in the Mastor app (Vals → Create invoice).',
    })
  })
}
