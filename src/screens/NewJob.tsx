import { useEffect, useRef, useState } from 'react'
import { lastJobFor } from '../lib/carry'
import type { Job, RateBook } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
import { uid } from '../lib/db'
import { readPackFiles, type PackResult } from '../lib/packIntake'
import { jobFromPack, type PackJob } from '../lib/packJob'
import type { ParsedLine } from '../lib/boq'
import { Review } from './BoqImport'
import { IconScope } from '../components/Icons'

type Stage = { s: 'pick' } | { s: 'reading'; name: string; of: number } | { s: 'review'; pack: PackResult } | { s: 'error'; msg: string }

/**
 * A new job starts from what the client sent: choose the files, Mastor reads the job from them (name, client,
 * contract ref, address, properties, contract value) along with every line, and you type only what the pack
 * doesn't say — usually the PO number and the uplifts. A job with no pack yet is set up by hand.
 */
export function NewJob({ books = [], files, jobs = [], onCreate, onByHand, onClose }: {
  books?: RateBook[]
  /** chosen already (New job on the jobs list is the file picker): read them at once */
  files?: File[]
  /** earlier jobs, for the client's invoice address and uplifts */
  jobs?: Job[]
  onCreate: (job: Job, lines: ParsedLine[], pack: PackResult) => Promise<void>
  onByHand: () => void; onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>({ s: 'pick' })
  const pick = async (files: File[]) => {
    setStage({ s: 'reading', name: files[0].name, of: files.length })
    try { setStage({ s: 'review', pack: await readPackFiles(files, name => setStage({ s: 'reading', name, of: files.length })) }) }
    catch (e) { setStage({ s: 'error', msg: (e as Error).message }) }
  }
  const started = useRef(false)
  useEffect(() => { if (files?.length && !started.current) { started.current = true; void pick(files) } }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  if (stage.s === 'review') return <PackReview pack={stage.pack} books={books} jobs={jobs} onCreate={onCreate} onBack={() => setStage({ s: 'pick' })} onClose={onClose} />
  return (
    <Sheet onClose={onClose} locked={stage.s === 'reading'} label="New job">
      <div className="stack">
        <h2 className="label bracket">New job</h2>
        {stage.s === 'reading' ? (
          <div className="panel" role="status" style={{ textAlign: 'center', padding: 28 }}>
            <div className="loading-bar" />
            <div style={{ fontWeight: 600, marginTop: 14 }}>Reading {stage.name}</div>
            <div className="hint" style={{ marginTop: 4 }}>{stage.of > 1 ? `${stage.of} files. ` : ''}Setting the job up from them and checking every line — keep this open.</div>
          </div>
        ) : (
          <>
            {stage.s === 'error' && <div className="card t-note" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{stage.msg}</div>}
            <div className="muted t-note">Choose what the client sent: the schedule, BoQ or works orders, and the PCI and surveys if you have them. Mastor sets the job up from them and you add what they don’t say. Nothing is saved until you check it.</div>
            <label className="btn btn-primary">
              <IconScope /> Choose the client’s files
              <input type="file" className="sr-only" multiple accept=".pdf,.xlsx,.xlsm,.xls,.docx,.doc,.csv,.txt,application/pdf" onChange={e => { const f = [...(e.target.files ?? [])]; if (f.length) pick(f); e.target.value = '' }} />
            </label>
            <button className="btn btn-secondary" onClick={onByHand}>No pack yet? Set it up by hand</button>
          </>
        )}
      </div>
    </Sheet>
  )
}

const num = (s: string) => { const n = parseFloat(s.replace(/[£,\s]/g, '')); return isFinite(n) && n > 0 ? n : 0 }

/** The pack's review with the job's details on top: filled from the pack where it says them, blank where it doesn't. */
function PackReview({ pack, books, jobs, onCreate, onBack, onClose }: {
  pack: PackResult; books: RateBook[]; jobs: Job[]; onCreate: (job: Job, lines: ParsedLine[], pack: PackResult) => Promise<void>; onBack: () => void; onClose: () => void
}) {
  const [read] = useState(() => jobFromPack(pack))
  const [f, setF] = useState({ name: read.name, client: read.client, clientAddress: '', address: read.address, contractRef: read.contractRef, poNumber: '',
    value: read.contractValue != null ? String(read.contractValue) : '', u1: '', u2: '' })
  const [saving, setSaving] = useState(false)
  const [id] = useState(uid)
  // the same client as an earlier job: its invoice address and uplifts come over, said so, for you to check
  const [carried, setCarried] = useState<string | null>(null)
  useEffect(() => {
    const last = lastJobFor(jobs, f.client)
    if (!last) { setCarried(null); return }
    setF(x => (x.clientAddress || x.u1 || x.u2 ? x : { ...x, clientAddress: last.clientAddress ?? '', u1: last.uplift1 ? String(last.uplift1) : '', u2: last.uplift2 ? String(last.uplift2) : '' }))
    setCarried(last.client)
  }, [f.client])   // eslint-disable-line react-hooks/exhaustive-deps
  const fromLast = carried ? `From your last job for ${carried}: check it` : undefined
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const job: Job = { id, name: f.name.trim(), client: f.client.trim(), clientAddress: f.clientAddress.trim() || undefined, address: f.address.trim(), contractRef: f.contractRef.trim(), poNumber: f.poNumber.trim(),
    contractValue: num(f.value), uplift1: num(f.u1), uplift2: num(f.u2), workType: 'PPR', status: 'Active', photoId: null, kind: 'scheme',
    properties: Object.keys(read.properties).length ? read.properties : undefined, paymentTermsDays: 30, createdAt: Date.now() }
  const fromHint = (k: keyof PackJob['from'], edited: boolean) => (read.from[k] && !edited ? `From ${read.from[k]}` : undefined)
  const setup = (
    <div className="panel stack new-job" style={{ gap: 10 }}>
      <Field label="Job name *" hint={fromHint('name', f.name !== read.name)}><input value={f.name} onChange={set('name')} placeholder="e.g. 32 Park Road" /></Field>
      <Field label="Client" hint={fromHint('client', f.client !== read.client)}><input value={f.client} onChange={set('client')} placeholder="e.g. the council, housing association or trust" /></Field>
      <Field label="Client’s invoice address" hint={fromLast ?? 'Where their invoices go: needed before the first invoice'}><input value={f.clientAddress} onChange={set('clientAddress')} placeholder="e.g. Finance, Civic Centre, Anytown, AB1 2CD" /></Field>
      <Field label="Site address" hint={fromHint('address', f.address !== read.address)}><input value={f.address} onChange={set('address')} /></Field>
      <div className="row pair">
        <div className="grow"><Field label="Contract ref" hint={fromHint('contractRef', f.contractRef !== read.contractRef)}><input value={f.contractRef} onChange={set('contractRef')} /></Field></div>
        <div className="grow"><Field label="PO number" warn={!f.poNumber} hint={!f.poNumber ? 'Needed on invoices' : undefined}><input value={f.poNumber} onChange={set('poNumber')} /></Field></div>
      </div>
      <Field label="PO value — all-in, incl. uplifts (£)" hint={read.contractValue != null && f.value === String(read.contractValue) ? `From ${read.from.contractValue} — check it against the PO` : 'Uplifts below should turn the BoQ total into this figure'}>
        <input inputMode="decimal" value={f.value} onChange={set('value')} placeholder="0.00" /></Field>
      <div className="row pair">
        <div className="grow"><Field label="Uplift 1 (%)" hint={fromLast && (f.u1 || f.u2) ? 'From the last job' : undefined}><input inputMode="decimal" value={f.u1} onChange={set('u1')} placeholder="0" /></Field></div>
        <div className="grow"><Field label="Uplift 2 (%)"><input inputMode="decimal" value={f.u2} onChange={set('u2')} placeholder="0" /></Field></div>
      </div>
    </div>
  )
  return <Review job={job} existing={0} boq={pack} books={books} setup={setup} heading="New job · check it" ready={!!job.name && !saving}
    action={n => (saving ? 'Setting up the job…' : `Create the job · ${n} item${n === 1 ? '' : 's'}`)}
    onImport={async (lines, p) => { setSaving(true); try { await onCreate(job, lines, p) } finally { setSaving(false) } }}
    onBack={onBack} onClose={onClose} />
}

