/**
 * Invoices out to the accounts package, so nobody types them in twice.
 * Xero: its "Import sales invoices" CSV template. QuickBooks Online: its invoice import CSV.
 * One line per invoice (the valuation's net amount), VAT coded from the invoice's own rate.
 * Only real invoices are exported — a valuation without an invoice number is never included.
 */
import type { Job, ScopeItem, Valuation, Variation } from './types'
import { invoiceAmounts } from './invoice'
import { dueAt } from './chase'
import { valRef } from './valuation'

export type AccountsFormat = 'xero' | 'quickbooks'
export interface InvoiceRow { job: Job; val: Valuation; net: number; vat: number; total: number; rate: number; date: number; due: number | null }

export function invoiceRows(jobs: Job[], vals: Valuation[], scope: ScopeItem[], vos: Variation[], from?: number, to?: number): InvoiceRow[] {
  const out: InvoiceRow[] = []
  for (const v of vals) {
    if (!v.invoiceNumber || !v.invoiceDate) continue
    if ((from != null && v.invoiceDate < from) || (to != null && v.invoiceDate >= to)) continue
    const job = jobs.find(j => j.id === v.jobId); if (!job) continue
    const a = invoiceAmounts(job, v, scope.filter(s => s.jobId === job.id), vos.filter(x => x.jobId === job.id))
    out.push({ job, val: v, ...a, date: v.invoiceDate, due: dueAt(v, job) })
  }
  return out.sort((a, b) => a.date - b.date || String(a.val.invoiceNumber).localeCompare(String(b.val.invoiceNumber), 'en', { numeric: true }))
}

const dmy = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }
const cell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const csv = (rows: (string | number)[][]) => rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'
const xeroTax = (r: number) => (r === 20 ? '20% (VAT on Income)' : r === 5 ? '5% (VAT on Income)' : r === 0 ? 'Zero Rated Income' : `${r}% (VAT on Income)`)
const qbTax = (r: number) => (r === 20 ? '20.0% S' : r === 5 ? '5.0% R' : r === 0 ? '0.0% Z' : `${r.toFixed(1)}%`)
export const describe = (r: InvoiceRow) => [`Interim valuation ${valRef(r.val.number)}`, r.job.name, r.job.contractRef, r.job.poNumber ? `PO ${r.job.poNumber}` : ''].filter(Boolean).join(' — ')

export function accountsCsv(rows: InvoiceRow[], format: AccountsFormat, accountCode = '200'): string {
  if (format === 'xero') {
    return csv([
      ['*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion', 'POPostalCode', 'POCountry',
        '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', 'Discount', '*AccountCode', '*TaxType', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency', 'BrandingTheme'],
      ...rows.map(r => [r.job.client || r.job.name, '', '', '', '', '', '', '', '', '',
        r.val.invoiceNumber!, r.job.poNumber || r.job.contractRef || '', dmy(r.date), dmy(r.due ?? r.date), '', describe(r), 1, r.net.toFixed(2), '', accountCode, xeroTax(r.rate), '', '', '', '', 'GBP', '']),
    ])
  }
  return csv([
    ['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Terms', 'Location', 'Memo', 'Item(Product/Service)', 'ItemDescription', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'ItemTaxCode', 'ItemTaxAmount', 'Currency'],
    ...rows.map(r => [r.val.invoiceNumber!, r.job.client || r.job.name, dmy(r.date), dmy(r.due ?? r.date), '', '', r.job.poNumber ? `PO ${r.job.poNumber}` : '',
      'Construction works', describe(r), 1, r.net.toFixed(2), r.net.toFixed(2), qbTax(r.rate), r.vat.toFixed(2), 'GBP']),
  ])
}

/** Start of this month and last month, for the period picker. */
export function periods(now = new Date()) {
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  return { thisMonth: [m0, undefined] as const, lastMonth: [m1, m0] as const, all: [undefined, undefined] as const }
}
