import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Keeps the app on the device (service worker) and says so once. When a new version has downloaded,
 * a bar offers the reload — it never reloads on its own, so nothing half-typed is lost.
 */
export function UpdateBar() {
  const [state, setState] = useState<'none' | 'offline-ready' | 'update'>('none')
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    const u = registerSW({
      onNeedRefresh: () => setState('update'),
      onOfflineReady: () => { setState('offline-ready'); setTimeout(() => setState(s => (s === 'offline-ready' ? 'none' : s)), 6000) },
    })
    setUpdate(() => u)
  }, [])
  if (state === 'none') return null
  return (
    <div className="update-bar" role="status" aria-live="polite">
      {state === 'update'
        ? <><span className="grow">A new version of Mastor is ready.</span><button className="btn btn-primary" onClick={() => update?.(true)}>Reload</button></>
        : <span className="grow">Mastor is saved on this device — it will open with no signal.</span>}
    </div>
  )
}
