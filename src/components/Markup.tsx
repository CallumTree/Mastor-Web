import { useEffect, useRef, useState } from 'react'
import { IconArrow, IconCircle, IconPen, IconText } from './Icons'

/**
 * Photo mark-up: pen, arrow, circle, text in site colours. Saves a new marked-up image;
 * the original is kept untouched by the caller.
 */
type Tool = 'pen' | 'arrow' | 'circle' | 'text'
type Shape = { tool: Tool; color: string; pts: [number, number][]; text?: string }
const RED = '#C1121F', YELLOW = '#FFCD00', BLUE = '#0040FF', WHITE = '#FFFFFF', INK = '#0A0A0B'
const COLOURS = [RED, YELLOW, BLUE, WHITE, INK]
/** Text halo: an ink outline, or a white one for ink text (the old check named a retired ink colour, so ink text got an ink halo). */
const haloFor = (c: string) => (c === INK ? WHITE : INK)

export function Markup({ src, onSave, onCancel }: { src: string; onSave: (b: Blob) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [draft, setDraft] = useState<Shape | null>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState(COLOURS[0])
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const im = new Image()
    im.onload = () => {
      const c = canvas.current!; const scale = Math.min(1, 1600 / Math.max(im.width, im.height))
      c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale)
      img.current = im; setReady(true)
    }
    im.src = src
  }, [src])

  useEffect(() => {
    const c = canvas.current; if (!c || !img.current) return
    const g = c.getContext('2d')!; const lw = Math.max(3, c.width / 180)
    g.drawImage(img.current, 0, 0, c.width, c.height)
    for (const s of [...shapes, ...(draft ? [draft] : [])]) {
      g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = lw
      const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]]
      if (s.tool === 'pen') { g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke() }
      if (s.tool === 'arrow' && s.pts.length > 1) {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = lw * 5
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke()
        g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - h * Math.cos(ang - .45), b[1] - h * Math.sin(ang - .45)); g.lineTo(b[0] - h * Math.cos(ang + .45), b[1] - h * Math.sin(ang + .45)); g.closePath(); g.fill()
      }
      if (s.tool === 'circle' && s.pts.length > 1) { g.beginPath(); g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 + 1, Math.abs(b[1] - a[1]) / 2 + 1, 0, 0, Math.PI * 2); g.stroke() }
      if (s.tool === 'text' && s.text) {
        g.shadowBlur = 0; g.font = `700 ${Math.round(c.width / 22)}px 'Archivo Variable', Archivo, sans-serif`; g.lineWidth = lw * 1.4
        g.strokeStyle = haloFor(s.color); g.strokeText(s.text, a[0], a[1]); g.fillText(s.text, a[0], a[1])
      }
      g.shadowBlur = 0
    }
  }, [shapes, draft, ready])

  const pos = (e: React.PointerEvent): [number, number] => {
    const c = canvas.current!, r = c.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]
  }
  // one finger draws; a second finger, a cancelled gesture, lost capture or leaving the app ends the stroke cleanly
  const active = useRef<number | null>(null)
  const latest = useRef(draft); latest.current = draft
  const finish = () => {
    active.current = null
    const d = latest.current
    if (d && d.pts.length > 1) setShapes(s => [...s, d])
    setDraft(null)
  }
  const down = (e: React.PointerEvent) => {
    if (active.current !== null) return
    if (tool === 'text') {
      const t = window.prompt('Text to add'); if (t?.trim()) setShapes(s => [...s, { tool, color, pts: [pos(e)], text: t.trim() }]); return
    }
    (e.target as Element).setPointerCapture(e.pointerId); active.current = e.pointerId
    setDraft({ tool, color, pts: [pos(e)] })
  }
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== active.current) return
    const p = pos(e)
    setDraft(d => d && { ...d, pts: d.tool === 'pen' ? [...d.pts, p] : [d.pts[0], p] })
  }
  const end = (e: React.PointerEvent) => { if (e.pointerId === active.current) finish() }
  useEffect(() => {
    const away = () => { if (active.current !== null) finish() }
    window.addEventListener('blur', away)
    return () => window.removeEventListener('blur', away)
  })

  // a full-screen layer like the sheets: focus moves in, Esc is Cancel, and it's announced by its title
  const layer = useRef<HTMLDivElement>(null)
  const cancel = useRef(onCancel); cancel.current = onCancel
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    layer.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel.current() } }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); back?.focus?.({ preventScroll: true }) }
  }, [])

  const tools: [Tool, string, typeof IconArrow][] = [['arrow', 'Arrow', IconArrow], ['circle', 'Circle', IconCircle], ['pen', 'Draw', IconPen], ['text', 'Text', IconText]]
  return (
    <div ref={layer} className="markup" role="dialog" aria-modal="true" aria-labelledby="mk-title" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--shell)', display: 'flex', flexDirection: 'column', outline: 'none' }}>
      <div className="row" style={{ padding: '10px 12px', color: 'var(--shell-text)' }}>
        <button className="btn-ghost on-dark" onClick={onCancel}>Cancel</button>
        <h2 id="mk-title" className="grow mk-title">Mark up</h2>
        <button className="btn-ghost on-dark" disabled={!shapes.length} onClick={() => setShapes(s => s.slice(0, -1))}>Undo</button>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 8 }}>
        <canvas ref={canvas} role="img" aria-label="The photo — draw on it with a finger or the mouse" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
          style={{ maxWidth: '100%', maxHeight: '100%', touchAction: 'none', background: 'var(--shell-2)' }} />
      </div>
      <div style={{ padding: '10px 12px calc(12px + env(safe-area-inset-bottom))', background: 'var(--shell-2)' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          {COLOURS.map(c => <button key={c} className="mk-swatch" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} style={{ background: c }} />)}
        </div>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {tools.map(([t, label, Icon]) => <button key={t} className="mk-tool" aria-pressed={tool === t} onClick={() => setTool(t)}><Icon size={18} /> {label}</button>)}
        </div>
        <button className="btn btn-primary" disabled={!ready || saving} onClick={() => { setSaving(true); canvas.current!.toBlob(b => b && onSave(b), 'image/jpeg', 0.85) }}>{saving ? 'Saving…' : 'Save mark-up'}</button>
      </div>
    </div>
  )
}
