/**
 * Shared gate for the AI readers. Before anything is sent to the AI:
 *  - the request must carry the caller's Mastor sign-in token,
 *  - the caller must belong to a company,
 *  - the company must be under its daily AI limit (counted in the database, see supabase/schema.sql use_ai),
 *  - the upload must be a sensible size.
 * One call to the database's use_ai() does the first three: Supabase checks the token, the function
 * finds the company and counts the read.
 * (Files starting with "_" in /api are not routes on Vercel.)
 */
export const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://susecnvepvwmqhziferf.supabase.co'
export const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BrmA2y4zsAablFTqNCWvPA_thOHgiGf'
export const MAX_BODY_CHARS = 4_400_000 // Vercel refuses request bodies over 4.5 MB anyway

/** Returns true when the request may go ahead; otherwise it has already answered the request. */
export async function guard(req, res, kind) {
  const auth = String(req.headers?.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) { res.status(401).json({ error: 'Sign in to Mastor to use document reading.' }); return false }

  const size = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body ?? '').length
  if (size > MAX_BODY_CHARS) { res.status(413).json({ error: 'That file is too big to read — try a smaller copy (under 3MB).' }); return false }

  let r
  try {
    r = await fetch(`${SB_URL}/rest/v1/rpc/use_ai`, {
      method: 'POST',
      headers: { apikey: SB_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_kind: kind }),
    })
  } catch {
    res.status(503).json({ error: 'Couldn’t check your sign-in. Check signal and try again.' }); return false
  }
  if (r.ok) return true
  const e = await r.json().catch(() => ({}))
  const msg = String(e?.message || '')
  if (r.status === 401 || /jwt|not signed in/i.test(msg)) { res.status(401).json({ error: 'Your sign-in has expired — sign in again and retry.' }); return false }
  if (/no company/.test(msg)) { res.status(403).json({ error: 'Set up or join a company before reading documents.' }); return false }
  if (/ai_daily_limit/.test(msg)) {
    const n = /^\d+$/.test(String(e?.hint)) ? `all ${e.hint} of today’s` : 'today’s'
    res.status(429).json({ error: `Your company has used ${n} document reads. It resets at midnight — or enter the lines by hand.` }); return false
  }
  if (r.status === 404 || e?.code === 'PGRST202') {
    // the database hasn't had the v4 update yet: refuse rather than read unmetered
    res.status(503).json({ error: 'Document reading is switched off until the database update is run (supabase/schema.sql).' }); return false
  }
  res.status(503).json({ error: 'Couldn’t check your sign-in right now. Try again in a minute.' }); return false
}
