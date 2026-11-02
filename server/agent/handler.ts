/**
 * POST /api/agent — Clerk: Mastor's assistant, inside the app. The person types or speaks; Claude reads the
 * job through the same tools the Claude connector uses (server/mcp — the app's own figures, the person's
 * own sign-in and role, so an operative's assistant never sees money) and proposes changes with them.
 *
 * Nothing changes on the model's say-so. When Claude calls a tool that writes (tick lines into the open
 * valuation, log or update a VO, a note, the site day), the turn stops and the app shows the change as a
 * card. Only the person's "Do it" runs it (`decision: 'approve'`); Cancel answers Claude that nothing was
 * changed. Everything saved is marked "by Claude", as from the connector. Issuing valuations and invoices
 * is never possible here: no tool does it.
 *
 * Stateless: the app keeps the conversation and sends it back whole each time, append-only (Claude's
 * thinking blocks must come back unchanged). The answer streams as lines of JSON: `status` lines while
 * Claude reads, then one `done` line carrying the conversation and any changes waiting for a tap.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { signIn, type Ctx } from '../mcp/data'
import { mastorServer } from '../mcp/tools'
import { ukToday } from '../mcp/shared'
// @ts-expect-error plain JS module shared with the other /api functions
import { guard, anthropicKey, MAX_BODY_CHARS, CLERK_MODEL, CLERK_DOC_MODEL } from '../../api/_guard.js'

type Req = IncomingMessage & { body?: unknown }
type Res = ServerResponse & { status: (n: number) => Res; json: (b: unknown) => void }
type Msg = Anthropic.Beta.BetaMessageParam
type ToolUse = Anthropic.Beta.BetaToolUseBlock

/**
 * Which model answers. Everyday questions go to the fast, low-cost model: Mastor works out every figure
 * and Clerk only reads and quotes them. Once the conversation has opened a document (a purchase order,
 * the client's pack), the rest of it goes to the most capable model, which reads the low-cost model's
 * reasoning so far. Anything the low-cost model declines is tried once on the capable one.
 */
export const modelFor = (messages: Msg[]): string =>
  messages.some(m => m.role === 'assistant' && Array.isArray(m.content) && m.content.some(b => b.type === 'tool_use' && b.name === 'read_document'))
    ? CLERK_DOC_MODEL as string : CLERK_MODEL as string
const lowCost = (model: string) => /haiku/i.test(model)
export const config = { maxDuration: 300 }
const MAX_CALLS = 12                        // model calls in one request: plenty for read → read → propose

export interface AgentBody { messages: Msg[]; jobId?: string; decision?: 'approve' | 'cancel' }
export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'done'; messages: Msg[]; pending: { id: string; name: string; title: string; input: unknown }[] }
  | { type: 'checkpoint'; messages: Msg[] }
  | { type: 'error'; error: string; messages?: Msg[] }

