import { allocateInvoiceNo, formatInvoiceNo, missingForInvoice, invoiceAmounts, buildInvoice } from '../src/lib/invoice'
import { valCourt } from '../src/lib/chase'
import { blankSettings, type Job, type ScopeItem, type Valuation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const s = { ...blankSettings(), name: 'Tree & Sons Ltd', address: 'The Reclamation Yard, George Street, Milford Haven, SA73 2AY', vatNumber: 'GB123456789', sortCode: '12-34-56', accountNumber: '12345678', invoicePrefix: 'TS-', nextInvoiceNumber: 1042, invoicePad: 4 }
ok(formatInvoiceNo(s, 1042) === 'TS-1042' && formatInvoiceNo({ ...s, invoicePrefix: '', invoicePad: 5 }, 7) === '00007', 'formats prefix + padding')
const v = (n: number, inv?: string): Valuation => ({ id: 'v' + n, jobId: 'j', number: n, status: 'Issued', createdAt: 0, issuedAt: Date.UTC(2026, 8, 1), invoiceNumber: inv ?? null })
ok(allocateInvoiceNo(s, []).number === 'TS-1042' && allocateInvoiceNo(s, []).next === 1043, 'carries on from your current number')
ok(allocateInvoiceNo(s, [v(1, 'TS-1042'), v(2, 'TS-1043')]).number === 'TS-1044', 'never reuses a number already on an invoice')
ok(missingForInvoice(blankSettings()).join(', ') === 'company name, company address, VAT number, bank details', 'says exactly what is missing')
ok(missingForInvoice(s).length === 0, 'complete settings → ready')
const job: Job = { id: 'j', name: '32 College Park', client: 'Pembrokeshire County Council', address: 'Neyland', contractRef: 'CAP00290', poNumber: 'PC26061', contractValue: 0, uplift1: 20.28, uplift2: 5, workType: 'PPR', status: 'Active', photoId: null, createdAt: 0 }
const scope: ScopeItem[] = [{ id: 's', jobId: 'j', code: '6310ZB', description: 'Bathroom', room: 'Bathroom', qty: 1, unit: 'IT', rate: 3981.43, valuationId: 'v1', order: 1, createdAt: 0 }]
const inv = { ...v(1, 'TS-1042'), invoiceDate: Date.UTC(2026, 9, 2), invoiceVatRate: 20 }
const a = invoiceAmounts(job, inv, scope, [])
ok(a.net === 5028.31 && a.vat === 1005.66 && a.total === 6033.97, `net £5,028.31 (matches PO line) + VAT £1,005.66 = £6,033.97 (got ${a.net} + ${a.vat} = ${a.total})`)
ok(valCourt(inv, job, scope, [], Date.UTC(2026, 8, 5)).owed === 6033.97, 'once invoiced, owed = invoice total incl. VAT')
ok(valCourt({ ...inv, paidAt: Date.UTC(2026, 8, 20), paidAmount: 6033.97 }, job, scope, []).tone === 'done', 'paying the invoice total clears it')
;(async () => {
  const text = Buffer.from(await (await buildInvoice({ job, val: inv, scope, vos: [], settings: s })).arrayBuffer()).toString('latin1')
  ok(text.includes('VAT INVOICE') && text.includes('TS-1042') && text.includes('GB123456789') && text.includes('PC26061') && text.includes('6,033.97'), 'PDF: title, number, VAT no., PO and total')
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
