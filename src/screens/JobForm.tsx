import { useState } from 'react'
import type { Job, WorkType } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { uid } from '../lib/db'
import { savePhoto, usePhotoUrl } from '../lib/photos'
import { IconCamera } from '../components/Icons'

const TYPES: WorkType[] = ['PPR', 'Internal', 'External', 'Roofing', 'Commercial']

export function JobForm({ job, onSave, onClose, onDelete }: {
  job?: Job; onSave: (j: Job) => void; onClose: () => void; onDelete?: () => void
}) {
  const [f, setF] = useState<Job>(job ?? {
    id: uid(), name: '', client: '', address: '', contractRef: '', poNumber: '',
    contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: Date.now(),
  })
  const [valueText, setValueText] = useState(job && job.contractValue ? String(job.contractValue) : '')
  const [u1, setU1] = useState(job ? String(job.uplift1) : '')
  const [u2, setU2] = useState(job ? String(job.uplift2) : '')
  const [terms, setTerms] = useState(job?.paymentTermsDays ? String(job.paymentTermsDays) : '30')
  const photoUrl = usePhotoUrl(f.photoId)
  const set = (k: keyof Job) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const num = (s: string) => { const n = parseFloat(s.replace(/[£,\s]/g, '')); return isFinite(n) && n > 0 ? n : 0 }

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">{job ? 'Job setup' : 'New job'}</div>
        <Field label="Job name *"><input value={f.name} onChange={set('name')} placeholder="e.g. 32 College Park" /></Field>
        <Field label="Client"><input value={f.client} onChange={set('client')} placeholder="e.g. Pembrokeshire County Council" /></Field>
        <Field label="Site address"><input value={f.address} onChange={set('address')} /></Field>
        <div className="row">
          <div className="grow"><Field label="Contract ref"><input value={f.contractRef} onChange={set('contractRef')} placeholder="e.g. CAP00290" /></Field></div>
          <div className="grow"><Field label="PO number" warn={!f.poNumber} hint={!f.poNumber ? 'Needed on invoices' : undefined}><input value={f.poNumber} onChange={set('poNumber')} /></Field></div>
        </div>
        <Field label="PO value — all-in, incl. uplifts (£)" hint="Uplifts below should turn the BoQ total into this figure"><input inputMode="decimal" value={valueText} onChange={e => setValueText(e.target.value)} placeholder="From the purchase order" /></Field>
        <div className="row">
          <div className="grow"><Field label="Uplift 1 (%)"><input inputMode="decimal" value={u1} onChange={e => setU1(e.target.value)} placeholder="0" /></Field></div>
          <div className="grow"><Field label="Uplift 2 (%)"><input inputMode="decimal" value={u2} onChange={e => setU2(e.target.value)} placeholder="0" /></Field></div>
        </div>
        <Field label="Payment terms (days)" hint="Counted from the invoice date, or from the valuation's issue date if it isn't invoiced yet. Flags it when it's late."><input inputMode="numeric" value={terms} onChange={e => setTerms(e.target.value)} /></Field>
        <div>
          <div className="field"><span>Type of work</span></div>
          <div className="chips">{TYPES.map(t => <button key={t} className={'chip' + (f.workType === t ? ' on' : '')} onClick={() => setF({ ...f, workType: t })}>{t}</button>)}</div>
        </div>
        {job && (
          <div>
            <div className="field"><span>Status</span></div>
            <div className="chips">{(['Active', 'Complete'] as const).map(s => <button key={s} className={'chip' + (f.status === s ? ' on' : '')} onClick={() => setF({ ...f, status: s })}>{s}</button>)}</div>
          </div>
        )}
        <div>
          <div className="field"><span>Site photo</span></div>
          {photoUrl && <img src={photoUrl} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />}
          <div className="row">
            <label className="btn btn-secondary" style={{ flex: 1 }}>
              <IconCamera /> {photoUrl ? 'Replace photo' : 'Add photo'}
              <input type="file" accept="image/*" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) setF({ ...f, photoId: await savePhoto(file) }) }} />
            </label>
            {photoUrl && <button className="btn btn-ghost" onClick={() => setF({ ...f, photoId: null })}>Remove</button>}
          </div>
          <div className="hint muted" style={{ fontSize: 12, marginTop: 4 }}>Without a photo, the job shows its drawing.</div>
        </div>
        <button className="btn btn-primary" disabled={!f.name.trim()}
          onClick={() => onSave({ ...f, name: f.name.trim(), contractValue: num(valueText), uplift1: num(u1), uplift2: num(u2), paymentTermsDays: Math.round(num(terms)) || 30 })}>
          {job ? 'Save' : 'Create job'}
        </button>
        {onDelete && <ConfirmDelete label="Delete job…" confirmLabel={<>Delete job and all its variations</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}
