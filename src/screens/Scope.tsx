import { useState } from 'react'
import { useAccess } from '../lib/access'
import type { RateBook } from '../lib/types'
import { RateLookup } from './Rates'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { money, qtyText } from '../lib/format'
import { isPriced, lineValue, lockedIn, valRef } from '../lib/valuation'
import { uid } from '../lib/db'
import { IconCheck, IconChevron, IconDoc, IconPlus } from '../components/Icons'
import { doneMarks, undecided } from '../lib/siteDone'
import { TabMenu } from '../components/TabMenu'
import { ByClaude } from '../components/Sign'
import { TradeMark } from '../components/Trade'
import { tradeCore } from '../lib/trade'
import { RowHit, SumStrip, TabHead } from '../components/Register'
import { fig, figs } from '../components/Figs'
import { VoRow, VoSummary } from './Variations'
import { voHouse } from '../lib/property'

export { Tick, ValBadge } from '../components/Tick'
import { Tick, ValBadge } from '../components/Tick'

type Filter = 'all' | 'live' | 'claimed' | 'vos'

/** What the Scope tab needs for the job's variations: they're work at a house like any line, so they live here too. */
export interface VoProps {
  vos: Variation[]; onToggleVo: (v: Variation) => void; onEditVo: (v: Variation) => void; onLogVo: () => void
  onImportVo?: () => void; onRegister?: () => void; onDayworks?: () => void
  /** the operative's "done" marks (siteDone.ts): the diary they're kept in, and making or taking one back */
  diary?: DiaryEntry[]; onMarkDone?: (i: ScopeItem) => void; onUndoDone?: (e: DiaryEntry) => void
}
const sortHouses = (a: string, b: string) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'en', { numeric: true }))
const houseOf = (v: Variation) => voHouse(v) || '—'
const counts = (v: Variation) => v.status !== 'Rejected'
const voValue = (vs: Variation[]) => vs.filter(counts).reduce((t, v) => t + lineValue(v.qty, v.rate), 0)
/** A house's work by trade (Kitchen, Bathroom, Paint, Scaffold…), else by location. */
const groupName = (i: ScopeItem) => i.workstream || i.room || 'General'
/** The location, only when it says something: not "Property" (a whole-house line), not the trade again. */
const placeOf = (i: ScopeItem) => (i.room && !/^(the )?property$/i.test(i.room.trim()) && i.room !== groupName(i) ? i.room : '')

/**
 * A house's trades as one thin bar: each trade's share of the work, in its colour (a fine line along the foot shows
 * every trade, claimed or not), filling solid as its lines are claimed. Read at a glance, no names needed.
 */
export function TradeBar({ items, label }: { items: ScopeItem[]; label: string }) {
  const trades = [...new Set(items.map(groupName))].map(name => {
    const ls = items.filter(i => groupName(i) === name)
    const value = ls.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
    return { name, value, claimed: ls.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0) }
  }).filter(t => t.value > 0)
  if (!trades.length) return <div className="tbar" aria-hidden="true" />
  return (
    <div className="tbar" role="img" aria-label={label}>
      {trades.map(t => <i key={t.name} style={{ flexGrow: t.value, '--c': `var(--core-${tradeCore(t.name)})` } as React.CSSProperties}><b style={{ width: `${Math.round((t.claimed / t.value) * 100)}%` }} /></i>)}
    </div>
  )
}

type ScopeProps = Parameters<typeof OfficeScope>[0]
/** Office staff get the priced, claimable work; operatives get the work list: no rates, values or ticks. Both list a
 *  house's variations with its scope, so nothing at a house is missed (a gutter VO before the scaffold comes down). */
export function ScopeTab(p: ScopeProps) {
  return useAccess().money ? <OfficeScope {...p} /> : <SiteScope job={p.job} scope={p.scope} vos={p.vos} vals={p.vals} diary={p.diary} onEditVo={p.onEditVo} onToggleVo={p.onToggleVo} onLogVo={p.onLogVo} onMarkDone={p.onMarkDone} onUndoDone={p.onUndoDone} />
}

/** The operative's site list: their work house by house, folded so a 30-house scheme is 30 rows, not 300; the trade
 *  they're on picked once and remembered on this phone; each line a big "Done" they tap when it's finished. Done is a
 *  mark for the office to approve (siteDone.ts), never an edit to the line. No rates, values or valuations. */
