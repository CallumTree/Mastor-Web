/**
 * Interim Valuation Certificate (PDF) — laid out like a drawing sheet: border, title block,
 * ruled schedule of lines, totals. Built on the device (jsPDF), nothing sent anywhere.
 */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { lineValue, upliftAmounts, valRef, valTotals } from './valuation'
import { money, qtyText, ukDate, voRef } from './format'
import { dueAt } from './chase'

export interface CertificateInput { job: Job; val: Valuation; vals: Valuation[]; scope: ScopeItem[]; vos: Variation[]; company?: string }

export async function buildCertificate({ job, val, vals, scope, vos, company }: CertificateInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 12
  const INK: [number, number, number] = [26, 26, 46], MUTED: [number, number, number] = [90, 90, 122], COPPER: [number, number, number] = [168, 94, 40]

  const t = valTotals(job, val.id, scope, vos)
  const up = upliftAmounts(t.base, job.uplift1, job.uplift2)
  const prev = vals.filter(v => v.status === 'Issued' && v.number < val.number).reduce((s, v) => s + valTotals(job, v.id, scope, vos).gross, 0)
  const issued = val.issuedAt ? ukDate(val.issuedAt) : 'DRAFT — not issued'
  const due = dueAt(val, job)

  // ---- sheet border + drawing-style frame
  const frame = () => {
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.rect(M - 4, M - 4, W - 2 * (M - 4), H - 2 * (M - 4))
    doc.setLineWidth(0.15); doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2))
  }
  frame()

  // ---- heading
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setCharSpace(1.2)
  doc.text((company || 'MASTOR').toUpperCase(), M, M + 4)
  doc.setCharSpace(0)
  doc.setFontSize(18); doc.setTextColor(...INK); doc.text('Interim Valuation Certificate', M, M + 13)
  doc.setFontSize(11); doc.setTextColor(...COPPER); doc.text(`${valRef(val.number)}${val.status === 'Open' ? '  ·  DRAFT' : ''}`, M, M + 20)

  // ---- title block (right) : ruled cells
  const cells: [string, string][] = [
    ['JOB', job.name], ['SITE', job.address || '—'], ['CLIENT', job.client || '—'],
    ['CONTRACT REF', job.contractRef || '—'], ['PO NUMBER', job.poNumber || 'NOT SET'],
    ['VALUATION', valRef(val.number)], ['DATE ISSUED', issued], ['PAYMENT DUE', due ? ukDate(due) : '—'],
  ]
  const tbX = 108, tbW = W - M - tbX, rowH = 9
  let y = M + 26
  doc.setLineWidth(0.25); doc.setDrawColor(...INK)
  doc.rect(tbX, y, tbW, rowH * 4)
  cells.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = tbX + col * (tbW / 2), yy = y + row * rowH
    if (col) doc.line(x, yy, x, yy + rowH)
    if (row) doc.line(tbX, yy, tbX + tbW, yy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...MUTED); doc.setCharSpace(0.6); doc.text(k, x + 1.8, yy + 3)
    doc.setCharSpace(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...(k === 'PO NUMBER' && !job.poNumber ? COPPER : INK))
    doc.text(doc.splitTextToSize(v, tbW / 2 - 3.6)[0], x + 1.8, yy + 7.2)
  })

  // headline figure (left)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setCharSpace(0.8)
  doc.text('THIS VALUATION (INCL. UPLIFTS, EXCL. VAT)', M, y + 6); doc.setCharSpace(0)
  doc.setFont('courier', 'normal'); doc.setFontSize(22); doc.setTextColor(...COPPER); doc.text(money(t.gross), M, y + 17)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(`Cumulative to date ${money(prev + t.gross)}  ·  previously certified ${money(prev)}`, M, y + 24)
  y += rowH * 4 + 8

  // ---- schedule of lines
  const byProp = scope.some(x => x.property)
  const s = scope.filter(x => x.valuationId === val.id).sort((a, b) => byProp ? (a.property ?? '').localeCompare(b.property ?? '', 'en', { numeric: true }) || a.order - b.order : a.room.localeCompare(b.room) || a.order - b.order)
  const o = vos.filter(x => x.valuationId === val.id).sort((a, b) => a.number - b.number)
  const body: (string | { content: string; colSpan: number; styles: object })[][] = []
  const section = (label: string) => body.push([{ content: label, colSpan: 6, styles: { fontStyle: 'bold', textColor: COPPER, fillColor: [247, 243, 235], fontSize: 7 } }])
  const line = (i: ScopeItem) => [i.code || '—', i.description, i.room + (i.workstream ? `\n${i.workstream}` : ''), `${qtyText(i.qty!)} ${i.unit}`, money(i.rate!), money(lineValue(i.qty, i.rate))]
  if (byProp) {
    for (const p of [...new Set(s.map(i => i.property || '—'))]) {
      const ls = s.filter(i => (i.property || '—') === p)
      section(p === '—' ? 'UNASSIGNED' : `NO. ${p}`)
      for (const i of ls) body.push(line(i))
      body.push([{ content: `Subtotal No. ${p}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 7, font: 'helvetica', textColor: INK } }, { content: money(ls.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)), colSpan: 1, styles: { halign: 'right', fontStyle: 'bold', font: 'courier' } }])
    }
  } else {
    if (s.length) section('CONTRACT SCOPE')
    for (const i of s) body.push(line(i))
  }
  if (o.length) section('VARIATIONS')
  for (const v of o) body.push([voRef(v.number) + (v.clientRef ? `\n${v.clientRef}` : ''), v.description + (v.code ? `  [${v.code}]` : ''), v.room, `${qtyText(v.qty!)} ${v.unit}`, money(v.rate!), money(lineValue(v.qty, v.rate))])

  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 22 },
    head: [['REF', 'DESCRIPTION', 'ROOM', 'QTY', 'RATE', 'AMOUNT']], body,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 7.5, textColor: INK, cellPadding: { top: 1.8, bottom: 1.8, left: 1.6, right: 1.6 }, lineColor: [200, 196, 188], lineWidth: { bottom: 0.1 } },
    headStyles: { fontStyle: 'bold', fontSize: 6, textColor: MUTED, lineColor: INK, lineWidth: { bottom: 0.4 } },
    columnStyles: { 0: { cellWidth: 20, font: 'courier', textColor: COPPER }, 2: { cellWidth: 24 }, 3: { cellWidth: 18, halign: 'right' }, 4: { cellWidth: 20, halign: 'right', font: 'courier' }, 5: { cellWidth: 24, halign: 'right', font: 'courier' } },
    didDrawPage: () => frame(),
    didParseCell: d => { if (d.section === 'head' && d.column.index >= 3) d.cell.styles.halign = 'right' },
  })
  // @ts-expect-error — plugin adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 6
  // totals block needs ~8 rows; only start a new sheet if it genuinely won't fit
  if (y + 8 * 6.4 + 6 > H - 18) { doc.addPage(); frame(); y = M + 6 }

  // ---- totals block (right)
  const rows: [string, string, boolean?][] = [
    ['Contract scope', money(t.scopeBase)], ['Variations', money(t.voBase)], ['Base total', money(t.base), true],
    [`Uplift 1 (${job.uplift1}%)`, money(up.u1)], [`Uplift 2 (${job.uplift2}%)`, money(up.u2)],
    ['This valuation', money(t.gross), true], ['Previously certified', money(prev)], ['Cumulative to date', money(prev + t.gross), true],
  ]
  const tx = 118, tw = W - M - tx
  doc.setDrawColor(...INK); doc.setLineWidth(0.25); doc.rect(tx, y, tw, rows.length * 6.4)
  rows.forEach(([k, v, strong], i) => {
    const yy = y + i * 6.4
    if (i) { doc.setLineWidth(strong ? 0.35 : 0.1); doc.line(tx, yy, tx + tw, yy) }
    doc.setFont('helvetica', strong ? 'bold' : 'normal'); doc.setFontSize(7.5); doc.setTextColor(...INK); doc.text(k, tx + 2, yy + 4.4)
    doc.setFont('courier', strong ? 'bold' : 'normal'); doc.setTextColor(...(k === 'This valuation' ? COPPER : INK)); doc.text(v, tx + tw - 2, yy + 4.4, { align: 'right' })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize('All amounts exclude VAT. Rates as the contract Schedule of Rates; uplifts applied as agreed under the contract. Please quote the PO number and valuation reference on payment.', 96), M, y + 4)
  if (job.contractValue) doc.text(`PO value (all-in): ${money(job.contractValue)}`, M, y + 20)

  // ---- footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setCharSpace(0.6)
    doc.text(`${(job.contractRef || job.name).toUpperCase()} · ${valRef(val.number)} · SHEET ${p} OF ${pages}`, M, H - M + 1)
    doc.setCharSpace(0)
    doc.text('Prepared with Mastor', W - M - 1, H - M + 1, { align: 'right' })
  }
  return doc.output('blob')
}

export const certificateFileName = (job: Job, val: Valuation) =>
  `${(job.contractRef || job.name).replace(/[^A-Za-z0-9-]+/g, '_')}_${valRef(val.number)}${val.status === 'Open' ? '_DRAFT' : ''}.pdf`

/** Share on phones (email/WhatsApp/Drive) where supported, otherwise download. */
export async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: name }); return } catch { /* cancelled — fall through to download */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
