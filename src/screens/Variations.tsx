import { useState } from 'react'
import { useAccess } from '../lib/access'
import type { RateBook } from '../lib/types'
import { RateLookup } from './Rates'
import type { Job, Valuation, Variation } from '../lib/types'
import { Tick, ValBadge } from '../components/Tick'
import { lockedIn } from '../lib/valuation'
import { CourtLine, voCourt, voStage, voStatusAfter, type VoStage } from '../lib/chase'
import { TabMenu } from '../components/TabMenu'
import { ByClaude } from '../components/Sign'
import { groupValue, registerSummary, VO_GROUP_SHORT } from '../lib/voRegister'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { ukDate as ukd } from '../lib/format'
import { Field, Sheet, ConfirmDelete, useOnce } from '../components/Ui'
import { describeProblem } from '../components/Problem'
import { lineValue, shareOut, upliftedValues } from '../lib/valuation'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { savePhoto, usePhotoThumb } from '../lib/photos'
import { IconCamera, IconPlus } from '../components/Icons'
import { figs } from '../components/Figs'
import { voHouse } from '../lib/property'

// the units the client's schedule uses (IT, NO, LM, SM, M3), so a VO reads like the BoQ it sits beside
const UNITS = ['IT', 'NO', 'LM', 'SM', 'M3']

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

export interface House { key: string; label: string }

/** Which house a VO is at, on a job of several: the houses, then "Whole job". One tap; nothing to type. */
function HousePick({ houses, value, onChange }: { houses: House[]; value: string; onChange: (h: string) => void }) {
  if (houses.length < 2) return null
  return (
    <div className="field">
      <div className="label" id="vo-house">House</div>
      <div className="chips house-chips" role="group" aria-labelledby="vo-house" style={{ marginTop: 6 }}>
        {houses.map(h => <button key={h.key} type="button" className={'chip' + (value === h.key ? ' on' : '')} aria-pressed={value === h.key} onClick={() => onChange(h.key)}>{h.label}</button>)}
        <button type="button" className={'chip' + (!value ? ' on' : '')} aria-pressed={!value} onClick={() => onChange('')}>Whole job</button>
      </div>
    </div>
  )
}

/** On-site capture: what, where (the house, then the room), how much, why, photos. Price it later. */
export function LogVariation({ onSave, onClose, initial, houses = [] }: { onSave: (v: Omit<Variation, 'id' | 'jobId' | 'number'>) => void | Promise<void>; onClose: () => void; initial?: { description?: string; room?: string; property?: string; photoIds?: string[] }; houses?: House[] }) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [house, setHouse] = useState(initial?.property ?? '')
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
        <Field label="What's the extra work? *"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Replace rotten joists under bath" /></Field>
        <HousePick houses={houses} value={house} onChange={setHouse} />
        <Field label="Where"><input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Bathroom" /></Field>
        <Field label="Qty (if known)"><input inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} /></Field>
        {/* the client's units, one tap; none picked is an item */}
        <div className="chips" role="group" aria-label="Unit">{UNITS.map(u => <button key={u} className={'chip' + (unit === u ? ' on' : '')} aria-pressed={unit === u} onClick={() => setUnit(unit === u ? '' : u)}>{u}</button>)}</div>
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
          description: description.trim(), room: room.trim() || 'General', property: house || undefined,
          qty: isFinite(q) && q > 0 ? q : null, unit: unit.trim() || 'item', rate: null, code: '',
          reason: reason.trim(), clientRef: '', status: 'Identified', photoIds, dateRaised: Date.now(),
        }))}>Log variation</button>
      </div>
    </Sheet>
  )
}

