/** Settings → Check AI setup: one green/red line per service, saying exactly what to fix. */
import check from '../api/check-ai.js'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

let sentKey = ''
let guardStatus = 200, anthropic = 200, geminiModel = 200, geminiGen = 200
const hits: string[] = []
globalThis.fetch = (async (url: string, init: any = {}) => {
  url = String(url)
  if (url.includes('/rpc/use_ai')) { hits.push('guard'); return guardStatus === 200 ? new Response('3', { status: 200 }) : new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }), { status: 404 }) }
  if (url.includes('api.anthropic.com/v1/models/')) { sentKey = init.headers['x-api-key']; hits.push('claude:' + decodeURIComponent(url.split('/').pop()!)); return new Response(JSON.stringify(anthropic === 200 ? { id: 'x' } : { error: { message: 'nope' } }), { status: anthropic }) }
  if (url.includes(':generateContent')) { hits.push('gemini:gen'); return new Response(JSON.stringify(geminiGen === 200 ? { candidates: [{ content: { parts: [{ text: '(no speech)' }] } }] } : { error: { message: 'audio not supported' } }), { status: geminiGen }) }
  if (url.includes('generativelanguage')) { hits.push('gemini:model'); return new Response('{}', { status: geminiModel }) }
  return new Response('{}', { status: 500 })
}) as typeof fetch
const call = async (token = 'tok') => {
  const out = { status: 0, json: null as any }
  const res = { status(s: number) { out.status = s; return res }, json(j: unknown) { out.json = j; return res } }
  await check({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: {} } as never, res as never)
  return out
}
const line = (r: any, name: RegExp) => r.json.checks.find((c: any) => name.test(c.name))

let r = await call('')
ok(r.status === 401 && hits.length === 0, 'not signed in: refused, nothing checked')
guardStatus = 404
r = await call()
ok(r.json.checks.length === 1 && !r.json.checks[0].ok && /database update/.test(r.json.checks[0].detail) && !hits.some(h => h.startsWith('claude')), 'database not updated: says so, keys aren’t probed')
guardStatus = 200
r = await call()
ok(!line(r, /^Claude/).ok && /ANTHROPIC_API_KEY isn’t set/.test(line(r, /^Claude/).detail) && /GEMINI_API_KEY isn’t set/.test(line(r, /^Gemini/).detail), 'missing keys: named, with what to do')
process.env.ANTHROPIC_API_KEY = 'a'; process.env.GEMINI_API_KEY = 'g'
hits.length = 0
r = await call()
ok(r.json.checks.every((c: any) => c.ok), 'everything set up: all green')
ok(typeof r.json.build === 'string' && r.json.build.length > 0, 'says which build answered')
ok(hits.filter(h => h.startsWith('claude:')).sort().join() === 'claude:claude-opus-5-5,claude:claude-sonnet-5', 'each model in use looked up once (free, no tokens)')
ok(hits.includes('gemini:gen') && /transcribed a test clip/.test(line(r, /^Gemini/).detail), 'Gemini proves audio with a real test clip')
anthropic = 404
r = await call()
ok(line(r, /BoQs/).detail === 'Model “claude-sonnet-5” not found — check the model name in Vercel.', 'wrong Claude model name: names it')
anthropic = 401
r = await call()
ok(/was refused — it doesn’t look like an Anthropic API key/.test(line(r, /BoQs/).detail), 'refused key that isn’t sk-ant-…: says it doesn’t look like one')
process.env.ANTHROPIC_API_KEY = '  "sk-ant-abc"\n'
r = await call()
ok(sentKey === 'sk-ant-abc' && /^The Anthropic key ending “…-abc” was refused\. Make a new one/.test(line(r, /BoQs/).detail), 'stray spaces, quotes and line breaks from pasting are stripped')
anthropic = 200; geminiModel = 404
r = await call()
ok(/Model “gemini-3\.8-flash” not found — set GEMINI_MODEL/.test(line(r, /^Gemini/).detail), 'wrong Gemini model name: says where to fix it')
geminiModel = 200; geminiGen = 400
r = await call()
ok(!line(r, /^Gemini/).ok && /audio not supported/.test(line(r, /^Gemini/).detail), 'key and model fine but audio fails: Google’s reason shown')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
