/**
 * The general scope reader (no AI). Works out the layout of a schedule of works, BoQ, scope of works or works
 * order it has never seen, and reads every line exactly:
 *  - the header row is found by what its columns mean, whatever the client calls them ("SOR Ref", "Item No.",
 *    "Description of works", "Quantity", "UoM", "Unit price", "Total £"…), in any order, under any title rows;
 *  - a column's meaning is checked against what's in it ("Unit" holding 4A, 12 is a dwelling, not a measure);
 *  - properties, rooms and trades given as heading rows ("12 Acacia Avenue", "KITCHEN", "2.3 Roof coverings")
 *    carry down to the lines under them; a description that runs on to the next row is joined back up;
 *  - totals, carried-forward, collection and uplift / VAT rows are left out;
 *  - priced, part-priced and unpriced scopes all read: a missing figure stays blank and is flagged, never filled in.
 * Spreadsheets, CSV, Word tables and PDF tables all come here as rows of cells (see readWorkbook, readDocxTables, pdfRows).
 * The layouts with their own exact readers (sheet.ts, pdfTable.ts, worksOrder.ts) are tried first. Returns null when
 * there's no table it trusts; the caller then hands the document to the AI reader.
 */
import type { ParsedBoq, ParsedLine } from './boq'
import { tidyLocation } from './boq'
import { readSchedule } from './sheet'
import { propertyOf } from './property'
export { propertyOf } from './property'
import type { PdfPage } from './pdfTable'

export type Cell = string | number | null | undefined
type Role = 'prop' | 'code' | 'desc' | 'qty' | 'unit' | 'rate' | 'cost' | 'loc' | 'comment' | 'hours' | 'trade'

