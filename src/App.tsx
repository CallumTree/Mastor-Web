import { useCallback, useEffect, useState } from 'react'
import type { Job, Variation } from './lib/types'
import { db, nextVoNumber, uid } from './lib/db'
import { JobsList } from './screens/JobsList'
import { JobForm } from './screens/JobForm'
import { JobView } from './screens/JobView'
import { EditVariation, LogVariation } from './screens/Variations'

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [vos, setVos] = useState<Variation[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [jobForm, setJobForm] = useState<'new' | 'edit' | null>(null)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<Variation | null>(null)
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const js = await db.jobs()
    const all = (await Promise.all(js.map(j => db.variations(j.id)))).flat()
    setJobs(js); setVos(all); setReady(true)
  }, [])
  useEffect(() => { reload() }, [reload])

  const job = jobs.find(j => j.id === openId) ?? null

  return (
    <>
      {ready && job && <div className="banner">Test mode · saved on this device only</div>}
      {!ready ? null : job ? (
        <JobView job={job} vos={vos.filter(v => v.jobId === job.id)}
          onBack={() => setOpenId(null)} onSetup={() => setJobForm('edit')}
          onLogVariation={() => setLogging(true)} onEditVariation={setEditing} />
      ) : (
        <JobsList jobs={jobs} vos={vos} onOpen={j => setOpenId(j.id)} onNew={() => setJobForm('new')} />
      )}

      {jobForm && (
        <JobForm job={jobForm === 'edit' ? job ?? undefined : undefined} onClose={() => setJobForm(null)}
          onSave={async j => { await db.putJob(j); setJobForm(null); await reload(); setOpenId(j.id) }}
          onDelete={jobForm === 'edit' && job ? async () => { await db.deleteJob(job.id); setJobForm(null); setOpenId(null); await reload() } : undefined} />
      )}
      {logging && job && (
        <LogVariation onClose={() => setLogging(false)}
          onSave={async data => { await db.putVariation({ ...data, id: uid(), jobId: job.id, number: await nextVoNumber(job.id) }); setLogging(false); await reload() }} />
      )}
      {editing && (
        <EditVariation vo={editing} onClose={() => setEditing(null)}
          onSave={async v => { await db.putVariation(v); setEditing(null); await reload() }}
          onDelete={async () => { await db.deleteVariation(editing); setEditing(null); await reload() }} />
      )}
    </>
  )
}
