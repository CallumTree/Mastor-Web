import { useState } from 'react'
import type { Job, ScopeItem, Valuation } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { money, qtyText } from '../lib/format'
import { isPriced, lineValue, lockedIn, valRef } from '../lib/valuation'
import { uid } from '../lib/db'
import { IconLock, IconPlus, IconScope } from '../components/Icons'
import { TabMenu } from '../components/TabMenu'
import { RowHit, SumStrip, TabHead } from '../components/Register'

/** Valuation tick. 44px to hit with a glove; the visible box sits inside. */
export function Tick({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button className="tick" onClick={e => { e.stopPropagation(); onClick() }} disabled={locked} aria-pressed={on} aria-label={on ? (locked ? 'In an issued valuation (locked)' : 'Remove from valuation') : 'Add to valuation'}>
      <span className={'tick-box' + (on ? ' on' : '') + (locked ? ' locked' : '')}>
        {on && (locked ? <IconLock size={16} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M5 12l5 5L19 7" /></svg>)}
      </span>
    </button>
  )
}

export function ValBadge({ val }: { val?: Valuation }) {
  if (!val) return null
  return <span className={'badge ' + (val.status === 'Issued' ? 'b-slate' : 'b-amber')}>{val.status === 'Issued' && <IconLock size={12} />}{valRef(val.number)}</span>
}

type Filter = 'all' | 'live' | 'claimed'

export function ScopeTab({ job, scope, vals, onToggle, onToggleMany, onClearUnclaimed, onDeleteAll, onAdd, onEdit, onImport }: {
  job: Job; scope: ScopeItem[]; vals: Valuation[]; onToggle: (i: ScopeItem) => void; onToggleMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onDeleteAll: (items: ScopeItem[]) => void; onAdd: () => void; onEdit: (i: ScopeItem) => void; onImport: () => void
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
  const unclaimed = scope.filter(i => !i.valuationId)
  const lockedCount = scope.filter(i => !!lockedIn(i, vals)).length
  const toggleProp = (p: string) => setOpenProps(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n })
  const row = (i: ScopeItem, idx: number, showRoom: boolean) => {
    const val = valById(i.valuationId)
    const locked = !!lockedIn(i, vals)
    return (
      <div key={i.id} className="row has-hit" style={{ padding: '12px 12px', borderTop: idx ? '1px solid var(--ink-line)' : 'none', alignItems: 'flex-start' }}>
        <RowHit label={`Edit ${i.code ? i.code + ' ' : ''}${i.description}`} onClick={() => onEdit(i)} />
        {/* the whole left strip of the row is the tick, so a near miss ticks rather than opening the editor */}
        {isPriced(i) || i.valuationId
          ? <div className="tick-col" onClick={e => { e.stopPropagation(); if (!locked) onToggle(i) }}><Tick on={!!i.valuationId} locked={locked} onClick={() => onToggle(i)} /></div>
          : <span className="tick-col" aria-hidden="true" />}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {i.code && <span className="mono" style={{ color: 'var(--copper-ink)', fontSize: 12 }}>{i.code}</span>}
            {showRoom && <span className="muted" style={{ fontSize: 11 }}>{i.room}</span>}
            <ValBadge val={val} />
          </div>
          <div className="clamp2" style={{ fontWeight: 500, marginTop: 2 }}>{i.description}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'qty not stated'}{i.rate != null ? ` @ ${money(i.rate)}` : ''}{i.hours ? ` · ${i.hours}h` : ''}
          </div>
          {!isPriced(i) && <div className="flag">{i.rate == null ? 'NO RATE' : 'NO QTY'} — tap to fix</div>}
        </div>
        <div className="mono" style={{ fontSize: 14, flex: 'none', whiteSpace: 'nowrap', color: isPriced(i) ? 'var(--ink)' : 'var(--ink-muted)' }}>{isPriced(i) ? money(lineValue(i.qty, i.rate)) : '—'}</div>
      </div>
    )
  }

  return (
    <div className="stack">
      <TabHead label="Scope" meta={`${scope.length} items`} menu={<TabMenu title="Scope" actions={[
          { label: 'Import BoQ / works order', hint: 'PDF or Excel', onClick: onImport },
          { label: 'Add item', hint: 'One line, by hand', onClick: onAdd },
          ...(hasProps ? [{ label: openProps.size ? 'Collapse all' : 'Expand all properties', onClick: () => setOpenProps(openProps.size ? new Set() : new Set(properties)) }] : []),
          { label: 'Clear unclaimed lines', hint: `${unclaimed.length} line${unclaimed.length === 1 ? '' : 's'} not in any valuation`, danger: true, disabled: !unclaimed.length,
            confirm: `Remove ${unclaimed.length} unclaimed lines? Anything in a valuation stays.`, onClick: () => onClearUnclaimed(unclaimed) },
          { label: 'Delete entire scope', hint: lockedCount ? `Wrong spec? ${lockedCount} certified line${lockedCount === 1 ? '' : 's'} will stay (issued valuations are locked)` : 'Wrong spec? Removes every line so you can import again', danger: true, disabled: lockedCount === scope.length,
            confirm: lockedCount ? `Delete ${scope.length - lockedCount} lines? The ${lockedCount} certified on issued valuations stay.` : `Delete all ${scope.length} lines from this job? This can't be undone.`, onClick: () => onDeleteAll(scope.filter(i => !lockedIn(i, vals))) },
        ]} />} />

      {scope.length > 0 && <SumStrip label="Scope summary" cols={3} progress={total ? (claimed / total) * 100 : 0} cells={[
        { label: 'Scope total', value: money(total), note: 'base rates' },
        { label: 'Claimed', value: money(claimed), note: `${total ? Math.round((claimed / total) * 100) : 0}% of scope`, hot: true, nil: !claimed },
        { label: 'Still to do', value: money(total - claimed), note: `${unclaimed.length} line${unclaimed.length === 1 ? '' : 's'}`, nil: !unclaimed.length },
      ]} />}

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

      {hasProps ? <div className="panel prop-list">{properties.map(p => {
        const all = scope.filter(i => (i.property || '—') === p)
        const lines = shown.filter(i => (i.property || '—') === p).sort((a, b) => a.order - b.order)
        const tot = all.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
        const cl = all.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
        const pct = tot ? Math.round((cl / tot) * 100) : 0
        const remaining = all.filter(i => !i.valuationId && isPriced(i))
        const isOpen = openProps.has(p)
        if (!lines.length && filter !== 'all') return null
        return (
          <div key={p} className={'prop-item' + (isOpen ? ' open' : '')}>
            <button className="prop-row" onClick={() => toggleProp(p)} aria-expanded={isOpen} aria-label={`Property ${p}`}>
              <span className="prop-no">{p === '—' ? '?' : p}</span>
              <span className="prop-main">
                <span className="prop-name">{p === '—' ? 'Unassigned' : `No. ${p}`}</span>
                <span className="prop-meta" style={{ display: 'block' }}>{[...new Set(all.map(groupName))].join(' · ')}</span>
              </span>
              <span className="prop-amt"><span className="mono">{money(tot)}</span><small style={{ color: pct === 100 ? 'var(--green)' : undefined }}>{pct === 100 ? '✓ all claimed' : `${pct}% claimed`}</small></span>
              <span className="prop-chev">▸</span>
            </button>
            <div className="prop-bar"><div style={{ width: `${pct}%` }} /></div>
            {isOpen && (
              <div className="prop-body">
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
      })}</div> : rooms.map(room => (
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
        <div className="mono" style={{ fontSize: 20, fontWeight: 300, color: n(qty) && n(rate) ? 'var(--copper-ink)' : 'var(--ink-muted)' }}>
          {n(qty) && n(rate) ? money(n(qty)! * n(rate)!) : 'Qty × rate'}
        </div>
        {!locked && <button className="btn btn-primary" disabled={!f.description.trim()} onClick={() => onSave({ ...f, description: f.description.trim(), room: f.room.trim() || 'General', code: f.code.trim(), qty: n(qty), rate: n(rate) })}>{item ? 'Save' : 'Add item'}</button>}
        {onDelete && !locked && <ConfirmDelete label="Delete…" confirmLabel={<>Delete this item</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}
