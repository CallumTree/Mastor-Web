/**
 * The job's documents as the source of truth: the PO, the client's pack, the spec, the programme, RAMS,
 * certificates, drawings. Claude reads them as they were filed, never from memory. A PDF with a text layer
 * comes back as its text, page by page and line by line, so Claude can quote it by page. A scanned PDF
 * comes back as the PDF itself, so Claude reads the scan. Word and Excel files become text, photos stay
 * images. Purchase orders carry money, so an operative can't read them, as in the app.
 */
import type { JobDocument } from '../../src/lib/types'
import { ukDate } from '../../src/lib/format'
import { media, type Ctx } from './data'

export type DocContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType: string; blob: string } }

/** Kinds of document an operative can't read: they carry rates and values. */
export const MONEY_DOCS: JobDocument['kind'][] = ['Purchase order']

const MAX_CHARS = 60_000                    // a long pack is read a few pages at a time
const MAX_SCAN_BYTES = 12 * 1024 * 1024     // a scanned PDF handed over whole stays well inside one request
const IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** A document by its id or part of its name; several matches is an error that lists them, so Claude asks. */
export function findDoc(docs: JobDocument[], q: string): JobDocument {
  const exact = docs.find(d => d.id === q)
  if (exact) return exact
  const s = q.trim().toLowerCase()
  const hits = docs.filter(d => d.name.toLowerCase().includes(s) || d.kind.toLowerCase() === s)
  if (hits.length === 1) return hits[0]
  const list = docs.map(d => `${d.name} (${d.kind})`).join('; ') || 'none yet'
  if (!hits.length) throw new Error(`No document matches “${q}”. This job’s documents: ${list}.`)
  throw new Error(`“${q}” matches ${hits.length} documents — say which: ${hits.map(d => `${d.name} (${d.kind}, id ${d.id})`).join('; ')}.`)
}

/** "3", "2-5", "1,4-6" → page numbers within 1..n (empty = every page). */
export function pageList(spec: string | undefined, n: number): number[] {
  if (!spec?.trim()) return Array.from({ length: n }, (_, i) => i + 1)
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/)
    if (!m) throw new Error(`Pages “${spec}” — give pages like 3, 2-5 or 1,4-6.`)
    const a = Number(m[1]), b = Number(m[2] ?? m[1])
    for (let p = Math.max(1, Math.min(a, b)); p <= Math.min(n, Math.max(a, b)); p++) out.add(p)
  }
  if (!out.size) throw new Error(`This document has ${n} page${n === 1 ? '' : 's'}.`)
  return [...out].sort((x, y) => x - y)
}

type PdfItem = { str: string; transform: number[]; width: number }

/** A page's text in reading order: items grouped into lines by height, left to right, wide gaps kept. */
function pageText(items: PdfItem[]): string {
  const lines = new Map<number, PdfItem[]>()
  for (const it of items) {
    if (!it.str.trim()) continue
    const y = Math.round(it.transform[5] / 3) * 3
    const key = [...lines.keys()].find(k => Math.abs(k - y) <= 3) ?? y
    lines.set(key, [...(lines.get(key) ?? []), it])
  }
  return [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => {
    row.sort((a, b) => a.transform[4] - b.transform[4])
    let out = '', end = -Infinity
    for (const it of row) { out += (out ? (it.transform[4] - end > 12 ? '   ' : ' ') : '') + it.str.trim(); end = it.transform[4] + it.width }
    return out
  }).join('\n')
    // some councils' order PDFs map the pound sign to "»" in their font: put back what the page shows
    .replace(/»(?=\s?\d)/g, '£')
}

async function pdfPages(bytes: Buffer): Promise<string[]> {
  // pdf.js runs its worker in this process: load it by name, so the deploy carries it
  const g = globalThis as { pdfjsWorker?: unknown }
  // @ts-expect-error the worker ships without types
  g.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true })
  const doc = await task.promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) pages.push(pageText((await (await doc.getPage(i)).getTextContent()).items as PdfItem[]))
  await task.destroy()
  return pages
}

/** Pages to hand over: those asked for, or those with the words looked for, kept within the size limit. */
function choose(pages: string[], spec?: string, find?: string) {
  let picked = pageList(spec, pages.length)
  const words = find?.toLowerCase().split(/\s+/).filter(w => w.length > 1) ?? []
  if (words.length) picked = picked.filter(p => words.some(w => pages[p - 1].toLowerCase().includes(w)))
  const kept: number[] = []
  let size = 0
  for (const p of picked) { if (kept.length && size + pages[p - 1].length > MAX_CHARS) break; kept.push(p); size += pages[p - 1].length }
  return { kept, matched: picked.length, words }
}

