/**
 * Reading council variation instructions, whatever form they arrive in:
 *  - Excel / CSV  → read directly (free)
 *  - scans, photos, screenshots, handwritten tickets, messy PDFs → AI (pennies)
 * Then matched to a job (by PO / address) and to any VO you'd already raised.
 */
import type { Job, Variation } from './types'
import type { ParsedLine } from './boq'
import { readSchedule } from './sheet'

export interface ParsedVo {
  ref: string                 // council's VO / instruction number, e.g. "11284" or "VO 5"
  date: number | null
  issuedBy: string            // officer / AMO
  address: string
  poNumber: string            // "please vary order no." — the PO it belongs to
  description: string         // headline, e.g. "Scaffolding"
  lines: ParsedLine[]
  method: 'spreadsheet' | 'ai'
}

type Cell = string | number | Date | null | undefined
const txt = (c: Cell) => (c instanceof Date ? '' : String(c ?? '').replace(/\s+/g, ' ').trim())
const excelDate = (c: Cell): number | null => {
  if (c instanceof Date) return c.getTime()
  if (typeof c === 'number' && c > 20000 && c < 80000) return Math.round((c - 25569) * 86400000)   // Excel serial
  const m = txt(c).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1], 12).getTime() }
  return null
}

/** Spreadsheet VO: a "Label: value" header block above a schedule table. */
export function readVoSheet(rows: Cell[][]): ParsedVo | null {
  const table = readSchedule(rows as (string | number | null)[][])
  if (!table || !table.lines.length) return null
  const kv = new Map<string, Cell>()
  for (const r of rows.slice(0, 25)) {
    const k = txt(r[0]).replace(/:$/, '').toLowerCase()
    if (k && r.length > 1 && r[1] != null && txt(r[1]) !== '' || (k && r[1] instanceof Date)) kv.set(k, r[1])
  }
  const get = (...keys: string[]) => { for (const k of keys) for (const [kk, v] of kv) if (kk.startsWith(k)) return v; return null }
  const title = txt(rows.find(r => txt(r[0]))?.[0])
  const description = txt(get('description'))
  const ref = (title.match(/\bVO\s*\d+/i) ?? description.match(/\bVO\s*\d+/i) ?? [''])[0].replace(/\s+/, ' ').toUpperCase()
  // lines sitting under an address sub-heading row are fine; drop rows that are just the address
  const lines = table.lines.filter(l => l.code || l.rate != null)
  return {
    ref, date: excelDate(get('date')), issuedBy: txt(get('officer', 'issued by', 'amo')), address: txt(get('address', 'property')),
    poNumber: txt(get('job no', 'order no', 'po', 'purchase order')), description: description.replace(/\bVO\s*\d+\s*[-–:]\s*/i, ''), lines, method: 'spreadsheet',
  }
}

/** The AI's reply for a scan/photo/PDF instruction (JSON). Missing values stay missing. */
export function parseVoReply(text: string): ParsedVo | null {
  const j = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  let o: Record<string, unknown>
  try { o = JSON.parse(j) } catch { return null }
  const s = (k: string) => String(o[k] ?? '').trim()
  const n = (v: unknown) => (typeof v === 'number' ? v : v == null || v === '' ? null : parseFloat(String(v).replace(/[£,\s]/g, '')))
  const lines: ParsedLine[] = (Array.isArray(o.lines) ? o.lines : []).map((l: Record<string, unknown>) => {
    let qty = n(l.qty), rate = n(l.rate); const cost = n(l.cost)
    if (rate == null && cost != null && qty) rate = Math.round((cost / qty) * 10000) / 10000   // "1 IT - £540.02"
    if (qty == null && rate != null && cost != null && rate) qty = Math.round((cost / rate) * 1000) / 1000
    const issues: string[] = []
    if (rate == null) issues.push('no rate'); if (qty == null) issues.push('no qty'); if (!l.code) issues.push('no code')
    if (l.unclear) issues.push(`check: ${l.unclear}`)
    return { include: true, code: String(l.code ?? '').trim(), room: String(l.location ?? '').trim() || 'General', description: String(l.description ?? '').trim() || String(l.code ?? ''),
      qty, unit: String(l.unit ?? '').trim(), rate, cost, property: '', workstream: '', hours: null, note: '', issues }
  })
  const d = s('date').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return { ref: s('ref'), date: d ? new Date(+d[1], +d[2] - 1, +d[3], 12).getTime() : null, issuedBy: s('issued_by'), address: s('address'),
    poNumber: s('po_number'), description: s('description'), lines, method: 'ai' }
}

