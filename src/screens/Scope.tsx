import { useState } from 'react'
import type { Job, ScopeItem, Valuation } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
import { money, qtyText } from '../lib/format'
import { isPriced, lineValue, lockedIn, valRef } from '../lib/valuation'
import { uid } from '../lib/db'
import { IconPlus, IconScope } from '../components/Icons'

export function Tick({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={locked} aria-label={on ? 'Remove from valuation' : 'Add to valuation'}
      style={{ width: 30, height: 30, flex: 'none', borderRadius: 6, border: `1.6px solid ${on ? 'var(--copper)' : 'var(--cream-line)'}`, background: on ? 'var(--copper)' : '#fff', color: 'var(--cream)', display: 'grid', placeItems: 'center', opacity: locked ? .55 : 1 }}>
      {on && (locked ? '🔒' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M5 12l5 5L19 7" /></svg>)}
    </button>
  )
}

export function ValBadge({ val }: { val?: Valuation }) {
  if (!val) return null
  return <span className={'badge ' + (val.status === 'Issued' ? 'b-slate' : 'b-amber')}>{val.status === 'Issued' ? '🔒 ' : ''}{valRef(val.number)}</span>
}

type Filter = 'all' | 'live' | 'claimed'

export function ScopeTab({ scope, vals, onToggle, onAdd, onEdit, onImport }: {
  job: Job; scope: ScopeItem[]; vals: Valuation[]; onToggle: (i: ScopeItem) => void; onAdd: () => void; onEdit: (i: ScopeItem) => void; onImport: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const total = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const claimed = scope.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const shown = scope.filter(i => filter === 'all' || (filter === 'live' ? !i.valuationId : !!i.valuationId))
  const rooms = [...new Set(shown.map(i => i.room))]
  const valById = (id: string | null) => vals.find(v => v.id === id)

  return (
    <div className="stack">
      <div className="row">
        <div className="grow"><div className="label bracket">Scope</div></div>
        <div className="mono muted" style={{ fontSize: 13 }}>{scope.length} items</div>
      </div>

      {scope.length > 0 && (
        <div className="card-dark">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="grow"><div className="label">Claimed</div><div className="mono" style={{ fontSize: 22, fontWeight: 300, color: 'var(--copper)' }}>{money(claimed)}</div></div>
            <div style={{ textAlign: 'right' }}><div className="label">Scope total</div><div className="mono" style={{ fontSize: 16, fontWeight: 300 }}>{money(total)}</div></div>
          </div>
          <div className="scalebar" style={{ marginTop: 10 }}><div style={{ width: total ? `${(claimed / total) * 100}%` : 0 }} /></div>
          <div style={{ fontSize: 12, color: 'var(--cream-muted)', marginTop: 6 }}>{total ? Math.round((claimed / total) * 100) : 0}% of scope claimed · base rates, before uplifts</div>
        </div>
      )}

      <div className="chips">
        {(['all', 'live', 'claimed'] as Filter[]).map(f => (
          <button key={f} className={'chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'live' ? 'Still to do' : 'Claimed'}
          </button>
        ))}
      </div>

      {scope.length === 0 && (
        <>
          <div className="card empty">No scope yet. Import the BoQ / works order and every line is read for you to check.</div>
          <button className="btn btn-primary" onClick={onImport}><IconScope /> Import BoQ</button>
        </>
      )}

      {rooms.map(room => (
        <div key={room}>
          <div className="label" style={{ margin: '6px 0 6px' }}>{room}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {shown.filter(i => i.room === room).sort((a, b) => a.order - b.order).map((i, idx) => {
              const val = valById(i.valuationId)
              const locked = !!lockedIn(i, vals)
              return (
                <div key={i.id} onClick={() => onEdit(i)} className="row" style={{ padding: '12px 12px', borderTop: idx ? '1px solid var(--cream-line)' : 'none', alignItems: 'flex-start', cursor: 'pointer' }}>
                  {isPriced(i) || i.valuationId ? <Tick on={!!i.valuationId} locked={locked} onClick={() => onToggle(i)} /> : <span style={{ width: 30, flex: 'none' }} />}
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      {i.code && <span className="mono" style={{ color: 'var(--copper)', fontSize: 12 }}>{i.code}</span>}
                      <ValBadge val={val} />
                    </div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{i.description}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'qty not stated'}{i.rate != null ? ` @ ${money(i.rate)}` : ''}
                    </div>
                    {!isPriced(i) && <div className="flag">{i.rate == null ? 'NO RATE' : 'NO QTY'} — tap to fix</div>}
                  </div>
                  <div className="mono" style={{ fontSize: 14, color: isPriced(i) ? 'var(--ink)' : 'var(--ink-muted)' }}>{isPriced(i) ? money(lineValue(i.qty, i.rate)) : '—'}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="row">
        {scope.length > 0 && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onImport}><IconScope /> Import more</button>}
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onAdd}><IconPlus /> Add item</button>
      </div>
      {scope.length > 0 && <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Tick an item to put it in the open valuation. Untick to send it back.</div>}
    </div>
  )
}

export function ScopeForm({ item, jobId, nextOrder, rooms, locked, onSave, onDelete, onClose }: {
  item?: ScopeItem; jobId: string; nextOrder: number; rooms: string[]; locked: boolean
  onSave: (i: ScopeItem) => void; onDelete?: () => void; onClose: () => void
}) {
  const [f, setF] = useState<ScopeItem>(item ?? { id: uid(), jobId, code: '', description: '', room: rooms[rooms.length - 1] ?? 'General', qty: null, unit: 'nr', rate: null, valuationId: null, order: nextOrder, createdAt: Date.now() })
  const [qty, setQty] = useState(item?.qty != null ? String(item.qty) : '')
  const [rate, setRate] = useState(item?.rate != null ? String(item.rate) : '')
  const [confirm, setConfirm] = useState(false)
  const n = (s: string) => { const v = parseFloat(s.replace(/[£,]/g, '')); return isFinite(v) && v > 0 ? v : null }
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">{item ? 'Scope item' : 'Add scope item'}</div>
        {locked && <div className="flag">Claimed on an issued valuation — locked.</div>}
        <div className="row">
          <div style={{ width: '38%' }}><Field label="SoR code"><input disabled={locked} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field></div>
          <div className="grow"><Field label="Room / area"><input disabled={locked} value={f.room} onChange={e => setF({ ...f, room: e.target.value })} list="rooms" /></Field></div>
          <datalist id="rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
        </div>
        <Field label="Description *"><textarea disabled={locked} rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <div className="row">
          <div className="grow"><Field label="Qty"><input disabled={locked} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="Not stated" /></Field></div>
          <div style={{ width: '22%' }}><Field label="Unit"><input disabled={locked} value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></Field></div>
          <div className="grow"><Field label="Rate (£)"><input disabled={locked} inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="No rate" /></Field></div>
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 300, color: n(qty) && n(rate) ? 'var(--copper)' : 'var(--ink-muted)' }}>
          {n(qty) && n(rate) ? money(n(qty)! * n(rate)!) : 'Qty × rate'}
        </div>
        {!locked && <button className="btn btn-primary" disabled={!f.description.trim()} onClick={() => onSave({ ...f, description: f.description.trim(), room: f.room.trim() || 'General', code: f.code.trim(), qty: n(qty), rate: n(rate) })}>{item ? 'Save' : 'Add item'}</button>}
        {onDelete && !locked && (confirm
          ? <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onDelete}>Delete this item</button>
          : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => setConfirm(true)}>Delete…</button>)}
      </div>
    </Sheet>
  )
}
