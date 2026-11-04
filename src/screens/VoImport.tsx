import { useState } from 'react'
import type { Job, Variation } from '../lib/types'
import { IconCamera } from '../components/Icons'
import { Field, Sheet } from '../components/Ui'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { readVoFile, suggestVo, type ParsedVo } from '../lib/voIntake'
import { propertyOf } from '../lib/property'
import { lineValue } from '../lib/valuation'
import { figs } from '../components/Figs'

export interface VoDecision { line: number; include: boolean; target: 'new' | string; property: string }

/** The one way VOs come in from a document: the client's VO ticket, a site instruction, or a VO schedule laid out
 *  like the spec list. Photo, scan, PDF, Word or Excel; each line becomes a VO at its house, or adds the client's
 *  instruction to a VO you had already raised. */
export function VoImport({ job, vos, houses = [], onApply, onClose }: {
  job: Job; vos: Variation[]; houses?: { key: string; label: string }[]
  onApply: (parsed: ParsedVo, decisions: VoDecision[], file: File) => Promise<void>; onClose: () => void
}) {
  const [stage, setStage] = useState<{ s: 'pick' } | { s: 'reading'; name: string } | { s: 'review'; vo: ParsedVo; file: File; dec: VoDecision[] } | { s: 'error'; msg: string }>({ s: 'pick' })
  const [busy, setBusy] = useState(false)
  const open = vos.filter(v => !v.clientRef && v.status === 'Identified')

  const pick = async (file: File) => {
    setStage({ s: 'reading', name: file.name })
    try {
      const vo = await readVoFile(file)
      // the house: the line's own heading on a schedule, else the instruction's address when it names one of the job's houses
      const at = propertyOf(vo.address) ?? ''
      const fallback = houses.some(h => h.key === at) ? at : ''
      setStage({ s: 'review', vo, file, dec: vo.lines.map((l, i) => ({ line: i, include: true, target: suggestVo(l, vos)[0]?.id ?? 'new', property: l.property || fallback })) })
    } catch (e) { setStage({ s: 'error', msg: (e as Error).message }) }
  }
  const normPo = (s: string) => s.toUpperCase().replace(/^H\//, '').replace(/[^A-Z0-9]/g, '')

  if (stage.s === 'review') {
    const { vo, file, dec } = stage
    const setDec = (i: number, d: Partial<VoDecision>) => setStage({ ...stage, dec: dec.map(x => (x.line === i ? { ...x, ...d } : x)) })
    const poOk = !vo.poNumber || !job.poNumber || normPo(vo.poNumber) === normPo(job.poNumber)
    const n = dec.filter(d => d.include).length
    return (
      <Sheet onClose={onClose} label="Import VOs">
        <div className="stack">
          <h2 className="label bracket">Import VOs · check them</h2>
          <div className="panel" style={{ padding: 14 }}>
            <Field label="The client’s VO reference" hint={vo.ref ? 'Read from the document. The VOs come in as instructed under it.' : 'On their document or covering email. With one, the VOs come in as instructed.'}>
              <input className="mono" value={vo.ref} placeholder="None given yet" onChange={e => setStage({ ...stage, vo: { ...vo, ref: e.target.value } })} />
            </Field>
            {(vo.date || vo.description || vo.address || vo.issuedBy) && (
              <div className="t-small" style={{ marginTop: 8 }}>{figs([vo.date && `Issued ${ukDate(vo.date)}`, vo.description, vo.address, vo.issuedBy && `by ${vo.issuedBy}`].filter(Boolean).join(' · '))}</div>
            )}
            {vo.poNumber && <div className="t-small" style={{ marginTop: 6, fontWeight: 600, color: poOk ? 'var(--green)' : 'var(--red)' }}>
              {poOk ? `✓ Varies order ${vo.poNumber} — this job` : `Check: varies order ${vo.poNumber}, but this job's PO is ${job.poNumber}. Check it's the right job.`}</div>}
            <div className="hint" style={{ marginTop: 6 }}>{vo.method === 'ai' ? 'Read by AI — check every number against the document' : 'Read exactly from the spreadsheet — no AI'}</div>
          </div>
          {vo.lines.map((l, i) => {
            const d = dec[i]; const sug = suggestVo(l, vos)
            const homes = d.property && !houses.some(h => h.key === d.property) ? [...houses, { key: d.property, label: `No. ${d.property}` }] : houses
            return (
              <div key={i} className="panel flush">
                <label className={'check-row' + (d.include ? '' : ' off')}>
                  <input type="checkbox" checked={d.include} onChange={e => setDec(i, { include: e.target.checked })} />
                  <span className="grow">
                    {l.code && <span className="mono t-small slate">{l.code} </span>}
                    <span className="t-strong">{l.description}</span>
                    <div className="hint">{figs(l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'no qty')}{figs(l.rate != null ? ` @ ${money(l.rate)}` : ' · no rate')}</div>
                    {l.issues.length > 0 && <div className="flag">{l.issues.join(' · ')}</div>}
                  </span>
                  <span className="mono">{l.qty != null && l.rate != null ? money(lineValue(l.qty, l.rate)) : '—'}</span>
                </label>
                {d.include && (open.length > 0 || homes.length > 0) && (
                  <div className="row" style={{ padding: '0 12px 12px', alignItems: 'flex-end' }}>
                    {open.length > 0 && (
                      <label className="field grow">
                        <span>Goes to</span>
                        <select aria-label={`Line ${i + 1} goes to`} value={d.target} onChange={e => setDec(i, { target: e.target.value })}>
                          <option value="new">New variation</option>
                          {sug.map(v => <option key={v.id} value={v.id}>↳ {voRef(v.number)} — {v.description} (likely match)</option>)}
                          {open.filter(v => !sug.includes(v)).map(v => <option key={v.id} value={v.id}>↳ {voRef(v.number)} — {v.description}</option>)}
                        </select>
                      </label>
                    )}
                    {d.target === 'new' && homes.length > 0 && (
                      <label className="field grow">
                        <span>House</span>
                        <select aria-label={`Line ${i + 1} house`} value={d.property} onChange={e => setDec(i, { property: e.target.value })}>
                          <option value="">Whole job</option>
                          {homes.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <div className="hint">Each VO keeps its own copy of this document as evidence.</div>
          <button className="btn btn-primary" disabled={!n || busy} onClick={async () => { setBusy(true); try { await onApply(vo, dec, file) } finally { setBusy(false) } }}>
            {busy ? 'Adding…' : `Add ${n} VO${n === 1 ? '' : 's'}`}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setStage({ s: 'pick' })}>Choose a different file</button>
        </div>
      </Sheet>
    )
  }
  return (
    <Sheet onClose={onClose} locked={stage.s === 'reading'} label="Import VOs">
      <div className="stack">
        <h2 className="label bracket">Import VOs</h2>
        {stage.s === 'reading' ? (
          <div className="panel" role="status" style={{ textAlign: 'center', padding: 28 }}><div className="loading-bar" /><div style={{ fontWeight: 600, marginTop: 14 }}>Reading {stage.name}</div></div>
        ) : (
          <>
            {stage.s === 'error' && <div className="card t-note" style={{ color: 'var(--red)' }}>{stage.msg}</div>}
            <div className="muted t-note">The client’s VO ticket, site instruction or VO schedule: <b>photo, scan, PDF, Word or Excel</b>. A schedule comes in a VO per line, at its house. Nothing’s added until you check it.</div>
            <label className="btn btn-primary"><IconCamera /> Take a photo<input type="file" className="sr-only" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} /></label>
            <label className="btn btn-secondary">Choose file<input type="file" className="sr-only" accept="image/*,.pdf,.docx,.xlsx,.xlsm,.xls,.csv,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} /></label>
          </>
        )}
      </div>
    </Sheet>
  )
}
