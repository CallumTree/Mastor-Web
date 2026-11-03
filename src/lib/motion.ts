/**
 * Motion helpers. Every animation in the app explains something that just happened (a line went into the
 * valuation, a capture uploaded, a valuation was paid); none plays when a screen first opens.
 * With the phone's Reduce Motion setting the movement goes and the colour change that confirms it stays.
 */

/** True when movement should be left out: the person asked for less motion, or the browser can't say (tests, old phones). */
export function reducedMotion(): boolean {
  try { return typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** One character position of a rolling figure. `from`/`to` are '' where the figure is shorter. */
export interface RollSlot { from: string; to: string; delay: number }
export const ROLL_MS = 380
export const ROLL_STEP = 28

/**
 * How a figure rolls from one value to the next: lined up from the right (pence under pence), a character
 * that didn't change stays put, and the ones that did roll one after another from the right.
 */
export function rollParts(from: string, to: string): { slots: RollSlot[]; down: boolean; ms: number } {
  const n = Math.max(from.length, to.length)
  const a = from.padStart(n, '\u0000'), b = to.padStart(n, '\u0000')
  const slots: RollSlot[] = []
  let k = 0
  for (let i = n - 1; i >= 0; i--) {
    const f = a[i] === '\u0000' ? '' : a[i], t = b[i] === '\u0000' ? '' : b[i]
    slots.unshift({ from: f, to: t, delay: f === t ? -1 : k++ * ROLL_STEP })
  }
  const num = (s: string) => { const x = parseFloat(s.replace(/[^\d.-]/g, '')); return isFinite(x) ? x : 0 }
  return { slots, down: num(to) < num(from), ms: ROLL_MS + Math.max(0, k - 1) * ROLL_STEP }
}
