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
}
