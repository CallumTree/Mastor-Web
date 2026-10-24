/**
 * Council works orders in Word (one .docx per contract, e.g. PCC "MH21180 Windsor Road Painting"):
 * a contract box (Contract Reference, Project Reference, Title of Work, Contract Value), then per property
 * "Property Address: …", "Location: …" headings, line tables (Description | Comments | Code | Quantity |
 * Units | Rate | Cost) and a printed Total Cost. Read exactly — no AI — and every printed figure is
 * checked against the lines it should add up to.
 */

export interface WoLine {
  property: string          // house number, e.g. "13"
  address: string           // the full printed address
  location: string
  code: string; description: string; comment: string
  qty: number | null; unit: string; rate: number | null
  cost: number | null       // as printed
}
export interface WoProperty { property: string; address: string; printedTotal: number | null; lines: number; sum: number }
export interface WorksOrder {
  file: string
  contract: string          // Contract Reference, e.g. MH21180
  project: string           // Project Reference, e.g. 25W000PAI
  title: string             // Title of Work
  trade?: string            // the title without the scheme address, e.g. "Painting" (set when the pack is pieced together)
  contractValue: number | null
  lines: WoLine[]
  properties: WoProperty[]
  /** what doesn't add up, in plain words */
  problems: string[]
}

type Ev = { k: 'p'; text: string } | { k: 'row'; cells: string[] }

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&')

/** Paragraphs outside tables and the rows of every table (nested ones included), in document order. */
export function docxEvents(xml: string): Ev[] {
  const body = xml.slice(Math.max(0, xml.indexOf('<w:body')))
  const re = /<w:tbl>|<\/w:tbl>|<w:tr[ >]|<\/w:tr>|<w:tc[ >]|<\/w:tc>|<w:p[ >]|<w:p\/>|<\/w:p>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g
  const out: Ev[] = []
  let depth = 0
  const rows: string[][] = []            // stack of rows being built (one per open table level)
  let para: string[] | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const t = m[0]
    if (t === '<w:tbl>') { depth++; continue }
    if (t === '</w:tbl>') { depth--; continue }
    if (t.startsWith('<w:tr')) { rows.push([]); continue }
    if (t === '</w:tr>') {
      const r = rows.pop()
      if (r) out.push({ k: 'row', cells: r.map(c => c.replace(/\s+/g, ' ').trim()) })
      continue
    }
    if (t.startsWith('<w:tc')) { rows[rows.length - 1]?.push(''); continue }
    if (t === '</w:tc>') continue
    if (t === '<w:p/>') continue
    if (t.startsWith('<w:p')) { para = []; continue }
    if (t === '</w:p>') {
      const text = (para ?? []).join('').replace(/\s+/g, ' ').trim()
      para = null
      if (depth === 0) { if (text) out.push({ k: 'p', text }) }
      else { const r = rows[rows.length - 1]; if (r?.length) r[r.length - 1] += (r[r.length - 1] ? ' ' : '') + text }
      continue
    }
    const piece = m[1] != null ? unxml(m[1]) : ' '
    if (para) para.push(piece)
  }
  return out
}

const money = (s: string): number | null => { const t = s.replace(/[£,\s]/g, ''); if (!t || !/^-?\d*\.?\d+$/.test(t)) return null; return parseFloat(t) }
const r2 = (n: number) => Math.round(n * 100 + 1e-7) / 100
const houseNo = (address: string) => /^\s*(?:flat\s+)?(\d+[a-z]?)\b/i.exec(address)?.[1]?.toUpperCase() ?? address.split(',')[0].trim()
const sentence = (d: string) => (d === d.toUpperCase() ? d.charAt(0) + d.slice(1).toLowerCase() : d).replace(/:(\S)/, ': $1')

/** True when the document looks like a council works order this reader understands. */
export function isWorksOrder(ev: Ev[]) {
  return ev.some(e => e.k === 'p' && /^Property Address:/i.test(e.text)) &&
    ev.some(e => e.k === 'row' && e.cells.some(c => /^code$/i.test(c)) && e.cells.some(c => /^quantity|^qty/i.test(c)))
}

