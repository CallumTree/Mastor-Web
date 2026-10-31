/**
 * Press feedback for the live wire: when a plate, row or button is pressed, two pulses leave the finger
 * and run round its edge in opposite directions, meeting on the far side. Drawn in a layer of its own
 * over the page (React never sees it), kept on its element as the page scrolls, and dropped if the
 * press turns into a scroll or the element goes away. Colour follows the surface: volt on white, neon on
 * black and volt, white on red and green, ink on yellow.
 */
const PRESSABLE = '.act:not(.act-clear), .btn:not(.btn-ghost), .chip, .job-row, .prop-row, .fig-btn, .icon-btn, .back-btn, .tabmenu-btn, .step-btn, .row-hit, .role, .d-thumb, .nav-capture'
const SVG = 'http://www.w3.org/2000/svg'

function colourOn(el: Element): string {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g)?.map(Number)
    if (!m || (m.length > 3 && m[3] < .5)) continue
    const [r, g, b] = m
    if (r > 200 && g > 150 && b < 90) return 'var(--ink)'                  // yellow plate
    if (r > 140 && g < 70 && b < 70) return 'var(--shell-text)'           // red plate
    if (g > 90 && r < 40 && b < 100) return 'var(--shell-text)'           // green plate
    if (r + g + b < 120 || (b > 200 && r < 60 && g < 110)) return 'var(--neon)' // black slab or volt plate
    return 'var(--volt)'                                                  // white board
  }
  return 'var(--volt)'
}

/** The length of a rounded rectangle's contour, as SVG draws a <rect> with that rx. */
export function perimeter(w: number, h: number, r: number) {
  return 2 * (w + h) - (8 - 2 * Math.PI) * r
}

/** Where along the contour (0–1, clockwise from the top-left corner's end) a point lies. */
function along(x: number, y: number, w: number, h: number, r: number) {
  const P = 2 * (w + h), d = [y, w - x, h - y, x], edge = d.indexOf(Math.min(...d))
  const s = edge === 0 ? x - r : edge === 1 ? w - r + y : edge === 2 ? 2 * w - r + h - x : 2 * w - r + 2 * h - y
  return ((s / P) % 1 + 1) % 1
}

export function startPressTrace() {
  if (typeof document === 'undefined' || document.querySelector('.press-layer')) return
  const layer = document.createElement('div')
  layer.className = 'press-layer'
  document.body.appendChild(layer)

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    let el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null
    if (!el || (el as HTMLButtonElement).disabled) return
    if (el.classList.contains('nav-capture')) el = (el.querySelector('span') as HTMLElement | null) ?? el
    const box = el.getBoundingClientRect()
    if (box.width < 8 || box.height < 8) return
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, box.height / 2, box.width / 2)

    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('class', 'press-trace')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.stroke = colourOn(el)
    // dashes in real pixels, animated from script: Safari is unreliable with pathLength and calc() in keyframes
    const P = perimeter(box.width - 1, box.height - 1, r), p = along(e.clientX - box.left, e.clientY - box.top, box.width, box.height, r) * P, D = .09 * P
    const dashes = ['tl', 'tp fw', 'tp bw'].map(cls => {
      const rect = document.createElementNS(SVG, 'rect')
      rect.setAttribute('class', cls)
      rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%')
      rect.setAttribute('rx', String(r)); rect.setAttribute('ry', String(r))
      svg.appendChild(rect)
      return rect
    })
    const place = () => {
      const b = el!.getBoundingClientRect()
      // the line sits half a pixel inside the edge so it isn't clipped by a rounded parent
      Object.assign(svg.style, { left: `${b.left + .5}px`, top: `${b.top + .5}px`, width: `${b.width - 1}px`, height: `${b.height - 1}px` })
    }
    place()
    layer.appendChild(svg)
    if (typeof svg.animate === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const run = (rect: SVGRectElement, from: number, to: number) => {
        rect.style.strokeDasharray = `${D}px ${P - D}px`
        rect.animate([{ strokeDashoffset: `${from}px`, opacity: 1 }, { strokeDashoffset: `${from + (to - from) * .7}px`, opacity: 1, offset: .7 }, { strokeDashoffset: `${to}px`, opacity: 0 }],
          { duration: 620, easing: 'cubic-bezier(.33, .8, .45, 1)', fill: 'both' })
      }
      run(dashes[1], D - p, D - p - P / 2)   // clockwise
      run(dashes[2], -p, P / 2 - p)         // anticlockwise
    }

    let raf = 0
    const end = () => { cancelAnimationFrame(raf); svg.remove(); removeEventListener('pointercancel', end) }
    const follow = () => { if (!el!.isConnected) return end(); place(); raf = requestAnimationFrame(follow) }
    raf = requestAnimationFrame(follow)
    addEventListener('pointercancel', end, { once: true })
    setTimeout(end, 700)
  }, { capture: true, passive: true })
}
