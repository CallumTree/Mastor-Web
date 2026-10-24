import { db, uid } from './db'
import { fetchPhoto } from './sync'
import { thumbGet, thumbPut } from './thumbs'
import { useEffect, useState, type RefObject } from 'react'

/** Shrinks a camera photo to a sensible size before storing (phones shoot 5-10MB images). */
export async function savePhoto(file: File): Promise<string> {
  // createImageBitmap is missing on older iPhones — fall back to a plain <img>
  const bitmap: { width: number; height: number } & CanvasImageSource = typeof createImageBitmap === 'function'
    ? await createImageBitmap(file)
    : await new Promise<HTMLImageElement>((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file) })
  const max = 1600
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.8))
  const id = uid()
  await db.putPhoto(id, blob)
  // the photo is already decoded here, so its tile copy costs next to nothing now (instead of a decode on first view)
  thumbOf(canvas).then(t => t && thumbPut(id, t)).catch(() => {})
  return id
}

/** A photo (canvas or decoded bitmap) scaled down to tile size, as a JPEG. */
function thumbOf(src: CanvasImageSource & { width: number; height: number }): Promise<Blob | null> {
  const scale = Math.min(1, THUMB / Math.max(src.width, src.height))
  const c = document.createElement('canvas'); c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.78))
}

export function usePhotoUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    let live = true
    // local copy first; if it was taken on another device, fetch it from the cloud once
    if (id) db.photo(id).then(b => b ?? fetchPhoto(id)).then(b => { if (b && live) { u = URL.createObjectURL(b); setUrl(u) } }).catch(() => {})
    else setUrl(null)
    return () => { live = false; if (u) URL.revokeObjectURL(u) }
  }, [id])
  return url
}

/*
 * Thumbnails. A grid of tiles showing full 1600px photos holds ~8MB of decoded pixels per tile (40 photos ≈ 300MB,
 * enough for a phone to drop the tab). Each photo gets a 480px copy, made when it's taken (or, for one taken on another
 * phone, the first time it's shown small), kept in its own local cache: never synced, never in a backup, safe to lose
 * (it's remade from the photo).
 */
const THUMB = 480

async function makeThumb(full: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(full)
  try { return await thumbOf(bmp) } finally { bmp.close?.() }
}

// two at a time: making 40 thumbnails at once would decode 40 full photos at once — the spike this avoids
let running = 0
const waiting: (() => void)[] = []
async function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>(r => waiting.push(r))
  running++
  try { return await fn() } finally { running--; waiting.shift()?.() }
}

async function thumbFor(id: string): Promise<Blob | null> {
  const cached = await thumbGet(id).catch(() => undefined)
  if (cached) return cached
  return oneAtATime(async () => {
    const full = (await db.photo(id)) ?? (await fetchPhoto(id))
    if (!full) return null
    if (typeof createImageBitmap !== 'function' || !full.type.startsWith('image/')) return full   // older iPhones, or not a photo: show it as is
    const t = await makeThumb(full).catch(() => null)
    if (!t) return full
    thumbPut(id, t).catch(() => {})
    return t
  })
}

/**
 * A photo shown as a small tile: a 480px copy, made only once the tile is near the screen (pass the tile's ref).
 * Use usePhotoUrl for the full-size view.
 */
export function usePhotoThumb(id: string | null | undefined, near?: RefObject<Element | null>): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const [seen, setSeen] = useState(!near)
  useEffect(() => {
    const el = near?.current
    if (seen || !el || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near, seen])
  useEffect(() => {
    let u: string | null = null, live = true
    if (id && seen) thumbFor(id).then(b => { if (b && live) { u = URL.createObjectURL(b); setUrl(u) } }).catch(() => {})
    else if (!id) setUrl(null)
    return () => { live = false; if (u) URL.revokeObjectURL(u) }
  }, [id, seen])
  return url
}

/** Videos are stored as recorded. Free storage caps a file at 50MB — roughly 30–40 seconds on most phones. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export async function saveVideo(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`That clip is ${(file.size / 1048576).toFixed(0)}MB — the limit is 50MB (about 30–40 seconds). Try a shorter clip.`)
  const id = uid()
  await db.putPhoto(id, file)
  return id
}

/** Saves an already-encoded image (e.g. a marked-up photo). */
export async function saveImageBlob(blob: Blob): Promise<string> {
  const id = uid()
  await db.putPhoto(id, blob)
  return id
}

/** A voice note (already a small WAV — see voice.ts). */
export async function saveVoice(blob: Blob): Promise<string> {
  const id = uid()
  await db.putPhoto(id, blob)
  return id
}
