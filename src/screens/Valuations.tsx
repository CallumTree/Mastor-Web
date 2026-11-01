import { useState } from 'react'
import type { DiaryEntry, Job, ScopeItem, SiteSuggestion, Valuation, Variation } from '../lib/types'
import { SiteReview } from './SiteReview'
import { IconChevron, IconLock } from '../components/Icons'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { money, qtyText, ukDate, upliftFactor, voRef } from '../lib/format'
import { amending, askChanges, issuePlan, lineValue, markAgreed, reviewStage, valRef, valTotals } from '../lib/valuation'
import { valRhythm, waitAMonth, weekText, VAL_MIN_DAYS } from '../lib/rhythm'
import { shortDay } from '../lib/plan'
import { dayKey } from '../lib/dates'
import { ByClaude, Plate } from '../components/Sign'
import { TradeMark } from '../components/Trade'
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
  const open = val.status === 'Open' || amending(val)   // Claude's marks matter while the valuation can still change
  const row = (key: string, ref: string, desc: string, sub: React.ReactNode, value: number, onRemove?: () => void, claude?: number | null) => (
    <div key={key} className="row val-line" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>{ref && <span className="mono t-small slate">{ref}</span>}{open && <ByClaude at={claude} />}</div>
        <div style={{ fontWeight: 500 }}>{desc}</div>
        <div className="hint">{sub}</div>
      </div>
      <div className="amt t-note" style={{ flex: 'none', whiteSpace: 'nowrap' }}>{money(value)}</div>
      {onRemove && <button className="icon-btn" onClick={onRemove} aria-label="Remove from valuation" style={{ color: 'var(--ink-muted)', fontSize: 20 }}>×</button>}
    </div>
  )
  return (
    <div>
      {s.length > 0 && !byProp && <h3 className="label" style={{ marginTop: 8 }}>Scope</h3>}
      {s.map((i, n) => <div key={i.id}>{byProp && (n === 0 || s[n - 1].property !== i.property) && <h3 className="label" style={{ marginTop: 10 }}>Scope · No. {i.property || '—'}</h3>}{row(i.id, i.code, i.description, <>{i.workstream && <><TradeMark name={i.workstream} />{i.workstream}{i.room && i.room !== i.workstream ? ` · ${i.room}` : ''}</>}{!i.workstream && i.room} · {qtyText(i.qty!)} {i.unit} @ {money(i.rate!)}</>, lineValue(i.qty, i.rate), onRemoveScope && (() => onRemoveScope(i)), i.byClaude)}</div>)}
      {o.length > 0 && <h3 className="label" style={{ marginTop: 12 }}>Variations</h3>}
      {o.map(v => row(v.id, voRef(v.number) + (v.clientRef ? ` · council ${v.clientRef}` : ''), v.description, `${v.room} · ${qtyText(v.qty!)} ${v.unit} @ ${money(v.rate!)}`, lineValue(v.qty, v.rate), onRemoveVo && (() => onRemoveVo(v)), v.byClaude))}
    </div>
  )
}

