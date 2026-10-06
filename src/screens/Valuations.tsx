import { useState } from 'react'
import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { TitleBlock } from '../components/Ui'
import { money, qtyText, ukDate, upliftFactor, voRef } from '../lib/format'
import { lineValue, valRef, valTotals } from '../lib/valuation'
import { CourtLine, valCourt } from '../lib/chase'
import { Field, Sheet } from '../components/Ui'
import { TabMenu } from '../components/TabMenu'
import { invoiceAmounts } from '../lib/invoice'

function Lines({ val, scope, vos, onRemoveScope, onRemoveVo }: {
  val: Valuation; scope: ScopeItem[]; vos: Variation[]
  onRemoveScope?: (i: ScopeItem) => void; onRemoveVo?: (v: Variation) => void
}) {
  const byProp = scope.some(x => x.property)
  const s = scope.filter(x => x.valuationId === val.id).sort((a, b) => byProp ? (a.property ?? '').localeCompare(b.property ?? '', 'en', { numeric: true }) || a.order - b.order : a.room.localeCompare(b.room) || a.order - b.order)
  const o = vos.filter(x => x.valuationId === val.id).sort((a, b) => a.number - b.number)
  const row = (key: string, ref: string, desc: string, sub: string, value: number, onRemove?: () => void) => (
    <div key={key} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--cream-line)', alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>{ref && <span className="mono" style={{ color: 'var(--copper)', fontSize: 12 }}>{ref}</span>}</div>
        <div style={{ fontWeight: 500 }}>{desc}</div>
        <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      </div>
      <div className="mono" style={{ fontSize: 14 }}>{money(value)}</div>
      {onRemove && <button onClick={onRemove} aria-label="Remove from valuation" style={{ background: 'none', border: '1px solid var(--cream-line)', borderRadius: 6, width: 30, height: 30, color: 'var(--ink-muted)', flex: 'none' }}>×</button>}
    </div>
  )
  return (
    <div>
      {s.length > 0 && <div className="label" style={{ marginTop: 8 }}>Scope</div>}
      {s.map((i, n) => <div key={i.id}>{byProp && (n === 0 || s[n - 1].property !== i.property) && <div className="label" style={{ marginTop: 10, color: 'var(--copper-ink)' }}>No. {i.property || '—'}</div>}{row(i.id, i.code, i.description, `${i.room}${i.workstream ? ` · ${i.workstream}` : ''} · ${qtyText(i.qty!)} ${i.unit} @ ${money(i.rate!)}`, lineValue(i.qty, i.rate), onRemoveScope && (() => onRemoveScope(i)))}</div>)}
      {o.length > 0 && <div className="label" style={{ marginTop: 12 }}>Variations</div>}
      {o.map(v => row(v.id, voRef(v.number) + (v.clientRef ? ` · ${v.clientRef}` : ''), v.description, `${v.room} · ${qtyText(v.qty!)} ${v.unit} @ ${money(v.rate!)}`, lineValue(v.qty, v.rate), onRemoveVo && (() => onRemoveVo(v))))}
    </div>
  )
}

/** Claimed-to-date bar: certified | this valuation | remaining — against contract + priced VOs. */
function Progress({ certified, current, total }: { certified: number; current: number; total: number }) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0)
  return (
    <div className="card-dark">
      <div className="row" style={{ fontSize: 12, color: 'var(--cream-muted)', marginBottom: 8 }}>
        <span className="grow">Claimed to date</span><span className="mono">{Math.round(pct(certified + current))}%</span>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden', background: 'var(--charcoal-line)' }}>
        <div style={{ width: `${pct(certified)}%`, background: 'var(--copper)' }} />
        <div style={{ width: `${pct(current)}%`, background: 'var(--copper-light)', opacity: .7 }} />
      </div>
      <div className="row" style={{ fontSize: 11, marginTop: 8, gap: 14, color: 'var(--cream-muted)', flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--copper)', marginRight: 5 }} />Certified {money(certified)}</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--copper-light)', opacity: .7, marginRight: 5 }} />This valuation {money(current)}</span>
        <span>Remaining {money(Math.max(0, total - certified - current))}</span>
      </div>
    </div>
  )
}

