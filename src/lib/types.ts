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
  /** You've accepted a difference between BoQ × uplifts and the PO (e.g. items added after the PO). Re-flags if the difference changes. */
  poGapAccepted?: { diff: number; note: string; at: number } | null
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
  type: 'day' | 'photo' | 'video' | 'note'
  note: string                 // day note, or the photo/video caption
  labour: number | null        // day only — operatives on site
  weather: string              // day only
  mediaId: string | null       // photo (marked-up version if marked up) or video
  originalMediaId: string | null // photo before mark-up
  room: string
  voId: string | null          // variation raised from this photo
  category?: NoteCategory      // job notes only
  pinned?: boolean             // job notes only
  createdAt: number
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
  updatedAt: number
}
export const blankSettings = (): CompanySettings => ({ id: 'company', name: '', address: '', email: '', phone: '', vatNumber: '', companyNumber: '', bankName: '', accountName: '', sortCode: '', accountNumber: '', invoicePrefix: '', nextInvoiceNumber: 1, invoicePad: 0, vatRate: 20, defaultTermsDays: 30, updatedAt: 0 })
