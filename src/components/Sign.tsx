/**
 * Site-sign marks. Status is told by shape as well as colour, the way safety signs do it:
 * stop = red circle with a bar · warn = amber triangle · do = amber circle with an arrow · ok = emerald square with a tick.
 * Each is a lit signal on the dark instrument, its inner mark cut in near-black.
 */
import type { ReactNode } from 'react'
import { ukDate } from '../lib/format'

export type SignKind = 'stop' | 'warn' | 'do' | 'ok'

export function SignMark({ kind, size = 18 }: { kind: SignKind; size?: number }) {
  const s = { width: size, height: size, flex: 'none' as const, display: 'block' }
  if (kind === 'stop') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--red)" /><rect x="4.5" y="8.4" width="11" height="3.2" fill="var(--on-signal)" /></svg>
  if (kind === 'warn') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><path d="M10 1.2 19.2 18H.8z" fill="var(--amber)" /><rect x="9.1" y="6.6" width="1.8" height="6" fill="var(--on-signal)" /><rect x="9.1" y="14" width="1.8" height="1.8" fill="var(--on-signal)" /></svg>
  if (kind === 'do') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--amber)" /><path d="M5 10h8.2M10 6.2 13.8 10 10 13.8" fill="none" stroke="var(--on-signal)" strokeWidth="2.2" strokeLinecap="square" /></svg>
  return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><rect x=".5" y=".5" width="19" height="19" rx="1.5" fill="var(--emerald)" /><path d="M5.2 10.2 8.4 13.4 14.8 6.8" fill="none" stroke="var(--on-signal)" strokeWidth="2.2" strokeLinecap="square" /></svg>
}

/** Spoken name for each sign, so screen readers get the meaning the shape and colour carry. */
export const SIGN_WORD: Record<SignKind, string> = { stop: 'Urgent', warn: 'To do', do: 'Next', ok: 'Done' }

/** A sign plate: a 1px frame in the signal colour, semi-condensed capitals. `wait` is the quiet plate (waiting on someone else). */
export function Plate({ kind, children }: { kind: SignKind | 'wait'; children: ReactNode }) {
  return <span className={'plate plate-' + kind}>{kind !== 'wait' && kind !== 'do' && <SignMark kind={kind} size={14} />}{kind === 'do' && <svg aria-hidden="true" className="plate-arrow" width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h8.5M6 2.2 9.8 6 6 9.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></svg>}<span>{children}</span></span>
}

/** A record Claude changed through the connector. It stays until a person saves the record, which shows they've checked it. */
export function ByClaude({ at }: { at?: number | null }) {
  if (!at) return null
  return <span className="badge b-claude" title={`Changed by Claude on ${ukDate(at)}: check it`}>by Claude</span>
}
