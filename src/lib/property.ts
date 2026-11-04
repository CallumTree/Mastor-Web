/** Street words, so "12 Acacia Avenue" reads as a property and "12 No. bricks" doesn't. */
export const STREET = /\b(road|rd|street|st|avenue|ave|close|cl|lane|ln|drive|dr|way|court|ct|crescent|cres|place|pl|terrace|tce|gardens|gdns|hill|row|square|sq|park|grove|view|mews|walk|green|rise|parade|estate|house|cottages?|flats)\b/i
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/** A heading that names a property: "No. 12", "Plot 4", "Flat 3", "12 Acacia Avenue", "Property: 4A Hill Street". */
export function propertyOf(raw: string): string | null {
  const t = raw.replace(/^(property( address)?|address|site|dwelling)\s*[:\-–]\s*/i, '').trim()
  // also the address after a title's colon: "Scope of works: 7 Quarry Row"
  const after = /^[^:\d]{1,40}:\s*(\S.*)$/.exec(raw.trim())?.[1]
  for (const c of after && after !== t ? [t, after] : [t]) {
    const tagged = /^(?:no\.?|number|plot|flat|house|unit|property|block|apartment)\s*(\d+[a-z]?)\b/i.exec(c)
    if (tagged) return tagged[1].toUpperCase()
    const addr = /^(?:flat\s+)?(\d+[a-z]?)[,\s]+\S.*$/i.exec(c)
    if (addr && STREET.test(c) && words(c) <= 9) return addr[1].toUpperCase()
  }
  if (/^(property|address)\s*[:\-–]/i.test(raw) && t) return t
  return null
}
