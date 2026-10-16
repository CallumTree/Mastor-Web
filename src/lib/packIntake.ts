/**
 * Reading the client's whole pack at once: spec list, works orders, PCI, surveys. Each file is
 * sorted by what it actually is (not its name): schedules and works orders are read exactly; the
 * rest are kept with the job’s documents and read by the AI for site facts and missing work
 * (see packFacts.ts). Only when nothing in the pack can be read exactly does
 * the AI reader take a schedule — and then its lines are flagged for checking as before.
 */
import { parseBoqRemote, readBoqFile, type ParsedBoq } from './boq'
import { docxEvents, docxXml, readWorksOrder, type WorksOrder } from './worksOrder'
import { readPack, type PackRead } from './pack'
import { docText, readPackFacts, scopeSummary, type PackDoc, type PackFacts } from './packFacts'

export type FileRole =
  | { role: 'spec'; detail: string }
  | { role: 'order'; detail: string }
  | { role: 'ai'; detail: string }
  | { role: 'document'; detail: string }

export interface PackFile { file: File; as: FileRole }
export interface PackResult extends PackRead { files: PackFile[]; facts?: PackFacts }

const readAsBuffer = (f: Blob) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f) })
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export async function readPackFiles(files: File[], onProgress?: (name: string) => void): Promise<PackResult> {
  const specs: ParsedBoq[] = [], orders: WorksOrder[] = [], out: PackFile[] = []
  for (const file of files) {
    onProgress?.(file.name)
    const name = file.name.toLowerCase()
    let as: FileRole = { role: 'document', detail: 'Kept with the job’s documents' }
    try {
      if (name.endsWith('.docx')) {
        const wo = readWorksOrder(docxEvents(await docxXml(await readAsBuffer(file))), file.name)
        if (wo) { orders.push(wo); as = { role: 'order', detail: `Works order ${wo.contract || ''}${wo.title ? ` · ${wo.title}` : ''} · ${plural(wo.lines.length, 'line')} · ${plural(wo.properties.length, 'property').replace('propertys', 'properties')}` } }
      } else if (/\.(pdf|xlsx|xlsm|xls|csv)$/.test(name)) {
        const read = await readBoqFile(file)
        if (read.kind === 'parsed') {
          specs.push(read.boq)
          const cols = read.boq.columnCheck ?? []
          const off = cols.filter(c => Math.abs(c.sheet - c.read) > 0.05).length
          as = { role: 'spec', detail: `Spec list · ${plural(read.boq.lines.length, 'line')}${cols.length ? off ? ` · ${off} column total${off === 1 ? '' : 's'} don’t match` : ` · all ${cols.length} column totals match` : ''}` }
        }
      } else if (name.endsWith('.doc')) {
        as = { role: 'document', detail: 'Old Word format — kept, not read. Save it as .docx or PDF to have it read' }
      }
    } catch (e) {
      console.warn('pack reader', file.name, e)
    }
    out.push({ file, as })
  }
  // nothing exact? the AI reads the schedule (first file it gets lines from)
  if (!specs.length && !orders.length) {
    let lastErr: Error | null = null
    for (const f of out) {
      if (!/\.(pdf|xlsx|xlsm|xls|csv|docx|txt)$/i.test(f.file.name)) continue
      onProgress?.(f.file.name)
      try {
        const boq = await parseBoqRemote(f.file)
        specs.push(boq)
        f.as = { role: 'ai', detail: `Read by AI · ${plural(boq.lines.length, 'line')} — check the flagged ones` }
        break
      } catch (e) { lastErr = e as Error }
    }
    if (!specs.length) throw lastErr ?? new Error('Nothing in these files reads as a schedule, BoQ or works order.')
  }
  const pack = readPack(specs, orders)
  // the rest of the pack (PCI, risk register, surveys): read for site facts and work the scope is missing
  const docs: PackDoc[] = []
  for (const f of out) {
    if (f.as.role !== 'document') continue
    try { const text = await docText(f.file); if (text && text.replace(/\s/g, '').length > 200) docs.push({ name: f.file.name, text }) } catch (e) { console.warn('pack text', f.file.name, e) }
  }
  let facts: PackFacts | undefined
  if (docs.length) {
    onProgress?.(docs.length === 1 ? docs[0].name : `${docs.length} documents for site facts`)
    facts = await readPackFacts(docs, scopeSummary(pack.lines))
  }
  return { ...pack, files: out, facts, method: specs.some(s => s.method === 'ai') ? 'ai' : 'table' }
}
