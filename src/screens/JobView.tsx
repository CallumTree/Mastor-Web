import { Fragment, useState } from 'react'
import type { DiaryEntry, Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { Drawing } from '../components/Drawing'
import { usePhotoUrl } from '../lib/photos'
import { getLook, PHOTOS } from '../lib/look'
import { lineValue } from '../lib/valuation'
import { money, upliftFactor } from '../lib/format'
import { IconBack, IconCamera, IconDiary, IconFlag, IconHome, IconMarkup, IconScope, IconSettings, IconValuation } from '../components/Icons'
import { VariationsTab } from './Variations'
import { ScopeTab } from './Scope'
import { DiaryTab } from './Diary'
import { dayKey } from '../lib/dates'
import { Sheet } from '../components/Ui'
import { ValuationsTab } from './Valuations'
import { valRef, valTotals } from '../lib/valuation'

export type Tab = 'home' | 'diary' | 'scope' | 'vos' | 'vals'

function Hero({ job, compact, onBack, onSetup }: { job: Job; compact: boolean; onBack: () => void; onSetup: () => void }) {
  const jobPhoto = usePhotoUrl(job.photoId)
  const photo = jobPhoto ?? (getLook() === 'photo' ? PHOTOS.job.src : null)
  return (
    <div className="jhero bleed" style={{ height: compact ? 150 : 300 }}>
      <div className="sky" />
      {photo ? (
        <><img className="bg-photo" src={photo} alt="" /><div className="shade" /></>
      ) : (
        <div className="bg-drawing" style={compact ? { bottom: '-30%', opacity: .7 } : undefined}>
          <Drawing id={job.id} type={job.workType} active={job.status === 'Active'} bare paper />
        </div>
      )}
      <div className="jhero-top">
        <button onClick={onBack} aria-label="All jobs"><IconBack size={20} /></button>
        <span className="label bracket" style={{ color: 'var(--cream-muted)' }}>{job.contractRef || job.workType}</span>
        <button onClick={onSetup} aria-label="Job setup"><IconSettings size={20} /></button>
      </div>
      <div className="jhero-title" style={compact ? { top: 60 } : undefined}>
        <h2 style={compact ? { fontSize: 20 } : undefined}>{job.name}</h2>
        {!compact && <div className="sub">{[job.client, job.address].filter(Boolean).join(' · ')}</div>}
      </div>
    </div>
  )
}

function Home({ job, vos, scope, vals, go, onSetup }: { job: Job; vos: Variation[]; scope: ScopeItem[]; vals: Valuation[]; go: (t: Tab) => void; onSetup: () => void }) {
  const open = vals.find(v => v.status === 'Open')
  const openTotals = open ? valTotals(job, open.id, scope, vos) : null
  const certified = vals.filter(v => v.status === 'Issued').reduce((t, v) => t + valTotals(job, v.id, scope, vos).gross, 0)
  const live = vos.filter(v => v.status !== 'Rejected')
  const priced = live.filter(v => v.qty != null && v.rate != null)
  const unpriced = live.filter(v => v.rate == null).length
  const unmeasured = live.filter(v => v.qty == null).length
  const awaitingRef = live.filter(v => v.rate != null && !v.clientRef && v.status === 'Identified').length
  const voBase = priced.reduce((s, v) => s + lineValue(v.qty, v.rate), 0)
  const voGross = voBase * upliftFactor(job.uplift1, job.uplift2)

  const actions: { text: string; hint: string; colour: string; onClick: () => void }[] = []
  // Uplifts must turn the BoQ into the PO's all-in figure — otherwise every valuation is wrong
  const scopeBase = scope.reduce((t, i) => t + lineValue(i.qty, i.rate), 0)
  if (scopeBase > 0 && job.contractValue > 0) {
    const withUplifts = scopeBase * upliftFactor(job.uplift1, job.uplift2)
    if (Math.abs(withUplifts - job.contractValue) / job.contractValue > 0.001) {
      const needed = (job.contractValue / scopeBase - 1) * 100
      actions.push({ text: "Uplifts don't reconcile with the PO", hint: `BoQ ${money(scopeBase)} + ${job.uplift1}% + ${job.uplift2}% = ${money(withUplifts)}, PO is ${money(job.contractValue)} (needs ${needed.toFixed(2)}% combined)`, colour: 'var(--red)', onClick: onSetup })
    }
  }
  if (!job.poNumber) actions.push({ text: 'No PO number', hint: 'Invoices will be rejected without it', colour: 'var(--red)', onClick: onSetup })
  if (unpriced) actions.push({ text: `${unpriced} variation${unpriced === 1 ? '' : 's'} unpriced`, hint: 'Add SoR code and rate so they can be claimed', colour: 'var(--amber)', onClick: () => go('vos') })
  if (unmeasured) actions.push({ text: `${unmeasured} variation${unmeasured === 1 ? '' : 's'} not measured`, hint: 'Measure on site', colour: 'var(--amber)', onClick: () => go('vos') })
  if (open && openTotals && openTotals.lines > 0) actions.push({ text: `${valRef(open.number)}: ${money(openTotals.gross)} ready`, hint: `${openTotals.lines} line${openTotals.lines === 1 ? '' : 's'} — review and issue`, colour: 'var(--green)', onClick: () => go('vals') })
  if (scope.length === 0) actions.push({ text: 'No scope yet', hint: 'Add the works order items', colour: 'var(--amber)', onClick: () => go('scope') })
  if (awaitingRef) actions.push({ text: `${awaitingRef} priced variation${awaitingRef === 1 ? '' : 's'} awaiting instruction`, hint: 'Send to the client for a VO reference', colour: 'var(--amber)', onClick: () => go('vos') })

  return (
    <div>
      <div className="tiles">
        <div className="glass tile tile-dark"><div className="n">{job.contractValue ? money(job.contractValue).replace(/\.\d\d$/, '') : '—'}</div><div className="l">Contract</div></div>
        <div className="glass tile tile-dark"><div className="n" style={{ color: 'var(--copper-light)' }}>{money(certified).replace(/\.\d\d$/, '')}</div><div className="l">Certified</div></div>
        <div className="glass tile tile-dark"><div className="n">{money(voGross).replace(/\.\d\d$/, '')}</div><div className="l">Variations</div></div>
      </div>
      <div className="label bracket" style={{ marginBottom: 8, color: actions.length ? 'var(--copper)' : 'var(--green)' }}>
        {actions.length ? `Action needed (${actions.length})` : 'All clear'}
      </div>
      <div className="card-dark" style={{ padding: actions.length ? '6px 16px' : 16 }}>
        {actions.length === 0 && <div>Nothing outstanding on this job.</div>}
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '12px 0', background: 'none', border: 'none', borderTop: i ? '1px solid var(--charcoal-line)' : 'none', color: 'inherit', textAlign: 'left' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: a.colour, flex: 'none' }} />
            <span className="grow"><div style={{ fontWeight: 600 }}>{a.text}</div><div style={{ fontSize: 12, color: 'var(--cream-muted)' }}>{a.hint}</div></span>
            <span style={{ color: 'var(--cream-muted)', fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
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
  onBack: () => void; onSetup: () => void; onLogVariation: () => void; onEditVariation: (v: Variation) => void
  onToggleVo: (v: Variation) => void; onToggleScope: (i: ScopeItem) => void; onAddScope: () => void; onEditScope: (i: ScopeItem) => void; onImportScope: () => void
  onIssue: (v: Valuation) => void; onDeleteOpenVal: (v: Valuation) => void
  diary: DiaryEntry[]; onSaveDiary: (e: DiaryEntry, markedUp?: Blob) => void; onDeleteDiary: (e: DiaryEntry) => void
  onAddMedia: (file: File, kind: 'photo' | 'video', date: string) => Promise<void>; onRaiseVoFromPhoto: (e: DiaryEntry) => void
}) {
  const { job, vos, scope, vals, onBack, onSetup, onLogVariation, onEditVariation } = p
  const [tab, setTab] = useState<Tab>('home')
  const [diaryDate, setDiaryDate] = useState(dayKey())
  const [capture, setCapture] = useState(false)
  const [focusNote, setFocusNote] = useState(false)
  const [capErr, setCapErr] = useState<string | null>(null)
  const quickAdd = async (f: File | undefined, kind: 'photo' | 'video') => {
    if (!f) return
    setCapErr(null)
    try { const d = dayKey(); await p.onAddMedia(f, kind, d); setDiaryDate(d); setCapture(false); setTab('diary') }
    catch (x) { setCapErr((x as Error).message) }
  }
  return (
    <>
      <div className="page">
        <Hero job={job} compact={tab !== 'home'} onBack={onBack} onSetup={onSetup} />
        {tab === 'home' && <Home job={job} vos={vos} scope={scope} vals={vals} go={setTab} onSetup={onSetup} />}
        {tab === 'vos' && <VariationsTab job={job} vos={vos} vals={vals} onLog={onLogVariation} onEdit={onEditVariation} onToggle={p.onToggleVo} />}
        {tab === 'diary' && <DiaryTab job={job} entries={p.diary} rooms={[...new Set(scope.map(s => s.room))]} vos={vos}
          date={diaryDate} setDate={setDiaryDate} focusNote={focusNote}
          onSave={p.onSaveDiary} onDelete={p.onDeleteDiary} onAddMedia={p.onAddMedia} onRaiseVo={p.onRaiseVoFromPhoto} />}
        {tab === 'scope' && <ScopeTab job={job} scope={scope} vals={vals} onToggle={p.onToggleScope} onAdd={p.onAddScope} onEdit={p.onEditScope} onImport={p.onImportScope} />}
        {tab === 'vals' && <ValuationsTab job={job} scope={scope} vos={vos} vals={vals} go={setTab}
          onRemoveScope={p.onToggleScope} onRemoveVo={p.onToggleVo} onIssue={p.onIssue} onDeleteOpen={p.onDeleteOpenVal} />}
      </div>
      <nav className="nav">
        {NAV.map(({ tab: t, label, Icon }, i) => (
          <Fragment key={t}>{i === 2 && (
            <button className="nav-capture" aria-label="Capture" onClick={() => { setCapErr(null); setCapture(true) }}><span>+</span></button>
          )}
          <button className={tab === t ? 'on' : ''} onClick={() => { setFocusNote(false); setTab(t) }}><Icon />{label}</button></Fragment>
        ))}
      </nav>
      {capture && (
        <Sheet onClose={() => setCapture(false)}>
          <div className="stack">
            <div className="label bracket">Capture · {job.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="btn btn-secondary"><IconCamera /> Photo
                <input type="file" accept="image/*" capture="environment" hidden onChange={e => { quickAdd(e.target.files?.[0], 'photo'); e.target.value = '' }} /></label>
              <label className="btn btn-secondary">▶ Video
                <input type="file" accept="video/*" capture="environment" hidden onChange={e => { quickAdd(e.target.files?.[0], 'video'); e.target.value = '' }} /></label>
              <button className="btn btn-secondary" onClick={() => { setDiaryDate(dayKey()); setCapture(false); setFocusNote(true); setTab('diary') }}>✎ Diary note</button>
              <button className="btn btn-secondary" onClick={() => { setCapture(false); onLogVariation() }}><IconFlag /> Variation</button>
            </div>
            {capErr && <div className="flag">{capErr}</div>}
            <div className="muted" style={{ fontSize: 12 }}>Photos and video go into today’s diary.</div>
          </div>
        </Sheet>
      )}
    </>
  )
}
