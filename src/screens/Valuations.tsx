import { useState, type ReactNode } from 'react'
import type { DiaryEntry, Job, ScopeItem, SiteSuggestion, Valuation, Variation } from '../lib/types'
import { SiteReview } from './SiteReview'
import { IconChevron, IconLock } from '../components/Icons'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { amending, askChanges, isCertified, isWithClient, issuePlan, jobWorth, lineValue, reviewStage, shareOut, valRef, valTotals } from '../lib/valuation'
import { valRhythm, waitAMonth, weekText, VAL_MIN_DAYS } from '../lib/rhythm'
import { shortDay } from '../lib/plan'
import { dayKey } from '../lib/dates'
import { ByClaude, Plate } from '../components/Sign'
import { TradeMark } from '../components/Trade'
import { CourtLine, valCourt } from '../lib/chase'
import { Field, Sheet } from '../components/Ui'
import { TabMenu } from '../components/TabMenu'
import { invoiceAmounts } from '../lib/invoice'
import { fig, figs } from '../components/Figs'
import { tell } from '../components/Problem'

/** Does this valuation's invoice carry VAT? (A firm that isn't VAT-registered invoices at 0%.) */
const withVat = (v: Valuation) => (v.invoiceVatRate ?? 20) > 0

/** Where a line is, only when it says something: not "Property" (a whole-house line), not its trade again. */
const placeOf = (i: { room?: string | null; workstream?: string | null }) => (i.room && !/^(the )?property$/i.test(i.room.trim()) && i.room !== i.workstream ? i.room : '')

function Lines({ job, val, scope, vos, onRemoveScope, onRemoveVo }: {
  job: Job; val: Valuation; scope: ScopeItem[]; vos: Variation[]
  onRemoveScope?: (i: ScopeItem) => void; onRemoveVo?: (v: Variation) => void
}) {
  const byProp = scope.some(x => x.property)
  const s = scope.filter(x => x.valuationId === val.id).sort((a, b) => byProp ? (a.property ?? '').localeCompare(b.property ?? '', 'en', { numeric: true }) || a.order - b.order : a.room.localeCompare(b.room) || a.order - b.order)
  const o = vos.filter(x => x.valuationId === val.id).sort((a, b) => a.number - b.number)
  const open = val.status === 'Open' || amending(val)   // Claude's marks matter while the valuation can still change
  // each line at its share of the valuation's own total with uplifts, so the lines add up to "This valuation" exactly;
  // the rate stays in the line's small print, and the base build-up is said once, above
  const shares = shareOut(valTotals(job, val.id, scope, vos).gross, [...s, ...o].map(x => lineValue(x.qty, x.rate)))
  const worth = new Map([...s, ...o].map((x, k) => [x.id, shares[k]]))
  const row = (key: string, ref: string, desc: string, sub: React.ReactNode, value: number, onRemove?: () => void, claude?: number | null) => (
    <div key={key} className="row val-line" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>{ref && <span className="mono t-small slate">{ref}</span>}{open && <ByClaude at={claude} />}</div>
        <div style={{ fontWeight: 500 }}>{desc}</div>
        <div className="hint">{typeof sub === 'string' ? figs(sub) : sub}</div>
      </div>
      <div className="amt t-note" style={{ flex: 'none', whiteSpace: 'nowrap' }}>{money(value)}</div>
      {onRemove && <button className="icon-btn" onClick={onRemove} aria-label="Remove from valuation" style={{ color: 'var(--ink-muted)', fontSize: 20 }}>×</button>}
    </div>
  )
  return (
    <div>
      {s.length > 0 && !byProp && <h3 className="label" style={{ marginTop: 8 }}>Scope</h3>}
      {s.map((i, n) => <div key={i.id}>{byProp && (n === 0 || s[n - 1].property !== i.property) && <h3 className="label" style={{ marginTop: 10 }}>Scope · No. {i.property || '—'}</h3>}{row(i.id, i.code, i.description, <>{i.workstream && <><TradeMark name={i.workstream} />{i.workstream}</>}{placeOf(i) && `${i.workstream ? ' · ' : ''}${placeOf(i)}`}{(i.workstream || placeOf(i)) ? ' · ' : ''}{fig(`${qtyText(i.qty!)} ${i.unit}`)} @ {fig(money(i.rate!))}</>, worth.get(i.id) ?? 0, onRemoveScope && (() => onRemoveScope(i)), i.byClaude)}</div>)}
      {o.length > 0 && <h3 className="label" style={{ marginTop: 12 }}>Variations</h3>}
      {o.map(v => row(v.id, voRef(v.number) + (v.clientRef ? ` · council ${v.clientRef}` : ''), v.description, `${placeOf(v) ? `${placeOf(v)} · ` : ''}${qtyText(v.qty!)} ${v.unit} @ ${money(v.rate!)}`, worth.get(v.id) ?? 0, onRemoveVo && (() => onRemoveVo(v)), v.byClaude))}
    </div>
  )
}

