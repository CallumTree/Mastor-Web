/**
 * The live wire: a pulse of current running round the contour of the one live thing on a screen
 * (the next step, the hot figure, the headline figure). Drop it inside an element with `className="live"`;
 * `r` is the contour's corner radius, `inset` how far inside the edge it runs. Styles in styles.css.
 */
export function Trace({ r = 0, inset = 4, color, delay }: { r?: number; inset?: number; color?: string; delay?: number }) {
  const style = { '--ti': `${inset}px`, ...(color && { '--trace-c': color }), ...(delay != null && { '--trace-d': `${delay}s` }) } as React.CSSProperties
  const rect = (cls: string) => <rect className={cls} pathLength={100} x={0} y={0} width="100%" height="100%" rx={r} ry={r} />
  return (
    <svg className="trace" aria-hidden="true" style={style}>
      {rect('tl')}{rect('tp t1')}{rect('tp t2')}{rect('tp t3')}
    </svg>
  )
}
