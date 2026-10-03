import { useCallback, useEffect, useState } from 'react'
import type { CompanySettings, DiaryEntry, Job, ScopeItem, Valuation, Variation } from './lib/types'
import { db, nextVoNumber, uid } from './lib/db'
import { claimMany, deleteOpenValuation, issueValuation, lockedIn, toggleScope, toggleVariation } from './lib/valuation'
import { JobsList } from './screens/JobsList'
import { Dashboard } from './screens/Dashboard'
import { onRemoteChange } from './lib/sync'
import { SyncBadge } from './components/SyncBadge'
import { keepStorage, makeBackup, downloadBackup, restoreBackup } from './lib/backup'
import { JobForm } from './screens/JobForm'
import { JobView } from './screens/JobView'
import { EditVariation, LogVariation } from './screens/Variations'
import { ScopeForm } from './screens/Scope'
import { savePhoto, saveVideo, saveImageBlob } from './lib/photos'
import { buildCertificate, certificateFileName, shareOrDownload } from './lib/certificate'
import { meta } from './lib/db'
import { BoqImport } from './screens/BoqImport'
import { CreateInvoiceSheet, SettingsSheet } from './screens/Settings'
import { allocateInvoiceNo, buildInvoice, invoiceAmounts, invoiceFileName, missingForInvoice } from './lib/invoice'
import { money } from './lib/format'

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [vos, setVos] = useState<Variation[]>([])
  const [scope, setScope] = useState<ScopeItem[]>([])
  const [vals, setVals] = useState<Valuation[]>([])
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [logFrom, setLogFrom] = useState<DiaryEntry | null>(null)
  const [settings, setSettings] = useState<CompanySettings | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [invoicing, setInvoicing] = useState<Valuation | null>(null)
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
    const [v, s, va, di] = await Promise.all([
      Promise.all(js.map(j => db.variations(j.id))),
      Promise.all(js.map(j => db.scope(j.id))),
      Promise.all(js.map(j => db.valuations(j.id))),
      Promise.all(js.map(j => db.diary(j.id))),
    ])
    setJobs(js); setVos(v.flat()); setScope(s.flat()); setVals(va.flat()); setDiary(di.flat()); setSettings(await db.settings()); setReady(true)
  }, [])
  useEffect(() => { reload(); keepStorage() }, [reload])
  // changes made on another device arrive → refresh what's on screen
  useEffect(() => onRemoteChange(() => { void reload() }), [reload])

  const job = jobs.find(j => j.id === openId) ?? null
  const jobVos = job ? vos.filter(v => v.jobId === job.id) : []
  const jobScope = job ? scope.filter(s => s.jobId === job.id) : []
  const jobVals = job ? vals.filter(v => v.jobId === job.id) : []
  const jobDiary = job ? diary.filter(d => d.jobId === job.id) : []
  const run = (fn: () => Promise<unknown>) => async () => { await fn(); await reload() }

  return (
    <>
      {ready && job && <div className="banner"><SyncBadge /></div>}
      {!ready ? null : showDash && !job ? (
        <Dashboard jobs={jobs} scope={scope} vos={vos} vals={vals} onBack={() => setShowDash(false)} onOpenJob={j => { setShowDash(false); setOpenId(j.id) }} />
      ) : job ? (
        <JobView job={job} vos={jobVos} scope={jobScope} vals={jobVals}
          onBack={() => setOpenId(null)} onSetup={() => setJobForm('edit')} onUpdateJob={j => run(() => db.putJob(j))()}
          onLogVariation={() => setLogging(true)} onEditVariation={setEditing}
          onToggleVo={v => run(() => toggleVariation(v, jobVals))()}
          onToggleScope={i => run(() => toggleScope(i, jobVals))()}
          onClaimMany={items => run(() => claimMany(items))()}
          onClearUnclaimed={items => run(async () => { for (const i of items) if (!i.valuationId) await db.deleteScope(i.id) })()}
          onDeleteScope={items => run(async () => { for (const i of items) if (!lockedIn(i, jobVals)) await db.deleteScope(i.id) })()}
          onAddScope={() => setScopeForm('new')} onEditScope={setScopeForm} onImportScope={() => setImporting(true)}
          onIssue={v => run(() => issueValuation(v))()}
          onDeleteOpenVal={v => run(() => deleteOpenValuation(v, jobScope, jobVos))()}
          onPaid={v => run(() => db.putValuation(v))()}
          onCreateInvoice={v => setInvoicing(v)}
          onInvoicePdf={async v => { if (!settings) return; await shareOrDownload(await buildInvoice({ job, val: v, scope: jobScope, vos: jobVos, settings }), invoiceFileName(job, v)) }}
          onCertificate={async v => {
            const company = (await meta.get<{ name: string }>('company'))?.name
            const blob = await buildCertificate({ job, val: v, vals: jobVals, scope: jobScope, vos: jobVos, company })
            await shareOrDownload(blob, certificateFileName(job, v))
          }}
          diary={jobDiary}
          onSaveDiary={async (e, markedUp) => {
            // mark-up saves a NEW image; the first original is always kept
            if (markedUp) { const id = await saveImageBlob(markedUp); e = { ...e, originalMediaId: e.originalMediaId ?? e.mediaId, mediaId: id } }
            await db.putDiary(e); await reload()
          }}
          onDeleteDiary={async e => { await db.deleteDiary(e); await reload() }}
          onAddMedia={async (file, kind, date) => {
            const mediaId = kind === 'video' ? await saveVideo(file) : await savePhoto(file)
            await db.putDiary({ id: uid(), jobId: job.id, date, type: kind, note: '', labour: null, weather: '', mediaId, originalMediaId: null, room: '', voId: null, createdAt: Date.now() })
            await reload()
          }}
          onRaiseVoFromPhoto={e => { setLogFrom(e); setLogging(true) }} />
      ) : (
        <JobsList jobs={jobs} vos={vos} onOpen={j => setOpenId(j.id)} onNew={() => setJobForm('new')} onDashboard={() => setShowDash(true)} onSettings={() => setSettingsOpen(true)}
          onBackup={async () => downloadBackup(await makeBackup())}
          onRestore={async text => { const r = await restoreBackup(text); await reload(); return r.jobs }} />
      )}

      {settingsOpen && <SettingsSheet settings={settings} onClose={() => setSettingsOpen(false)} onSave={async s => { await db.putSettings(s); setSettingsOpen(false); await reload() }} />}
      {invoicing && job && (() => {
        const rate = settings?.vatRate ?? 20
        const a = invoiceAmounts(job, invoicing, jobScope, jobVos, rate)
        const alloc = settings ? allocateInvoiceNo(settings, vals) : { number: '—', next: 1 }
        return <CreateInvoiceSheet number={alloc.number} net={money(a.net)} vat={money(a.vat)} total={money(a.total)} rate={rate} missing={missingForInvoice(settings)}
          onClose={() => setInvoicing(null)} onSettings={() => { setInvoicing(null); setSettingsOpen(true) }}
          onCreate={async date => {
            // re-check against every invoice at the moment of creating, then move the sequence on
            const fresh = await db.settings(); if (!fresh) return
            const all = (await Promise.all((await db.jobs()).map(j => db.valuations(j.id)))).flat()
            const { number, next } = allocateInvoiceNo(fresh, all)
            await db.putValuation({ ...invoicing, invoiceNumber: number, invoiceDate: date, invoiceVatRate: rate })
            await db.putSettings({ ...fresh, nextInvoiceNumber: next, updatedAt: Date.now() })
            setInvoicing(null); await reload()
          }} />
      })()}
      {jobForm && (
        <JobForm job={jobForm === 'edit' ? job ?? undefined : undefined} onClose={() => setJobForm(null)}
          onSave={async j => { await db.putJob(j); setJobForm(null); await reload(); setOpenId(j.id) }}
          onDelete={jobForm === 'edit' && job ? async () => { await db.deleteJob(job.id); setJobForm(null); setOpenId(null); await reload() } : undefined} />
      )}
      {logging && job && (
        <LogVariation onClose={() => { setLogging(false); setLogFrom(null) }}
          initial={logFrom ? { description: logFrom.note, room: logFrom.room, photoIds: logFrom.mediaId ? [logFrom.mediaId] : [] } : undefined}
          onSave={async data => {
            const id = uid()
            // The VO keeps its OWN copy of the diary photo — deleting one must never delete the other's evidence
            if (logFrom?.mediaId && data.photoIds.includes(logFrom.mediaId)) {
              const blob = await db.photo(logFrom.mediaId)
              if (blob) { const copy = await saveImageBlob(blob); data = { ...data, photoIds: data.photoIds.map(p => (p === logFrom.mediaId ? copy : p)) } }
            }
            await db.putVariation({ ...data, id, jobId: job.id, number: await nextVoNumber(job.id), valuationId: null })
            if (logFrom) await db.putDiary({ ...logFrom, voId: id })   // the photo now shows it's evidence for this VO
            setLogging(false); setLogFrom(null); await reload()
          }} />
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
              await db.putScope({ id: uid(), jobId: job.id, code: l.code, description: l.description, room: l.room, qty: l.qty, unit: l.unit, rate: l.rate, valuationId: null, order: ++order, createdAt: Date.now(), property: l.property || undefined, workstream: l.workstream || undefined, hours: l.hours })
            }
            if (ref && !job.contractRef) await db.putJob({ ...job, contractRef: ref })
            setImporting(false); await reload()
          }} />
      )}
      {scopeForm && job && (
        <ScopeForm item={scopeForm === 'new' ? undefined : scopeForm} jobId={job.id}
          nextOrder={jobScope.reduce((m, s) => Math.max(m, s.order), 0) + 1}
          rooms={[...new Set(jobScope.map(s => s.room))]}
          props={[...new Set(jobScope.map(s => s.property).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))}
          streams={[...new Set(jobScope.map(s => s.workstream).filter((x): x is string => !!x))]}
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