export function readWorksOrder(ev: Ev[], file = ''): WorksOrder | null {
  if (!isWorksOrder(ev)) return null
  const wo: WorksOrder = { file, contract: '', project: '', title: '', contractValue: null, lines: [], properties: [], problems: [] }
  let address = '', location = ''
  let col: Record<string, number> | null = null
  let wantTotal = false
  const props = new Map<string, WoProperty>()
  const prop = () => {
    const p = houseNo(address)
    if (!props.has(p)) props.set(p, { property: p, address, printedTotal: null, lines: 0, sum: 0 })
    return props.get(p)!
  }
  for (const e of ev) {
    if (e.k === 'p') {
      const a = /^Property Address:\s*(.*)$/i.exec(e.text); if (a) { address = a[1].trim(); location = ''; col = null; if (address) prop(); continue }
      const l = /^Location:\s*(.*)$/i.exec(e.text); if (l) { location = l[1].trim(); continue }
      continue
    }
    const c = e.cells
    // contract box: label | value
    const label = (c[0] ?? '').replace(/:$/, '').trim().toLowerCase()
    const value = c.slice(1).find(x => x) ?? ''
    if (label === 'contract reference') { if (!wo.contract) wo.contract = value; continue }
    if (label === 'project reference') { if (!wo.project) wo.project = value; continue }
    if (label === 'title of work') { if (!wo.title) wo.title = value; continue }
    if (label === 'contract value') { if (wo.contractValue == null) wo.contractValue = money(value); continue }
    if (c.some(x => /^total cost$/i.test(x))) { wantTotal = true; continue }
    if (wantTotal) {
      const v = [...c].reverse().map(money).find(x => x != null)
      if (v != null && address) prop().printedTotal = v
      wantTotal = false; continue
    }
    // line table header
    if (c.some(x => /^code$/i.test(x)) && c.some(x => /^(quantity|qty)$/i.test(x))) {
      const at = (re: RegExp) => c.findIndex(x => re.test(x))
      col = { desc: at(/^description$/i), comment: at(/^comments?$/i), code: at(/^code$/i), qty: at(/^(quantity|qty)$/i), unit: at(/^units?$/i), rate: at(/^rate$/i), cost: at(/^(cost|total)$/i) }
      continue
    }
    if (!col || !address) continue
    const get = (k: string) => (col![k] >= 0 ? c[col![k]] ?? '' : '')
    const code = get('code').trim()
    if (!/^[0-9A-Z]{3,10}$/i.test(code)) continue
    const qtyRaw = get('qty').trim()
    const line: WoLine = {
      property: houseNo(address), address, location,
      code: code.toUpperCase(), description: sentence(get('desc')), comment: get('comment'),
      qty: qtyRaw ? money(qtyRaw) : null, unit: get('unit').toUpperCase(), rate: money(get('rate')), cost: money(get('cost')),
    }
    wo.lines.push(line)
    const p = prop(); p.lines++; if (line.qty != null && line.rate != null) p.sum = r2(p.sum + line.qty * line.rate)
  }
  wo.properties = [...props.values()]
  // ---- the checks
  for (const l of wo.lines) {
    if (l.qty != null && l.rate != null && l.cost != null && Math.abs(r2(l.qty * l.rate) - l.cost) > 0.011)
      wo.problems.push(`No. ${l.property} ${l.code}: prints £${l.cost.toFixed(2)}, but ${l.qty} × £${l.rate.toFixed(2)} = £${r2(l.qty * l.rate).toFixed(2)}`)
  }
  for (const p of wo.properties) {
    if (p.printedTotal == null) continue
    if (!p.lines && p.printedTotal > 0) wo.problems.push(`No. ${p.property}: prints a total of £${p.printedTotal.toFixed(2)} but lists no lines`)
    else if (Math.abs(p.printedTotal - p.sum) > Math.max(0.05, p.lines * 0.006)) wo.problems.push(`No. ${p.property}: prints a total of £${p.printedTotal.toFixed(2)}, its lines add to £${p.sum.toFixed(2)}`)
  }
  const sum = r2(wo.lines.reduce((t, l) => t + (l.qty ?? 0) * (l.rate ?? 0), 0))
  if (wo.contractValue != null && Math.abs(sum - wo.contractValue) > Math.max(0.05, wo.lines.length * 0.006))
    wo.problems.push(`Contract value £${wo.contractValue.toFixed(2)}, the lines add to £${sum.toFixed(2)} (£${Math.abs(r2(wo.contractValue - sum)).toFixed(2)} ${sum < wo.contractValue ? 'short' : 'over'})`)
  return wo
}

/** The trade from a works-order title, without the scheme's address words: "Windsor Road Pembroke Painting" → "Painting". */
export function contractTrade(title: string, addresses: string[]) {
  const addr = new Set(addresses.join(' ').toLowerCase().split(/[^a-z]+/).filter(Boolean))
  const words = title.split(/[\s,–-]+/).filter(w => w && !addr.has(w.toLowerCase()))
  return words.join(' ').trim() || title
}

/** Reads document.xml out of a .docx (the zip is opened with the spreadsheet library's CFB reader). */
export async function docxXml(buf: ArrayBuffer): Promise<string> {
  const X = await import('xlsx')
  const CFB = X.CFB ?? (X as unknown as { default: typeof X }).default.CFB
  const zip = CFB.read(new Uint8Array(buf), { type: 'array' })
  const i = zip.FullPaths.findIndex((p: string) => p.endsWith('word/document.xml'))
  if (i < 0) throw new Error('That isn’t a Word document Mastor can read.')
  return new TextDecoder().decode(zip.FileIndex[i].content as Uint8Array)
}
