import { useCallback, useEffect, useState } from 'react'
import { blankSettings, type CompanySettings, type Cost, type Dayworks, type DiaryEntry, type Job, type JobDocument, type ScopeItem, type Valuation, type Variation, type WorkOrder } from './lib/types'
import { db, nextVoNumber, rates, uid } from './lib/db'
import { RatesSheet } from './screens/Rates'
import { TeamSheet } from './screens/Team'
import { RateCheckSheet } from './screens/RateCheck'
import { CostsSheet } from './screens/Costs'
import { OrderSheet } from './screens/Orders'
import { DayworksSheet } from './screens/Dayworks'
import { buildDayworksPdf, dayworksVariation, dwRef } from './lib/dayworks'
import { accountsCsv, invoiceRows, periods } from './lib/accounts'
import { buildEvidence, evidenceFileName, orderEvidence, schemeEvidence } from './lib/evidence'
import { AccessContext, accessFor } from './lib/access'
import { claimMany, deleteOpenValuation, issueValuation, lockedIn, toggleScope, toggleVariation } from './lib/valuation'
import { JobsList } from './screens/JobsList'
import { Dashboard } from './screens/Dashboard'
import { onRemoteChange } from './lib/sync'
import { SyncBadge } from './components/SyncBadge'
import { keepStorage, makeBackup, downloadBackup, restoreBackup } from './lib/backup'
import { JobForm } from './screens/JobForm'
import { JobView } from './screens/JobView'
import { EditVariation, LogVariation } from './screens/Variations'
import { buildVoRegister, registerFileName } from './lib/voRegister'
import { ScopeForm } from './screens/Scope'
import { savePhoto, saveVideo, saveImageBlob } from './lib/photos'
import { buildCertificate, certificateFileName, shareOrDownload } from './lib/certificate'
import { meta } from './lib/db'
import { BoqImport } from './screens/BoqImport'
import { VoImport } from './screens/VoImport'
import { CreateInvoiceSheet, SettingsSheet } from './screens/Settings'
import { allocateInvoiceNo, buildInvoice, invoiceAmounts, invoiceFileName, missingForInvoice } from './lib/invoice'
import { money } from './lib/format'
import { Splash } from './components/Splash'

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [vos, setVos] = useState<Variation[]>([])
  const [scope, setScope] = useState<ScopeItem[]>([])
  const [vals, setVals] = useState<Valuation[]>([])
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [dayworks, setDayworks] = useState<Dayworks[]>([])
  const [docs, setDocs] = useState<JobDocument[]>([])
  const [costsOpen, setCostsOpen] = useState(false)
  const [dwOpen, setDwOpen] = useState<'list' | 'new' | null>(null)
  const [orderOpen, setOrderOpen] = useState<WorkOrder | 'new' | null>(null)
  const [logFrom, setLogFrom] = useState<DiaryEntry | null>(null)
  const [settings, setSettings] = useState<CompanySettings | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ratesOpen, setRatesOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [access, setAccess] = useState(accessFor(null))
  const [invoicing, setInvoicing] = useState<Valuation | null>(null)
  const [voImport, setVoImport] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [jobForm, setJobForm] = useState<'new' | 'edit' | null>(null)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<Variation | null>(null)
  const [scopeForm, setScopeForm] = useState<ScopeItem | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [ready, setReady] = useState(false)
  const [showDash, setShowDash] = useState(false)
  const [intro, setIntro] = useState(false)

  const books = settings?.rateBooks ?? []
  const reload = useCallback(async () => {
    const js = await db.jobs()
    const [v, s, va, di] = await Promise.all([
      Promise.all(js.map(j => db.variations(j.id))),
      Promise.all(js.map(j => db.scope(j.id))),
      Promise.all(js.map(j => db.valuations(j.id))),
      Promise.all(js.map(j => db.diary(j.id))),
    ])
    const [co_, or_, dw_, dc_] = await Promise.all([
      Promise.all(js.map(j => db.list('costs', j.id))), Promise.all(js.map(j => db.list('orders', j.id))),
      Promise.all(js.map(j => db.list('dayworks', j.id))), Promise.all(js.map(j => db.list('docs', j.id))),
    ])
    const [st, co] = await Promise.all([db.settings(), meta.get<{ role?: string }>('company')])
    // every state set together after the last await, so the screen updates in one go
    setJobs(js); setVos(v.flat()); setScope(s.flat()); setVals(va.flat()); setDiary(di.flat()); setSettings(st)
    setCosts(co_.flat()); setOrders(or_.flat()); setDayworks(dw_.flat()); setDocs(dc_.flat())
    setAccess(a => (a.role === (co?.role ?? null) ? a : accessFor(co?.role))); setReady(true)
  }, [])
  useEffect(() => { reload(); keepStorage() }, [reload])
  // changes made on another device arrive → refresh what's on screen
  useEffect(() => onRemoteChange(() => { void reload() }), [reload])

  const job = jobs.find(j => j.id === openId) ?? null
  const jobVos = job ? vos.filter(v => v.jobId === job.id) : []
  const jobScope = job ? scope.filter(s => s.jobId === job.id) : []
  const jobVals = job ? vals.filter(v => v.jobId === job.id) : []
  const jobDiary = job ? diary.filter(d => d.jobId === job.id) : []
  const jobCosts = job ? costs.filter(c => c.jobId === job.id) : []
  const jobOrders = job ? orders.filter(o => o.jobId === job.id) : []
  const jobDayworks = job ? dayworks.filter(d => d.jobId === job.id) : []
  const jobDocs = job ? docs.filter(d => d.jobId === job.id) : []
  const run = (fn: () => Promise<unknown>) => async () => { await fn(); await reload() }

  return (
    <AccessContext.Provider value={access}>
      {ready && job && <div className="banner"><SyncBadge dark /></div>}
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
          onAddScope={() => setScopeForm('new')} onEditScope={setScopeForm} onImportScope={() => setImporting(true)} onCheckRates={books.length ? () => setChecking(true) : undefined}
          onEvidence={async () => { const company = settings?.name || (await meta.get<{ name: string }>('company'))?.name; await shareOrDownload(await buildEvidence(schemeEvidence(job, jobScope, jobVals, jobDiary, company)), evidenceFileName(job, 'scheme')) }}
          onIssue={v => run(() => issueValuation(v))()}
          onDeleteOpenVal={v => run(() => deleteOpenValuation(v, jobScope, jobVos))()}
          onPaid={v => run(() => db.putValuation(v))()}
          onImportVo={() => setVoImport(true)}
          onVoRegister={async () => {
            const company = settings?.name || (await meta.get<{ name: string }>('company'))?.name
            await shareOrDownload(await buildVoRegister({ job, vos: jobVos, vals: jobVals, company }), registerFileName(job))
          }}
          onCreateInvoice={v => setInvoicing(v)}
          onInvoicePdf={async v => { if (!settings) return; await shareOrDownload(await buildInvoice({ job, val: v, scope: jobScope, vos: jobVos, settings }), invoiceFileName(job, v)) }}
          onCertificate={async v => {
            const company = (await meta.get<{ name: string }>('company'))?.name
            const blob = await buildCertificate({ job, val: v, vals: jobVals, scope: jobScope, vos: jobVos, company })
            await shareOrDownload(blob, certificateFileName(job, v))
          }}
          onDayworks={(fresh: boolean) => setDwOpen(fresh ? 'new' : 'list')}
          orders={jobOrders} onNewOrder={() => setOrderOpen('new')} onOpenOrder={setOrderOpen} onClaimOrders={lines => run(() => claimMany(lines))()}
          diary={jobDiary} costs={jobCosts} dayRate={settings?.labourDayRate} onCosts={() => setCostsOpen(true)}
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
        <JobsList jobs={jobs} vos={vos} orders={orders} onOpen={j => setOpenId(j.id)} onNew={() => setJobForm('new')} onDashboard={() => setShowDash(true)} onSettings={() => setSettingsOpen(true)} onRates={() => setRatesOpen(true)} />
      )}

      {voImport && job && <VoImport job={job} vos={jobVos} onClose={() => setVoImport(false)}
        onApply={async (vo, dec, file) => {
          const isImage = file.type.startsWith('image/')
          const reason = `Council instruction ${vo.ref}${vo.issuedBy ? ` (${vo.issuedBy})` : ''}${vo.date ? ` issued ${new Date(vo.date).toLocaleDateString('en-GB')}` : ''}`
          for (const d of dec.filter(x => x.include)) {
            const l = vo.lines[d.line]
            // every VO keeps its own copy of the document (deleting one never deletes another's evidence)
            const copy = await saveImageBlob(file)
            const att = { id: copy, name: file.name, type: file.type || 'application/octet-stream' }
            const base = { clientRef: vo.ref, status: 'Instructed' as const, qty: l.qty, unit: l.unit || 'item', rate: l.rate, code: l.code }
            if (d.target !== 'new') {
              const v = jobVos.find(x => x.id === d.target); if (!v) continue
              await db.putVariation({ ...v, ...base, code: l.code || v.code, reason: v.reason ? `${v.reason}\n${reason}` : reason,
                photoIds: isImage ? [...v.photoIds, copy] : v.photoIds, attachments: [...(v.attachments ?? []), att] })
            } else {
              await db.putVariation({ ...base, id: uid(), jobId: job.id, number: await nextVoNumber(job.id), description: l.description, room: l.room !== 'General' ? l.room : '',
                reason, photoIds: isImage ? [copy] : [], dateRaised: vo.date ?? Date.now(), valuationId: null, attachments: [att] })
            }
          }
          setVoImport(false); await reload()
        }} />}
      {settingsOpen && <SettingsSheet settings={settings} onClose={() => setSettingsOpen(false)} onSave={async s => { await db.putSettings(s); setSettingsOpen(false); await reload() }}
        onBackup={async () => downloadBackup(await makeBackup())}
        onRestore={async text => { const r = await restoreBackup(text); await reload(); return r.jobs }}
        onPlayIntro={() => { setSettingsOpen(false); setIntro(true) }} onRates={() => { setSettingsOpen(false); setRatesOpen(true) }} onTeam={() => { setSettingsOpen(false); setTeamOpen(true) }}
        onExportInvoices={async (format, period, code) => {
          const [from, to] = periods()[period]
          const rows = invoiceRows(jobs, vals, scope, vos, from, to)
          if (!rows.length) return 0
          await db.putSettings({ ...(settings ?? blankSettings()), accountsFormat: format, accountsCode: code, updatedAt: Date.now() })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([accountsCsv(rows, format, code)], { type: 'text/csv' }))
          a.download = `mastor-invoices-${format}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 5000)
          return rows.length
        }} />}
      {orderOpen && job && <OrderSheet key={orderOpen === 'new' ? 'new' : orderOpen.id} job={job} order={orderOpen === 'new' ? undefined : orderOpen} scope={jobScope} vals={jobVals} books={books}
        onClose={() => setOrderOpen(null)}
        onEvidence={async o => { const company = settings?.name || (await meta.get<{ name: string }>('company'))?.name; await shareOrDownload(await buildEvidence(orderEvidence(job, o, jobScope, company)), evidenceFileName(job, `Order ${o.ref}`)) }}
        onSave={async (o, lines, removed) => {
          await db.put('orders', o)
          for (const l of lines) await db.putScope(l)
          for (const l of removed) if (!lockedIn(l, jobVals)) await db.deleteScope(l.id)
          setOrderOpen(null); await reload()
        }}
        onDelete={orderOpen !== 'new' ? async () => {
          const o = orderOpen as WorkOrder
          for (const l of jobScope.filter(i => i.orderId === o.id)) await db.deleteScope(l.id)
          await db.remove('orders', o); setOrderOpen(null); await reload()
        } : undefined} />}
      {dwOpen && job && <DayworksSheet job={job} sheets={jobDayworks} vos={jobVos} books={books} startNew={dwOpen === 'new'} onClose={() => setDwOpen(null)}
        onSave={async d => { await db.put('dayworks', d); await reload() }}
        onDelete={async d => { await db.remove('dayworks', d); await reload() }}
        onPdf={async d => { const company = settings?.name || (await meta.get<{ name: string }>('company'))?.name; await shareOrDownload(await buildDayworksPdf(d, job, company), `${(job.contractRef || job.name).replace(/[^A-Za-z0-9-]+/g, '_')}_${dwRef(d.number).replace(' ', '')}.pdf`) }}
        onClaim={async d => {
          // claimed through a variation: one item at the sheet's total, kept in step if the sheet changes before it's valued
          const existing = jobVos.find(v => v.id === d.voId)
          const vo = dayworksVariation(d, job, existing?.number ?? await nextVoNumber(job.id), existing)
          await db.putVariation(vo); await db.put('dayworks', { ...d, voId: vo.id }); await reload()
        }} />}
      {costsOpen && job && <CostsSheet job={job} scope={jobScope} vos={jobVos} diary={jobDiary} costs={jobCosts} dayRate={settings?.labourDayRate}
        onClose={() => setCostsOpen(false)} onSave={async c => { await db.put('costs', c); await reload() }} onDelete={async c => { await db.remove('costs', c); await reload() }} />}
      {checking && job && <RateCheckSheet books={books} lines={jobScope} onClose={() => setChecking(false)} />}
      {teamOpen && <TeamSheet company={settings?.name ?? ''} onClose={() => setTeamOpen(false)} />}
      {ratesOpen && <RatesSheet books={books} onClose={() => setRatesOpen(false)}
        onAddBooks={async (added, items) => {
          // the book list goes in company settings (shared); then the lines, which sync as one file per book
          const s = (await db.settings()) ?? blankSettings()
          await db.putSettings({ ...s, rateBooks: [...(s.rateBooks ?? []), ...added], updatedAt: Date.now() })
          for (let i = 0; i < added.length; i++) await rates.put(added[i].id, items[i])
          await reload()
        }}
        onRemoveBook={async b => {
          const s = (await db.settings()) ?? blankSettings()
          await db.putSettings({ ...s, rateBooks: (s.rateBooks ?? []).filter(x => x.id !== b.id), updatedAt: Date.now() })
          await rates.deleteBook(b.id); await reload()
        }} />}
      {intro && <Splash onDone={() => setIntro(false)} />}
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
            await reload(); setLogging(false); setLogFrom(null)   // close once the new VO is on screen
          }} />
      )}
      {editing && (
        <EditVariation vo={editing} books={books} locked={!!lockedIn(editing, jobVals)} onClose={() => setEditing(null)}
          onSave={async v => {
            // A VO that loses its price can't stay in a valuation
            const stillPriced = v.qty != null && v.rate != null && v.status !== 'Rejected'
            await db.putVariation(stillPriced ? v : { ...v, valuationId: null }); setEditing(null); await reload()
          }}
          onDelete={async () => { await db.deleteVariation(editing); setEditing(null); await reload() }} />
      )}
      {importing && job && (
        <BoqImport job={job} existing={jobScope.length} books={books} onClose={() => setImporting(false)}
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
        <ScopeForm item={scopeForm === 'new' ? undefined : scopeForm} jobId={job.id} books={books}
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
    </AccessContext.Provider>
  )
}
