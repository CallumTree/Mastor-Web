import { Fragment, useState, type ReactNode } from 'react'
import { useAccess } from '../lib/access'
import { jobMargin, type Margin } from '../lib/margin'
import type { Cost, DiaryEntry, Job, JobDocument, ScopeItem, Valuation, Variation, WorkOrder, SiteSuggestion } from '../lib/types'
import { OrdersTab, isOverdue } from './Orders'
import { DocumentsPanel } from './Documents'
import { lineValue } from '../lib/valuation'
import { money, ukDate, upliftFactor } from '../lib/format'
import { IconBack, IconCamera, IconDiary, IconDoc, IconFlag, IconHome, IconMarkup, IconPin, IconScope, IconSettings, IconValuation, IconVideo, IconClock, IconMic } from '../components/Icons'
import { VariationsTab } from './Variations'
import { ScopeTab } from './Scope'
import { DiaryTab, VoiceSheet } from './Diary'
import { NoteEditor, NoteRow, NotesSheet, newNote, sortNotes } from './Notes'
import { dayKey } from '../lib/dates'
import { Sheet, TitleBlock } from '../components/Ui'
import { SignMark, SIGN_WORD, type SignKind } from '../components/Sign'
import { ValuationsTab } from './Valuations'
import { pennies, upliftAmounts, valRef, valTotals } from '../lib/valuation'
import { Field } from '../components/Ui'
import { valCourt, voCourt, VO_CHASE_AMBER } from '../lib/chase'
import { fitLen } from '../components/Register'

/** whole pounds, rounded (never cut off): £2,972.97 → £2,973 */
const pounds = (n: number) => money(Math.round(n)).replace(/\.00$/, '')

export type Tab = 'home' | 'diary' | 'scope' | 'vos' | 'vals'

/** The job's black bar: where you are, and the way back. No decoration — the work starts underneath it. */
function Hero({ job, compact, onBack, onSetup }: { job: Job; compact: boolean; onBack: () => void; onSetup: () => void }) {
  return (
    <header className={'jbar bleed' + (compact ? ' compact' : '')}>
      <div className="jbar-in">
        <button className="icon-btn on-dark" onClick={onBack} aria-label="All jobs"><IconBack size={20} /></button>
        <div className="jbar-title">
          <div className="jbar-ref mono">{job.contractRef || job.workType}{job.status !== 'Active' ? ` · ${job.status}` : ''}</div>
          <h1 className="jbar-name">{job.name}</h1>
          {!compact && (job.client || job.address) && <div className="jbar-sub">{[job.client, job.address].filter(Boolean).join(' · ')}</div>}
        </div>
        {useAccess().money ? <button className="icon-btn on-dark" onClick={onSetup} aria-label="Job setup"><IconSettings size={20} /></button> : <span className="icon-gap" />}
      </div>
    </header>
  )
}

const FigN = ({ text, neg }: { text: string; neg?: boolean }) => <div className={'fig-n' + (neg ? ' neg' : '')} style={fitLen(text)}>{text}</div>

