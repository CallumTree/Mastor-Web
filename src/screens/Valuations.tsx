import { useState } from 'react'
import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { TitleBlock } from '../components/Ui'
import { money, qtyText, ukDate, upliftFactor, voRef } from '../lib/format'
import { lineValue, valRef, valTotals } from '../lib/valuation'

function Lines({ val, scope, vos, onRemoveScope, onRemoveVo }: {
  val: Valuation; scope: ScopeItem[]; vos: Variation[]
  onRemoveScope?: (i: ScopeItem) => void; onRemoveVo?: (v: Variation) => void
}) {
  const s = scope.filter(x => x.valuationId === val.id).sort((a, b) => a.room.localeCompare(b.room) || a.order - b.order)
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
      {s.map(i => row(i.id, i.code, i.description, `${i.room} · ${qtyText(i.qty!)} ${i.unit} @ ${money(i.rate!)}`, lineValue(i.qty, i.rate), onRemoveScope && (() => onRemoveScope(i))))}
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

export function ValuationsTab({ job, scope, vos, vals, onRemoveScope, onRemoveVo, onIssue, onDeleteOpen, go }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]
  onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
  onIssue: (v: Valuation) => void; onDeleteOpen: (v: Valuation) => void; go: (t: 'scope' | 'vos') => void
}) {
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
      <div className="label bracket">Valuations</div>
      <Progress certified={certified} current={current?.gross ?? 0} total={target} />

      {open && current ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="mono" style={{ color: 'var(--copper)', fontWeight: 500 }}>{valRef(open.number)}</span>
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
              <span className="mono" style={{ color: 'var(--copper)', fontWeight: 500 }}>{valRef(v.number)}</span>
              <span className="badge b-slate">🔒 Issued</span>
              <span className="grow muted" style={{ fontSize: 12 }}>{v.issuedAt ? ukDate(v.issuedAt) : ''}</span>
              <span className="mono">{money(t.gross)}</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.lines} line{t.lines === 1 ? '' : 's'} · base {money(t.base)} · tap to {expanded === v.id ? 'hide' : 'show'}</div>
            {expanded === v.id && <Lines val={v} scope={scope} vos={vos} />}
          </div>
        )
      })}
    </div>
  )
}
