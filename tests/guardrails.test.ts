/**
 * Design guardrails (DESIGN.md "Guardrails"), checked on every test run so nothing generic creeps back in:
 * no blur or glass, no glows or soft shadows, no smooth gradients, no purple, every colour a token, corners
 * 4px at most or scooped (the capture key is the one round control, by the owner's choice), Mastor's own fonts only,
 * no emoji, and every figure in the screens set in the mono.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
let pass = 0, fail = 0
const ok = (c: boolean, m: string, detail: string[] = []) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) detail.slice(0, 12).forEach(d => console.log('      ' + d)) }

const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f] })
const CSS = ['src/styles.css', 'src/landing/landing.css']
const TSX = walk('src').filter(f => f.endsWith('.tsx') && !f.includes('__shots'))
const read = (f: string) => readFileSync(f, 'utf8')
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
/** Mark-up ink is drawn onto site photos for the client (red, yellow, blue, white, black), not UI colour. */
const INK_FILES = new Set(['src/components/Markup.tsx'])

// CSS rules as { selector, body, line }, with comments blanked so line numbers hold
type Rule = { file: string; sel: string; body: string; line: number }
const rules: Rule[] = CSS.flatMap(file => {
  const s = noComments(read(file)); const out: Rule[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g; let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push({ file, sel: m[1].trim(), body: m[2], line: s.slice(0, m.index + m[1].length).split('\n').length })
  return out
})
const decls = (r: Rule) => r.body.split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const })
const isTokenRule = (r: Rule) => /(^|,)\s*:root\b/.test(r.sel)
const where = (r: Rule) => `${r.file}:${r.line} ${r.sel.replace(/\s+/g, ' ').slice(0, 70)}`
const topSplit = (s: string) => { const out: string[] = []; let d = 0, cur = ''; for (const c of s) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && !d) { out.push(cur.trim()); cur = '' } else cur += c } if (cur.trim()) out.push(cur.trim()); return out }
const px = (v: string) => { const m = v.match(/^(-?[\d.]+)(px)?$/); return m ? parseFloat(m[1]) : NaN }

