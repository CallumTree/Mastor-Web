/**
 * What the rest of the client's pack says: the PCI, risk register and surveys are read by the AI for
 * site facts (dates, contacts, access, hazards) and for work they call for that isn't in the scope.
 * Every item must quote the document it came from; the quote is checked against the document's own
 * text here, on the device. An item whose quote can't be found is shown unticked and marked — it is
 * never saved without a person ticking it.
 */
import { authHeader } from './supabase'
import { docxEvents, docxXml } from './worksOrder'
import { pdfPages } from './pdfTable'
import type { NoteCategory } from './types'

export interface PackDoc { name: string; text: string }
export interface Source { document: string; page: number | null; quote: string }
export interface PackFact extends Source { category: NoteCategory; text: string; properties: string[]; verified: boolean; include: boolean }
export interface PackExtra extends Source { text: string; why: string; properties: string[]; verified: boolean; include: boolean }
export interface PackFacts { facts: PackFact[]; extras: PackExtra[]; read: string[]; cut: string[]; error?: string }

const readAsBuffer = (f: Blob) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f) })
const readAsText = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })

/** The words of a document, page-marked for PDFs so the AI can cite a page. Null when it can't be read. */
export async function docText(file: File): Promise<string | null> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const pages = await pdfPages(new Uint8Array(await readAsBuffer(file)), pdfjs as never)
    return pdfText(pages)
  }
  if (name.endsWith('.docx')) {
    const ev = docxEvents(await docxXml(await readAsBuffer(file)))
    return ev.map(e => (e.k === 'p' ? e.text : e.cells.filter(Boolean).join(' | '))).filter(Boolean).join('\n')
  }
  if (/\.(txt|md|csv)$/.test(name)) return readAsText(file)
  return null
}

/** Positioned PDF text back into lines, with a [page N] marker before each page. */
export function pdfText(pages: { items: { x: number; y: number; s: string }[] }[]) {
  return pages.map((p, i) => {
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const t of p.items) { const k = Math.round(t.y / 3); rows.set(k, [...(rows.get(k) ?? []), t]) }
    const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(t => t.s).join(' '))
    return `[page ${i + 1}]\n${lines.join('\n')}`
  }).join('\n\n')
}

/** Loose match for a quote: case, spacing, quote marks and dashes don't count. */
const norm = (s: string) => s.toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^a-z0-9'"%£.\-]+/g, ' ').trim()
export function quoteFound(quote: string, doc: string | undefined) {
  if (!doc || !quote.trim()) return false
  const q = norm(quote)
  return q.length >= 6 && norm(doc).includes(q)
}

const CATS: NoteCategory[] = ['Client', 'Site', 'H&S', 'Commercial', 'Other']

/** Check the AI's answer against the documents: every item keeps its quote, and only found quotes come ticked. */
export function verify(raw: { facts?: unknown[]; extras?: unknown[] }, docs: PackDoc[]): Pick<PackFacts, 'facts' | 'extras'> {
  const byName = new Map(docs.map(d => [d.name, d.text]))
  const src = (o: Record<string, unknown>) => {
    const document = String(o.document ?? '')
    const quote = String(o.quote ?? '').trim()
    const page = typeof o.page === 'number' ? o.page : null
    const props = Array.isArray(o.properties) ? o.properties.map(String).filter(Boolean) : []
    return { document, quote, page, properties: props, verified: quoteFound(quote, byName.get(document)) }
  }
  const facts = (raw.facts ?? []).map(x => x as Record<string, unknown>).filter(o => String(o.text ?? '').trim()).map(o => {
    const s = src(o)
    const category = CATS.includes(o.category as NoteCategory) ? (o.category as NoteCategory) : 'Other'
    return { ...s, category, text: String(o.text).trim(), include: s.verified }
  })
  const extras = (raw.extras ?? []).map(x => x as Record<string, unknown>).filter(o => String(o.text ?? '').trim()).map(o => {
    const s = src(o)
    return { ...s, text: String(o.text).trim(), why: String(o.why ?? '').trim(), include: s.verified }
  })
  return { facts, extras }
}

/** Sends the documents (and a short list of what's already in scope) to /api/read-pack. Never throws: a failure comes back as `error`. */
export async function readPackFacts(docs: PackDoc[], scope: string): Promise<PackFacts> {
  const empty = { facts: [], extras: [], read: docs.map(d => d.name), cut: [] as string[] }
  if (!docs.length) return empty
  try {
    const r = await fetch('/api/read-pack', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ docs, scope }) })
    let data: { facts?: unknown[]; extras?: unknown[]; cut?: string[]; error?: string } = {}
    try { data = await r.json() } catch { /* handled below */ }
    if (!r.ok || data.error) return { ...empty, error: data.error || (r.status === 404 ? 'The document reader isn’t deployed yet.' : `Couldn’t read the documents (${r.status}).`) }
    return { ...verify(data, docs), read: docs.map(d => d.name), cut: data.cut ?? [] }
  } catch {
    return { ...empty, error: 'Couldn’t reach the document reader. Check signal — the schedules above are unaffected.' }
  }
}

/** The scope in a few words per code, so the AI can tell what's already priced. */
export function scopeSummary(lines: { code: string; description: string; property: string; include: boolean }[]) {
  const by = new Map<string, { d: string; p: Set<string> }>()
  for (const l of lines) {
    if (!l.include) continue
    const k = l.code || l.description.slice(0, 40)
    const e = by.get(k) ?? { d: l.description.slice(0, 70), p: new Set<string>() }
    if (l.property) e.p.add(l.property)
    by.set(k, e)
  }
  return [...by.entries()].map(([c, e]) => `${c} ${e.d}${e.p.size ? ` (nos. ${[...e.p].join(', ')})` : ''}`).join('\n')
}
