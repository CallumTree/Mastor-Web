/**
 * Site capture → the scope. A day's photos, videos, voice notes and notes go to /api/read-site:
 * Gemini transcribes the audio, Claude reads it all against the job's scope and live VOs and
 * suggests what's now complete, what's extra work (a VO) and what's worth a note. Every suggestion
 * waits for a person in Vals — nothing is claimed or raised on its own. Suggestions are checked
 * here first: the scope lines must exist and still be unclaimed, and a quote must be in what was
 * actually said or written.
 */
import type { DiaryEntry, ScopeItem, SiteSuggestion, Variation } from './types'
import { authHeader } from './supabase'
import { uid } from './db'

export const MAX_ITEMS = 12

/** Captures on this day not yet read (photos, video, voice, and the day's written note). */
export function unread(entries: DiaryEntry[], date: string) {
  return entries.filter(e => e.date === date && !e.read && ((e.type === 'photo' || e.type === 'video' || e.type === 'voice') ? !!e.mediaId : (e.type === 'day' || e.type === 'note') && e.note.trim().length > 8))
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

/** The answer, checked: suggestions grouped by the capture they came from. */
export function verifySuggestions(raw: RawSuggestion[], transcripts: Record<string, string>, itemKey: Map<string, DiaryEntry>, lineKey: Map<string, ScopeItem>) {
  const out = new Map<string, SiteSuggestion[]>()
  for (const r of raw) {
    const e = itemKey.get(r.item); if (!e || !String(r.text ?? '').trim()) continue
    const kind = r.kind === 'complete' || r.kind === 'vo' || r.kind === 'note' ? r.kind : null; if (!kind) continue
    const lineIds = kind === 'complete' ? [...new Set((r.lines ?? []).map(k => lineKey.get(k)).filter((s): s is ScopeItem => !!s && !s.valuationId).map(s => s.id))] : []
    if (kind === 'complete' && !lineIds.length) continue   // nothing left to claim
    const words = [transcripts[r.item] ?? e.transcript ?? '', e.note].join('\n')
    const basis = r.basis === 'seen' || r.basis === 'both' ? r.basis : 'said'
    const quote = String(r.quote ?? '').trim()
    out.set(e.id, [...(out.get(e.id) ?? []), {
      id: uid(), kind, text: String(r.text).trim(), lineIds,
      property: String(r.property ?? ''), room: String(r.room ?? ''), qty: typeof r.qty === 'number' ? r.qty : null, unit: String(r.unit ?? ''), code: String(r.code ?? ''),
      quote, basis, verified: basis === 'seen' ? false : said(quote, words), state: 'open',
    }])
  }
  return out
}

export interface ReadResult { updated: DiaryEntry[]; suggestions: number; error?: string; skipped: number }

/** Reads up to MAX_ITEMS captures; returns the diary entries with their transcripts and suggestions attached. */
export async function readSite(companyId: string, items: DiaryEntry[], scope: ScopeItem[], vos: Variation[]): Promise<ReadResult> {
  const batch = items.slice(0, MAX_ITEMS)
  const { req, itemKey, lineKey } = buildRequest(companyId, batch, scope, vos)
  let data: { transcripts?: Record<string, string>; suggestions?: RawSuggestion[]; failed?: Record<string, string>; error?: string } = {}
  try {
    const r = await fetch('/api/read-site', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(req) })
    try { data = await r.json() } catch { /* below */ }
    if (!r.ok || data.error) return { updated: [], suggestions: 0, skipped: 0, error: data.error || (r.status === 404 ? 'Site reading isn’t deployed yet.' : `Couldn’t read the site captures (${r.status}).`) }
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
