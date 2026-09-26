import type { Job, Variation } from '../lib/types'
import { Drawing } from '../components/Drawing'
import { usePhotoUrl } from '../lib/photos'
import { money } from '../lib/format'
import { IconPlus } from '../components/Icons'

function JobCard({ job, unpriced, onOpen }: { job: Job; unpriced: number; onOpen: () => void }) {
  const photo = usePhotoUrl(job.photoId)
  return (
    <button className="hero" style={{ width: '100%', border: 'none', textAlign: 'left', padding: 0, display: 'block' }} onClick={onOpen}>
      {photo ? <img src={photo} alt="" /> : <Drawing id={job.id} type={job.workType} active={job.status === 'Active'} />}
      <div className="hero-top">
        <span className="label bracket">{job.contractRef || job.workType}</span>
        <span className={'badge ' + (job.status === 'Active' ? 'b-green' : 'b-slate')}>{job.status}</span>
      </div>
      <div className="hero-bottom">
        <h2>{job.name}</h2>
        <div className="row" style={{ marginTop: 4, fontSize: 13, color: 'var(--cream-muted)' }}>
          <span className="grow">{job.client || '—'}</span>
          <span className="mono" style={{ color: 'var(--copper)', fontSize: 16 }}>{job.contractValue ? money(job.contractValue) : ''}</span>
        </div>
        {(!job.poNumber || unpriced > 0) && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--copper-light)', fontWeight: 600 }}>
            {[!job.poNumber && 'No PO', unpriced > 0 && `${unpriced} unpriced VO${unpriced === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </button>
  )
}

export function JobsList({ jobs, vos, onOpen, onNew }: { jobs: Job[]; vos: Variation[]; onOpen: (j: Job) => void; onNew: () => void }) {
  const sorted = [...jobs].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'Active' ? -1 : 1))
  return (
    <div className="page" style={{ paddingBottom: 32 }}>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="grow">
          <div className="label" style={{ letterSpacing: '.4em', color: 'var(--copper)', fontSize: 13 }}>MASTOR</div>
          <h1>Jobs</h1>
        </div>
      </div>
      <div className="stack">
        {sorted.length === 0 && <div className="card empty">No jobs yet.<br />Add your first job to get started.</div>}
        {sorted.map(j => <JobCard key={j.id} job={j} unpriced={vos.filter(v => v.jobId === j.id && v.rate === null && v.status !== 'Rejected').length} onOpen={() => onOpen(j)} />)}
        <button className="btn btn-primary" onClick={onNew}><IconPlus /> New job</button>
      </div>
    </div>
  )
}
