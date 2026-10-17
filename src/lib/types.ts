export type WorkType = 'PPR' | 'Commercial' | 'Roofing' | 'Internal' | 'External'
export type JobStatus = 'Active' | 'Complete'
export type VoStatus = 'Identified' | 'Instructed' | 'Complete' | 'Rejected'

export interface Job {
  id: string
  name: string
  client: string
  address: string
  contractRef: string
  poNumber: string          // printed on invoices — blank until the client issues one, never invented
  contractValue: number
  uplift1: number           // %
  uplift2: number           // %
  workType: WorkType
  status: JobStatus
  photoId: string | null    // real site photo; replaces the drawing when set
  paymentTermsDays?: number // days from valuation issue to payment due (default 30)
  /** 'scheme' (default): one BoQ / works order. 'orders': a responsive or voids contract made of many small works orders. */
  kind?: 'scheme' | 'orders'
  /** You've accepted a difference between BoQ × uplifts and the PO (e.g. items added after the PO). Re-flags if the difference changes. */
  poGapAccepted?: { diff: number; note: string; at: number } | null
  /** multi-property schemes: house number → full address, from the client's works orders */
  properties?: Record<string, string>
  createdAt: number
}

export interface Variation {
  id: string
  jobId: string
  number: number            // sequential per job: VO-001, VO-002 — never reused
  description: string
  room: string
  qty: number | null        // null = not measured. Never guessed.
  unit: string
  rate: number | null       // null = unpriced. Never shown as £0.
  code: string              // SoR code, blank until priced
  rateBook?: string         // which rate book the rate came from, when looked up (e.g. "Planned Maint v8")
  reason: string
  clientRef: string         // client's VO reference, blank until issued
  status: VoStatus
  photoIds: string[]
  dateRaised: number
  valuationId?: string | null // which valuation it's claimed in; null/undefined = live
  submittedAt?: number | null // sent to the client for instruction — the ball is in their court from here
  attachments?: { id: string; name: string; type: string }[] // original council instruction (scan, PDF, Excel)
}

/** One line of the works order / BoQ. */
export interface ScopeItem {
  id: string
  jobId: string
  code: string              // SoR code
  description: string
  room: string
  qty: number | null        // null = not stated. Never guessed.
  unit: string
  rate: number | null       // null = no rate. Never shown as £0.
  valuationId: string | null // null = live (not yet claimed)
  order: number
  property?: string          // multi-property schemes: the house/unit number, e.g. "1", "13"
  workstream?: string        // e.g. PPR Paint, Kitchen, Roofing, Scaffold, Decarb
  hours?: number | null      // labour hours from the schedule, if given
  rateBook?: string          // which rate book the rate came from, when looked up
  orderId?: string           // small works orders: the order this line belongs to
  evidence?: string[]         // diary captures (photos, video, voice) that showed it done
  contract?: string          // the client's contract / works order ref for this line (packs with several), e.g. MH21180
  createdAt: number
}

export type ValuationStatus = 'Open' | 'Issued'

/** Interim valuation. Only one Open per job; Issued ones are locked. */
export interface Valuation {
  id: string
  jobId: string
  number: number            // VAL-001, VAL-002 …
  status: ValuationStatus
  createdAt: number
  issuedAt: number | null
  paidAt?: number | null     // date payment received
  paidAmount?: number | null // amount received (can be a part payment)
  invoiceNumber?: string | null // VAT invoice raised for this valuation (one per valuation)
  invoiceDate?: number | null
  invoiceVatRate?: number | null
}

/**
 * Site diary. One 'day' record per job per date (id `day:<jobId>:<date>`, so two devices never
 * create duplicates) holding weather, labour and the note; plus one record per photo or video.
 */
export interface DiaryEntry {
  id: string
  jobId: string
  date: string                 // YYYY-MM-DD (UK local day)
  type: 'day' | 'photo' | 'video' | 'voice' | 'note'
  note: string                 // day note, or the photo/video caption
  labour: number | null        // day only — operatives on site
  weather: string              // day only
  mediaId: string | null       // photo (marked-up version if marked up) or video
  originalMediaId: string | null // photo before mark-up
  room: string
  voId: string | null          // variation raised from this photo
  category?: NoteCategory      // job notes only
  pinned?: boolean             // job notes only
  transcript?: string          // voice / video: what was said, transcribed when the day is read
  read?: SiteRead              // what reading it against the scope suggested
  createdAt: number
}

/** One site capture read against the job's scope. Suggestions wait for a person in Vals. */
export interface SiteRead { at: number; suggestions: SiteSuggestion[] }
export interface SiteSuggestion {
  id: string
  kind: 'complete' | 'vo' | 'note'
  text: string
  lineIds: string[]            // complete: the scope lines it says are done
  property: string; room: string
  qty: number | null; unit: string; code: string   // vo: as said on site — never estimated
  quote: string                // the words that support it ('' when it's from the picture alone)
  basis: 'said' | 'seen' | 'both'
  verified: boolean            // the quote was found in what was said or written
  state: 'open' | 'approved' | 'rejected'
}

