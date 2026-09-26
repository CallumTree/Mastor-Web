import { useState } from 'react'
import type { Job, Variation } from '../lib/types'
import { Drawing } from '../components/Drawing'
import { TitleBlock } from '../components/Ui'
import { usePhotoUrl } from '../lib/photos'
import { money, upliftFactor } from '../lib/format'
import { IconBack, IconDiary, IconHome, IconMarkup, IconScope, IconSettings, IconValuation } from '../components/Icons'
import { VariationsTab } from './Variations'

export type Tab = 'home' | 'diary' | 'scope' | 'vos' | 'vals'

function Hero({ job, onBack, onSetup }: { job: Job; onBack: () => void; onSetup: () => void }) {
  const photo = usePhotoUrl(job.photoId)
  return (
    <div className="hero" style={{ borderRadius: 0, height: 190, margin: '-16px -16px 16px' }}>
      {photo ? <img src={photo} alt="" /> : <Drawing id={job.id} type={job.workType} active={job.status === 'Active'} />}
      <div className="hero-top">
        <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--cream-text)', padding: 4 }} onClick={onBack} aria-label="All jobs"><IconBack /></button>
        <span className="label bracket">{job.contractRef || job.workType}</span>
        <button style={{ background: 'none', border: 'none', color: 'var(--cream-text)', padding: 4 }} onClick={onSetup} aria-label="Job setup"><IconSettings /></button>
      </div>
      <div className="hero-bottom">
        <h2>{job.name}</h2>
        <div style={{ fontSize: 13, color: 'var(--cream-muted)', marginTop: 2 }}>{[job.client, job.address].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
  )
}

function Home({ job, vos, go, onSetup }: { job: Job; vos: Variation[]; go: (t: Tab) => void; onSetup: () => void }) {
  const live = vos.filter(v => v.status !== 'Rejected')
  const priced = live.filter(v => v.qty != null && v.rate != null)
  const unpriced = live.filter(v => v.rate == null).length
  const unmeasured = live.filter(v => v.qty == null).length
  const awaitingRef = live.filter(v => v.rate != null && !v.clientRef && v.status === 'Identified').length
  const voBase = priced.reduce((s, v) => s + v.qty! * v.rate!, 0)
  const voGross = voBase * upliftFactor(job.uplift1, job.uplift2)

  const actions: { text: string; hint: string; colour: string; onClick: () => void }[] = []
  if (!job.poNumber) actions.push({ text: 'No PO number', hint: 'Invoices will be rejected without it', colour: 'var(--red)', onClick: onSetup })
  if (unpriced) actions.push({ text: `${unpriced} variation${unpriced === 1 ? '' : 's'} unpriced`, hint: 'Add SoR code and rate so they can be claimed', colour: 'var(--amber)', onClick: () => go('vos') })
  if (unmeasured) actions.push({ text: `${unmeasured} variation${unmeasured === 1 ? '' : 's'} not measured`, hint: 'Measure on site', colour: 'var(--amber)', onClick: () => go('vos') })
  if (awaitingRef) actions.push({ text: `${awaitingRef} priced variation${awaitingRef === 1 ? '' : 's'} awaiting instruction`, hint: 'Send to the client for a VO reference', colour: 'var(--amber)', onClick: () => go('vos') })

  return (
    <div className="stack">
      <div>
        <div className="label bracket" style={{ marginBottom: 8, color: actions.length ? 'var(--copper)' : 'var(--green)' }}>
          {actions.length ? `Action needed (${actions.length})` : 'All clear'}
        </div>
        <div className="card-dark" style={{ padding: actions.length ? '6px 16px' : 16 }}>
          {actions.length === 0 && <div>Nothing outstanding on this job.</div>}
          {actions.map((a, i) => (
            <button key={i} onClick={a.onClick} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 0', background: 'none', border: 'none', borderTop: i ? '1px solid var(--charcoal-line)' : 'none', color: 'inherit', textAlign: 'left' }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: a.colour, flex: 'none' }} />
              <span className="grow"><div style={{ fontWeight: 600 }}>{a.text}</div><div style={{ fontSize: 12, color: 'var(--cream-muted)' }}>{a.hint}</div></span>
              <span style={{ color: 'var(--cream-muted)', fontSize: 20 }}>›</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="label bracket" style={{ marginBottom: 8 }}>Commercial position</div>
        <TitleBlock
          sheetRef={job.contractRef}
          head={['Contract value', job.contractValue ? money(job.contractValue) : 'Not set']}
          rows={[
            [['Variations (base)', money(voBase), 'var(--copper)'], ['Incl. uplifts', money(voGross)]],
            [['Priced VOs', String(priced.length)], ['Unpriced VOs', String(unpriced), unpriced ? 'var(--copper-light)' : undefined]],
            [['PO number', job.poNumber || '—'], ['Uplifts', `${job.uplift1}% + ${job.uplift2}%`]],
          ]}
        />
      </div>
    </div>
  )
}

function Soon({ title, what }: { title: string; what: string }) {
  return (
    <div className="stack">
      <div className="label bracket">{title}</div>
      <div className="card empty">
        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Coming in the next build</div>
        {what}
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

export function JobView({ job, vos, onBack, onSetup, onLogVariation, onEditVariation }: {
  job: Job; vos: Variation[]; onBack: () => void; onSetup: () => void; onLogVariation: () => void; onEditVariation: (v: Variation) => void
}) {
  const [tab, setTab] = useState<Tab>('home')
  return (
    <>
      <div className="page">
        <Hero job={job} onBack={onBack} onSetup={onSetup} />
        {tab === 'home' && <Home job={job} vos={vos} go={setTab} onSetup={onSetup} />}
        {tab === 'vos' && <VariationsTab job={job} vos={vos} onLog={onLogVariation} onEdit={onEditVariation} />}
        {tab === 'diary' && <Soon title="Site diary" what="Record your walk-round by voice; completed work and extras are picked out for you to confirm." />}
        {tab === 'scope' && <Soon title="Scope" what="Import the works order / BoQ and tick work off as it's done." />}
        {tab === 'vals' && <Soon title="Valuations" what="Build the valuation from completed scope and priced variations, then issue the invoice." />}
      </div>
      <nav className="nav">
        {NAV.map(({ tab: t, label, Icon }) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><Icon />{label}</button>
        ))}
      </nav>
    </>
  )
}
