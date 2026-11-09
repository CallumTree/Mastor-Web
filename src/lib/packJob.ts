/**
 * A new job set up from the client's pack: what the documents themselves say the job is. Every field is copied
 * from something printed in the pack (an address, a contract ref, a contract value, the client named in the PCI),
 * never made up; anything the pack doesn't say is left blank for a person to type, and `from` says where each
 * filled field came from so the screen can show it.
 */
import type { PackResult } from './packIntake'

export interface PackJob {
  name: string; client: string; address: string; contractRef: string
  contractValue: number | null
  properties: Record<string, string>
  from: Partial<Record<'name' | 'client' | 'address' | 'contractRef' | 'contractValue', string>>
}

/** A full address without its house number and postcode: "3 Elm Road, Anytown, AB1 4PY" → "Elm Road, Anytown". */
export const streetOf = (a: string) => a.replace(/^\s*(flat\s+)?\d+[a-z]?\s*,?\s*/i, '').replace(/,?\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i, '').trim()

/** The street most of the scheme's properties are on (a scheme is usually one street, sometimes a corner of another). */
export function schemeStreet(addresses: Record<string, string>) {
  const streets = Object.values(addresses).map(streetOf).filter(Boolean)
  return streets.sort((a, b) => streets.filter(x => x === b).length - streets.filter(x => x === a).length)[0] ?? ''
}

/** A file's name as a job name, without the words every schedule carries: "Elm Road Spec List v2.xlsx" → "Elm Road". */
export function nameFromFile(file: string) {
  return file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ')
    .replace(/\b(schedule( of (works|rates))?|scope( of works)?|spec(ification)?( list)?|bill of quantities|boq|works? orders?|pricing|priced|tender|final|draft|copy|rev(ision)?\s*\w+|v\d+(\.\d+)?)\b/gi, ' ')
    .replace(/\s*[-–—·|]+\s*$/g, '').replace(/^\s*[-–—·|]+\s*/g, '').replace(/\s{2,}/g, ' ').trim()
}

const r2 = (x: number) => Math.round(x * 100 + 1e-7) / 100

export function jobFromPack(pack: PackResult): PackJob {
  const from: PackJob['from'] = {}
  const props = pack.addresses ?? {}
  const n = Object.keys(props).length
  let name = '', address = ''
  if (n === 1) {
    address = Object.values(props)[0]
    name = address.split(',')[0].trim()
    from.name = from.address = 'the works order'
  } else if (n > 1) {
    address = schemeStreet(props)
    name = address.split(',')[0].trim()
    if (name) from.name = from.address = `${n} properties in the works orders`
  }
  // the site named on the schedule itself ("SITE: ELM ROW") before the file's name; a reference code isn't a name
  const site = (pack.ref ?? '').trim()
  if (!name && site && /[a-z]{3,}/i.test(site) && !/\d{3,}|[/\\]/.test(site)) {
    name = site === site.toUpperCase() ? site.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : site
    from.name = 'the schedule'
  }
  if (!name) {
    const sched = pack.files.find(f => f.as.role === 'spec' || f.as.role === 'ai' || f.as.role === 'order')
    name = sched ? nameFromFile(sched.file.name) : ''
    // a file called "pack" or "scan" says nothing about the job: leave the name for a person to type
    if (/^(client )?(pack|documents?|docs|files?|scan(ned)?|attachments?|new|untitled|download|image|img|document)\s*\d*$/i.test(name)) name = ''
    if (name) from.name = 'the file name'
  }
  const contractRef = from.name === 'the schedule' ? '' : pack.ref ?? ''   // a site's name isn't a contract reference
  if (contractRef) from.contractRef = pack.orders.length ? 'the works orders' : 'the schedule'
  // the works orders print a contract value each; only when every one does is their sum the job's
  const values = pack.orders.map(o => o.contractValue)
  const contractValue = values.length && values.every(v => v != null) ? r2(values.reduce((t: number, v) => t + (v ?? 0), 0)) : null
  if (contractValue != null) from.contractValue = pack.orders.length === 1 ? 'the works order' : `${pack.orders.length} works orders`
  const client = pack.facts?.client ?? ''
  if (client) from.client = 'the client’s documents'
  return { name, client, address, contractRef, contractValue, properties: props, from }
}
