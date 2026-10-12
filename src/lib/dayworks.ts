/**
 * Dayworks: work done on time and materials. Labour is priced from the framework's hourly labour
 * rates (imported with the schedule); materials and plant at net cost plus whatever percentage the
 * contract allows (0% unless you set it — never assumed). Claimed through a variation.
 */
import type { Dayworks, Job, Variation } from './types'
import { pennies } from './valuation'
import { money, ukDate } from './format'

export interface DwTotals { labour: number; labourHours: number; materials: number; plant: number; addition: number; total: number; unpriced: number }

export function dwTotals(d: Dayworks): DwTotals {
  const labour = pennies(d.labour.reduce((t, l) => t + (l.hours != null && l.rate != null ? l.hours * l.rate : 0), 0))
  const labourHours = d.labour.reduce((t, l) => t + (l.hours ?? 0), 0)
  const materials = pennies(d.materials.reduce((t, m) => t + (m.amount ?? 0), 0))
  const plant = pennies(d.plant.reduce((t, m) => t + (m.amount ?? 0), 0))
  const addition = pennies((materials + plant) * (d.materialsPct || 0) / 100)
  const unpriced = d.labour.filter(l => l.hours != null && l.rate == null).length + [...d.materials, ...d.plant].filter(m => m.description && m.amount == null).length
  return { labour, labourHours, materials, plant, addition, total: pennies(labour + materials + plant + addition), unpriced }
}

export const dwRef = (n: number) => `DW ${n}`

/** The variation a dayworks sheet is claimed through: one item at the sheet's total. */
export function dayworksVariation(d: Dayworks, job: Job, number: number, existing?: Variation): Variation {
  const t = dwTotals(d)
  return {
    ...(existing ?? { id: `vo-${d.id}`, photoIds: [], dateRaised: Date.now(), valuationId: null, clientRef: '' }),
    jobId: job.id, number: existing?.number ?? number,
    description: `Dayworks ${dwRef(d.number)} — ${d.description || 'see sheet'}`,
    room: existing?.room ?? '', qty: 1, unit: 'item', rate: t.unpriced ? null : t.total, code: dwRef(d.number).replace(' ', ''),
    reason: `Dayworks sheet ${dwRef(d.number)} of ${ukDate(new Date(d.date + 'T12:00:00').getTime())}${d.signedBy ? `, signed by ${d.signedBy}` : ', not signed yet'}`,
    status: existing?.status ?? (d.signedBy ? 'Instructed' : 'Identified'),
  } as Variation
}

/** Dayworks sheet PDF for the client to sign (or as the signed record). */
export async function buildDayworksPdf(d: Dayworks, job: Job, company?: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14
  const INK: [number, number, number] = [18, 19, 22], MUTED: [number, number, number] = [86, 91, 99], LINE: [number, number, number] = [201, 206, 211]
  const t = dwTotals(d)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setCharSpace(1.2); doc.text((company || 'MASTOR').toUpperCase(), M, M + 2); doc.setCharSpace(0)
  doc.setFontSize(18); doc.setTextColor(...INK); doc.text(`Dayworks sheet ${dwRef(d.number)}`, M, M + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  const facts = [['Job', job.name], ['Client', job.client], ['Contract ref', job.contractRef], ['PO', job.poNumber || 'Not set'], ['Date', ukDate(new Date(d.date + 'T12:00:00').getTime())]]
  let y = M + 19
  facts.forEach(([k, v]) => { doc.setTextColor(...MUTED); doc.text(k, M, y); doc.setTextColor(...INK); doc.text(v || '—', M + 30, y); y += 5 })
  y += 2
  const work = doc.splitTextToSize(`Work done: ${d.description || '—'}`, W - 2 * M); doc.text(work, M, y); y += work.length * 4.5 + 3
  const table = (head: string[], body: (string | number)[][], foot: string[]) => {
    autoTable(doc, { startY: y, margin: { left: M, right: M }, theme: 'plain', head: [head], body: body.map(r => r.map(String)), foot: [foot],
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 1.6, lineColor: LINE, lineWidth: { bottom: 0.15 } },
      headStyles: { fontStyle: 'bold', fontSize: 7.5, textColor: MUTED, lineColor: INK, lineWidth: { bottom: 0.4 } },
      footStyles: { fontStyle: 'bold', textColor: INK }, columnStyles: { [head.length - 1]: { halign: 'right' }, [head.length - 2]: { halign: 'right' } } })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
  }
  table(['Labour', 'Hours', 'Rate', 'Amount'], d.labour.map(l => [l.label || l.trade, l.hours ?? '—', l.rate != null ? money(l.rate) : '—', l.hours != null && l.rate != null ? money(pennies(l.hours * l.rate)) : '—']), ['Labour', String(t.labourHours), '', money(t.labour)])
  if (d.materials.length) table(['Materials (net cost)', '', 'Amount'], d.materials.map(m => [m.description, '', m.amount != null ? money(m.amount) : '—']), ['Materials', '', money(t.materials)])
  if (d.plant.length) table(['Plant (net cost)', '', 'Amount'], d.plant.map(m => [m.description, '', m.amount != null ? money(m.amount) : '—']), ['Plant', '', money(t.plant)])
  doc.setFontSize(9.5)
  if (t.addition) { doc.text(`Addition on materials and plant at ${d.materialsPct}%`, M, y); doc.text(money(t.addition), W - M, y, { align: 'right' }); y += 6 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Total (excl. VAT)', M, y); doc.text(money(t.total), W - M, y, { align: 'right' }); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  doc.text('Agreed on behalf of the client', M, y); doc.setDrawColor(...INK); doc.line(M, y + 14, M + 80, y + 14); doc.line(M + 100, y + 14, W - M, y + 14)
  doc.text(d.signedBy ? `Name: ${d.signedBy}` : 'Name', M, y + 19); doc.text(d.signedAt ? `Date: ${ukDate(d.signedAt)}` : 'Date', M + 100, y + 19)
  doc.setFontSize(6.5); doc.text(`${(job.contractRef || job.name).toUpperCase()} · ${dwRef(d.number)}`, M, H - 8); doc.text('Prepared with Mastor', W - M, H - 8, { align: 'right' })
  return doc.output('blob')
}
