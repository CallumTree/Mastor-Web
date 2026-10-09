import { Wordmark } from '../components/Wordmark'
import { useRef, useState } from 'react'
import type { Job, Variation } from '../lib/types'
import { Drawing } from '../components/Drawing'
import { usePhotoUrl } from '../lib/photos'
import { money } from '../lib/format'
import { IconChart, IconPlus, IconSettings } from '../components/Icons'
import { SyncBadge } from '../components/SyncBadge'
import { getLook, PHOTOS, useBackdrop } from '../lib/look'

/**
 * Jobs — Starlink-style. The job's drawing (or site photo) is the screen; swipe between jobs
 * and the backdrop follows. One solid action (Open job), everything else glass.
 */
// The front page always shows the house — it's the brand moment. Job headers show their own type.
function Backdrop({ job }: { job: Job | null }) {
  const jobPhoto = usePhotoUrl(job?.photoId)
  const photoLook = getLook() === 'photo'
  const bg = useBackdrop(jobPhoto ?? (photoLook ? PHOTOS.cover.src : null))
  return (
    <>
      <div className="sky" />
      {bg.loaded && !jobPhoto && <div style={{ position: 'absolute', zIndex: 3, right: 10, bottom: 4, fontSize: 11, color: 'rgba(245,240,232,.7)' }}>Photo: {PHOTOS.cover.credit}</div>}
      {!bg.loaded && (
        <div className="bg-drawing">
          <Drawing id={job?.id ?? 'mastor'} type="PPR" active={job ? job.status === 'Active' : true} bare />
        </div>
      )}
      {bg.trying && bg.img && <><img className={'bg-photo' + (bg.loaded ? '' : ' pending')} src={bg.img.src} onLoad={bg.img.onLoad} onError={bg.img.onError} alt="" />{bg.loaded && <div className="shade" />}</>}
    </>
  )
}

export function JobsList({ jobs, vos, onOpen, onNew, onDashboard, onSettings }: {
  jobs: Job[]; vos: Variation[]; onOpen: (j: Job) => void; onNew: () => void; onDashboard: () => void; onSettings: () => void
}) {
  const sorted = [...jobs].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'Active' ? -1 : 1))
  const [idx, setIdx] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const current = sorted[Math.min(idx, sorted.length - 1)] ?? null
  const active = sorted.filter(j => j.status === 'Active').length

  const onScroll = () => {
    const el = track.current; if (!el) return
    const card = el.firstElementChild as HTMLElement | null; if (!card) return
    const i = Math.round(el.scrollLeft / (card.offsetWidth + 12))
    if (i !== idx) setIdx(Math.max(0, Math.min(sorted.length - 1, i)))
  }

  return (
    <div className="immersive">
      <Backdrop job={current} />
      <div className="imm-banner"><SyncBadge /></div>
      <button onClick={onSettings} aria-label="Settings" className="btn-glass"
        style={{ position: 'absolute', zIndex: 4, top: 34, left: 14, width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', padding: 0 }}>
        <IconSettings size={22} />
      </button>
      {sorted.length > 0 && (
        <button onClick={onDashboard} aria-label="Director dashboard" className="btn-glass"
          style={{ position: 'absolute', zIndex: 4, top: 34, right: 14, width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', padding: 0 }}>
          <IconChart size={22} />
        </button>
      )}
      <div className="imm-top">
        <Wordmark />
        <div className="imm-sub">{sorted.length ? `${active} active job${active === 1 ? '' : 's'}` : 'Site · Variations · Valuations'}</div>
      </div>

      {sorted.length > 0 ? (
        <>
          <div className="carousel" ref={track} onScroll={onScroll}>
            {sorted.map(j => {
              const unpriced = vos.filter(v => v.jobId === j.id && v.rate === null && v.status !== 'Rejected').length
              const warnings = [!j.poNumber && 'No PO', unpriced > 0 && `${unpriced} unpriced VO${unpriced === 1 ? '' : 's'}`].filter(Boolean)
              return (
                <button key={j.id} className="glass jcard" onClick={() => onOpen(j)}>
                  <div className="row">
                    <span className="label bracket grow">{j.contractRef || j.workType}</span>
                    <span className={'badge ' + (j.status === 'Active' ? 'b-green' : 'b-slate')}>{j.status}</span>
                  </div>
                  <h2>{j.name}</h2>
                  <div className="row" style={{ fontSize: 13, color: 'var(--cream-muted)' }}>
                    <span className="grow">{j.client || '—'}</span>
                    {j.contractValue > 0 && <span className="mono" style={{ color: 'var(--copper)', fontSize: 16 }}>{money(j.contractValue)}</span>}
                  </div>
                  {warnings.length > 0 && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--copper-light)' }}>{warnings.join(' · ')}</div>}
                </button>
              )
            })}
          </div>
          {sorted.length > 1 && <div className="dots">{sorted.map((j, i) => <span key={j.id} className={i === idx ? 'on' : ''} />)}</div>}
        </>
      ) : (
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginTop: 40, color: 'var(--cream-muted)', padding: '0 32px' }}>
          No jobs yet. Add your first job to get started.
        </div>
      )}

      <div className="imm-actions">
        {sorted.length > 0 ? (
          <>
            <button className="btn btn-glass" onClick={onNew}><IconPlus /> New job</button>
            <button className="btn btn-primary" onClick={() => current && onOpen(current)}>Open job</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onNew}><IconPlus /> New job</button>
        )}
      </div>
    </div>
  )
}
