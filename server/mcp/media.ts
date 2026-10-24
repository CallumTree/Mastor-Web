/**
 * Site captures for Claude: photos are handed over as images to look at; voice notes and videos are
 * transcribed by the same Gemini reader the app uses ("Read today"), which also says what a video shows.
 * A transcript is kept on its diary entry, so a clip is only transcribed (and counted) once.
 */
import type { DiaryEntry } from '../../src/lib/types'
import { media, saveTranscript, useAi, type Ctx } from './data'
// @ts-expect-error plain JS modules shared with the other /api functions
import { transcribe } from '../../api/read-site.js'
// @ts-expect-error plain JS module
import { geminiKey } from '../../api/_guard.js'

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

const head = (e: DiaryEntry) => `${e.type === 'photo' ? 'Photo' : e.type === 'video' ? 'Video' : 'Voice note'} ${e.id} · ${e.date}${e.room ? ` · ${e.room}` : ''}${e.note ? ` · caption: “${e.note}”` : ''}${e.originalMediaId ? ' · marked up on site' : ''}`

export async function siteMedia(ctx: Ctx, diary: DiaryEntry[], ids: string[]): Promise<Content[]> {
  const out: Content[] = []
  for (const id of ids) {
    const e = diary.find(x => x.id === id)
    if (!e || !e.mediaId) { out.push({ type: 'text', text: `${id}: no photo, video or voice note with that id on this job.` }); continue }
    if (e.type === 'photo') {
      const f = await media(ctx, e.mediaId)
      if (!f) { out.push({ type: 'text', text: `${head(e)}: not uploaded from the phone yet (it syncs when the phone has signal).` }); continue }
      out.push({ type: 'text', text: head(e) }, { type: 'image', data: f.bytes.toString('base64'), mimeType: f.type.startsWith('image/') ? f.type : 'image/jpeg' })
      continue
    }
    if (e.transcript) { out.push({ type: 'text', text: `${head(e)}\nWhat was said: ${e.transcript}` }); continue }
    const key = geminiKey() as string
    if (!key) { out.push({ type: 'text', text: `${head(e)}: can’t be transcribed — voice and video reading isn’t set up (GEMINI_API_KEY in Vercel).` }); continue }
    const f = await media(ctx, e.mediaId)
    if (!f) { out.push({ type: 'text', text: `${head(e)}: not uploaded from the phone yet (it syncs when the phone has signal).` }); continue }
    try {
      await useAi(ctx, 'site')
      const mime = e.type === 'voice' ? 'audio/wav' : (f.type.startsWith('video/') ? f.type : 'video/mp4')
      const t = String(await transcribe(f.bytes, mime, key)).trim()
      await saveTranscript(ctx, e, t)
      out.push({ type: 'text', text: `${head(e)}\nWhat was said: ${t}` })
    } catch (x) {
      out.push({ type: 'text', text: `${head(e)}: couldn’t be transcribed (${(x as Error).message}).` })
    }
  }
  return out
}
