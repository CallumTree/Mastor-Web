import { existsSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { readVoSheet, parseVoReply, matchJob, suggestVo } from '../src/lib/voIntake'
import type { Job, Variation } from '../src/lib/types'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }
const job = (id: string, name: string, po: string, address = ''): Job => ({ id, name, client: '', address, contractRef: '', poNumber: po, contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 0 })
const jobs = [job('a', '51 Example Place', 'PO30001'), job('b', '57 Mill Drive', 'PO21812', 'Anytown'), job('c', '32 Park Road', 'PO26061')]

// what the AI returns for the handwritten site instruction 11284
const scan = parseVoReply('```json\n{"ref":"11284","date":"2026-01-22","issued_by":"","address":"57 Mill Drive, Anytown","po_number":"H/PO21812","description":"Chimney demolish and make good; scaffold","lines":[{"code":"120021","description":"Chimney: demolish, make good","qty":1,"unit":"IT","rate":null,"cost":540.02},{"code":"SCA003","description":"Scaffolding","qty":1,"unit":"IT","rate":null,"cost":250}]}\n```')!
ok(scan.ref === '11284' && scan.lines.length === 2 && scan.lines[0].rate === 540.02 && scan.lines[1].rate === 250, 'scan: "1 IT – £540.02" → rate £540.02; two lines')
ok(matchJob(scan, jobs)?.id === 'b', '"vary order H/PO21812" → the job with PO PO21812')
const vo = (n: number, d: string, code = ''): Variation => ({ id: 'v' + n, jobId: 'b', number: n, description: d, room: 'Roof', qty: null, unit: '', rate: null, code, reason: '', clientRef: '', status: 'Identified', photoIds: [], dateRaised: 0, valuationId: null })
const sug = suggestVo(scan.lines[0], [vo(1, 'Rotten joists under bath'), vo(2, 'Chimney stack unsafe — demolish and make good'), vo(3, 'Extra socket')])
ok(sug.length === 1 && sug[0].number === 2, 'suggests the open VO it most likely is (VO II chimney)')
ok(suggestVo(scan.lines[0], [{ ...vo(2, 'Chimney'), clientRef: 'X1' }]).length === 0, 'already-instructed VOs are never re-matched')
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
