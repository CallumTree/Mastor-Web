const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
export const money = (n: number) => gbp.format(Math.round(n * 100) / 100)
/** Roman numerals — valuations and variations are numbered the old way: VAL III, VO XII. */
export function roman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return String(n)
  const t: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = '', x = Math.floor(n)
  for (const [v, s] of t) while (x >= v) { out += s; x -= v }
  return out
}
export const voRef = (n: number) => `VO ${roman(n)}`
export const ukDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
export const qtyText = (q: number) => (Number.isInteger(q) ? String(q) : q.toFixed(2))
export const upliftFactor = (u1: number, u2: number) => (1 + u1 / 100) * (1 + u2 / 100)
