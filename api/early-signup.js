/**
 * /api/early-signup: the front page's founding sign-up.
 *  GET  → how many of the fifty founding places are taken.
 *  POST → claim the next place. The database hands out the numbers, one at a time, and the same
 *         email always gets its own place back (supabase/schema.sql v7). Then the owner gets an
 *         email, when RESEND_API_KEY and SIGNUP_NOTIFY_TO are set in Vercel.
 * No sign-in needed. Nobody outside can read the sign-ups table: this only claims and counts.
 */
import { SB_URL, SB_KEY, envKey } from './_guard.js'

export const PLACES = 50
const LIMITS = { name: 120, firm: 160, email: 200, phone: 40, work: 120, size: 40, note: 1000 }

const rpc = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST', headers: { apikey: SB_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
})

const roman = n => {
  let out = '', x = n
  for (const [v, s] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (x >= v) { out += s; x -= v }
  return out
}

/** Tell the owner. A failed email never fails the sign-up: it's already saved. */
async function notify(s, place) {
  const key = envKey('RESEND_API_KEY'), to = envKey('SIGNUP_NOTIFY_TO')
  if (!key || !to) return false
  const what = place ? `founding place ${roman(place)} of ${roman(PLACES)}` : place === null ? 'the waiting list (all fifty places taken)' : 'the founding list'
  const text = [`${s.name} at ${s.firm} has signed up for ${what}.`, '', `Email: ${s.email}`, s.phone && `Phone: ${s.phone}`, s.work && `Work: ${s.work}`, s.size && `People: ${s.size}`, s.note && `\nNote:\n${s.note}`]
    .filter(x => x !== '' && x != null).join('\n')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: envKey('SIGNUP_FROM') || 'Mastor <onboarding@resend.dev>', to: to.split(',').map(x => x.trim()).filter(Boolean), reply_to: s.email,
      subject: `Mastor sign-up: ${s.firm}${place ? ` (place ${roman(place)})` : ''}`, text }),
  }).catch(() => null)
  return !!r?.ok
}

const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method === 'GET') {
    const r = await rpc('founding_places_taken').catch(() => null)
    const taken = r?.ok ? Number(await r.json()) : null
    if (taken != null) res.setHeader('cache-control', 'public, s-maxage=20, stale-while-revalidate=60')
    return res.status(200).json({ places: PLACES, taken: Number.isFinite(taken) ? taken : null })
  }
  if (req.method !== 'POST') { res.setHeader('allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST' }) }

  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return {} } })() : (req.body ?? {})
  // a field people can't see: only form-filling robots put anything in it
  if (clean(b.website, 200)) return res.status(200).json({ ok: true, place: null, already: false })
  const s = Object.fromEntries(Object.entries(LIMITS).map(([k, n]) => [k, k === 'note' ? String(b[k] ?? '').trim().slice(0, n) : clean(b[k], n)]))
  s.email = s.email.toLowerCase()
  const missing = [!s.name && 'your name', !s.firm && 'your firm', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email) && 'an email address that works'].filter(Boolean)
  if (missing.length) return res.status(400).json({ error: `Add ${missing.join(' and ')}.` })

  const r = await rpc('claim_founding_place', { p_name: s.name, p_firm: s.firm, p_email: s.email, p_phone: s.phone, p_work: s.work, p_size: s.size, p_note: s.note, p_source: clean(b.source, 200) }).catch(() => null)
  if (!r) return res.status(503).json({ error: 'Couldn’t reach Mastor just now. Check your signal and try again.' })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    if (/signup_invalid/.test(e?.message ?? '')) return res.status(400).json({ error: 'Add your name, your firm and an email address that works.' })
    // the database hasn't had the sign-ups update yet: keep the person by email rather than lose them
    if (r.status === 404 || e?.code === 'PGRST202' || e?.code === '42P01') {
      if (await notify(s, undefined)) return res.status(200).json({ ok: true, place: null, already: false, listed: true })
      return res.status(503).json({ error: 'Sign-ups aren’t open yet. Try again later today.' })
    }
    return res.status(503).json({ error: 'Couldn’t save that just now. Try again in a minute.' })
  }
  const [row] = await r.json()
  const place = row?.place ?? null, already = !!row?.already
  if (!already) await notify(s, place)
  const t = await rpc('founding_places_taken').catch(() => null)
  return res.status(200).json({ ok: true, place, already, taken: t?.ok ? Number(await t.json()) : null })
}