export function ValuationsTab({ job, scope, vos, vals, onRemoveScope, onRemoveVo, onIssue, onDeleteOpen, go, onPaid, onCertificate, onCreateInvoice, onInvoicePdf }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]
  onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
  onIssue: (v: Valuation) => void; onDeleteOpen: (v: Valuation) => void; go: (t: 'scope' | 'vos') => void
  onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>
  onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
}) {
  const [making, setMaking] = useState<string | null>(null)
  const cert = async (v: Valuation) => { setMaking(v.id); try { await onCertificate(v) } finally { setMaking(null) } }
  const [paying, setPaying] = useState<Valuation | null>(null)
  const [confirmIssue, setConfirmIssue] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const sorted = [...vals].sort((a, b) => b.number - a.number)
  const open = sorted.find(v => v.status === 'Open') ?? null
  const issued = sorted.filter(v => v.status === 'Issued')
  const certified = issued.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const current = open ? valTotals(job, open.id, scope, vos) : null
  const f = upliftFactor(job.uplift1, job.uplift2)
  const pricedVos = vos.filter(v => v.status !== 'Rejected').reduce((t, v) => t + lineValue(v.qty, v.rate), 0) * f
  const target = (job.contractValue || scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) * f) + pricedVos
  const nextNo = vals.reduce((m, v) => Math.max(m, v.number), 0) + 1

  return (
    <div className="stack">
      <div className="row"><div className="label bracket grow">Valuations</div>
        <TabMenu title="Valuations" actions={[
          { label: 'Preview certificate', hint: open ? `${valRef(open.number)} as a draft PDF` : 'No open valuation', disabled: !open || !current?.lines, onClick: () => open && cert(open) },
          { label: 'Delete open valuation', hint: open ? `Sends every line in ${valRef(open.number)} back to live` : 'No open valuation', danger: true, disabled: !open,
            confirm: open ? `Delete ${valRef(open.number)}? Its lines go back to live — nothing else is lost.` : '', onClick: () => open && onDeleteOpen(open) },
        ]} />
      </div>
      <Progress certified={certified} current={current?.gross ?? 0} total={target} />

      {open && current ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="ref-roman" style={{ color: 'var(--copper)', fontWeight: 500 }}>{valRef(open.number)}</span>
            <span className="badge b-amber">Open</span><span className="grow" />
            <span className="muted" style={{ fontSize: 12 }}>started {ukDate(open.createdAt)}</span>
          </div>
          <div style={{ marginLeft: '-12%' }}>
            <TitleBlock sheetRef={job.contractRef || valRef(open.number)}
              head={['This valuation (incl. uplifts)', money(current.gross)]}
              rows={[
                [['Scope', money(current.scopeBase)], ['Variations', money(current.voBase), 'var(--copper)']],
                [['Base total', money(current.base)], ['Uplifts', `${job.uplift1}% + ${job.uplift2}%`]],
                [['Previously certified', money(certified)], ['Cumulative', money(certified + current.gross), 'var(--copper)']],
              ]} />
          </div>
          {current.lines === 0 && <div className="muted" style={{ fontSize: 13, padding: '12px 0' }}>Nothing in this valuation yet — tick items in Scope or VOs.</div>}
          <Lines val={open} scope={scope} vos={vos} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />
          <div className="stack" style={{ marginTop: 14 }}>
            {!job.poNumber && <div className="flag">No PO number on this job — add it in job setup before issuing.</div>}
            {current.lines > 0 && <button className="btn btn-secondary" disabled={making === open.id} onClick={() => cert(open)}>{making === open.id ? 'Preparing…' : 'Preview certificate (draft)'}</button>}
            {confirmIssue ? (
              <>
                <div style={{ fontSize: 13 }}>Issuing locks every line in {valRef(open.number)}. They can't be unticked afterwards. Next ticks start {valRef(open.number + 1)}.</div>
                <button className="btn btn-primary" onClick={() => { setConfirmIssue(false); onIssue(open) }}>Issue {valRef(open.number)} for {money(current.gross)}</button>
                <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setConfirmIssue(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-primary" disabled={current.lines === 0} onClick={() => setConfirmIssue(true)}>Issue {valRef(open.number)}</button>
            )}
            {confirmDelete
              ? <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={() => { setConfirmDelete(false); onDeleteOpen(open) }}>Delete {valRef(open.number)} — send all lines back to live</button>
              : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => setConfirmDelete(true)}>Delete this valuation…</button>}
          </div>
        </div>
      ) : (
        <div className="card empty">
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No open valuation</div>
          Tick completed items in <a onClick={() => go('scope')} style={{ color: 'var(--copper)', cursor: 'pointer' }}>Scope</a> or priced <a onClick={() => go('vos')} style={{ color: 'var(--copper)', cursor: 'pointer' }}>VOs</a> to start {valRef(nextNo)}.
        </div>
      )}

      {issued.length > 0 && <div className="label" style={{ marginTop: 8 }}>Issued</div>}
      {issued.map(v => {
        const t = valTotals(job, v.id, scope, vos)
        return (
          <div key={v.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
            <div className="row">
              <span className="ref-roman" style={{ color: 'var(--copper)', fontWeight: 500 }}>{valRef(v.number)}</span>
              <span className="badge b-slate">🔒 Issued</span>
              <span className="grow muted" style={{ fontSize: 12 }}>{v.issuedAt ? ukDate(v.issuedAt) : ''}</span>
              <span className="mono">{money(t.gross)}</span>
            </div>
            <div style={{ marginTop: 6 }}><CourtLine c={valCourt(v, job, scope, vos)} /></div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.lines} line{t.lines === 1 ? '' : 's'} · base {money(t.base)} · tap to {expanded === v.id ? 'hide' : 'show'}</div>
            {v.invoiceNumber
              ? <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  <span className="grow" style={{ fontSize: 13 }}>Invoice <b className="mono" style={{ color: 'var(--copper-ink)' }}>{v.invoiceNumber}</b> · {money(invoiceAmounts(job, v, scope, vos).total)} incl. VAT</span>
                  <button className="btn btn-primary" style={{ minHeight: 42, width: 'auto', padding: '0 16px' }} disabled={making === 'inv' + v.id} onClick={async e => { e.stopPropagation(); setMaking('inv' + v.id); try { await onInvoicePdf(v) } finally { setMaking(null) } }}>{making === 'inv' + v.id ? 'Preparing…' : 'Invoice PDF'}</button>
                </div>
              : <button className="btn btn-primary" style={{ marginTop: 10, minHeight: 44 }} onClick={e => { e.stopPropagation(); onCreateInvoice(v) }}>Create invoice</button>}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" style={{ minHeight: 44, flex: 1 }} disabled={making === v.id} onClick={e => { e.stopPropagation(); cert(v) }}>{making === v.id ? 'Preparing…' : 'Certificate PDF'}</button>
              <button className="btn btn-secondary" style={{ minHeight: 44, flex: 1 }} onClick={e => { e.stopPropagation(); setPaying(v) }}>{v.paidAt ? 'Edit payment' : 'Mark as paid'}</button>
            </div>
            {expanded === v.id && <Lines val={v} scope={scope} vos={vos} />}
          </div>
        )
      })}
      {paying && <PaidSheet v={paying} gross={paying.invoiceNumber ? invoiceAmounts(job, paying, scope, vos).total : valTotals(job, paying.id, scope, vos).gross} onClose={() => setPaying(null)} onSave={x => { onPaid(x); setPaying(null) }} />}
    </div>
  )
}