export function ValuationsTab({ job, scope, vos, vals, onRemoveScope, onRemoveVo, onIssue, onDeleteOpen, go, onPaid, onCertificate, onCreateInvoice, onInvoicePdf, diary = [], onDecideSite, readNote, onReview, onUpdateJob, onUndoSend }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]
  onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
  onIssue: (v: Valuation) => Promise<Valuation>; onDeleteOpen: (v: Valuation) => void; go: (t: 'scope' | 'vos') => void
  onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>
  onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
  diary?: DiaryEntry[]; onDecideSite?: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>; readNote?: string | null
  /** the client's answer on a sent valuation (agreed, or changes asked — with a note for the record) */
  onReview: (v: Valuation, note?: string) => void
  onUpdateJob: (j: Job) => void
  /** once it's sent and its certificate handed over: offer to take the send back for a few seconds */
  onUndoSend?: (before: Valuation) => void
}) {
  const [making, setMaking] = useState<string | null>(null)
  const cert = async (v: Valuation) => { setMaking(v.id); try { await onCertificate(v) } finally { setMaking(null) } }
  const [paying, setPaying] = useState<Valuation | null>(null)
  const [expandedPick, setExpanded] = useState<string | null | undefined>(undefined) // undefined = newest issued open by default
  const [showLines, setShowLines] = useState<string | null>(null)
  const [changing, setChanging] = useState<Valuation | null>(null)
  const sorted = [...vals].sort((a, b) => b.number - a.number)
  const open = sorted.find(v => v.status === 'Open') ?? null
  const fixing = sorted.find(amending) ?? null   // sent, and the client asked for changes
  const issued = sorted.filter(v => v.status === 'Issued')
  const sent = issued.filter(v => v !== fixing)
  const rhythm = valRhythm(job, vals, { diary })
  // every valuation sent so far (what the next one builds on), and of those, what the client has agreed
  const valued = issued.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const certified = issued.filter(isCertified).reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const withClient = issued.filter(isWithClient)
  const current = open ? valTotals(job, open.id, scope, vos) : null
  const worth = jobWorth(job, scope, vos)
  const pricedVos = worth.vos, target = worth.total
  const nextNo = vals.reduce((m, v) => Math.max(m, v.number), 0) + 1
  const expanded = expandedPick === undefined ? sent[0]?.id ?? null : expandedPick
  const courts = new Map(issued.map(v => [v.id, valCourt(v, job, scope, vos)]))
  const paid = issued.reduce((t, v) => t + (v.paidAmount ?? 0), 0)
  const owed = issued.reduce((t, v) => t + (courts.get(v.id)?.owed ?? 0), 0)
  const overdue = issued.filter(v => courts.get(v.id)?.tone === 'late' && !courts.get(v.id)?.review).length
  const pct = target > 0 ? Math.round(((valued + (current?.gross ?? 0)) / target) * 100) : 0
  // where the money is, all without VAT so the parts add up to the contract + VOs: a payment received against a VAT
  // invoice is put back on the same footing (less its VAT), and never counts for more than the valuation it paid
  const pence = (x: number) => Math.round(x * 100) / 100
  const paidNet = pence(issued.reduce((t, v) => {
    const got = v.paidAmount ?? 0, net = valTotals(job, v.id, scope, vos).gross
    return t + Math.min(net, Math.max(0, v.invoiceNumber ? got / (1 + (v.invoiceVatRate ?? 20) / 100) : got))
  }, 0))
  const sentNet = pence(valued - certified)
  const split = { paid: paidNet, due: Math.max(0, pence(certified - paidNet)), sent: sentNet, open: pence(current?.gross ?? 0), left: Math.max(0, pence(target - valued - (current?.gross ?? 0))) }
  // owed with VAT is only ever an invoice's figure: built from invoiced valuations alone, never added to one without VAT
  const owedOnInvoice = pence(issued.filter(v => v.invoiceNumber).reduce((t, v) => t + (courts.get(v.id)?.owed ?? 0), 0))
  return (
    <div className="stack">
      <TabHead label="Valuations" menu={<TabMenu title="Valuations" actions={[
          { label: 'Preview certificate', hint: open ? `${valRef(open.number)} as a draft PDF` : 'No open valuation', disabled: !open || !current?.lines, onClick: () => open && cert(open) },
          { label: 'Delete open valuation', hint: open ? `Sends every line in ${valRef(open.number)} back to live` : 'No open valuation', danger: true, disabled: !open, onClick: () => open && onDeleteOpen(open) },
        ]} />} />
      <SumStrip label="Where the money is" cells={[
        { label: 'Contract + VOs', value: money(target), nil: !target, whole: true, note: target ? `${pct}% claimed${open ? ' incl. this valuation' : ''}${pricedVos ? ` · VOs ${money(pricedVos)}` : ''}` : 'No contract value yet — add it in job setup' },
        // the parts only once there's something to split: before the first valuation the whole is all still to claim
        ...(!issued.length && !open ? [] : [
          { label: 'Paid', swatch: 'paid' as const, amount: split.paid, value: money(split.paid), nil: split.paid < 0.005, note: paid - split.paid > 0.005 ? `${money(paid)} incl. VAT` : paid ? 'as received' : 'nothing yet' },
            { label: 'Certified, unpaid', swatch: 'due' as const, amount: split.due, value: money(split.due), nil: split.due < 0.005, hot: owed > 0 && !open && !fixing,
            note: [owedOnInvoice ? `${money(owedOnInvoice)} on invoice${vals.some(v => v.invoiceNumber && withVat(v)) ? ' incl. VAT' : ''}` : certified ? 'agreed by the client' : 'none agreed yet', overdue ? `${overdue} overdue` : ''].filter(Boolean).join(' · ') },
          ...(withClient.length ? [{ label: 'With client', swatch: 'sent' as const, amount: split.sent, value: money(split.sent), nil: split.sent < 0.005,
            note: withClient.length === 1 ? `${valRef(withClient[0].number)}, ${fixing === withClient[0] ? 'changes asked' : 'for review'}` : `${withClient.length} valuations for review` }] : []),
          ...(open ? [{ label: `${valRef(open.number)}, open`, swatch: 'open' as const, amount: split.open, value: money(split.open), nil: split.open < 0.005, note: 'not sent yet' }] : []),
          { label: 'Still to claim', swatch: 'left' as const, amount: split.left, value: money(split.left), nil: split.left < 0.005, note: target ? `${Math.max(0, 100 - pct)}% left` : undefined },
        ]),
      ]} />

      {rhythm && <ValWeek rhythm={rhythm} onWait={() => onUpdateJob(waitAMonth(job, rhythm))} onUndo={() => onUpdateJob({ ...job, valWait: null })} />}

      {fixing && <Working job={job} val={fixing} scope={scope} vos={vos} certified={valued - valTotals(job, fixing.id, scope, vos).gross} hot
        send={<SendButton job={job} val={fixing} vals={vals} scope={scope} vos={vos} onIssue={onIssue} onCertificate={onCertificate} onSent={onUndoSend} />} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />}

      {onDecideSite && <SiteReview diary={diary} scope={scope} valLabel={valRef(open?.number ?? nextNo)} onDecide={onDecideSite} note={readNote} />}

      {open && current ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="ref-roman" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{valRef(open.number)}</span>
            <span className="badge b-volt">Open</span><span className="grow" />
            <span className="hint">{rhythm ? (rhythm.state === 'due' ? 'due this week' : rhythm.state === 'late' ? `was due ${weekText(rhythm)}` : `goes in ${weekText(rhythm)}`) : `started ${ukDate(open.createdAt)}`}</span>
          </div>
          <SumStrip label={`${valRef(open.number)} figures`} cells={[
            { label: 'This valuation', value: money(current.gross), note: 'incl. uplifts, excl. VAT', hot: !fixing },
            { label: 'Cumulative', value: money(valued + current.gross), note: `${money(valued)} in earlier valuations` },
          ]} />
          {current.lines > 0 && <div className="val-build">
            {current.voBase ? <>{fig(money(current.scopeBase))} scope + {fig(money(current.voBase))} VOs = <b>{money(current.base)}</b> at base rates</> : <><b>{money(current.base)}</b> scope at base rates</>}
            {(job.uplift1 || job.uplift2) ? <>, plus uplifts of {job.uplift1}%{job.uplift2 ? <>&nbsp;+&nbsp;{job.uplift2}%</> : null}</> : null}
          </div>}
          {current.lines === 0 && <div className="hint" style={{ padding: '12px 0' }}>Nothing in this valuation yet — tick items in Scope or VOs.</div>}
          {/* one Send, with what the client's QS would query, above the lines: never a long scroll away */}
          {current.lines > 0 && <SendButton job={job} val={open} vals={vals} scope={scope} vos={vos} onIssue={onIssue} onCertificate={onCertificate} onSent={onUndoSend} />}
          <Lines job={job} val={open} scope={scope} vos={vos} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />
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
                    <div className="vo-meta">{t.lines} line{t.lines === 1 ? '' : 's'}</div>
                    {v.invoiceNumber && <div className="vo-meta">Invoice <span className="vo-cref mono">{v.invoiceNumber}</span> · {fig(money(invoiceAmounts(job, v, scope, vos).total))}{withVat(v) ? ' incl. VAT' : ''}</div>}
                    <div className="vo-status"><CourtLine c={courts.get(v.id)!} /></div>
                  </div>
                  <div className="vo-amt"><span className="mono">{money(t.gross)}</span><span className="prop-chev" aria-hidden="true" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}><IconChevron size={16} /></span></div>
                </div>
                {(() => {
                  // the one next step, without opening the row: agreed → invoice → paid
                  const owedHere = (courts.get(v.id)?.owed ?? 0) > 0.005
                  const lead = !open && !fixing && v === sent[0]   // one white block on the screen: the open valuation's Send, else the newest row's next step
                  if (stage === 'review') return <div className="vo-next"><button className={'btn ' + (lead ? 'btn-primary' : 'btn-secondary')} onClick={() => onCreateInvoice(v)}>Agreed — create invoice</button></div>   // nothing is recorded until the invoice (or 'agreed' alone) is
                  if (!v.invoiceNumber && !v.paidAt) return <div className="vo-next"><button className={'btn ' + (lead ? 'btn-primary' : 'btn-secondary')} onClick={() => onCreateInvoice(v)}>Create invoice</button></div>
                  if (!v.paidAt && owedHere) return <div className="vo-next"><button className={'btn ' + (lead ? 'btn-primary' : 'btn-secondary')} onClick={() => setPaying(v)}>Mark as paid</button></div>
                  return null
                })()}
                {isOpen && (
                  <div className="vo-actions" onClick={e => e.stopPropagation()}>
                    <div className="row">
                      {stage === 'review' && <button className="btn btn-secondary" style={{ flex: 1 }} aria-label="Client wants changes" onClick={() => setChanging(v)}>Wants changes</button>}
                      {v.invoiceNumber && <button className="btn btn-secondary" style={{ flex: 1 }} disabled={making === 'inv' + v.id} onClick={async () => { setMaking('inv' + v.id); try { await onInvoicePdf(v) } finally { setMaking(null) } }}>{making === 'inv' + v.id ? 'Preparing…' : 'Invoice PDF'}</button>}
                      <button className="btn btn-secondary" style={{ flex: 1 }} disabled={making === v.id} onClick={() => cert(v)}>{making === v.id ? 'Preparing…' : 'Certificate PDF'}</button>
                    </div>
                    {stage !== 'review' && (v.paidAt || !v.invoiceNumber) && <button className="btn btn-secondary" onClick={() => setPaying(v)}>{v.paidAt ? 'Edit payment' : 'Mark as paid'}</button>}
                    {v.review && stage !== 'review' && !v.invoiceNumber && !v.paidAt && <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setChanging(v)}>Client wants changes after all</button>}
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowLines(showLines === v.id ? null : v.id)}>{showLines === v.id ? 'Hide lines' : `Show ${t.lines} line${t.lines === 1 ? '' : 's'}`}</button>
                    {showLines === v.id && <Lines job={job} val={v} scope={scope} vos={vos} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  const typed = isFinite(n) && n > 0
  const save = (paid: number) => { const [y, m, d] = date.split('-').map(Number); onSave({ ...v, paidAt: new Date(y, m - 1, d, 12).getTime(), paidAmount: paid }) }
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">Payment · {valRef(v.number)}</h2>
        <Field label="Date received"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <div className="hint">{figs(v.invoiceNumber ? `Invoice ${v.invoiceNumber}: ${money(gross)}${withVat(v) ? ' incl. VAT' : ''}.` : `Certified ${money(gross)}.`)} Less than that landed? Enter what did — the rest stays owed.</div>
        <Field label="Amount received (£)"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="As on the remittance" /></Field>
        {/* the white block is whatever matches what you typed: an amount typed means that amount, never "in full" */}
        {typed && n < gross - 0.005 && <div className="flag">{fig(money(gross - n))} will still show as owed</div>}
        {typed && <button className="btn btn-primary" disabled={!date} onClick={() => save(Math.round(n * 100) / 100)}>Save {fig(money(n))} received</button>}
        {!v.paidAt && <button className={'btn ' + (typed ? 'btn-secondary' : 'btn-primary')} disabled={!date} onClick={() => save(Math.round(gross * 100) / 100)}>Paid in full · {fig(money(gross))}</button>}
        {v.paidAt && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...v, paidAt: null, paidAmount: null })}>Remove payment (not paid)</button>}
      </div>
    </Sheet>
  )
}

