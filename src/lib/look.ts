/**
 * Look: 'photo' (default — real construction photography on the cover and job headers) or 'drawing'
 * (line drawings + beam).
 * Switch with ?look=photo or ?look=drawing on the address; the choice is remembered on this device.
 * Photos: Unsplash licence (free for commercial use).
 */
export type Look = 'drawing' | 'photo'
const KEY = 'mastor.look'

export function getLook(): Look {
  try {
    const q = new URLSearchParams(location.search).get('look')
    if (q === 'photo' || q === 'drawing') { localStorage.setItem(KEY, q); return q }
    return localStorage.getItem(KEY) === 'drawing' ? 'drawing' : 'photo'
  } catch { return 'photo' }
}

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`
// UK work: red brick + scaffold (Cheltenham). A job's own site photo always replaces these.
export const PHOTOS = {
  cover: { src: img('photo-1674568644622-01b419fb6e5a'), credit: 'Ottr Dan / Unsplash' },
  job: { src: img('photo-1674568644622-01b419fb6e5a'), credit: 'Ottr Dan / Unsplash' },
}
