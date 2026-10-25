/** Small things every connector tool says the same way. */
import { ukDate } from '../../src/lib/format'

export const text = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 1) }] })
export const NO_MONEY = 'Your Mastor role is operative, which doesn’t include money (rates, values, valuations, invoices). Ask someone in the office.'
export const day = (t: number | null | undefined) => (t ? ukDate(t) : null)
export const JOB_DESC = 'Job id, or part of its name, contract ref or address'

/** Today on site in the UK (the server runs on UTC), as YYYY-MM-DD — the diary's own day key. */
export const ukToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