function SiteScope({ job, scope, vos, vals, diary = [], onEditVo, onToggleVo, onLogVo, onMarkDone, onUndoDone }: {
  job: Job; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]; diary?: DiaryEntry[]
  onEditVo: (v: Variation) => void; onToggleVo: (v: Variation) => void; onLogVo: () => void
  onMarkDone?: (i: ScopeItem) => void; onUndoDone?: (e: DiaryEntry) => void
}) {
  const houses = [...new Set([...scope.map(i => i.property || '—'), ...vos.map(houseOf)])].sort(sortHouses)
  const many = houses.filter(h => h !== '—').length > 1 || (houses.length > 1 && houses.includes('—'))
  const name = (h: string) => h === '—' ? (many ? 'Whole job' : 'The work') : job.properties?.[h]?.split(',')[0] || `No. ${h}`
  const groupOf = (i: ScopeItem) => i.workstream || i.room || 'General'
  const trades = [...new Set(scope.map(i => i.workstream).filter((x): x is string => !!x))].sort()
  const [trade, setTradeState] = useState<string>(() => { try { const t = localStorage.getItem('mastor.myTrade') ?? ''; return trades.includes(t) ? t : '' } catch { return '' } })
  const setTrade = (t: string) => { setTradeState(t); try { localStorage.setItem('mastor.myTrade', t) } catch { /* private window: just for now */ } }
  const [open, setOpen] = useState<Set<string>>(() => new Set(many ? [] : houses))
  const marks = doneMarks(diary)
  const isDone = (i: ScopeItem) => !!i.valuationId || marks.has(i.id)
  const mine = (i: ScopeItem) => !trade || i.workstream === trade
  return (
    <div className="stack">
      <TabHead label="Scope" meta={`${scope.length} item${scope.length === 1 ? '' : 's'}${vos.length ? ` · ${vos.length} VO${vos.length === 1 ? '' : 's'}` : ''}`} />
      <div className="tab-actions"><button className="btn btn-sm btn-primary" onClick={onLogVo}><IconPlus /> Add VO</button></div>
      {scope.length === 0 && vos.length === 0 && <div className="card empty">No scope on this job yet. Spot extra work? Add it as a VO, at its house.</div>}
      {trades.length > 1 && (
        <div className="chips" role="group" aria-label="Your trade">
          <button className={'chip' + (!trade ? ' on' : '')} aria-pressed={!trade} onClick={() => setTrade('')}>All trades</button>
          {trades.map(t => <button key={t} className={'chip' + (trade === t ? ' on' : '')} aria-pressed={trade === t} onClick={() => setTrade(t)}>{t}</button>)}
        </div>
      )}
      {houses.map(h => {
        const lines = scope.filter(i => (i.property || '—') === h && mine(i))
        const hv = vos.filter(v => houseOf(v) === h).sort((a, b) => a.number - b.number)
        if (!lines.length && !hv.length) return null
        const done = lines.filter(isDone).length
        const isOpen = open.has(h)
        const toggle = () => setOpen(s => { const n = new Set(s); if (n.has(h)) n.delete(h); else n.add(h); return n })
        return (
          <section key={h} className="site-house">
            <button className="site-house-h" aria-expanded={isOpen} onClick={toggle}>
              <span className="grow"><b>{name(h)}</b><small>{lines.length} line{lines.length === 1 ? '' : 's'}{lines.length ? ` · ${done} done` : ''}{hv.length ? ` · ${hv.length} VO${hv.length === 1 ? '' : 's'}` : ''}</small></span>
              {lines.length > 0 && done === lines.length && <span className="site-all" aria-hidden="true"><IconCheck size={14} /></span>}
              <span className="prop-chev" aria-hidden="true" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}><IconChevron size={16} /></span>
            </button>
            {isOpen && <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {hv.length > 0 && <div className="panel flush clip">{hv.map((v, i) => <VoRow key={v.id} v={v} vals={vals} idx={i} onToggle={onToggleVo} onEdit={onEditVo} />)}</div>}
              {[...new Set(lines.map(groupOf))].map(g => (
                <div key={g}>
                  <h3 className="label" style={{ margin: '6px 0' }}>{g}</h3>
                  <div className="panel chk">
                    {lines.filter(i => groupOf(i) === g).map(i => {
                      const mark = marks.get(i.id), signed = !!i.valuationId, on = signed || !!mark
                      const canUndo = !signed && !!mark && undecided(mark)
                      return (
                        <div key={i.id} className={'chk-row' + (on ? ' is-done' : '')}>
                          <span className="mono">{i.code || '—'}</span>
                          <span className="grow">{i.description}<small>{figs(i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'qty not stated')}{i.room && i.workstream ? ` · ${i.room}` : ''}{signed ? ' · signed off' : mark ? ' · with the office' : ''}</small></span>
                          {onMarkDone && <button className={'done-btn' + (on ? ' on' : '')} aria-pressed={on} disabled={on && !canUndo}
                            aria-label={`${on ? 'Done' : 'Mark done'}: ${i.code ? i.code + ' ' : ''}${i.description}${canUndo ? ' (tap to take it back)' : ''}`}
                            onClick={() => { if (!on) onMarkDone(i); else if (mark && canUndo) onUndoDone?.(mark) }}>
                            <span className="done-box" aria-hidden="true">{on && <IconCheck size={14} />}</span>Done
                          </button>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>}
          </section>
        )
      })}
    </div>
  )
}

function OfficeScope({ job, scope, vals, onToggle, onToggleMany, onClearUnclaimed, onDeleteAll, onAdd, onEdit, onImport, onCheckRates, onEvidence,
  vos, onToggleVo, onEditVo, onLogVo, onImportVo, onRegister, onDayworks }: {
  job: Job; scope: ScopeItem[]; vals: Valuation[]; onToggle: (i: ScopeItem) => void; onToggleMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onDeleteAll: (items: ScopeItem[]) => void; onAdd: () => void; onEdit: (i: ScopeItem) => void; onImport: () => void; onCheckRates?: () => void; onEvidence?: () => Promise<void>
} & VoProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const total = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const claimed = scope.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  const voTotal = voValue(vos), voClaimed = voValue(vos.filter(v => v.valuationId))
  const voUnpriced = vos.filter(v => counts(v) && (v.qty == null || v.rate == null)).length
  const shown = filter === 'vos' ? [] : scope.filter(i => filter === 'all' || (filter === 'live' ? !i.valuationId : !!i.valuationId))
  const shownVos = vos.filter(v => filter === 'all' || filter === 'vos' || (filter === 'live' ? !v.valuationId && counts(v) : !!v.valuationId)).sort((a, b) => a.number - b.number)
  const valById = (id: string | null) => vals.find(v => v.id === id)
  // one block per house, its scope lines and its VOs together; lines and VOs for no one house sit under "Whole job"
  const properties = [...new Set([...scope.map(i => i.property || '—'), ...vos.map(houseOf)])].sort(sortHouses)
  const hasProps = properties.filter(p => p !== '—').length > 1 || (properties.length > 1 && properties.includes('—'))
  // one tap on a house opens all its work in a sheet, under its trades; the list stays where it was underneath
  const [openHouse, setOpenHouse] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState<string | null>(null)
  const groupsOf = (ls: ScopeItem[]) => [...new Set(ls.map(groupName))]
  const houseName = (p: string) => (p === '—' ? 'Whole job' : job.properties?.[p]?.split(',')[0] || `No. ${p}`)
  const unclaimed = scope.filter(i => !i.valuationId)
  const voLive = vos.filter(v => !v.valuationId && counts(v))
  const unpricedLines = scope.filter(i => !isPriced(i)).length
  const lockedCount = scope.filter(i => !!lockedIn(i, vals)).length
  const voRows = (list: Variation[]) => list.map((v, i) => <VoRow key={v.id} v={v} vals={vals} idx={i} onToggle={onToggleVo} onEdit={onEditVo} />)
  const row = (i: ScopeItem, idx: number) => {
    const val = valById(i.valuationId)
    const locked = !!lockedIn(i, vals)
    return (
      <div key={i.id} className="row has-hit line-row" style={{ padding: '12px 12px', borderTop: idx ? '1px solid var(--line)' : 'none', alignItems: 'flex-start' }}>
        <RowHit label={`Edit ${i.code ? i.code + ' ' : ''}${i.description}`} onClick={() => onEdit(i)} />
        {/* the whole left strip of the row is the tick, so a near miss ticks rather than opening the editor */}
        {isPriced(i) || i.valuationId
          ? <div className="tick-col" onClick={e => { e.stopPropagation(); if (!locked) onToggle(i) }}><Tick on={!!i.valuationId} locked={locked} onClick={() => onToggle(i)} /></div>
          : <span className="tick-col" aria-hidden="true" />}
        <div className="grow">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {i.code && <span className="mono t-small slate">{i.code}</span>}
            {placeOf(i) && <span className="hint">{placeOf(i)}</span>}
            <ValBadge val={val} />
            {!locked && <ByClaude at={i.byClaude} />}
          </div>
          <div className="clamp2" style={{ fontWeight: 500, marginTop: 2 }}>{i.description}</div>
          <div className="hint">
            {figs(i.qty != null ? `${qtyText(i.qty)} ${i.unit}` : 'qty not stated')}{figs(i.rate != null ? ` @ ${money(i.rate)}` : '')}{figs(i.hours ? ` · ${i.hours}h` : '')}
          </div>
          {!isPriced(i) && <div className="flag">{i.rate == null ? 'NO RATE' : 'NO QTY'} — tap to fix</div>}
        </div>
        <div className="amt t-note" style={{ flex: 'none', whiteSpace: 'nowrap', color: isPriced(i) ? 'var(--ink)' : 'var(--ink-muted)' }}>{isPriced(i) ? money(lineValue(i.qty, i.rate)) : '—'}</div>
      </div>
    )
  }
  const empty = scope.length === 0 && vos.length === 0

  /** A house's work, all open: its VOs first (extra work can't hide), then each trade under a heading that stays in
   *  view while you scroll, with its subtotal and Tick all. In the house sheet, or on the screen for a one-house job. */
  const houseBody = (p: string, inSheet: boolean) => {
    const all = scope.filter(i => (i.property || '—') === p)
    const pv = vos.filter(v => houseOf(v) === p)
    const lines = shown.filter(i => (i.property || '—') === p).sort((a, b) => a.order - b.order)
    const pvShown = shownVos.filter(v => houseOf(v) === p)
    const tot = all.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) + voValue(pv)
    const cl = all.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0) + voValue(pv.filter(v => v.valuationId))
    const pct = tot ? Math.round((cl / tot) * 100) : 0
    const remaining = all.filter(i => !i.valuationId && isPriced(i))
    const groups = groupsOf(lines)
    const jump = (g: string) => document.getElementById(`trade-${p}-${g}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return (
      <div className={'house' + (inSheet ? ' in-sheet' : '')}>
        {inSheet && <div className="house-h">
          <h2 className="house-name">{houseName(p)}</h2>
          <span className="mono house-amt">{money(tot)}</span>
          <div className="prop-foot"><TradeBar items={all} label={`${pct}% claimed`} /><span className={'prop-pct' + (pct === 100 ? ' all' : '')}>{pct === 100 && <IconCheck size={13} />}{fig(`${pct}%`)}</span></div>
          {p !== '—' && job.properties?.[p] && <div className="hint">{job.properties[p]}</div>}
        </div>}
        {inSheet && remaining.length > 0 && filter !== 'vos' && (
          <div className="house-all">
            {confirmAll === p
              ? <div className="row"><span className="grow t-small">Put all {remaining.length} remaining lines ({fig(money(remaining.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)))}) into the valuation?</span>
                  <button className="chip lg" onClick={() => setConfirmAll(null)}>No</button><button className="chip lg on" onClick={() => { setConfirmAll(null); onToggleMany(remaining) }}>Yes</button></div>
              : <button className="btn btn-secondary" onClick={() => setConfirmAll(p)}>Tick all remaining lines ({remaining.length})</button>}
          </div>
        )}
        {inSheet && groups.length > 2 && (
          <div className="chips trade-jump" role="group" aria-label="Go to a trade">
            {groups.map(g => <button key={g} className="chip sm" onClick={() => jump(g)}><TradeMark name={g} />{g}</button>)}
          </div>
        )}
        {pvShown.length > 0 && (
          <section className="hs-trade">
            <div className="trade-h"><span className="grow">Variations <span className="hint">· {pvShown.length}</span></span><span className="mono t-small">{voValue(pvShown) > 0 ? money(voValue(pvShown)) : 'unpriced'}</span></div>
            <div className="vo-group">{voRows(pvShown)}</div>
          </section>
        )}
        {lines.length === 0 && pvShown.length === 0 && !empty && <div className="hint" style={{ padding: 12 }}>Nothing here for this filter.</div>}
        {groups.map(g => {
          const gl = lines.filter(i => groupName(i) === g)
          const gall = all.filter(i => groupName(i) === g)
          const gt = gall.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
          const grem = gall.filter(i => !i.valuationId && isPriced(i))
          return (
            <section key={g} className="hs-trade" aria-label={g}>
              <div className="trade-h" id={`trade-${p}-${g}`}>
                <span className="grow"><TradeMark name={g} />{g} <span className="hint">· {gall.length}</span></span>
                <span className="mono t-small">{money(gt)}</span>
                {grem.length > 1 && <button className="chip sm" onClick={() => onToggleMany(grem)} aria-label={`Tick all ${g} (${grem.length})`}>Tick all</button>}
              </div>
              <div className="trade-lines">{gl.map((i, idx) => row(i, idx))}</div>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <div className="stack">
      <TabHead label="Scope" meta={`${scope.length} item${scope.length === 1 ? '' : 's'}${vos.length ? ` · ${vos.length} VO${vos.length === 1 ? '' : 's'}` : ''}`} menu={<TabMenu title="Scope" actions={[
          { label: 'Add a scope line', hint: 'By hand, when there’s no schedule to import it from', onClick: onAdd },
          ...(onRegister ? [{ label: 'Variation register (PDF)', hint: 'Every VO: client ref, status, value, evidence', disabled: !vos.length, onClick: onRegister }] : []),
          ...(onDayworks ? [{ label: 'Dayworks sheets', hint: 'Hours, materials and plant, signed, then claimed as a VO', onClick: onDayworks }] : []),
          ...(onEvidence ? [{ label: 'Completion evidence (PDF)', hint: 'Work claimed so far, by property, with the diary’s photos — no prices', disabled: !scope.some(i => i.valuationId), onClick: () => { void onEvidence() } }] : []),
          ...(onCheckRates ? [{ label: 'Check rates against your SoR', hint: 'Lines that don’t follow the BoQ’s pattern, codes not in the schedule', disabled: !scope.length, onClick: onCheckRates }] : []),
          { label: 'Clear unclaimed lines', hint: `${unclaimed.length} scope line${unclaimed.length === 1 ? '' : 's'} not in any valuation (VOs stay)`, danger: true, disabled: !unclaimed.length,
            confirm: `Remove ${unclaimed.length} unclaimed lines? Anything in a valuation, and every VO, stays.`, onClick: () => onClearUnclaimed(unclaimed) },
          { label: 'Delete entire scope', hint: lockedCount ? `Wrong spec? ${lockedCount} certified line${lockedCount === 1 ? '' : 's'} will stay (issued valuations are locked); VOs stay` : 'Wrong spec? Removes every scope line so you can import again; VOs stay', danger: true, disabled: lockedCount === scope.length,
            confirm: lockedCount ? `Delete ${scope.length - lockedCount} lines? The ${lockedCount} certified on issued valuations stay.` : `Delete all ${scope.length} lines from this job? This can't be undone.`, onClick: () => onDeleteAll(scope.filter(i => !lockedIn(i, vals))) },
        ]} />} />

      {/* the two ways work comes in, under the heading: a VO as you spot it, or the client's documents */}
      <div className="tab-actions">
        <button className={'btn btn-sm ' + (empty ? 'btn-secondary' : 'btn-primary')} onClick={onLogVo}><IconPlus /> Add VO</button>
        {onImportVo ? <TabMenu title="Import" button={{ label: <><IconDoc /> Import</>, className: 'btn btn-sm ' + (empty ? 'btn-primary' : 'btn-secondary') }} actions={[
          { label: 'Scope', hint: 'The schedule of works, BoQ, works orders, PCI or surveys: Excel, PDF or Word. Every line read for you to check.', onClick: onImport },
          { label: 'VOs', hint: 'The client’s VO ticket, site instruction or VO schedule: photo, scan, PDF, Word or Excel. A VO per line, at its house.', onClick: onImportVo },
        ]} /> : <button className={'btn btn-sm ' + (empty ? 'btn-primary' : 'btn-secondary')} onClick={onImport}><IconDoc /> Import scope</button>}
      </div>

      {filter === 'vos' ? (vos.length > 0 && <VoSummary job={job} vos={vos} vals={vals} />)
        : !empty && <SumStrip label="Work summary" caption="At base rates. Uplifts are added in the valuation." cells={[
        { label: 'Scope total', value: money(total), note: unpricedLines ? `+ ${unpricedLines} unpriced` : `${scope.length} line${scope.length === 1 ? '' : 's'}`, nil: !scope.length },
        { label: 'Variations', value: money(voTotal), note: [`${vos.filter(counts).length} VO${vos.filter(counts).length === 1 ? '' : 's'}`, voUnpriced ? `+ ${voUnpriced} unpriced` : ''].filter(Boolean).join(' · '), nil: !voTotal },   // unpriced is never £0
        { label: 'Claimed', value: money(claimed + voClaimed), note: `${total + voTotal ? Math.round(((claimed + voClaimed) / (total + voTotal)) * 100) : 0}% of the work`, hot: true, nil: !(claimed + voClaimed) },
        { label: 'Still to do', value: money(total - claimed + voTotal - voClaimed), note: `${unclaimed.length} line${unclaimed.length === 1 ? '' : 's'}${voLive.length ? ` · ${voLive.length} VO${voLive.length === 1 ? '' : 's'}` : ''}`, nil: !unclaimed.length && !voLive.length },
      ]} />}

      <div className="chips">
        {(['all', 'live', 'claimed', 'vos'] as Filter[]).map(f => (
          <button key={f} className={'chip sm' + (filter === f ? ' on' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'live' ? 'Still to do' : f === 'claimed' ? 'Claimed' : `VOs${vos.length ? ` (${vos.length})` : ''}`}
          </button>
        ))}
      </div>

      {empty && <div className="card empty">No scope yet. Import the client’s schedule, BoQ, scope of works or works orders and every line is read for you to check. VOs go in here too, at their house.</div>}
      {filter === 'vos' && !vos.length && <div className="card empty">No variations yet. Add extras the moment you spot them, at their house.</div>}

      {hasProps ? <div className="panel prop-list">{properties.map(p => {
        const all = scope.filter(i => (i.property || '—') === p)
        const pv = vos.filter(v => houseOf(v) === p)
        const lines = shown.filter(i => (i.property || '—') === p)
        const pvShown = shownVos.filter(v => houseOf(v) === p)
        const tot = all.reduce((t, i) => t + lineValue(i.qty, i.rate), 0) + voValue(pv)
        const cl = all.filter(i => i.valuationId).reduce((t, i) => t + lineValue(i.qty, i.rate), 0) + voValue(pv.filter(v => v.valuationId))
        const pct = tot ? Math.round((cl / tot) * 100) : 0
        if (!lines.length && !pvShown.length && filter !== 'all') return null
        const vosHere = pv.filter(counts).length
        return (
          <div key={p} className="prop-item">
            {/* one line: the house, how much is there, its value; the bar under it shows its trades and how far they're claimed */}
            <button className="prop-row" onClick={() => setOpenHouse(p)} aria-haspopup="dialog" aria-label={`${p === '—' ? 'Whole job' : `Property ${p}`}${vosHere ? `, ${vosHere} VO${vosHere === 1 ? '' : 's'}` : ''}`}>
              <span className="prop-main"><span className="prop-name">{houseName(p)}</span><span className="prop-meta">{figs(`${all.length} line${all.length === 1 ? '' : 's'}`)}{vosHere > 0 && <> · {figs(`${vosHere} VO${vosHere === 1 ? '' : 's'}`)}</>}</span></span>
              <span className="prop-amt"><span className="mono">{money(tot)}</span></span>
              <span className="prop-chev" aria-hidden="true"><IconChevron size={16} /></span>
            </button>
            <div className="prop-foot"><TradeBar items={all} label={`${houseName(p)}: ${pct}% claimed`} /><span className={'prop-pct' + (pct === 100 ? ' all' : '')}>{pct === 100 && <IconCheck size={13} />}{fig(`${pct}%`)}</span></div>
          </div>
        )
      })}</div> : houseBody(properties[0] ?? '—', false)}

      {openHouse && <Sheet onClose={() => { setOpenHouse(null); setConfirmAll(null) }} label={houseName(openHouse)} className="house-sheet">{houseBody(openHouse, true)}</Sheet>}

      {!empty && <div className="hint" style={{ textAlign: 'center' }}>Tick a line or a priced VO to put it in the open valuation. Untick to send it back.</div>}
    </div>
  )
}

export function ScopeForm({ item, jobId, nextOrder, rooms, props = [], streams = [], locked, books = [], onSave, onDelete, onClose }: {
  item?: ScopeItem; jobId: string; nextOrder: number; rooms: string[]; props?: string[]; streams?: string[]; locked: boolean; books?: RateBook[]
  onSave: (i: ScopeItem) => void; onDelete?: () => void; onClose: () => void
}) {
  const [f, setF] = useState<ScopeItem>(item ?? { id: uid(), jobId, code: '', description: '', room: rooms[rooms.length - 1] ?? 'General', qty: null, unit: 'nr', rate: null, valuationId: null, order: nextOrder, createdAt: Date.now() })
  const [qty, setQty] = useState(item?.qty != null ? String(item.qty) : '')
  const [rate, setRate] = useState(item?.rate != null ? String(item.rate) : '')
  const n = (s: string) => { const v = parseFloat(s.replace(/[£,]/g, '')); return isFinite(v) && v > 0 ? v : null }
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">{item ? 'Scope line' : 'Add a line'}</h2>
        {locked && <div className="flag">Claimed on an issued valuation — locked.</div>}
        <div className="row">
          <div style={{ width: '38%' }}><Field label="SoR code"><input disabled={locked} value={f.code} autoCapitalize="characters" onChange={e => setF({ ...f, code: e.target.value, rateBook: undefined })} /></Field></div>
          <div className="grow"><Field label="Room / area"><input disabled={locked} value={f.room} onChange={e => setF({ ...f, room: e.target.value })} list="rooms" /></Field></div>
        </div>
        <div className="row">
          <div style={{ width: '38%' }}><Field label="Property no." hint="Multi-property jobs"><input disabled={locked} value={f.property ?? ''} onChange={e => setF({ ...f, property: e.target.value.replace(/^(no\.?|plot|house)\s*/i, '') || undefined })} list="props" placeholder="e.g. 4" /></Field></div>
          <div className="grow"><Field label="Workstream"><input disabled={locked} value={f.workstream ?? ''} onChange={e => setF({ ...f, workstream: e.target.value || undefined })} list="streams" placeholder="e.g. PPR Paint" /></Field></div>
          <datalist id="props">{props.map(r => <option key={r} value={r} />)}</datalist>
          <datalist id="streams">{streams.map(r => <option key={r} value={r} />)}</datalist>
          <datalist id="rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
        </div>
        {!locked && <RateLookup code={f.code} books={books} onUse={(i, b) => { setF({ ...f, code: i.code, unit: i.unit, rateBook: b?.name, description: f.description.trim() ? f.description : i.short }); setRate(String(i.rate)) }} />}
        <Field label="Description *"><textarea disabled={locked} rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <div className="row">
          <div className="grow"><Field label="Qty"><input disabled={locked} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="Not stated" /></Field></div>
          <div style={{ width: '22%' }}><Field label="Unit"><input disabled={locked} value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></Field></div>
          <div className="grow"><Field label="Rate (£)" hint={f.rateBook ? `From ${f.rateBook}` : undefined}><input disabled={locked} inputMode="decimal" value={rate} onChange={e => { setRate(e.target.value); setF({ ...f, rateBook: undefined }) }} placeholder="No rate" /></Field></div>
        </div>
        <div className="amt" style={{ fontSize: 20, fontWeight: 700, color: n(qty) && n(rate) ? 'var(--ink-2)' : 'var(--ink-muted)' }}>
          {n(qty) && n(rate) ? money(n(qty)! * n(rate)!) : 'Qty × rate'}
        </div>
        {!locked && <button className="btn btn-primary" disabled={!f.description.trim()} onClick={() => onSave({ ...f, description: f.description.trim(), room: f.room.trim() || 'General', code: f.code.trim(), qty: n(qty), rate: n(rate) })}>{item ? 'Save' : 'Add line'}</button>}
        {onDelete && !locked && <ConfirmDelete label="Delete…" confirmLabel={<>Delete this item</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}
