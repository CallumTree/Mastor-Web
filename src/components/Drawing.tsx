import type { WorkType } from '../lib/types'

/**
 * Construction-drawing backdrops. Line work only, drawn on a 400x200 sheet.
 * Active jobs get the signature: a band of copper light sweeping across the linework —
 * the same lines drawn a second time with an animated gradient stroke.
 */
type Lines = string[] // SVG path data

const RESIDENTIAL: Lines[] = [
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
  const lines = set[hash(id) % set.length]
  const gid = 'sw' + hash(id)
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio={bare ? 'xMidYMax meet' : 'xMidYMid slice'} aria-hidden>
      {!bare && <rect width="400" height="200" fill="#1A1A2E" />}
      {/* drafting grid (bare mode: the page supplies its own grid behind) */}
      {!bare && (
        <g stroke="#2A2A48" strokeWidth=".5">
          {Array.from({ length: 21 }, (_, i) => <line key={'v' + i} x1={i * 20} y1="0" x2={i * 20} y2="200" />)}
          {Array.from({ length: 11 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 20} x2="400" y2={i * 20} />)}
        </g>
      )}
      <g fill="none" stroke="#C97B3F" strokeOpacity={bare ? .5 : .38} strokeWidth="1.3" strokeLinecap="square">
        {lines.map((d, i) => <path key={i} d={d} />)}
      </g>
      {active && (
        <>
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="-160" y1="0" x2="0" y2="200">
              <stop offset="0" stopColor="#E8A868" stopOpacity="0" />
              <stop offset=".5" stopColor="#E8A868" stopOpacity="1" />
              <stop offset="1" stopColor="#E8A868" stopOpacity="0" />
              <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="560 0" dur="3.4s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <g fill="none" stroke={`url(#${gid})`} strokeWidth="1.8" strokeLinecap="square">
            {lines.map((d, i) => <path key={i} d={d} />)}
          </g>
        </>
      )}
    </svg>
  )
}
