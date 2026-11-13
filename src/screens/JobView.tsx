import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TradeCores } from '../components/Trade'
import { jobCores } from '../lib/trade'
import { useAccess } from '../lib/access'
import { jobMargin, type Margin } from '../lib/margin'
import { type Cost, type DiaryEntry, type Job, type JobDocument, type ScopeItem, type Valuation, type Variation, type WorkOrder, type SiteSuggestion } from '../lib/types'
import { OrdersTab } from './Orders'
import { DocumentsPanel } from './Documents'
import { money } from '../lib/format'
import { placeParam, setPlace } from '../lib/place'
import { IconBack, IconCamera, IconChevron, IconDiary, IconFlag, IconHome, IconPin, IconScope, IconSettings, IconValuation, IconVideo, IconClock, IconMic, IconPlus, IconAsk } from '../components/Icons'
import { VoList } from './Variations'
import { ScopeTab } from './Scope'
import { DiaryTab, VoiceSheet } from './Diary'
import { JobLine, type LineMark } from './Plan'
import { NoteEditor, NoteRow, NotesSheet, newNote, sortNotes } from './Notes'
import { dayKey } from '../lib/dates'
import { Sheet, TitleBlock } from '../components/Ui'
import { ByClaude, SignMark, SIGN_WORD, type SignKind } from '../components/Sign'
import { currentCompany } from '../lib/sync'
import { ValuationsTab } from './Valuations'
import { AskTab } from './Ask'
import { isCertified, isWithClient, jobWorth, valRef, valTotals } from '../lib/valuation'
import { Field } from '../components/Ui'
import { SumStrip } from '../components/Register'
import { doneMark, doneMarks } from '../lib/siteDone'
import { reducedMotion } from '../lib/motion'
import { jobAlerts, type AlertPlace } from '../lib/alerts'
import { lastText, valRhythm, weekText } from '../lib/rhythm'
import { fig, figs } from '../components/Figs'
import { DockShape, captureSlot } from '../components/Dock'
import { offerUndo } from '../lib/undo'


export type Tab = 'home' | 'diary' | 'scope' | 'vos' | 'vals' | 'ask'

export interface Rail { done: number; sent: number; next: number; label: string; short: string }

/** How far the job has got, the same line on every tab, for people who see money: certified (agreed) to date, then
 *  what's with the client, then the open valuation, against what the job is worth (jobWorth, the figure Vals shows).
 *  Lines done for everyone else. */
function jobRail(job: Job, scope: ScopeItem[], vals: Valuation[], vos: Variation[], money: boolean, diary: DiaryEntry[] = []): Rail | null {
  const worth = jobWorth(job, scope, vos).total
  if (money && worth > 0) {
    const sum = (vs: Valuation[]) => vs.reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0) / worth
    const done = sum(vals.filter(isCertified)), sent = sum(vals.filter(isWithClient))
    const open = vals.find(v => v.status === 'Open')
    const next = open ? valTotals(job, open.id, scope, vos).gross / worth : 0
    const pct = (x: number) => `${Math.round(x * 100)}%`
    // the short form on the other tabs keeps its words, so "0%" never sits beside Vals' "43% claimed" unexplained
    return { done, sent, next, short: sent + next > 0.004 ? `${pct(done)} cert. · ${pct(done + sent + next)} claimed` : `${pct(done)} certified`,
      label: [`${pct(done)} certified`, sent > 0.004 ? `${pct(sent)} with client` : '', next > 0.004 ? `${valRef(open!.number)} ${pct(next)} more` : ''].filter(Boolean).join(' · ') }
  }
  if (!scope.length) return null
  // done on site: marked done from the phone, or already signed off in a valuation
  const marks = doneMarks(diary)
  const n = scope.filter(i => i.valuationId || marks.has(i.id)).length
  return { done: n / scope.length, sent: 0, next: 0, label: `${n} of ${scope.length} lines done`, short: `${n}/${scope.length}` }
}

