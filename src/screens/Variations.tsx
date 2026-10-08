import { useState } from 'react'
import type { Job, Valuation, Variation, VoStatus } from '../lib/types'
import { Tick, ValBadge } from './Scope'
import { lockedIn } from '../lib/valuation'
import { CourtLine, voCourt } from '../lib/chase'
import { TabMenu } from '../components/TabMenu'
import { ukDate as ukd } from '../lib/format'
import { Field, Sheet } from '../components/Ui'
import { lineValue } from '../lib/valuation'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { savePhoto, usePhotoUrl } from '../lib/photos'
import { IconCamera, IconFlag } from '../components/Icons'

const UNITS = ['nr', 'm', 'm2', 'lm', 'item']

function Thumb({ id, onClick }: { id: string; onClick?: () => void }) {
  const url = usePhotoUrl(id)
  return url ? <img src={url} alt="" onClick={onClick} /> : null
}

/** On-site capture: what, where, how much, why, photos. Price it later. */
export function LogVariation({ onSave, onClose, initial }: { onSave: (v: Omit<Variation, 'id' | 'jobId' | 'number'>) => void; onClose: () => void; initial?: { description?: string; room?: string; photoIds?: string[] } }) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [room, setRoom] = useState(initial?.room ?? '')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [reason, setReason] = useState('')
  const [photoIds, setPhotoIds] = useState<string[]>(initial?.photoIds ?? [])
  const [busy, setBusy] = useState(false)
  const q = parseFloat(qty.replace(',', '.'))
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket" style={{ color: 'var(--amber)' }}>Log variation</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Capture it now — price it later.</div>
        <Field label="What's the extra work? *"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Replace rotten joists under bath" /></Field>
        <Field label="Where"><input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Bathroom" /></Field>
        <div className="row">
          <div className="grow"><Field label="Qty (if known)"><input inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} /></Field></div>
          <div className="grow"><Field label="Unit"><input value={unit} onChange={e => setUnit(e.target.value)} /></Field></div>
        </div>
        <div className="chips">{UNITS.map(u => <button key={u} className={'chip' + (unit === u ? ' on' : '')} onClick={() => setUnit(u)}>{u}</button>)}</div>
        <Field label="Why / who asked"><input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Found when bath removed" /></Field>
        <div>
          <div className="thumbs" style={{ marginBottom: 8 }}>
            {photoIds.map(id => <Thumb key={id} id={id} onClick={() => setPhotoIds(photoIds.filter(p => p !== id))} />)}
          </div>
          <label className="btn btn-secondary">
            <IconCamera /> {busy ? 'Saving…' : photoIds.length ? 'Add another photo' : 'Take photo'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return
              setBusy(true); try { const id = await savePhoto(file); setPhotoIds(p => [...p, id]) } finally { setBusy(false); e.target.value = '' }
            }} />
          </label>
          {photoIds.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Tap a photo to remove it.</div>}
        </div>
        <button className="btn btn-primary" disabled={!description.trim() || busy} onClick={() => onSave({
          description: description.trim(), room: room.trim() || 'General',
          qty: isFinite(q) && q > 0 ? q : null, unit: unit.trim() || 'item', rate: null, code: '',
          reason: reason.trim(), clientRef: '', status: 'Identified', photoIds, dateRaised: Date.now(),
        })}>Log variation</button>
      </div>
    </Sheet>
  )
}

const STATUSES: VoStatus[] = ['Identified', 'Instructed', 'Complete', 'Rejected']

