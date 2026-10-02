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
  { n: 1, id: 'photo-1676680282935-2ec0c48b71f4', what: 'Apartments going up in scaffold — Farringdon, London', credit: 'Seb Doe' },
  { n: 2, id: 'photo-1621983209342-ebf870427308', what: 'New housing estate being built — Bedford', credit: 'James Feaver' },
  { n: 3, id: 'photo-1674568644622-01b419fb6e5a', what: 'Red brick in scaffold — Cheltenham', credit: 'Ottr Dan' },
  { n: 4, id: 'photo-1639953803381-e9c3f3a38253', what: 'New home going up in scaffold', credit: 'Sandy Millar' },
  { n: 5, id: 'photo-1693639767415-27ff64ce4da2', what: 'Timber frame in scaffold at dusk (the first one)', credit: 'Troy Mortier' },
]
export const imgUrl = img
const PICK = 'mastor.coverPick'
export function coverPick(): string | null { try { return localStorage.getItem(PICK) } catch { return null } }
export function setCoverPick(id: string | null) { try { if (id) localStorage.setItem(PICK, id); else localStorage.removeItem(PICK) } catch { /* ignore */ } }

// Cover = the photo being trialled on this device, else the chosen default. A job's own site photo always wins.
const chosen = CANDIDATES.find(c => c.id === 'photo-1674568644622-01b419fb6e5a')!
const trial = () => CANDIDATES.find(c => c.id === coverPick())
export const PHOTOS = {
  get cover() { const c = trial() ?? chosen; return { src: img(c.id), credit: `${c.credit} / Unsplash` } },
  get job() { const c = trial() ?? chosen; return { src: img(c.id), credit: `${c.credit} / Unsplash` } },
}
