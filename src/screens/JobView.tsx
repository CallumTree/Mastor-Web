import { Fragment, useState } from 'react'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { Drawing } from '../components/Drawing'
import { usePhotoUrl } from '../lib/photos'
import { getLook, PHOTOS, useBackdrop } from '../lib/look'
import { lineValue } from '../lib/valuation'
import { money, ukDate, upliftFactor } from '../lib/format'
import { IconBack, IconCamera, IconDiary, IconDoc, IconFlag, IconHome, IconMarkup, IconPin, IconScope, IconSettings, IconValuation, IconVideo } from '../components/Icons'
import { VariationsTab } from './Variations'
import { ScopeTab } from './Scope'
import { DiaryTab } from './Diary'
import { NoteEditor, NoteRow, NotesSheet, newNote, sortNotes } from './Notes'
import { dayKey } from '../lib/dates'
import { Sheet, TitleBlock } from '../components/Ui'
import { ValuationsTab } from './Valuations'
import { pennies, upliftAmounts, valRef, valTotals } from '../lib/valuation'
import { Field } from '../components/Ui'
import { valCourt, voCourt, VO_CHASE_AMBER } from '../lib/chase'

export type Tab = 'home' | 'diary' | 'scope' | 'vos' | 'vals'

function Hero({ job, compact, onBack, onSetup }: { job: Job; compact: boolean; onBack: () => void; onSetup: () => void }) {
  const jobPhoto = usePhotoUrl(job.photoId)
  const bg = useBackdrop(jobPhoto ?? (getLook() === 'photo' ? PHOTOS.job.src : null))
  return (
    <div className={'jhero bleed' + (bg.loaded ? ' has-photo' : '')} style={{ height: compact ? 150 : 300 }}>
      <div className="sky" />
      {!bg.loaded && (
        <div className="bg-drawing" style={compact ? { bottom: '-30%', opacity: .7 } : undefined}>
          <Drawing id={job.id} type={job.workType} active={job.status === 'Active'} bare paper />
        </div>
      )}
      {bg.trying && bg.img && <><img className={'bg-photo' + (bg.loaded ? '' : ' pending')} src={bg.img.src} onLoad={bg.img.onLoad} onError={bg.img.onError} alt="" />{bg.loaded && <div className="shade" />}</>}
      <div className="jhero-top">
        <button onClick={onBack} aria-label="All jobs"><IconBack size={20} /></button>
        <span className="label bracket" style={{ color: 'var(--cream-muted)' }}>{job.contractRef || job.workType}</span>
        <button onClick={onSetup} aria-label="Job setup"><IconSettings size={20} /></button>
      </div>
      <div className="jhero-title" style={compact ? { top: 60 } : undefined}>
        <h1 className="jhero-name" style={compact ? { fontSize: 20 } : undefined}>{job.name}</h1>
        {!compact && <div className="sub">{[job.client, job.address].filter(Boolean).join(' · ')}</div>}
      </div>
    </div>
  )
}

