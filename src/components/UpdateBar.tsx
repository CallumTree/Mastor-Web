import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Keeps the app on the device (service worker), quietly. When a new version has downloaded,
 * a bar offers the reload — it never reloads on its own, so nothing half-typed is lost.
 */
export function UpdateBar() {
  const [state, setState] = useState<'none' | 'update'>('none')
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    const u = registerSW({
      onNeedRefresh: () => setState('update'),
      // working offline is simply how Mastor is: nothing to announce
    })
    setUpdate(() => u)
  }, [])
  if (state !== 'update') return null
  return (
    <div className="update-bar" role="status" aria-live="polite">
      <span className="grow">A new version of Mastor is ready.</span><button className="btn btn-primary" onClick={() => update?.(true)}>Reload</button>
    </div>
  )
}
