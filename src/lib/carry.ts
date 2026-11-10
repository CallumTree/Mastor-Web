import type { Job } from './types'

/**
 * The client's details carried over from your last job for them: the same council's invoice address and uplifts are
 * typed once, not on every job. Matched on the client's name (case and spacing ignored); only what that job had.
 */
export function lastJobFor(jobs: Job[], client: string): Job | null {
  const key = client.trim().toLowerCase().replace(/\s+/g, ' ')
  if (key.length < 3) return null
  const same = jobs.filter(j => j.client.trim().toLowerCase().replace(/\s+/g, ' ') === key && (j.clientAddress || j.uplift1 || j.uplift2))
  return same.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
}