export async function readDocument(ctx: Ctx, d: JobDocument, opts: { pages?: string; find?: string } = {}): Promise<DocContent[]> {
  if (!ctx.money && MONEY_DOCS.includes(d.kind)) throw new Error(`${d.name} is a purchase order, which carries money — your Mastor role doesn’t include it. Ask someone in the office.`)
  const head = `${d.name} (${d.kind}) · added ${ukDate(d.addedAt)}. This is the document as filed: quote it by name and page, and say so if Mastor’s own figures differ.`
  const f = await media(ctx, d.fileId)
  if (!f) return [{ type: 'text', text: `${head}\nNot uploaded from the phone yet (it syncs when the phone that added it has signal).` }]
  const type = (d.type || f.type || '').toLowerCase()
  const name = d.name.toLowerCase()

  if (type === 'application/pdf' || name.endsWith('.pdf') || f.bytes.subarray(0, 5).toString() === '%PDF-') {
    let pages: string[]
    try { pages = await pdfPages(f.bytes) } catch { throw new Error(`${d.name} couldn’t be opened as a PDF — it may be damaged or password-protected.`) }
    const textual = pages.join('').replace(/\s/g, '').length > 12 * pages.length   // a scan has (next to) no text layer
    if (!textual) {
      // a scan: hand over the PDF itself, so Claude reads it the way a person would
      if (f.bytes.length > MAX_SCAN_BYTES) return [{ type: 'text', text: `${head}\nA scanned PDF of ${pages.length} pages, too large to read in one go (${Math.round(f.bytes.length / 1e6)} MB). Ask the office for a smaller copy, or add the pages that matter as their own document.` }]
      return [{ type: 'text', text: `${head}\nA scanned PDF of ${pages.length} page${pages.length === 1 ? '' : 's'}, with no text layer: here is the PDF itself to read.` },
        { type: 'resource', resource: { uri: `mastor://documents/${d.id}`, mimeType: 'application/pdf', blob: f.bytes.toString('base64') } }]
    }
    const { kept, matched, words } = choose(pages, opts.pages, opts.find)
    if (!kept.length) return [{ type: 'text', text: `${head}\n${pages.length} pages. No page${opts.pages ? ` in ${opts.pages}` : ''} mentions ${words.join(' or ')}.` }]
    const more = matched > kept.length ? `\nShowing pages ${kept[0]}–${kept[kept.length - 1]} of the ${matched} asked for (the rest didn’t fit). Ask for pages from ${kept[kept.length - 1] + 1}.` : ''
    return [{ type: 'text', text: `${head}\n${pages.length} page${pages.length === 1 ? '' : 's'}${words.length ? `; pages mentioning ${words.join(' or ')}: ${kept.join(', ')}` : ''}.${more}\n\n${kept.map(p => `— page ${p} —\n${pages[p - 1]}`).join('\n\n')}` }]
  }

  if (IMAGES.includes(type) || /\.(jpe?g|png|gif|webp)$/.test(name)) {
    return [{ type: 'text', text: head }, { type: 'image', data: f.bytes.toString('base64'), mimeType: IMAGES.includes(type) ? type : 'image/jpeg' }]
  }

  if (type.includes('wordprocessingml') || name.endsWith('.docx')) {
    const mammoth = (await import('mammoth')).default
    const { value } = await mammoth.extractRawText({ buffer: f.bytes })
    const t = value.trim()
    return [{ type: 'text', text: `${head}\n\n${t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) + '\n\n[The rest is longer than can be read at once: ask about a part of it.]' : t}` }]
  }

  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv' || /\.(xlsx|xls|csv)$/.test(name)) {
    const X = await import('xlsx')
    const XLSX = (X as unknown as { default?: typeof X }).default ?? X
    const wb = XLSX.read(f.bytes, { type: 'buffer' })
    let t = wb.SheetNames.map(s => `— sheet ${s} —\n${XLSX.utils.sheet_to_csv(wb.Sheets[s], { blankrows: false })}`).join('\n\n')
    if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS) + '\n\n[The rest is longer than can be read at once: ask about a sheet or a part of it.]'
    return [{ type: 'text', text: `${head}\n\n${t}` }]
  }

  if (type.startsWith('text/') || /\.(txt|md)$/.test(name)) return [{ type: 'text', text: `${head}\n\n${f.bytes.toString('utf8').slice(0, MAX_CHARS)}` }]

  return [{ type: 'text', text: `${head}\nMastor can’t read this kind of file (${type || 'unknown type'}). Open it in the app, or add it as a PDF.` }]
}
