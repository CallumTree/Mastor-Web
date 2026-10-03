/**
 * VAT invoices — one per issued valuation. Numbers carry on from the company's own sequence and are
 * never reused: if a number is already on any invoice, the next free one is used.
 */
import type { CompanySettings, Job, ScopeItem, Valuation, Variation } from './types'
import { pennies, valRef, valTotals } from './valuation'
import { money, ukDate } from './format'
import { dueAt } from './chase'

export const formatInvoiceNo = (s: CompanySettings, n: number) => `${s.invoicePrefix}${String(n).padStart(s.invoicePad || 0, '0')}`

export function allocateInvoiceNo(s: CompanySettings, allVals: Valuation[]): { number: string; next: number } {
  const used = new Set(allVals.map(v => v.invoiceNumber).filter(Boolean))
  let n = Math.max(1, Math.floor(s.nextInvoiceNumber || 1))
  while (used.has(formatInvoiceNo(s, n))) n++
  return { number: formatInvoiceNo(s, n), next: n + 1 }
}

/** What's missing before a legal VAT invoice can be produced. */
export function missingForInvoice(s: CompanySettings | undefined): string[] {
  if (!s) return ['company details']
  const m: string[] = []
  if (!s.name.trim()) m.push('company name'); if (!s.address.trim()) m.push('company address')
  if (!s.vatNumber.trim()) m.push('VAT number'); if (!s.sortCode.trim() || !s.accountNumber.trim()) m.push('bank details')
  return m
}

export function invoiceAmounts(job: Job, val: Valuation, scope: ScopeItem[], vos: Variation[], rate?: number) {
  const net = valTotals(job, val.id, scope, vos).gross
  const r = rate ?? val.invoiceVatRate ?? 20
  const vat = pennies(net * r / 100)
  return { net, vat, total: pennies(net + vat), rate: r }
}

export async function buildInvoice({ job, val, scope, vos, settings }: { job: Job; val: Valuation; scope: ScopeItem[]; vos: Variation[]; settings: CompanySettings }): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 14
  const INK: [number, number, number] = [26, 26, 46], MUTED: [number, number, number] = [90, 90, 122], COPPER: [number, number, number] = [168, 94, 40]
  const a = invoiceAmounts(job, val, scope, vos)
  const due = dueAt(val, job)
  const lines = (t: string) => t.split(/\n|,\s*(?=\S)/).map(x => x.trim()).filter(Boolean)
  doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.rect(M - 6, M - 6, W - 2 * (M - 6), H - 2 * (M - 6)); doc.setLineWidth(0.15); doc.rect(M - 4, M - 4, W - 2 * (M - 4), H - 2 * (M - 4))

  // supplier (top left) + title (top right)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...INK); doc.text(settings.name, M, M + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
  let y = M + 12
  for (const l of [...lines(settings.address), settings.phone, settings.email].filter(Boolean)) { doc.text(l, M, y); y += 4 }
  doc.text(`VAT reg. no. ${settings.vatNumber}`, M, y + 2); if (settings.companyNumber) doc.text(`Company no. ${settings.companyNumber}`, M, y + 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...COPPER); doc.text('VAT INVOICE', W - M, M + 8, { align: 'right' })

  // title block of invoice facts (right)
  const cells: [string, string][] = [['INVOICE NO.', val.invoiceNumber ?? '—'], ['DATE / TAX POINT', val.invoiceDate ? ukDate(val.invoiceDate) : '—'],
    ['PO NUMBER', job.poNumber || '—'], ['CONTRACT REF', job.contractRef || '—'], ['VALUATION', valRef(val.number)], ['PAYMENT DUE', due ? ukDate(due) : '—']]
  const tbX = 112, tbW = W - M - tbX, rh = 9
  let ty = M + 16
  doc.setLineWidth(0.25); doc.rect(tbX, ty, tbW, rh * 3)
  cells.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = tbX + col * (tbW / 2), yy = ty + row * rh
    if (col) doc.line(x, yy, x, yy + rh); if (row) doc.line(tbX, yy, tbX + tbW, yy)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...MUTED); doc.text(k, x + 1.8, yy + 3)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(v, tbW / 2 - 3.6)[0], x + 1.8, yy + 7.2)
  })

  // invoice to
  y = Math.max(y + 16, ty + rh * 3 + 10)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text('INVOICE TO', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(job.client || '—', M, y + 5)
  doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(`Site: ${job.name}${job.address ? `, ${job.address}` : ''}`, M, y + 10)

  // the line + totals
  y += 20
  doc.setDrawColor(...INK); doc.setLineWidth(0.4); doc.line(M, y, W - M, y)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text('DESCRIPTION', M + 1, y + 4); doc.text('NET', W - M - 1, y + 4, { align: 'right' })
  doc.setLineWidth(0.1); doc.line(M, y + 6, W - M, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK)
  const desc = doc.splitTextToSize(`Interim valuation ${valRef(val.number)} — ${job.name}${job.contractRef ? ` (${job.contractRef})` : ''}. Works as detailed on the valuation certificate ${valRef(val.number)}${val.issuedAt ? ` issued ${ukDate(val.issuedAt)}` : ''}.`, 130)
  doc.text(desc, M + 1, y + 12)
  doc.setFont('courier', 'normal'); doc.text(money(a.net), W - M - 1, y + 12, { align: 'right' })
  y += 12 + desc.length * 4.5 + 6
  doc.line(M, y, W - M, y)
  const tx = 120, rows: [string, string, boolean?][] = [['Net', money(a.net)], [`VAT @ ${a.rate}%`, money(a.vat)], ['Total due', money(a.total), true]]
  rows.forEach(([k, v, strong], i) => {
    const yy = y + 6 + i * 7
    doc.setFont('helvetica', strong ? 'bold' : 'normal'); doc.setFontSize(strong ? 11 : 9); doc.setTextColor(...INK); doc.text(k, tx, yy)
    doc.setFont('courier', strong ? 'bold' : 'normal'); doc.setTextColor(...(strong ? COPPER : INK)); doc.text(v, W - M - 1, yy, { align: 'right' })
  })
  doc.setLineWidth(0.35); doc.line(tx, y + 15.5, W - M, y + 15.5)

  // bank details
  y += 34
  doc.setDrawColor(...INK); doc.setLineWidth(0.25); doc.rect(M, y, 92, 30)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text('PAY BY BANK TRANSFER', M + 2, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK)
  ;[['Account name', settings.accountName || settings.name], ['Bank', settings.bankName || '—'], ['Sort code', settings.sortCode], ['Account no.', settings.accountNumber]].forEach(([k, v], i) => {
    doc.setTextColor(...MUTED); doc.text(k, M + 2, y + 11 + i * 5); doc.setTextColor(...INK); doc.text(v, M + 30, y + 11 + i * 5)
  })
  doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(`Please quote invoice ${val.invoiceNumber} and PO ${job.poNumber || '—'} with your payment.${due ? ` Payment due by ${ukDate(due)}.` : ''}`, 76), M + 100, y + 6)

  doc.setFontSize(6); doc.setCharSpace(0.6); doc.text(`${(val.invoiceNumber ?? '').toUpperCase()} · ${valRef(val.number)} · ${(job.contractRef || job.name).toUpperCase()}`, M, H - M + 1); doc.setCharSpace(0)
  return doc.output('blob')
}

export const invoiceFileName = (job: Job, val: Valuation) => `Invoice_${(val.invoiceNumber ?? 'draft').replace(/[^A-Za-z0-9-]+/g, '_')}_${(job.contractRef || job.name).replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`
