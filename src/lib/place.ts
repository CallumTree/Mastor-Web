/**
 * Where you are in the app (the open job and its tab), kept in the address. A reload, an update, or the
 * phone dropping the app in the background then brings you back to the same job and tab instead of the
 * job list. It replaces the address rather than adding history, so the back button isn't filled with tabs.
 */
export type PlaceKey = 'job' | 'tab'

export const placeParam = (k: PlaceKey) => new URLSearchParams(location.search).get(k)

export function setPlace(p: Partial<Record<PlaceKey, string | null>>) {
  const u = new URL(location.href)
  for (const [k, v] of Object.entries(p)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
  if (u.href !== location.href) history.replaceState(history.state, '', u)
}
