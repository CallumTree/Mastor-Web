import { useState } from 'react'
import type { Job, OrderStatus, RateBook, RateItem, ScopeItem, Valuation, WorkOrder } from '../lib/types'
import { useAccess } from '../lib/access'
import { uid } from '../lib/db'
import { isPriced, lineValue, lockedIn } from '../lib/valuation'
import { money, ukDate } from '../lib/format'
import { savePhoto, usePhotoUrl } from '../lib/photos'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'
import { SumStrip, TabHead } from '../components/Register'
import { Plate } from '../components/Sign'
import { IconCamera, IconPlus } from '../components/Icons'
import { RateLookup } from './Rates'

export const PRIORITIES = ['Emergency', 'Urgent', 'Routine', 'Void', 'Planned']
const priorityPlate = (p: string) => (p === 'Emergency' ? 'stop' : p === 'Urgent' || p === 'Void' ? 'warn' : 'wait') as 'stop' | 'warn' | 'wait'
export const isOverdue = (o: WorkOrder, now = Date.now()) => o.status === 'open' && o.dueAt != null && o.dueAt < now
const orderLines = (o: WorkOrder, scope: ScopeItem[]) => scope.filter(i => i.orderId === o.id)
const value = (ls: ScopeItem[]) => ls.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)

type Filter = 'open' | 'complete' | 'all'

