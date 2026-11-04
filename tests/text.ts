/** Finds text split across elements: figures are set in their own mono spans (src/components/Figs.tsx),
 *  so "62.1% of value" is two nodes. Matches the deepest element whose whole text matches. */
export const text = (m: string | RegExp) => (_: string, el: Element | null) => {
  const t = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()
  const hit = (e: Element) => (typeof m === 'string' ? t(e) === m : m.test(t(e)))
  return !!el && hit(el) && ![...el.children].some(hit)
}
