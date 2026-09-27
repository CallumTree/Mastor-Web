/** Turning an uploaded BoQ into reviewable lines. Nothing here saves anything. */
export interface ParsedLine {
  include: boolean
  code: string; room: string; description: string
  qty: number | null; unit: string; rate: number | null
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
    const line = raw.replace(/^```\w*|```$/g, '').trimEnd()
    if (!line.trim()) continue
    const f = line.split('\t')
    if (f[0].trim().toUpperCase() === 'REF') { ref = (f[1] ?? '').trim(); continue }
    if (f.length < 3) continue
    const [code = '', room = '', description = '', qty, unit = '', rate, note = ''] = f.map(x => x?.trim())
    if (!description) continue
    if (/^(sub)?total|carried forward|brought forward/i.test(description)) continue
    const q = num(qty), r = num(rate)
    const issues: string[] = []
    if (r == null) issues.push('no rate')
    if (q == null) issues.push('no qty')
    if (!code) issues.push('no code')
    if (note) issues.push(note)
    lines.push({ include: true, code, room: room || 'General', description, qty: q, unit: unit || 'item', rate: r, note, issues })
  }
  return { ref, lines, truncated }
}

/** Reads the picked file into what the server function expects. */
export async function readBoqFile(file: File): Promise<{ kind: 'pdf'; data: string } | { kind: 'text'; text: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    if (file.size > 3_200_000) throw new Error('That PDF is over 3MB — try exporting it smaller, or upload the Excel version.')
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { kind: 'pdf', data: btoa(bin) }
  }
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const text = wb.SheetNames.map(n => `### Sheet: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join('\n\n')
    return { kind: 'text', text }
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return { kind: 'text', text: value }
  }
  return { kind: 'text', text: await file.text() }
}

export async function parseBoqRemote(file: File): Promise<ParsedBoq> {
  const payload = await readBoqFile(file)
  const r = await fetch('/api/parse-boq', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  let data: { text?: string; truncated?: boolean; error?: string } = {}
  try { data = await r.json() } catch { /* non-JSON error page */ }
  if (!r.ok || !data.text) throw new Error(data.error || (r.status === 404 ? 'The reader isn’t deployed yet.' : `Couldn’t read the document (${r.status}).`))
  return parseBoqTsv(data.text, !!data.truncated)
}
