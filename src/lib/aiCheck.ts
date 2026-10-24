import { authHeader } from './supabase'

export interface AiCheck { name: string; ok: boolean; detail: string }

/** Settings → Check AI setup: asks the server to test each AI service with this company's keys. */
export async function checkAi(): Promise<{ checks: AiCheck[]; build?: string }> {
  try {
    const r = await fetch('/api/check-ai', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: '{}' })
    const d = await r.json().catch(() => ({}))
    if (r.ok && Array.isArray(d.checks)) return { checks: d.checks, build: d.build }
    return { checks: [{ name: 'Mastor server', ok: false, detail: d.error || (r.status === 404 ? 'The check isn’t deployed yet — redeploy in Vercel.' : `The server answered ${r.status}.`) }] }
  } catch {
    return { checks: [{ name: 'Mastor server', ok: false, detail: 'Couldn’t reach the server — check signal and try again.' }] }
  }
}
