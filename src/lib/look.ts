/**
 * Look preview: 'drawing' (default — line drawings + beam) or 'photo' (real construction photography).
 * Switch with ?look=photo or ?look=drawing on the address; the choice is remembered on this device.
 * Photos: Unsplash licence (free for commercial use).
 */
export type Look = 'drawing' | 'photo'
const KEY = 'mastor.look'

export function getLook(): Look {
  try {
    const q = new URLSearchParams(location.search).get('look')
    if (q === 'photo' || q === 'drawing') { localStorage.setItem(KEY, q); return q }
    return localStorage.getItem(KEY) === 'photo' ? 'photo' : 'drawing'
  } catch { return 'drawing' }
}

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`
export const PHOTOS = {
  cover: { src: img('photo-1693639767415-27ff64ce4da2'), credit: 'Troy Mortier / Unsplash' },
  job: { src: img('photo-1639953803381-e9c3f3a38253'), credit: 'Sandy Millar / Unsplash' },
}
