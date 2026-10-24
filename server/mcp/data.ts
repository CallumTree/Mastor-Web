/**
 * The connector's view of Mastor: the same Supabase tables every phone syncs from, read *as the person who
 * signed in to Claude*. Their token goes on every request, so the database's own rules decide what comes
 * back (only their company's rows), and an operative's connector never carries money, as in the app.
 */
import type { CompanySettings, Cost, DiaryEntry, Job, JobDocument, ScopeItem, Valuation, Variation, WorkOrder } from '../../src/lib/types'
// @ts-expect-error plain JS module shared with the other /api functions
import { SB_URL, SB_KEY } from '../../api/_guard.js'

export interface Ctx {
  token: string
  userId: string
  email: string
  companyId: string
  company: string
  role: string
  /** operatives: false — no rates, values, valuations, invoices or margins, anywhere */
  money: boolean
}

const headers = (token: string, extra: Record<string, string> = {}) => ({ apikey: SB_KEY as string, authorization: `Bearer ${token}`, ...extra })

/** The person behind a Claude token, and the company they work for. null = not a valid Mastor sign-in. */
export async function signIn(token: string): Promise<Ctx | null> {
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: headers(token) })
  if (!u.ok) return null
  const user = await u.json() as { id: string; email?: string }
  const m = await fetch(`${SB_URL}/rest/v1/memberships?select=company_id,role,companies(name)&user_id=eq.${user.id}&limit=1`, { headers: headers(token) })
  if (!m.ok) return null
  const [row] = await m.json() as { company_id: string; role: string; companies: { name: string } | null }[]
  if (!row) return null
  return { token, userId: user.id, email: user.email ?? '', companyId: row.company_id, company: row.companies?.name ?? '', role: row.role, money: row.role !== 'operative' }
}

/** cloud table for each kind of record (as src/lib/sync.ts) */
const TABLE = { jobs: 'jobs', scope: 'scope_items', variations: 'variations', valuations: 'valuations', diary: 'diary_entries',
  settings: 'company_settings', costs: 'costs', orders: 'work_orders', docs: 'job_documents' } as const
type Kind = keyof typeof TABLE

/** Every live record of one kind (optionally for one job), paged past the API's 1,000-row cap. */
export async function records<T>(ctx: Ctx, kind: Kind, jobId?: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const q = `${TABLE[kind]}?select=data&company_id=eq.${ctx.companyId}&deleted=eq.false${jobId ? `&job_id=eq.${encodeURIComponent(jobId)}` : ''}&order=id`
    const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: headers(ctx.token, { range: `${from}-${from + 999}` }) })
    if (!r.ok) {
      const msg = await r.text()
      if (/does not exist|schema cache/i.test(msg)) return out   // a table the database update hasn't added yet: nothing there
      throw new Error(`Couldn’t read ${kind} (${r.status}).`)
    }
    const rows = await r.json() as { data: T }[]
    out.push(...rows.map(x => x.data))
    if (rows.length < 1000) return out
  }
}

export interface JobData { job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]; diary: DiaryEntry[]; orders: WorkOrder[]; docs: JobDocument[]; costs: Cost[] }

export async function jobData(ctx: Ctx, job: Job): Promise<JobData> {
  const [scope, vos, vals, diary, orders, docs, costs] = await Promise.all([
    records<ScopeItem>(ctx, 'scope', job.id), records<Variation>(ctx, 'variations', job.id), records<Valuation>(ctx, 'valuations', job.id),
    records<DiaryEntry>(ctx, 'diary', job.id), records<WorkOrder>(ctx, 'orders', job.id), records<JobDocument>(ctx, 'docs', job.id),
    ctx.money ? records<Cost>(ctx, 'costs', job.id) : Promise.resolve([] as Cost[]),
  ])
  return { job, scope, vos, vals, diary, orders, docs, costs }
}

export const settings = async (ctx: Ctx) => (await records<CompanySettings>(ctx, 'settings'))[0] ?? null

/**
 * Find a job from what Claude was told: its id, or part of its name, reference or address.
 * Several matches is an error that lists them, so Claude asks rather than guesses.
 */
export function findJob(jobs: Job[], q: string): Job {
  const exact = jobs.find(j => j.id === q)
  if (exact) return exact
  const s = q.trim().toLowerCase()
  const hits = jobs.filter(j => [j.name, j.contractRef, j.address, j.poNumber].some(f => (f ?? '').toLowerCase().includes(s)))
  if (hits.length === 1) return hits[0]
  if (!hits.length) throw new Error(`No job matches “${q}”. Jobs: ${jobs.map(j => j.name).join('; ') || 'none yet'}.`)
  throw new Error(`“${q}” matches ${hits.length} jobs — say which: ${hits.map(j => `${j.name} (id ${j.id})`).join('; ')}.`)
}

/** A photo, voice note or video from the company's private storage. */
export async function media(ctx: Ctx, mediaId: string): Promise<{ bytes: Buffer; type: string } | null> {
  const r = await fetch(`${SB_URL}/storage/v1/object/photos/${encodeURIComponent(ctx.companyId)}/${encodeURIComponent(mediaId)}.jpg`, { headers: headers(ctx.token) })
  if (!r.ok) return null
  return { bytes: Buffer.from(await r.arrayBuffer()), type: (r.headers.get('content-type') || '').split(';')[0] }
}

/** Count one AI read against the company's daily limit (as the in-app readers do). Throws a plain message when it can't. */
export async function useAi(ctx: Ctx, kind: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/use_ai`, { method: 'POST', headers: headers(ctx.token, { 'content-type': 'application/json' }), body: JSON.stringify({ p_kind: kind }) })
  if (r.ok) return
  const e = await r.json().catch(() => ({})) as { message?: string; hint?: string }
  if (/ai_daily_limit/.test(e.message ?? '')) throw new Error('Your company has used today’s AI reads. Voice notes and videos can be read again after midnight.')
  throw new Error('Couldn’t start a transcription just now — try again in a minute.')
}

/**
 * Keep a transcript on its diary entry, so each clip is only ever transcribed once (the app's own
 * "Read today" does the same). Written as the person; the next sync brings it to every phone.
 */
export async function saveTranscript(ctx: Ctx, entry: DiaryEntry, transcript: string) {
  await fetch(`${SB_URL}/rest/v1/${TABLE.diary}?id=eq.${encodeURIComponent(entry.id)}&company_id=eq.${ctx.companyId}`, {
    method: 'PATCH', headers: headers(ctx.token, { 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify({ data: { ...entry, transcript } }),
  }).catch(() => {})
}
