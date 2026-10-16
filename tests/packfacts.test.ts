/** Site facts from the PCI and surveys: the endpoint asks for quoted, schema-checked answers; the device checks every quote. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import read from '../api/read-pack.js'
import { verify, quoteFound, pdfText, scopeSummary } from '../src/lib/packFacts'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

// ---- the endpoint
process.env.ANTHROPIC_API_KEY = 'test-key'
let sent: Record<string, any> = {}, headers: Record<string, string> = {}
let reply: Record<string, unknown> = { content: [{ type: 'text', text: JSON.stringify({ facts: [{ category: 'Client', text: 'Start August 2026.', document: 'pci.pdf', page: 3, quote: 'Start: August 2026', properties: [] }], extras: [] }) }], stop_reason: 'end_turn' }
globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
  if (String(url).includes('/rest/v1/rpc/use_ai')) return new Response('5', { status: 200 })
  sent = JSON.parse(init.body); headers = init.headers
  return new Response(JSON.stringify(reply), { status: 200 })
}) as typeof fetch
const call = async (body: unknown, token = 'tok') => {
  const out = { status: 0, json: null as any }
  const res = { status(s: number) { out.status = s; return res }, json(j: unknown) { out.json = j; return res } }
  await read({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body } as never, res as never)
  return out
}
const docs = [{ name: 'pci.pdf', text: '[page 3]\nProject Key Start: August 2026 Completion: December 2026' }]
let r = await call({ docs, scope: '2032AA Slate: renew' }, '')
ok(r.status === 401, 'no sign-in: refused before the AI is called')
r = await call({ docs, scope: '2032AA Slate: renew' })
ok(r.status === 200 && r.json.facts.length === 1 && r.json.cut.length === 0, 'reads and returns the facts')
ok(sent.model === 'claude-opus-5-5' && sent.output_config?.format?.type === 'json_schema' && sent.output_config.format.schema.required.join() === 'facts,extras', 'asks for schema-checked JSON')
ok(sent.fallbacks === 'default' && headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', 'a declined request is retried on the fallback model')
ok(JSON.stringify(sent.messages).includes('<document name=\\"pci.pdf\\">') && JSON.stringify(sent.messages).includes('2032AA Slate'), 'documents and the scope go in')
r = await call({ docs: [{ name: 'big.pdf', text: 'x '.repeat(70_000) }], scope: '' })
ok(r.json.cut?.[0] === 'big.pdf', 'a document too long to send whole is named, not cut silently')
reply = { content: [], stop_reason: 'refusal' }
r = await call({ docs, scope: '' })
ok(r.status === 502 && /declined/.test(r.json.error), 'a refusal is reported, not read as empty')
r = await call({ docs: [], scope: '' })
ok(r.status === 400, 'no documents: refused')

// ---- checking the answer against the documents
const v = verify({ facts: [
  { category: 'Client', text: 'Start August 2026', document: 'pci.pdf', page: 3, quote: 'Key   Start: august 2026', properties: [] },
  { category: 'H&S', text: 'Made up', document: 'pci.pdf', page: 3, quote: 'asbestos survey before start', properties: ['3'] },
  { category: 'Nonsense', text: 'Odd category', document: 'pci.pdf', page: null, quote: 'Completion: December 2026', properties: [] },
], extras: [{ text: 'Bat box', why: 'Survey recommends', document: 'other.pdf', page: 1, quote: 'Start: August 2026', properties: [] }] }, docs)
ok(v.facts[0].verified && v.facts[0].include, 'a quote found in the document (spacing and case aside) comes ticked')
ok(!v.facts[1].verified && !v.facts[1].include, 'a quote not in the document is never ticked')
ok(v.facts[2].category === 'Other', 'unknown category → Other')
ok(!v.extras[0].verified, 'a quote is only checked against the document it names')
ok(!quoteFound('Start', docs[0].text), 'too-short quotes don’t count as proof')
ok(pdfText([{ items: [{ x: 50, y: 20, s: 'Start:' }, { x: 90, y: 21, s: 'August 2026' }, { x: 50, y: 40, s: 'Next' }] }]) === '[page 1]\nStart: August 2026\nNext', 'PDF text rebuilt into lines with a page marker')
ok(scopeSummary([{ code: '2032AA', description: 'Slate: renew', property: '3', include: true }, { code: '2032AA', description: 'Slate: renew', property: '5', include: true }, { code: 'X', description: 'Left out', property: '', include: false }]) === '2032AA Slate: renew (nos. 3, 5)', 'scope summary: one line per code, ticked lines only')

// ---- quotes from the real Windsor Road documents are found in their extracted text
const DIRS = [process.env.PCI_DIR, '/mnt/user-data/uploads', '/root/.claude/uploads'].filter((d): d is string => !!d && existsSync(d))
const find = (re: RegExp): string | undefined => { for (const d of DIRS) { const walk = (dir: string): string | undefined => { for (const n of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, n.name); if (n.isDirectory()) { const x = walk(f); if (x) return x } else if (re.test(n.name)) return f } }; const x = walk(d); if (x) return x } }
const bat = find(/RWN-021-SR02_WindsorRoad_FI\.pdf$/i), pci = find(/Pre-construction_Information_Package.*\.pdf$/i)
if (bat && pci) {
  const { pdfPages } = await import('../src/lib/pdfTable')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const t = async (f: string) => pdfText(await pdfPages(new Uint8Array(readFileSync(f)), pdfjs as never))
  const batText = await t(bat), pciText = await t(pci)
  ok(quoteFound('a Woodstone bat box of one of the following types is erected below the eaves', batText), 'REAL bat survey: the bat box recommendation can be quoted')
  ok(/\[page 12\][\s\S]*hand and checked underneath/.test(batText), 'REAL bat survey: tile-lifting precaution sits on page 12')
  ok(quoteFound('Asbo 4 to be completed prior to work commencement', pciText), 'REAL PCI: the asbestos requirement can be quoted')
  ok(!quoteFound('Asbestos survey not required', pciText), 'REAL PCI: an invented quote isn’t found')
} else console.log('  · real Windsor Road documents not on this machine — skipped')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