// ---- 1 · no blur, no glass, no glows
const blur = rules.flatMap(r => decls(r).filter(([p, v]) => p.includes('backdrop-filter') || /\bblur\(/.test(v)).map(() => where(r)))
const blurTsx = TSX.flatMap(f => read(f).split('\n').map((l, i) => /backdropFilter|backdrop-filter|blur\(/.test(l) && !INK_FILES.has(f) ? `${f}:${i + 1}` : '').filter(Boolean))
ok(!blur.length && !blurTsx.length, 'no blur and no frosted glass', [...blur, ...blurTsx])
// the one radial shape allowed is the scoop: hard-edged rings and holes cut on --s, never a bloom (DESIGN.md "Shapes")
const scoop = (r: Rule) => /--scoop-(ring|hole)/.test(r.body) || /var\(--scoop-(ring|hole)\)/.test(r.body)
const radial = rules.filter(r => /radial-gradient|conic-gradient/.test(r.body) && !scoop(r)).map(where)
ok(!radial.length, 'no radial blooms, orbs or halos (the scoop\'s hard-edged corners aside)', radial)
const softScoop = rules.filter(scoop).flatMap(r => [...r.body.matchAll(/--scoop-(?:ring|hole):([^;]+)/g)].filter(m => !/calc\(var\(--s\)/.test(m[1])).map(() => where(r)))
ok(!softScoop.length, 'the scoop is cut on --s, a hard edge, never a soft fade', softScoop)

// shadows: any blur radius over 4px is a floating, soft shadow
const softShadows = rules.flatMap(r => decls(r).filter(([p]) => p === 'box-shadow' || p === 'text-shadow').flatMap(([, v]) =>
  v === 'none' ? [] : topSplit(v).filter(sh => { const lens = sh.replace(/inset/g, '').replace(/var\([^)]*\)|rgba?\([^)]*\)|#[0-9a-f]+|[a-z-]+/gi, ' ').trim().split(/\s+/).map(px); return (lens[2] ?? 0) > 4 }).map(sh => `${where(r)} → ${sh}`)))
const dropShadows = rules.flatMap(r => [...r.body.matchAll(/drop-shadow\(([^)]*\)?[^)]*)\)/g)].filter(m => (px(m[1].trim().split(/\s+/)[2] ?? '0') || 0) > 4).map(m => `${where(r)} → ${m[0]}`))
ok(!softShadows.length && !dropShadows.length, 'no soft shadows: a shadow blurs 4px at most (depth comes from 1px rules)', [...softShadows, ...dropShadows])

// ---- 2 · gradients are hard-edged patterns only (the grid, the dashed line, the corner marks, a scale bar)
const smooth = rules.flatMap(r => [...r.body.matchAll(/(?:repeating-)?linear-gradient\(((?:[^()]|\([^()]*\))*)\)/g)].filter(m => {
  const stops = topSplit(m[1]).filter(s => !/^(to |-?[\d.]+deg)/.test(s)).map(s => { const t = s.match(/^(var\([^)]*\)|rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+)\s*(.*)$/i); return { c: t?.[1] ?? s, pos: (t?.[2] ?? '').split(/\s+/).filter(Boolean) } })
  if (stops.every(s => s.c === stops[0].c)) return false   // one colour: a solid stripe
  return stops.some((s, i) => !s.pos.length || (i > 0 && stops[i - 1].pos[stops[i - 1].pos.length - 1] !== s.pos[0]))   // a stop without a hard edge blends
}).map(m => `${where(r)} → ${m[0].slice(0, 90)}`))
ok(!smooth.length, 'no smooth gradients: hard-edged patterns only', smooth)

// ---- colour: every colour is a token, and none is purple
const hexes = (s: string) => [...s.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map(m => m[0])
const hue = (h: string) => { let x = h.slice(1); if (x.length === 3) x = [...x].map(c => c + c).join(''); const [r, g, b] = [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0 }; const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (hh * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1)) } }
const allHex = [...CSS.flatMap(f => hexes(noComments(read(f))).map(h => [f, h])), ...TSX.filter(f => !INK_FILES.has(f)).flatMap(f => hexes(read(f)).map(h => [f, h]))]
const purple = allHex.filter(([, h]) => { const { h: hh, s } = hue(h); return hh >= 245 && hh <= 320 && s > .2 }).map(([f, h]) => `${f} ${h}`)
ok(!purple.length && !allHex.some(([, h]) => /6366F1|8B5CF6|A855F7/i.test(h)), 'no purple or indigo anywhere', purple)
const loose = rules.filter(r => !isTokenRule(r)).flatMap(r => decls(r).filter(([p, v]) => !p.startsWith('--') && (hexes(v).length || /rgba?\(/.test(v))).map(([p, v]) => `${where(r)} → ${p}: ${v.slice(0, 60)}`))
ok(!loose.length, 'every colour in the styles is a named token (defined once, in :root)', loose)
const looseTsx = TSX.filter(f => !INK_FILES.has(f)).flatMap(f => read(f).split('\n').map((l, i) => (hexes(l).length || /rgba?\(/.test(l)) ? `${f}:${i + 1} ${l.trim().slice(0, 80)}` : '').filter(Boolean))
ok(!looseTsx.length, 'no hex or rgba colours written into the screens', looseTsx)

// ---- 3 · corners 4px at most; the capture key is the one round control
const ROUND_OK = /\.nav-capture span|\.cap-close span|\.nav-disc/
const tokenRadius = new Map(rules.filter(isTokenRule).flatMap(r => decls(r).filter(([p]) => /^--r(-|$)/.test(p))))
ok([...tokenRadius.values()].every(v => px(v) <= 4), 'the radius tokens are 4px at most', [...tokenRadius].map(([k, v]) => `${k}: ${v}`))
const radius = (v: string) => v.split(/\s+/).every(x => px(x) <= 4 || (/^var\(--r(-[a-z]+)?\)$/.test(x) && px(tokenRadius.get(x.slice(4, -1)) ?? '0') <= 4) || x === 'inherit')
const round = rules.flatMap(r => decls(r).filter(([p, v]) => p === 'border-radius' && !radius(v) && !ROUND_OK.test(r.sel)).map(([, v]) => `${where(r)} → ${v}`))
const roundTsx = TSX.flatMap(f => read(f).split('\n').map((l, i) => { const m = l.match(/borderRadius:\s*['"]?([^,'"}]+)/); return m && !radius(m[1].trim()) ? `${f}:${i + 1} borderRadius ${m[1]}` : '' }).filter(Boolean))
ok(!round.length && !roundTsx.length, 'no pills, bubbles or soft cards: corners 4px at most', [...round, ...roundTsx])

// ---- 5 · type: Mastor's own faces, never a default sans for anything; figures in the mono
const fonts = rules.flatMap(r => decls(r).filter(([p, v]) => p === 'font-family' && !/^(var\(--(sans|mono|classic|cond)\)|inherit)( !important)?$/.test(v)).map(([, v]) => `${where(r)} → ${v}`))
ok(!fonts.length, 'every font is one of the tokens (Archivo, JetBrains Mono, Cinzel for the wordmark)', fonts)
ok(!TSX.some(f => /fontFamily:\s*['"](?!var\()/.test(read(f))), 'no font family written into the screens')
// a money figure shown on screen goes through fig()/figs(), a mono/amount class, or a figure cell
const FIG_OK = /fig\(|figs\(|<FigN|\brow\(|mono|amt|className="n\b|value:|aria-label|title=|<option|newNote\(|head=\{|rows=\{|=> \(n < 0|^\s*(const|let|return|if)\b|`\$\{money|label:|\.toFixed/
const bare = walk('src/screens').concat(walk('src/components'), ['src/App.tsx']).filter(f => f.endsWith('.tsx')).flatMap(f => read(f).split('\n').map((l, i) => /\{(money|pounds)\(/.test(l) && !FIG_OK.test(l) ? `${f}:${i + 1} ${l.trim().slice(0, 90)}` : '').filter(Boolean))
ok(!bare.length, 'every £ figure on screen is set in the mono (fig, figs, or a figure cell)', bare)

// ---- 4 · no decorative emoji or filler symbols in the interface
const emoji = TSX.flatMap(f => read(f).split('\n').map((l, i) => /[\u{1F300}-\u{1FAFF}\u{2728}\u{2B50}\u{2600}-\u{26FF}]/u.test(l) ? `${f}:${i + 1}` : '').filter(Boolean))
ok(!emoji.length, 'no emoji or decorative symbols', emoji)

// ---- Mastor is its own business: no contractor, client or council is named in the product, its docs or its tests (PRODUCT.md)
const TIES = new RegExp(['tree ?(&|and|&amp;) ?sons', 'treeandsons', 'pembroke', '\\bPCC\\b(?! POST)'].join('|'), 'i')
const docs = ['PRODUCT.md', 'DESIGN.md', 'README.md', 'index.html', 'app.html'].filter(f => { try { statSync(f); return true } catch { return false } })
const tied = [...walk('src'), ...walk('server'), ...walk('tests'), ...walk('.impeccable/surfaces'), ...docs].filter(f => !f.endsWith('guardrails.test.ts') && /\.(tsx?|md|html|tsv|css|json)$/.test(f) && !f.includes('__shots'))
  .flatMap(f => read(f).split('\n').map((l, i) => TIES.test(l) ? `${f}:${i + 1} ${l.trim().slice(0, 80)}` : '').filter(Boolean))
ok(!tied.length, 'no other firm, client or council named anywhere: Mastor is its own business', tied)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
