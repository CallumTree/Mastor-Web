/**
 * Trade colours ("cores"): every workstream gets one, like the cores of a cable, so a trade reads the
 * same on every job (bathrooms are always teal, electrics always bronze). Named trades map by keyword;
 * anything else takes a stable core from its name. The colour is only ever a small band beside the
 * trade's name, never a fill, and never red, yellow, green, volt or neon (those carry meaning).
 */
export const CORES = ['clay', 'bronze', 'olive', 'teal', 'slate', 'moss', 'rose', 'graphite'] as const
export type Core = typeof CORES[number]

const BY_WORD: [RegExp, Core][] = [
  [/kitchen/, 'clay'],
  [/electric|rewire|\belec\b|lighting|socket|fire alarm|smoke/, 'bronze'],
  [/decarb|insulat|solar|\bpv\b|energy|\bewi\b|\biwi\b|loft|ventilat|heat pump/, 'olive'],
  [/bath|wet ?room|shower|plumb|heating|boiler|\bwc\b|sanitary/, 'teal'],
  [/roof|gutter|chimney|fascia|soffit|rainwater/, 'slate'],
  [/window|door|glaz|frame/, 'moss'],
  [/paint|decor|plaster|render|ceiling|wall finish/, 'rose'],
  [/scaffold|prelim|general|site set|welfare|skip/, 'graphite'],
]

const byWord = (name: string): Core | null => { const n = name.toLowerCase(); for (const [re, core] of BY_WORD) if (re.test(n)) return core; return null }

/** A job's trades with their cores, so no two in one job share a colour where it can be helped: named trades keep
 *  their own core (bathrooms teal on every job); any other trade takes, in the order it first appears, a core no trade
 *  in this job is using yet. Only when every core is taken does a name share one. */
export function jobCores(names: string[]): Map<string, Core> {
  const out = new Map<string, Core>()
  const unique = [...new Set(names)]
  for (const n of unique) { const c = byWord(n); if (c) out.set(n, c) }
  const free = () => CORES.slice(0, -1).find(c => ![...out.values()].includes(c))
  for (const n of unique) if (!out.has(n)) out.set(n, free() ?? tradeCore(n))
  return out
}

export function tradeCore(name: string): Core {
  const n = name.toLowerCase()
  const named = byWord(name); if (named) return named
  let h = 0
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CORES[h % (CORES.length - 1)]   // graphite is kept for prelims and general items
}