/** The open valuation's dashed piece of the job's line. It spans everything not yet certified and is clipped to
 *  the valuation's share, so a tick grows it without stretching the dashes; the piece just added shows solid
 *  cyan while it grows, then settles into the dashes. Nothing moves when the job first opens. */
function RailNext({ done, next }: { done: number; next: number }) {
  const d = Math.max(0, Math.min(1, done)), room = 1 - d
  const n = Math.max(0, Math.min(room, next))
  const prev = useRef(n)
  const [grew, setGrew] = useState<{ from: number; to: number; k: number } | null>(null)
  useLayoutEffect(() => {
    const from = prev.current; prev.current = n
    if (n <= from + 0.0005 || reducedMotion()) return
    setGrew(g => ({ from, to: n, k: (g?.k ?? 0) + 1 }))
    const t = setTimeout(() => setGrew(null), 1200)
    return () => clearTimeout(t)
  }, [n])
  if (room <= 0) return null
  return (
    <i className="jrail-next" style={{ left: d > 0 ? `max(6px, ${d * 100}%)` : 0, clipPath: `inset(0 ${(1 - n / room) * 100}% 0 0)` }}>
      {grew && <i key={grew.k} className="jrail-new" style={{ left: `${grew.from / room * 100}%`, width: `${(grew.to - grew.from) / room * 100}%` }} />}
    </i>
  )
}

/** The job's black header: where you are, the way back, and the neon rail of how far the job has got. */
function Hero({ job, compact, rail, onBack, onSetup, onClerk, inClerk }: { job: Job; compact: boolean; rail: Rail | null; onBack: () => void; onSetup: () => void; onClerk: () => void; inClerk: boolean }) {
  const { money: seesMoney } = useAccess()
  return (
    <header className={'jbar bleed' + (compact ? ' compact' : '')}>
      <div className="jbar-in">
        <button className="back-btn" onClick={onBack}><IconBack size={18} /><span>Jobs</span></button>
        <div className="jbar-title">
          {/* the name, and the status only when it isn't the usual; the ref, client and address are in Setup */}
          {job.status !== 'Active' && <div className="jbar-ref">{job.status}</div>}
          <h1 className="jbar-name">{job.name}</h1>
        </div>
        <div className="jbar-tools">
          {/* Clerk sits with the job, not in the dock: one tap from any tab */}
          <button className={'icon-btn on-dark labelled' + (inClerk ? ' on' : '')} onClick={onClerk} aria-current={inClerk ? 'page' : undefined}><IconAsk size={18} /><span className="ib-l">Clerk</span></button>
          {seesMoney && <button className="icon-btn on-dark labelled" onClick={onSetup} aria-label="Job setup"><IconSettings size={18} /><span className="ib-l" aria-hidden="true">Setup</span></button>}
        </div>
      </div>
      {rail && (
        <div className="jrail-in">
          <div className="jrail" role="img" aria-label={rail.label}>
            <i className="jrail-done" style={{ width: `${Math.min(100, rail.done * 100)}%`, minWidth: rail.done > 0 ? 6 : 0 }} />
            {rail.sent > 0 && <i className="jrail-sent" style={{ width: `${Math.min(100 - rail.done * 100, rail.sent * 100)}%` }} />}
            <RailNext done={rail.done + rail.sent} next={rail.next} />
            <b className="jrail-tick" style={{ left: `max(6px, ${Math.min(100, rail.done * 100)}%)` }} />
          </div>
          <span className="jrail-label" aria-hidden="true">{compact ? rail.short : rail.label}</span>
        </div>
      )}
    </header>
  )
}


