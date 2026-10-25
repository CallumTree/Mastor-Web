/**
 * The founding sign-up API, against a fake Supabase and a fake Resend: it counts places, claims the
 * next one through the database function, never takes two places for one email, refuses bad details,
 * ignores robots, emails the owner (when set up), and keeps a person by email if the database isn't ready.
 */
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m) }

const SB = 'https://susecnvepvwmqhziferf.supabase.co'
const rows: { email: string; place: number | null }[] = []
let dbReady = true
const mails: any[] = []
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input)
  if (url === `${SB}/rest/v1/rpc/founding_places_taken`) return dbReady ? new Response(String(rows.filter(r => r.place).length)) : new Response('{"code":"PGRST202"}', { status: 404 })
  if (url === `${SB}/rest/v1/rpc/claim_founding_place`) {
    if (!dbReady) return new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }), { status: 404 })
    const b = JSON.parse(init.body)
    if (!b.p_name) return new Response(JSON.stringify({ message: 'signup_invalid' }), { status: 400 })
    const had = rows.find(r => r.email === b.p_email.toLowerCase())
    if (had) return new Response(JSON.stringify([{ place: had.place, already: true }]))
    const taken = rows.filter(r => r.place).length
    const place = taken < 50 ? taken + 1 : null
    rows.push({ email: b.p_email.toLowerCase(), place })
    return new Response(JSON.stringify([{ place, already: false }]))
  }
  if (url === 'https://api.resend.com/emails') { mails.push({ auth: init.headers.authorization, ...JSON.parse(init.body) }); return new Response('{"id":"m1"}') }
  throw new Error('unexpected fetch ' + url)
}) as typeof fetch

const { default: handler } = await import('../api/early-signup.js')
const call = async (method: string, body?: unknown) => {
  let status = 0, json: any = null
  const res: any = { setHeader() {}, status(n: number) { status = n; return res }, json(b: unknown) { json = b } }
  await handler({ method, body } as any, res)
  return { status, json }
}
const person = (n: number, extra = {}) => ({ name: `Dai ${n}`, firm: `Firm ${n}`, email: `dai${n}@example.co.uk`, ...extra })

let r = await call('GET')
ok(r.status === 200 && r.json.places === 50 && r.json.taken === 0, 'GET: fifty places, none taken')
r = await call('POST', person(1, { work: 'Planned (PPR, WHQS, Decent Homes)' }))
ok(r.status === 200 && r.json.place === 1 && r.json.already === false && r.json.taken === 1, 'first sign-up takes place I')
ok(mails.length === 0, 'no email set up: none sent, the sign-up still stands')

process.env.RESEND_API_KEY = 're_test'; process.env.SIGNUP_NOTIFY_TO = 'owner@example.co.uk'
r = await call('POST', person(2, { phone: '07700 900123', note: 'Two crews on WHQS' }))
const m = mails[0]
ok(r.json.place === 2 && m?.auth === 'Bearer re_test' && m.to[0] === 'owner@example.co.uk' && m.reply_to === 'dai2@example.co.uk', 'with Resend set up, the owner gets an email they can reply to')
ok(/place II/.test(m.subject) && /founding place II of L/.test(m.text) && /07700 900123/.test(m.text) && /Two crews on WHQS/.test(m.text), 'the email names the place in Roman numerals and carries the details')

r = await call('POST', person(2, { email: 'DAI2@example.co.uk' }))
ok(r.json.place === 2 && r.json.already === true && mails.length === 1, 'the same email again: its own place back, not a second one, and no second email')

r = await call('POST', { name: '', firm: 'X', email: 'nope' })
ok(r.status === 400 && /your name/.test(r.json.error) && /email address that works/.test(r.json.error), 'missing name and a bad email: refused, saying what to add')
r = await call('POST', { ...person(3), website: 'http://spam' })
ok(r.status === 200 && r.json.ok && rows.length === 2, 'a robot filling the hidden field is thanked and ignored')
r = await call('PUT', person(4))
ok(r.status === 405, 'only GET and POST')

for (let i = 3; i <= 50; i++) await call('POST', person(i))
r = await call('POST', person(51))
ok(r.json.place === null && r.json.taken === 50 && /waiting list/.test(mails.at(-1).text), 'after fifty: the waiting list, and the email says so')

dbReady = false
r = await call('GET')
ok(r.status === 200 && r.json.taken === null, 'database not ready: the count is unknown, not made up')
r = await call('POST', person(60))
ok(r.status === 200 && r.json.listed === true && r.json.place === null && /Firm 60/.test(mails.at(-1).subject), 'database not ready: the person is kept by email rather than lost')
delete process.env.RESEND_API_KEY
r = await call('POST', person(61))
ok(r.status === 503 && /aren’t open yet/.test(r.json.error), 'database not ready and no email: says so plainly')

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