export type NoteCategory = 'Client' | 'Commercial' | 'Site' | 'H&S' | 'Other'
export const NOTE_CATEGORIES: NoteCategory[] = ['Client', 'Commercial', 'Site', 'H&S', 'Other']

/** Company details used on invoices. One record per company (id 'company'). */
export interface CompanySettings {
  id: 'company'
  name: string; address: string; email: string; phone: string
  vatNumber: string; companyNumber: string
  bankName: string; accountName: string; sortCode: string; accountNumber: string
  invoicePrefix: string        // e.g. "TS-" or "" — whatever you use now
  nextInvoiceNumber: number    // carries on from your current numbering
  invoicePad: number           // digits, e.g. 4 → 0042
  vatRate: number              // % (20)
  defaultTermsDays: number
  accountsFormat?: 'xero' | 'quickbooks' // invoice export
  accountsCode?: string        // Xero sales account code (default 200)
  labourDayRate?: number | null // your cost of one operative-day, for the labour estimate on a job's costs (blank = not used)
  rateBooks?: RateBook[]       // the company's schedules of rates; the lines themselves live in the 'rates' store
  updatedAt: number
}

/**
 * A schedule of rates — a framework SoR (e.g. M3NHF v8 Planned), a client's additional rates, or your own.
 * Imported whole and never edited: a new version comes in as a new book, so old jobs keep the rates
 * they were priced on.
 */
export interface RateBook {
  id: string
  name: string                 // e.g. "Planned Maintenance v8 — PCC 2025–29"
  source: string               // file it came from (and sheet, for spreadsheets)
  notes: string[]              // conditions printed with the rates, e.g. "Install only — materials ordered by PCC"
  lines: number
  importedAt: number
}
/** One rate. Key: bookId + code. */
export interface RateItem {
  bookId: string
  code: string
  short: string                // short description, e.g. "FENCING:RENEW 1.8M BOARD - TIMBER POST"
  long: string                 // full description from the schedule ('' if the book has none)
  unit: string                 // as printed: NO, IT, SM, LM, Lm, Each…
  rate: number                 // £, as printed (rounded to the penny)
  section: string              // e.g. "FENCING AND GATES"
  subsection: string           // e.g. "Fencing - Boarded"
  priority?: string            // responsive schedules: R, E, U…
}
export const blankSettings = (): CompanySettings => ({ id: 'company', name: '', address: '', email: '', phone: '', vatNumber: '', companyNumber: '', bankName: '', accountName: '', sortCode: '', accountNumber: '', invoicePrefix: '', nextInvoiceNumber: 1, invoicePad: 0, vatRate: 20, defaultTermsDays: 30, updatedAt: 0 })

/** A cost against a job: a subbie's quote or bill, labour, materials, plant. Net of VAT. */
export type CostKind = 'subbie' | 'labour' | 'materials' | 'plant' | 'other'
export type CostStatus = 'quote' | 'committed' | 'paid'
export interface Cost {
  id: string
  jobId: string
  kind: CostKind
  status: CostStatus          // quotes are compared, not counted; committed and paid count against the margin
  who: string                 // subbie / supplier
  trade: string               // matches a scope workstream to compare against what the client pays for it (e.g. Roofing)
  description: string
  amount: number | null       // £ net; null = not known yet (never guessed)
  date: number
  createdAt: number
}

/** One small works order on a responsive / voids contract: one property, a few SoR lines (in scope, by orderId). */
export type OrderStatus = 'open' | 'complete' | 'cancelled'
export interface WorkOrder {
  id: string
  jobId: string
  ref: string                 // the client's order number
  address: string
  priority: string            // e.g. Emergency, Urgent, Routine, Void
  raisedAt: number
  dueAt: number | null
  status: OrderStatus
  completedAt: number | null
  note: string
  beforeIds: string[]         // photos before work
  afterIds: string[]          // photos after work
  signedBy: string            // tenant / client rep who signed off, if anyone
  createdAt: number
}

/** A dayworks sheet: work done on time and materials, priced from the framework's labour rates. */
export interface DayworksLabour { trade: string; label: string; rate: number | null; hours: number | null }
export interface DayworksItem { description: string; amount: number | null }
export interface Dayworks {
  id: string
  jobId: string
  number: number              // per job: DW 1, DW 2…
  date: string                // YYYY-MM-DD
  description: string
  labour: DayworksLabour[]
  materials: DayworksItem[]   // net cost
  plant: DayworksItem[]
  materialsPct: number        // the framework's addition on materials and plant (%)
  signedBy: string
  signedAt: number | null
  voId: string | null         // the variation it's claimed through
  createdAt: number
}

/** A document kept against a job: RAMS, programme, certificates, drawings. The file lives with the photos. */
export interface JobDocument {
  id: string
  jobId: string
  name: string
  kind: 'Client pack' | 'RAMS' | 'Programme' | 'Certificate' | 'Drawing' | 'Other'
  fileId: string
  type: string
  size: number
  orderId?: string            // a certificate for one works order (e.g. an EICR)
  addedAt: number
}
