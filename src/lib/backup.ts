/**
 * Safety net while data lives on the device (until the cloud database):
 *  - ask the browser to keep our storage permanently (not auto-cleared when space is low)
 *  - full backup to a file, and restore from it: jobs, scope, VOs, valuations, the diary, costs, orders, dayworks,
 *    documents, every photo, video, voice note and VO document, the company's details and its rate books
 */
import { db, JOB_STORES, rates, type JobStore } from './db'
import type { CompanySettings, DiaryEntry, Job, RateItem, ScopeItem, Valuation, Variation } from './types'

export async function keepStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
const dataUrlToBlob = async (u: string) => (await fetch(u)).blob()

interface Backup { app: 'mastor'; version: 1; exportedAt: string; jobs: Job[]; scope: ScopeItem[]; variations: Variation[]; valuations: Valuation[]; diary?: DiaryEntry[]; more?: Partial<Record<JobStore, { id: string; jobId: string }[]>>; photos: Record<string, string> ; settings?: CompanySettings; rates?: RateItem[] }

/** Every file the firm holds: job and VO photos, diary photos, video and voice, the client's VO documents, and the
 *  files kept on costs, orders, dayworks and documents. */
export function fileIds(jobs: Job[], variations: Variation[], diary: DiaryEntry[], more: Backup['more'] = {}): string[] {
  const files = Object.values(more ?? {}).flat().flatMap(r => { const x = r as { fileId?: string; beforeIds?: string[]; afterIds?: string[] }; return [x.fileId, ...(x.beforeIds ?? []), ...(x.afterIds ?? [])] })
  return [...new Set([...jobs.map(j => j.photoId), ...variations.flatMap(v => [...v.photoIds, ...(v.attachments ?? []).map(a => a.id)]), ...diary.flatMap(d => [d.mediaId, d.originalMediaId]), ...files].filter((x): x is string => !!x))]
}

export async function makeBackup(): Promise<Blob> {
  const jobs = await db.jobs()
  const scope = (await Promise.all(jobs.map(j => db.scope(j.id)))).flat()
  const variations = (await Promise.all(jobs.map(j => db.variations(j.id)))).flat()
  const valuations = (await Promise.all(jobs.map(j => db.valuations(j.id)))).flat()
  const diary = (await Promise.all(jobs.map(j => db.diary(j.id)))).flat()
  const more: Backup['more'] = {}
  for (const st of JOB_STORES) more[st] = (await Promise.all(jobs.map(j => db.list(st, j.id)))).flat()
  const ids = fileIds(jobs, variations, diary, more)
  const photos: Record<string, string> = {}
  for (const id of ids) { const b = await db.photo(id); if (b) photos[id] = await blobToDataUrl(b) }
  // the company's details (what goes on invoices) and its schedule-of-rates books go too: a firm can take everything with it
  const settings = await db.settings(), rateItems = await rates.all()
  const data: Backup = { app: 'mastor', version: 1, exportedAt: new Date().toISOString(), jobs, scope, variations, valuations, diary, more, photos, settings, rates: rateItems }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export function downloadBackup(blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mastor-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Restores a backup. Adds/overwrites by id — never deletes anything already on this device. */
export async function restoreBackup(text: string): Promise<{ jobs: number }> {
  const b = JSON.parse(text) as Backup
  if (b.app !== 'mastor' || !Array.isArray(b.jobs)) throw new Error('That file isn’t a Mastor backup.')
  for (const [id, url] of Object.entries(b.photos ?? {})) await db.putPhoto(id, await dataUrlToBlob(url))
  for (const j of b.jobs) await db.putJob(j)
  for (const s of b.scope ?? []) await db.putScope(s)
  for (const v of b.variations ?? []) await db.putVariation(v)
  for (const v of b.valuations ?? []) await db.putValuation(v)
  for (const d of b.diary ?? []) await db.putDiary(d)
  for (const st of JOB_STORES) for (const r of b.more?.[st] ?? []) await db.put(st, r as never)
  // company details only onto a device that has none: an old backup must never wind back the invoice numbers
  if (b.settings && !(await db.settings())) await db.putSettings(b.settings)
  if (b.rates?.length) for (const id of [...new Set(b.rates.map(r => r.bookId))]) await rates.put(id, b.rates.filter(r => r.bookId === id))
  return { jobs: b.jobs.length }
}
