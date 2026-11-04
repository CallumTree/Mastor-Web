/**
 * Figures in running text. Every amount, rate, quantity and percentage is set in the mono, tabular, even
 * inside a sentence, a button or a note, so a figure always reads as a figure and digits never wobble.
 * `fig` marks one figure; `figs` finds them in a sentence (the words stay in Archivo).
 */
import type { ReactNode } from 'react'

/** The schedule's own units of measure: a quantity reads as one figure with its unit ("21.8 LM", "93 SM"). */
const UNIT = '(?:SM|LM|NR|M2|M3|HRS?|ITEM|Item|KG|kg|m2|m3|nr|M|m)'
/** £ amounts, percentages, measured quantities and hours ("3h"). Counts of things and dates ("6 days", "4 lines") stay as words. */
const FIG = new RegExp(`(−?£\\s?-?[\\d,]+(?:\\.\\d+)?|-?\\d[\\d,]*(?:\\.\\d+)?\\s?%|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?${UNIT}\\b|\\b\\d+(?:\\.\\d+)?h\\b)`, 'g')

export const fig = (text: ReactNode) => <span className="fig-i">{text}</span>

export function figs(text: string | null | undefined | false): ReactNode {
  if (!text) return text || null
  const parts = text.split(FIG)
  if (parts.length === 1) return text
  return parts.map((p, i) => (i % 2 ? <span key={i} className="fig-i">{p}</span> : p))
}
