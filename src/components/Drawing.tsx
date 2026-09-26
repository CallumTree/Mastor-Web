import type { WorkType } from '../lib/types'

/**
 * Construction-drawing backdrops. Line work only, drawn on a 400x200 sheet.
 * Active jobs get the signature: a band of copper light sweeping across the linework —
 * the same lines drawn a second time with an animated gradient stroke.
 */
type Lines = string[] // SVG path data

const RESIDENTIAL: Lines[] = [
  // detailed perspective house (sketch style)
  [
    // construction guides — overshoot past corners like a hand sketch
    'g:M0 178H400', 'g:M20 72L360 80', 'g:M10 128L380 136', 'g:M70 8V190', 'g:M252 4V192', 'g:M322 10V186',
    'g:M100 14V130', 'g:M150 20V60', 'g:M262 16V60', 'g:M40 60H340', 'g:M60 40L300 30', 'g:M30 190L150 170', 'g:M380 190L300 172',
    'g:M88 30V80M120 24V70M180 20V66M220 18V66M290 22V70M340 30V76', 'g:M80 30H350M84 44H346',
    // upper storey (set back)
    'M100 124V74L240 76V127', 'M240 76L310 70V121', 'M100 124L240 127L310 121',
    // hipped main roof + fascia
    'M86 74L252 77L324 68', 'M86 77L252 80L324 71', 'M86 74L150 50H262L324 68', 'M252 77L262 50', 'M150 50L200 42H262',
    // chimneys
    'M176 53V36H192V52', 'M172 36H196', 'M226 51V30H240V51', 'M222 30H244',
    // upper windows
    'M112 88H136V114H112Z', 'M124 88V114', 'M150 89H182V116H150Z', 'M166 89V116M150 102H182', 'M196 90H226V117H196Z', 'M211 90V117',
    'M256 81L276 79V104L256 106Z', 'M282 78L300 76V101L282 103Z',
    // porch roof wrapping the front
    'M42 130L262 137L348 126', 'M42 133L262 140L348 129', 'M42 130L100 118', 'M262 137L240 124', 'M348 126L310 118',
    // porch posts
    'M50 133V172', 'M96 134V173', 'M144 136V174', 'M192 137V175', 'M240 139V176', 'M292 135V171', 'M340 130V168',
    // ground floor openings behind the porch
    'M104 146H136V174H104Z', 'M120 146V174', 'M152 146H184V175H152Z', 'M168 146V175', 'M200 147H228V176H200Z',
    'M262 142L284 140V170L262 172Z', 'M300 138L324 136V166L300 168Z',
    // deck, plinth and steps
    'M36 172L262 178L352 167', 'M36 176L262 182L352 171', 'M36 172V176', 'M352 167V171',
    'M58 176H90V180H58Z', 'M54 180H94V184H54Z',
    // tree
    'M372 166V132', 'M372 150L360 140M372 144L384 134', 'M372 132C356 132 352 112 364 106C364 94 382 92 386 104C398 106 398 126 384 130C382 134 376 134 372 132Z',
    // shrubs
    'M14 176C12 166 22 160 28 166C34 158 44 164 40 176',
  ],
  // terraced row
  ['M20 170H380', 'M40 170V100L90 60 140 100V170', 'M140 170V100L190 60 240 100V170', 'M240 170V100L290 60 340 100V170',
   'M60 120h24v22H60z', 'M100 130h18v40h-18z', 'M160 120h24v22h-24z', 'M200 130h18v40h-18z', 'M260 120h24v22h-24z', 'M300 130h18v40h-18z',
   'M115 80V58h12v31', 'M215 80V58h12v31', 'M315 80V58h12v31'],
  // semi pair
  ['M20 170H380', 'M90 170V95L200 45 310 95V170', 'M200 45V170', 'M195 55V30h10v25',
   'M115 110h35v28h-35z', 'M250 110h35v28h-35z', 'M160 130h22v40h-22z', 'M218 130h22v40h-22z', 'M60 170h40M300 170h40'],
  // bungalow
  ['M20 170H380', 'M60 170V110L120 70H280L340 110V170', 'M120 70L200 110 280 70', 'M85 125h55v28H85z', 'M260 125h55v28h-55z', 'M185 125h30v45h-30z'],
]
const COMMERCIAL: Lines[] = [
  ['M20 170H380', 'M60 170V50H340V170', 'M60 70H340', 'M80 85h240v14H80z', 'M80 115h240v14H80z', 'M170 140h60v30h-60z', 'M150 140h100', 'M120 85v14M160 85v14M200 85v14M240 85v14M280 85v14'],
  ['M20 170H380', 'M40 170V90H360V170', 'M40 90L200 55 360 90', 'M70 110h120v60H70z', 'M70 125h120M70 140h120M70 155h120', 'M230 120h100v25H230z', 'M250 145v25M310 145v25'],
]
const ROOFING: Lines[] = [
  ['M20 175H380', 'M40 175V120L200 40 360 120V175', 'M30 125L200 35 370 125', 'M70 110L200 45M110 90L200 45M150 70L200 45', 'M200 45L330 110M200 45L290 90M200 45L250 70', 'M190 40V20h16v28'],
  ['M20 175H380', 'M50 175V90H350V175', 'M40 90h320v-12H40z', 'M60 78V66h280v12', 'M70 100h260M70 108h260M70 116h260', 'M190 66V50h20v16'],
]
const INTERNAL: Lines[] = [
  ['M40 30h320v150H40z', 'M40 100h140M180 30v60M180 110v70', 'M260 30v150', 'M180 90a20 20 0 0 1 20 20', 'M40 160h30M330 30v20', 'M100 30v-4M140 30v-4'],
  ['M20 180H380', 'M30 180V30H370', 'M30 165h340', 'M30 70h340', 'M60 85h60v80H60z', 'M65 90h50v35H65z', 'M230 90h90v60h-90z', 'M275 90v60M230 120h90'],
]
const EXTERNAL: Lines[] = [
  ['M30 30h340v150H30z', 'M120 60h160v80H120z', 'M200 140C200 160 180 170 170 180', 'M30 180v-10M370 180v-10', 'M60 50l20 20M320 150l20 20'],
  ['M20 160H380', 'M20 130H200L240 160', 'M240 160H380', 'M300 160V100h60v60', 'M300 100l30-20 30 20', 'M40 130v-40M80 130v-40M120 130v-40M160 130v-40', 'M40 100h120'],
]
const SETS: Record<WorkType, Lines[]> = { PPR: RESIDENTIAL, Commercial: COMMERCIAL, Roofing: ROOFING, Internal: INTERNAL, External: EXTERNAL }

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

