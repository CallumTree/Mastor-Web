/**
 * Act, then Undo. A change to Mastor's own records (a tick-all, a delete) happens on the tap; for a few seconds one
 * bar offers to take it back (components/Undo.tsx). Nothing that reaches the client or makes an invoice or payment
 * record goes through here: those keep their one deliberate tap.
 *  - `undo` puts things back as they were.
 *  - `commit` is whatever was held back until the offer closed (a deleted photo's file is only removed then).
 * A new offer, the timer, or the app going to the background closes the one before it.
 */
export interface Offer { id: number; text: string; undo: () => unknown; commit?: () => unknown }

export const UNDO_MS = 6000
let current: Offer | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let n = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

/** Close the offer without undoing: what it held back now happens. */
export function settle() {
  const o = current; if (!o) return
  clearTimeout(timer); current = null; emit()
  void Promise.resolve().then(() => o.commit?.()).catch(e => console.warn('undo commit', e))
}
export function offerUndo(text: string, undo: () => unknown, commit?: () => unknown, ms = UNDO_MS) {
  settle()
  current = { id: ++n, text, undo, commit }
  timer = setTimeout(settle, ms)
  emit()
}
/** The person tapped Undo: put it back; what was held back never happens. */
export async function takeUndo() {
  const o = current; if (!o) return
  clearTimeout(timer); current = null; emit()
  await o.undo()
}
export const currentUndo = () => current
export const onUndoChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') settle() })
