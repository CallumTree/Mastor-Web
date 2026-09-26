import { db, uid } from './db'
import { useEffect, useState } from 'react'

/** Shrinks a camera photo to a sensible size before storing (phones shoot 5-10MB images). */
export async function savePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const max = 1600
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.8))
  const id = uid()
  await db.putPhoto(id, blob)
  return id
}

export function usePhotoUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    let live = true
    if (id) db.photo(id).then(b => { if (b && live) { u = URL.createObjectURL(b); setUrl(u) } })
    else setUrl(null)
    return () => { live = false; if (u) URL.revokeObjectURL(u) }
  }, [id])
  return url
}
