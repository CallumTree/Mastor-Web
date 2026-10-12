/**
 * The client's pack, pieced together: the spec list (every property, every workstream, the AMO's
 * quantities) and the works orders (the contracts — units, contract values, full addresses).
 * Every line is matched across the documents; whatever doesn't agree is kept, flagged and explained,
 * never silently dropped or "corrected". The works order is the contract, so its code, qty and rate
 * win when they differ — the review shows the spec list's figures beside them.
 */
import type { ParsedBoq, ParsedLine } from './boq'
import { tidyLocation } from './boq'
import { contractTrade, type WorksOrder, type WoLine } from './worksOrder'

export interface PackRead extends ParsedBoq {
  orders: WorksOrder[]
  /** lines found in both documents with the same code and quantity */
  agreed: number
  /** one plain sentence per disagreement between documents, or a document that doesn't add up */
  findings: string[]
  /** house number → full address, from the works orders */
  addresses: Record<string, string>
}

const r2 = (n: number) => Math.round(n * 100 + 1e-7) / 100
const gbp = (n: number) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sameQty = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) < 0.005)
const zero = (l: { rate: number | null }) => l.rate === 0
const label = (o: WorksOrder | undefined) => (o ? `${o.contract}${o.trade ? ` (${o.trade})` : ''}` : 'a works order')
const byNo = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

type Wo = WoLine & { order: WorksOrder }

function fromOrder(w: Wo, spec?: ParsedLine): ParsedLine {
  const room = spec?.room || tidyLocation(w.location) || 'General'
  const description = spec?.description || (w.comment && !spec ? `${w.description} (${w.comment})` : w.description)
  const issues: string[] = []
  if (w.qty == null) issues.push('no qty')
  if (w.rate == null) issues.push('no rate')
  if (w.qty != null && w.rate != null && w.cost != null && Math.abs(r2(w.qty * w.rate) - w.cost) > 0.011)
    issues.push(`works order prints ${gbp(w.cost)} ≠ qty × rate ${gbp(r2(w.qty * w.rate))}`)
  return {
    include: true, code: w.code, room, description, qty: w.qty, unit: w.unit || spec?.unit || '', rate: w.rate, cost: w.cost,
    property: w.property, workstream: spec?.workstream || w.order.trade || '', hours: spec?.hours ?? null, note: w.comment,
    contract: w.order.contract, issues,
  }
}

