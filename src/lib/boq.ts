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
export interface ParsedBoq { ref: string; lines: ParsedLine[]; truncated: boolean }

const num = (s: string | undefined): number | null => {
  if (!s) return null
  const v = parseFloat(s.replace(/[£,\s]/g, ''))
  return isFinite(v) && v > 0 ? v : null
}

/** Parses the model's TSV. Missing values stay null — never filled in. */
export function parseBoqTsv(text: string, truncated = false): ParsedBoq {
  let ref = ''
  const lines: ParsedLine[] = []
  for (const raw of text.split(/\r?\n/)) {
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
    const wide = t.length >= 10
    const property = wide ? (t[7] ?? '').replace(/^(no\.?|plot|house)\s*/i, '').trim() : ''
    const workstream = wide ? (t[8] ?? '').trim() : ''
    const hoursNum = wide && t[9] ? parseFloat(t[9]) : NaN
    const note = (wide ? t[10] : costRaw !== undefined ? t[7] : t.length >= 8 ? t[7] : t[6]) ?? ''
    if (!description) continue
    if (/^(sub)?total|carried forward|brought forward/i.test(description)) continue
    const q = num(qty), r = num(rate), c = num(costRaw)
    const issues: string[] = []
    if (q != null && r != null && c != null) {
      const calc = Math.round(q * r * 100 + 1e-7) / 100
      if (Math.abs(calc - c) > 0.005) issues.push(`document cost £${c.toFixed(2)} ≠ qty × rate £${calc.toFixed(2)}`)
    }
    if (r == null && c != null) issues.push(`total only: £${c.toFixed(2)}`)
    if (r == null) issues.push('no rate')
    if (q == null) issues.push('no qty')
    if (!code) issues.push('no code')
    if (note) issues.push(note)
    lines.push({ include: true, code, room: room || 'General', description, qty: q, unit: unit || 'item', rate: r, cost: c, property, workstream, hours: isFinite(hoursNum) ? hoursNum : null, note, issues })
  }
  return { ref, lines, truncated }
}

// FileReader works on every browser, including older Android phones (File.text/arrayBuffer don't)
const readAsText = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f) })
const readAsBuffer = (f: Blob) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f) })

/** Reads the picked file into what the server function expects. */
export async function readBoqFile(file: File): Promise<{ kind: 'pdf'; data: string } | { kind: 'text'; text: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    if (file.size > 3_200_000) throw new Error('That PDF is over 3MB — try exporting it smaller, or upload the Excel version.')
    const buf = new Uint8Array(await readAsBuffer(file))
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { kind: 'pdf', data: btoa(bin) }
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
  const r = await fetch('/api/parse-boq', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  let data: { text?: string; truncated?: boolean; error?: string } = {}
  try { data = await r.json() } catch { /* non-JSON error page */ }
  if (!r.ok || !data.text) throw new Error(data.error || (r.status === 404 ? 'The reader isn’t deployed yet.' : `Couldn’t read the document (${r.status}).`))
  const parsed = parseBoqTsv(data.text, !!data.truncated)
  if (parsed.lines.length === 0) throw new Error('The document was read, but no priced line items were found in it. Is this the BoQ / works order? If it is, send it over and it can be looked at.')
  return parsed
}
