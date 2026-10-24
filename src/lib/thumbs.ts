/**
 * The local thumbnail cache (see usePhotoThumb in photos.ts): its own small database, so it's never synced,
 * never in a backup, and wiped on sign-out with everything else.
 */
let thumbDb: Promise<IDBDatabase> | null = null
const thumbStore = () => (thumbDb ??= new Promise((res, rej) => {
  const r = indexedDB.open('mastor-thumbs', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('t')
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
}))
export const thumbGet = async (id: string) => { const d = await thumbStore(); return new Promise<Blob | undefined>((res, rej) => { const q = d.transaction('t').objectStore('t').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) }) }
export const thumbPut = async (id: string, b: Blob) => { const d = await thumbStore(); return new Promise<void>((res, rej) => { const t = d.transaction('t', 'readwrite'); t.objectStore('t').put(b, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
export const clearThumbs = async () => { const d = await thumbStore(); return new Promise<void>((res, rej) => { const t = d.transaction('t', 'readwrite'); t.objectStore('t').clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
