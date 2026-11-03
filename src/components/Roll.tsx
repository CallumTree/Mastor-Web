/**
 * A figure that rolls when it changes: only the characters that changed move, the rightmost first; a rise rolls
 * up, a fall rolls down. Never when it first shows, so a screen opening waits on nothing. With Reduce Motion the
 * new figure is simply there, lit cyan for a moment. Screen readers get the new figure, never the moving parts.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { reducedMotion, rollParts } from '../lib/motion'

export function Roll({ text }: { text: string }) {
  const shown = useRef(text)
  const [run, setRun] = useState<{ from: string; to: string; n: number; flash: boolean } | null>(null)
  useLayoutEffect(() => {
    if (shown.current === text) return
    const from = shown.current
    shown.current = text
    const flash = reducedMotion()
    const { ms } = rollParts(from, text)
    setRun(r => ({ from, to: text, n: (r?.n ?? 0) + 1, flash }))
    const t = setTimeout(() => setRun(null), flash ? 700 : ms + 40)
    return () => clearTimeout(t)
  }, [text])
  if (!run || run.to !== text) return <>{text}</>
  if (run.flash) return <span key={run.n} className="roll-flash">{text}</span>
  const { slots, down } = rollParts(run.from, run.to)
  return (
    <span key={run.n} className={'roll' + (down ? ' down' : '')}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {slots.map((s, i) => s.delay < 0 ? s.to : (
          <span key={i} className={'roll-slot' + (!s.from ? ' grow' : !s.to ? ' shrink' : '')} style={{ animationDelay: `${s.delay}ms` }}>
            <span className="roll-col" style={{ animationDelay: `${s.delay}ms` }}>
              {down ? <><span>{s.to || ' '}</span><span>{s.from || ' '}</span></> : <><span>{s.from || ' '}</span><span>{s.to || ' '}</span></>}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
