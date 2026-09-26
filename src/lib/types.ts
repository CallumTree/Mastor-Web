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
}
