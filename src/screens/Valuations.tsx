import { useState } from 'react'
import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { IconLock } from '../components/Icons'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { money, qtyText, ukDate, upliftFactor, voRef } from '../lib/format'
import { lineValue, valRef, valTotals } from '../lib/valuation'
import { CourtLine, valCourt } from '../lib/chase'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
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
    <div key={key} className="row val-line" style={{ padding: '10px 0', borderTop: '1px solid var(--cream-line)', alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>{ref && <span className="mono" style={{ color: 'var(--copper-ink)', fontSize: 12 }}>{ref}</span>}</div>
        <div style={{ fontWeight: 500 }}>{desc}</div>
        <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      </div>
      <div className="amt" style={{ fontSize: 14, flex: 'none', whiteSpace: 'nowrap' }}>{money(value)}</div>
      {onRemove && <button className="icon-btn" onClick={onRemove} aria-label="Remove from valuation" style={{ color: 'var(--ink-muted)', fontSize: 20 }}>×</button>}
    </div>
  )
  return (
    <div>
      {s.length > 0 && <div className="label" style={{ marginTop: 8 }}>Scope</div>}
      {s.map((i, n) => <div key={i.id}>{byProp && (n === 0 || s[n - 1].property !== i.property) && <div className="label" style={{ marginTop: 10, color: 'var(--copper-ink)' }}>No. {i.property || '—'}</div>}{row(i.id, i.code, i.description, `${i.room}${i.workstream ? ` · ${i.workstream}` : ''} · ${qtyText(i.qty!)} ${i.unit} @ ${money(i.rate!)}`, lineValue(i.qty, i.rate), onRemoveScope && (() => onRemoveScope(i)))}</div>)}
      {o.length > 0 && <div className="label" style={{ marginTop: 12 }}>Variations</div>}
      {o.map(v => row(v.id, voRef(v.number) + (v.clientRef ? ` · council ${v.clientRef}` : ''), v.description, `${v.room} · ${qtyText(v.qty!)} ${v.unit} @ ${money(v.rate!)}`, lineValue(v.qty, v.rate), onRemoveVo && (() => onRemoveVo(v))))}
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
  const [expandedPick, setExpanded] = useState<string | null | undefined>(undefined) // undefined = newest issued open by default
  const [showLines, setShowLines] = useState<string | null>(null)
  const sorted = [...vals].sort((a, b) => b.number - a.number)
  const open = sorted.find(v => v.status === 'Open') ?? null
  const issued = sorted.filter(v => v.status === 'Issued')
  const certified = issued.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const current = open ? valTotals(job, open.id, scope, vos) : null
  const f = upliftFactor(job.uplift1, job.uplift2)
  const pricedVos = vos.filter(v => v.status !== 'Rejected').reduce((t, v) => t + lineValue(v.qty, v.rate), 0) * f
  const target = (job.contractValue || scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) * f) + pricedVos
  const nextNo = vals.reduce((m, v) => Math.max(m, v.number), 0) + 1
  const expanded = expandedPick === undefined ? issued[0]?.id ?? null : expandedPick
  const courts = new Map(issued.map(v => [v.id, valCourt(v, job, scope, vos)]))
  const paid = issued.reduce((t, v) => t + (v.paidAmount ?? 0), 0)
  const owed = issued.reduce((t, v) => t + (courts.get(v.id)?.owed ?? 0), 0)
  const overdue = issued.filter(v => courts.get(v.id)?.tone === 'late').length
  const pct = target > 0 ? Math.round(((certified + (current?.gross ?? 0)) / target) * 100) : 0

  return (
    <div className="stack">
      <TabHead label="Valuations" menu={<TabMenu title="Valuations" actions={[
          { label: 'Preview certificate', hint: open ? `${valRef(open.number)} as a draft PDF` : 'No open valuation', disabled: !open || !current?.lines, onClick: () => open && cert(open) },
          { label: 'Delete open valuation', hint: open ? `Sends every line in ${valRef(open.number)} back to live` : 'No open valuation', danger: true, disabled: !open,
            confirm: open ? `Delete ${valRef(open.number)}? Its lines go back to live — nothing else is lost.` : '', onClick: () => open && onDeleteOpen(open) },
        ]} />} />
      <SumStrip label="Valuation summary" progress={pct} cells={[
        { label: 'Contract + VOs', value: money(target), note: `${pct}% claimed incl. this valuation` },
        { label: 'Certified', value: money(certified), note: `${issued.length} valuation${issued.length === 1 ? '' : 's'} issued`, nil: !issued.length },
        { label: 'Paid', value: money(paid), note: 'as received', nil: !paid },
        { label: 'Owed', value: money(owed), note: overdue ? `${overdue} overdue` : 'incl. VAT once invoiced', hot: owed > 0, nil: !owed },
      ]} />

      {open && current ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="ref-roman" style={{ color: 'var(--copper-ink)', fontWeight: 500 }}>{valRef(open.number)}</span>
            <span className="badge b-amber">Open</span><span className="grow" />
            <span className="muted" style={{ fontSize: 12 }}>started {ukDate(open.createdAt)}</span>
          </div>
          <SumStrip label={`${valRef(open.number)} figures`} cells={[
            { label: 'This valuation', value: money(current.gross), note: 'incl. uplifts, excl. VAT', hot: true },
            { label: 'Cumulative', value: money(certified + current.gross), note: `${money(certified)} previously certified` },
            { label: 'Scope', value: money(current.scopeBase), note: 'base rates', nil: !current.scopeBase },
            { label: 'Variations', value: money(current.voBase), note: 'base rates', nil: !current.voBase },
            { label: 'Base total', value: money(current.base) },
            { label: 'Uplifts', value: `${job.uplift1}% + ${job.uplift2}%` },
          ]} />
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
            <ConfirmDelete label="Delete this valuation…" confirmLabel={<>Delete {valRef(open.number)}</>} note={`Every line in ${valRef(open.number)} goes back to live. Nothing else is lost.`} onConfirm={() => onDeleteOpen(open)} />
          </div>
        </div>
      ) : (
        <div className="card empty">
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No open valuation</div>
          Tick completed items in <button className="linkish tap" style={{ color: 'var(--copper-ink)' }} onClick={() => go('scope')}>Scope</button> or priced <button className="linkish tap" style={{ color: 'var(--copper-ink)' }} onClick={() => go('vos')}>VOs</button> to start {valRef(nextNo)}.
        </div>
      )}

      {issued.length > 0 && (
        <div className="card vo-list">
          <div className="vo-head"><span>Val</span><span>Issued · status</span><span>Value</span></div>
          {issued.map(v => {
            const t = valTotals(job, v.id, scope, vos)
            const isOpen = expanded === v.id
            return (
              <div key={v.id} className={'vo-row-wrap' + (isOpen ? ' open' : '')}>
                <div className="vo-row has-hit">
                  <RowHit label={`${valRef(v.number)}, issued${v.issuedAt ? ' ' + ukDate(v.issuedAt) : ''} — ${isOpen ? 'hide' : 'show'} actions`} expanded={isOpen} onClick={() => setExpanded(isOpen ? null : v.id)} />
                  <div className="vo-ref"><span className="ref-roman">{valRef(v.number)}</span><small><IconLock size={12} /> Issued</small></div>
                  <div className="vo-main">
                    <div className="vo-desc">{v.issuedAt ? ukDate(v.issuedAt) : 'Issued'}</div>
                    <div className="vo-meta">{t.lines} line{t.lines === 1 ? '' : 's'} · base {money(t.base)}</div>
                    {v.invoiceNumber && <div className="vo-meta">Invoice <span className="vo-cref mono">{v.invoiceNumber}</span> · {money(invoiceAmounts(job, v, scope, vos).total)} incl. VAT</div>}
                    <div className="vo-status"><CourtLine c={courts.get(v.id)!} /></div>
                  </div>
                  <div className="vo-amt"><span className="mono">{money(t.gross)}</span><span className="prop-chev" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}>▸</span></div>
                </div>
                {isOpen && (
                  <div className="vo-actions" onClick={e => e.stopPropagation()}>
                    {v.invoiceNumber
                      ? <button className="btn btn-secondary" disabled={making === 'inv' + v.id} onClick={async () => { setMaking('inv' + v.id); try { await onInvoicePdf(v) } finally { setMaking(null) } }}>{making === 'inv' + v.id ? 'Preparing…' : 'Invoice PDF'}</button>
                      : <button className="btn btn-primary" onClick={() => onCreateInvoice(v)}>Create invoice</button>}
                    <div className="row">
                      <button className="btn btn-secondary" style={{ flex: 1 }} disabled={making === v.id} onClick={() => cert(v)}>{making === v.id ? 'Preparing…' : 'Certificate PDF'}</button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPaying(v)}>{v.paidAt ? 'Edit payment' : 'Mark as paid'}</button>
                    </div>
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowLines(showLines === v.id ? null : v.id)}>{showLines === v.id ? 'Hide lines' : `Show ${t.lines} line${t.lines === 1 ? '' : 's'}`}</button>
                    {showLines === v.id && <Lines val={v} scope={scope} vos={vos} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {paying && <PaidSheet v={paying} gross={paying.invoiceNumber ? invoiceAmounts(job, paying, scope, vos).total : valTotals(job, paying.id, scope, vos).gross} onClose={() => setPaying(null)} onSave={x => { onPaid(x); setPaying(null) }} />}
    </div>
  )
}

function PaidSheet({ v, gross, onSave, onClose }: { v: Valuation; gross: number; onSave: (v: Valuation) => void; onClose: () => void }) {
  const toKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const [date, setDate] = useState(toKey(v.paidAt ?? Date.now()))
  // Blank until you say what landed — never assume it was paid in full
  const [amount, setAmount] = useState(v.paidAmount != null ? String(v.paidAmount) : '')
  const full = (Math.round(gross * 100) / 100).toFixed(2)
  const n = parseFloat(amount.replace(/[£,\s]/g, ''))
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">Payment · {valRef(v.number)}</div>
        <div className="muted" style={{ fontSize: 13 }}>{v.invoiceNumber ? `Invoice ${v.invoiceNumber}: ${money(gross)} incl. VAT.` : `Certified ${money(gross)}.`} Enter what actually landed — a part payment leaves the rest showing as owed.</div>
        <Field label="Date received"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount received (£)"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="As on the remittance" /></Field>
        {amount !== full && <div className="chips"><button className="chip" onClick={() => setAmount(full)}>Paid in full · {money(gross)}</button></div>}
        {isFinite(n) && n < gross - 0.005 && <div className="flag">{money(gross - n)} will still show as owed</div>}
        <button className="btn btn-primary" disabled={!date || !isFinite(n) || n <= 0} onClick={() => { const [y, m, d] = date.split('-').map(Number); onSave({ ...v, paidAt: new Date(y, m - 1, d, 12).getTime(), paidAmount: Math.round(n * 100) / 100 }) }}>Save payment</button>
        {v.paidAt && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...v, paidAt: null, paidAmount: null })}>Remove payment (not paid)</button>}
      </div>
    </Sheet>
  )
}
