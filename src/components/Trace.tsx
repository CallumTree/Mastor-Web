import { useEffect, useRef } from 'react'
import { perimeter } from '../lib/trace'

/**
 * The live wire: a pulse of current running round the contour of the one live thing on a screen
 * (the next step, the hot figure, the headline figure). Drop it inside an element with `className="live"`;
 * `r` is the contour's corner radius, `inset` how far inside the edge it runs. Styles in styles.css.
 *
 * Driven from script in real pixels (the contour's length is measured, not left to pathLength and calc()
 * in keyframes, which Safari handles unreliably), so it moves the same on an iPhone as on a desktop.
 * One lap 0.6s after the screen opens, then one every 7s; under reduced motion, the first lap only.
 */
const CYCLE = 7000, LAP = 3800
const DASHES: [string, number][] = [['t1', 26], ['t2', 9], ['t3', 2]]   // tail, body, head: % of the contour

export function Trace({ r = 0, inset = 4, color, delay = .6 }: { r?: number; inset?: number; color?: string; delay?: number }) {
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svg.current
    if (!el || typeof el.animate !== 'function') return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let anims: Animation[] = [], size = ''

    const run = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w < 4 || h < 4 || `${w}x${h}` === size) return
      size = `${w}x${h}`
      const P = perimeter(w, h, Math.min(r, w / 2, h / 2))
      const at = anims[0]?.currentTime ?? null
      anims.forEach(a => a.cancel())
      anims = DASHES.map(([cls, pct]) => {
        const dash = el.querySelector<SVGRectElement>('.' + cls)!, L = (pct / 100) * P
        dash.style.strokeDasharray = `${L}px ${P - L}px`
        const k = LAP / CYCLE, off = (t: number) => `${L - P * t}px`
        const a = dash.animate(still ? [
          { strokeDashoffset: off(0), opacity: 0 }, { strokeDashoffset: off(.08), opacity: 1, offset: .08 },
          { strokeDashoffset: off(.87), opacity: 1, offset: .87 }, { strokeDashoffset: off(1), opacity: 0 },
        ] : [
          { strokeDashoffset: off(0), opacity: 0 }, { strokeDashoffset: off(.08), opacity: 1, offset: .08 * k },
          { strokeDashoffset: off(.87), opacity: 1, offset: .87 * k }, { strokeDashoffset: off(1), opacity: 0, offset: k },
          { strokeDashoffset: off(1), opacity: 0 },
        ], { duration: still ? LAP : CYCLE, delay: delay * 1000, iterations: still ? 1 : Infinity, easing: 'linear' })
        if (at != null) a.currentTime = at
        return a
      })
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(el)
    return () => { ro.disconnect(); anims.forEach(a => a.cancel()) }
  }, [r, delay])

  const style = { '--ti': `${inset}px`, ...(color && { '--trace-c': color }) } as React.CSSProperties
  const rect = (cls: string) => <rect className={cls} x={0} y={0} width="100%" height="100%" rx={r} ry={r} />
  return (
    <svg ref={svg} className="trace" aria-hidden="true" style={style}>
      {rect('tl')}{rect('tp t1')}{rect('tp t2')}{rect('tp t3')}
    </svg>
  )
}
