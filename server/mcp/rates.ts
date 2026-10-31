/**
 * Finding a rate for new work from what the company already has: the schedules of rates it has loaded
 * (rate books, synced from the app) and the priced scope lines and VOs on its jobs. A wet room VO at
 * No. 18 can take the code and rate a wet room was priced at on No. 12, with where it came from, so a
 * person can check it. Nothing here is estimated: every rate is one a schedule printed or a person
 * already priced, and the person still says yes before it is used.
 */
import type { Job, RateBook, RateItem, ScopeItem, Variation } from '../../src/lib/types'
import { money, qtyText, voRef } from '../../src/lib/format'

const STOP = new Set(('a an and any as at be by for from in into is it of off on or per the to up with without new existing '
  + 'no nr each item all one two this that x').split(' '))
const UNIT = (u: string) => u.trim().toUpperCase().replace(/^(NR|NO\.?|EA|EACH)$/, 'NO').replace(/^(ITEM|IT)$/, 'IT').replace(/^(M2|SQM|M²)$/, 'SM').replace(/^(M|LIN M|LM)$/, 'LM')

/** Words of a description as a schedule would match them: lower case, no plurals, and joined pairs ("wet room" = "wetroom"). */
export function words(s: string): Set<string> {
  const w = s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9.]+/g, ' ').split(' ')
    .map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t && !STOP.has(t))
    .map(t => (t.length > 4 && /[^s]s$/.test(t) ? t.slice(0, -1) : t))
  const out = new Set(w)
  for (let i = 0; i + 1 < w.length; i++) out.add(w[i] + w[i + 1])
  return out
}

/**
 * How well a description fits the words asked for, 0–1: rarer words count for more, and words found
 * nowhere (a house number, a tenant's name) don't count against it.
 */
function fit(q: Set<string>, t: Set<string>, rarity: (w: string) => number | null) {
  let have = 0, all = 0
  for (const w of q) { const r = rarity(w); if (r == null) continue; all += r; if (t.has(w)) have += r }
  return all ? have / all : 0
}

export interface RateSources { jobs: Job[]; books: RateBook[]; items: RateItem[]; scope: ScopeItem[]; vos: Variation[] }
export interface RateQuery { what?: string; code?: string; unit?: string; job: Job }

/** The book a job prices from: the one holding most of the codes on its scope (ties: the first listed). */
export function jobBook(job: Job, s: RateSources): RateBook | null {
  const codes = new Set(s.scope.filter(i => i.jobId === job.id).map(i => i.code.trim().toUpperCase()).filter(Boolean))
  let best: RateBook | null = null, hits = 0
  for (const b of s.books) {
    const n = s.items.reduce((t, i) => t + (i.bookId === b.id && codes.has(i.code.toUpperCase()) ? 1 : 0), 0)
    if (n > hits) { best = b; hits = n }
  }
  return best
}

type Used = { job: Job; where: string; code: string; description: string; unit: string; rate: number; qty: number | null; at: number }

/**
 * Codes that fit the work, best first. Each says what the schedule prints for it (the job's own book
 * first) and where the company has already used it, at what rate, so the person sees the evidence.
 */
