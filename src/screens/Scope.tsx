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
      style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: `1.5px solid ${on ? 'var(--copper)' : 'rgba(201,123,63,.45)'}`, background: on ? 'linear-gradient(180deg, #D98A4C, #C07034)' : '#FFFCF7', color: '#FFF4E4', display: 'grid', placeItems: 'center', opacity: locked ? .6 : 1, boxShadow: on && !locked ? '0 0 12px -2px #E8A868' : 'none', transition: 'box-shadow .2s, background .2s' }}>
      {on && (locked ? '🔒' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M5 12l5 5L19 7" /></svg>)}
    </button>
  )
}

export function ValBadge({ val }: { val?: Valuation }) {
  if (!val) return null
  return <span className={'badge ' + (val.status === 'Issued' ? 'b-slate' : 'b-amber')}>{val.status === 'Issued' ? '🔒 ' : ''}{valRef(val.number)}</span>
}

type Filter = 'all' | 'live' | 'claimed'

export function ScopeTab({ scope, vals, onToggle, onToggleMany, onClearUnclaimed, onAdd, onEdit, onImport }: {
  job: Job; scope: ScopeItem[]; vals: Valuation[]; onToggle: (i: ScopeItem) => void; onToggleMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onAdd: () => void; onEdit: (i: ScopeItem) => void; onImport: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const total = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const claimed = scope.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const shown = scope.filter(i => filter === 'all' || (filter === 'live' ? !i.valuationId : !!i.valuationId))
  const rooms = [...new Set(shown.map(i => i.room))]
  const valById = (id: string | null) => vals.find(v => v.id === id)
  // Multi-property schemes: one collapsible block per property, lines in the council's order
  const properties = [...new Set(scope.map(i => i.property || '—'))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const hasProps = properties.filter(p => p !== '—').length > 1 || (properties.length > 1 && scope.some(i => i.property))
  const [openProps, setOpenProps] = useState<Set<string>>(new Set())
  const [confirmAll, setConfirmAll] = useState<string | null>(null)
  // second level inside a property: workstream (Kitchen, Bathroom, Paint, Scaffold…), else location
  const groupName = (i: ScopeItem) => i.workstream || i.room || 'General'
  const groupsOf = (ls: ScopeItem[]) => [...new Set(ls.map(groupName))]
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (k: string) => setOpenGroups(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const [confirmClear, setConfirmClear] = useState(false)
  const unclaimed = scope.filter(i => !i.valuationId)
  const toggleProp = (p: string) => setOpenProps(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n })
  const row = (i: ScopeItem, idx: number, showRoom: boolean) => {
    const val = valById(i.valuationId)
    const locked = !!lockedIn(i, vals)
    return (
      <div key={i.id} onClick={() => onEdit(i)} className="row" style={{ padding: '12px 12px', borderTop: idx ? '1px solid var(--ink-line)' : 'none', alignItems: 'flex-start', cursor: 'pointer' }}>
        {isPriced(i) || i.valuationId ? <Tick on={!!i.valuationId} locked={locked} onClick={() => onToggle(i)} /> : <span style={{ width: 30, flex: 'none' }} />}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {i.code && <span className="mono" style={{ color: 'var(--copper)', fontSize: 12 }}>{i.code}</span>}
            {showRoom && <span className="muted" style={{ fontSize: 11 }}>{i.room}</span>}
            <ValBadge val={val} />
          </div>
          <div className="clamp2" style={{ fontWeight: 500, marginTop: 2 }}>{i.description}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'qty not stated'}{i.rate != null ? ` @ ${money(i.rate)}` : ''}{i.hours ? ` · ${i.hours}h` : ''}
          </div>
          {!isPriced(i) && <div className="flag">{i.rate == null ? 'NO RATE' : 'NO QTY'} — tap to fix</div>}
        </div>
        <div className="mono" style={{ fontSize: 14, color: isPriced(i) ? 'var(--ink)' : 'var(--ink-muted)' }}>{isPriced(i) ? money(lineValue(i.qty, i.rate)) : '—'}</div>
      </div>
    )
  }

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

      {hasProps ? properties.map(p => {
        const all = scope.filter(i => (i.property || '—') === p)
        const lines = shown.filter(i => (i.property || '—') === p).sort((a, b) => a.order - b.order)
        const tot = all.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
        const cl = all.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
        const pct = tot ? Math.round((cl / tot) * 100) : 0
        const remaining = all.filter(i => !i.valuationId && isPriced(i))
        const isOpen = openProps.has(p)
        if (!lines.length && filter !== 'all') return null
        return (
          <div key={p} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => toggleProp(p)} aria-expanded={isOpen} aria-label={`Property ${p}`}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 14px', color: 'var(--ink)' }}>
              <div className="row">
                <span style={{ width: 14, color: 'var(--copper-ink)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{p === '—' ? 'Unassigned' : `No. ${p}`}</span>
                <span className="grow muted" style={{ fontSize: 12 }}>{all.length} line{all.length === 1 ? '' : 's'}</span>
                <span className="mono" style={{ fontSize: 14 }}>{money(tot)}</span>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 10 }}>
                <div className="grow" style={{ height: 5, border: '1px solid var(--ink-line)' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--copper)' }} /></div>
                <span className="mono" style={{ fontSize: 12, color: pct === 100 ? 'var(--green)' : 'var(--copper-ink)', width: 38, textAlign: 'right' }}>{pct}%</span>
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--ink)' }}>
                {remaining.length > 0 && (
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--ink-line)' }}>
                    {confirmAll === p
                      ? <div className="row"><span className="grow" style={{ fontSize: 13 }}>Put all {remaining.length} remaining lines ({money(remaining.reduce((t, i) => t + lineValue(i.qty, i.rate), 0))}) into the valuation?</span>
                          <button className="chip" onClick={() => setConfirmAll(null)}>No</button><button className="chip on" onClick={() => { setConfirmAll(null); onToggleMany(remaining) }}>Yes</button></div>
                      : <button className="btn btn-secondary" style={{ minHeight: 42 }} onClick={() => setConfirmAll(p)}>Tick all remaining ({remaining.length})</button>}
                  </div>
                )}
                {lines.length === 0 && <div className="muted" style={{ padding: 12, fontSize: 13 }}>Nothing here for this filter.</div>}
                {groupsOf(lines).map(g => {
                  const key = `${p}|${g}`
                  const gl = lines.filter(i => groupName(i) === g)
                  const gall = all.filter(i => groupName(i) === g)
                  const gt = gall.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
                  const gc = gall.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
                  const gpct = gt ? Math.round((gc / gt) * 100) : 0
                  const grem = gall.filter(i => !i.valuationId && isPriced(i))
                  const gOpen = openGroups.has(key)
                  return (
                    <div key={key} style={{ borderTop: '1px solid var(--ink-line)' }}>
                      <button onClick={() => toggleGroup(key)} aria-expanded={gOpen} aria-label={`No. ${p} ${g}`}
                        className="row" style={{ width: '100%', background: gOpen ? 'rgba(201,123,63,.06)' : 'none', border: 'none', padding: '10px 14px 10px 30px', color: 'var(--ink)', textAlign: 'left' }}>
                        <span style={{ width: 12, color: 'var(--copper-ink)', fontSize: 11, transition: 'transform .2s', transform: gOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
                        <span className="grow" style={{ fontWeight: 600, fontSize: 14 }}>{g} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {gall.length}</span></span>
                        <span className="mono" style={{ fontSize: 13 }}>{money(gt)}</span>
                        <span className="mono" style={{ fontSize: 11, width: 36, textAlign: 'right', color: gpct === 100 ? 'var(--green)' : 'var(--copper-ink)' }}>{gpct}%</span>
                      </button>
                      {gOpen && (
                        <div style={{ paddingLeft: 18 }}>
                          {grem.length > 1 && <div style={{ padding: '6px 12px' }}><button className="chip" onClick={() => onToggleMany(grem)}>Tick all {g} ({grem.length})</button></div>}
                          {gl.map((i, idx) => row(i, idx, true))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }) : rooms.map(room => (
        <div key={room}>
          <div className="label" style={{ margin: '6px 0 6px' }}>{room}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {shown.filter(i => i.room === room).sort((a, b) => a.order - b.order).map((i, idx) => row(i, idx, false))}
          </div>
        </div>
      ))}

      <div className="row">
        {scope.length > 0 && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onImport}><IconScope /> Import more</button>}
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onAdd}><IconPlus /> Add item</button>
      </div>
      {scope.length > 0 && <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Tick an item to put it in the open valuation. Untick to send it back.</div>}
      {unclaimed.length > 0 && (confirmClear
        ? <div className="panel" style={{ padding: 12 }}><div style={{ fontSize: 13, marginBottom: 8 }}>Remove all {unclaimed.length} unclaimed lines? Anything already in a valuation stays. Use this to redo an import.</div>
            <div className="row"><button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmClear(false)}>Cancel</button><button className="btn" style={{ flex: 1, background: 'var(--red)', color: '#fff' }} onClick={() => { setConfirmClear(false); onClearUnclaimed(unclaimed) }}>Remove {unclaimed.length}</button></div></div>
        : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)', fontSize: 13 }} onClick={() => setConfirmClear(true)}>Clear unclaimed lines…</button>)}
    </div>
  )
}

export function ScopeForm({ item, jobId, nextOrder, rooms, props = [], streams = [], locked, onSave, onDelete, onClose }: {
  item?: ScopeItem; jobId: string; nextOrder: number; rooms: string[]; props?: string[]; streams?: string[]; locked: boolean
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
        </div>
        <div className="row">
          <div style={{ width: '38%' }}><Field label="Property no." hint="Multi-property jobs"><input disabled={locked} value={f.property ?? ''} onChange={e => setF({ ...f, property: e.target.value.replace(/^(no\.?|plot|house)\s*/i, '') || undefined })} list="props" placeholder="e.g. 4" /></Field></div>
          <div className="grow"><Field label="Workstream"><input disabled={locked} value={f.workstream ?? ''} onChange={e => setF({ ...f, workstream: e.target.value || undefined })} list="streams" placeholder="e.g. PPR Paint" /></Field></div>
          <datalist id="props">{props.map(r => <option key={r} value={r} />)}</datalist>
          <datalist id="streams">{streams.map(r => <option key={r} value={r} />)}</datalist>
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