const SYSTEM = (ctx: Ctx) => `You are Clerk, the assistant inside Mastor (named after a clerk of works), the app ${ctx.company || 'this company'} runs its building jobs on: scope (BoQ) lines by property, variations (VOs), valuations, the site diary and what is owed. You are talking to ${ctx.email} (${ctx.role}) on their phone, often on site.

How to work:
- Use the tools to read before you answer. Every figure must come from a tool: quote Mastor's figures exactly and never do your own sums.
- Refer to valuations and VOs by Roman numerals (VAL II, VO III), properties as "No. 6".
- You can change things for them: tick scope lines and VOs into the open valuation or take them out, log a VO, price or update a VO, add a note or decision, fill in the site day, set the job's PO details, add a to-do or key date to the job's line (and link a to-do to the date it leads up to), tick a to-do off. Call the tool when they ask for the change. Don't ask "shall I?" in chat: the app shows each change as a card with Do it and Cancel, and it runs only when they tap Do it. Just before the call, say in one or two short lines exactly what will change, with Mastor's figures (which lines, how many, the totals).
- Never invent a quantity, rate, SoR code or reference. If they didn't say it and no tool shows it, leave it out or ask.${ctx.money ? `
- Pricing: when they log or price a VO without giving a rate, look it up with find_rate first (the job's own schedule, and the same work priced on other properties and jobs; try a second wording if the first finds nothing). If one match is clearly the same work in the same unit, put its code and suggestedRate in the change with rate_from, and say in a line where it came from ("WR100 at £1,500.00, the wet room rate in Planned Maint v8, as used on No. 12"). If several fit, or a rateCheck shows different rates, list the two or three best and ask which. If nothing fits, log it unpriced and say so. Never adjust a rate or do sums on it.` : ''}
- The job's documents are the source of truth: the purchase order, the client's pack and spec, the programme, RAMS, certificates, drawings (get_job lists them). When a question turns on what one says, read it with read_document and quote it by its name and page; never answer from memory. If Mastor's own figures differ from a document (the PO number or value, the uplifts, a date), say so plainly and change nothing unless they ask.${ctx.money ? ` To check a job against its purchase order: read the order, then compare the PO number, the PO value (the order's total net: every lot with its uplifts, excluding VAT) and the uplifts in the order they compound (Uplift 1 first, e.g. annual BCIS; Uplift 2 second, e.g. the contractor uplift) with get_job. List what matches and what differs, quoting the order's page. If something differs, offer update_job with the figures exactly as printed and the document as source; if lots carry different uplifts, say so rather than picking one.` : ''}
- If a request is ambiguous (which job, which property, which lines), ask one short question instead of guessing.
- Sending a valuation to the client, marking it agreed or asked to change, and creating an invoice are never done here: a person does that in the app (Vals). Say so if asked.
- Valuations go in during the first week of each month (get_valuations has the valuation week: when the last was sent, when the next goes in). Asked "when's the next valuation?" or "when did the last one go?", answer from that.${ctx.money ? '' : '\n- They are an operative: Mastor gives them no money figures (rates, values, valuations, invoices), and money changes are refused. Help with the diary, notes, the site day and logging VOs without prices.'}
- If a tool says Cancel was tapped, accept it in a few words and don't try the change again unless asked.

