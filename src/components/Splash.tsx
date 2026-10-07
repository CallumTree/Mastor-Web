import { Lambda, Theta } from './Wordmark'
import { useEffect, useState } from 'react'

/**
 * Opening titles: a copper line draws a Roman arch, the keystone drops in and locks it,
 * MASTOR rises letter by letter, a dimension line draws out underneath with the beam, then it
 * dissolves into the app. Plays once per visit, tap to skip, honours reduced motion.
 * The app loads underneath the whole time — this never delays anything.
 */
const KEY = 'mastor.splashSeen'
export function shouldPlaySplash() {
  try {
    // ?intro always plays it (handy for showing people, and for phones with animations reduced)
    if (new URLSearchParams(location.search).has('intro')) return true
    if (sessionStorage.getItem(KEY)) return false
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    return true
  } catch { return false }
}

export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ }
    const t1 = setTimeout(() => setLeaving(true), 2500)
    const t2 = setTimeout(onDone, 3100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  const skip = () => { setLeaving(true); setTimeout(onDone, 350) }
  return (
    <div className={'splash' + (leaving ? ' out' : '')} onClick={skip} role="presentation" aria-hidden="true">
      <div className="splash-sky" />
      <svg className="splash-arch" viewBox="0 0 120 110" width="132" height="121">
        {/* piers + arch: one continuous stroke drawn on */}
        <path className="draw" pathLength={1} d="M18 106 V58 A42 42 0 0 1 102 58 V106" />
        <path className="draw d2" pathLength={1} d="M10 106 H110" />
        <path className="draw d3" pathLength={1} d="M30 106 V60 A30 30 0 0 1 90 60 V106" />
        {/* keystone drops in last and locks the arch */}
        <path className="keystone" d="M53 9 L67 9 L64 26 L56 26 Z" />
      </svg>
      <div className="splash-word">{['M', <Lambda key="l" />, 'S', 'T', <Theta key="t" />, 'R'].map((c, i) => <span key={i} style={{ animationDelay: `${1.05 + i * 0.07}s` }}>{c}</span>)}</div>
      <div className="splash-dim"><i /><b /><i /><em /></div>
      <div className="splash-sub">Site · Variations · Valuations</div>
    </div>
  )
}
