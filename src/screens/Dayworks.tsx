import { useEffect, useState } from 'react'
import type { Dayworks, DayworksItem, DayworksLabour, Job, RateBook, RateItem, Variation } from '../lib/types'
import { useAccess } from '../lib/access'
import { rates, uid } from '../lib/db'
import { LABOUR } from '../lib/rates'
import { dwRef, dwTotals } from '../lib/dayworks'
import { money, ukDate, voRef } from '../lib/format'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'
import { Plate } from '../components/Sign'

const today = () => new Date().toISOString().slice(0, 10)
const num = (s: string) => { const v = parseFloat(s.replace(/[£,\s]/g, '')); return isFinite(v) && v >= 0 ? v : null }

/** Labour rates from every rate book (one per trade code — the first book listed wins). */
function useLabourRates(books: RateBook[]) {
  const [list, setList] = useState<RateItem[]>([])
  useEffect(() => {
    let live = true
    rates.all().then(all => {
      const order = new Map(books.map((b, i) => [b.id, i]))
      const seen = new Set<string>(), out: RateItem[] = []
      for (const i of all.filter(x => x.section === LABOUR && order.has(x.bookId)).sort((a, b) => order.get(a.bookId)! - order.get(b.bookId)!)) if (!seen.has(i.code)) { seen.add(i.code); out.push(i) }
      if (live) setList(out)
    })
    return () => { live = false }
  }, [books.length])
  return list
}