/** The Orders tab of a responsive / voids contract: many small works orders, claimed together. */
export function OrdersTab({ job, orders, scope, vals, onNew, onOpen, onClaim }: {
  job: Job; orders: WorkOrder[]; scope: ScopeItem[]; vals: Valuation[]
  onNew: () => void; onOpen: (o: WorkOrder) => void; onClaim: (lines: ScopeItem[]) => void
}) {
  const { money: m } = useAccess()
  const [filter, setFilter] = useState<Filter>('open')
  const live = orders.filter(o => o.status !== 'cancelled')
  const open = live.filter(o => o.status === 'open')
  const done = live.filter(o => o.status === 'complete')
  // completed orders with lines not yet in any valuation: ready for this month's application
  const claimable = done.flatMap(o => orderLines(o, scope)).filter(i => !i.valuationId && isPriced(i))
  const claimableOrders = new Set(claimable.map(i => i.orderId)).size
  const unpricedDone = done.flatMap(o => orderLines(o, scope)).filter(i => !isPriced(i)).length
  const claimed = live.flatMap(o => orderLines(o, scope)).filter(i => i.valuationId)
  const shown = (filter === 'open' ? open : filter === 'complete' ? done : orders).slice().sort((a, b) =>
    (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.raisedAt - a.raisedAt)
  void job

  return (
    <div className="stack">
      <TabHead label="Orders" meta={`${open.length} open`} />
      {m && live.length > 0 && <SumStrip label="Orders summary" cols={3} caption="At base rates — uplifts are added in the valuation" cells={[
        { label: 'Open', value: String(open.length), note: `${open.filter(o => isOverdue(o)).length} overdue · ${money(value(open.flatMap(o => orderLines(o, scope))))}`, nil: !open.length },
        { label: 'Done, not claimed', value: money(value(claimable)), note: `${claimableOrders} order${claimableOrders === 1 ? '' : 's'}${unpricedDone ? ` · + ${unpricedDone} unpriced line${unpricedDone === 1 ? '' : 's'}` : ''}`, hot: true, nil: !claimable.length },
        { label: 'Claimed', value: money(value(claimed)), note: `${new Set(claimed.map(i => i.orderId)).size} orders`, nil: !claimed.length },
      ]} />}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={onNew}><IconPlus /> New order</button>
        {m && claimable.length > 0 && <button className="btn btn-secondary" onClick={() => onClaim(claimable)}>Claim {claimableOrders} completed</button>}
      </div>
      <div className="chips" role="group" aria-label="Show">
        {(['open', 'complete', 'all'] as Filter[]).map(f => <button key={f} className={'chip' + (filter === f ? ' on' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'open' ? `Open · ${open.length}` : f === 'complete' ? `Complete · ${done.length}` : 'All'}</button>)}
      </div>
      {shown.length === 0 && <div className="card empty">{orders.length ? 'Nothing here.' : 'No orders yet. Add each works order as it comes in — order number, address and the SoR lines.'}</div>}
      {shown.length > 0 && (
        <div className="panel chk">
          {shown.map(o => {
            const ls = orderLines(o, scope)
            const inVal = ls.some(i => i.valuationId)
            return (
              <button key={o.id} className="chk-row order-row" onClick={() => onOpen(o)}>
                <span className="mono">{o.ref || '—'}</span>
                <span className="grow">{o.address || 'No address'}
                  <small>{ls.length} line{ls.length === 1 ? '' : 's'}{m && ls.length ? ` · ${money(value(ls))}` : ''}{o.dueAt && o.status === 'open' ? ` · due ${ukDate(o.dueAt)}` : ''}{o.completedAt ? ` · done ${ukDate(o.completedAt)}` : ''}</small>
                  <span className="order-plates">
                    {o.status === 'cancelled' ? <Plate kind="wait">Cancelled</Plate>
                      : o.status === 'complete' ? <Plate kind="ok">{m && inVal ? 'Done · claimed' : 'Done'}</Plate>
                      : isOverdue(o) ? <Plate kind="stop">Overdue</Plate> : <Plate kind={priorityPlate(o.priority)}>{o.priority}</Plate>}
                    {o.status === 'complete' && !o.afterIds.length && <Plate kind="warn">No after photos</Plate>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Thumb({ id }: { id: string }) {
  const url = usePhotoUrl(id)
  return url ? <img src={url} alt="" /> : null
}

type Draft = { id: string; code: string; description: string; qty: string; unit: string; rate: number | null; rateBook?: string; existing?: ScopeItem }

/** One works order: details, SoR lines, before/after photos, sign-off, complete. */
export function OrderSheet({ job, order, scope, vals, books, onSave, onDelete, onEvidence, onClose }: {
  job: Job; order?: WorkOrder; scope: ScopeItem[]; vals: Valuation[]; books: RateBook[]
  onSave: (o: WorkOrder, lines: ScopeItem[], removed: ScopeItem[]) => Promise<void>
  onDelete?: () => void; onEvidence?: (o: WorkOrder) => void; onClose: () => void
}) {
  const { money: m } = useAccess()
  const [o, setO] = useState<WorkOrder>(order ?? { id: uid(), jobId: job.id, ref: '', address: '', priority: 'Routine', raisedAt: Date.now(), dueAt: null, status: 'open', completedAt: null, note: '', beforeIds: [], afterIds: [], signedBy: '', createdAt: Date.now() })
  const existing = order ? scope.filter(i => i.orderId === order.id) : []
  const locked = existing.some(i => !!lockedIn(i, vals))
  const [lines, setLines] = useState<Draft[]>(existing.map(i => ({ id: i.id, code: i.code, description: i.description, qty: i.qty != null ? String(i.qty) : '', unit: i.unit, rate: i.rate, rateBook: i.rateBook, existing: i })))
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [due, setDue] = useState(o.dueAt ? new Date(o.dueAt).toISOString().slice(0, 10) : '')
  const qn = (s: string) => { const v = parseFloat(s.replace(',', '.')); return isFinite(v) && v > 0 ? v : null }
  const addFromBook = (i: RateItem, b?: RateBook) => { setLines(ls => [...ls, { id: uid(), code: i.code, description: i.short, qty: '1', unit: i.unit, rate: i.rate, rateBook: b?.name }]); setCode('') }
  const total = lines.reduce((t, l) => t + lineValue(qn(l.qty), l.rate), 0)
  const addPhotos = async (files: FileList | null, which: 'beforeIds' | 'afterIds') => {
    if (!files?.length) return
    const ids: string[] = []
    for (const f of Array.from(files)) ids.push(await savePhoto(f))
    setO(x => ({ ...x, [which]: [...x[which], ...ids] }))
  }
  const save = async (status?: OrderStatus) => {
    setBusy(true)
    const next: WorkOrder = { ...o, ref: o.ref.trim(), address: o.address.trim(), signedBy: o.signedBy.trim(), dueAt: due ? new Date(due + 'T17:00:00').getTime() : null,
      ...(status ? { status, completedAt: status === 'complete' ? Date.now() : status === 'open' ? null : o.completedAt } : {}) }
    const maxOrder = scope.reduce((mx, i) => Math.max(mx, i.order), 0)
    const out: ScopeItem[] = lines.map((l, n) => ({
      ...(l.existing ?? { jobId: job.id, valuationId: null, createdAt: Date.now(), order: maxOrder + n + 1 }),
      id: l.id, code: l.code.trim().toUpperCase(), description: l.description.trim() || l.code, qty: qn(l.qty), unit: l.unit, rate: l.rate,
      rateBook: l.rateBook, orderId: next.id, property: next.ref || next.address || 'Order', room: next.address || 'Order',
    } as ScopeItem))
    const removed = existing.filter(e => !lines.some(l => l.id === e.id))
    await onSave(next, out, removed)
    setBusy(false)
  }

  return (
    <Sheet onClose={onClose} label={order ? `Order ${o.ref}` : 'New order'} locked={busy}>
      <div className="stack">
        <div className="label bracket">{order ? `Order ${o.ref || ''}` : 'New works order'} · {job.name}</div>
        {o.status === 'complete' && <Plate kind="ok">Done {o.completedAt ? ukDate(o.completedAt) : ''}{o.signedBy ? ` · signed off by ${o.signedBy}` : ''}</Plate>}
        {o.status === 'cancelled' && <Plate kind="wait">Cancelled</Plate>}
        {locked && <div className="flag">Claimed on an issued valuation — the lines are locked.</div>}
        <div className="row">
          <div className="grow"><Field label="Order number *"><input value={o.ref} onChange={e => setO({ ...o, ref: e.target.value })} placeholder="e.g. R-104882" /></Field></div>
          <div className="grow"><Field label="Due"><input type="date" value={due} onChange={e => setDue(e.target.value)} /></Field></div>
        </div>
        <Field label="Address *"><input value={o.address} onChange={e => setO({ ...o, address: e.target.value })} placeholder="e.g. 14 Bush Street, Pembroke Dock" /></Field>
        <fieldset className="chips" style={{ border: 0, padding: 0, margin: 0 }}><legend className="field" style={{ padding: 0 }}><span>Priority</span></legend>
          {PRIORITIES.map(p => <button key={p} type="button" className={'chip' + (o.priority === p ? ' on' : '')} aria-pressed={o.priority === p} onClick={() => setO({ ...o, priority: p })}>{p}</button>)}
        </fieldset>

        <h2 className="sec-h">Work · {lines.length} line{lines.length === 1 ? '' : 's'}{m && lines.length ? ` · ${money(total)}` : ''}</h2>
        {lines.length > 0 && (
          <div className="panel chk">
            {lines.map((l, n) => (
              <div key={l.id} className="chk-row order-line">
                <span className="mono">{l.code || '—'}</span>
                <span className="grow">{l.description}<small>{m ? (l.rate != null ? `${money(l.rate)} per ${l.unit}${l.rateBook ? ` · ${l.rateBook}` : ''}` : 'No rate') : l.unit}</small></span>
                <label className="field qty"><span className="sr-only">Qty for {l.code}</span>
                  <input inputMode="decimal" value={l.qty} disabled={locked || !m} onChange={e => setLines(ls => ls.map((x, i) => (i === n ? { ...x, qty: e.target.value } : x)))} placeholder="Qty" /></label>
                {m && !locked && <button type="button" className="icon-btn" aria-label={`Remove ${l.code}`} onClick={() => setLines(ls => ls.filter((_, i) => i !== n))}>×</button>}
              </div>
            ))}
          </div>
        )}
        {m && !locked && (
          <div className="panel stack">
            <Field label="Add an SoR code"><input value={code} autoCapitalize="characters" onChange={e => setCode(e.target.value)} placeholder="e.g. 0171AD" /></Field>
            <RateLookup code={code} books={books} onUse={addFromBook} />
            {!books.length && code.trim().length >= 4 && (
              <button type="button" className="btn btn-secondary" onClick={() => { setLines(ls => [...ls, { id: uid(), code: code.trim().toUpperCase(), description: code.trim().toUpperCase(), qty: '1', unit: 'IT', rate: null }]); setCode('') }}>Add {code.trim().toUpperCase()} unpriced</button>
            )}
          </div>
        )}

        <h2 className="sec-h">Photos</h2>
        {(['beforeIds', 'afterIds'] as const).map(w => (
          <div key={w} className="stack" style={{ marginTop: 0 }}>
            <div className="row"><b className="grow">{w === 'beforeIds' ? 'Before' : 'After'} · {o[w].length}</b>
              <label className="btn btn-secondary" style={{ width: 'auto' }}><IconCamera /> Add
                <input type="file" accept="image/*" capture="environment" multiple hidden onChange={e => { void addPhotos(e.target.files, w); e.target.value = '' }} /></label>
            </div>
            {o[w].length > 0 && <div className="thumbs">{o[w].map(id => <Thumb key={id} id={id} />)}</div>}
          </div>
        ))}

        <Field label="Notes"><textarea rows={2} value={o.note} onChange={e => setO({ ...o, note: e.target.value })} placeholder="Access, tenant, anything found" /></Field>
        <Field label="Signed off by" hint="Tenant or client rep, if anyone signs for the work"><input value={o.signedBy} onChange={e => setO({ ...o, signedBy: e.target.value })} /></Field>

        {o.status === 'open' && (
          <>
            {!o.afterIds.length && lines.length > 0 && <div className="muted" style={{ fontSize: 14 }}>Clients usually ask for after photos before paying — add them before marking it done.</div>}
            <button className="btn btn-primary" disabled={busy || !o.ref.trim() || !o.address.trim()} onClick={() => save('complete')}>Mark done</button>
          </>
        )}
        <button className={'btn ' + (o.status === 'open' ? 'btn-secondary' : 'btn-primary')} disabled={busy || !o.ref.trim() || !o.address.trim()} onClick={() => save()}>{order ? 'Save' : 'Add order'}</button>
        {order && o.status !== 'open' && !locked && <button className="btn btn-ghost" onClick={() => save('open')}>Reopen</button>}
        {order && onEvidence && <button className="btn btn-secondary" onClick={() => onEvidence(o)}>Completion evidence (PDF)</button>}
        {order && m && o.status === 'open' && <button className="btn btn-ghost" onClick={() => save('cancelled')}>Cancel this order</button>}
        {order && m && onDelete && !locked && !existing.some(i => i.valuationId) && <ConfirmDelete label="Delete…" confirmLabel="Delete this order" onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}