export function EditVariation({ vo, locked, onSave, onDelete, onClose }: { vo: Variation; locked: boolean; onSave: (v: Variation) => void; onDelete: () => void; onClose: () => void }) {
  const [v, setV] = useState(vo)
  const [qty, setQty] = useState(vo.qty != null ? String(vo.qty) : '')
  const [rate, setRate] = useState(vo.rate != null ? String(vo.rate) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qn = parseFloat(qty.replace(',', '.')); const rn = parseFloat(rate.replace(/[£,]/g, ''))
  const qv = isFinite(qn) && qn > 0 ? qn : null; const rv = isFinite(rn) && rn > 0 ? rn : null
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">{voRef(vo.number)}</div>
        {locked && <div className="flag">Claimed on an issued valuation — locked.</div>}
        <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
        <Field label="Description"><textarea rows={2} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Where"><input value={v.room} onChange={e => setV({ ...v, room: e.target.value })} /></Field>
        <div className="row">
          <div className="grow"><Field label="SoR code"><input value={v.code} onChange={e => setV({ ...v, code: e.target.value })} /></Field></div>
          <div className="grow"><Field label="Unit"><input value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></Field></div>
        </div>
        <div className="row">
          <div className="grow"><Field label="Qty"><input inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="Not measured" /></Field></div>
          <div className="grow"><Field label="Rate (£)"><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="Unpriced" /></Field></div>
        </div>
        <div className="mono" style={{ fontSize: 20, color: qv && rv ? 'var(--copper)' : 'var(--ink-muted)', fontWeight: 300 }}>
          {qv && rv ? money(lineValue(qv, rv)) : 'Add qty and rate to price'}
        </div>
        {qv && rv && v.status === 'Identified' && !v.clientRef && (
          v.submittedAt
            ? <div className="row"><span className="grow flag">Sent to client {ukd(v.submittedAt)} — waiting on their instruction</span><button className="chip" onClick={() => setV({ ...v, submittedAt: null })}>Undo</button></div>
            : <button className="btn btn-secondary" onClick={() => setV({ ...v, submittedAt: Date.now() })}>Mark as sent to client for instruction</button>
        )}
        <Field label="Client VO reference" hint="Once the client issues one"><input value={v.clientRef} onChange={e => setV({ ...v, clientRef: e.target.value })} /></Field>
        <div>
          <div className="field"><span>Status</span></div>
          <div className="chips">{STATUSES.map(s => <button key={s} className={'chip' + (v.status === s ? ' on' : '')} onClick={() => setV({ ...v, status: s })}>{s}</button>)}</div>
        </div>
        </fieldset>
        {v.photoIds.length > 0 && <div className="thumbs">{v.photoIds.map(id => <Thumb key={id} id={id} />)}</div>}
        {!locked && <button className="btn btn-primary" onClick={() => onSave({ ...v, qty: qv, rate: rv })}>Save</button>}
        {!locked && (confirmDelete
          ? <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onDelete}>Delete {voRef(vo.number)}</button>
          : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => setConfirmDelete(true)}>Delete…</button>)}
      </div>
    </Sheet>
  )
}

const statusClass: Record<VoStatus, string> = { Identified: 'b-amber', Instructed: 'b-slate', Complete: 'b-green', Rejected: 'b-red' }

export function VariationsTab({ job, vos, vals, onLog, onEdit, onToggle, onImportVo, onRegister }: { job: Job; vos: Variation[]; vals: Valuation[]; onLog: () => void; onEdit: (v: Variation) => void; onToggle: (v: Variation) => void; onImportVo: () => void; onRegister: () => void }) {
  const sorted = [...vos].sort((a, b) => a.number - b.number)
  return (
    <div className="stack">
      <div className="row"><div className="grow"><div className="label bracket">Variations</div><h1 style={{ fontSize: 22 }}>{job.name}</h1></div>
        <TabMenu title="Variations" actions={[{ label: 'Log variation', hint: 'What, where, photo — price it later', onClick: onLog }, { label: 'Import council instruction', hint: 'VO ticket, site instruction — photo, scan, PDF or Excel', onClick: onImportVo }, { label: 'Variation register (PDF)', hint: 'Every VO — council ref, status, value, evidence', onClick: onRegister }]} /></div>
      <button className="btn btn-primary" onClick={onLog}><IconFlag /> Log variation</button>
      {sorted.length > 0 && <button className="btn btn-secondary" onClick={onRegister}>Variation register (PDF)</button>}
      {sorted.length === 0 && <div className="card empty">No variations yet. Log extras the moment you spot them.</div>}
      {sorted.map(v => {
        const priced = v.qty != null && v.rate != null
        return (
          <div key={v.id} className="card" style={{ cursor: 'pointer' }} onClick={() => onEdit(v)}>
            <div className="row">
              {priced && v.status !== 'Rejected' && <Tick on={!!v.valuationId} locked={!!lockedIn(v, vals)} onClick={() => onToggle(v)} />}
              <span className="ref-roman" style={{ color: 'var(--copper)', fontWeight: 500 }}>{voRef(v.number)}</span>
              <span className={'badge ' + statusClass[v.status]}>{v.status}</span>
              <ValBadge val={vals.find(x => x.id === v.valuationId)} />
              <span className="grow" />
              <span className="mono" style={{ color: priced ? 'var(--ink)' : 'var(--ink-muted)' }}>{priced ? money(lineValue(v.qty, v.rate)) : '—'}</span>
            </div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>{v.description}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {v.room} · {v.qty != null ? `${qtyText(v.qty)} ${v.unit}` : 'not measured'}{v.rate != null ? ` @ ${money(v.rate)}` : ''} · {ukDate(v.dateRaised)}
            </div>
            <div style={{ marginTop: 6 }}><CourtLine c={voCourt(v, vals)} /></div>
            {v.photoIds.length > 0 && <div className="thumbs" style={{ marginTop: 8 }}>{v.photoIds.map(id => <Thumb key={id} id={id} />)}</div>}
          </div>
        )
      })}
    </div>
  )
}
