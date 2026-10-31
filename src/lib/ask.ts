/**
 * Ask, on the phone: the conversation with Mastor's assistant for one job, kept on the device and sent
 * whole to /api/agent each time (it's append-only: what the server sends back is stored exactly, so
 * Claude's thinking stays valid). The phone syncs before each question, so Ask reads what's on screen,
 * and after each answer, so a change made with Do it shows at once, marked "by Claude".
 */
import type Anthropic from '@anthropic-ai/sdk'
import { meta } from './db'
import { authHeader } from './supabase'
import { settle, syncNow } from './sync'

export type Msg = Anthropic.Beta.BetaMessageParam
export type Pending = { id: string; name: string; title: string; input: Record<string, unknown> }
export type Convo = { messages: Msg[]; pending: Pending[] }
type Event = { type: 'status'; text: string } | { type: 'checkpoint'; messages: Msg[] } | { type: 'done'; messages: Msg[]; pending: Pending[] } | { type: 'error'; error: string; messages?: Msg[] }

const KEY = (jobId: string) => `ask:${jobId}`
export const EMPTY: Convo = { messages: [], pending: [] }
export const loadConvo = async (jobId: string) => (await meta.get<Convo>(KEY(jobId))) ?? EMPTY
export const saveConvo = (jobId: string, c: Convo) => meta.set(KEY(jobId), c)
/** Past this the conversation is too big to send (Vercel takes 4.5MB); the screen offers a fresh one. */
export const TOO_LONG = 3_500_000
export const convoSize = (c: Convo) => JSON.stringify(c.messages).length

/** Sends a question or a card's answer; `onStatus` hears what Ask is reading while it works. */
export async function askMastor(jobId: string, c: Convo, step: { text: string } | { decision: 'approve' | 'cancel' }, onStatus: (s: string) => void): Promise<Convo> {
  await syncNow().catch(() => {})   // send this phone's changes first, so Ask sees what's on screen
  const messages = 'text' in step ? [...c.messages, { role: 'user' as const, content: step.text }] : c.messages
  let r: Response
  try {
    r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ messages, jobId, ...('decision' in step ? { decision: step.decision } : {}) }) })
  } catch { throw new Error('No connection. Ask needs signal: try again when you have some.') }
  if (!r.ok || !r.body) {
    const e = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(e.error || `Ask couldn’t answer (${r.status}).`)
  }
  const reader = r.body.getReader(), dec = new TextDecoder()
  // `saved`: the change on the card ran (the server says so before Claude replies), so even if the reply
  // fails or the signal drops, the phone keeps it and the card never comes back to be tapped twice
  let buf = '', out: Convo | null = null, saved: Convo | null = null, err: string | null = null
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (value) buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        const e = JSON.parse(line) as Event
        if (e.type === 'status') onStatus(e.text)
        else if (e.type === 'checkpoint') saved = { messages: e.messages, pending: [] }
        else if (e.type === 'done') out = { messages: e.messages, pending: e.pending as Pending[] }
        else { err = e.error; if (e.messages) out = { messages: e.messages, pending: [] } }
      }
      if (done) break
    }
  } catch { err = err ?? 'The connection dropped before Ask finished.' }
  await settle().catch(() => {})    // bring any change Ask made onto this phone, waiting for a sync already running
  if (!out && !err) err = 'Ask’s answer was cut off. Try again.'
  if (err) {
    const keep = out ?? saved
    const done = 'decision' in step && step.decision === 'approve' && saved
    throw Object.assign(new Error(done ? `Your change was saved. ${err.replace(/ Try again\.?$/, '')}` : err), { convo: keep })
  }
  return out!
}

// ---------- reading the conversation back for the screen ----------
const WRITES = new Set(['add_to_valuation', 'remove_from_valuation', 'log_variation', 'update_variation', 'add_note', 'update_site_day'])
export type Line =
  | { kind: 'you'; text: string }
  | { kind: 'ask'; text: string }
  | { kind: 'change'; title: string; detail: string[]; outcome: 'done' | 'cancelled' | 'failed'; note?: string }

const TITLES: Record<string, string> = {
  add_to_valuation: 'Tick lines into the open valuation', remove_from_valuation: 'Take lines out of the open valuation',
  log_variation: 'Log a new VO', update_variation: 'Update a VO', add_note: 'Add a note or decision', update_site_day: 'Fill in a day on site',
}
const LABELS: Record<string, string> = {
  vo: 'VO', description: 'What', where: 'Where', qty: 'Quantity', unit: 'Unit', rate: 'Rate', code: 'SoR code', reason: 'Why', client_ref: 'Client ref',
  status: 'Status', instructed: 'Instructed', sent_to_client: 'Sent to client', text: 'Note', note: 'Note', category: 'Category', pinned: 'Pinned',
  date: 'Day', weather: 'Weather', labour: 'On site', valuation: 'Valuation', evidence_entry_id: 'Photo', replace_note: 'Replace note',
}
/** What a change will do, in a few plain lines (Claude says it with Mastor's figures just above the card). */
export function changeDetail(input: Record<string, unknown>): string[] {
  const out: string[] = []
  const lines = input.scope_line_ids as unknown[] | undefined, vos = input.vos as unknown[] | undefined
  if (lines?.length) out.push(`${lines.length} scope line${lines.length === 1 ? '' : 's'}`)
  if (vos?.length) out.push(`VOs: ${vos.join(', ')}`)
  for (const [k, v] of Object.entries(input)) {
    if (k === 'job' || k === 'scope_line_ids' || k === 'vos' || v == null || v === '') continue
    const val = typeof v === 'boolean' ? (v ? 'yes' : 'no') : k === 'rate' && typeof v === 'number' ? `£${v.toFixed(2)}` : k === 'labour' ? `${v} people` : String(v)
    out.push(`${LABELS[k] ?? k}: ${val}`)
  }
  return out
}
export const changeTitle = (name: string) => TITLES[name] ?? name

const blocks = (m: Msg) => (typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : m.content ?? [])

/** The conversation as the screen shows it: what was said, and each change with how it went. */
export function lines(c: Convo): Line[] {
  const out: Line[] = []
  const results = new Map<string, { text: string; error: boolean }>()
  for (const m of c.messages) if (m.role === 'user') for (const b of blocks(m)) if (b.type === 'tool_result') {
    const t = Array.isArray(b.content) ? b.content.map(x => (x.type === 'text' ? x.text : '')).join(' ') : String(b.content ?? '')
    results.set(b.tool_use_id, { text: t, error: !!b.is_error })
  }
  for (const m of c.messages) for (const b of blocks(m)) {
    if (b.type === 'text' && b.text.trim() && !b.text.startsWith('<context>')) out.push({ kind: m.role === 'user' ? 'you' : 'ask', text: b.text.trim() })
    if (b.type === 'tool_use' && WRITES.has(b.name)) {
      const r = results.get(b.id)
      if (!r) continue   // waiting: shown as the card
      const outcome = /tapped Cancel/.test(r.text) ? 'cancelled' : r.error ? 'failed' : 'done'
      let note = outcome === 'failed' ? r.text : undefined
      if (outcome === 'done') try { const o = JSON.parse(r.text) as { logged?: unknown; job?: unknown }; if (typeof o.logged === 'string') note = `${o.logged} · in the VOs tab${typeof o.job === 'string' ? ` on ${o.job}` : ''}` } catch { /* not JSON: nothing to add */ }
      out.push({ kind: 'change', title: changeTitle(b.name), detail: changeDetail(b.input as Record<string, unknown>), outcome, ...(note ? { note } : {}) })
    }
  }
  return out
}