Write for a builder on a phone: short, plain sentences, no headings, no tables, no emoji. Lists only when there are several items.`

/** The tools, as the connector serves them, in this process. */
async function connect(ctx: Ctx) {
  const server = mastorServer(ctx)
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a)
  const client = new Client({ name: 'mastor-ask', version: '1.0.0' })
  await client.connect(b)
  const { tools } = await client.listTools()
  return { client, tools, close: async () => { await client.close(); await server.close() } }
}

const isWrite = (t: { annotations?: { readOnlyHint?: boolean } }) => t.annotations?.readOnlyHint === false
/** What the phone shows while Clerk uses a tool. */
const DOING: Record<string, string> = {
  mastor_overview: 'Looking over your jobs', get_job: 'Reading the job', get_scope: 'Reading the scope', get_variations: 'Reading the VOs',
  get_valuations: 'Reading the valuations', find_rate: 'Looking up the rate', read_document: 'Reading the documents', get_site_diary: 'Reading the diary', view_site_media: 'Looking at the site photos and notes',
  invoice_figures: 'Working out the invoice figures',
}

/** An MCP tool result as Claude's tool_result content. */
export function asResult(id: string, r: { content?: unknown; isError?: unknown }): Anthropic.Beta.BetaToolResultBlockParam {
  const parts = (Array.isArray(r.content) ? r.content : []) as { type: string; text?: string; data?: string; mimeType?: string; resource?: { mimeType?: string; blob?: string; uri?: string } }[]
  const content: NonNullable<Anthropic.Beta.BetaToolResultBlockParam['content']> & unknown[] = parts.map(p =>
    p.type === 'text' ? { type: 'text' as const, text: p.text ?? '' }
    : p.type === 'image' && p.data ? { type: 'image' as const, source: { type: 'base64' as const, media_type: (p.mimeType ?? 'image/jpeg') as 'image/jpeg', data: p.data } }
    // a scanned document: Claude reads the PDF itself
    : p.type === 'resource' && p.resource?.mimeType === 'application/pdf' && p.resource.blob ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: p.resource.blob } }
    : { type: 'text' as const, text: JSON.stringify(p) })
  return { type: 'tool_result', tool_use_id: id, content: content.length ? content : [{ type: 'text', text: '(nothing)' }], ...(r.isError ? { is_error: true } : {}) }
}

/** The tool_use blocks of an assistant turn. */
const usesOf = (m: Msg | undefined): ToolUse[] => (m && m.role === 'assistant' && Array.isArray(m.content) ? m.content.filter((b): b is ToolUse => b.type === 'tool_use') : [])

/** Checks the conversation the app sends back: alternating turns, a user turn first, a sane size. */
export function checkBody(b: unknown): AgentBody | string {
  const body = b as AgentBody
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return 'Nothing to ask.'
  if (body.messages[0].role !== 'user') return 'The conversation must start with a question.'
  for (const m of body.messages) if (m.role !== 'user' && m.role !== 'assistant') return 'Unknown message in the conversation.'
  const last = body.messages[body.messages.length - 1]
  if (body.decision) {
    if (body.decision !== 'approve' && body.decision !== 'cancel') return 'Unknown decision.'
    if (!usesOf(last).length) return 'There is no change waiting for an answer.'
  } else if (last.role !== 'user') return 'Nothing to ask.'
  return body
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }) }
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const raw = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body as string) } catch { return null } })() : req.body
  const body = checkBody(raw)
  if (typeof body === 'string') return res.status(400).json({ error: body })
  if (JSON.stringify(body).length > MAX_BODY_CHARS) return res.status(413).json({ error: 'This conversation has got too long. Start a new one.' })
  const key = anthropicKey() as string
  if (!key) return res.status(503).json({ error: 'Clerk isn’t set up yet: the Anthropic key is missing in Vercel.' })

  const ctx = token ? await signIn(token).catch(() => null) : null
  if (!ctx) return res.status(401).json({ error: 'Sign in to Mastor to use Clerk.' })
  // a new question counts once against the company's daily AI limit; answering a card doesn't
  if (!body.decision && !(await guard(req, res, 'ask'))) return

  res.status(200)
  res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  const send = (e: AgentEvent) => { res.write(JSON.stringify(e) + '\n') }

  const messages: Msg[] = [...body.messages]
  // the first question carries who, where and when (kept in the conversation, so it never changes)
  if (messages.length === 1 && !body.decision) {
    const c = messages[0].content
    const ctxText = `<context>Today is ${ukToday()} (UK).${body.jobId ? ` They have the job with id "${body.jobId}" open in the app; "this job" means that one.` : ''}</context>`
    messages[0] = { role: 'user', content: [{ type: 'text', text: ctxText }, ...(typeof c === 'string' ? [{ type: 'text' as const, text: c }] : c ?? [])] }
  }

  const anthropic = new Anthropic({ apiKey: key })
  // what the question used, by model, as one line in the function log: real costs, not estimates
  const used: Record<string, { calls: number; input: number; cacheWrite: number; cacheRead: number; output: number }> = {}
  const tally = (model: string, u?: Anthropic.Beta.BetaUsage) => {
    const t = used[model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }
    t.calls++
    t.input += u?.input_tokens ?? 0; t.cacheWrite += u?.cache_creation_input_tokens ?? 0
    t.cacheRead += u?.cache_read_input_tokens ?? 0; t.output += u?.output_tokens ?? 0
  }
  let mcp: Awaited<ReturnType<typeof connect>> | null = null
  try {
    mcp = await connect(ctx)
    const byName = new Map(mcp.tools.map(t => [t.name, t]))
    const tools: Anthropic.Beta.BetaTool[] = mcp.tools.map(t => ({ name: t.name, description: t.description ?? t.title ?? t.name, input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema }))
    // the tools are the same for every firm and come first, so one cached copy serves every question
    if (tools.length) tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } }
    const ask = (model: string) => anthropic.beta.messages.create({
      model, max_tokens: 16000,
      // the capable model has Anthropic's own fallback for a declined request; the low-cost one has none
      ...(lowCost(model) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      // the low-cost model thinks harder for the same money: Clerk's rules (never invent a figure) come first
      output_config: { effort: lowCost(model) ? 'high' : 'medium' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM(ctx), tools, messages,
    })
    const run = async (u: ToolUse) => {
      send({ type: 'status', text: DOING[u.name] ?? (isWrite(byName.get(u.name) ?? {}) ? 'Saving the change' : 'Reading') })
      try { return asResult(u.id, await mcp!.client.callTool({ name: u.name, arguments: (u.input ?? {}) as Record<string, unknown> }) as { content?: unknown; isError?: unknown }) }
      catch (e) { return asResult(u.id, { content: [{ type: 'text', text: (e as Error).message }], isError: true }) }
    }

    // a card answered: run the turn's tools, the changes only on Do it
    if (body.decision) {
      const uses = usesOf(messages[messages.length - 1])
      const results = await Promise.all(uses.map(u => {
        const t = byName.get(u.name)
        if (t && isWrite(t) && body.decision !== 'approve') return asResult(u.id, { content: [{ type: 'text', text: 'They tapped Cancel. Nothing was changed.' }] })
        return run(u)
      }))
      messages.push({ role: 'user', content: results })
      // the change is saved: the phone keeps this even if what follows fails, so the card never comes back
      send({ type: 'checkpoint', messages })
    }

    for (let call = 0; call < MAX_CALLS; call++) {
      send({ type: 'status', text: call ? 'Thinking' : body.decision ? 'Carrying on' : 'Reading your question' })
      let model = modelFor(messages)
      let r = await ask(model)
      tally(model, r.usage)
      if (r.stop_reason === 'refusal' && model !== CLERK_DOC_MODEL) { model = CLERK_DOC_MODEL as string; r = await ask(model); tally(model, r.usage) }
      if (r.stop_reason === 'refusal') return send({ type: 'error', error: 'Clerk couldn’t help with that one. Try putting it another way.', messages })
      if (r.stop_reason === 'max_tokens') return send({ type: 'error', error: 'That answer ran too long. Try asking about less at once.', messages })
      messages.push({ role: 'assistant', content: r.content })
      const uses = r.content.filter((b): b is ToolUse => b.type === 'tool_use')
      if (r.stop_reason !== 'tool_use' || !uses.length) return send({ type: 'done', messages, pending: [] })

      const writes = uses.filter(u => { const t = byName.get(u.name); return t && isWrite(t) })
      if (writes.length) return send({ type: 'done', messages, pending: writes.map(u => ({ id: u.id, name: u.name, title: byName.get(u.name)?.title ?? u.name, input: u.input })) })
      messages.push({ role: 'user', content: await Promise.all(uses.map(run)) })
    }
    send({ type: 'error', error: 'That took too many steps. Try asking for one thing at a time.', messages })
  } catch (e) {
    const msg = e instanceof Anthropic.RateLimitError ? 'Clerk is busy right now. Try again in a minute.'
      : e instanceof Anthropic.AuthenticationError ? 'Clerk isn’t set up right: the Anthropic key in Vercel was refused.'
      : e instanceof Anthropic.APIError ? `Clerk couldn’t answer (${e.status ?? 'no connection'}). Try again.`
      : 'Clerk couldn’t answer. Check signal and try again.'
    // whatever ran before the failure (a saved change above all) stays in the phone's conversation
    send({ type: 'error', error: msg, ...(messages.length > body.messages.length || body.decision ? { messages } : {}) })
  } finally {
    if (Object.keys(used).length) console.info(JSON.stringify({ clerk: used }))
    await mcp?.close().catch(() => {})
    res.end()
  }
}
