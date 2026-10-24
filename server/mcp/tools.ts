/**
 * What Claude can ask Mastor. Every figure comes from the app's own calculations (src/lib), so Claude
 * reports exactly what the screens show and never does its own sums. Phase 1 is read-only: nothing here
 * changes a job (a voice note's transcript is kept on its diary entry, as the app's own reader does).
 * Issuing valuations and invoices stays in the app with a person, always.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation, WorkOrder } from '../../src/lib/types'
import { money, qtyText, ukDate, voRef } from '../../src/lib/format'
import { issuePlan, lineValue, lockedIn, valRef, valTotals } from '../../src/lib/valuation'
import { valCourt, voCourt } from '../../src/lib/chase'
import { registerSummary } from '../../src/lib/voRegister'
import { portfolio } from '../../src/lib/portfolio'
import { jobAlerts } from '../../src/lib/alerts'
import { jobMargin } from '../../src/lib/margin'
import { findJob, jobData, records, settings, type Ctx } from './data'
import { siteMedia } from './media'

const text = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 1) }] })
const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
const NO_MONEY = 'Your Mastor role is operative, which doesn’t include money (rates, values, valuations, invoices). Ask someone in the office.'
const day = (t: number | null | undefined) => (t ? ukDate(t) : null)

const jobRef = (j: Job) => ({ id: j.id, name: j.name, client: j.client || null, ref: j.contractRef || null, address: j.address || null, status: j.status, kind: j.kind === 'orders' ? 'works orders' : 'scheme' })

export function mastorServer(ctx: Ctx) {
  const server = new McpServer(
    { name: 'mastor', title: 'Mastor', version: '1.0.0' },
    { instructions: `Mastor is ${ctx.company || 'the company'}’s master schedule: jobs, scope (BoQ) lines, variations (VOs), valuations, site diary (notes, photos, videos, voice notes) and what is owed. You are signed in as ${ctx.email} (${ctx.role}). Figures come from Mastor’s own calculations — quote them, don’t recalculate. Valuations and VOs are referred to by Roman numerals (VAL II, VO III). Issuing valuations and invoices is done in the Mastor app by a person, never here.${ctx.money ? '' : ' This person is an operative: Mastor gives them no money figures.'}` },
  )

  server.registerTool('mastor_overview', {
    title: 'Overview of every job',
    description: 'Start here. The company’s jobs with their key figures and what needs action on each, plus money owed and overdue across all jobs. Use the job id or name from here in the other tools.',
    inputSchema: { include_closed: z.boolean().optional().describe('Also list completed and on-hold jobs (default: active only)') },
    annotations: READ,
  }, async ({ include_closed }) => {
    const [jobs, scope, vos, vals, orders] = await Promise.all([
      records<Job>(ctx, 'jobs'), records<ScopeItem>(ctx, 'scope'), records<Variation>(ctx, 'variations'),
      records<Valuation>(ctx, 'valuations'), records<WorkOrder>(ctx, 'orders'),
    ])
    const shown = include_closed ? jobs : jobs.filter(j => j.status === 'Active')
    const p = ctx.money ? portfolio(shown, scope, vos, vals) : null
    return text({
      company: ctx.company, you: { email: ctx.email, role: ctx.role }, seesMoney: ctx.money,
      ...(p ? { money: { owedInclVat: money(p.owed), overdue: p.overdueCount ? `${money(p.overdue)} on ${p.overdueCount} valuation${p.overdueCount === 1 ? '' : 's'}` : 'none', readyToClaim: money(p.inValuation), certifiedThisYear: money(p.certifiedThisYear), paidThisYear: money(p.paidThisYear), unpricedVos: p.unpricedVos } } : {}),
      jobs: shown.map(j => {
        const js = scope.filter(i => i.jobId === j.id), jv = vos.filter(v => v.jobId === j.id), jvals = vals.filter(v => v.jobId === j.id)
        const f = p?.jobs.find(x => x.job.id === j.id)
        const { alerts } = jobAlerts(j, js, jv, jvals, orders.filter(o => o.jobId === j.id))
        return {
          ...jobRef(j),
          ...(f ? { figures: { contract: money(f.target), variations: money(f.variations), certified: money(f.certified), inOpenValuation: money(f.inValuation), stillToClaim: money(f.remaining) } } : {}),
          actionNeeded: alerts.filter(a => ctx.money || a.site).map(a => `${a.kind === 'stop' ? 'URGENT' : a.kind === 'do' ? 'NEXT' : 'TO DO'}: ${a.text} — ${a.hint}`),
        }
      }),
    })
  })

  server.registerTool('get_job', {
    title: 'One job in detail',
    description: 'A job’s details, figures, everything that needs action, the PO check, notes & decisions, and its documents.',
    inputSchema: { job: z.string().describe('Job id, or part of its name, contract ref or address') },
    annotations: READ,
  }, async ({ job: q }) => {
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const d = await jobData(ctx, job)
    const { alerts, poNote } = jobAlerts(job, d.scope, d.vos, d.vals, d.orders)
    const notes = d.diary.filter(e => e.type === 'note' && (ctx.money || e.category !== 'Commercial'))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt).slice(0, 40)
    const s = ctx.money ? await settings(ctx) : null
    const certified = d.vals.filter(v => v.status === 'Issued').reduce((t, v) => t + valTotals(job, v.id, d.scope, d.vos).gross, 0)
    const m = ctx.money ? jobMargin(job, d.scope, d.vos, d.costs, d.diary, s?.labourDayRate) : null
    return text({
      ...jobRef(job),
      ...(ctx.money ? {
        po: job.poNumber || 'none — invoices will be rejected without one', paymentTermsDays: job.paymentTermsDays || 30, uplifts: `${job.uplift1}% + ${job.uplift2}%`,
        figures: { contract: job.contractValue ? money(job.contractValue) : 'not set', certified: money(certified),
          margin: m && (m.costs || m.labourEstimate != null) ? `${money(m.margin)}${m.pct != null ? ` (${m.pct}%)` : ''}${m.provisional.length ? ' — provisional' : ''}` : 'no costs entered' },
        poCheck: poNote ?? null,
      } : {}),
      properties: job.properties ? Object.entries(job.properties).map(([no, addr]) => `No. ${no}: ${addr}`) : undefined,
      actionNeeded: alerts.filter(a => ctx.money || a.site).map(a => ({ level: a.kind === 'stop' ? 'urgent' : a.kind === 'do' ? 'next step' : 'to do', what: a.text, detail: a.hint })),
      counts: { scopeLines: d.scope.length, variations: d.vos.length, valuations: d.vals.length, diaryDays: new Set(d.diary.filter(e => e.type !== 'note').map(e => e.date)).size, siteCaptures: d.diary.filter(e => e.mediaId).length, workOrders: d.orders.length },
      notesAndDecisions: notes.map(n => ({ date: n.date, category: n.category ?? 'Site', pinned: !!n.pinned, text: n.note })),
      documents: d.docs.map(x => ({ name: x.name, kind: x.kind, added: day(x.addedAt) })),
    })
  })

  server.registerTool('get_scope', {
    title: 'Scope (BoQ) lines',
    description: 'The job’s scope lines with code, description, quantity and (for office roles) rate and value, and whether each is still to do, in the open valuation, or certified.',
    inputSchema: {
      job: z.string().describe('Job id, or part of its name, contract ref or address'),
      show: z.enum(['all', 'to_do', 'claimed']).optional().describe('Filter (default all)'),
      property: z.string().optional().describe('Multi-property schemes: only this house/unit number'),
      search: z.string().optional().describe('Only lines whose code, description, room or workstream contains this'),
    },
    annotations: READ,
  }, async ({ job: q, show = 'all', property, search }) => {
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const d = await jobData(ctx, job)
    const s = search?.toLowerCase()
    const lines = d.scope
      .filter(i => show === 'all' || (show === 'to_do' ? !i.valuationId : !!i.valuationId))
      .filter(i => !property || i.property === property)
      .filter(i => !s || [i.code, i.description, i.room, i.workstream].some(f => (f ?? '').toLowerCase().includes(s)))
      .sort((a, b) => (a.property ?? '').localeCompare(b.property ?? '', 'en', { numeric: true }) || a.order - b.order)
    const state = (i: typeof lines[number]) => {
      if (!i.valuationId) return 'to do'
      const v = d.vals.find(x => x.id === i.valuationId)
      return v ? `${v.status === 'Issued' ? 'certified in' : 'claimed in'} ${valRef(v.number)}` : 'claimed'
    }
    const base = d.scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
    const claimed = d.scope.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
    return text({
      job: job.name, showing: lines.length, ofTotal: d.scope.length,
      ...(ctx.money ? { totalsAtBaseRates: { scope: money(base), claimed: money(claimed), stillToDo: money(base - claimed) } } : {}),
      lines: lines.slice(0, 400).map(i => ({
        id: i.id, property: i.property || undefined, room: i.room, workstream: i.workstream || undefined, code: i.code || undefined, description: i.description,
        qty: i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'not stated',
        ...(ctx.money ? { rate: i.rate != null ? money(i.rate) : 'no rate', value: i.qty != null && i.rate != null ? money(lineValue(i.qty, i.rate)) : 'unpriced' } : {}),
        status: state(i), locked: !!lockedIn(i, d.vals) || undefined, contract: i.contract || undefined,
      })),
      ...(lines.length > 400 ? { note: `Only the first 400 of ${lines.length} are listed — narrow with property or search.` } : {}),
    })
  })

  server.registerTool('get_variations', {
    title: 'Variations (VOs)',
    description: 'The job’s VO register: each VO with description, where, quantity, price (office roles), client reference, status, and whose court it’s in (send / chase / claim).',
    inputSchema: { job: z.string().describe('Job id, or part of its name, contract ref or address') },
    annotations: READ,
  }, async ({ job: q }) => {
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const d = await jobData(ctx, job)
    const reg = ctx.money ? registerSummary(job, d.vos, d.vals) : null
    return text({
      job: job.name,
      ...(reg ? { register: { ...Object.fromEntries(reg.rows.map(r => [r.label, `${r.count} VO${r.count === 1 ? '' : 's'} · ${money(r.gross)} incl. uplifts${r.unpriced ? ` · ${r.unpriced} unpriced` : ''}`])), totalInclUplifts: money(reg.gross), overdueWithClient: reg.overdue } } : {}),
      variations: [...d.vos].sort((a, b) => a.number - b.number).map(v => {
        const c = voCourt(v, d.vals)
        const val = d.vals.find(x => x.id === v.valuationId)
        return {
          id: v.id, ref: voRef(v.number), description: v.description, where: v.room || undefined, reason: v.reason || undefined,
          qty: v.qty != null ? `${qtyText(v.qty)} ${v.unit}` : 'not measured',
          ...(ctx.money ? { code: v.code || undefined, rate: v.rate != null ? money(v.rate) : 'unpriced', value: v.qty != null && v.rate != null ? money(lineValue(v.qty, v.rate)) + ' base' : 'unpriced' } : {}),
          clientRef: v.clientRef || 'none yet', status: v.status, nextStep: c.text, raised: day(v.dateRaised), sentToClient: day(v.submittedAt),
          claimedIn: val ? valRef(val.number) : undefined, photos: v.photoIds.length || undefined, attachments: v.attachments?.map(a => a.name),
        }
      }),
    })
  })

  server.registerTool('get_valuations', {
    title: 'Valuations and payments',
    description: 'The job’s valuations: what each claims, issued / invoiced / paid, what is owed and when it is due; for the open valuation, what it would certify and the checks a client QS would query. (Issuing is done in the app, not here.)',
    inputSchema: { job: z.string().describe('Job id, or part of its name, contract ref or address') },
    annotations: READ,
  }, async ({ job: q }) => {
    if (!ctx.money) throw new Error(NO_MONEY)
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const d = await jobData(ctx, job)
    const vals = [...d.vals].sort((a, b) => a.number - b.number)
    return text({
      job: job.name,
      valuations: vals.map(v => {
        const t = valTotals(job, v.id, d.scope, d.vos)
        const base = { id: v.id, ref: valRef(v.number), status: v.status, lines: t.lines, baseRates: money(t.base), inclUplifts: money(t.gross) }
        if (v.status === 'Open') {
          const plan = issuePlan(job, v, d.vals, d.scope, d.vos)
          return { ...base, started: day(v.createdAt),
            wouldCertify: { thisValuation: money(plan.totals.gross), uplifts: `${money(plan.u1)} + ${money(plan.u2)}`, previouslyCertified: money(plan.previous), cumulative: money(plan.cumulative), ofContract: plan.pct != null ? `${plan.pct}%` : null },
            byGroup: plan.groups.map(g => `${g.name}: ${g.lines} line${g.lines === 1 ? '' : 's'}, ${money(g.base)} base`),
            checksBeforeIssue: plan.checks.map(c => `${c.kind === 'warn' ? 'CHECK' : 'OK'}: ${c.text}`),
            note: 'Issuing is done in the Mastor app by a person.' }
        }
        const c = valCourt(v, job, d.scope, d.vos)
        return { ...base, issued: day(v.issuedAt), invoice: v.invoiceNumber ? `${v.invoiceNumber} (${day(v.invoiceDate)})` : 'not invoiced yet',
          paid: v.paidAt ? `${money(v.paidAmount ?? 0)} on ${day(v.paidAt)}` : 'not yet', owed: money(c.owed), position: c.text }
      }),
    })
  })

  server.registerTool('get_site_diary', {
    title: 'Site diary',
    description: 'Day by day on site: weather, labour, the day’s note, and every photo, video and voice note (with its transcript once read). Use view_site_media to look at photos or hear what a voice note or video says.',
    inputSchema: {
      job: z.string().describe('Job id, or part of its name, contract ref or address'),
      from: z.string().optional().describe('First day, YYYY-MM-DD (default 14 days ago)'),
      to: z.string().optional().describe('Last day, YYYY-MM-DD (default today)'),
    },
    annotations: READ,
  }, async ({ job: q, from, to }) => {
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const d = await jobData(ctx, job)
    const today = new Date().toISOString().slice(0, 10)
    const start = from ?? new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10), end = to ?? today
    const entries = d.diary.filter(e => e.type !== 'note' && e.date >= start && e.date <= end)
    const days = [...new Set(entries.map(e => e.date))].sort().reverse()
    const capture = (e: DiaryEntry) => ({
      entryId: e.id, type: e.type, caption: e.note || undefined, room: e.room || undefined, markedUp: !!e.originalMediaId || undefined,
      transcript: e.transcript || (e.type === 'voice' || e.type === 'video' ? 'not read yet — use view_site_media' : undefined),
      raisedVo: e.voId ? voRef(d.vos.find(v => v.id === e.voId)?.number ?? 0) : undefined,
      suggestionsWaiting: e.read?.suggestions.filter(s => s.state === 'open').map(s => `${s.kind}: ${s.text}`),
    })
    return text({
      job: job.name, from: start, to: end,
      days: days.map(date => {
        const dayRow = entries.find(e => e.date === date && e.type === 'day')
        return { date, weather: dayRow?.weather || undefined, labourOnSite: dayRow?.labour ?? undefined, note: dayRow?.note || undefined,
          captures: entries.filter(e => e.date === date && e.type !== 'day').sort((a, b) => a.createdAt - b.createdAt).map(capture) }
      }),
    })
  })

  server.registerTool('view_site_media', {
    title: 'Look at site photos, hear voice notes and videos',
    description: 'Shows site photos so you can look at them, and gives what is said in voice notes and videos (plus what a video shows), transcribing any not read yet. Pass the entryId values from get_site_diary (up to 8 at a time). Each new voice note or video counts as one AI read against the company’s daily limit.',
    inputSchema: {
      job: z.string().describe('Job id, or part of its name, contract ref or address'),
      entry_ids: z.array(z.string()).min(1).max(8).describe('entryId values from get_site_diary'),
    },
    annotations: READ,
  }, async ({ job: q, entry_ids }) => {
    const job = findJob(await records<Job>(ctx, 'jobs'), q)
    const diary = await records<DiaryEntry>(ctx, 'diary', job.id)
    return { content: await siteMedia(ctx, diary, entry_ids) }
  })

  return server
}
