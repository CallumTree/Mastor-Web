/**
 * Variation Register (PDF) — every VO on a job in one sheet: council ref, status, who has the ball,
 * pricing, which valuation it was claimed in, and the evidence held. Same drawing-sheet look as the
 * certificate, landscape so the columns breathe. Built on the device, nothing sent anywhere.
 */
import type { Job, Valuation, Variation } from './types'
import { lineValue, upliftAmounts, valRef } from './valuation'
import { money, qtyText, ukDate, voRef } from './format'
import { voCourt } from './chase'

export interface RegisterInput { job: Job; vos: Variation[]; vals: Valuation[]; company?: string; now?: number }

/** "Instructed — do the work" → "do the work"; keeps the action, drops the repeated status. */
const nextStep = (t: string) => { const x = t.replace(/^(Complete|Instructed) — /, ''); return x.charAt(0).toLowerCase() + x.slice(1) }

const p2 = (x: number) => Math.round(x * 100 + 1e-7) / 100

/** Group totals (base, before uplifts). Unpriced VOs are counted, never valued at £0. */
export function registerSummary(job: Job, vos: Variation[], vals: Valuation[], now = Date.now()) {
  const rows = [
    { key: 'claimed', label: 'Claimed in a valuation', test: (v: Variation) => !!v.valuationId && v.status !== 'Rejected' },
    { key: 'ready', label: 'Complete — not yet claimed', test: (v: Variation) => !v.valuationId && v.status === 'Complete' },
    { key: 'instructed', label: 'Instructed — work to do', test: (v: Variation) => !v.valuationId && v.status === 'Instructed' },
    { key: 'awaiting', label: 'Awaiting instruction', test: (v: Variation) => !v.valuationId && v.status === 'Identified' },
    { key: 'rejected', label: 'Rejected', test: (v: Variation) => v.status === 'Rejected' },
  ].map(r => {
    const set = vos.filter(r.test)
    const priced = set.filter(v => v.qty != null && v.rate != null)
    const base = p2(priced.reduce((s, v) => s + lineValue(v.qty, v.rate), 0))
    return { ...r, count: set.length, unpriced: set.length - priced.length, base }
  })
  const live = rows.filter(r => r.key !== 'rejected')
  const base = p2(live.reduce((s, r) => s + r.base, 0))
  const up = upliftAmounts(base, job.uplift1, job.uplift2)
  const overdue = vos.filter(v => voCourt(v, vals, now).tone === 'late').length
  return { rows, base, gross: p2(base + up.u1 + up.u2), unpriced: live.reduce((s, r) => s + r.unpriced, 0), overdue }
}

