import { readSchedule } from './sheet'
/** Turning an uploaded BoQ into reviewable lines. Nothing here saves anything. */
export interface ParsedLine {
  include: boolean
  code: string; room: string; description: string
  qty: number | null; unit: string; rate: number | null
  cost: number | null      // the document's printed line total, if any
  property: string
  workstream: string
  hours: number | null
  note: string
  issues: string[]          // why this line needs checking
}
/** One label per place, however the AMO wrote it: "ALL ELVS" → "All elevations", "Front Elv" → "Front elevation". */
export function tidyLocation(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/\b(elvs?|elev?s?|elevs?|elevations?)\.?(?=\s|$)/gi, m => /s\.?$/i.test(m) && !/^elev?$/i.test(m) ? 'elevations' : 'elevation')
       .replace(/^(f|fr|frt)\/?\s*(?=elevation)/i, 'Front ').replace(/^(r|rr)\/?\s*(?=elevation)/i, 'Rear ').replace(/^(s|sd)\/?\s*(?=elevation)/i, 'Side ')
       .replace(/\bbed\s*(\d)/i, 'Bedroom $1').replace(/\bbedroom(\d)/i, 'Bedroom $1')
  if (/^all elevation$/i.test(t)) t = 'All elevations'
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

export interface ParsedBoq { ref: string; lines: ParsedLine[]; truncated: boolean; columnCheck?: { stream: string; sheet: number; read: number }[]; method?: 'table' | 'spreadsheet' | 'ai' }

/** Builds one reviewed line, with the shift repair and all the checks. Shared by the JSON and TSV paths. */
function buildLine(code: string, room: string, description: string, qty: number | null, unit: string, rate: number | null, cost: number | null,
  property: string, workstream: string, hours: number | null, note: string): ParsedLine | null {
  if (!description) return null
  if (/^(sub)?total|carried forward|brought forward/i.test(description)) return null
  // Repair a one-column shift (rate landed in "unit", line cost landed in "rate"):
  // e.g. qty 13, unit "133.9055", rate 1740.77 → qty 13, rate 133.9055, cost 1740.77
  const unitNum = /^\d+(\.\d+)?$/.test(unit.trim()) ? parseFloat(unit) : null
  if (unitNum != null && qty != null && rate != null && Math.abs(qty * unitNum - rate) <= 0.011 * Math.max(1, qty)) {
    if (cost == null || Math.abs(cost - rate) < 0.011) cost = rate
    rate = unitNum; unit = ''
  }
  property = property.replace(/^(no\.?|plot|house|unit)\s*/i, '').trim()
  if (/^(property|general|n\/a|-)$/i.test(property)) property = ''
  const issues: string[] = []
  if (qty != null && rate != null && cost != null) {
    const calc = Math.round(qty * rate * 100 + 1e-7) / 100
    if (Math.abs(calc - cost) > 0.005) issues.push(`document cost £${cost.toFixed(2)} ≠ qty × rate £${calc.toFixed(2)}`)
  }
  if (rate == null && cost != null) issues.push(`total only: £${cost.toFixed(2)}`)
  if (rate == null) issues.push('no rate')
  if (qty == null) issues.push('no qty')
  if (!code) issues.push('no code')
  if (note) issues.push(note)
  return { include: true, code, room: tidyLocation(room) || 'General', description, qty, unit, rate, cost, property, workstream, hours, note, issues }
}

export let lastTableError: string | null = null
const num = (s: string | undefined): number | null => {
  if (!s) return null
  const v = parseFloat(s.replace(/[£,\s]/g, ''))
  return isFinite(v) && v > 0 ? v : null
}

