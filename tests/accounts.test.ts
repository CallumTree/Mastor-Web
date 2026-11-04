import { accountsCsv, invoiceRows } from '../src/lib/accounts'
import type { Job, ScopeItem, Valuation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const job = { id: 'j', name: '32 Park Road', client: 'Example Council', contractRef: 'CR00290', poNumber: 'PO26061', uplift1: 10, uplift2: 0, paymentTermsDays: 30 } as Job
const val = (id: string, n: number, inv: string | null, date: number | null): Valuation => ({ id, jobId: 'j', number: n, status: 'Issued', createdAt: 1, issuedAt: date, invoiceNumber: inv, invoiceDate: date, invoiceVatRate: 20 })
const scope = [{ id: 's', jobId: 'j', code: 'A', description: '', room: '', qty: 10, unit: 'NO', rate: 100, valuationId: 'v1', order: 1, createdAt: 1 }] as ScopeItem[]
const vals = [val('v1', 1, 'TS-0042', Date.UTC(2026, 8, 15)), val('v2', 2, null, null)]

const rows = invoiceRows([job], vals, scope, [])
ok(rows.length === 1 && rows[0].net === 1100 && rows[0].vat === 220 && rows[0].total === 1320, 'only invoiced valuations; net £1,100 (with uplift), VAT £220')
ok(invoiceRows([job], vals, scope, [], Date.UTC(2026, 9, 1)).length === 0, 'period filter by invoice date')

const x = accountsCsv(rows, 'xero', '200').split('\r\n')
ok(x[0].startsWith('*ContactName,EmailAddress') && x[0].includes('*InvoiceNumber') && x[0].includes('*TaxType'), 'Xero header row')
const xr = x[1].split(',')
const head = x[0].split(',')
const col = (n: string) => xr[head.indexOf(n)]
ok(col('*ContactName') === 'Example Council' && col('*InvoiceNumber') === 'TS-0042', 'contact and invoice number')
ok(col('*InvoiceDate') === '15/09/2026' && col('*DueDate') === '15/10/2026', 'UK dates; due 30 days from the invoice date')
ok(col('*UnitAmount') === '1100.00' && col('*Quantity') === '1' && col('*AccountCode') === '200' && col('*TaxType') === '20% (VAT on Income)', 'net, account code, VAT type')
ok(col('Reference') === 'PO26061' && x[1].includes('Interim valuation VAL I — 32 Park Road — CR00290 — PO PO26061'), 'PO as reference; description names the valuation, job and PO')

const q = accountsCsv(rows, 'quickbooks').split('\r\n')
ok(q[0] === 'InvoiceNo,Customer,InvoiceDate,DueDate,Terms,Location,Memo,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount,ItemTaxCode,ItemTaxAmount,Currency', 'QuickBooks header row')
ok(q[1].startsWith('TS-0042,Example Council,15/09/2026,15/10/2026') && q[1].includes(',1100.00,1100.00,20.0% S,220.00,GBP'), 'QuickBooks line: amounts and UK VAT code')
const quoted = accountsCsv([{ ...rows[0], job: { ...job, client: 'Smith, Jones & Co "Ltd"' } }], 'xero').split('\r\n')[1]
ok(quoted.startsWith('"Smith, Jones & Co ""Ltd"""'), 'commas and quotes escaped')
const addr = accountsCsv([{ ...rows[0], job: { ...job, clientAddress: 'Finance, Civic Centre, High Street, Anytown, ab1 2cd' } }], 'xero').split('\r\n')[1].split(',')
const acol = (n: string) => addr[head.indexOf(n)]
ok(acol('POAddressLine1') === 'Finance' && acol('POAddressLine3') === 'High Street' && acol('POCity') === 'Anytown' && acol('POPostalCode') === 'AB1 2CD' && acol('POCountry') === 'United Kingdom', 'Xero: the client’s invoice address in its own columns, postcode picked out')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