export function findRates(q: RateQuery, s: RateSources, limit = 6) {
  const book = jobBook(q.job, s)
  const jobsById = new Map(s.jobs.map(j => [j.id, j]))
  const used: Used[] = []
  for (const i of s.scope) {
    const job = jobsById.get(i.jobId)
    if (!job || i.rate == null || !i.code.trim()) continue
    used.push({ job, where: `${job.name}${i.property ? ` · No. ${i.property}` : ''}${i.room && i.room !== i.property ? ` · ${i.room}` : ''} (scope)`, code: i.code.trim().toUpperCase(), description: i.description, unit: i.unit, rate: i.rate, qty: i.qty, at: i.createdAt })
  }
  for (const v of s.vos) {
    const job = jobsById.get(v.jobId)
    if (!job || v.rate == null || !v.code.trim() || v.status === 'Rejected') continue
    used.push({ job, where: `${job.name} · ${voRef(v.number)}${v.room ? ` · ${v.room}` : ''}`, code: v.code.trim().toUpperCase(), description: v.description, unit: v.unit, rate: v.rate, qty: v.qty, at: v.dateRaised })
  }

  // how rare each word is across everything searched, so "wet room" outweighs "renew"
  const texts = [...s.items.map(i => `${i.short} ${i.long} ${i.subsection}`), ...used.map(u => u.description)]
  const df = new Map<string, number>()
  const cache = new Map<string, Set<string>>()
  const ws = (t: string) => { let w = cache.get(t); if (!w) { w = words(t); cache.set(t, w) } return w }
  for (const t of texts) for (const w of ws(t)) df.set(w, (df.get(w) ?? 0) + 1)
  const rarity = (w: string) => (df.has(w) ? Math.log(1 + texts.length / (1 + df.get(w)!)) : null)

  const want = q.what?.trim() ? words(q.what) : null
  const code = q.code?.trim().toUpperCase()
  const unit = q.unit?.trim() ? UNIT(q.unit) : null
  const score = (text: string, c: string) => (code ? (c === code ? 1 : c.startsWith(code) ? .8 : 0) : 0) || (want ? fit(want, ws(text), rarity) : 0)

  type Hit = { code: string; score: number; item?: RateItem; bookName?: string; used: Used[] }
  const hits = new Map<string, Hit>()
  const hit = (c: string) => { let h = hits.get(c); if (!h) { h = { code: c, score: 0, used: [] }; hits.set(c, h) } return h }
  const bookOrder = [...(book ? [book] : []), ...s.books.filter(b => b.id !== book?.id)]
  const itemsByBook = new Map(bookOrder.map(b => [b.id, s.items.filter(i => i.bookId === b.id)]))
  for (const b of bookOrder) for (const i of itemsByBook.get(b.id)!) {
    const sc = score(`${i.short} ${i.long} ${i.subsection}`, i.code.toUpperCase())
    if (sc < .5) continue
    const h = hit(i.code.toUpperCase())
    if (!h.item || (b.id === book?.id && h.bookName !== book.name)) { h.item = i; h.bookName = b.name }
    h.score = Math.max(h.score, sc)
  }
  for (const u of used) {
    const sc = score(u.description, u.code)
    const h = hits.get(u.code)
    if (sc >= .5 || h) { const x = h ?? hit(u.code); x.used.push(u); x.score = Math.max(x.score, sc) }
  }

  const unitOk = (h: Hit) => !unit || UNIT(h.item?.unit ?? h.used[0]?.unit ?? '') === unit
  const ranked = [...hits.values()]
    .filter(h => h.score >= .5 && unitOk(h))
    .map(h => ({ h, rank: h.score + (h.used.some(u => u.job.id === q.job.id) ? .15 : 0) + (h.used.some(u => u.job.client && u.job.client === q.job.client) ? .1 : 0)
      + (h.item && h.bookName === book?.name ? .1 : 0) + Math.min(h.used.length, 5) * .02 }))
    .sort((a, b) => b.rank - a.rank).slice(0, limit)

  return {
    book,
    matches: ranked.map(({ h }) => {
      const recent = [...h.used].sort((a, b) => (a.job.id === q.job.id ? -1 : 0) - (b.job.id === q.job.id ? -1 : 0) || b.at - a.at)
      const rates = [...new Set(h.used.map(u => u.rate))]
      const sched = h.item?.rate
      return {
        code: h.code,
        description: h.item ? (h.item.long && h.item.long !== h.item.short ? `${h.item.short} — ${h.item.long}` : h.item.short) : recent[0].description,
        unit: h.item?.unit ?? recent[0].unit,
        schedule: h.item ? `${money(h.item.rate)} per ${h.item.unit} in ${h.bookName}${h.item.section ? ` (${h.item.section})` : ''}` : 'not in any rate book loaded',
        usedBefore: recent.length ? recent.slice(0, 3).map(u => `${u.where}: ${u.description} — ${u.qty != null ? `${qtyText(u.qty)} ${u.unit} @ ` : ''}${money(u.rate)}`) : 'not used on a job yet',
        ...(recent.length > 3 ? { usedTimes: recent.length } : {}),
        ...(rates.length > 1 ? { rateCheck: `priced at ${rates.map(money).join(', ')} on different jobs` }
          : sched != null && rates.length === 1 && Math.abs(rates[0] - sched) > .005 ? { rateCheck: `used at ${money(rates[0])}, the schedule says ${money(sched)}` } : {}),
        rateFrom: h.item ? h.bookName : `${recent[0].where.replace(/ \(scope\)$/, '')}`,
        suggestedRate: sched ?? (rates.length === 1 ? rates[0] : recent[0].rate),
      }
    }),
  }
}
