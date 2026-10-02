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
/** Free cover candidates (Unsplash licence). Pick one at /#photos; it can be trialled on this device. */
export const CANDIDATES = [
  { n: 1, id: 'photo-1674568644622-01b419fb6e5a', what: 'Red brick in scaffold — Cheltenham', credit: 'Ottr Dan' },
  { n: 2, id: 'photo-1670859255589-17b4cfcc6620', what: 'Crane over the City of London', credit: 'James Sullivan' },
  { n: 3, id: 'photo-1670859255584-8b162775407f', what: 'London construction cranes', credit: 'James Sullivan' },
  { n: 4, id: 'photo-1710883727427-59d1ccc368fa', what: 'Row of red-brick new builds — UK', credit: 'Modunite Ltd' },
  { n: 5, id: 'photo-1710883727446-0bf5692fd709', what: 'Two-storey brick new build — UK', credit: 'Modunite Ltd' },
  { n: 6, id: 'photo-1710883727434-01c65fc14c76', what: 'Brick new build with garages — UK', credit: 'Modunite Ltd' },
  { n: 7, id: 'photo-1693639767415-27ff64ce4da2', what: 'Timber frame in scaffold at dusk (the first one)', credit: 'Troy Mortier' },
  { n: 8, id: 'photo-1639953803381-e9c3f3a38253', what: 'New home going up in scaffold', credit: 'Sandy Millar' },
]
export const imgUrl = img
const PICK = 'mastor.coverPick'
export function coverPick(): string | null { try { return localStorage.getItem(PICK) } catch { return null } }
export function setCoverPick(id: string | null) { try { if (id) localStorage.setItem(PICK, id); else localStorage.removeItem(PICK) } catch { /* ignore */ } }

// Cover = the photo being trialled on this device, else the chosen default. A job's own site photo always wins.
const chosen = CANDIDATES[0]
const trial = () => CANDIDATES.find(c => c.id === coverPick())
export const PHOTOS = {
  get cover() { const c = trial() ?? chosen; return { src: img(c.id), credit: `${c.credit} / Unsplash` } },
  get job() { const c = trial() ?? chosen; return { src: img(c.id), credit: `${c.credit} / Unsplash` } },
}