/**
 * Sending a valuation for the client's review, in one deliberate tap. The card above it already shows what it
 * certifies (its lines by house, base, uplifts, cumulative), so there is no second screen: what the client's QS
 * would query sits here, and the figure is on the button. Sent, it's locked while they review it and the certificate
 * opens to send them; if they ask for changes it opens again. (A draft certificate is in the ⋯ menu.)
 */
function SendButton({ job, val, vals, scope, vos, onIssue, onCertificate, onSent }: {
  job: Job; val: Valuation; vals: Valuation[]; scope: ScopeItem[]; vos: Variation[]
  onIssue: (v: Valuation) => Promise<Valuation>; onCertificate: (v: Valuation) => Promise<void>
  /** it went: the Undo offer, made after the certificate so the share sheet doesn't eat its seconds */
  onSent?: (before: Valuation) => void
}) {
  const [busy, setBusy] = useState(false)
  const p = issuePlan(job, val, vals, scope, vos)
  const ref = valRef(val.number)
  // sending it and handing over the certificate are one step: it's what goes to the client
  const send = async () => {
    setBusy(true)
    try {
      const issued = await onIssue(val)
      if (issued === val) return   // it didn't save: act() has already said so
      try { await onCertificate(issued) } catch (e) { tell(e, `${ref} is sent and saved, but its certificate PDF didn’t open. It’s on ${ref}’s row: tap the row, then Certificate PDF.`) }
      onSent?.(val)
    } finally { setBusy(false) }
  }
  return (
    <div className="stack" style={{ marginTop: 14, marginBottom: 12 }}>
      {p.checks.filter(c => c.kind !== 'ok').map((c, i) => <Plate key={i} kind={c.kind}>{c.text}</Plate>)}
      <button className="btn btn-primary" disabled={busy || p.totals.lines === 0} onClick={send}>{busy ? 'Sending…' : figs(`Send ${ref}${amending(val) ? ' again' : ''} for ${money(p.totals.gross)}`)}</button>
    </div>
  )
}

