import { useState } from 'react'
import { useAccess } from '../lib/access'
import type { RateBook } from '../lib/types'
import { RateLookup } from './Rates'
import type { Job, Valuation, Variation, VoStatus } from '../lib/types'
import { Tick, ValBadge } from './Scope'
import { lockedIn } from '../lib/valuation'
import { CourtLine, voCourt } from '../lib/chase'
import { TabMenu } from '../components/TabMenu'
import { ByClaude } from '../components/Sign'
import { groupValue, registerSummary, VO_GROUP_SHORT } from '../lib/voRegister'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { ukDate as ukd } from '../lib/format'
import { Field, Sheet, ConfirmDelete, useOnce } from '../components/Ui'
import { describeProblem } from '../components/Problem'
import { lineValue } from '../lib/valuation'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { savePhoto, usePhotoThumb } from '../lib/photos'
import { IconCamera, IconFlag } from '../components/Icons'

const UNITS = ['nr', 'm', 'm2', 'lm', 'item']

function Thumb({ id }: { id: string }) {
  const url = usePhotoThumb(id)
  return url ? <img src={url} alt="" decoding="async" /> : null
}

/** A photo on a VO being logged: the × removes it (a labelled button, so it works by keyboard and screen reader too). */
function RemovableThumb({ id, n, onRemove }: { id: string; n: number; onRemove: () => void }) {
  const url = usePhotoThumb(id)
  return (
    <span className="thumb-x">
      {url ? <img src={url} alt="" /> : <span className="thumb-x-blank" />}
      <button type="button" aria-label={`Remove photo ${n}`} onClick={onRemove}><span aria-hidden="true">×</span></button>
    </span>
  )
}

/** On-site capture: what, where, how much, why, photos. Price it later. */
export function LogVariation({ onSave, onClose, initial }: { onSave: (v: Omit<Variation, 'id' | 'jobId' | 'number'>) => void | Promise<void>; onClose: () => void; initial?: { description?: string; room?: string; photoIds?: string[] } }) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [room, setRoom] = useState(initial?.room ?? '')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [reason, setReason] = useState('')
  const [photoIds, setPhotoIds] = useState<string[]>(initial?.photoIds ?? [])
  const [busy, setBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const [saving, once] = useOnce()
  const q = parseFloat(qty.replace(',', '.'))
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">Log variation</h2>
        <div className="hint" style={{ marginTop: 2 }}>Capture it now — price it later.</div>
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
            {photoIds.map((id, n) => <RemovableThumb key={id} id={id} n={n + 1} onRemove={() => setPhotoIds(photoIds.filter(p => p !== id))} />)}
          </div>
          <label className="btn btn-secondary">
            <IconCamera /> {busy ? 'Saving…' : photoIds.length ? 'Add another photo' : 'Take photo'}
            <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return
              setBusy(true); setPhotoErr(null); try { const id = await savePhoto(file); setPhotoIds(p => [...p, id]) } catch (err) { setPhotoErr(describeProblem(err)) } finally { setBusy(false); e.target.value = '' }
            }} />
          </label>
          {photoErr && <div className="flag t-strong" role="alert" style={{ marginTop: 6 }}>{photoErr}</div>}
        </div>
        <button className="btn btn-primary" disabled={!description.trim() || busy || saving} onClick={once(() => onSave({
          description: description.trim(), room: room.trim() || 'General',
          qty: isFinite(q) && q > 0 ? q : null, unit: unit.trim() || 'item', rate: null, code: '',
          reason: reason.trim(), clientRef: '', status: 'Identified', photoIds, dateRaised: Date.now(),
        }))}>Log variation</button>
      </div>
    </Sheet>
  )
}

const STATUSES: VoStatus[] = ['Identified', 'Instructed', 'Complete', 'Rejected']