/** Parses the model's TSV. Missing values stay null — never filled in. */
export function parseBoqTsv(text: string, truncated = false): ParsedBoq {
  let ref = ''
  const lines: ParsedLine[] = []
  for (const raw0 of text.split(/\r?\n/)) {
    const raw = raw0                                   // TSV path needs trailing tabs intact
    const j = raw0.replace(/^```\w*|```$/g, '').trim()
    // JSON Lines (current reader): every value is labelled, so a missing column can't shift anything
    if (j.startsWith('{')) {
      let o: Record<string, unknown>
      try { o = JSON.parse(j.replace(/,\s*}$/, '}')) } catch { continue }
      if ('ref' in o && !('code' in o) && !('description' in o)) { ref = String(o.ref ?? '').trim(); continue }
      const str = (k: string) => String(o[k] ?? '').trim()
      const n = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : num(String(o[k] ?? '')))
      const line = buildLine(str('code'), str('location'), str('description'), n('qty'), str('unit'), n('rate'), n('cost'), str('property'), str('workstream'), n('hours') ?? null, str('note'))
      if (line) lines.push(line)
      continue
    }
    // keep trailing tabs (an empty NOTE field) — only strip spaces / carriage returns
    const line = raw.replace(/^```\w*|```$/g, '').replace(/[ \r]+$/, '')
    if (!line.trim()) continue
    if (/^\|?\s*:?-{3,}/.test(line)) continue // markdown table separator
    const f = line.includes('\t') ? line.split('\t') : line.includes('|') ? line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|') : [line]
    if (f[0].trim().toUpperCase() === 'REF') { ref = (f[1] ?? '').trim(); continue }
    if (/^code$/i.test(f[0].trim())) continue // header row
    if (f.length < 3) continue
    // 8 fields: CODE ROOM DESC QTY UNIT RATE COST NOTE (older 7-field replies had no COST)
    const t = f.map(x => x?.trim())
    const [code = '', room = '', description = '', qty, unit = '', rate] = t
    // Field 7 is COST when it's a plain amount (even if the model dropped the empty NOTE after it)
    const looksLikeAmount = (x?: string) => !!x && /^£?\s*[\d,]*\.?\d+$/.test(x)
    const costRaw = looksLikeAmount(t[6]) ? t[6] : undefined
    // 11-field lines: … COST PROPERTY WORKSTREAM HOURS NOTE
    const wide = t.length >= 9
    let property = wide ? (t[7] ?? '').replace(/^(no\.?|plot|house|unit)\s*/i, '').trim() : ''
    if (/^(property|general|n\/a|-)$/i.test(property)) property = ''
    const workstream = wide ? (t[8] ?? '').trim() : ''
    const hoursNum = wide && t[9] ? parseFloat(t[9]) : NaN
    const note = (wide ? (t[10] ?? '') : costRaw !== undefined ? t[7] : t.length >= 8 ? t[7] : t[6]) ?? ''
    const built = buildLine(code, room, description, num(qty), unit, num(rate), num(costRaw), property, workstream, isFinite(hoursNum) ? hoursNum : null, note)
    if (built) lines.push(built)
  }
  return { ref, lines, truncated }
}

// FileReader works on every browser, including older Android phones (File.text/arrayBuffer don't)
const readAsText = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })
const readAsBuffer = (f: Blob) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f) })

/** Reads the picked file into what the server function expects. */
export async function readBoqFile(file: File, direct = true): Promise<{ kind: 'pdf'; data: string } | { kind: 'text'; text: string } | { kind: 'parsed'; boq: ParsedBoq }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    // 1) read the table directly — exact, no AI. Falls through to the AI if it isn't a table we recognise.
    if (direct) {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const { pdfPages, readPdfSchedule } = await import('./pdfTable')
        const read = readPdfSchedule(await pdfPages(new Uint8Array(await readAsBuffer(file)), pdfjs as never))
        if (read) return { kind: 'parsed', boq: { ...read, method: 'table' } }
      } catch (e) { console.warn('PDF table reader failed — using the AI', e); lastTableError = (e as Error)?.message ?? String(e) }
    }
    if (file.size > 3_200_000) throw new Error('That PDF is over 3MB — try exporting it smaller, or upload the Excel version.')
    const buf = new Uint8Array(await readAsBuffer(file))
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { kind: 'pdf', data: btoa(bin) }
  }
  if (/\.(xlsx|xlsm|xls|csv)$/.test(name) && direct) {
    const XLSX = await import('xlsx')
    const wb = name.endsWith('.csv') ? XLSX.read(await readAsText(file), { type: 'string' }) : XLSX.read(await readAsBuffer(file), { type: 'array' })
    for (const n of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[n], { header: 1, blankrows: false, defval: null })
      const parsed = readSchedule(rows)
      if (parsed) return { kind: 'parsed', boq: { ...parsed, method: 'spreadsheet' } }
    }
  }
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await readAsBuffer(file), { type: 'array' })
    const text = wb.SheetNames.map(n => `### Sheet: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join('\n\n')
    return { kind: 'text', text }
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ arrayBuffer: await readAsBuffer(file) })
    return { kind: 'text', text: value }
  }
  return { kind: 'text', text: await readAsText(file) }
}

export async function parseBoqRemote(file: File): Promise<ParsedBoq> {
  const payload = await readBoqFile(file)
  if (payload.kind === 'parsed') return payload.boq   // spreadsheet read exactly — no AI needed
  const r = await fetch('/api/parse-boq', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  let data: { text?: string; truncated?: boolean; error?: string } = {}
  let gotJson = true
  try { data = await r.json() } catch { gotJson = false }
  if (r.ok && !gotJson) throw new Error('The connection dropped before the answer came back. Try again with better signal.')
  if (r.ok && !data.text) throw new Error('The reader came back empty. Try again — if it keeps happening, send the file over so it can be looked at.')
  if (!r.ok || !data.text) throw new Error(data.error || (r.status === 404 ? 'The reader isn’t deployed yet.' : `Couldn’t read the document (${r.status}).`))
  const parsed = parseBoqTsv(data.text, !!data.truncated)
  if (parsed.lines.length === 0) throw new Error('The document was read, but no priced line items were found in it. Is this the BoQ / works order? If it is, send it over and it can be looked at.')
  return { ...parsed, method: 'ai' }
}