/** All dayworks sheets on a job. */
export function DayworksSheet({ job, sheets, vos, books, onSave, onDelete, onClaim, onPdf, onClose, startNew }: {
  job: Job; sheets: Dayworks[]; vos: Variation[]; books: RateBook[]
  onSave: (d: Dayworks) => Promise<void>; onDelete: (d: Dayworks) => Promise<void>; onClaim: (d: Dayworks) => Promise<void>; onPdf: (d: Dayworks) => Promise<void>
  onClose: () => void; startNew?: boolean
}) {
  const { money: m } = useAccess()
  const next = sheets.reduce((n, d) => Math.max(n, d.number), 0) + 1
  const blank = (): Dayworks => ({ id: uid(), jobId: job.id, number: next, date: today(), description: '', labour: [{ trade: '', label: '', rate: null, hours: null }], materials: [], plant: [],
    materialsPct: sheets.length ? sheets.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).materialsPct : 0, signedBy: '', signedAt: null, voId: null, createdAt: Date.now() })
  const [edit, setEdit] = useState<Dayworks | null>(startNew ? blank() : null)
  const sorted = [...sheets].sort((a, b) => b.number - a.number)
  if (edit) return <DayworksEditor job={job} d={edit} isNew={!sheets.some(s => s.id === edit.id)} vo={vos.find(v => v.id === edit.voId)} books={books}
    onClose={() => setEdit(null)} onSave={async d => { await onSave(d); setEdit(null) }} onDelete={async () => { await onDelete(edit); setEdit(null) }}
    onClaim={async d => { await onClaim(d); setEdit(null) }} onPdf={onPdf} />
  return (
    <Sheet onClose={onClose} label="Dayworks">
      <div className="stack">
        <div className="label bracket">Dayworks · {job.name}</div>
        <div className="muted" style={{ fontSize: 14 }}>Work done on time and materials: hours by trade, materials and plant, signed by the client, then claimed as a variation.</div>
        {sorted.length === 0 ? <div className="card empty">No dayworks sheets yet.</div> : (
          <div className="panel chk">
            {sorted.map(d => {
              const t = dwTotals(d), vo = vos.find(v => v.id === d.voId)
              return (
                <button key={d.id} className="chk-row order-row" onClick={() => setEdit(d)}>
                  <span className="mono">{dwRef(d.number)}</span>
                  <span className="grow">{d.description || 'No description'}<small>{ukDate(new Date(d.date + 'T12:00:00').getTime())} · {t.labourHours} hour{t.labourHours === 1 ? '' : 's'}{m ? ` · ${money(t.total)}` : ''}</small>
                    <span className="order-plates">{d.signedBy ? <Plate kind="ok">Signed · {d.signedBy}</Plate> : <Plate kind="warn">Not signed</Plate>}{m && vo && <Plate kind="wait">Claimed as {voRef(vo.number)}</Plate>}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setEdit(blank())}>New dayworks sheet</button>
      </div>
    </Sheet>
  )
}

function Items({ title, items, set, showMoney }: { title: string; items: DayworksItem[]; set: (x: DayworksItem[]) => void; showMoney: boolean }) {
  return (
    <div className="stack" style={{ marginTop: 6 }}>
      <h2 className="sec-h" style={{ margin: '8px 0 0' }}>{title}</h2>
      {items.map((it, i) => (
        <div key={i} className="row dw-row">
          <div className="grow"><Field label={`${title} ${i + 1}`}><input value={it.description} onChange={e => set(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="e.g. 6 bags of plaster" /></Field></div>
          {showMoney && <div style={{ width: 110 }}><Field label="Net £"><input inputMode="decimal" value={it.amount != null ? String(it.amount) : ''} onChange={e => set(items.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))} /></Field></div>}
          <button type="button" className="icon-btn" aria-label={`Remove ${title.toLowerCase()} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="linkish tap" onClick={() => set([...items, { description: '', amount: null }])}>+ Add {title.toLowerCase()}</button>
    </div>
  )
}

function DayworksEditor({ job, d: initial, isNew, vo, books, onSave, onDelete, onClaim, onPdf, onClose }: {
  job: Job; d: Dayworks; isNew: boolean; vo?: Variation; books: RateBook[]
  onSave: (d: Dayworks) => Promise<void>; onDelete: () => Promise<void>; onClaim: (d: Dayworks) => Promise<void>; onPdf: (d: Dayworks) => Promise<void>; onClose: () => void
}) {
  const { money: m } = useAccess()
  const [d, setD] = useState(initial)
  const [busy, setBusy] = useState(false)
  const trades = useLabourRates(books)
  const t = dwTotals(d)
  const setLabour = (i: number, l: Partial<DayworksLabour>) => setD({ ...d, labour: d.labour.map((x, j) => (j === i ? { ...x, ...l } : x)) })
  const claimedLocked = !!vo?.valuationId
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  return (
    <Sheet onClose={onClose} label={`Dayworks ${dwRef(d.number)}`} locked={busy}>
      <div className="stack">
        <div className="label bracket">Dayworks {dwRef(d.number)} · {job.name}</div>
        {vo && <Plate kind="wait">Claimed as {voRef(vo.number)}{claimedLocked ? ' — in a valuation' : ''}</Plate>}
        <div className="row">
          <div style={{ width: 170 }}><Field label="Date"><input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} /></Field></div>
          <div className="grow" />
        </div>
        <Field label="Work done, and why it’s dayworks"><textarea rows={2} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} placeholder="e.g. Clear flooded cellar before survey — instructed by Dylan on site" /></Field>

        <h2 className="sec-h" style={{ margin: '8px 0 0' }}>Labour</h2>
        {d.labour.map((l, i) => (
          <div key={i} className="row dw-row">
            <div className="grow">
              <label className="field"><span>Trade {i + 1}</span>
                <select value={l.trade || (l.label ? 'OTHER' : '')} onChange={e => {
                  const r = trades.find(x => x.code === e.target.value)
                  setLabour(i, r ? { trade: r.code, label: r.short, rate: r.rate } : e.target.value === 'OTHER' ? { trade: '', label: l.label || 'Other', rate: l.rate } : { trade: '', label: '', rate: null })
                }}>
                  <option value="">Choose…</option>
                  {trades.map(r => <option key={r.code} value={r.code}>{r.code} — {r.short.replace(/\s*\(.*\)$/, '')}{m ? ` · ${money(r.rate)}/hr` : ''}</option>)}
                  <option value="OTHER">Other…</option>
                </select>
              </label>
            </div>
            <div style={{ width: 90 }}><Field label="Hours"><input inputMode="decimal" value={l.hours != null ? String(l.hours) : ''} onChange={e => setLabour(i, { hours: num(e.target.value) })} /></Field></div>
            <button type="button" className="icon-btn" aria-label={`Remove trade ${i + 1}`} onClick={() => setD({ ...d, labour: d.labour.filter((_, j) => j !== i) })}>×</button>
            {!l.trade && l.label && (
              <div className="row" style={{ flexBasis: '100%' }}>
                <div className="grow"><Field label="Trade name"><input value={l.label} onChange={e => setLabour(i, { label: e.target.value })} /></Field></div>
                {m && <div style={{ width: 110 }}><Field label="£ per hour"><input inputMode="decimal" value={l.rate != null ? String(l.rate) : ''} onChange={e => setLabour(i, { rate: num(e.target.value) })} /></Field></div>}
              </div>
            )}
          </div>
        ))}
        {!trades.length && <div className="muted" style={{ fontSize: 13 }}>No labour rates in your rate books yet — import your schedule (it carries them) or choose Other and enter the rate.</div>}
        <button type="button" className="linkish tap" onClick={() => setD({ ...d, labour: [...d.labour, { trade: '', label: '', rate: null, hours: null }] })}>+ Add a trade</button>

        <Items title="Materials" items={d.materials} set={materials => setD({ ...d, materials })} showMoney={m} />
        <Items title="Plant" items={d.plant} set={plant => setD({ ...d, plant })} showMoney={m} />

        {m && (
          <>
            <Field label="Addition on materials and plant (%)" hint="Only what your contract allows — 0 unless it says otherwise"><input inputMode="decimal" value={String(d.materialsPct)} onChange={e => setD({ ...d, materialsPct: num(e.target.value) ?? 0 })} /></Field>
            <div className="panel dw-totals">
              <div><span>Labour · {t.labourHours} h</span><b className="amt">{money(t.labour)}</b></div>
              <div><span>Materials</span><b className="amt">{money(t.materials)}</b></div>
              <div><span>Plant</span><b className="amt">{money(t.plant)}</b></div>
              {t.addition > 0 && <div><span>Addition at {d.materialsPct}%</span><b className="amt">{money(t.addition)}</b></div>}
              <div className="dw-total"><span>Total (excl. VAT)</span><b className="amt">{money(t.total)}</b></div>
              {t.unpriced > 0 && <Plate kind="warn">{t.unpriced} line{t.unpriced === 1 ? '' : 's'} without a rate or cost — not in the total</Plate>}
            </div>
          </>
        )}

        <div className="row">
          <div className="grow"><Field label="Signed by (client)" hint="Name of the client rep who agreed the sheet"><input value={d.signedBy} onChange={e => setD({ ...d, signedBy: e.target.value, signedAt: e.target.value.trim() ? (d.signedAt ?? Date.now()) : null })} /></Field></div>
        </div>

        <button className="btn btn-primary" disabled={busy || !d.description.trim()} onClick={() => run(() => onSave(d))}>{isNew ? 'Save sheet' : 'Save'}</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => onPdf(d))}>Dayworks sheet (PDF) — to sign or send</button>
        {m && !claimedLocked && <button className="btn btn-secondary" disabled={busy || !d.description.trim() || t.total <= 0} onClick={() => run(() => onClaim(d))}>{vo ? `Update ${voRef(vo.number)} to ${money(t.total)}` : `Claim as a variation · ${money(t.total)}`}</button>}
        {!isNew && !vo && <ConfirmDelete label="Delete…" confirmLabel={`Delete ${dwRef(d.number)}`} onConfirm={() => run(onDelete)} />}
      </div>
    </Sheet>
  )
}