export function EditVariation({ vo, locked, books = [], onSave, onDelete, onClose }: { vo: Variation; locked: boolean; books?: RateBook[]; onSave: (v: Variation) => void; onDelete: () => void; onClose: () => void }) {
  const [v, setV] = useState(vo)
  const [qty, setQty] = useState(vo.qty != null ? String(vo.qty) : '')
  const [rate, setRate] = useState(vo.rate != null ? String(vo.rate) : '')
  const qn = parseFloat(qty.replace(',', '.')); const rn = parseFloat(rate.replace(/[£,]/g, ''))
  const qv = isFinite(qn) && qn > 0 ? qn : null; const rv = isFinite(rn) && rn > 0 ? rn : null
  const { money: m } = useAccess()
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">{voRef(vo.number)}</h2>
        {locked && <div className="flag">Claimed on an issued valuation — locked.</div>}
        <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
        <Field label="Description"><textarea rows={2} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Where"><input value={v.room} onChange={e => setV({ ...v, room: e.target.value })} /></Field>
        <div className="row">
          {m && <div className="grow"><Field label="SoR code"><input value={v.code} autoCapitalize="characters" onChange={e => setV({ ...v, code: e.target.value, rateBook: undefined })} /></Field></div>}
          <div className="grow"><Field label="Unit"><input value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></Field></div>
        </div>
        {m && !locked && <RateLookup code={v.code} books={books} onUse={(i, b) => { setV({ ...v, code: i.code, unit: i.unit, rateBook: b?.name }); setRate(String(i.rate)) }} />}
        <div className="row">
          <div className="grow"><Field label="Qty"><input inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="Not measured" /></Field></div>
          {m && <div className="grow"><Field label="Rate (£)" hint={v.rateBook ? `From ${v.rateBook}` : undefined}><input inputMode="decimal" value={rate} onChange={e => { setRate(e.target.value); setV({ ...v, rateBook: undefined }) }} placeholder="Unpriced" /></Field></div>}
        </div>
        {m && <div className="amt" style={{ fontSize: 20, color: qv && rv ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: 700 }}>
          {qv && rv ? money(lineValue(qv, rv)) : 'Add qty and rate to price'}
        </div>}
        {m && qv && rv && v.status === 'Identified' && !v.clientRef && (
          v.submittedAt
            ? <div className="row"><span className="grow flag">Sent to client {ukd(v.submittedAt)} — waiting on their instruction</span><button className="chip" onClick={() => setV({ ...v, submittedAt: null })}>Undo</button></div>
            : <button className="btn btn-secondary" onClick={() => setV({ ...v, submittedAt: Date.now() })}>Mark as sent to client for instruction</button>
        )}
        {m && <Field label="Client VO reference" hint="Once the client issues one"><input value={v.clientRef} onChange={e => setV({ ...v, clientRef: e.target.value })} /></Field>}
        <div>
          <div className="field"><span>Status</span></div>
          <div className="chips">{STATUSES.map(s => <button key={s} className={'chip' + (v.status === s ? ' on' : '')} onClick={() => setV({ ...v, status: s })}>{s}</button>)}</div>
        </div>
        </fieldset>
        {v.photoIds.length > 0 && <div className="thumbs">{v.photoIds.map(id => <Thumb key={id} id={id} />)}</div>}
        {!locked && <button className="btn btn-primary" onClick={() => onSave({ ...v, qty: qv, rate: m ? rv : vo.rate })}>Save</button>}
        {m && !locked && <ConfirmDelete label="Delete…" confirmLabel={<>Delete {voRef(vo.number)}</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}

const statusClass: Record<VoStatus, string> = { Identified: 'b-amber', Instructed: 'b-slate', Complete: 'b-green', Rejected: 'b-red' }

/** The VO tab reads like the Variation Register: summary strip, then one ruled schedule. */
export function VariationsTab({ job, vos, vals, onLog, onEdit, onToggle, onImportVo, onRegister, onDayworks }: { job: Job; vos: Variation[]; vals: Valuation[]; onDayworks?: () => void; onLog: () => void; onEdit: (v: Variation) => void; onToggle: (v: Variation) => void; onImportVo: () => void; onRegister: () => void }) {
  const sorted = [...vos].sort((a, b) => a.number - b.number)
  const sum = registerSummary(job, vos, vals)
  const none = sum.rows.filter(r => !r.count)
  const { money: m } = useAccess()   // operatives: what and where, never what it's worth
  return (
    <div className="stack">
      <TabHead label="Variations" menu={<TabMenu title="Variations" actions={[
        ...(onDayworks ? [{ label: 'Dayworks sheets', hint: 'Hours, materials and plant — signed, then claimed as a variation', onClick: onDayworks }] : []),
        ...(m ? [{ label: 'Import council instruction', hint: 'VO ticket, site instruction — photo, scan, PDF or Excel', onClick: onImportVo }, { label: 'Variation register (PDF)', hint: 'Every VO — council ref, status, value, evidence', onClick: onRegister }] : [])]} />} />
      {m && sorted.length > 0 && <SumStrip label="Variation summary" caption={[
          none.length ? `None ${none.map(r => VO_GROUP_SHORT[r.key].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}.` : '',
          'Groups at base rates; the total includes uplifts and excludes rejected.'].filter(Boolean).join(' ')} cells={[
        // only the stages that hold VOs: an empty stage is a line in the caption, not a box
        ...sum.rows.filter(r => r.count).map(r => ({ key: r.key, label: VO_GROUP_SHORT[r.key], value: groupValue(r.base, r.count, r.unpriced),
          note: [`${r.count} VO${r.count === 1 ? '' : 's'}`, r.unsent ? `${r.unsent} not sent` : '', r.unpriced && r.unpriced < r.count ? `+ ${r.unpriced} unpriced` : ''].filter(Boolean).join(' · ') })),
        { label: 'Total incl. uplifts', value: money(sum.gross), note: [`${money(sum.base)} base`, sum.unpriced ? `+ ${sum.unpriced} unpriced` : '', sum.overdue ? `${sum.overdue} overdue` : ''].filter(Boolean).join(' · '), hot: true },
      ]} />}
      <div className="row">
        <button className="btn btn-primary" onClick={onLog}><IconFlag /> Log variation</button>
        {m && sorted.length > 0 && <button className="btn btn-secondary" style={{ flex: '0 0 auto', width: 'auto' }} onClick={onRegister}>Register PDF</button>}
      </div>
      {sorted.length === 0 && <div className="card empty">No variations yet. Log extras the moment you spot them.</div>}
      {sorted.length > 0 && (
        <div className="card vo-list">
          <div className="vo-head"><span>VO</span><span>Description · status</span><span>{m ? 'Value' : ''}</span></div>
          {sorted.map(v => {
            const priced = v.qty != null && v.rate != null
            const c = voCourt(v, vals)
            const evidence = [v.photoIds.length ? `${v.photoIds.length} photo${v.photoIds.length === 1 ? '' : 's'}` : '', (v.attachments?.length ?? 0) ? `${v.attachments!.length} doc${v.attachments!.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
            return (
              <div key={v.id} className={'vo-row has-hit' + (v.status === 'Rejected' ? ' rejected' : '')}>
                <RowHit label={`${voRef(v.number)}: ${v.description}`} onClick={() => onEdit(v)} />
                <div className="vo-ref">
                  <span className="ref-roman">{voRef(v.number)}</span>
                  {v.code && <small className="mono">{v.code}</small>}
                  {m && priced && v.status !== 'Rejected' && <Tick on={!!v.valuationId} locked={!!lockedIn(v, vals)} onClick={() => onToggle(v)} />}
                </div>
                <div className="vo-main">
                  <div className="vo-desc clamp2">{v.description}</div>
                  <div className="vo-meta">
                    {v.room || '—'} · {v.qty != null ? `${qtyText(v.qty)} ${v.unit}` : 'not measured'}{m ? (v.rate != null ? ` @ ${money(v.rate)}` : ' · unpriced') : ''}
                  </div>
                  <div className="vo-meta">
                    <span className={v.clientRef ? 'vo-cref' : ''}>{v.clientRef ? `Council ref ${v.clientRef}` : 'No council ref'}</span> · raised {ukDate(v.dateRaised)}{evidence ? ` · ${evidence}` : ''}
                  </div>
                  <div className="vo-status"><span className={'badge ' + statusClass[v.status]}>{v.status}</span>{!lockedIn(v, vals) && <ByClaude at={v.byClaude} />}{m && v.status !== 'Rejected' && <CourtLine c={c} />}</div>
                </div>
                {m ? <div className="vo-amt">
                  <span className="mono">{priced ? money(lineValue(v.qty, v.rate)) : '—'}</span>
                  <ValBadge val={vals.find(x => x.id === v.valuationId)} />
                </div> : <div />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