function Home({ job, vos, scope, vals, go, onSetup, onUpdateJob, notes, onSaveNote, onDeleteNote, margin, onCosts, orders, documents }: { job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]; go: (t: Tab) => void; onSetup: () => void; onUpdateJob: (j: Job) => void; notes: DiaryEntry[]; onSaveNote: (n: DiaryEntry) => void; onDeleteNote: (n: DiaryEntry) => void; margin: Margin; onCosts: () => void; orders: WorkOrder[]; documents: ReactNode }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteEdit, setNoteEdit] = useState<DiaryEntry | null>(null)
  const open = vals.find(v => v.status === 'Open')
  const openTotals = open ? valTotals(job, open.id, scope, vos) : null
  const certified = vals.filter(v => v.status === 'Issued').reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const live = vos.filter(v => v.status !== 'Rejected')
  const priced = live.filter(v => v.qty != null && v.rate != null)
  const unpriced = live.filter(v => v.rate == null).length
  const unmeasured = live.filter(v => v.qty == null).length
  const voBase = priced.reduce((s, v) => s + lineValue(v.qty, v.rate), 0)
  const voGross = voBase * upliftFactor(job.uplift1, job.uplift2)

  const { money: seesMoney } = useAccess()
  const actions: { text: string; hint: string; colour: string; onClick: () => void; site?: boolean }[] = []
  // Uplifts must turn the BoQ into the PO's all-in figure. A known, accepted difference becomes a note;
  // if the difference changes after it was accepted, it's flagged again.
  const scopeBase = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  let poNote: string | null = null
  const [gapOpen, setGapOpen] = useState(false)
  let gap: { withUplifts: number; diff: number; needed: number } | null = null
  if (scopeBase > 0 && job.contractValue > 0) {
    const withUplifts = upliftAmounts(pennies(scopeBase), job.uplift1, job.uplift2).gross
    const diff = pennies(withUplifts - job.contractValue)
    if (Math.abs(diff) / job.contractValue > 0.0005) {
      gap = { withUplifts, diff, needed: (job.contractValue / scopeBase - 1) * 100 }
      const acc = job.poGapAccepted
      if (acc && Math.abs(acc.diff - diff) < 0.01) poNote = `PO difference of ${money(Math.abs(diff))} accepted ${ukDate(acc.at)}${acc.note ? ` — ${acc.note}` : ''}`
      else actions.push({ text: acc ? 'PO difference has changed since you accepted it' : "BoQ doesn't reconcile with the PO",
        hint: `BoQ ${money(scopeBase)} + ${job.uplift1}% + ${job.uplift2}% = ${money(withUplifts)}; PO is ${money(job.contractValue)} (${diff > 0 ? 'over' : 'under'} by ${money(Math.abs(diff))}). Tap to review or accept.`,
        colour: 'var(--red)', onClick: () => setGapOpen(true) })
    }
  }
  for (const v of vals.filter(x => x.status === 'Issued')) {
    const c = valCourt(v, job, scope, vos)
    if (c.tone === 'late') actions.push({ text: `${valRef(v.number)} overdue — ${money(c.owed)}`, hint: c.text + ' · chase the client', colour: 'var(--red)', onClick: () => go('vals') })
    else if (c.tone === 'due') actions.push({ text: `${valRef(v.number)} payment due soon`, hint: c.text, colour: 'var(--amber)', onClick: () => go('vals') })
  }
  const waiting = vos.filter(v => { const c = voCourt(v, vals); return c.who === 'client' && (c.days ?? 0) >= VO_CHASE_AMBER })
  if (waiting.length) actions.push({ text: `${waiting.length} VO${waiting.length === 1 ? '' : 's'} waiting on the client ${VO_CHASE_AMBER}+ days`, hint: 'Chase for an instruction', colour: waiting.some(v => voCourt(v, vals).tone === 'late') ? 'var(--red)' : 'var(--amber)', onClick: () => go('vos') })
  const toSend = vos.filter(v => voCourt(v, vals).text.startsWith('Send')).length
  if (toSend) actions.push({ text: `${toSend} priced VO${toSend === 1 ? '' : 's'} not sent to the client`, hint: 'Send for instruction so the clock starts', colour: 'var(--amber)', onClick: () => go('vos') })
  if (!job.poNumber) actions.push({ text: 'No PO number', hint: 'Invoices will be rejected without it', colour: 'var(--red)', onClick: onSetup })
  if (unpriced) actions.push({ text: `${unpriced} variation${unpriced === 1 ? '' : 's'} unpriced`, hint: 'Add SoR code and rate so they can be claimed', colour: 'var(--amber)', onClick: () => go('vos') })
  if (unmeasured) actions.push({ text: `${unmeasured} variation${unmeasured === 1 ? '' : 's'} not measured`, hint: 'Measure on site', colour: 'var(--amber)', onClick: () => go('vos'), site: true })
  if (open && openTotals && openTotals.lines > 0) actions.push({ text: `${valRef(open.number)}: ${money(openTotals.gross)} ready`, hint: `${openTotals.lines} line${openTotals.lines === 1 ? '' : 's'} — review and issue`, colour: 'var(--green)', onClick: () => go('vals') })
  if (job.kind === 'orders') {
    const late = orders.filter(o => isOverdue(o))
    if (late.length) actions.push({ text: `${late.length} order${late.length === 1 ? '' : 's'} overdue`, hint: late.slice(0, 3).map(o => `${o.ref} ${o.address}`).join(' · '), colour: 'var(--red)', onClick: () => go('scope'), site: true })
    const noPhotos = orders.filter(o => o.status === 'complete' && !o.afterIds.length).length
    if (noPhotos) actions.push({ text: `${noPhotos} finished order${noPhotos === 1 ? '' : 's'} without after photos`, hint: 'Clients usually ask for them before paying', colour: 'var(--amber)', onClick: () => go('scope'), site: true })
    const ready = orders.filter(o => o.status === 'complete' && scope.some(i => i.orderId === o.id && !i.valuationId && i.qty != null && i.rate != null)).length
    if (ready) actions.push({ text: `${ready} completed order${ready === 1 ? '' : 's'} not claimed`, hint: 'Claim them into this month’s valuation', colour: 'var(--amber)', onClick: () => go('scope') })
    if (!orders.length) actions.push({ text: 'No orders yet', hint: 'Add each works order as it comes in', colour: 'var(--amber)', onClick: () => go('scope'), site: true })
  } else if (scope.length === 0) actions.push({ text: 'No scope yet', hint: 'Add the works order items', colour: 'var(--amber)', onClick: () => go('scope'), site: true })
  // operatives: only the site actions — nothing about money, POs or the client
  if (!seesMoney) for (let i = actions.length - 1; i >= 0; i--) if (!actions[i].site) actions.splice(i, 1)

  return (
    <div>
      {seesMoney && <div className="figs">
        <div className="fig"><FigN text={job.contractValue ? pounds(job.contractValue) : '—'} /><div className="fig-l">Contract</div></div>
        <div className="fig"><FigN text={pounds(certified)} /><div className="fig-l">Certified</div></div>
        <div className="fig"><FigN text={pounds(voGross)} /><div className="fig-l">Variations</div>{(unpriced || unmeasured) > 0 && <div className="fig-note">+ {Math.max(unpriced, unmeasured)} not priced</div>}</div>
        <button className="fig fig-btn" onClick={onCosts} aria-label={`Margin ${pounds(margin.margin)} — costs and margin`}>
          <FigN text={margin.costs || margin.labourEstimate != null ? pounds(margin.margin) : '—'} neg={margin.margin < 0} />
          <div className="fig-l">Margin ›</div>
          {margin.costs || margin.labourEstimate != null
            ? (margin.provisional.length ? <div className="fig-note">Provisional</div> : margin.pct != null && <div className="fig-sub">{margin.pct}% · costs {pounds(margin.costs)}</div>)
            : <div className="fig-sub">Add costs</div>}
        </button>
      </div>}
      <h2 className="sec-h">{actions.length ? `Action needed · ${actions.length}` : 'All clear'}</h2>
      <div className="acts">
        {actions.length === 0 && <div className="act act-clear"><SignMark kind="ok" size={22} /><span>Nothing outstanding on this job.</span></div>}
        {actions.map((a, i) => {
          const kind: SignKind = a.colour === 'var(--red)' ? 'stop' : a.colour === 'var(--green)' ? 'ok' : 'warn'
          return (
            <button key={i} className={'act act-' + kind} onClick={a.onClick}>
              <SignMark kind={kind} size={22} />
              <span className="grow"><span className="sr-only">{SIGN_WORD[kind]}: </span><span className="act-t">{a.text}</span><span className="act-h">{a.hint}</span></span>
              <svg aria-hidden="true" className="act-chev" width="10" height="16" viewBox="0 0 10 16"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" /></svg>
            </button>
          )
        })}
      </div>
      {poNote && <div className="panel t-small" style={{ padding: '10px 14px', marginTop: 10 }}><span className="label" style={{ marginRight: 6 }}>PO</span>{poNote} · <button className="linkish tap slate" onClick={() => setGapOpen(true)}>review</button></div>}
      {gapOpen && gap && <PoGapSheet job={job} gap={gap} onClose={() => setGapOpen(false)} onSetup={() => { setGapOpen(false); onSetup() }} onSave={j => {
        setGapOpen(false); onUpdateJob(j)
        // the reason goes on record in the job's notes
        if (j.poGapAccepted) onSaveNote(newNote(job, `PO difference of ${money(Math.abs(j.poGapAccepted.diff))} accepted (BoQ ${j.poGapAccepted.diff > 0 ? 'over' : 'under'} PO): ${j.poGapAccepted.note}`, 'Commercial'))
      }} />}
      <div className="row" style={{ margin: '18px 0 8px' }}>
        <h2 className="sec-h grow" style={{ margin: 0 }}>Notes &amp; decisions</h2>
        <button className="linkish tap t-note slate" onClick={() => setNotesOpen(true)}>{notes.length ? `All ${notes.length}` : '+ Add'}</button>
      </div>
      <div className="panel" style={{ padding: '0 14px' }}>
        {notes.length === 0 && <button className="muted" onClick={() => setNotesOpen(true)} style={{ background: 'none', border: 'none', padding: '14px 0', textAlign: 'left', width: '100%' }}>Agreements, client requests, chasers — put them on record.</button>}
        {[...notes].sort(sortNotes).slice(0, 3).map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}><NoteRow n={n} onOpen={() => setNoteEdit(n)} /></div>)}
      </div>
      {documents}
      {notesOpen && <NotesSheet job={job} notes={notes} onClose={() => setNotesOpen(false)} onSave={onSaveNote} onDelete={onDeleteNote} />}
      {noteEdit && <NoteEditor job={job} note={noteEdit} onClose={() => setNoteEdit(null)} onSave={n => { onSaveNote(n); setNoteEdit(null) }} onDelete={() => { onDeleteNote(noteEdit); setNoteEdit(null) }} />}
      {seesMoney && <div className="hint" style={{ marginTop: 12 }}>
        PO {job.poNumber || 'not set'} · Uplifts {job.uplift1}% + {job.uplift2}% · Variations shown incl. uplifts
      </div>}
    </div>
  )
}

