/**
 * Trade colours ("cores"): every workstream gets one, like the cores of a cable, so a trade reads the
 * same on every job (bathrooms are always teal, electrics always bronze). Named trades map by keyword;
 * anything else takes a stable core from its name. The colour is only ever a small band beside the
 * trade's name, never a fill, and never red, yellow, green, volt or neon (those carry meaning).
 */
export const CORES = ['clay', 'bronze', 'olive', 'teal', 'slate', 'violet', 'rose', 'graphite'] as const
export type Core = typeof CORES[number]

const BY_WORD: [RegExp, Core][] = [
  [/kitchen/, 'clay'],
  [/electric|rewire|\belec\b|lighting|socket|fire alarm|smoke/, 'bronze'],
  [/decarb|insulat|solar|\bpv\b|energy|\bewi\b|\biwi\b|loft|ventilat|heat pump/, 'olive'],
  [/bath|wet ?room|shower|plumb|heating|boiler|\bwc\b|sanitary/, 'teal'],
  [/roof|gutter|chimney|fascia|soffit|rainwater/, 'slate'],
  [/window|door|glaz|frame/, 'violet'],
  [/paint|decor|plaster|render|ceiling|wall finish/, 'rose'],
  [/scaffold|prelim|general|site set|welfare|skip/, 'graphite'],
]

export function tradeCore(name: string): Core {
  const n = name.toLowerCase()
  for (const [re, core] of BY_WORD) if (re.test(n)) return core
  let h = 0
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CORES[h % (CORES.length - 1)]   // graphite is kept for prelims and general items
}
