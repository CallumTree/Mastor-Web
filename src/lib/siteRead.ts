/**
 * Site capture → the scope. A day's photos, videos, voice notes and notes go to /api/read-site:
 * Gemini transcribes the audio, Claude reads it all against the job's scope and live VOs and
 * suggests what's now complete, what's extra work (a VO) and what's worth a note. Every suggestion
 * waits for a person in Vals — nothing is claimed or raised on its own.
 *
 * The day is read on its own (see autoRead.ts), so every suggestion is checked hard here before
 * anyone sees it, and dropped — not just marked — when it fails:
 *  - a scope line must exist, still be unclaimed, and (on a scheme of several houses) be in the
 *    house the suggestion names; a "done" with no house on such a scheme is dropped;
 *  - "done" needs words: a photo alone can't show a line is finished, or which house it is;
 *  - anything said to be from the words must quote them exactly, or it's dropped.
 * What's left from a photo alone (extra work spotted, a site note) is kept, marked for a look.
 */
import type { DiaryEntry, ScopeItem, SiteSuggestion, Variation } from './types'
import { authHeader } from './supabase'
import { uid } from './db'

export const MAX_ITEMS = 12

/**
 * Captures on this day not yet read: photos, video, voice and the day's own written note. Filed notes (client,
 * commercial, H&S, and the site notes this reader itself saves) are records, not progress, and are never re-read.
 */
export function unread(entries: DiaryEntry[], date: string) {
  return entries.filter(e => e.date === date && !e.read && ((e.type === 'photo' || e.type === 'video' || e.type === 'voice') ? !!e.mediaId : e.type === 'day' && e.note.trim().length > 8))
}

/** A day is read once it has gone quiet (nothing new for this long), or once it's over. */
export const QUIET_MS = 45 * 60_000
/** Only the last week is read on its own: older captures were left unread on purpose before this, and stay so. */
export const AUTO_DAYS = 7

/** Job-days with captures ready to read, oldest first, each with its unread captures in the order they were made. */
export function dueToRead(entries: DiaryEntry[], today: string, now: number) {
  const from = new Date(`${today}T12:00:00`); from.setDate(from.getDate() - AUTO_DAYS)
  const earliest = from.toISOString().slice(0, 10)
  const keys = [...new Set(entries.filter(e => e.date && e.date >= earliest && e.date <= today).map(e => `${e.jobId}|${e.date}`))].sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]))
  return keys.flatMap(k => {
    const [jobId, date] = k.split('|')
    const items = unread(entries.filter(e => e.jobId === jobId), date).sort((a, b) => a.createdAt - b.createdAt)
    if (!items.length) return []
    const last = Math.max(...entries.filter(e => e.jobId === jobId && e.date === date).map(e => e.createdAt))
    return date < today || now - last >= QUIET_MS ? [{ jobId, date, items }] : []
  })
}

const lineText = (i: ScopeItem) => [i.property ? `No. ${i.property}` : '', i.room, i.workstream, `${i.code} ${i.description}`.trim(), i.qty != null ? `${i.qty} ${i.unit}` : 'qty not set'].filter(Boolean).join(' · ')