// ---------------- matching ----------------
const normPo = (s: string) => s.toUpperCase().replace(/^H\/|\s+/g, '').replace(/[^A-Z0-9]/g, '')
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3))

/** Which job is this for? PO number first, then address. */
export function matchJob(vo: ParsedVo, jobs: Job[]): Job | null {
  const po = normPo(vo.poNumber)
  if (po) { const j = jobs.find(j => j.poNumber && normPo(j.poNumber) === po); if (j) return j }
  const a = vo.address.toLowerCase()
  if (a) {
    const hit = jobs.filter(j => { const t = `${j.name} ${j.address}`.toLowerCase(); const first = t.split(',')[0].trim(); return first.length > 4 && (a.includes(first) || t.includes(a.split(',')[0].trim())) })
    if (hit.length === 1) return hit[0]
  }
  return null
}

/** Open VOs (not yet instructed by the client) that this line probably is. Best first. */
export function suggestVo(line: ParsedLine, vos: Variation[]): Variation[] {
  const lw = words(`${line.description} ${line.code}`)
  return vos.filter(v => !v.clientRef && v.status === 'Identified')
    .map(v => {
      let score = 0
      if (line.code && v.code && line.code.toUpperCase() === v.code.toUpperCase()) score += 5
      for (const w of words(`${v.description} ${v.room}`)) if (lw.has(w)) score += 1
      return { v, score }
    }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score).map(x => x.v)
}

// ---------------- reading a file ----------------
const asBuffer = (f: Blob) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f) })
const asText = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })
const b64 = (buf: ArrayBuffer) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }

/** Shrink a photo enough to send, but keep handwriting legible (2000px, high quality). */
async function shrinkImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise<Blob>(r => c.toBlob(b => r(b ?? file), 'image/jpeg', 0.88))
  } catch { return file }
}

export async function readVoFile(file: File): Promise<ParsedVo> {
  const name = file.name.toLowerCase()
  if (/\.(xlsx|xlsm|xls|csv)$/.test(name)) {
    const XLSX = await import('xlsx')
    const wb = name.endsWith('.csv') ? XLSX.read(await asText(file), { type: 'string' }) : XLSX.read(await asBuffer(file), { type: 'array', cellDates: true })
    for (const n of wb.SheetNames) {
      const v = readVoSheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false, defval: null }))
      if (v) return v
    }
    throw new Error("Couldn't find a schedule (CODE / DESCRIPTION / QTY / RATE) in that spreadsheet.")
  }
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  const blob = isPdf ? file : await shrinkImage(file)
  if (blob.size > 3_200_000) throw new Error('That file is over 3MB — try a smaller scan or photo.')
  const r = await fetch('/api/parse-vo', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(isPdf ? { kind: 'pdf', data: b64(await asBuffer(blob)) } : { kind: 'image', mediaType: 'image/jpeg', data: b64(await asBuffer(blob)) }) })
  let data: { text?: string; error?: string } = {}
  try { data = await r.json() } catch { throw new Error('The connection dropped before the answer came back. Try again with better signal.') }
  if (!r.ok) throw new Error(data.error || `Couldn't read it (${r.status}).`)
  const v = data.text ? parseVoReply(data.text) : null
  if (!v || !v.lines.length) throw new Error("Couldn't find any instructed work on that document. Is it the VO / site instruction?")
  return v
}