function Home({ job, vos, scope, vals, go, onSetup, onUpdateJob, notes, onSaveNote, onDeleteNote }: { job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]; go: (t: Tab) => void; onSetup: () => void; onUpdateJob: (j: Job) => void; notes: DiaryEntry[]; onSaveNote: (n: DiaryEntry) => void; onDeleteNote: (n: DiaryEntry) => void }) {
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

  const actions: { text: string; hint: string; colour: string; onClick: () => void }[] = []
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
  if (unmeasured) actions.push({ text: `${unmeasured} variation${unmeasured === 1 ? '' : 's'} not measured`, hint: 'Measure on site', colour: 'var(--amber)', onClick: () => go('vos') })
  if (open && openTotals && openTotals.lines > 0) actions.push({ text: `${valRef(open.number)}: ${money(openTotals.gross)} ready`, hint: `${openTotals.lines} line${openTotals.lines === 1 ? '' : 's'} — review and issue`, colour: 'var(--green)', onClick: () => go('vals') })
  if (scope.length === 0) actions.push({ text: 'No scope yet', hint: 'Add the works order items', colour: 'var(--amber)', onClick: () => go('scope') })

  return (
    <div>
      <div className="tiles">
        <div className="glass tile tile-dark"><div className="n">{job.contractValue ? money(job.contractValue).replace(/\.\d\d$/, '') : '—'}</div><div className="l">Contract</div></div>
        <div className="glass tile tile-dark"><div className="n" style={{ color: 'var(--copper-light)' }}>{money(certified).replace(/\.\d\d$/, '')}</div><div className="l">Certified</div></div>
        <div className="glass tile tile-dark"><div className="n">{money(voGross).replace(/\.\d\d$/, '')}</div><div className="l">Variations</div></div>
      </div>
      <div className="label bracket" style={{ marginBottom: 8, color: actions.length ? 'var(--copper-ink)' : 'var(--green)' }}>
        {actions.length ? `Action needed (${actions.length})` : 'All clear'}
      </div>
      <div className="card-dark" style={{ padding: actions.length ? '6px 16px' : 16 }}>
        {actions.length === 0 && <div>Nothing outstanding on this job.</div>}
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '12px 0', background: 'none', border: 'none', borderTop: i ? '1px solid var(--charcoal-line)' : 'none', color: 'inherit', textAlign: 'left' }}>
            {/* urgency by shape as well as colour: urgent = diamond, everything else = dot */}
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: a.colour === 'var(--red)' ? 1 : 5, transform: a.colour === 'var(--red)' ? 'rotate(45deg) scale(.9)' : undefined, background: a.colour, flex: 'none' }} />
            <span className="grow"><span className="sr-only">{a.colour === 'var(--red)' ? 'Urgent: ' : a.colour === 'var(--green)' ? 'Ready: ' : 'To do: '}</span><div style={{ fontWeight: 600 }}>{a.text}</div><div style={{ fontSize: 12, color: 'var(--cream-muted)' }}>{a.hint}</div></span>
            <span aria-hidden="true" style={{ color: 'var(--cream-muted)', fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
      {poNote && <div className="panel" style={{ padding: '10px 14px', marginTop: 10, fontSize: 12 }}><span className="label" style={{ marginRight: 6 }}>PO</span>{poNote} · <button className="linkish" style={{ color: 'var(--copper-ink)' }} onClick={() => setGapOpen(true)}>review</button></div>}
      {gapOpen && gap && <PoGapSheet job={job} gap={gap} onClose={() => setGapOpen(false)} onSetup={() => { setGapOpen(false); onSetup() }} onSave={j => {
        setGapOpen(false); onUpdateJob(j)
        // the reason goes on record in the job's notes
        if (j.poGapAccepted) onSaveNote(newNote(job, `PO difference of ${money(Math.abs(j.poGapAccepted.diff))} accepted (BoQ ${j.poGapAccepted.diff > 0 ? 'over' : 'under'} PO): ${j.poGapAccepted.note}`, 'Commercial'))
      }} />}
      <div className="row" style={{ margin: '18px 0 8px' }}>
        <div className="label bracket grow">Notes &amp; decisions</div>
        <button className="linkish tap" style={{ color: 'var(--copper-ink)', fontSize: 14 }} onClick={() => setNotesOpen(true)}>{notes.length ? `All ${notes.length} ›` : '+ Add'}</button>
      </div>
      <div className="panel" style={{ padding: '0 14px' }}>
        {notes.length === 0 && <button onClick={() => setNotesOpen(true)} style={{ background: 'none', border: 'none', padding: '14px 0', color: 'var(--ink-muted)', textAlign: 'left', width: '100%' }}>Agreements, client requests, chasers — put them on record.</button>}
        {[...notes].sort(sortNotes).slice(0, 3).map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--ink-line)' : 'none' }}><NoteRow n={n} onOpen={() => setNoteEdit(n)} /></div>)}
      </div>
      {notesOpen && <NotesSheet job={job} notes={notes} onClose={() => setNotesOpen(false)} onSave={onSaveNote} onDelete={onDeleteNote} />}
      {noteEdit && <NoteEditor job={job} note={noteEdit} onClose={() => setNoteEdit(null)} onSave={n => { onSaveNote(n); setNoteEdit(null) }} onDelete={() => { onDeleteNote(noteEdit); setNoteEdit(null) }} />}
      <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        PO {job.poNumber || 'not set'} · Uplifts {job.uplift1}% + {job.uplift2}% · Variations shown incl. uplifts
      </div>
    </div>
  )
}

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
  onToggleVo: (v: Variation) => void; onToggleScope: (i: ScopeItem) => void; onClaimMany: (items: ScopeItem[]) => void; onClearUnclaimed: (items: ScopeItem[]) => void; onDeleteScope: (items: ScopeItem[]) => void; onAddScope: () => void; onEditScope: (i: ScopeItem) => void; onImportScope: () => void
  onIssue: (v: Valuation) => void; onDeleteOpenVal: (v: Valuation) => void; onPaid: (v: Valuation) => void; onCertificate: (v: Valuation) => Promise<void>; onCreateInvoice: (v: Valuation) => void; onInvoicePdf: (v: Valuation) => Promise<void>
  diary: DiaryEntry[]; onSaveDiary: (e: DiaryEntry, markedUp?: Blob) => void; onDeleteDiary: (e: DiaryEntry) => void
  onAddMedia: (file: File, kind: 'photo' | 'video', date: string) => Promise<void>; onRaiseVoFromPhoto: (e: DiaryEntry) => void
}) {
  const { job, vos, scope, vals, onBack, onSetup, onLogVariation, onEditVariation } = p
  const [tab, setTab] = useState<Tab>('home')
  const [diaryDate, setDiaryDate] = useState(dayKey())
  const [capture, setCapture] = useState(false)
  const [focusNote, setFocusNote] = useState(false)
  const [capErr, setCapErr] = useState<string | null>(null)
  const [quickNote, setQuickNote] = useState(false)
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
          notes={p.diary.filter(d => d.type === 'note')} onSaveNote={e => p.onSaveDiary(e)} onDeleteNote={p.onDeleteDiary} />}
        {tab === 'vos' && <VariationsTab job={job} vos={vos} vals={vals} onLog={onLogVariation} onEdit={onEditVariation} onToggle={p.onToggleVo} onImportVo={p.onImportVo} onRegister={p.onVoRegister} />}
        {tab === 'diary' && <DiaryTab job={job} entries={p.diary} rooms={[...new Set(scope.map(s => s.room))]} vos={vos}
          date={diaryDate} setDate={setDiaryDate} focusNote={focusNote}
          onSave={p.onSaveDiary} onDelete={p.onDeleteDiary} onAddMedia={p.onAddMedia} onRaiseVo={p.onRaiseVoFromPhoto} />}
        {tab === 'scope' && <ScopeTab job={job} scope={scope} vals={vals} onToggle={p.onToggleScope} onToggleMany={p.onClaimMany} onClearUnclaimed={p.onClearUnclaimed} onDeleteAll={p.onDeleteScope} onAdd={p.onAddScope} onEdit={p.onEditScope} onImport={p.onImportScope} />}
        {tab === 'vals' && <ValuationsTab job={job} scope={scope} vos={vos} vals={vals} go={setTab}
          onRemoveScope={p.onToggleScope} onRemoveVo={p.onToggleVo} onIssue={p.onIssue} onDeleteOpen={p.onDeleteOpenVal} onPaid={p.onPaid} onCertificate={p.onCertificate} onCreateInvoice={p.onCreateInvoice} onInvoicePdf={p.onInvoicePdf} />}
      </main>
      <nav className="nav">
        {NAV.map(({ tab: t, label, Icon }, i) => (
          <Fragment key={t}>{i === 2 && (
            <button className="nav-capture" aria-label="Capture" onClick={() => { setCapErr(null); setCapture(true) }}><span>+</span></button>
          )}
          <button className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => { setFocusNote(false); setTab(t) }}><Icon /><span className="nav-l">{label}</span></button></Fragment>
        ))}
      </nav>
      {quickNote && <NoteEditor job={job} onClose={() => setQuickNote(false)} onSave={n => { p.onSaveDiary(n); setQuickNote(false) }} />}
      {capture && (
        <Sheet onClose={() => setCapture(false)}>
          <div className="stack">
            <div className="label bracket">Capture · {job.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="btn btn-secondary"><IconCamera /> Photo
                <input type="file" accept="image/*" capture="environment" hidden onChange={e => { quickAdd(e.target.files?.[0], 'photo'); e.target.value = '' }} /></label>
              <label className="btn btn-secondary"><IconVideo /> Video
                <input type="file" accept="video/*" capture="environment" hidden onChange={e => { quickAdd(e.target.files?.[0], 'video'); e.target.value = '' }} /></label>
              <button className="btn btn-secondary" onClick={() => { setDiaryDate(dayKey()); setCapture(false); setFocusNote(true); setTab('diary') }}><IconDiary /> Diary note</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); onLogVariation() }}><IconFlag /> Variation</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); p.onImportVo() }}><IconDoc /> Council VO</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); setQuickNote(true) }}><IconPin /> Job note</button>
            </div>
            {capErr && <div className="flag">{capErr}</div>}
            <div className="muted" style={{ fontSize: 12 }}>Photos and video go into today’s diary.</div>
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
        <div className="label bracket">BoQ vs PO</div>
        <TitleBlock head={[gap.diff > 0 ? 'BoQ is over the PO by' : 'BoQ is under the PO by', money(Math.abs(gap.diff))]}
          rows={[[['BoQ + uplifts', money(gap.withUplifts)], ['PO value', money(job.contractValue)]], [['Uplifts set', `${job.uplift1}% + ${job.uplift2}%`], ['Would reconcile at', `${gap.needed.toFixed(2)}% combined`]]]} />
        <div className="muted" style={{ fontSize: 13 }}>Common reasons: items added after the PO was raised, a PO line missing, or the wrong uplifts. If you know why and will claim it anyway, accept it with a note — it'll stay recorded, and flag again if the difference changes.</div>
        <Field label="Why (for the record)"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Kitchen partition + ceiling patch added after PO — Dylan aware, will be claimed" /></Field>
        <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSave({ ...job, poGapAccepted: { diff: gap.diff, note: note.trim(), at: Date.now() } })}>{accepted ? 'Update note' : `Accept ${money(Math.abs(gap.diff))} difference`}</button>
        <button className="btn btn-secondary" onClick={onSetup}>Check uplifts / PO value in job setup</button>
        {accepted && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => onSave({ ...job, poGapAccepted: null })}>Withdraw acceptance (flag it again)</button>}
      </div>
    </Sheet>
  )
}
