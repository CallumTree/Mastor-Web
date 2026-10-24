import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { SignMark } from './Sign'

/**
 * What went wrong, in site words. Everything Mastor stores is written to the phone the moment it's
 * saved, so a failure here means the one action didn't happen — never that earlier work is gone.
 */
export function describeProblem(err: unknown): string | null {
  const e = err as { name?: string; message?: string } | null
  const name = e?.name ?? '', msg = String(e?.message ?? err ?? '')
  if (name === 'AbortError') return null   // a share or file picker the person closed themselves
  if (name === 'QuotaExceededError' || /quota|storage.*full|no space/i.test(msg))
    return 'This phone is out of storage space, so that wasn’t saved. Free up some space (old videos and photos in the phone’s gallery are the quickest) and try again.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg))
    return 'No signal reached the server, so that didn’t go through. It will work once you have signal — try again then.'
  return `That didn’t work${msg ? ` (${msg.slice(0, 160)})` : ''}. Nothing you saved before is affected — try again.`
}

/** A failed action anywhere in the app (an unhandled promise) comes up here instead of failing silently. */
export function ProblemBar() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    const on = (ev: PromiseRejectionEvent) => { const t = describeProblem(ev.reason); if (t) { setText(t); console.error(ev.reason) } }
    window.addEventListener('unhandledrejection', on)
    return () => window.removeEventListener('unhandledrejection', on)
  }, [])
  if (!text) return null
  return (
    <div className="update-bar problem-bar" role="alert">
      <SignMark kind="stop" size={22} />
      <span className="grow">{text}</span>
      <button className="btn btn-secondary" onClick={() => setText(null)}>OK</button>
    </div>
  )
}

/** A screen that crashes shows this instead of a blank app. Reloading is safe: saved work lives on the phone. */
export class ProblemBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error(err, info.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <main className="problem-page" role="alert">
        <SignMark kind="stop" size={44} />
        <h1>This screen hit a problem</h1>
        <p>Everything you’ve saved is kept on this phone. Reload and carry on from where you were.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>Reload Mastor</button>
        <p className="t-small problem-detail">{this.state.err.message}</p>
      </main>
    )
  }
}