export async function buildVoRegister({ job, vos, vals, company, now = Date.now() }: RegisterInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const W = 297, H = 210, M = 12
  const INK: [number, number, number] = [26, 26, 46], MUTED: [number, number, number] = [90, 90, 122], COPPER: [number, number, number] = [168, 94, 40], RED: [number, number, number] = [176, 48, 40]
  const frame = () => {
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.rect(M - 4, M - 4, W - 2 * (M - 4), H - 2 * (M - 4))
    doc.setLineWidth(0.15); doc.rect(M - 2, M - 2, W - 2 * (M - 2), H - 2 * (M - 2))
  }
  frame()
  const sum = registerSummary(job, vos, vals, now)

  // ---- heading
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setCharSpace(1.2)
  doc.text((company || 'MASTOR').toUpperCase(), M, M + 4); doc.setCharSpace(0)
  doc.setFontSize(18); doc.setTextColor(...INK); doc.text('Variation Register', M, M + 13)
  doc.setFontSize(10); doc.setTextColor(...COPPER); doc.text(`${vos.length} variation${vos.length === 1 ? '' : 's'}  ·  as at ${ukDate(now)}`, M, M + 20)

  // ---- title block (right)
  const cells: [string, string][] = [['JOB', job.name], ['SITE', job.address || '—'], ['CLIENT', job.client || '—'], ['CONTRACT REF', job.contractRef || '—'], ['PO NUMBER', job.poNumber || 'NOT SET'], ['UPLIFTS', `${job.uplift1}% + ${job.uplift2}%`]]
  const tbX = 170, tbW = W - M - tbX, rowH = 9, y0 = M
  doc.setLineWidth(0.25); doc.setDrawColor(...INK); doc.rect(tbX, y0, tbW, rowH * 3)
  cells.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = tbX + col * (tbW / 2), yy = y0 + row * rowH
    if (col) doc.line(x, yy, x, yy + rowH)
    if (row) doc.line(tbX, yy, tbX + tbW, yy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...MUTED); doc.setCharSpace(0.6); doc.text(k, x + 1.8, yy + 3)
    doc.setCharSpace(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...(k === 'PO NUMBER' && !job.poNumber ? COPPER : INK))
    doc.text(doc.splitTextToSize(v, tbW / 2 - 3.6)[0], x + 1.8, yy + 7.2)
  })

  // ---- summary strip
  let y = y0 + rowH * 3 + 7
  const sw = (W - 2 * M) / (sum.rows.length + 1)
  doc.setLineWidth(0.25); doc.rect(M, y, W - 2 * M, 15)
  ;[...sum.rows.map(r => ({ label: r.label, value: money(r.base), note: `${r.count} VO${r.count === 1 ? '' : 's'}${r.unpriced ? ` · ${r.unpriced} unpriced` : ''}`, hot: false })),
    { label: 'Total incl. uplifts', value: money(sum.gross), note: `${money(sum.base)} base · excl. rejected`, hot: true }]
    .forEach((c, i) => {
      const x = M + i * sw
      if (i) doc.line(x, y, x, y + 15)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...MUTED); doc.setCharSpace(0.4); doc.text(c.label.toUpperCase(), x + 2, y + 3.6); doc.setCharSpace(0)
      doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.setTextColor(...(c.hot ? COPPER : INK)); doc.text(c.value, x + 2, y + 9)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(c.note, x + 2, y + 12.8)
    })
  y += 21

  // ---- register table
  const sorted = [...vos].sort((a, b) => a.number - b.number)
  const body = sorted.map(v => {
    const c = voCourt(v, vals, now)
    const val = vals.find(x => x.id === v.valuationId)
    const priced = v.qty != null && v.rate != null
    const ev = [v.photoIds.length ? `${v.photoIds.length} photo${v.photoIds.length === 1 ? '' : 's'}` : '', ...(v.attachments ?? []).map(a => a.name)].filter(Boolean).join('\n') || 'None held'
    return [
      voRef(v.number) + (v.code ? `\n${v.code}` : ''),
      v.clientRef || 'Not issued',
      v.description + (v.reason ? `\nReason: ${v.reason}` : ''),
      v.room || '—',
      ukDate(v.dateRaised) + (v.submittedAt ? `\nSent ${ukDate(v.submittedAt)}` : ''),
      v.status + (v.status === 'Rejected' ? '' : `\n${c.who === 'client' ? c.text : c.who === 'us' ? 'Next: ' + nextStep(c.text) : c.text}`),
      v.qty != null ? `${qtyText(v.qty)} ${v.unit}` : 'Not measured',
      v.rate != null ? money(v.rate) : 'Unpriced',
      priced ? money(lineValue(v.qty, v.rate)) : '—',
      val ? valRef(val.number) : '—',
      ev,
    ]
  })
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 18 },
    head: [['VO', 'COUNCIL REF', 'DESCRIPTION', 'LOCATION', 'RAISED', 'STATUS', 'QTY', 'RATE', 'VALUE', 'CLAIMED', 'EVIDENCE']],
    body: body.length ? body : [[{ content: 'No variations logged on this job.', colSpan: 11, styles: { halign: 'center', textColor: MUTED } }]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 7, textColor: INK, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, lineColor: [200, 196, 188], lineWidth: { bottom: 0.1 }, valign: 'top' },
    headStyles: { fontStyle: 'bold', fontSize: 5.8, textColor: MUTED, lineColor: INK, lineWidth: { bottom: 0.4 } },
    columnStyles: {
      0: { cellWidth: 18, font: 'courier', textColor: COPPER }, 1: { cellWidth: 22 }, 3: { cellWidth: 24 }, 4: { cellWidth: 20 },
      5: { cellWidth: 38 }, 6: { cellWidth: 17, halign: 'right' }, 7: { cellWidth: 18, halign: 'right', font: 'courier' },
      8: { cellWidth: 20, halign: 'right', font: 'courier' }, 9: { cellWidth: 14, font: 'courier' }, 10: { cellWidth: 30, fontSize: 6.3 },
    },
    didDrawPage: () => frame(),
    didParseCell: d => {
      if (d.section === 'head' && [6, 7, 8].includes(d.column.index)) d.cell.styles.halign = 'right'
      if (d.section !== 'body' || !sorted[d.row.index]) return
      const v = sorted[d.row.index]
      if (d.column.index === 5 && voCourt(v, vals, now).tone === 'late') d.cell.styles.textColor = RED
      if (d.column.index === 1 && !v.clientRef) d.cell.styles.textColor = MUTED
      if (v.status === 'Rejected') d.cell.styles.textColor = MUTED
    },
  })
  // @ts-expect-error — plugin adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 5
  if (y + 10 > H - 16) { doc.addPage(); frame(); y = M + 4 }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(`Values are base (Schedule of Rates) before uplifts unless stated. Unpriced or unmeasured variations are listed but not valued.${sum.overdue ? ` ${sum.overdue} instruction${sum.overdue === 1 ? ' is' : 's are'} overdue (14+ days with the client) — shown in red.` : ''}`, W - 2 * M), M, y)

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setCharSpace(0.6)
    doc.text(`${(job.contractRef || job.name).toUpperCase()} · VARIATION REGISTER · ${ukDate(now).toUpperCase()} · SHEET ${p} OF ${pages}`, M, H - M + 1)
    doc.setCharSpace(0); doc.text('Prepared with Mastor', W - M - 1, H - M + 1, { align: 'right' })
  }
  return doc.output('blob')
}

export const registerFileName = (job: Job, now = Date.now()) =>
  `${(job.contractRef || job.name).replace(/[^A-Za-z0-9-]+/g, '_')}_VO-Register_${new Date(now).toISOString().slice(0, 10)}.pdf`