export function EditVariation({ vo, locked, books = [], houses = [], onSave, onDelete, onClose }: { vo: Variation; locked: boolean; books?: RateBook[]; houses?: House[]; onSave: (v: Variation) => void; onDelete: () => void; onClose: () => void }) {
  const [v, setV] = useState({ ...vo, property: vo.property ?? (voHouse(vo) || undefined) })
  const [qty, setQty] = useState(vo.qty != null ? String(vo.qty) : '')
  const [rate, setRate] = useState(vo.rate != null ? String(vo.rate) : '')
  const qn = parseFloat(qty.replace(',', '.')); const rn = parseFloat(rate.replace(/[£,]/g, ''))
  const qv = isFinite(qn) && qn > 0 ? qn : null; const rv = isFinite(rn) && rn > 0 ? rn : null
  const { money: m } = useAccess()
  const save = (next: Variation) => { const out = { ...next, qty: qv, rate: m ? rv : vo.rate }; onSave({ ...out, status: voStatusAfter(vo, out) }) }
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">{voRef(vo.number)}</h2>
        {locked && <div className="flag">Claimed on an issued valuation — locked.</div>}
        <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
        <Field label="Description"><textarea rows={2} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} /></Field>
        <HousePick houses={houses} value={v.property ?? ''} onChange={h => setV({ ...v, property: h || undefined })} />
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
        {m && (qv && rv
          ? <div className="amt" style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 700 }}>{money(lineValue(qv, rv))}</div>
          : <div className="hint">Add the quantity and rate to price it.</div>)}
        {m && qv && rv && v.status === 'Identified' && !v.clientRef && (
          v.submittedAt
            ? <div className="row"><span className="grow flag">Sent to client {ukd(v.submittedAt)} — waiting on their instruction</span><button className="chip" onClick={() => setV({ ...v, submittedAt: null })}>Undo</button></div>
            : <button className="btn btn-secondary" onClick={() => save({ ...v, submittedAt: Date.now() })}>Mark as sent to client for instruction</button>
        )}
        {m && <Field label="Client VO reference" hint="Once the client issues one, it’s instructed"><input value={v.clientRef} onChange={e => setV({ ...v, clientRef: e.target.value })} /></Field>}
        {m && v.status === 'Rejected' && <div className="flag">The client rejected this variation. It isn’t counted or claimed.</div>}
        </fieldset>
        {v.photoIds.length > 0 && <div className="thumbs">{v.photoIds.map(id => <Thumb key={id} id={id} />)}</div>}
        {!locked && <button className="btn btn-primary" onClick={() => save(v)}>Save</button>}
        {/* the status follows the facts; the one thing only the client can say is no */}
        {m && !locked && (v.status === 'Rejected'
          ? <button className="btn btn-secondary" onClick={() => save({ ...v, status: v.clientRef.trim() ? 'Instructed' : 'Identified' })}>Not rejected after all</button>
          : <button className="btn btn-secondary" onClick={() => save({ ...v, status: 'Rejected' })}>Client rejected it</button>)}
        {m && !locked && <ConfirmDelete instant confirmLabel={<>Delete {voRef(vo.number)}</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}

const stageClass: Record<VoStage, string> = { Logged: 'b-amber', Priced: 'b-amber', 'With client': 'b-quiet', Instructed: 'b-slate', Claimed: 'b-green', Rejected: 'b-red' }

/**
 * A VO as one row of the job's work, beside the scope lines at its house: its number, what and where, how much, where it
 * stands with the client, and the same tick into the valuation once it's priced. Operatives see what and where, never money.
 */
/** One VO as a row. `value` is its worth with the job's uplifts (upliftedValues), the figure every screen shows; the
 *  rate itself is in the VO's edit form. */
export function VoRow({ v, vals, idx, onToggle, onEdit, value }: { v: Variation; vals: Valuation[]; idx: number; onToggle: (v: Variation) => void; onEdit: (v: Variation) => void; value?: number }) {
  const { money: m } = useAccess()
  const priced = v.qty != null && v.rate != null
  const rejected = v.status === 'Rejected'
  const locked = !!lockedIn(v, vals)
  const evidence = [v.photoIds.length ? `${v.photoIds.length} photo${v.photoIds.length === 1 ? '' : 's'}` : '', (v.attachments?.length ?? 0) ? `${v.attachments!.length} doc${v.attachments!.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
  return (
    <div className={'row has-hit line-row vo-line' + (rejected ? ' rejected' : '')} style={{ padding: '12px 12px', borderTop: idx ? '1px solid var(--line)' : 'none', alignItems: 'flex-start' }}>
      <RowHit label={`${voRef(v.number)}: ${v.description}`} onClick={() => onEdit(v)} />
      {m && ((priced && !rejected) || v.valuationId)
        ? <div className="tick-col" onClick={e => { e.stopPropagation(); if (!locked) onToggle(v) }}><Tick on={!!v.valuationId} locked={locked} onClick={() => onToggle(v)} /></div>
        : <span className="tick-col" aria-hidden="true" />}
      <div className="grow">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="badge b-vo">{voRef(v.number)}</span>
          {v.code && <span className="mono t-small slate">{v.code}</span>}
          {v.room && <span className="hint">{v.room}</span>}
          <ValBadge val={vals.find(x => x.id === v.valuationId)} />
          {!locked && <ByClaude at={v.byClaude} />}
        </div>
        <div className="clamp2" style={{ fontWeight: 500, marginTop: 2 }}>{v.description}</div>
        <div className="hint">
          {figs(v.qty != null ? `${qtyText(v.qty)} ${v.unit}` : 'not measured')}{figs(m && v.rate == null ? ' · unpriced' : '')}
          {v.clientRef ? <> · client ref <span className="mono">{v.clientRef}</span></> : ''}{evidence ? ` · ${evidence}` : ''}
        </div>
        <div className="vo-status">{/* the office reads where it stands from its court line; operatives from the stage */}
          {m && !rejected ? <CourtLine c={voCourt(v, vals)} /> : <span className={'badge ' + stageClass[voStage(v)]}>{voStage(v)}</span>}
        </div>
      </div>
      {m && <div className="amt t-note" style={{ flex: 'none', whiteSpace: 'nowrap', color: priced && !rejected ? 'var(--ink)' : 'var(--ink-muted)' }}>{priced ? money(value ?? lineValue(v.qty, v.rate)) : '—'}</div>}
    </div>
  )
}

/** The variation register at a glance (the Scope tab's VOs view): the total first, then only the stages that hold VOs,
 *  all with uplifts like every other screen, the total shared out so the stages add up to it exactly. Rejected VOs are
 *  left out of the sum and said so underneath. */
export function VoSummary({ job, vos, vals }: { job: Job; vos: Variation[]; vals: Valuation[] }) {
  const sum = registerSummary(job, vos, vals)
  const live = sum.rows.filter(r => r.key !== 'rejected')
  const rejected = sum.rows.find(r => r.key === 'rejected')
  const none = live.filter(r => !r.count)
  const shares = shareOut(sum.gross, live.map(r => r.base))
  const gross = (key: string) => shares[live.findIndex(r => r.key === key)] ?? 0
  return <SumStrip label="Variation summary" caption={[
      'With uplifts, excl. VAT.',
      none.length ? `None ${none.map(r => VO_GROUP_SHORT[r.key].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}.` : '',
      rejected?.count ? `${rejected.count} rejected, not counted.` : ''].filter(Boolean).join(' ')} cells={[
    { label: 'Variations', whole: true, value: money(sum.gross), nil: !sum.gross, note: [sum.unpriced ? `+ ${sum.unpriced} unpriced` : '', sum.overdue ? `${sum.overdue} overdue` : ''].filter(Boolean).join(' · ') },
    ...live.filter(r => r.count).map(r => ({ key: r.key, label: VO_GROUP_SHORT[r.key], value: groupValue(gross(r.key), r.count, r.unpriced),
      note: [`${r.count} VO${r.count === 1 ? '' : 's'}`, r.unsent ? `${r.unsent} not sent` : '', r.unpriced && r.unpriced < r.count ? `+ ${r.unpriced} unpriced` : ''].filter(Boolean).join(' · ') })),
  ]} />
}

/** A job's VOs as one ruled list (the Orders tab, where work comes order by order rather than by house). */
export function VoList({ job, vos, vals, onToggle, onEdit, onLog }: { job: Job; vos: Variation[]; vals: Valuation[]; onToggle: (v: Variation) => void; onEdit: (v: Variation) => void; onLog: () => void }) {
  const sorted = [...vos].sort((a, b) => a.number - b.number)
  const uv = upliftedValues(job, [], vos)
  return (
    <section className="stack" style={{ gap: 8 }}>
      <h3 className="sec-h">Variations{sorted.length ? ` · ${sorted.length}` : ''}</h3>
      <div className="tab-actions"><button className="btn btn-sm btn-secondary" onClick={onLog}><IconPlus /> Add VO</button></div>
      {sorted.length > 0 && <div className="panel flush clip">{sorted.map((v, i) => <VoRow key={v.id} v={v} vals={vals} idx={i} onToggle={onToggle} onEdit={onEdit} value={uv.get(v.id)} />)}</div>}
    </section>
  )
}