function Home({ job, vos, scope, vals, go, onSetup, onUpdateJob, notes, onSaveNote, onDeleteNote, onOpenDay, margin, onCosts, orders, documents, diary }: { job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]; go: (t: Tab) => void; onSetup: () => void; onUpdateJob: (j: Job) => void; notes: DiaryEntry[]; onSaveNote: (n: DiaryEntry) => void; onDeleteNote: (n: DiaryEntry) => void; onOpenDay: (date: string) => void; margin: Margin; onCosts: () => void; orders: WorkOrder[]; documents: ReactNode; diary: DiaryEntry[] }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteEdit, setNoteEdit] = useState<DiaryEntry | null>(null)
  const pinned = notes.filter(n => n.pinned).sort(sortNotes)
  const days = diary.filter(d => d.type === 'day' && d.note.trim())
  const open = vals.find(v => v.status === 'Open')
  const openTotals = open ? valTotals(job, open.id, scope, vos) : null
  const certified = vals.filter(isCertified).reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const withClient = vals.filter(isWithClient).reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const worth = jobWorth(job, scope, vos)
  const live = vos.filter(v => v.status !== 'Rejected')
  const unpriced = live.filter(v => v.rate == null).length
  const unmeasured = live.filter(v => v.qty == null).length

  const { money: seesMoney } = useAccess()
  const [gapOpen, setGapOpen] = useState(false)
  // the same alerts Claude reads through the connector (lib/alerts); operatives see only the site ones
  const { alerts, gap, poNote } = jobAlerts(job, scope, vos, vals, orders, Date.now(), diary)
  const placeAction = (p: AlertPlace) => (p === 'gap' ? () => setGapOpen(true) : p === 'setup' ? onSetup : () => go(p))
  const actions = alerts.filter(a => seesMoney || a.site).map(a => ({ ...a, onClick: placeAction(a.place) }))
  const liveAt = actions.findIndex(a => a.kind === 'do')   // one live thing: the first next step
  // the margin row's note: provisional, its share and costs, or a nudge to add costs (set in the mono by the ledger)
  const marginNote = !(margin.costs || margin.labourEstimate != null) ? { note: 'Add costs' } : margin.provisional.length ? { warn: 'Provisional' } : { note: `costs so far ${money(margin.costs)}${margin.pct != null ? ` · ${margin.pct}%` : ''}` }

  return (
    <div>
      {seesMoney && <SumStrip label="Job figures" caption="With uplifts, excl. VAT: the same figures as Vals." cells={[
        { label: 'Contract', value: money(worth.contract), nil: !worth.contract, note: worth.fromScope && worth.contract ? 'the scope at its rates; no contract value yet' : undefined },
        { label: 'Certified', value: money(certified), nil: !certified, note: withClient ? `agreed · + ${money(withClient)} with client` : certified ? 'agreed by the client' : undefined },
        { label: 'Variations', value: money(worth.vos), nil: !worth.vos, warn: (unpriced || unmeasured) > 0 ? `+ ${Math.max(unpriced, unmeasured)} not priced` : undefined },
        { label: 'Margin so far', value: money(margin.margin), nil: !(margin.costs || margin.labourEstimate != null), neg: margin.margin < 0, onClick: onCosts, action: `Margin so far ${money(margin.margin)} — costs and margin`,
          ...marginNote },
      ]} />}
      <h2 className="sec-h">{actions.length ? `Action needed · ${actions.length}` : 'All clear'}</h2>
      <div className="acts">
        {actions.length === 0 && <div className="act act-clear"><SignMark kind="ok" size={22} /><span>Nothing outstanding on this job.</span></div>}
        {actions.map((a, i) => {
          const kind: SignKind = a.kind
          return (
            <button key={i} className={'act act-' + kind + (i === liveAt ? ' live' : '')} onClick={a.onClick}>
              <SignMark kind={kind} size={22} />
              <span className="grow"><span className="sr-only">{SIGN_WORD[kind]}: </span><span className="act-t">{figs(a.text)}</span><span className="act-h">{figs(a.hint)}</span></span>
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
      {/* notes are written on the day, in the diary; the job's home keeps only the pinned ones in view */}
      {(notes.length > 0 || days.length > 0) && <>
        <div className="row" style={{ margin: '18px 0 8px' }}>
          <h2 className="sec-h grow" style={{ margin: 0 }}>Pinned notes</h2>
          <button className="linkish tap t-note" onClick={() => setNotesOpen(true)}>All notes</button>
        </div>
        <div className="panel" style={{ padding: '0 14px' }}>
          {pinned.length === 0 && <div className="muted t-note" style={{ padding: '14px 0' }}>Nothing pinned. Pin a note in the diary to keep it here; H&amp;S notes pin themselves.</div>}
          {pinned.map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}><NoteRow n={n} onOpen={() => setNoteEdit(n)} /></div>)}
        </div>
      </>}
      {documents}
      {notesOpen && <NotesSheet job={job} notes={notes} days={days} onClose={() => setNotesOpen(false)} onSave={onSaveNote} onDelete={onDeleteNote} onOpenDay={onOpenDay} />}
      {noteEdit && <NoteEditor job={job} note={noteEdit} onClose={() => setNoteEdit(null)} onSave={n => { onSaveNote(n); setNoteEdit(null) }} onDelete={() => { onDeleteNote(noteEdit); setNoteEdit(null) }} />}
      {seesMoney && <div className="hint" style={{ marginTop: 12 }}>
        PO number {job.poNumber ? <span className="mono">{job.poNumber}</span> : 'not set'} · uplifts {fig(`${job.uplift1}%`)} + {fig(`${job.uplift2}%`)} <ByClaude at={job.byClaude} />
      </div>}
    </div>
  )
}

/** The valuation week on the job's line, for the office: on its first day, or at today once it's here. */
function valMarks(job: Job, vals: Valuation[], diary: DiaryEntry[], onOpen: () => void): LineMark[] {
  const r = valRhythm(job, vals, { diary }), today = dayKey()
  if (!r) return []
  const ref = valRef(r.next)
  return [{ id: 'val-week', date: r.from > today ? r.from : today, onOpen,
    text: r.state === 'late' ? `${ref} was due ${weekText(r)}` : `${ref} · valuation week, ${weekText(r)}`,
    sub: r.last ? lastText(r) : undefined }]
}

/** Tabs that are all money: operatives don't get them. */
const MONEY_TABS: Tab[] = ['vals']
const NAV: { tab: Tab; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { tab: 'home', label: 'Home', Icon: IconHome },
  { tab: 'diary', label: 'Diary', Icon: IconDiary },
  { tab: 'scope', label: 'Scope', Icon: IconScope },
  { tab: 'vals', label: 'Vals', Icon: IconValuation },
]

export function JobView(p: {
  job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]
  onBack: () => void; onSetup: () => void; onUpdateJob: (j: Job) => void; onLogVariation: (house?: string) => void; onImportVo: () => void; onVoRegister: () => void; onEditVariation: (v: Variation) => void
  onToggleVo: (v: Variation) => void; onToggleScope: (i: ScopeItem) => void; onClaimMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onDeleteScope: (items: ScopeItem[]) => void; onAddScope: () => void; onEditScope: (i: ScopeItem) => void; onImportScope: () => void; onCheckRates?: () => void; onEvidence: () => Promise<void>
  onIssue: (v: Valuation) => Promise<Valuation>; onUndoSend?: (before: Valuation) => void; onReview: (v: Valuation, note?: string) => void; onDeleteOpenVal: (v: Valuation) => void; onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>; onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
  costs: Cost[]; dayRate?: number | null; onCosts: () => void
  onDayworks: (fresh: boolean) => void
  docs: JobDocument[]; onAddDoc: (file: File, kind: JobDocument['kind'], name: string) => Promise<void>; onOpenDoc: (d: JobDocument) => Promise<void>; onDeleteDoc: (d: JobDocument) => Promise<void>
  orders: WorkOrder[]; onNewOrder: () => void; onOpenOrder: (o: WorkOrder) => void; onClaimOrders: (lines: ScopeItem[]) => void
  diary: DiaryEntry[]; onSaveDiary: (e: DiaryEntry, markedUp?: Blob) => void; onDeleteDiary: (e: DiaryEntry, linked?: DiaryEntry[]) => void
  onAddMedia: (file: File | Blob, kind: 'photo' | 'video' | 'voice', date: string) => Promise<DiaryEntry>; onRaiseVoFromPhoto: (e: DiaryEntry) => void
  /** why site captures aren't being read just now, if they aren't */
  readNote?: string | null
  onDecideSite?: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>
}) {
  const { job, vos, scope, vals, onBack, onSetup, onLogVariation, onEditVariation } = p
  const access = useAccess()
  const nav = NAV.filter(n => access.money || !MONEY_TABS.includes(n.tab))
  // the tab is kept in the address with the job, so a reload comes back to it (Clerk too, from the header)
  const [tab, setTabState] = useState<Tab>(() => { const t = placeParam('tab'); return t === 'ask' ? 'ask' : t === 'vos' ? 'scope' : nav.find(n => n.tab === t)?.tab ?? 'home' })
  // the VOs live in Scope, at their house, with the lines: anything that asks for them (an alert, a link, an old address) opens Scope
  const setTab = (t: Tab) => { const to = t === 'vos' ? 'scope' : t; setTabState(to); setPlace({ tab: to === 'home' ? null : to }) }
  const [askSeed, setAskSeed] = useState<string | null>(null)   // a question handed to Clerk from elsewhere (e.g. a PO just added)
  const askClerk = (q: string) => { setAskSeed(q); setTab('ask') }
  const [diaryDate, setDiaryDate] = useState(dayKey())
  const [diaryView, setDiaryView] = useState<'line' | 'day'>('line')   // the job's line of days, or one day's diary
  // each tab, and a day opened from the line, starts at its top rather than where the last one was scrolled to
  useEffect(() => { const el = document.scrollingElement; if (el) el.scrollTop = 0 }, [tab, diaryView])
  const openDay = (d: string) => { setDiaryDate(d); setDiaryView('day'); setTab('diary') }
  const [capture, setCapture] = useState(false)
  const [capLeaving, setCapLeaving] = useState(false)
  // the menu drops back behind the +, a little quicker than it rose (reduced motion: a short fade)
  // the raised capture key sinks into the dock while the page scrolls and rises once it stops (styles: .nav.sinking)
  const [sinking, setSinking] = useState(false)
  useEffect(() => {
    let t: number | undefined
    const on = () => { setSinking(true); window.clearTimeout(t); t = window.setTimeout(() => setSinking(false), 450) }
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); window.clearTimeout(t) }
  }, [])
  const closeCapture = () => { setCapLeaving(true); setTimeout(() => { setCapture(false); setCapLeaving(false) }, reducedMotion() ? 150 : 200) }
  const [focusNote, setFocusNote] = useState(false)
  const [capErr, setCapErr] = useState<string | null>(null)
  const [quickVoice, setQuickVoice] = useState(false)
  const quickAdd = async (f: File | undefined, kind: 'photo' | 'video') => {
    if (!f) return
    setCapErr(null)
    try { const d = dayKey(); landed(await p.onAddMedia(f, kind, d), d); closeCapture() }
    catch (x) { setCapErr((x as Error).message) }
  }
  // a capture made on Scope or Vals (walking a house, checking a valuation) stays there: it says where it went, with
  // Undo; from Home or the Diary it opens the day, as before
  const landed = (e: DiaryEntry, d: string) => {
    if (tab === 'home' || tab === 'diary') { openDay(d); return }
    offerUndo(`${e.type === 'voice' ? 'Voice note' : e.type === 'video' ? 'Video' : 'Photo'} added to today’s diary`, () => p.onDeleteDiary(e))
  }
  // the job's trades, each its own colour within this job (scope order, so the first trade always gets the same one)
  const cores = useMemo(() => jobCores([...scope].sort((a, b) => a.order - b.order).map(i => i.workstream || i.room || 'General')), [scope])
  return (
    <TradeCores.Provider value={cores}>
      <main className="page with-rail">
        <Hero job={job} compact={tab !== 'home'} rail={jobRail(job, scope, vals, vos, access.money, p.diary)} onBack={onBack} onSetup={onSetup} onClerk={() => setTab('ask')} inClerk={tab === 'ask'} />
        {tab === 'home' && <Home job={job} vos={vos} scope={scope} vals={vals} go={setTab} onSetup={onSetup} onUpdateJob={p.onUpdateJob}
          margin={jobMargin(job, scope, vos, p.costs, p.diary, p.dayRate)} onCosts={p.onCosts} orders={p.orders}
          documents={<DocumentsPanel docs={p.docs} onAdd={p.onAddDoc} onOpen={p.onOpenDoc} onDelete={p.onDeleteDoc} onAsk={currentCompany() ? askClerk : undefined} />}
          notes={p.diary.filter(d => d.type === 'note' && (access.money || d.category !== 'Commercial'))} onSaveNote={e => p.onSaveDiary(e)} onDeleteNote={p.onDeleteDiary} onOpenDay={openDay} diary={p.diary} />}
        {tab === 'diary' && diaryView === 'line' && !focusNote && <JobLine job={job} entries={p.diary}
          properties={[...new Set([...Object.keys(job.properties ?? {}), ...scope.map(s => s.property ?? '')].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))}
          trades={[...new Set(scope.map(s => s.workstream ?? '').filter(Boolean))]}
          onSave={p.onSaveDiary} onDelete={p.onDeleteDiary} onOpenDay={openDay} marks={access.money ? valMarks(job, vals, p.diary, () => setTab('vals')) : []} />}
        {tab === 'diary' && (diaryView === 'day' || focusNote) && <DiaryTab job={job} entries={p.diary} rooms={[...new Set(scope.map(s => s.room))]} vos={vos}
          date={diaryDate} setDate={setDiaryDate} focusNote={focusNote} onBack={() => { setFocusNote(false); setDiaryView('line') }}
          onSave={p.onSaveDiary} onDelete={p.onDeleteDiary} onAddMedia={p.onAddMedia} onRaiseVo={p.onRaiseVoFromPhoto} />}
        {tab === 'scope' && job.kind === 'orders' && <><OrdersTab job={job} orders={p.orders} scope={scope} vals={vals} onNew={p.onNewOrder} onOpen={p.onOpenOrder} onClaim={p.onClaimOrders} />
          <VoList job={job} vos={vos} vals={vals} onToggle={p.onToggleVo} onEdit={onEditVariation} onLog={() => onLogVariation()} /></>}
        {tab === 'scope' && job.kind !== 'orders' && <ScopeTab job={job} scope={scope} vals={vals} onToggle={p.onToggleScope} onToggleMany={p.onClaimMany} onClearUnclaimed={p.onClearUnclaimed} onDeleteAll={p.onDeleteScope} onAdd={p.onAddScope} onEdit={p.onEditScope} onImport={p.onImportScope} onCheckRates={p.onCheckRates} onEvidence={p.onEvidence}
          vos={vos} onToggleVo={p.onToggleVo} onEditVo={onEditVariation} onLogVo={onLogVariation} onImportVo={access.money ? p.onImportVo : undefined} onRegister={access.money ? p.onVoRegister : undefined} onDayworks={() => p.onDayworks(false)}
          diary={p.diary} onMarkDone={i => p.onSaveDiary(doneMark(job, i))} onUndoDone={p.onDeleteDiary} />}
        {tab === 'vals' && access.money && <ValuationsTab job={job} scope={scope} vos={vos} vals={vals} go={setTab}
          onRemoveScope={p.onToggleScope} onRemoveVo={p.onToggleVo} onIssue={p.onIssue} onUndoSend={p.onUndoSend} onDeleteOpen={p.onDeleteOpenVal} onPaid={p.onPaid} onCertificate={p.onCertificate} onCreateInvoice={p.onCreateInvoice} onInvoicePdf={p.onInvoicePdf} diary={p.diary} onDecideSite={p.onDecideSite} readNote={p.readNote} onReview={p.onReview} onUpdateJob={p.onUpdateJob} />}
        {tab === 'ask' && <AskTab job={job} seed={askSeed} onSeeded={() => setAskSeed(null)} />}
      </main>
      {/* the tabs share the dock evenly around a middle column for the + key, which sits in a scoop cut into the dock's
          top edge; the open tab rises into a second, smaller scoop that slides to whichever tab you tap (Dock.tsx).
          On the narrowest phones and the desktop rail the dock is a plain bar and the slot and scoops aren't shown. */}
      {(() => {
        const slot = captureSlot(nav.length)
        const at = nav.findIndex(n => n.tab === tab)
        const cells = nav.map(({ tab: t, label: navLabel, Icon }) => { const label = t === 'scope' && job.kind === 'orders' ? 'Orders' : navLabel; return (
          <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => { setFocusNote(false); if (t === 'diary') setDiaryView('line'); setTab(t) }}><Icon /><span className="nav-l">{label}</span></button>
        ) })
        cells.splice(slot, 0, <span key="slot" className="nav-slot" aria-hidden="true" />)
        return (
          <nav className={'nav' + (sinking ? ' sinking' : '')} style={{ '--dock-cols': `repeat(${nav.length + 1}, minmax(0, 1fr))`, '--n': nav.length, '--cap-x': `calc(4px + (100% - 8px) * ${(slot + 0.5) / (nav.length + 1)})` } as React.CSSProperties}>
            <DockShape tabs={nav.length} active={at} Icon={at >= 0 ? nav[at].Icon : undefined} capture={tab !== 'ask'} sinking={sinking} />
            {tab !== 'ask' && <button className="nav-capture" aria-label="Capture" onClick={() => { setCapErr(null); setCapture(true) }}><span><IconPlus size={28} /></span></button>}
            {cells}
            {/* the tab marker on the plain bar (narrow phones, the desktop rail): one bar that slides to the tab you tap */}
            {at >= 0 && <span className="nav-mark" aria-hidden="true" style={{ '--i': at } as React.CSSProperties} />}
          </nav>
        )
      })()}
      {/* over the open capture menu the + turns into its close button, where the thumb already is (phones; the menu keeps its own × for screen readers and the desktop) */}
      {capture && <button className={'cap-close' + (capLeaving ? ' leaving' : '')} aria-hidden="true" tabIndex={-1} onClick={closeCapture}><span><IconPlus size={28} /></span></button>}
      {quickVoice && <VoiceSheet onClose={() => setQuickVoice(false)} onSave={async b => { const d = dayKey(); const e = await p.onAddMedia(b, 'voice', d); setQuickVoice(false); landed(e, d) }} />}
      {capture && (
        <Sheet className={'capture-sheet' + (capLeaving ? ' leaving' : '')} onClose={closeCapture}>
          <div className="stack">
            <h2 className="label bracket">Capture · {job.name}</h2>
            {/* a photo is what site reaches for nine times in ten: it leads, the one white block; the rest sit under it */}
            <label className="btn btn-primary cap-lead"><IconCamera /> Photo
              <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={e => { quickAdd(e.target.files?.[0], 'photo'); e.target.value = '' }} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="btn btn-secondary"><IconVideo /> Video
                <input type="file" className="sr-only" accept="video/*" capture="environment" onChange={e => { quickAdd(e.target.files?.[0], 'video'); e.target.value = '' }} /></label>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); setQuickVoice(true) }}><IconMic /> Voice note</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); onLogVariation() }}><IconFlag /> Variation</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); p.onDayworks(true) }}><IconClock /> Dayworks</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); setFocusNote(true); openDay(dayKey()) }}><IconPin /> Note</button>
            </div>
            {capErr && <div className="flag">{capErr}</div>}
          </div>
        </Sheet>
      )}
    </TradeCores.Provider>
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
        <Field label="Why (for the record)"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Kitchen partition + ceiling patch added after PO — client’s officer aware, will be claimed" /></Field>
        <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSave({ ...job, poGapAccepted: { diff: gap.diff, note: note.trim(), at: Date.now() } })}>{accepted ? 'Update note' : figs(`Accept ${money(Math.abs(gap.diff))} difference`)}</button>
        <button className="btn btn-secondary" onClick={onSetup}>Check uplifts / PO value in job setup</button>
        {accepted && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...job, poGapAccepted: null })}>Withdraw acceptance (flag it again)</button>}
      </div>
    </Sheet>
  )
}
