import { useCallback, useEffect, useState } from 'react'
import type { Job, ScopeItem, Valuation, Variation } from './lib/types'
import { db, nextVoNumber, uid } from './lib/db'
import { deleteOpenValuation, issueValuation, lockedIn, toggleScope, toggleVariation } from './lib/valuation'
import { JobsList } from './screens/JobsList'
import { Dashboard } from './screens/Dashboard'
import { onRemoteChange } from './lib/sync'
import { SyncBadge } from './components/SyncBadge'
import { keepStorage, makeBackup, downloadBackup, restoreBackup } from './lib/backup'
import { JobForm } from './screens/JobForm'
import { JobView } from './screens/JobView'
import { EditVariation, LogVariation } from './screens/Variations'
import { ScopeForm } from './screens/Scope'
import { BoqImport } from './screens/BoqImport'

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [vos, setVos] = useState<Variation[]>([])
  const [scope, setScope] = useState<ScopeItem[]>([])
  const [vals, setVals] = useState<Valuation[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [jobForm, setJobForm] = useState<'new' | 'edit' | null>(null)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<Variation | null>(null)
  const [scopeForm, setScopeForm] = useState<ScopeItem | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [ready, setReady] = useState(false)
  const [showDash, setShowDash] = useState(false)

  const reload = useCallback(async () => {
    const js = await db.jobs()
    const [v, s, va] = await Promise.all([
      Promise.all(js.map(j => db.variations(j.id))),
      Promise.all(js.map(j => db.scope(j.id))),
      Promise.all(js.map(j => db.valuations(j.id))),
    ])
    setJobs(js); setVos(v.flat()); setScope(s.flat()); setVals(va.flat()); setReady(true)
  }, [])
  useEffect(() => { reload(); keepStorage() }, [reload])
  // changes made on another device arrive → refresh what's on screen
  useEffect(() => onRemoteChange(() => { void reload() }), [reload])

  const job = jobs.find(j => j.id === openId) ?? null
  const jobVos = job ? vos.filter(v => v.jobId === job.id) : []
  const jobScope = job ? scope.filter(s => s.jobId === job.id) : []
  const jobVals = job ? vals.filter(v => v.jobId === job.id) : []
  const run = (fn: () => Promise<unknown>) => async () => { await fn(); await reload() }

  return (
    <>
      {ready && job && <div className="banner"><SyncBadge /></div>}
      {!ready ? null : showDash && !job ? (
        <Dashboard jobs={jobs} scope={scope} vos={vos} vals={vals} onBack={() => setShowDash(false)} onOpenJob={j => { setShowDash(false); setOpenId(j.id) }} />
      ) : job ? (
        <JobView job={job} vos={jobVos} scope={jobScope} vals={jobVals}
          onBack={() => setOpenId(null)} onSetup={() => setJobForm('edit')}
          onLogVariation={() => setLogging(true)} onEditVariation={setEditing}
          onToggleVo={v => run(() => toggleVariation(v, jobVals))()}
          onToggleScope={i => run(() => toggleScope(i, jobVals))()}
          onAddScope={() => setScopeForm('new')} onEditScope={setScopeForm} onImportScope={() => setImporting(true)}
          onIssue={v => run(() => issueValuation(v))()}
          onDeleteOpenVal={v => run(() => deleteOpenValuation(v, jobScope, jobVos))()} />
      ) : (
        <JobsList jobs={jobs} vos={vos} onOpen={j => setOpenId(j.id)} onNew={() => setJobForm('new')} onDashboard={() => setShowDash(true)}
          onBackup={async () => downloadBackup(await makeBackup())}
          onRestore={async text => { const r = await restoreBackup(text); await reload(); return r.jobs }} />
      )}

      {jobForm && (
        <JobForm job={jobForm === 'edit' ? job ?? undefined : undefined} onClose={() => setJobForm(null)}
          onSave={async j => { await db.putJob(j); setJobForm(null); await reload(); setOpenId(j.id) }}
          onDelete={jobForm === 'edit' && job ? async () => { await db.deleteJob(job.id); setJobForm(null); setOpenId(null); await reload() } : undefined} />
      )}
      {logging && job && (
        <LogVariation onClose={() => setLogging(false)}
          onSave={async data => { await db.putVariation({ ...data, id: uid(), jobId: job.id, number: await nextVoNumber(job.id), valuationId: null }); setLogging(false); await reload() }} />
      )}
      {editing && (
        <EditVariation vo={editing} locked={!!lockedIn(editing, jobVals)} onClose={() => setEditing(null)}
          onSave={async v => {
            // A VO that loses its price can't stay in a valuation
            const stillPriced = v.qty != null && v.rate != null && v.status !== 'Rejected'
            await db.putVariation(stillPriced ? v : { ...v, valuationId: null }); setEditing(null); await reload()
          }}
          onDelete={async () => { await db.deleteVariation(editing); setEditing(null); await reload() }} />
      )}
      {importing && job && (
        <BoqImport job={job} existing={jobScope.length} onClose={() => setImporting(false)}
          onImport={async (lines, ref) => {
            let order = jobScope.reduce((m, s) => Math.max(m, s.order), 0)
            for (const l of lines) {
              await db.putScope({ id: uid(), jobId: job.id, code: l.code, description: l.description, room: l.room, qty: l.qty, unit: l.unit, rate: l.rate, valuationId: null, order: ++order, createdAt: Date.now() })
            }
            if (ref && !job.contractRef) await db.putJob({ ...job, contractRef: ref })
            setImporting(false); await reload()
          }} />
      )}
      {scopeForm && job && (
        <ScopeForm item={scopeForm === 'new' ? undefined : scopeForm} jobId={job.id}
          nextOrder={jobScope.reduce((m, s) => Math.max(m, s.order), 0) + 1}
          rooms={[...new Set(jobScope.map(s => s.room))]}
          locked={scopeForm !== 'new' && !!lockedIn(scopeForm, jobVals)}
          onClose={() => setScopeForm(null)}
          onSave={async i => {
            const stillPriced = i.qty != null && i.rate != null
            await db.putScope(stillPriced ? i : { ...i, valuationId: null }); setScopeForm(null); await reload()
          }}
          onDelete={scopeForm !== 'new' ? async () => { await db.deleteScope((scopeForm as ScopeItem).id); setScopeForm(null); await reload() } : undefined} />
      )}
    </>
  )
}