/** Pieces the documents together. Either side may be missing: a spec list alone, or works orders alone. */
export function readPack(specs: ParsedBoq[], orders: WorksOrder[]): PackRead {
  const addresses: Record<string, string> = {}
  for (const o of orders) for (const p of o.properties) if (p.address) addresses[p.property] = p.address
  for (const o of orders) o.trade = contractTrade(o.title, Object.values(addresses))
  const spec = specs.flatMap(s => s.lines)
  const findings: string[] = orders.flatMap(o => o.problems.map(p => `${label(o)}: ${p}`))
  const ref = orders.length ? orders.map(o => o.contract).filter(Boolean).join(' · ') : specs.map(s => s.ref).filter(Boolean).join(' · ')
  const columnCheck = specs.flatMap(s => s.columnCheck ?? [])
  if (!orders.length) return { ref, lines: spec, truncated: specs.some(s => s.truncated), columnCheck, orders, agreed: 0, findings, addresses, method: specs[0]?.method }

  const wos: Wo[] = orders.flatMap(o => o.lines.map(l => ({ ...l, order: o })))
  if (!spec.length) {
    const lines = wos.map(w => fromOrder(w))
    findings.push(...flagDuplicates(wos, lines))
    return { ref, lines, truncated: false, orders, agreed: 0, findings, addresses, method: 'table' }
  }

  const lines: ParsedLine[] = []
  const codeDiffs = new Map<string, string[]>()
  let agreed = 0
  const props = [...new Set([...spec.map(l => l.property), ...wos.map(w => w.property)])].sort(byNo)
  for (const p of props) {
    const S = spec.filter(l => l.property === p)
    const W = wos.filter(w => w.property === p)
    const usedS = new Set<ParsedLine>(), usedW = new Set<Wo>()
    const out = new Map<Wo | ParsedLine, ParsedLine>()
    const room = (x: { room?: string; location?: string }) => (x.room ?? tidyLocation(x.location ?? '')).toLowerCase()
    // pass 1: same code and quantity (same place first); pass 2: same code, quantity differs;
    // pass 3: same place and the same SoR family (first four characters) but a different code
    const passes: ((s: ParsedLine, w: Wo) => boolean)[] = [
      (s, w) => s.code === w.code && sameQty(s.qty, w.qty) && room(s) === tidyLocation(w.location).toLowerCase(),
      (s, w) => s.code === w.code && sameQty(s.qty, w.qty),
      (s, w) => s.code === w.code,
      (s, w) => s.code.slice(0, 4) === w.code.slice(0, 4) && room(s) === tidyLocation(w.location).toLowerCase(),
    ]
    passes.forEach((match, pass) => {
      for (const w of W) {
        if (usedW.has(w)) continue
        const s = S.find(x => !usedS.has(x) && match(x, w))
        if (!s) continue
        usedS.add(s); usedW.add(w)
        const line = fromOrder(w, s)
        if (pass < 2) {
          if (s.rate != null && w.rate != null && Math.abs(s.rate - w.rate) > 0.006) line.issues.push(`rate: works order ${gbp(w.rate)}, spec list £${s.rate}`)
          if (!line.issues.length) agreed++
        } else if (pass === 2) {
          if (!(zero(s) && zero(w))) line.issues.push(`qty: works order ${w.qty ?? 'none'}, spec list ${s.qty ?? 'none'}`)
        } else {
          line.issues.push(`code: works order ${w.code}${w.rate != null ? ` at ${gbp(w.rate)}` : ''}, spec list ${s.code}${s.rate != null ? ` at £${s.rate}` : ''}`)
          const k = `${w.code} on ${label(w.order)}${w.rate != null ? ` at ${gbp(w.rate)}` : ''} where the spec list has ${s.code}${s.rate != null ? ` at ${gbp(r2(s.rate))}` : ''}`
          codeDiffs.set(k, [...(codeDiffs.get(k) ?? []), p])
        }
        out.set(w, line)
      }
    })
    for (const w of W) if (!usedW.has(w)) {
      const line = fromOrder(w)
      if (!zero(w)) line.issues.push(`on ${w.order.contract} only — not in the spec list`)
      out.set(w, line)
    }
    for (const s of S) if (!usedS.has(s)) {
      const line = { ...s, issues: [...s.issues] }
      if (!zero(s)) line.issues.push('in the spec list only — not on any works order')
      out.set(s, line)
    }
    // keep the works order's own order, with spec-only lines after
    for (const w of W) lines.push(out.get(w)!)
    for (const s of S) if (!usedS.has(s)) lines.push(out.get(s)!)
  }
  findings.push(...flagDuplicates(wos, lines))

  // the plain-words summary of what didn't line up
  for (const [k, ps] of codeDiffs) findings.push(`${k} — no${ps.length > 1 ? 's' : ''}. ${ps.join(', ')}`)
  const specOnly = lines.filter(l => !l.contract && l.issues.some(i => i.startsWith('in the spec list only')))
  const val = (ls: ParsedLine[]) => gbp(r2(ls.reduce((t, l) => t + (l.qty ?? 0) * (l.rate ?? 0), 0)))
  if (specOnly.length) findings.push(`${specOnly.length} spec list line${specOnly.length === 1 ? '' : 's'} on no works order (${[...new Set(specOnly.map(l => `no. ${l.property}`))].join(', ')}), ${val(specOnly)} — included; check the council will pay for them`)
  const woOnly = lines.filter(l => l.issues.some(i => / only — not in the spec list$/.test(i)))
  if (woOnly.length) findings.push(`${woOnly.length} works order line${woOnly.length === 1 ? '' : 's'} not in the spec list (${[...new Set(woOnly.map(l => `no. ${l.property}`))].join(', ')}), ${val(woOnly)}`)
  const qtys = lines.filter(l => l.issues.some(i => i.startsWith('qty: works order')))
  for (const l of qtys) findings.push(`No. ${l.property} ${l.code}: ${l.issues.find(i => i.startsWith('qty:'))!.slice(5)}`)
  return { ref, lines, truncated: false, columnCheck, orders, agreed, findings, addresses, method: 'table' }
}

/** The same item for the same property on two contracts — usually one scaffold priced on both. */
function flagDuplicates(wos: Wo[], lines: ParsedLine[]): string[] {
  const seen = new Map<string, Wo>()
  const twice = new Map<string, { props: string[]; value: number }>()
  for (const w of wos) {
    if (zero(w)) continue
    const k = `${w.property}|${w.code}|${w.qty}`
    const first = seen.get(k)
    if (!first) { seen.set(k, w); continue }
    if (first.order === w.order) continue
    const line = lines.find(l => l.contract === w.order.contract && l.property === w.property && l.code === w.code && sameQty(l.qty, w.qty) && !l.issues.some(i => i.startsWith('also on')))
    line?.issues.push(`also on ${label(first.order)} for no. ${w.property} — check it isn’t priced twice`)
    const key = `${w.code} on both ${label(first.order)} and ${label(w.order)}`
    const t = twice.get(key) ?? { props: [], value: 0 }
    t.props.push(w.property); t.value = r2(t.value + (w.qty ?? 0) * (w.rate ?? 0)); twice.set(key, t)
  }
  return [...twice.entries()].map(([k, t]) => `${k} for no${t.props.length > 1 ? 's' : ''}. ${t.props.join(', ')} — ${gbp(t.value)} that may be priced twice`)
}
