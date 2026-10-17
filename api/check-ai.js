/**
 * POST /api/check-ai — Settings → "Check AI setup". One plain line per service, green or red:
 *  - sign-in and the company's daily AI limit (the database update) — counts as one read,
 *  - the Anthropic key, and that each model Mastor uses exists (free: a model lookup, no tokens),
 *  - the Gemini key and model (free lookup), then a half-second silent clip transcribed (a fraction of a penny),
 *    which proves audio really goes through.
 * Nothing is checked for someone who isn't a signed-in member.
 */
import { guard, anthropicKey, geminiKey } from './_guard.js'
import { MODEL as PACK_MODEL } from './read-pack.js'
import { CLAUDE_MODEL as SITE_MODEL, GEMINI_MODEL, transcribe } from './read-site.js'

export const config = { maxDuration: 60 }   // each service has 20s (see limit) so the whole check ends well inside this

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
  const ok = await Promise.race([guard(req, capture, 'check'), new Promise(r => setTimeout(() => { blocked = { status: 504, error: 'The database took too long to answer — try again in a minute.' }; r(false) }, limitMs()))])
  if (!ok && blocked?.status === 401) return res.status(401).json({ error: blocked.error })
  const checks = [{ name: 'Sign-in and daily AI limit', ok, detail: ok ? 'Working — reads are counted against your company’s daily limit.' : blocked?.error || 'Couldn’t check.' }]
  if (!ok) return res.status(200).json({ checks, build: buildInfo() })

  // every service checked at the same time, each with its own time limit — one slow service can't sink the rest
  const tasks = []
  const key = anthropicKey()
  if (!key) checks.push({ name: 'Claude (reading documents and site captures)', ok: false, detail: 'ANTHROPIC_API_KEY isn’t set in Vercel. Add it, then redeploy.' })
  else {
    const uses = new Map()
    for (const [m, what] of [[DOC_MODEL, 'BoQs and VOs'], [PACK_MODEL, 'PCI and surveys'], [SITE_MODEL, 'site captures']]) uses.set(m, [...(uses.get(m) ?? []), what])
    for (const [m, what] of uses) {
      const name = `Claude · ${what.join(', ')}`
      tasks.push(limit(name, async () => {
        const r = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(m)}`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
        return r.ok
          ? { name, ok: true, detail: `Key ending “…${key.slice(-4)}” works; model ${m} is available.` }
          : { name, ok: false, detail: r.status === 401 ? `The Anthropic key ending “…${key.slice(-4)}” was refused${key.startsWith('sk-ant-') ? '' : ' — it doesn’t look like an Anthropic API key (those start “sk-ant-”)'}. Make a new one at console.anthropic.com → API keys and paste it into ANTHROPIC_API_KEY.` : r.status === 404 ? `Model “${m}” not found — check the model name in Vercel.` : `Anthropic said: ${await reason(r)}` }
      }, 'Couldn’t reach Anthropic from the server'))
    }
  }

  // Gemini: key and model, then a real (tiny) transcription
  const g = geminiKey()
  const gname = 'Gemini (voice and video)'
  if (!g) checks.push({ name: gname, ok: false, detail: 'GEMINI_API_KEY isn’t set in Vercel. Add it (tick Production and Preview), then redeploy.' })
  else tasks.push(limit(gname, async () => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}`, { headers: { 'x-goog-api-key': g } })
    if (!r.ok) return { name: gname, ok: false, detail: r.status === 404 ? `Model “${GEMINI_MODEL}” not found — set GEMINI_MODEL in Vercel to the name shown in Google AI Studio.` : r.status === 400 || r.status === 403 ? 'The Gemini key was refused — check GEMINI_API_KEY in Vercel.' : `Google said: ${await reason(r)}` }
    await transcribe(silentWav(), 'audio/wav', g)
    return { name: gname, ok: true, detail: `Key works; ${GEMINI_MODEL} transcribed a test clip.` }
  }, 'The test clip didn’t go through'))
  checks.push(...await Promise.all(tasks))
  return res.status(200).json({ checks, build: buildInfo() })
}

const limitMs = () => Number(process.env.CHECK_LIMIT_MS) || 20_000
/** Runs one check; a failure or a hang comes back as a red line instead of stopping the others. */
async function limit(name, run, failPrefix) {
  let timer
  const slow = new Promise(r => { timer = setTimeout(() => r({ name, ok: false, detail: 'Took too long to answer (over 20 seconds) — the service may be busy. Try again in a minute.' }), limitMs()) })
  try { return await Promise.race([run(), slow]) }
  catch (e) { return { name, ok: false, detail: `${failPrefix}: ${e.message}` } }
  finally { clearTimeout(timer) }
}

/** Which deployment answered — so "I redeployed" can be confirmed, not guessed. */
function buildInfo() {
  const env = process.env.VERCEL_ENV || 'local'
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)
  const branch = process.env.VERCEL_GIT_COMMIT_REF || ''
  return `${env}${branch ? ` · ${branch}` : ''}${sha ? ` · ${sha}` : ''}`
}
