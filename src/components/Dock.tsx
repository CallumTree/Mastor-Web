import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { reducedMotion } from '../lib/motion'

/** A scoop cut into the dock's top edge: where, how deep, and the radius of the circle it follows (the disc plus a gap). */
export interface Notch { x: number; depth: number; r: number }

/** Max with a rounded join (radius about k): exact where a and b are far apart, smooth where they meet. */
const smax = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + (h * h * k) / 4 }
const FILLET = 12

/** How far the top edge dips at x: flat, then each scoop following its circle (so the disc sits in it with an even gap),
 *  joined to the flat edge with a small rounded shoulder. Two scoops side by side run into one. */
export function edgeY(x: number, notches: Notch[]) {
  let y = 0
  for (const n of notches) {
    if (n.depth <= 0.2) continue
    const dx = x - n.x, cy = n.depth - n.r   // the circle's centre: above the edge for a shallow scoop
    const arc = Math.abs(dx) < n.r ? cy + Math.sqrt(n.r * n.r - dx * dx) : -1e6
    y = smax(y, arc, FILLET)
  }
  return y <= 0.3 ? 0 : y
}

/** The dock's outline: the top edge with its scoops, then down the sides and along the foot. */
export function dockPath(width: number, height: number, notches: Notch[], step = 2) {
  const pts: string[] = []
  for (let x = 0; x < width; x += step) pts.push(`${x},${+edgeY(x, notches).toFixed(2)}`)
  pts.push(`${width},${+edgeY(width, notches).toFixed(2)}`)
  return `M${pts[0]} L${pts.slice(1).join(' ')} L${width},${height} L0,${height} Z`
}

/** Eases a few numbers to new values over `ms` (frame by frame: Safari can't animate a path's shape in CSS). */
function useTween<T extends Record<string, number>>(target: T, ms = 280): T {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  const key = JSON.stringify(target)
  useEffect(() => {
    const from = cur.current
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') { cur.current = target; setV(target); return }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms), e = 1 - (1 - k) ** 3
      const next = Object.fromEntries(Object.keys(target).map(n => [n, from[n] + (target[n] - from[n]) * e])) as T
      cur.current = next; setV(next)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

/** Where the + sits: a column of its own in the middle of the dock, so neither scoop runs into a tab. */
export const captureSlot = (tabs: number) => Math.ceil(tabs / 2)

/** Scoop sizes: the + key's (a 60px disc, 5px gap, its centre 6px above the edge) and the open tab's (a 44px disc,
 *  its centre 4px above). The + key's place in CSS (.nav-capture bottom) and the disc's below match these. */
const CAP = { depth: 29, r: 35 }, TAB = { depth: 23, r: 27 }

/**
 * The phone dock's shape (styles: .nav-shape, .nav-disc): a scoop at its centre holding the + key, and a smaller scoop
 * under the open tab, its icon raised into a ringed disc. The open tab's scoop slides to the tab you tap; the centre
 * scoop closes while the page scrolls (the + sinks) and when there's no + (Clerk). On the narrowest phones and the
 * desktop rail none of this shows (CSS), and the dock is a plain bar.
 */
export function DockShape({ tabs, active, Icon, capture, sinking }: {
  tabs: number; active: number; Icon?: ComponentType<{ size?: number }>; capture: boolean; sinking: boolean
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  // measured from inside: the dock is this marker's parent (a parent's ref isn't set yet when a child's layout effect runs)
  const probe = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = probe.current?.parentElement; if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const slot = captureSlot(tabs), cols = tabs + 1, pad = 4
  const colW = (size.w - pad * 2) / cols
  const xOf = (col: number) => pad + colW * (col + 0.5)
  const lastX = useRef(0)
  if (active >= 0 && size.w) lastX.current = xOf(active < slot ? active : active + 1)
  const v = useTween({ ax: lastX.current, d1: capture && !sinking ? CAP.depth : 0, d2: active >= 0 ? TAB.depth : 0 })
  if (!size.w) return <span ref={probe} className="nav-probe" aria-hidden="true" />
  const notches: Notch[] = [{ x: xOf(slot), depth: v.d1, r: CAP.r }, { x: v.ax, depth: v.d2, r: TAB.r }]
  const lift = v.d2 / TAB.depth
  return (
    <>
      <span ref={probe} className="nav-probe" aria-hidden="true" />
      <svg className="nav-shape" aria-hidden="true" width={size.w} height={size.h} viewBox={`-0.5 -0.5 ${size.w} ${size.h}`}>
        <path d={dockPath(size.w - 1, size.h - 1, notches)} />
      </svg>
      {Icon && lift > 0.02 && (
        <span className="nav-disc" aria-hidden="true" style={{ left: v.ax, top: v.d2 - TAB.r - 22, transform: `translateX(-50%) scale(${0.6 + 0.4 * lift})` }}><Icon size={22} /></span>
      )}
    </>
  )
}