export interface ReadRequest {
  companyId: string
  items: { key: string; kind: DiaryEntry['type']; mediaId: string | null; note: string; room: string; date: string }[]
  lines: { key: string; text: string; claimed: boolean }[]
  vos: string[]
}
/** Short keys (M1, L1…) keep the request small and let the answer be checked against what was sent. */
export function buildRequest(companyId: string, items: DiaryEntry[], scope: ScopeItem[], vos: Variation[]) {
  const itemKey = new Map(items.map((e, i) => [`M${i + 1}`, e]))
  const lineKey = new Map(scope.map((s, i) => [`L${i + 1}`, s]))
  const req: ReadRequest = {
    companyId,
    items: [...itemKey].map(([key, e]) => ({ key, kind: e.type, mediaId: e.type === 'day' || e.type === 'note' ? null : e.mediaId, note: e.note, room: e.room, date: e.date })),
    lines: [...lineKey].map(([key, s]) => ({ key, text: lineText(s), claimed: !!s.valuationId })),
    vos: vos.filter(v => v.status !== 'Rejected').map(v => `VO ${v.number}: ${v.description}${v.room ? ` (${v.room})` : ''}`),
  }
  return { req, itemKey, lineKey }
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z0-9'.]+/g, ' ').trim()
const said = (quote: string, text: string) => { const q = norm(quote); return q.length >= 4 && norm(text).includes(q) }

export interface RawSuggestion { item: string; kind: string; lines?: string[]; text: string; property?: string; room?: string; qty?: number | null; unit?: string; code?: string; quote?: string; basis?: string }

/** A house number as written in a scope line or said on site: "No. 4", "4", "number 4a" → "4A". */
const house = (p: string) => p.replace(/^\s*(no\.?|number|house|plot|unit)\s*/i, '').trim().toUpperCase()

/** The answer, checked: suggestions grouped by the capture they came from. Anything that fails a check is dropped. */
export function verifySuggestions(raw: RawSuggestion[], transcripts: Record<string, string>, itemKey: Map<string, DiaryEntry>, lineKey: Map<string, ScopeItem>) {
  const out = new Map<string, SiteSuggestion[]>()
  const houses = new Set([...lineKey.values()].map(s => house(s.property ?? '')).filter(Boolean))
  for (const r of raw) {
    const e = itemKey.get(r.item); if (!e || !String(r.text ?? '').trim()) continue
    const kind = r.kind === 'complete' || r.kind === 'vo' || r.kind === 'note' ? r.kind : null; if (!kind) continue
    const words = [transcripts[r.item] ?? e.transcript ?? '', e.note].join('\n')
    const basis = r.basis === 'seen' || r.basis === 'both' ? r.basis : 'said'
    const quote = String(r.quote ?? '').trim()
    const verified = basis === 'seen' ? false : said(quote, words)
    if (basis !== 'seen' && !verified) continue                  // said to be from the words, but they weren't said
    const property = String(r.property ?? '')
    let lineIds: string[] = []
    if (kind === 'complete') {
      if (basis === 'seen') continue                             // a photo can't show a line is finished, or which house
      if (houses.size > 1 && !house(property)) continue          // a scheme of several houses: which one?
      lineIds = [...new Set((r.lines ?? []).map(k => lineKey.get(k))
        .filter((s): s is ScopeItem => !!s && !s.valuationId && (houses.size < 2 || house(s.property ?? '') === house(property))).map(s => s.id))]
      if (!lineIds.length) continue                              // nothing left to claim in that house
    }
    out.set(e.id, [...(out.get(e.id) ?? []), {
      id: uid(), kind, text: String(r.text).trim(), lineIds,
      property, room: String(r.room ?? ''), qty: typeof r.qty === 'number' ? r.qty : null, unit: String(r.unit ?? ''), code: String(r.code ?? ''),
      quote, basis, verified, state: 'open',
    }])
  }
  return out
}

/** `stop`: reading can't go on today (not set up, signed out, the day's AI reads used up) — don't keep asking. */
export interface ReadResult { updated: DiaryEntry[]; suggestions: number; error?: string; skipped: number; stop?: boolean }

/** Reads up to MAX_ITEMS captures; returns the diary entries with their transcripts and suggestions attached. */
export async function readSite(companyId: string, items: DiaryEntry[], scope: ScopeItem[], vos: Variation[]): Promise<ReadResult> {
  const batch = items.slice(0, MAX_ITEMS)
  const { req, itemKey, lineKey } = buildRequest(companyId, batch, scope, vos)
  let data: { transcripts?: Record<string, string>; suggestions?: RawSuggestion[]; failed?: Record<string, string>; error?: string } = {}
  try {
    const r = await fetch('/api/read-site', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(req) })
    try { data = await r.json() } catch { /* below */ }
    if (!r.ok || data.error) return { updated: [], suggestions: 0, skipped: 0, stop: [401, 403, 404, 429, 503].includes(r.status), error: data.error || (r.status === 404 ? 'Site reading isn’t deployed yet.' : `Couldn’t read the site captures (${r.status}).`) }
  } catch { return { updated: [], suggestions: 0, skipped: 0, error: 'Couldn’t reach the reader — check signal. The captures are safe; try again later.' } }
  const transcripts = data.transcripts ?? {}
  const found = verifySuggestions(data.suggestions ?? [], transcripts, itemKey, lineKey)
  const failed = data.failed ?? {}
  const updated = [...itemKey].filter(([k]) => !failed[k]).map(([k, e]) => ({ ...e, transcript: transcripts[k] ?? e.transcript, read: { at: Date.now(), suggestions: found.get(e.id) ?? [] } }))
  return { updated, suggestions: [...found.values()].reduce((t, s) => t + s.length, 0), skipped: items.length - batch.length + Object.keys(failed).length, error: Object.keys(failed).length ? Object.values(failed)[0] : undefined }
}

/** Every suggestion still waiting, newest capture first. */
export function openSuggestions(entries: DiaryEntry[]) {
  return entries.filter(e => e.read?.suggestions.some(s => s.state === 'open'))
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap(e => e.read!.suggestions.filter(s => s.state === 'open').map(s => ({ entry: e, s })))
}

/** The entry with one suggestion's state changed. */
export function decide(e: DiaryEntry, id: string, state: 'approved' | 'rejected'): DiaryEntry {
  return { ...e, read: { ...e.read!, suggestions: e.read!.suggestions.map(s => (s.id === id ? { ...s, state } : s)) } }
}

/** A VO from an approved suggestion: Identified, unpriced unless a quantity was actually said, with the capture as evidence. */
export function voFromSuggestion(s: SiteSuggestion, e: DiaryEntry, jobId: string, number: number): Variation {
  const where = [s.property ? `No. ${s.property}` : '', s.room].filter(Boolean).join(' · ')
  return {
    id: uid(), jobId, number, description: s.text, room: where, qty: s.qty, unit: s.unit, rate: null, code: s.code,
    reason: `From site ${e.date}${s.quote ? `: “${s.quote}”` : ' (photo)'}`, clientRef: '', status: 'Identified',
    photoIds: e.type === 'photo' && e.mediaId ? [e.mediaId] : [], dateRaised: Date.now(), valuationId: null,
  }
}
