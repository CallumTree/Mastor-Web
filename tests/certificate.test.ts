import { upliftAmounts } from '../src/lib/valuation'
import { readFileSync } from 'node:fs'
import { buildCertificate, certificateFileName } from '../src/lib/certificate'
import { parseBoqTsv } from '../src/lib/boq'
import { valTotals } from '../src/lib/valuation'
import type { Job, ScopeItem, Valuation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const boq = parseBoqTsv(readFileSync('tests/cap00290.tsv', 'utf8'))
const job: Job = { id: 'j', name: '32 College Park', client: 'PCC', address: 'Neyland', contractRef: 'CAP00290', poNumber: 'PC26061', contractValue: 40159.68, uplift1: 12.643, uplift2: 3, workType: 'Internal', status: 'Active', photoId: null, createdAt: 0 }
const all: Valuation = { id: 'v1', jobId: 'j', number: 1, status: 'Issued', createdAt: 0, issuedAt: Date.UTC(2026, 8, 1) }
const scope: ScopeItem[] = boq.lines.map((l, i) => ({ id: 's' + i, jobId: 'j', code: l.code, description: l.description, room: l.room, qty: l.qty, unit: l.unit, rate: l.rate, valuationId: 'v1', order: i, createdAt: 0 }))
const t = valTotals(job, 'v1', scope, [])
ok(t.base === 34613.81, `whole BoQ in one valuation → base £34,613.81 (got ${t.base})`)
const u = upliftAmounts(t.base, job.uplift1, job.uplift2)
ok(t.gross === Math.round((t.base + u.u1 + u.u2) * 100) / 100, `total = base + each printed uplift, to the penny (${t.base} + ${u.u1} + ${u.u2} = ${t.gross})`)
;(async () => {
  const blob = await buildCertificate({ job, val: all, vals: [all], scope, vos: [], company: 'Tree & Sons Ltd' })
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1')
  ok(text.startsWith('%PDF'), 'produces a PDF')
  ok(text.includes('Interim Valuation Certificate') && text.includes('VAL I') && text.includes('PC26061'), 'title, valuation ref and PO number on it')
  ok(text.includes('34,613.81'), 'base total printed')
  ok(certificateFileName(job, all) === 'CAP00290_VAL-I.pdf', 'file named by contract ref + valuation')
  ok(certificateFileName(job, { ...all, status: 'Open' }) === 'CAP00290_VAL-I_DRAFT.pdf', 'drafts are marked DRAFT')
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
