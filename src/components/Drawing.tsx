import type { WorkType } from '../lib/types'
import { DRAWINGS } from './drawings.generated'

/**
 * Construction-drawing backdrops, 400x200 sheet. Every drawing is ONE continuous line
 * (see tools/oneline.py). Active jobs get the signature: a single bright point with a glow
 * and a fading tail that travels the whole line, then loops back to the start.
 */
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

export function Drawing({ id, type, active, bare = false, paper = false }: { id: string; type: WorkType; active: boolean; bare?: boolean; paper?: boolean }) {
  const line = paper ? '#8A4E22' : '#C97B3F'
  const guide = paper ? '#1A1A2E' : '#C97B3F'
  const set = DRAWINGS[type] ?? DRAWINGS.PPR
  // Each type's first drawing is its detailed sketch-style one
  const drawing = set[0]
  const fid = 'glow' + hash(id)
  // The survey: the light travels the linework ONCE (2.4–3.6s whatever the line length), then fades.
  // It replays only when the drawing is mounted again (a different job), never on a loop.
  const len = drawing.length
  const dur = Math.min(3.6, Math.max(2.4, len / 450))
  const dash = ((paper ? 7 : 2.5) / len) * 1000   // head length in drawing units (longer on paper, where light reads less)
  const dasharray = `${dash} ${1000 - dash}`
  const tail = 12
  const step = dur * (dash / 1000) * 3       // spacing between tail segments (scaled with the faster pass)
  const run = (delay: number) => ({ strokeDasharray: dasharray, animationDuration: `${dur}s`, animationDelay: `${delay}s` })

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio={bare ? 'xMidYMax meet' : 'xMidYMid slice'} aria-hidden>
      {!bare && <rect width="400" height="200" fill="#1A1A2E" />}
      {!bare && (
        <g stroke="#2A2A48" strokeWidth=".5">
          {Array.from({ length: 21 }, (_, i) => <line key={'v' + i} x1={i * 20} y1="0" x2={i * 20} y2="200" />)}
          {Array.from({ length: 11 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 20} x2="400" y2={i * 20} />)}
        </g>
      )}
      <g fill="none" stroke={guide} strokeOpacity={paper ? .16 : .36} strokeWidth=".75" vectorEffect="non-scaling-stroke">
        {drawing.guides.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
      </g>
      <path d={drawing.d} fill="none" stroke={line} strokeOpacity={paper ? .75 : bare ? .6 : .45} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {active && (
        <>
          <defs>
            <filter id={fid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          <path d={drawing.d} pathLength={1000} className="beam" fill="none" stroke={paper ? "#C97B3F" : "#FFD29A"} strokeOpacity={paper ? .55 : 1} strokeWidth={paper ? 5 : 3.5} strokeLinecap="round"
            filter={`url(#${fid})`} style={run(0)} />
          {Array.from({ length: tail + 1 }, (_, k) => (
            <path key={k} d={drawing.d} pathLength={1000} className="beam" fill="none"
              stroke={k === tail ? (paper ? '#8F4E1F' : '#FFF4E4') : (paper ? '#C97B3F' : '#E8A868')} strokeOpacity={k === tail ? 1 : 0.08 + 0.6 * (k / tail)}
              strokeWidth={k === tail ? (paper ? 2 : 1.3) : (paper ? 1.4 : 0.9)} strokeLinecap="round" strokeLinejoin="round"
              style={run((tail - k) * step)} />
          ))}
        </>
      )}
    </svg>
  )
}