/** Tabs that are all money: operatives don't get them. */
const MONEY_TABS: Tab[] = ['vals']
const NAV: { tab: Tab; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { tab: 'home', label: 'Home', Icon: IconHome },
  { tab: 'diary', label: 'Diary', Icon: IconDiary },
  { tab: 'scope', label: 'Scope', Icon: IconScope },
  { tab: 'vos', label: 'VOs', Icon: IconMarkup },
  { tab: 'vals', label: 'Vals', Icon: IconValuation },
]

export function JobView(p: {
  job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]
  onBack: () => void; onSetup: () => void; onUpdateJob: (j: Job) => void; onLogVariation: () => void; onImportVo: () => void; onVoRegister: () => void; onEditVariation: (v: Variation) => void
  onToggleVo: (v: Variation) => void; onToggleScope: (i: ScopeItem) => void; onClaimMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onDeleteScope: (items: ScopeItem[]) => void; onAddScope: () => void; onEditScope: (i: ScopeItem) => void; onImportScope: () => void; onCheckRates?: () => void; onEvidence: () => Promise<void>
  onIssue: (v: Valuation) => Promise<Valuation>; onDeleteOpenVal: (v: Valuation) => void; onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>; onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
  costs: Cost[]; dayRate?: number | null; onCosts: () => void
  onDayworks: (fresh: boolean) => void
  docs: JobDocument[]; onAddDoc: (file: File, kind: JobDocument['kind'], name: string) => Promise<void>; onOpenDoc: (d: JobDocument) => Promise<void>; onDeleteDoc: (d: JobDocument) => Promise<void>
  orders: WorkOrder[]; onNewOrder: () => void; onOpenOrder: (o: WorkOrder) => void; onClaimOrders: (lines: ScopeItem[]) => void
  diary: DiaryEntry[]; onSaveDiary: (e: DiaryEntry, markedUp?: Blob) => void; onDeleteDiary: (e: DiaryEntry) => void
  onAddMedia: (file: File | Blob, kind: 'photo' | 'video' | 'voice', date: string) => Promise<void>; onRaiseVoFromPhoto: (e: DiaryEntry) => void
  onReadSite?: (date: string) => Promise<string>
  onDecideSite?: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>
}) {
  const { job, vos, scope, vals, onBack, onSetup, onLogVariation, onEditVariation } = p
  const access = useAccess()
  const nav = NAV.filter(n => access.money || !MONEY_TABS.includes(n.tab))
  const [tab, setTab] = useState<Tab>('home')
  const [diaryDate, setDiaryDate] = useState(dayKey())
  const [capture, setCapture] = useState(false)
  const [focusNote, setFocusNote] = useState(false)
  const [capErr, setCapErr] = useState<string | null>(null)
  const [quickNote, setQuickNote] = useState(false)
  const [quickVoice, setQuickVoice] = useState(false)
  const quickAdd = async (f: File | undefined, kind: 'photo' | 'video') => {
    if (!f) return
    setCapErr(null)
    try { const d = dayKey(); await p.onAddMedia(f, kind, d); setDiaryDate(d); setCapture(false); setTab('diary') }
    catch (x) { setCapErr((x as Error).message) }
  }
  return (
    <>
      <main className="page with-rail">
        <Hero job={job} compact={tab !== 'home'} onBack={onBack} onSetup={onSetup} />
        {tab === 'home' && <Home job={job} vos={vos} scope={scope} vals={vals} go={setTab} onSetup={onSetup} onUpdateJob={p.onUpdateJob}
          margin={jobMargin(job, scope, vos, p.costs, p.diary, p.dayRate)} onCosts={p.onCosts} orders={p.orders}
          documents={<DocumentsPanel docs={p.docs} onAdd={p.onAddDoc} onOpen={p.onOpenDoc} onDelete={p.onDeleteDoc} />}
          notes={p.diary.filter(d => d.type === 'note' && (access.money || d.category !== 'Commercial'))} onSaveNote={e => p.onSaveDiary(e)} onDeleteNote={p.onDeleteDiary} />}
        {tab === 'vos' && <VariationsTab job={job} vos={vos} vals={vals} onDayworks={() => p.onDayworks(false)} onLog={onLogVariation} onEdit={onEditVariation} onToggle={p.onToggleVo} onImportVo={p.onImportVo} onRegister={p.onVoRegister} />}
        {tab === 'diary' && <DiaryTab job={job} entries={p.diary} rooms={[...new Set(scope.map(s => s.room))]} vos={vos}
          date={diaryDate} setDate={setDiaryDate} focusNote={focusNote}
          onSave={p.onSaveDiary} onDelete={p.onDeleteDiary} onAddMedia={p.onAddMedia} onRaiseVo={p.onRaiseVoFromPhoto} onRead={p.onReadSite} />}
        {tab === 'scope' && job.kind === 'orders' && <OrdersTab job={job} orders={p.orders} scope={scope} vals={vals} onNew={p.onNewOrder} onOpen={p.onOpenOrder} onClaim={p.onClaimOrders} />}
        {tab === 'scope' && job.kind !== 'orders' && <ScopeTab job={job} scope={scope} vals={vals} onToggle={p.onToggleScope} onToggleMany={p.onClaimMany} onClearUnclaimed={p.onClearUnclaimed} onDeleteAll={p.onDeleteScope} onAdd={p.onAddScope} onEdit={p.onEditScope} onImport={p.onImportScope} onCheckRates={p.onCheckRates} onEvidence={p.onEvidence} />}
        {tab === 'vals' && access.money && <ValuationsTab job={job} scope={scope} vos={vos} vals={vals} go={setTab}
          onRemoveScope={p.onToggleScope} onRemoveVo={p.onToggleVo} onIssue={p.onIssue} onDeleteOpen={p.onDeleteOpenVal} onPaid={p.onPaid} onCertificate={p.onCertificate} onCreateInvoice={p.onCreateInvoice} onInvoicePdf={p.onInvoicePdf} diary={p.diary} onDecideSite={p.onDecideSite} />}
      </main>
      <nav className="nav">
        {nav.map(({ tab: t, label: navLabel, Icon }, i) => { const label = t === 'scope' && job.kind === 'orders' ? 'Orders' : navLabel; return (
          <Fragment key={t}>{i === 2 && (
            <button className="nav-capture" aria-label="Capture" onClick={() => { setCapErr(null); setCapture(true) }}><span>+</span></button>
          )}
          <button className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => { setFocusNote(false); setTab(t) }}><Icon /><span className="nav-l">{label}</span></button></Fragment>
        ) })}
      </nav>
      {quickNote && <NoteEditor job={job} onClose={() => setQuickNote(false)} onSave={n => { p.onSaveDiary(n); setQuickNote(false) }} />}
      {quickVoice && <VoiceSheet onClose={() => setQuickVoice(false)} onSave={async b => { const d = dayKey(); await p.onAddMedia(b, 'voice', d); setQuickVoice(false); setDiaryDate(d); setTab('diary') }} />}
      {capture && (
        <Sheet onClose={() => setCapture(false)}>
          <div className="stack">
            <h2 className="label bracket">Capture · {job.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="btn btn-secondary"><IconCamera /> Photo
                <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={e => { quickAdd(e.target.files?.[0], 'photo'); e.target.value = '' }} /></label>
              <label className="btn btn-secondary"><IconVideo /> Video
                <input type="file" className="sr-only" accept="video/*" capture="environment" onChange={e => { quickAdd(e.target.files?.[0], 'video'); e.target.value = '' }} /></label>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); setQuickVoice(true) }}><IconMic /> Voice note</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); onLogVariation() }}><IconFlag /> Variation</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); p.onDayworks(true) }}><IconClock /> Dayworks</button>
              {access.money && <button className="btn btn-secondary" onClick={() => { setCapture(false); p.onImportVo() }}><IconDoc /> Council VO</button>}
              <button className="btn btn-secondary" onClick={() => { setCapture(false); setQuickNote(true) }}><IconPin /> Note</button>
            </div>
            {capErr && <div className="flag">{capErr}</div>}
            <div className="hint">Photos, video and voice notes go into today’s diary. Today’s site log (weather, labour, what happened) is on the Diary tab.</div>
          </div>
        </Sheet>
      )}
    </>
  )
}

