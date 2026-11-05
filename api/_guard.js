/**
 * Shared gate for the AI readers. Before anything is sent to the AI:
 *  - the request must carry the caller's Mastor sign-in token,
 *  - the caller must belong to a company,
 *  - the company's plan must include this AI and have allowance left (metered at real cost in the
 *    database, see supabase/schema.sql v8 ai_check; everyday Clerk questions under a daily fair-use count),
 *  - the upload must be a sensible size.
 * One call to the database's ai_check() does the first three: Supabase checks the token, the function
 * finds the company and its plan and counts the use. After the call, spend() writes what it really cost.
 * Until the database has v8, the old use_ai() (60 uses a day) is used instead.
 * (Files starting with "_" in /api are not routes on Vercel.)
 */
export const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://susecnvepvwmqhziferf.supabase.co'
export const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BrmA2y4zsAablFTqNCWvPA_thOHgiGf'
/** API keys from Vercel, with any stray spaces, quotes or line breaks from copy-and-paste removed. */
export const envKey = name => (process.env[name] || '').trim().replace(/^["']|["']$/g, '').trim()
export const anthropicKey = () => envKey('ANTHROPIC_API_KEY')
export const geminiKey = () => envKey('GEMINI_API_KEY')

/** Clerk's models: everyday questions on the fast, low-cost one; once a conversation opens a document
 *  (a PO, the client's pack), the rest of it on the most capable. Either can be changed in Vercel. */
export const CLERK_MODEL = process.env.ANTHROPIC_AGENT_MODEL || 'claude-haiku-5-5'
export const CLERK_DOC_MODEL = process.env.ANTHROPIC_AGENT_DOC_MODEL || 'claude-opus-5-5'

export const MAX_BODY_CHARS = 4_400_000 // Vercel refuses request bodies over 4.5 MB anyway

/** What each kind of AI is called when a plan doesn't include it. */
const FEATURE = { site: 'Reading site captures', vo: 'The VO ticket reader', ask: 'Clerk', ask_doc: 'Clerk', media: 'Voice and video through the Claude connector', pack: 'Reading the client’s pack', boq: 'Reading scanned schedules' }

const rpc = (fn, token, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST', headers: { apikey: SB_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
})
const missing = (r, e) => r.status === 404 || e?.code === 'PGRST202'

/**
 * May this firm use this AI now? { ok: true, company, plan, lane } or { ok: false, status, error } in plain words.
 * Kinds: site, pack, boq, vo, ask_doc, media (the allowance); ask, check (fair use); collect (sign-in only).
 */
export async function aiCheck(token, kind) {
  if (!token) return { ok: false, status: 401, error: 'Sign in to Mastor to use document reading.' }
  let r, e
  try {
    r = await rpc('ai_check', token, { p_kind: kind })
    if (r.ok) { const d = await r.json().catch(() => ({})); return { ok: true, company: d?.company ?? null, plan: d?.plan ?? null, lane: d?.lane ?? 'normal' } }
    e = await r.json().catch(() => ({}))
    // the database hasn't had the v8 update yet: the old daily count still guards it
    if (missing(r, e)) {
      if (kind === 'collect') return { ok: true, company: null, plan: null, lane: 'normal' }
      r = await rpc('use_ai', token, { p_kind: kind })
      if (r.ok) return { ok: true, company: null, plan: null, lane: 'normal' }
      e = await r.json().catch(() => ({}))
    }
  } catch {
    return { ok: false, status: 503, error: 'Couldn’t check your sign-in. Check signal and try again.' }
  }
  const msg = String(e?.message || ''), hint = /^\d+$/.test(String(e?.hint)) ? String(e.hint) : ''
  if (r.status === 401 || /jwt|not signed in/i.test(msg)) return { ok: false, status: 401, error: 'Your sign-in has expired — sign in again and retry.' }
  if (/no company/.test(msg)) return { ok: false, status: 403, error: 'Set up or join a company before reading documents.' }
  if (/ai_plan/.test(msg)) return { ok: false, status: 403, error: `${FEATURE[kind] ?? 'This'} isn’t on your plan. It comes with Minerva and Jupiter.` }
  if (/ai_month_reads/.test(msg)) return { ok: false, status: 429, error: `Your company has used this month’s ${hint || ''} document reads. They start again on the 1st, or enter the lines by hand.`.replace('  ', ' ') }
  if (/ai_month/.test(msg)) return { ok: false, status: 429, error: 'Your company has used this month’s AI allowance. AI reading starts again on the 1st; everything else carries on as normal.' }
  if (/ai_daily_credits/.test(msg)) return { ok: false, status: 429, error: 'Your company has done the most AI reading for one day. It starts again at midnight; everything else carries on as normal.' }
  if (/ai_daily_questions/.test(msg)) return { ok: false, status: 429, error: `Your company has asked Clerk ${hint || 'the most'} questions today, the most for one day. Clerk is back at midnight.` }
  if (/ai_daily_limit/.test(msg)) {
    const n = hint ? `all ${hint} of today’s` : 'today’s'
    return { ok: false, status: 429, error: `Your company has used ${n} document reads. It resets at midnight — or enter the lines by hand.` }
  }
  if (missing(r, e)) {
    // neither check exists: refuse rather than read unmetered
    return { ok: false, status: 503, error: 'Document reading is switched off until the database update is run (supabase/schema.sql).' }
  }
  return { ok: false, status: 503, error: 'Couldn’t check your sign-in right now. Try again in a minute.' }
}

/** The caller's sign-in token from the request, or ''. */
export const bearer = req => { const a = String(req.headers?.authorization || ''); return a.startsWith('Bearer ') ? a.slice(7).trim() : '' }

/** Returns the check (truthy) when the request may go ahead; otherwise it has already answered the request and returns false. */
export async function guard(req, res, kind) {
  const token = bearer(req)
  if (!token) { res.status(401).json({ error: 'Sign in to Mastor to use document reading.' }); return false }
  const size = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body ?? '').length
  if (size > MAX_BODY_CHARS) { res.status(413).json({ error: 'That file is too big to read — try a smaller copy (under 3MB).' }); return false }
  const c = await aiCheck(token, kind)
  if (!c.ok) { res.status(c.status).json({ error: c.error }); return false }
  return c
}

/**
 * Writes what an AI call really cost to the firm's ledger (credits from api/_cost.js). `ref` makes it count once
 * however often it's written (a batch collected twice). Never fails the request: a missed line is logged instead.
 */
export async function spend(token, kind, model, credits, ref) {
  if (!token || !(credits > 0)) return
  try {
    const r = await rpc('ai_spend', token, { p_kind: kind, p_model: String(model || ''), p_credits: Math.min(credits, 10000), p_ref: ref ?? null })
    if (!r.ok && r.status !== 404) console.warn('ai_spend', r.status, await r.text().catch(() => ''))
  } catch (e) { console.warn('ai_spend', e?.message) }
  console.info(JSON.stringify({ ai: { kind, model, credits, ...(ref ? { ref } : {}) } }))
}