export function ValuationsTab({ job, scope, vos, vals, onRemoveScope, onRemoveVo, onIssue, onDeleteOpen, go, onPaid, onCertificate, onCreateInvoice, onInvoicePdf, diary = [], onDecideSite, onReview, onUpdateJob }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]
  onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
  onIssue: (v: Valuation) => Promise<Valuation>; onDeleteOpen: (v: Valuation) => void; go: (t: 'scope' | 'vos') => void
  onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>
  onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
  diary?: DiaryEntry[]; onDecideSite?: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>
  /** the client's answer on a sent valuation (agreed, or changes asked — with a note for the record) */
  onReview: (v: Valuation, note?: string) => void
  onUpdateJob: (j: Job) => void
}) {
  const [making, setMaking] = useState<string | null>(null)
  const cert = async (v: Valuation) => { setMaking(v.id); try { await onCertificate(v) } finally { setMaking(null) } }
  const [paying, setPaying] = useState<Valuation | null>(null)
  const [issuing, setIssuing] = useState<Valuation | null>(null)
  const [expandedPick, setExpanded] = useState<string | null | undefined>(undefined) // undefined = newest issued open by default
  const [showLines, setShowLines] = useState<string | null>(null)
  const [changing, setChanging] = useState<Valuation | null>(null)
  const sorted = [...vals].sort((a, b) => b.number - a.number)
  const open = sorted.find(v => v.status === 'Open') ?? null
  const fixing = sorted.find(amending) ?? null   // sent, and the client asked for changes
  const issued = sorted.filter(v => v.status === 'Issued')
  const sent = issued.filter(v => v !== fixing)
  const rhythm = valRhythm(job, vals, { diary })
  const certified = issued.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const current = open ? valTotals(job, open.id, scope, vos) : null
  const f = upliftFactor(job.uplift1, job.uplift2)
  const pricedVos = vos.filter(v => v.status !== 'Rejected').reduce((t, v) => t + lineValue(v.qty, v.rate), 0) * f
  const target = (job.contractValue || scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) * f) + pricedVos
  const nextNo = vals.reduce((m, v) => Math.max(m, v.number), 0) + 1
  const expanded = expandedPick === undefined ? sent[0]?.id ?? null : expandedPick
  const courts = new Map(issued.map(v => [v.id, valCourt(v, job, scope, vos)]))
  const paid = issued.reduce((t, v) => t + (v.paidAmount ?? 0), 0)
  const owed = issued.reduce((t, v) => t + (courts.get(v.id)?.owed ?? 0), 0)
  const overdue = issued.filter(v => courts.get(v.id)?.tone === 'late' && !courts.get(v.id)?.review).length
  const pct = target > 0 ? Math.round(((certified + (current?.gross ?? 0)) / target) * 100) : 0

  return (
    <div className="stack">
      <TabHead label="Valuations" menu={<TabMenu title="Valuations" actions={[
          { label: 'Preview certificate', hint: open ? `${valRef(open.number)} as a draft PDF` : 'No open valuation', disabled: !open || !current?.lines, onClick: () => open && cert(open) },
          { label: 'Delete open valuation', hint: open ? `Sends every line in ${valRef(open.number)} back to live` : 'No open valuation', danger: true, disabled: !open,
            confirm: open ? `Delete ${valRef(open.number)}? Its lines go back to live — nothing else is lost.` : '', onClick: () => open && onDeleteOpen(open) },
        ]} />} />
      <SumStrip label="Valuation summary" progress={pct} cells={[
        { label: 'Contract + VOs', value: money(target), nil: !target, note: target ? `${pct}% claimed incl. this valuation` : 'No contract value yet — add it in job setup' },
        { label: 'Certified', value: money(certified), note: `${issued.length} valuation${issued.length === 1 ? '' : 's'} sent`, nil: !issued.length },
        { label: 'Paid', value: money(paid), note: 'as received', nil: !paid },
        { label: 'Owed', value: money(owed), note: overdue ? `${overdue} overdue` : 'incl. VAT once invoiced', hot: owed > 0 && !open && !fixing, nil: !owed },
      ]} />

      {rhythm && <ValWeek rhythm={rhythm} onWait={() => onUpdateJob(waitAMonth(job, rhythm))} onUndo={() => onUpdateJob({ ...job, valWait: null })} />}

      {fixing && <Working job={job} val={fixing} scope={scope} vos={vos} certified={certified - valTotals(job, fixing.id, scope, vos).gross} making={making} hot
        onCert={() => cert(fixing)} onSend={() => setIssuing(fixing)} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />}

      {onDecideSite && <SiteReview diary={diary} scope={scope} valLabel={valRef(open?.number ?? nextNo)} onDecide={onDecideSite} />}

      {open && current ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="ref-roman" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{valRef(open.number)}</span>
            <span className="badge b-volt">Open</span><span className="grow" />
            <span className="hint">{rhythm ? (rhythm.state === 'due' ? 'due this week' : rhythm.state === 'late' ? `was due ${weekText(rhythm)}` : `goes in ${weekText(rhythm)}`) : `started ${ukDate(open.createdAt)}`}</span>
          </div>
          <SumStrip label={`${valRef(open.number)} figures`} cells={[
            { label: 'This valuation', value: money(current.gross), note: 'incl. uplifts, excl. VAT', hot: !fixing },
            { label: 'Cumulative', value: money(certified + current.gross), note: `${money(certified)} previously certified` },
          ]} />
          {current.lines > 0 && <div className="val-build">
            {current.voBase ? <>{money(current.scopeBase)} scope + {money(current.voBase)} VOs = <b>{money(current.base)}</b> at base rates</> : <><b>{money(current.base)}</b> scope at base rates</>}
            {(job.uplift1 || job.uplift2) ? <>, plus uplifts of {job.uplift1}%{job.uplift2 ? <>&nbsp;+&nbsp;{job.uplift2}%</> : null}</> : null}
          </div>}
          {current.lines === 0 && <div className="hint" style={{ padding: '12px 0' }}>Nothing in this valuation yet — tick items in Scope or VOs.</div>}
          <Lines val={open} scope={scope} vos={vos} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />
          <div className="stack" style={{ marginTop: 14 }}>
            {!job.poNumber && <div className="flag">No PO number on this job — add it in job setup before sending.</div>}
            {current.lines > 0 && <button className="btn btn-secondary" disabled={making === open.id} onClick={() => cert(open)}>{making === open.id ? 'Preparing…' : 'Preview certificate (draft)'}</button>}
            <button className="btn btn-primary" disabled={current.lines === 0} onClick={() => setIssuing(open)}>Send {valRef(open.number)} for review</button>
            <ConfirmDelete label="Delete this valuation…" confirmLabel={<>Delete {valRef(open.number)}</>} note={`Every line in ${valRef(open.number)} goes back to live. Nothing else is lost.`} onConfirm={() => onDeleteOpen(open)} />
          </div>
        </div>
      ) : fixing ? null : (
        <div className="card empty">
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No open valuation</div>
          Tick completed items in <button className="linkish tap slate" onClick={() => go('scope')}>Scope</button> or priced <button className="linkish tap slate" onClick={() => go('vos')}>VOs</button> to start {valRef(nextNo)}.
        </div>
      )}

      {sent.length > 0 && (
        <div className="card vo-list">
          <div className="vo-head"><span>Val</span><span>Sent · status</span><span>Value</span></div>
          {sent.map(v => {
            const t = valTotals(job, v.id, scope, vos)
            const isOpen = expanded === v.id
            const stage = reviewStage(v)
            const word = !v.review ? 'Issued' : stage === 'review' ? 'Sent' : 'Agreed'
            return (
              <div key={v.id} className={'vo-row-wrap' + (isOpen ? ' open' : '')}>
                <div className="vo-row has-hit">
                  <RowHit label={`${valRef(v.number)}, sent${v.issuedAt ? ' ' + ukDate(v.issuedAt) : ''} — ${isOpen ? 'hide' : 'show'} actions`} expanded={isOpen} onClick={() => setExpanded(isOpen ? null : v.id)} />
                  <div className="vo-ref"><span className="ref-roman">{valRef(v.number)}</span><small><IconLock size={12} /> {word}</small></div>
                  <div className="vo-main">
                    <div className="vo-desc">{v.issuedAt ? ukDate(v.issuedAt) : 'Sent'}</div>
                    <div className="vo-meta">{t.lines} line{t.lines === 1 ? '' : 's'} · base {money(t.base)}</div>
                    {v.invoiceNumber && <div className="vo-meta">Invoice <span className="vo-cref mono">{v.invoiceNumber}</span> · {money(invoiceAmounts(job, v, scope, vos).total)} incl. VAT</div>}
                    <div className="vo-status"><CourtLine c={courts.get(v.id)!} /></div>
                  </div>
                  <div className="vo-amt"><span className="mono">{money(t.gross)}</span><span className="prop-chev" aria-hidden="true" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}><IconChevron size={16} /></span></div>
                </div>
                {isOpen && (
                  <div className="vo-actions" onClick={e => e.stopPropagation()}>
                    {stage === 'review' ? <>
                      <button className="btn btn-primary" onClick={() => onReview(markAgreed(v))}>Client agreed</button>
                      <div className="row">
                        <button className="btn btn-secondary" style={{ flex: 1 }} aria-label="Client wants changes" onClick={() => setChanging(v)}>Wants changes</button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} disabled={making === v.id} onClick={() => cert(v)}>{making === v.id ? 'Preparing…' : 'Certificate PDF'}</button>
                      </div>
                    </> : <>
                      {v.invoiceNumber
                        ? <button className="btn btn-secondary" disabled={making === 'inv' + v.id} onClick={async () => { setMaking('inv' + v.id); try { await onInvoicePdf(v) } finally { setMaking(null) } }}>{making === 'inv' + v.id ? 'Preparing…' : 'Invoice PDF'}</button>
                        : <button className="btn btn-primary" onClick={() => onCreateInvoice(v)}>Create invoice</button>}
                      <div className="row">
                        <button className="btn btn-secondary" style={{ flex: 1 }} disabled={making === v.id} onClick={() => cert(v)}>{making === v.id ? 'Preparing…' : 'Certificate PDF'}</button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPaying(v)}>{v.paidAt ? 'Edit payment' : 'Mark as paid'}</button>
                      </div>
                      {v.review && !v.invoiceNumber && !v.paidAt && <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setChanging(v)}>Client wants changes after all</button>}
                    </>}
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowLines(showLines === v.id ? null : v.id)}>{showLines === v.id ? 'Hide lines' : `Show ${t.lines} line${t.lines === 1 ? '' : 's'}`}</button>
                    {showLines === v.id && <Lines val={v} scope={scope} vos={vos} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {issuing && <IssueSheet job={job} val={issuing} vals={vals} scope={scope} vos={vos} onIssue={onIssue} onCertificate={onCertificate}
        onAgreed={v => { setIssuing(null); const a = markAgreed(v); onReview(a); onCreateInvoice(a) }} onClose={() => setIssuing(null)} />}
      {changing && <ChangesSheet val={changing} onClose={() => setChanging(null)} onSave={text => {
        setChanging(null)
        onReview(askChanges(changing, text), `${valRef(changing.number)}: the client asked for changes${text.trim() ? ` — ${text.trim()}` : ''}`)
      }} />}
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
        <h2 className="label bracket">Payment · {valRef(v.number)}</h2>
        <div className="hint">{v.invoiceNumber ? `Invoice ${v.invoiceNumber}: ${money(gross)} incl. VAT.` : `Certified ${money(gross)}.`} Enter what actually landed — a part payment leaves the rest showing as owed.</div>
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

/**
 * Sending a valuation for the client's review: what it certifies (by property or trade, uplifts, running
 * total), what their QS would query, a draft certificate to look at. Sent, it's locked while they review it;
 * the certificate goes to them, and once they agree the invoice is next. Sent again after changes, the same.
 */
function IssueSheet({ job, val, vals, scope, vos, onIssue, onCertificate, onAgreed, onClose }: {
  job: Job; val: Valuation; vals: Valuation[]; scope: ScopeItem[]; vos: Variation[]
  onIssue: (v: Valuation) => Promise<Valuation>; onCertificate: (v: Valuation) => Promise<void>; onAgreed: (v: Valuation) => void; onClose: () => void
}) {
  const [done, setDone] = useState<Valuation | null>(null)
  const [busy, setBusy] = useState<'issue' | 'cert' | null>(null)
  const p = issuePlan(job, val, vals, scope, vos)
  const ref = valRef(val.number)
  const again = amending(val)
  const cert = async (v: Valuation) => { setBusy('cert'); try { await onCertificate(v) } finally { setBusy(null) } }
  if (done) return (
    <Sheet onClose={onClose} label={`${ref} sent`}>
      <div className="stack">
        <h2 className="label bracket">{ref} · sent for review</h2>
        <Plate kind="ok">{ref} sent{again ? ' again' : ''} for {money(p.totals.gross)} — locked</Plate>
        <div className="muted t-note">{p.totals.lines} line{p.totals.lines === 1 ? '' : 's'}. {money(p.cumulative)} claimed to date{p.pct != null ? ` (${p.pct}% of contract and VOs)` : ''}. Send the certificate to the client. When they agree, mark it agreed; if they ask for changes, you can open it again.{again ? '' : ` Next ticks start ${valRef(val.number + 1)}.`}</div>
        <button className="btn btn-primary" disabled={busy === 'cert'} onClick={() => cert(done)}>{busy === 'cert' ? 'Preparing…' : 'Certificate PDF'}</button>
        <button className="btn btn-secondary" onClick={() => onAgreed(done)}>Already agreed — create invoice</button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Done</button>
      </div>
    </Sheet>
  )
  return (
    <Sheet onClose={onClose} locked={busy === 'issue'} label={again ? `Send ${ref} again` : `Send ${ref} for review`}>
      <div className="stack">
        <h2 className="label bracket">{again ? `Send ${ref} again` : `Send ${ref} for review`}</h2>
        <div className="panel">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="grow"><div className="label">This valuation</div><div className="amt" style={{ fontSize: 28, fontWeight: 700 }}>{money(p.totals.gross)}</div></div>
            <div style={{ textAlign: 'right' }}><div className="label">Lines</div><div className="amt" style={{ fontSize: 22, fontWeight: 700 }}>{p.totals.lines}</div></div>
          </div>
          <div className="hint">incl. uplifts, excl. VAT{job.poNumber ? ` · PO ${job.poNumber}` : ''}</div>
          <div className="issue-table t-note" style={{ marginTop: 10 }}>
            {p.groups.map(g => <div key={g.name} className="row"><span className="grow">{g.name} <small className="hint">· {g.lines} line{g.lines === 1 ? '' : 's'}</small></span><span className="amt">{money(g.base)}</span></div>)}
            <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 4, marginTop: 4 }}><span className="grow">Base</span><span className="amt">{money(p.totals.base)}</span></div>
            {p.u1 !== 0 && <div className="row"><span className="grow">Uplift 1 · {job.uplift1}%</span><span className="amt">{money(p.u1)}</span></div>}
            {p.u2 !== 0 && <div className="row"><span className="grow">Uplift 2 · {job.uplift2}%</span><span className="amt">{money(p.u2)}</span></div>}
            <div className="row" style={{ fontWeight: 700 }}><span className="grow">This valuation</span><span className="amt">{money(p.totals.gross)}</span></div>
            <div className="row muted"><span className="grow">Previously certified</span><span className="amt">{money(p.previous)}</span></div>
            <div className="row t-strong"><span className="grow">Cumulative{p.pct != null ? ` · ${p.pct}% of contract + VOs` : ''}</span><span className="amt">{money(p.cumulative)}</span></div>
          </div>
        </div>
        {p.checks.map((c, i) => <Plate key={i} kind={c.kind}>{c.text}</Plate>)}
        <button className="btn btn-secondary" disabled={busy !== null} onClick={() => cert(val)}>{busy === 'cert' ? 'Preparing…' : 'Preview certificate (draft)'}</button>
        <div className="hint">Sending locks every line in {ref} while the client reviews it. If they ask for changes, you can open it again to amend.</div>
        <button className="btn btn-primary" disabled={busy !== null} onClick={async () => { setBusy('issue'); try { setDone(await onIssue(val)) } finally { setBusy(null) } }}>Send {ref} for {money(p.totals.gross)}</button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Not yet</button>
      </div>
    </Sheet>
  )
}

/**
 * The valuation week, said plainly: when the last one went, when the next one goes in (the first week of
 * the month), and a way to let a thin month wait for the next.
 */
function ValWeek({ rhythm: r, onWait, onUndo }: { rhythm: NonNullable<ReturnType<typeof valRhythm>>; onWait: () => void; onUndo: () => void }) {
  const day = (t: number) => shortDay(dayKey(new Date(t)))
  const ago = r.last ? Math.floor((Date.now() - r.last.issuedAt!) / 864e5) : 0
  const when = r.state === 'due' ? 'This week' : r.state === 'late' ? `Late · was due ${weekText(r)}` : r.state === 'soon' ? 'Starts in a few days' : r.waited ? 'Moved on a month' : 'First week of the month'
  return (
    <div className={'panel val-week' + (r.state === 'due' || r.state === 'late' ? ' now' : '')} aria-label="Valuation week">
      <div className="val-week-c">
        <div className="label">Last sent</div>
        <div className="val-week-n">{r.last ? <>{valRef(r.last.number)} · {day(r.last.issuedAt!)}</> : 'None yet'}</div>
        <small>{r.last ? (ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`) : 'the first on this job'}</small>
      </div>
      <div className="val-week-c">
        <div className="label">Next</div>
        <div className="val-week-n">{valRef(r.next)} · {weekText(r)}</div>
        <small>{when}</small>
      </div>
      <div className="val-week-f">
        <span className="hint grow">First week of each month. Under {VAL_MIN_DAYS === 14 ? 'two' : VAL_MIN_DAYS / 7} weeks’ work since the last one waits for the next.</span>
        {(r.state === 'due' || r.state === 'late') && <button className="linkish tap t-small" onClick={onWait}>Wait till next month</button>}
        {r.waited && r.state !== 'due' && r.state !== 'late' && <button className="linkish tap t-small" onClick={onUndo}>Undo the wait</button>}
      </div>
    </div>
  )
}

/** A sent valuation the client asked to change: open to amend, with what they asked for, until it's sent again. */
function Working({ job, val, scope, vos, certified, making, hot, onCert, onSend, onRemoveScope, onRemoveVo }: {
  job: Job; val: Valuation; scope: ScopeItem[]; vos: Variation[]; certified: number; making: string | null; hot?: boolean
  onCert: () => void; onSend: () => void; onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
}) {
  const t = valTotals(job, val.id, scope, vos)
  const ref = valRef(val.number)
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="ref-roman" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{ref}</span>
        <span className="badge b-amber">Changes</span><span className="grow" />
        <span className="hint">asked {ukDate(val.review!.changesAt!)}</span>
      </div>
      {val.review?.changes && <blockquote className="val-asked">{val.review.changes}</blockquote>}
      <SumStrip label={`${ref} figures`} cells={[
        { label: 'This valuation', value: money(t.gross), note: 'incl. uplifts, excl. VAT', hot },
        { label: 'Cumulative', value: money(certified + t.gross), note: `${money(certified)} previously` },
      ]} />
      <div className="hint" style={{ margin: '10px 2px' }}>Take out what they won’t agree (it goes back to live), fix quantities in Scope or VOs. Ticks go into {ref} until you send it again.</div>
      <Lines val={val} scope={scope} vos={vos} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />
      <div className="stack" style={{ marginTop: 14 }}>
        <button className="btn btn-secondary" disabled={making === val.id || !t.lines} onClick={onCert}>{making === val.id ? 'Preparing…' : 'Preview certificate (draft)'}</button>
        <button className="btn btn-primary" disabled={!t.lines} onClick={onSend}>Send {ref} again</button>
      </div>
    </div>
  )
}

/** The client asked for changes: say what (it goes on the job's notes), and the valuation opens to amend. */
function ChangesSheet({ val, onSave, onClose }: { val: Valuation; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const ref = valRef(val.number)
  return (
    <Sheet onClose={onClose} label={`${ref} · changes from the client`}>
      <div className="stack">
        <h2 className="label bracket">{ref} · changes from the client</h2>
        <Field label="What did they ask for?"><textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. No. 18 kitchen not finished — take it out; plaster 42 m² not 45" /></Field>
        <div className="hint">{ref} opens to amend. It goes on the job’s notes, so there’s a record of what was asked.</div>
        <button className="btn btn-primary" onClick={() => onSave(text)}>Open {ref} to amend</button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  )
}