const clean = (c: Cell) => String(c ?? '').replace(/\s+/g, ' ').trim()
/** A heading cell, compared without £ marks, full stops, colons or brackets: "Rate (£)" → "RATE", "Qty." → "QTY". */
const headText = (c: Cell) => clean(c).toUpperCase().replace(/\((£|GBP|EX\.? VAT|EXC\.? VAT)\)|£|\bGBP\b/g, '').replace(/[.:*#()]/g, '').replace(/\s+/g, ' ').trim()

const ROLES: [Role, RegExp][] = [
  ['desc', /^(DESCRIPTION|DESC|DESCRIPTION OF (THE )?WORKS?|ITEM DESCRIPTION|WORKS? DESCRIPTION|WORKS?|WORKS? REQUIRED|WORKS? TO BE CARRIED OUT|SPECIFICATION|SPEC|DETAILS?|NARRATIVE|TASK|SCOPE|SCOPE OF WORKS?|ACTIVITY|WORK ITEM|REPAIR|REPAIR DESCRIPTION)$/],
  ['code', /^(CODE|SOR|SOR (CODE|REF|NO|NUMBER|ITEM)|SCHEDULE (REF|CODE|ITEM)|REF|REF NO|REFERENCE|ITEM( NO| NUMBER| REF| CODE)?|CLAUSE|RATE (CODE|REF)|NSR|NHF( CODE| REF)?|M3 CODE|ASSET REF|ASSET CODE|TASK (REF|CODE|NO))$/],
  ['prop', /^(NUMBER|NO|HOUSE( NO| NUMBER)?|PLOT( NO| NUMBER)?|UNIT NO|PROPERTY( NO| NUMBER| REF| ADDRESS)?|ADDRESS|DWELLING|FLAT( NO)?|BLOCK|SITE ADDRESS|UPRN)$/],
  ['qty', /^(QTY|QUANTITY|QUANT|QTY REQUIRED|NO OF|NUMBER OF|NO OFF?|QTYS?)$/],
  ['unit', /^(UNIT|UNITS|UOM|U\/M|UNIT OF MEASURE(MENT)?|MEASURE|MEAS|UNIT TYPE)$/],
  ['rate', /^(RATE|UNIT RATE|RATE PER UNIT|UNIT PRICE|PRICE PER UNIT|UNIT COST|SOR RATE|SCHEDULE RATE|PRICE|BASE RATE)$/],
  ['cost', /^(TOTAL|AMOUNT|COST|LINE TOTAL|EXTENSION|EXTENDED|VALUE|SUM|TOTAL COST|TOTAL PRICE|TOTAL VALUE|NET|NET TOTAL|NETT|SUB ?TOTAL)$/],
  ['loc', /^(LOCATION|ROOM|AREA|ELEVATION|POSITION|ZONE|FLOOR|LEVEL|WHERE|ROOM\/AREA|LOCATION\/ROOM)$/],
  ['comment', /^(COMMENTS?|NOTES?|REMARKS?|CLIENT (NOTES?|COMMENTS?)|ADDITIONAL (INFO|INFORMATION|NOTES))$/],
  ['hours', /^(HOURS|HRS|LABOUR HOURS|MAN HOURS|TIME)$/],
  ['trade', /^(TRADE|WORKSTREAM|WORK TYPE|CATEGORY|ELEMENT|SECTION|WORK PACKAGE|PACKAGE)$/],
]
const roleOf = (c: Cell): Role | null => { const h = headText(c); if (!h || h.length > 45) return null; for (const [r, re] of ROLES) if (re.test(h)) return r; return null }

/** Units of measure as BoQs write them. */
const UOM = /^(m|m1|m2|m3|m²|m³|lm|l\/m|lin ?m|linear m(etres?)?|sm|sq ?m|m sq|cm|mm|nr|no|nos|item|items|it|each|ea|sum|ls|l\/s|lump sum|ps|p\/s|hr|hrs|hour|hours|day|days|wk|wks|week|weeks|kg|t|tonne|tonnes|set|sets|pr|pair|pc|pcs|m run|ml|l|ltr|litre|litres|%|visit|visits|unit|units)$/i
const num = (c: Cell): number | null => {
  if (typeof c === 'number') return isFinite(c) ? c : null
  const s = clean(c).replace(/[£,\s]/g, '')
  if (!s || !/^-?\d*\.?\d+$/.test(s)) return null
  const v = parseFloat(s)
  return isFinite(v) ? v : null
}
const isNumText = (s: string) => num(s) != null
const words = (s: string) => s.split(/\s+/).filter(Boolean).length
const letters = (s: string) => s.replace(/[^a-z]/gi, '').length
const shouting = (s: string) => { const l = s.replace(/[^A-Za-z]/g, ''); return l.length > 3 && l.replace(/[^A-Z]/g, '').length / l.length > 0.8 }
const sentence = (s: string) => (shouting(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s).replace(/:(\S)/, ': $1')
const title = (s: string) => { const t = s.replace(/^\d+(\.\d+)*[.)]?\s+/, '').replace(/^(section|element|part|trade)\s*[:\-–]?\s*\d*[.:]?\s*/i, '').trim(); return shouting(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t }

const TOTALS = /^(sub[- ]?totals?\b|totals?\s*[:£\d.,\s]*$|grand total|(page|section|sheet|element|block|trade) total|total (for|carried|to|this|c\/f|b\/f)\b|carried (forward|to)\b|c\/f\b|brought forward\b|b\/f\b|(to )?collection\s*$|to summary\b|summary\s*$)/i
const UPLIFTS = /^(vat\b|v\.a\.t|bcis\b|uplift\b|framework (uplift|%|percentage)|contractor('?s)? (uplift|discount|overheads|adjustment)|overheads\b|overhead (and|&) profit|oh ?& ?p\b|profit\b|discount\b|percentage adjustment|tender adjustment|inflation\b)/i
/** A document's own title rather than a part of it: "BoQ", "Schedule of works", "Pricing document", "Sheet1". */
const DOC_TITLE = /^(schedule|bill|scope|specification|spec|works order|order|quotation|quote|tender|boq|bq|bill of quantities|pricing|price|priced|rates|sor|sheet ?\d*|data|export|report|works|items|lines|main|master|full list|all)\b/i
const FURNITURE = /^(page \d+( of \d+)?|\d+ of \d+|-? ?\d+ ?-?|continued( overleaf)?|cont'?d\.?|printed( on)?\b.*|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$/i
const ROOM = /^(the )?(kitchen|bathroom|en-?suite|shower room|wet ?room|w\.?c\.?|toilet|cloakroom|hall(way)?|landing|stair(s|case|well)?|bed(room)?\s*\d*|living( room)?|lounge|sitting room|dining( room)?|utility( room)?|loft|attic|garage|porch|conservatory|store( room)?|cupboard|airing cupboard|externals?|external works|garden|(front|rear|side|all) (elevations?|garden)|roof( ?space)?|communal( areas?)?|throughout|general|internal(s)?|plant room|reception|office|classroom|ward|corridor)(\s*(\d+|[a-z]))?$/i


interface Cols { [k: string]: number }
/** 1, 2, 3, 4… each once, in order. */
const counts = (v: string[]) => {
  if (v.length < 4 || !v.every(x => /^\d+$/.test(x))) return false
  const n = v.map(Number)
  return new Set(n).size === n.length && n.slice(1).filter((x, i) => x === n[i] + 1).length >= 0.9 * (n.length - 1)
}

/** Finds the header row and what each column means, checked against what's in it. */
export function findHeader(rows: Cell[][]): { at: number; col: Cols; streams: { i: number; name: string }[] } | null {
  let best: { at: number; roles: (Role | null)[]; score: number } | null = null
  const scan = Math.min(rows.length, 80)
  for (let r = 0; r < scan; r++) {
    const cells = rows[r] ?? []
    const roles = cells.map(roleOf)
    // PRICE beside RATE is the line total
    const hs = cells.map(headText)
    if (hs.includes('RATE') || hs.includes('UNIT RATE')) hs.forEach((h, i) => { if (h === 'PRICE') roles[i] = 'cost' })
    const has = (k: Role) => roles.includes(k)
    const known = new Set(roles.filter(Boolean)).size
    if (known < 2) continue
    // a description, or an item column that may turn out to hold the descriptions
    if (!has('desc') && !has('code')) continue
    if (!(['qty', 'unit', 'rate', 'cost', 'code', 'loc', 'prop'] as Role[]).some(has)) continue
    const score = known + (has('desc') ? 2 : 0) + (has('qty') || has('rate') || has('cost') ? 1 : 0)
    if (!best || score > best.score) best = { at: r, roles, score }
  }
  if (!best) return null
  const { at, roles } = best
  const body = rows.slice(at + 1, at + 61)
  const values = (i: number) => body.map(r => clean(r?.[i])).filter(Boolean)
  const share = (i: number, test: (v: string) => boolean) => { const v = values(i); return v.length ? v.filter(test).length / v.length : 0 }
  // what a column holds settles what it means:
  roles.forEach((role, i) => {
    // "No." holding 1.01, 2.3a, C4 is the item reference, not a house number
    if (role === 'prop' && share(i, x => /^\d+\.\d+[a-z]?$/i.test(x) || /^[A-Z]{1,2}\d*(\.\d+)?$/.test(x)) > 0.6) roles[i] = 'code'
    // …and so is one that counts 1, 2, 3 down the page: house numbers repeat over a property's lines, item numbers don't
    if (role === 'prop' && counts(values(i))) roles[i] = 'code'
    // "Unit" holding 4A, 12, 7 is the dwelling, not a unit of measure
    if (role === 'unit' && share(i, x => /^\d{1,4}[a-z]?$/i.test(x)) > 0.6 && share(i, x => UOM.test(x)) < 0.2) roles[i] = 'prop'
    // an "Item" column holding sentences is the description
    if (role === 'code' && !roles.includes('desc') && share(i, x => words(x) >= 3) > 0.5) roles[i] = 'desc'
  })
  const col: Cols = {}
  roles.forEach((role, i) => { if (role && col[role] == null) col[role] = i })
  if (col.desc == null) return null
  // any other titled column to the right of the description that holds money = a workstream column (Kitchen, Roofing…)
  const head = rows[at] ?? []
  const used = new Set(Object.values(col))
  const streams: { i: number; name: string }[] = []
  head.forEach((h, i) => {
    if (used.has(i) || roles[i] || i <= col.desc || !clean(h)) return
    if (share(i, isNumText) >= 0.6) streams.push({ i, name: title(clean(h)) })
  })
  return { at, col, streams }
}

/** Reads one table (rows of cells). `section` names the sheet or table it came from, when that means something.
 *  `strict` (used when sorting a whole pack, where surveys and registers also have tables): only a table whose lines
 *  mostly carry quantities, units or money, or read as instructions to do work, counts as a schedule. */
export function readTable(rows: Cell[][], opts: { section?: string; strict?: boolean } = {}): ParsedBoq | null {
  const found = findHeader(rows)
  if (!found) return null
  const { at, col, streams } = found
  const sig = (r: Cell[]) => r.map(headText).join('|').replace(/\|+$/, '')
  const headSig = sig(rows[at] ?? [])
  const get = (r: Cell[], k: Role) => (col[k] != null ? clean(r[col[k]]) : '')
  const getN = (r: Cell[], k: Role) => (col[k] != null ? num(r[col[k]]) : null)
  const figures = (r: Cell[]) => getN(r, 'qty') != null || getN(r, 'rate') != null || getN(r, 'cost') != null || getN(r, 'hours') != null ||
    UOM.test(get(r, 'unit')) || streams.some(s => { const v = num(r[s.i]); return v != null && v !== 0 })

  let ref = ''
  for (const r of rows.slice(0, at)) {
    const t = r.map(clean).filter(Boolean)
    const i = t.findIndex(x => /^(site|contract|scheme|job|project|works order|order( no| number)?|ref(erence)?)\b/i.test(x))
    if (i >= 0 && !ref) ref = t.slice(i).join(' ').replace(/^(site|contract|scheme|job|project|works order|order( no| number)?|ref(erence)?)( (name|ref(erence)?|no|number))?[:\s-]*/i, '').trim()
  }

  // how the document is written: does it measure its work (then a row without figures is a heading), and is it in capitals?
  const body = rows.slice(at + 1)
  const described = body.filter(r => get(r, 'desc'))
  const ctx: Ctx = {
    measured: described.length > 0 && described.filter(figures).length / described.length >= 0.3,
    caps: described.length > 0 && described.filter(r => shouting(get(r, 'desc'))).length / described.length > 0.5,
  }

  const section = opts.section?.trim() ?? ''
  const sectionProp = section ? propertyOf(section) : null
  const sectionRoom = section && !sectionProp && roomHeading(section) ? tidyLocation(title(section)) : ''
  let prop = sectionProp ?? '', room = sectionRoom, trade = section && !sectionProp && !sectionRoom && !DOC_TITLE.test(section) ? title(section) : ''
  let lead = '', lastWasLine = false, justHeaded = false
  let carry: { code: string; desc: string } | null = null
  const lines: ParsedLine[] = []
  const nextRow = (from: number) => { for (let j = from + 1; j < rows.length; j++) if ((rows[j] ?? []).some(c => clean(c))) return rows[j]; return null }
  const heading = (text: string) => {
    const p = propertyOf(text)
    if (p) { prop = p; room = ''; trade = '' }
    else if (roomHeading(text.replace(/^\d+(\.\d+)*[.)]?\s+/, ''))) { if (!justHeaded) trade = ''; room = tidyLocation(title(text)) }
    else { if (!justHeaded) room = ''; trade = title(text.replace(/:$/, '')) }
    lead = /:$/.test(text) && !p ? text : ''
    lastWasLine = false; justHeaded = true; carry = null
  }

  for (let ri = at + 1; ri < rows.length; ri++) {
    const r = rows[ri] ?? []
    const texts = r.map(clean)
    if (!texts.some(Boolean)) { lastWasLine = false; continue }
    if (sig(r) === headSig) continue                                           // the header again, over a page break
    let desc = get(r, 'desc'), code = get(r, 'code')
    const filled = texts.filter(Boolean)
    const first = filled[0] ?? ''
    if (TOTALS.test(desc) || TOTALS.test(code) || TOTALS.test(first)) { lastWasLine = false; lead = ''; continue }
    if (!code && UPLIFTS.test(desc || first)) { lastWasLine = false; continue }
    const qty = getN(r, 'qty'), rate = getN(r, 'rate'), hours = getN(r, 'hours')
    let cost = getN(r, 'cost'), workstream = ''
    for (const s of streams) { const v = num(r[s.i]); if (v != null && v !== 0) { workstream = s.name; if (cost == null) cost = v; break } }
    const unitRaw = get(r, 'unit')

    if (!figures(r)) {
      // one line of text on its own (a Word paragraph, a heading row, a wrapped description) reads as words, whichever column it's in
      const lone = filled.length === 1 ? first : ''
      const text = lone || desc
      const prev = lines[lines.length - 1]
      if (text && !code && prev && lastWasLine && runsOn(prev.description, text)) {
        prev.description = `${prev.description} ${shouting(text) && !shouting(prev.description) ? text.toLowerCase() : text}`.replace(/\s+/g, ' ')
        continue
      }
      if (/^(note|nb|n\.b)\b/i.test(text)) { lastWasLine = false; continue }
      if (lone && FURNITURE.test(lone)) continue                                  // page numbers, "continued", print dates
      // a value alone in the property or location column names what the lines under it are for
      if (lone && col.prop != null && clean(r[col.prop]) === lone) { prop = propertyOf(lone) ?? lone.replace(/\.0+$/, ''); room = ''; lastWasLine = false; justHeaded = true; continue }
      if (lone && col.loc != null && clean(r[col.loc]) === lone) { room = tidyLocation(lone); lastWasLine = false; justHeaded = true; continue }
      // a description whose figures sit on the row below it ("Take up floor tiles and" / "dispose of off site · 12 m2")
      const nx = nextRow(ri)
      if (text && !headingLike(text, ctx) && nx && !get(nx, 'code') && figures(nx) && /^[a-z(&]/.test(get(nx, 'desc'))) { carry = { code, desc: text }; continue }
      if (lone && !(ctx.measured ? false : col.desc != null && clean(r[col.desc]) === lone && !headingLike(lone, ctx))) {
        if (words(lone) > 14) { lastWasLine = false; continue }               // a note, not a heading
        heading(lone); continue
      }
      if (code && desc && (headingLike(desc, ctx) || (ctx.measured && words(desc) <= 6 && !/[,&]$/.test(desc)))) { heading(desc); continue }
      if (!desc && !lone) { lastWasLine = false; continue }
      if (lone && !desc) desc = lone
    }
    if (!desc) { if (code && words(code) >= 3) { desc = code; code = '' } else if (!code) continue }
    if (carry) { code = code || carry.code; desc = `${carry.desc} ${desc}`; carry = null }
    if (lead && /^[a-z(]/.test(desc)) desc = `${lead} ${desc}`
    const comment = get(r, 'comment')
    const lineProp = col.prop != null && get(r, 'prop') ? (propertyOf(get(r, 'prop')) ?? get(r, 'prop').replace(/\.0+$/, '')) : prop
    const issues: string[] = []
    if (qty != null && rate != null && cost != null) {
      const calc = Math.round(qty * rate * 100 + 1e-7) / 100
      if (Math.abs(calc - cost) > 0.005) issues.push(`document cost £${cost.toFixed(2)} ≠ qty × rate £${calc.toFixed(2)}`)
    }
    if (rate == null && cost != null) issues.push(`total only: £${cost.toFixed(2)}`)
    if (rate == null) issues.push('no rate')
    if (qty == null) issues.push('no qty')
    if (!code) issues.push('no code')
    lines.push({
      include: true, code,
      room: tidyLocation(get(r, 'loc')) || room || 'General',
      description: sentence(desc) + (comment ? ` — ${comment}` : ''),
      qty, unit: unitRaw && !isNumText(unitRaw) ? unitRaw : '', rate, cost,
      property: lineProp, workstream: get(r, 'trade') ? title(get(r, 'trade')) : workstream || trade,
      hours, note: '', issues,
    })
    lastWasLine = true; justHeaded = false
  }
  if (lines.length < 2) return null
  // the words must come through: a read that loses the descriptions is a layout this doesn't understand
  if (lines.filter(l => letters(l.description) >= 6).length / lines.length < 0.8) return null
  if (opts.strict && measuredShare(lines) < 0.5 && workShare(lines) < 0.6) return null
  return { ref, lines, truncated: false }
}

/** Share of lines that carry a quantity, unit or money: a schedule, as against a survey or register laid out in a table. */
const measuredShare = (lines: ParsedLine[]) => lines.filter(l => l.qty != null || l.rate != null || l.cost != null || !!l.unit).length / lines.length
/** Words a line of work starts with. A survey or register lists things ("Floor tiles under vinyl"); a scope says what to do. */
const WORK = /^(to )?(allow|supply|fix|fit|install|renew|replace|remove|strip|take (up|down|off|out)|lay|relay|repair|make good|clean|wash|paint|redecorate|decorate|prepare|apply|test|inspect|survey|provide|erect|dismantle|demolish|break out|excavate|form|construct|build|rebuild|repoint|point|render|plaster|skim|board|seal|treat|ease|adjust|overhaul|service|re-?(hang|fix|bed|lay|felt|tile|roof|wire|point|render|glaze|site|instate)|rewire|upgrade|convert|move|relocate|refit|reinstate|dispose|cut|drill|hack|insulate|level|screed|tile|glaze|cap|isolate|disconnect|connect|commission|certify|carry out|undertake|clear|unblock|jet|rod|alter|adapt|extend|raise|lower|trim|sand|polish|varnish|stain|grout|mastic|patch|fill|infill|block up|brick up|box in|encase|secure|change|swap|check|investigate|attend|tidy|sanitise|sanitize|deep clean|redress|refix|resecure|ensure)\b/i
const workShare = (lines: ParsedLine[]) => lines.filter(l => WORK.test(l.description.replace(/^[^:]{1,30}:\s*/, '').trim())).length / lines.length

interface Ctx { measured: boolean; caps: boolean }
/** "Kitchen", "Bedroom 2", "Front elevation", "External works": a room or area name on its own, not a line about one
 *  ("Internal joinery" is a trade, "Kitchen units" a line). */
const roomHeading = (t: string) => ROOM.test(t.replace(/[:.]$/, '').trim())
/** A row of text that reads as a heading rather than a line of work. */
function headingLike(t: string, ctx: Ctx) {
  const core = t.replace(/^\d+(\.\d+)*[.)]?\s+/, '')
  return (!ctx.caps && shouting(t)) || /:$/.test(t) || !!propertyOf(t) || roomHeading(core) ||
    /^(section|element|part|block|phase|stage|trade|preliminaries|prelims)\b/i.test(core) ||
    (ctx.measured && /^\d+(\.\d+)*[.)]?\s+[A-Z]/.test(t) && words(core) <= 5)
}
/** The next row carries on the last line's description: it starts in lower case or with a joining word, or the
 *  last line stopped mid-phrase ("…and", "…to", "…,"). */
function runsOn(prev: string, text: string) {
  if (/^[a-z(&]/.test(text) || /^(including|incl\.?|and|or|to|with|complete with|together with|ditto)\b/i.test(text)) return true
  return /([,&/\-–]|\b(and|or|to|with|of|the|a|an|in|on|for|from|into|at|by|including|incl))$/i.test(prev.trim())
}

const SKIP_SHEET = /^(summary|collection|cover( sheet)?|contents|index|totals?|notes|instructions|front ?sheet|sign[- ]?off|tender summary|grand summary)$/i
const fingerprint = (b: ParsedBoq) => b.lines.map(l => `${l.description.toLowerCase().slice(0, 40)}|${l.qty ?? ''}`)

/** Every sheet of a workbook: the exact council layout first (as before), otherwise every sheet read by layout and
 *  put together — a sheet per block, house or trade names the lines on it. A sheet that only repeats another is dropped. */
export function readWorkbook(sheets: { name: string; rows: Cell[][] }[], opts: { strict?: boolean } = {}): ParsedBoq | null {
  for (const s of sheets) { const exact = readSchedule(s.rows.filter(r => r?.some(c => clean(c)))); if (exact) return exact }
  const reads: { name: string; boq: ParsedBoq }[] = []
  const many = sheets.filter(s => !SKIP_SHEET.test(s.name.trim())).length > 1
  for (const s of sheets) {
    if (sheets.length > 1 && SKIP_SHEET.test(s.name.trim())) continue
    const named = many && !/^sheet\s*\d+$/i.test(s.name.trim()) ? s.name.trim() : undefined
    const boq = readTable(s.rows, { section: named, strict: opts.strict })
    if (boq) reads.push({ name: s.name, boq })
  }
  if (!reads.length) return null
  // drop a sheet whose lines all appear on a bigger one (a "full list" beside per-house sheets, say) or on an earlier copy
  const kept = reads.filter((a, i) => !reads.some((b, j) => j !== i && (b.boq.lines.length > a.boq.lines.length || (b.boq.lines.length === a.boq.lines.length && j < i)) && (() => {
    const big = new Map<string, number>(); for (const f of fingerprint(b.boq)) big.set(f, (big.get(f) ?? 0) + 1)
    return fingerprint(a.boq).every(f => { const n = big.get(f) ?? 0; if (!n) return false; big.set(f, n - 1); return true })
  })()))
  return { ref: kept.find(k => k.boq.ref)?.boq.ref ?? '', lines: kept.flatMap(k => k.boq.lines), truncated: false }
}

type DocxEvent = { k: 'p'; text: string } | { k: 'row'; cells: string[] }
/** A Word document's tables, each read by layout. The paragraph just above a table names it (a property, room or
 *  trade); a table that runs on from the one before without its own header row uses that table's header. */
export function readDocxTables(ev: DocxEvent[], opts: { strict?: boolean } = {}): ParsedBoq | null {
  const tables: { above: string[]; rows: Cell[][] }[] = []
  let above: string[] = [], cur: Cell[][] | null = null
  for (const e of ev) {
    if (e.k === 'p') {
      if (cur) { tables.push({ above, rows: cur }); cur = null; above = [] }
      if (e.text.trim()) above.push(e.text.trim())
    } else (cur ??= []).push(e.cells)
  }
  if (cur) tables.push({ above, rows: cur })
  const out: ParsedBoq[] = []
  let lastHead: Cell[] | null = null
  for (const t of tables) {
    const name = [...t.above].reverse().find(p => words(p) <= 10 && letters(p) >= 2 && !/^(site|contract|scheme|job|project|works order|order|ref)/i.test(p))
    const rows = [...t.above.map(p => [p] as Cell[]), ...t.rows]
    const h = findHeader(rows)
    let read = h ? readTable(rows, { section: name, strict: opts.strict }) : null
    if (h) lastHead = rows[h.at]
    else if (lastHead) read = readTable([lastHead, ...t.rows], { section: name, strict: opts.strict })
    if (read) out.push(read)
  }
  if (!out.length) return null
  return { ref: out.find(o => o.ref)?.ref ?? '', lines: out.flatMap(o => o.lines), truncated: false }
}

/** A PDF's text laid back out as rows of cells. The columns come from the data itself — the clear vertical gaps
 *  that run down the table — and are then matched, left to right, to the header row's headings. That works whether
 *  the client's headings sit left, centred or right over their figures. Returns null when no header row is found. */
export function pdfRows(pages: PdfPage[]): Cell[][] | null {
  type T = { x: number; y: number; w: number; s: string }
  const lineSets: { page: number; toks: T[] }[] = []
  pages.forEach((p, page) => {
    const items = (p.items as T[]).filter(t => !/^(£|GBP)$/i.test(t.s.trim()))
      .map(t => ({ ...t, w: t.w ?? t.s.length * 4.5 })).sort((a, b) => a.y - b.y || a.x - b.x)
    let cur: T[] = []
    for (const t of items) { if (cur.length && Math.abs(t.y - cur[0].y) > 3) { lineSets.push({ page, toks: cur }); cur = [] } cur.push(t) }
    if (cur.length) lineSets.push({ page, toks: cur })
  })
  // join the pieces of one cell (words a space apart) before placing them; a column gap is wider than a space
  const cellsOf = (l: T[]) => {
    const out: T[] = []
    for (const t of [...l].sort((a, b) => a.x - b.x)) {
      const prev = out[out.length - 1]
      const charW = Math.max(2, prev ? prev.w / Math.max(1, prev.s.length) : 0)
      if (prev && t.x - (prev.x + prev.w) < charW * 1.2 && !isNumText(t.s) && !isNumText(prev.s)) { prev.s += ' ' + t.s; prev.w = t.x + t.w - prev.x }
      else out.push({ ...t })
    }
    return out
  }
  const cells = lineSets.map(l => ({ page: l.page, cells: cellsOf(l.toks) }))
  let headAt = -1, bestScore = 0
  cells.forEach((l, i) => {
    if (i > 200) return
    const set = new Set(l.cells.map(c => roleOf(c.s)).filter(Boolean))
    const score = set.size + (set.has('desc') ? 2 : 0)
    if (set.size >= 3 && (set.has('desc') || set.has('code')) && score > bestScore) { bestScore = score; headAt = i }
  })
  if (headAt < 0) return null
  const head = cells[headAt].cells
  const headSig = head.map(h => headText(h.s)).join('|')
  // the table body: below the header on its page, and on later pages below any repeat of it
  const body: typeof cells = []
  let seenHead = new Set<number>([cells[headAt].page])
  cells.forEach((l, i) => {
    if (i === headAt) return
    if (l.cells.map(c => headText(c.s)).join('|') === headSig) { seenHead.add(l.page); return }
    if (i < headAt && l.page === cells[headAt].page) return
    if (l.page !== cells[headAt].page && !seenHead.has(l.page) && cells.some((m, j) => j > i && m.page === l.page && m.cells.map(c => headText(c.s)).join('|') === headSig)) return
    body.push(l)
  })
  // where the data sits across the page: runs of x covered by text, split by the gaps between columns
  const marks = body.filter(l => !(l.cells.length === 1 && FURNITURE.test(l.cells[0].s))).flatMap(l => l.cells)   // not page numbers
  if (!marks.length) return null
  const lo = Math.floor(Math.min(...marks.map(c => c.x))), hi = Math.ceil(Math.max(...marks.map(c => c.x + c.w)))
  const cover = new Array(hi - lo + 2).fill(0)
  for (const c of marks) for (let x = Math.floor(c.x) - lo; x <= Math.ceil(c.x + c.w) - lo; x++) cover[x]++
  const runs: { a: number; b: number }[] = []
  for (let x = 0; x < cover.length; x++) {
    if (!cover[x]) continue
    const a = x; while (x < cover.length && cover[x]) x++
    runs.push({ a: a + lo, b: x - 1 + lo })
  }
  // match runs to headings in order: each run to the heading it overlaps or sits nearest, a heading taking two runs
  // only when that's much closer than the alternative (a heading can also have no data: an unpriced rate column)
  const gap = (r: { a: number; b: number }, h: T) => Math.max(0, h.x - r.b, r.a - (h.x + h.w))
  const SHARE = 20
  const n = runs.length, m = head.length
  const cost: number[][] = runs.map(() => new Array(m).fill(Infinity)), from: number[][] = runs.map(() => new Array(m).fill(-1))
  for (let j = 0; j < m; j++) cost[0][j] = gap(runs[0], head[j])
  for (let i = 1; i < n; i++) for (let j = 0; j < m; j++) for (let k = 0; k <= j; k++) {
    const c = cost[i - 1][k] + gap(runs[i], head[j]) + (k === j ? SHARE : 0)
    if (c < cost[i][j]) { cost[i][j] = c; from[i][j] = k }
  }
  const owner = new Array(n).fill(0)
  let j = cost[n - 1].indexOf(Math.min(...cost[n - 1]))
  for (let i = n - 1; i >= 0; i--) { owner[i] = j; j = from[i][j] }
  const columnOf = (c: T) => {
    const mid = c.x + c.w / 2
    let best = 0, d = Infinity
    runs.forEach((r, i) => { const dd = mid >= r.a && mid <= r.b ? 0 : Math.min(Math.abs(mid - r.a), Math.abs(mid - r.b)); if (dd < d) { d = dd; best = i } })
    return owner[best]
  }
  const out: Cell[][] = []
  cells.forEach((l, i) => {
    if (i < headAt && l.page === cells[headAt].page) { out.push([l.cells.map(c => c.s).join(' ')]); return }   // titles above: the ref
    if (i === headAt) { out.push(head.map(h => h.s)); return }
    if (!body.includes(l)) return
    const row: string[] = head.map(() => '')
    for (const c of l.cells) { const k = columnOf(c); row[k] = row[k] ? `${row[k]} ${c.s}` : c.s }
    out.push(row)
  })
  return out
}

/** A PDF read as a table by layout. Trusts it only when the words come through, most lines carry figures and the
 *  figures that can be checked add up; otherwise null and the AI reads it (it reads PDFs well, and flags its lines). */
export function readPdfTable(pages: PdfPage[]): ParsedBoq | null {
  const rows = pdfRows(pages)
  if (!rows) return null
  const boq = readTable(rows)
  // rebuilt from positions, so it must look like a schedule: most lines measured, and the figures add up
  if (!boq || boq.lines.length < 3 || measuredShare(boq.lines) < 0.5) return null
  const checkable = boq.lines.filter(l => l.qty != null && l.rate != null && l.cost != null)
  if (checkable.length && checkable.filter(l => !l.issues.some(i => i.startsWith('document cost'))).length / checkable.length < 0.8) return null
  return boq
}
