import { useState } from 'react'
import type { Cost, CostKind, CostStatus, DiaryEntry, Job, ScopeItem, Variation } from '../lib/types'
import { byTrade, jobMargin, pctOf } from '../lib/margin'
import { money, ukDate } from '../lib/format'
import { uid } from '../lib/db'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'
import { SumStrip } from '../components/Register'
import { Plate } from '../components/Sign'

const KINDS: { k: CostKind; label: string }[] = [{ k: 'subbie', label: 'Subcontractor' }, { k: 'labour', label: 'Labour' }, { k: 'materials', label: 'Materials' }, { k: 'plant', label: 'Plant / hire' }, { k: 'other', label: 'Other' }]
const STATUS: { s: CostStatus; label: string; hint: string }[] = [
  { s: 'quote', label: 'Quote', hint: 'Compared, not counted' },
  { s: 'committed', label: 'Agreed', hint: 'Ordered or accepted — counts' },
  { s: 'paid', label: 'Paid', hint: 'Counts' },
]
const statusLabel = (s: CostStatus) => STATUS.find(x => x.s === s)!.label
const signed = (n: number) => (n < 0 ? `−${money(-n)}` : money(n))

/** Costs & margin for one job: what the client pays against what it costs you. Office only. */
export function CostsSheet({ job, scope, vos, diary, costs, dayRate, onSave, onDelete, onClose }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; diary: DiaryEntry[]; costs: Cost[]; dayRate?: number | null
  onSave: (c: Cost) => Promise<void>; onDelete: (c: Cost) => Promise<void>; onClose: () => void
}) {
  const [edit, setEdit] = useState<Cost | 'new' | null>(null)
  const [preset, setPreset] = useState<Partial<Cost>>({})
  const m = jobMargin(job, scope, vos, costs, diary, dayRate)
  const trades = byTrade(job, scope, costs)
  const streams = [...new Set(scope.map(i => i.workstream).filter((x): x is string => !!x))]
  const list = [...costs].sort((a, b) => b.date - a.date)

  if (edit) return <CostForm job={job} cost={edit === 'new' ? undefined : edit} preset={preset} streams={streams}
    onClose={() => setEdit(null)} onSave={async c => { await onSave(c); setEdit(null) }} onDelete={edit !== 'new' ? async () => { await onDelete(edit); setEdit(null) } : undefined} />

  return (
    <Sheet onClose={onClose} label="Costs and margin">
      <div className="stack">
        <div className="label bracket">Costs &amp; margin · {job.name}</div>
        <SumStrip label="Margin" cols={3} cells={[
          { label: 'Job value', value: money(m.value), note: m.unpriced ? `incl. uplifts · + ${m.unpriced} unpriced` : 'incl. uplifts' },
          { label: 'Costs', value: money(m.costs), note: [m.labourEstimate != null ? 'incl. labour estimate' : '', m.unknownCosts ? `+ ${m.unknownCosts} without an amount` : '', m.quotes ? `${m.quotes} quote${m.quotes === 1 ? '' : 's'} not counted` : ''].filter(Boolean).join(' · ') || 'agreed + paid', nil: !m.costs },
          { label: 'Margin', value: signed(m.margin), note: m.pct != null ? `${m.pct}% of value` : '—', hot: true },
        ]} />
        {m.margin < 0 && <Plate kind="stop">Costs are more than the job is worth</Plate>}
        {m.unpriced > 0 && <div className="muted" style={{ fontSize: 14 }}>The value leaves out {m.unpriced} unpriced line{m.unpriced === 1 ? '' : 's'} — the margin will move when they’re priced.</div>}

        <div className="panel" style={{ fontSize: 15 }}>
          <b>Labour from the site diary</b>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            {m.labourDays ? `${m.labourDays} operative-day${m.labourDays === 1 ? '' : 's'} recorded` : 'No labour recorded in the diary yet'}
            {m.labourEstimate != null ? ` × ${money(dayRate!)} a day = ${money(m.labourEstimate)} (an estimate, included above).` : m.labourDays ? ' — set your day rate in Settings to include them as an estimate.' : '.'}
          </div>
        </div>

        {trades.length > 0 && (
          <>
            <h2 className="sec-h">By trade · what the client pays vs your costs</h2>
            {trades.map(t => (
              <div key={t.trade} className="panel trade">
                <div className="trade-head">
                  <b>{t.trade}</b>
                  <span className="muted">{t.lines ? `${t.lines} line${t.lines === 1 ? '' : 's'}: ${money(t.base)} base · ${money(t.value)} with uplifts` : 'No scope lines in this trade'}{t.unpriced ? ` · + ${t.unpriced} unpriced` : ''}</span>
                </div>
                {t.accepted != null && <div className="trade-row"><span className="grow">Agreed / paid</span><span className="amt">{money(t.accepted)}</span>
                  {t.value > 0 && <span className={'amt trade-m' + (t.value - t.accepted < 0 ? ' neg' : '')}>{signed(t.value - t.accepted)} · {pctOf(t.value - t.accepted, t.value)}%</span>}</div>}
                {t.quotes.map(q => (
                  <div key={q.cost.id} className="trade-row">
                    <span className="grow"><b>{q.cost.who || 'Quote'}</b><small>{q.cost.description || 'Quote'} · {ukDate(q.cost.date)}</small></span>
                    <span className="amt">{q.cost.amount != null ? money(q.cost.amount) : '—'}</span>
                    <span className={'amt trade-m' + ((q.marginValue ?? 0) < 0 ? ' neg' : '')}>
                      {q.marginValue != null ? <>{signed(q.marginValue)}<small>{pctOf(q.marginValue, t.value)}% with uplifts · {q.marginBase != null ? `${pctOf(q.marginBase, t.base)}% on base` : ''}</small></> : '—'}
                    </span>
                    <button className="btn btn-secondary" onClick={() => onSave({ ...q.cost, status: 'committed' })}>Accept</button>
                  </div>
                ))}
                <button className="linkish tap" onClick={() => { setPreset({ trade: t.trade, kind: 'subbie', status: 'quote' }); setEdit('new') }}>+ Add a quote for {t.trade}</button>
              </div>
            ))}
          </>
        )}

        <h2 className="sec-h">All costs · {costs.length}</h2>
        {list.length === 0 ? <div className="card empty">No costs yet. Add subbie quotes and bills, materials and hire as they come in.</div> : (
          <div className="panel chk">
            {list.map(c => (
              <button key={c.id} className="chk-row cost-row" onClick={() => setEdit(c)}>
                <span className={'badge ' + (c.status === 'quote' ? 'b-slate' : c.status === 'paid' ? 'b-green' : 'b-amber')}>{statusLabel(c.status)}</span>
                <span className="grow">{c.who || KINDS.find(k => k.k === c.kind)!.label}<small>{[c.trade, c.description, ukDate(c.date)].filter(Boolean).join(' · ')}</small></span>
                <span className="amt">{c.amount != null ? money(c.amount) : '—'}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={() => { setPreset({}); setEdit('new') }}>Add a cost</button>
      </div>
    </Sheet>
  )
}

function CostForm({ job, cost, preset, streams, onSave, onDelete, onClose }: {
  job: Job; cost?: Cost; preset: Partial<Cost>; streams: string[]; onSave: (c: Cost) => void; onDelete?: () => void; onClose: () => void
}) {
  const [c, setC] = useState<Cost>(cost ?? { id: uid(), jobId: job.id, kind: 'subbie', status: 'quote', who: '', trade: '', description: '', amount: null, date: Date.now(), createdAt: Date.now(), ...preset })
  const [amount, setAmount] = useState(c.amount != null ? String(c.amount) : '')
  const n = parseFloat(amount.replace(/[£,\s]/g, ''))
  const amt = isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
  return (
    <Sheet onClose={onClose} label={cost ? 'Edit cost' : 'Add a cost'}>
      <div className="stack">
        <div className="label bracket">{cost ? 'Cost' : 'Add a cost'} · {job.name}</div>
        <fieldset className="chips" style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr-only">Kind</legend>
          {KINDS.map(k => <button key={k.k} type="button" className={'chip' + (c.kind === k.k ? ' on' : '')} aria-pressed={c.kind === k.k} onClick={() => setC({ ...c, kind: k.k })}>{k.label}</button>)}
        </fieldset>
        <Field label="Who" hint="Subbie, supplier or hire firm"><input value={c.who} onChange={e => setC({ ...c, who: e.target.value })} placeholder="e.g. Haven Scaffolding" /></Field>
        <div className="row">
          <div className="grow"><Field label="Trade" hint="Matches a scope workstream to compare"><input value={c.trade} list="cost-trades" onChange={e => setC({ ...c, trade: e.target.value })} placeholder="e.g. Scaffold" /></Field></div>
          <div className="grow"><Field label="Amount (£, net of VAT)"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Not known yet" /></Field></div>
          <datalist id="cost-trades">{streams.map(s => <option key={s} value={s} />)}</datalist>
        </div>
        <Field label="What for"><input value={c.description} onChange={e => setC({ ...c, description: e.target.value })} placeholder="e.g. Scaffold to front and rear, 6 weeks" /></Field>
        <fieldset className="roles"><legend>Status</legend>
          {STATUS.map(s => (
            <label key={s.s} className={'role' + (c.status === s.s ? ' on' : '')}>
              <input type="radio" name="cost-status" checked={c.status === s.s} onChange={() => setC({ ...c, status: s.s })} />
              <span><b>{s.label}</b><small>{s.hint}</small></span>
            </label>
          ))}
        </fieldset>
        <button className="btn btn-primary" disabled={!c.who.trim() && !c.description.trim()} onClick={() => onSave({ ...c, who: c.who.trim(), trade: c.trade.trim(), description: c.description.trim(), amount: amt })}>{cost ? 'Save' : 'Add cost'}</button>
        {onDelete && <ConfirmDelete label="Delete…" confirmLabel="Delete this cost" onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}