/**
 * The valuation week, said plainly: when the last one went, when the next one goes in (the first week of
 * the month), and a way to let a thin month wait for the next.
 */
function ValWeek({ rhythm: r, onWait, onUndo }: { rhythm: NonNullable<ReturnType<typeof valRhythm>>; onWait: () => void; onUndo: () => void }) {
  const day = (t: number) => shortDay(dayKey(new Date(t)))
  const ago = r.last ? Math.floor((Date.now() - r.last.issuedAt!) / 864e5) : 0
  const when = r.state === 'due' ? 'This week' : r.state === 'late' ? `Late · was due ${weekText(r)}` : r.state === 'soon' ? 'Starts in a few days' : r.waited ? 'Moved on a month' : `First week of the month · under ${VAL_MIN_DAYS === 14 ? 'two' : VAL_MIN_DAYS / 7} weeks’ work waits`
  return (
    <div className={'panel val-week' + (r.state === 'due' || r.state === 'late' ? ' now' : '')} aria-label="Valuation week">
      <div className="val-week-c">
        <div className="label">Last sent</div>
        <div className="val-week-n">{r.last ? <><span><span className="ref-roman">{valRef(r.last.number)}</span> ·</span> <span>{day(r.last.issuedAt!)}</span></> : 'None yet'}</div>
        <small>{r.last ? (ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`) : 'the first on this job'}</small>
      </div>
      <div className="val-week-c">
        <div className="label">Next</div>
        <div className="val-week-n"><span><span className="ref-roman">{valRef(r.next)}</span> ·</span> <span>{weekText(r)}</span></div>
        <small>{when}</small>
      </div>
      {(r.state === 'due' || r.state === 'late' || r.waited) && <div className="val-week-f">
        <span className="grow" />
        {(r.state === 'due' || r.state === 'late') && <button className="linkish tap t-small" onClick={onWait}>Wait till next month</button>}
        {r.waited && r.state !== 'due' && r.state !== 'late' && <button className="linkish tap t-small" onClick={onUndo}>Undo the wait</button>}
      </div>}
    </div>
  )
}

/** A sent valuation the client asked to change: open to amend, with what they asked for, until it's sent again. */
function Working({ job, val, scope, vos, certified, hot, send, onRemoveScope, onRemoveVo }: {
  job: Job; val: Valuation; scope: ScopeItem[]; vos: Variation[]; certified: number; hot?: boolean
  send: ReactNode; onRemoveScope: (i: ScopeItem) => void; onRemoveVo: (v: Variation) => void
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
      {send}
      <Lines job={job} val={val} scope={scope} vos={vos} onRemoveScope={onRemoveScope} onRemoveVo={onRemoveVo} />
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
