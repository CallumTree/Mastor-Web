/**
 * Schedules of rates: read a framework SoR (Word, as the M3NHF schedules are issued) or a client's
 * additional-rates spreadsheet into rate books. Every rate is read exactly as printed — nothing is
 * estimated, and a line without a readable rate is left out and counted, never filled in.
 */
import type { RateBook, RateItem } from './types'

type Cell = string | number | null | undefined
const norm = (c: Cell) => String(c ?? '').replace(/\s+/g, ' ').trim()
const pence = (n: number) => Math.round(n * 100 + 1e-9) / 100
function money(c: Cell): number | null {
  if (typeof c === 'number') return isFinite(c) ? pence(c) : null
  const s = norm(c).replace(/[£,\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return pence(parseFloat(s))
}
/** SoR codes: 4–12 letters/digits with at least one digit (0171AD, 015003, RE191561, DIS0194, 8552AAV1T). */
const CODE = /^(?=.*\d)[0-9A-Z]{4,12}$/
const isCode = (s: string) => CODE.test(s)
const isHeadingCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase()

/** A book as read from a file, before it's saved. */
export interface RateDraft { name: string; source: string; notes: string[]; items: RateItem[]; skipped: number }

// ---------- Word schedules (M3NHF layout) ----------

/** Table rows from a .docx, read straight from word/document.xml (fast — no layout conversion). */
export async function docxRows(buf: ArrayBuffer): Promise<{ rows: string[][]; title: string[] }> {
  const X = await import('xlsx')
  const CFB = X.CFB ?? (X as unknown as { default: typeof X }).default.CFB
  const zip = CFB.read(new Uint8Array(buf), { type: 'array' })
  const i = zip.FullPaths.findIndex((p: string) => p.endsWith('word/document.xml'))
  if (i < 0) throw new Error('That isn’t a Word document Mastor can read.')
  return docxXmlRows(new TextDecoder().decode(zip.FileIndex[i].content as Uint8Array))
}

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const runText = (xml: string) => unxml((xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g) ?? []).map(t => (t === '<w:tab/>' ? ' ' : t.replace(/<[^>]+>/g, ''))).join(''))
const paraText = (xml: string) => (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

export function docxXmlRows(xml: string): { rows: string[][]; title: string[] } {
  const rows: string[][] = []
  for (const tr of xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
    rows.push((tr.match(/<w:tc>[\s\S]*?<\/w:tc>|<w:tc [\s\S]*?<\/w:tc>/g) ?? []).map(paraText))
  }
  // the cover: paragraphs before the first table ("M3NHF Schedule of Rates", "VERSION 8", "Planned Maintenance…")
  const head = xml.slice(0, Math.max(0, xml.indexOf('<w:tbl>')))
  const title = (head.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runText).map(norm).filter(Boolean).slice(0, 8)
  return { rows, title }
}

/**
 * Rate lines from schedule table rows. A rate row is [code, (priority,) short, unit, rate]; the row
 * under it carries the long description in the same column as the short one. Rows with only a
 * description are headings: CAPITALS = section, otherwise subsection.
 */
export function rowsToRates(rows: string[][], bookId: string): { items: RateItem[]; skipped: number } {
  const items: RateItem[] = []; const seen = new Set<string>()
  let section = '', subsection = '', prev: RateItem | null = null, skipped = 0
  for (const raw of rows) {
    const c = raw.map(norm)
    if (c.length < 4) { prev = null; continue }
    const n = c.length, code = c[0].toUpperCase()
    if (isCode(code) && c[n - 3]) {
      const rate = money(c[n - 1])
      if (rate === null) { skipped++; prev = null; continue }
      prev = null
      if (seen.has(code)) continue // a schedule's sample table repeats a line later — keep the first
      seen.add(code)
      const item: RateItem = { bookId, code, short: c[n - 3], long: '', unit: c[n - 2], rate, section, subsection }
      if (n >= 5 && /^[A-Z]{1,2}$/.test(c[1])) item.priority = c[1]
      items.push(item); prev = item
      continue
    }
    const text = c.slice(0, n - 2).filter(Boolean)
    if (!c[0] && text.length === 1 && !c[n - 2] && !c[n - 1]) {
      if (prev && !prev.long && !isHeadingCaps(text[0])) { prev.long = text[0]; prev = null; continue }
      if (isHeadingCaps(text[0])) { section = text[0]; subsection = '' } else subsection = text[0]
    }
    prev = null
  }
  return { items, skipped }
}

/** A sensible book name from the schedule's cover, falling back to the file name. */
export function bookName(title: string[], file: string): string {
  const version = title.find(t => /^version\s*\d+/i.test(t))
  const what = title.filter(t => !/schedule of rates|^version|^sor\b|descriptions?$/i.test(t)).slice(0, 2).join(' ')
  const desc = title.find(t => /(long|medium|short) descriptions?/i.test(t))?.match(/(long|medium|short)/i)?.[1]
  if (version && what) return `${what} ${version.replace(/version\s*/i, 'v')}${desc ? ` (${desc.toLowerCase()})` : ''}`
  return fileStem(file)
}
const fileStem = (f: string) => f.replace(/\.[^.]+$/, '').replace(/^CURRENT[\s_-]*/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

// ---------- spreadsheets (additional rates, one book per sheet) ----------

const pick = (head: string[], ...names: RegExp[]) => { for (const n of names) { const i = head.findIndex(h => n.test(h)); if (i >= 0) return i } return -1 }
const pickLast = (head: string[], n: RegExp) => { for (let i = head.length - 1; i >= 0; i--) if (n.test(head[i])) return i; return -1 }

export function sheetToRates(rows: Cell[][], bookId: string): { items: RateItem[]; skipped: number; notes: string[] } | null {
  const h = rows.findIndex(r => r.some(x => /^(sor code|document code|code|new rate)$/i.test(norm(x))))
  if (h < 0) return null
  const head = rows[h].map(x => norm(x).toLowerCase())
  const col = {
    code: pick(head, /^(sor code|document code|code|new rate)$/),
    rate: pick(head, /contractor price/, /sor .*framework/, /nett? cost/, /^rate$/, /price/, /cost/),
    long: pick(head, /long description/),
    short: pick(head, /short description/),
    desc: pickLast(head, /description/),
    unit: pick(head, /^(uom|unit|units|unit of measure)$/),
    section: pick(head, /^section$/), subsection: pick(head, /^subsection$/),
  }
  if (col.code < 0 || col.rate < 0) return null
  // notes: text printed above the header (conditions such as "install only") — not the sheet title
  const notes = rows.slice(1, h).map(r => r.map(norm).filter(Boolean).join(' ')).filter(Boolean)
  const items: RateItem[] = []; const seen = new Set<string>()
  let section = '', skipped = 0
  for (const r of rows.slice(h + 1)) {
    const code = norm(r[col.code]).toUpperCase()
    if (!isCode(code)) {
      const text = r.map(norm).filter(Boolean)
      if (text.length === 1 && isHeadingCaps(text[0]) && !money(text[0])) section = text[0]
      else if (text.length === 1 && !items.length) notes.push(text[0]) // e.g. "as of March 2026"
      continue
    }
    const rate = money(r[col.rate])
    if (rate === null) { skipped++; continue }
    if (seen.has(code)) continue
    seen.add(code)
    const other = r.map((x, i) => (i === col.code || i === col.rate ? '' : norm(x))).filter(x => x && money(x) === null)
    const short = norm(r[col.short >= 0 ? col.short : col.desc]) || other.join(' · ')
    const long = col.long >= 0 ? norm(r[col.long]) : ''
    items.push({ bookId, code, short, long: long !== short ? long : '', unit: col.unit >= 0 ? norm(r[col.unit]) || 'IT' : 'IT', rate,
      section: col.section >= 0 ? norm(r[col.section]) : section, subsection: col.subsection >= 0 ? norm(r[col.subsection]) : '' })
  }
  return { items, skipped, notes }
}

/** Read a rates file into one or more draft books (a workbook gives one book per sheet of rates). */
const fileBuffer = (f: File) => (typeof f.arrayBuffer === 'function' ? f.arrayBuffer()
  : new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = rej; r.readAsArrayBuffer(f) }))

export async function readRateFile(file: File, newId: () => string): Promise<RateDraft[]> {
  const buf = await fileBuffer(file)
  if (/\.docx$/i.test(file.name)) {
    const { rows, title } = await docxRows(buf)
    const id = newId()
    const { items, skipped } = rowsToRates(rows, id)
    return items.length ? [{ name: bookName(title, file.name), source: file.name, notes: [], items, skipped }] : []
  }
  if (/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'array' })
    const out: RateDraft[] = []
    for (const s of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[s], { header: 1, raw: true, defval: null })
      const id = newId()
      const r = sheetToRates(rows, id)
      if (r?.items.length) out.push({ name: wb.SheetNames.length > 1 ? `${s.trim()} — ${fileStem(file.name)}` : fileStem(file.name), source: `${file.name} · ${s}`, notes: r.notes, items: r.items, skipped: r.skipped })
    }
    return out
  }
  throw new Error('Choose a Word (.docx) schedule or an Excel/CSV rates sheet.')
}

/** True when every rate in `a` is already in `b` at the same price (e.g. the Medium edition of a Long schedule, or a trade extract). */
export function coveredBy(a: RateItem[], b: RateItem[]) {
  if (!a.length || a.length > b.length) return false
  const m = new Map(b.map(i => [i.code, i.rate]))
  return a.every(i => m.get(i.code) === i.rate)
}

/** Search: an exact code first, then codes starting with the query, then every word in the descriptions. */
export function searchRates(all: RateItem[], q: string, limit = 60): RateItem[] {
  const s = q.trim().toUpperCase()
  if (!s) return []
  const words = s.split(/\s+/).filter(Boolean)
  const exact: RateItem[] = [], starts: RateItem[] = [], text: RateItem[] = []
  for (const i of all) {
    if (i.code === s) exact.push(i)
    else if (words.length === 1 && i.code.startsWith(s)) starts.push(i)
    else {
      const hay = `${i.code} ${i.short} ${i.long} ${i.subsection}`.toUpperCase()
      if (words.every(w => hay.includes(w))) text.push(i)
    }
  }
  return [...exact, ...starts, ...text].slice(0, limit)
}

export const bookLabel = (b: Pick<RateBook, 'name'> | undefined) => b?.name ?? 'Unknown rate book'