export function Drawing({ id, type, active, bare = false }: { id: string; type: WorkType; active: boolean; bare?: boolean }) {
  const set = SETS[type] ?? RESIDENTIAL
  // PPR shows the detailed sketch-style house while the rest of the set is redrawn in that style
  const all = type === 'PPR' ? set[0] : set[hash(id) % set.length]
  const guides = all.filter(d => d.startsWith('g:')).map(d => d.slice(2))
  const lines = all.filter(d => !d.startsWith('g:'))
  const traced = lines.join(' ')
  const fid = 'glow' + hash(id)
  // Beam speed: roughly constant regardless of how much linework the drawing has
  const dur = Math.max(10, Math.min(28, lines.length * 0.45))
  const tail = 10
  const step = dur * 0.003 // one dash-length of time between tail segments

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio={bare ? 'xMidYMax meet' : 'xMidYMid slice'} aria-hidden>
      {!bare && <rect width="400" height="200" fill="#1A1A2E" />}
      {!bare && (
        <g stroke="#2A2A48" strokeWidth=".5">
          {Array.from({ length: 21 }, (_, i) => <line key={'v' + i} x1={i * 20} y1="0" x2={i * 20} y2="200" />)}
          {Array.from({ length: 11 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 20} x2="400" y2={i * 20} />)}
        </g>
      )}
      <g fill="none" stroke="#C97B3F" strokeOpacity=".22" strokeWidth=".5">
        {guides.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g fill="none" stroke="#C97B3F" strokeOpacity={bare ? .55 : .42} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {lines.map((d, i) => <path key={i} d={d} />)}
      </g>
      {active && (
        <>
          <defs>
            <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          {/* soft glow around the head */}
          <path d={traced} pathLength={1000} className="beam" fill="none" stroke="#FFD29A" strokeWidth="5" strokeLinecap="round"
            filter={`url(#${fid})`} style={{ animationDuration: `${dur}s`, animationDelay: `-${tail * step}s` }} />
          {/* fading tail, then the bright head */}
          {Array.from({ length: tail + 1 }, (_, k) => (
            <path key={k} d={traced} pathLength={1000} className="beam" fill="none"
              stroke={k === tail ? '#FFF4E4' : '#E8A868'} strokeOpacity={k === tail ? 1 : 0.08 + 0.6 * (k / tail)}
              strokeWidth={k === tail ? 1.8 : 1.4} strokeLinecap="round"
              style={{ animationDuration: `${dur}s`, animationDelay: `-${k * step}s` }} />
          ))}
        </>
      )}
    </svg>
  )
}