function PoGapSheet({ job, gap, onSave, onSetup, onClose }: {
  job: Job; gap: { withUplifts: number; diff: number; needed: number }; onSave: (j: Job) => void; onSetup: () => void; onClose: () => void
}) {
  const accepted = job.poGapAccepted && Math.abs(job.poGapAccepted.diff - gap.diff) < 0.01
  const [note, setNote] = useState(accepted ? job.poGapAccepted!.note : '')
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">BoQ vs PO</h2>
        <TitleBlock head={[gap.diff > 0 ? 'BoQ is over the PO by' : 'BoQ is under the PO by', money(Math.abs(gap.diff))]}
          rows={[[['BoQ + uplifts', money(gap.withUplifts)], ['PO value', money(job.contractValue)]], [['Uplifts set', `${job.uplift1}% + ${job.uplift2}%`], ['Would reconcile at', `${gap.needed.toFixed(2)}% combined`]]]} />
        <div className="hint">Common reasons: items added after the PO was raised, a PO line missing, or the wrong uplifts. If you know why and will claim it anyway, accept it with a note — it'll stay recorded, and flag again if the difference changes.</div>
        <Field label="Why (for the record)"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Kitchen partition + ceiling patch added after PO — Dylan aware, will be claimed" /></Field>
        <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSave({ ...job, poGapAccepted: { diff: gap.diff, note: note.trim(), at: Date.now() } })}>{accepted ? 'Update note' : `Accept ${money(Math.abs(gap.diff))} difference`}</button>
        <button className="btn btn-secondary" onClick={onSetup}>Check uplifts / PO value in job setup</button>
        {accepted && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...job, poGapAccepted: null })}>Withdraw acceptance (flag it again)</button>}
      </div>
    </Sheet>
  )
}
