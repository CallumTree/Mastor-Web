/**
 * POST /api/check-ai — Settings → "Check AI setup". One plain line per service, green or red:
 *  - sign-in and the company's daily AI limit (the database update) — counts as one read,
 *  - the Anthropic key, and that each model Mastor uses exists (free: a model lookup, no tokens),
 *  - the Gemini key and model (free lookup), then a half-second silent clip transcribed (a fraction of a penny),
 *    which proves audio really goes through.
 * Nothing is checked for someone who isn't a signed-in member.
 */
import { guard } from './_guard.js'
import { MODEL as PACK_MODEL } from './read-pack.js'
import { CLAUDE_MODEL as SITE_MODEL, GEMINI_MODEL, transcribe } from './read-site.js'

export const config = { maxDuration: 60 }

const DOC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

/** Half a second of silence as a 16 kHz mono WAV. */
function silentWav() {
  const n = 8000, b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  return b
}

const reason = async r => { const d = await r.json().catch(() => ({})); return d?.error?.message || d?.message || `HTTP ${r.status}` }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  // run the real guard, but capture its answer so it becomes one line of the report
  let blocked = null
  const capture = { status(s) { blocked = { status: s }; return capture }, json(j) { blocked = { ...blocked, ...j }; return capture } }
  const ok = await guard(req, capture, 'check')
  if (!ok && blocked?.status === 401) return res.status(401).json({ error: blocked.error })
  const checks = [{ name: 'Sign-in and daily AI limit', ok, detail: ok ? 'Working — reads are counted against your company’s daily limit.' : blocked?.error || 'Couldn’t check.' }]
  if (!ok) return res.status(200).json({ checks, build: buildInfo() })

  // Anthropic: the key, and each model in use
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) checks.push({ name: 'Claude (reading documents and site captures)', ok: false, detail: 'ANTHROPIC_API_KEY isn’t set in Vercel. Add it, then redeploy.' })
  else {
    const uses = new Map()
    for (const [m, what] of [[DOC_MODEL, 'BoQs and VOs'], [PACK_MODEL, 'PCI and surveys'], [SITE_MODEL, 'site captures']]) uses.set(m, [...(uses.get(m) ?? []), what])
    for (const [m, what] of uses) {
      try {
        const r = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(m)}`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
        checks.push(r.ok
          ? { name: `Claude · ${what.join(', ')}`, ok: true, detail: `Key works; model ${m} is available.` }
          : { name: `Claude · ${what.join(', ')}`, ok: false, detail: r.status === 401 ? 'The Anthropic key was refused — check ANTHROPIC_API_KEY in Vercel.' : r.status === 404 ? `Model “${m}” not found — check the model name in Vercel.` : `Anthropic said: ${await reason(r)}` })
      } catch { checks.push({ name: `Claude · ${what.join(', ')}`, ok: false, detail: 'Couldn’t reach Anthropic from the server.' }) }
    }
  }

  // Gemini: key and model, then a real (tiny) transcription
  const g = process.env.GEMINI_API_KEY
  if (!g) checks.push({ name: 'Gemini (voice and video)', ok: false, detail: 'GEMINI_API_KEY isn’t set in Vercel. Add it (tick Production and Preview), then redeploy.' })
  else {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}`, { headers: { 'x-goog-api-key': g } })
      if (!r.ok) checks.push({ name: 'Gemini (voice and video)', ok: false, detail: r.status === 404 ? `Model “${GEMINI_MODEL}” not found — set GEMINI_MODEL in Vercel to the name shown in Google AI Studio.` : r.status === 400 || r.status === 403 ? 'The Gemini key was refused — check GEMINI_API_KEY in Vercel.' : `Google said: ${await reason(r)}` })
      else {
        await transcribe(silentWav(), 'audio/wav', g)
        checks.push({ name: 'Gemini (voice and video)', ok: true, detail: `Key works; ${GEMINI_MODEL} transcribed a test clip.` })
      }
    } catch (e) { checks.push({ name: 'Gemini (voice and video)', ok: false, detail: `The test clip didn’t go through: ${e.message}` }) }
  }
  return res.status(200).json({ checks, build: buildInfo() })
}

/** Which deployment answered — so "I redeployed" can be confirmed, not guessed. */
function buildInfo() {
  const env = process.env.VERCEL_ENV || 'local'
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)
  const branch = process.env.VERCEL_GIT_COMMIT_REF || ''
  return `${env}${branch ? ` · ${branch}` : ''}${sha ? ` · ${sha}` : ''}`
}
