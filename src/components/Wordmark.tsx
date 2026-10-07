/**
 * MΛSTΘR — the wordmark. Λ (lambda) for the A and Θ (theta) for the O are drawn to match the
 * Roman inscription capitals (Cinzel has no Greek): same cap height, stroke weight and serifs.
 * The Θ's bar sits like a spirit-level bubble. Everything else in the app keeps normal letters.
 */
const CAP = 0.7   // Cinzel cap height in em

export function Lambda() {
  // Roman stress: heavy right stroke, hairline left, pointed apex, bracketed foot serifs
  return (
    <svg className="wm-glyph" viewBox="0 0 72 70" style={{ width: '0.76em', height: `${CAP}em` }} aria-hidden="true">
      <path d="M31.5 0 L40.5 0 L64 66 L52.5 66 Z" fill="currentColor" />
      <path d="M31.5 0 L34.6 4 L13.2 66 L9.6 66 Z" fill="currentColor" />
      <path d="M45 70 L72 70 L72 67.2 C67.5 67.2 65 66.3 63 64 L53 64 C50.5 66.3 49 67.2 45 67.2 Z" fill="currentColor" />
      <path d="M1 70 L22 70 L22 67.2 C18.5 67.2 16.4 66.3 14.6 64 L8.6 64 C6.8 66.3 5 67.2 1 67.2 Z" fill="currentColor" />
    </svg>
  )
}
export function Theta() {
  // Roman O (thick sides, thin top and bottom) with a bar running right across — reads as a spirit level
  return (
    <svg className="wm-glyph" viewBox="0 0 74 72" style={{ width: '0.78em', height: `${CAP * 1.03}em` }} aria-hidden="true">
      <path fillRule="evenodd" fill="currentColor" d="M37 0 C58 0 74 16 74 36 C74 56 58 72 37 72 C16 72 0 56 0 36 C0 16 16 0 37 0 Z M37 3.6 C23.5 3.6 11.4 18 11.4 36 C11.4 54 23.5 68.4 37 68.4 C50.5 68.4 62.6 54 62.6 36 C62.6 18 50.5 3.6 37 3.6 Z" />
      <rect x="11" y="33.4" width="52" height="5.2" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ size, className = 'wordmark', style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ ...(size ? { fontSize: size } : {}), ...style }} aria-label="MASTOR" role="img">
      <span aria-hidden="true">M</span><Lambda /><span aria-hidden="true">ST</span><Theta /><span aria-hidden="true">R</span>
    </div>
  )
}