function PaidSheet({ v, gross, onSave, onClose }: { v: Valuation; gross: number; onSave: (v: Valuation) => void; onClose: () => void }) {
  const toKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const [date, setDate] = useState(toKey(v.paidAt ?? Date.now()))
  const [amount, setAmount] = useState(String(v.paidAmount ?? Math.round(gross * 100) / 100))
  const n = parseFloat(amount.replace(/[£,\s]/g, ''))
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">Payment · {valRef(v.number)}</div>
        <div className="muted" style={{ fontSize: 13 }}>{v.invoiceNumber ? `Invoice ${v.invoiceNumber}: ${money(gross)} incl. VAT.` : `Certified ${money(gross)}.`} Enter what actually landed — a part payment leaves the rest showing as owed.</div>
        <Field label="Date received"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount received (£)"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        {isFinite(n) && n < gross - 0.005 && <div className="flag">{money(gross - n)} will still show as owed</div>}
        <button className="btn btn-primary" disabled={!date || !isFinite(n) || n <= 0} onClick={() => { const [y, m, d] = date.split('-').map(Number); onSave({ ...v, paidAt: new Date(y, m - 1, d, 12).getTime(), paidAmount: Math.round(n * 100) / 100 }) }}>Save payment</button>
        {v.paidAt && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...v, paidAt: null, paidAmount: null })}>Remove payment (not paid)</button>}
      </div>
    </Sheet>
  )
}
