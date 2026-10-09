/**
 * Site-sign marks. Status is told by shape as well as colour, the way safety signs do it:
 * stop = red circle with a bar · warn = yellow triangle · do = blue circle with an arrow · ok = green square with a tick.
 */
import type { ReactNode } from 'react'

export type SignKind = 'stop' | 'warn' | 'do' | 'ok'

export function SignMark({ kind, size = 18 }: { kind: SignKind; size?: number }) {
  const s = { width: size, height: size, flex: 'none' as const, display: 'block' }
  if (kind === 'stop') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--red)" /><rect x="4.5" y="8.4" width="11" height="3.2" fill="#fff" /></svg>
  if (kind === 'warn') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><path d="M10 1.2 19.2 18H.8z" fill="var(--yellow)" stroke="#121316" strokeWidth="1.4" strokeLinejoin="round" /><rect x="9.1" y="6.6" width="1.8" height="6" fill="#121316" /><rect x="9.1" y="14" width="1.8" height="1.8" fill="#121316" /></svg>
  if (kind === 'do') return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--blue)" /><path d="M5 10h8.2M10 6.2 13.8 10 10 13.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="square" /></svg>
  return <svg viewBox="0 0 20 20" style={s} aria-hidden="true"><rect x=".5" y=".5" width="19" height="19" rx="2" fill="var(--green)" /><path d="M5.2 10.2 8.4 13.4 14.8 6.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="square" /></svg>
}

/** Spoken name for each sign, so screen readers get the meaning the shape and colour carry. */
export const SIGN_WORD: Record<SignKind, string> = { stop: 'Urgent', warn: 'To do', do: 'Next', ok: 'Done' }

/** A sign plate: solid colour, condensed capitals. `wait` is the neutral outline plate (waiting on someone else). */
export function Plate({ kind, children }: { kind: SignKind | 'wait'; children: ReactNode }) {
  return <span className={'plate plate-' + kind}>{kind !== 'wait' && kind !== 'do' && <SignMark kind={kind} size={14} />}{kind === 'do' && <span aria-hidden="true" className="plate-arrow">➜</span>}<span>{children}</span></span>
}
