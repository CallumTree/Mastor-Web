import { useState } from 'react'
import type { Job, Variation } from '../lib/types'
import { Sheet } from '../components/Ui'
import { money, qtyText, ukDate, voRef } from '../lib/format'
import { readVoFile, suggestVo, type ParsedVo } from '../lib/voIntake'
import { lineValue } from '../lib/valuation'

export interface VoDecision { line: number; include: boolean; target: 'new' | string }

/** Import a council variation instruction: scan, photo, screenshot, PDF or Excel. */
export function VoImport({ job, vos, onApply, onClose }: {
  job: Job; vos: Variation[]
  onApply: (parsed: ParsedVo, decisions: VoDecision[], file: File) => Promise<void>; onClose: () => void
}) {
  const [stage, setStage] = useState<{ s: 'pick' } | { s: 'reading'; name: string } | { s: 'review'; vo: ParsedVo; file: File; dec: VoDecision[] } | { s: 'error'; msg: string }>({ s: 'pick' })
  const [busy, setBusy] = useState(false)
  const open = vos.filter(v => !v.clientRef && v.status === 'Identified')

  const pick = async (file: File) => {
    setStage({ s: 'reading', name: file.name })
    try {
      const vo = await readVoFile(file)
      setStage({ s: 'review', vo, file, dec: vo.lines.map((l, i) => ({ line: i, include: true, target: suggestVo(l, vos)[0]?.id ?? 'new' })) })
    } catch (e) { setStage({ s: 'error', msg: (e as Error).message }) }
  }
  const normPo = (s: string) => s.toUpperCase().replace(/^H\//, '').replace(/[^A-Z0-9]/g, '')

  if (stage.s === 'review') {
    const { vo, file, dec } = stage
    const setDec = (i: number, d: Partial<VoDecision>) => setStage({ ...stage, dec: dec.map(x => (x.line === i ? { ...x, ...d } : x)) })
    const poOk = !vo.poNumber || !job.poNumber || normPo(vo.poNumber) === normPo(job.poNumber)
    const chosen = dec.filter(d => d.include)
    return (
      <Sheet onClose={onClose}>
        <div className="stack">
          <div className="label bracket">Council instruction · check before adding</div>
          <div className="panel" style={{ padding: 14 }}>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <div className="grow"><div className="label">Instruction</div><div className="mono" style={{ fontSize: 22, color: 'var(--copper-ink)' }}>{vo.ref || '—'}</div></div>
              <div style={{ textAlign: 'right' }}><div className="label">Issued</div><div>{vo.date ? ukDate(vo.date) : '—'}</div></div>
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }}>{[vo.description, vo.address, vo.issuedBy && `by ${vo.issuedBy}`].filter(Boolean).join(' · ')}</div>
            {vo.poNumber && <div style={{ fontSize: 13, marginTop: 6, fontWeight: 600, color: poOk ? 'var(--green)' : 'var(--red)' }}>
              {poOk ? `✓ Varies order ${vo.poNumber} — this job` : `⚠ Varies order ${vo.poNumber}, but this job's PO is ${job.poNumber}. Check it's the right job.`}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{vo.method === 'ai' ? 'Read by AI — check every number against the document' : 'Read exactly from the spreadsheet — no AI'}</div>
          </div>
          {vo.lines.map((l, i) => {
            const d = dec[i]; const sug = suggestVo(l, vos)
            return (
              <div key={i} className="panel" style={{ padding: 12, opacity: d.include ? 1 : .5 }}>
                <label className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={d.include} onChange={e => setDec(i, { include: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--copper)', marginTop: 2 }} />
                  <span className="grow">
                    {l.code && <span className="mono" style={{ color: 'var(--copper-ink)', fontSize: 12 }}>{l.code} </span>}
                    <span style={{ fontWeight: 600 }}>{l.description}</span>
                    <div className="muted" style={{ fontSize: 12 }}>{l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'no qty'}{l.rate != null ? ` @ ${money(l.rate)}` : ' · no rate'}</div>
                    {l.issues.length > 0 && <div className="flag">{l.issues.join(' · ')}</div>}
                  </span>
                  <span className="mono">{l.qty != null && l.rate != null ? money(lineValue(l.qty, l.rate)) : '—'}</span>
                </label>
                {d.include && (
                  <select aria-label={`Line ${i + 1} goes to`} value={d.target} onChange={e => setDec(i, { target: e.target.value })} style={{ marginTop: 10, width: '100%' }}>
                    <option value="new">➕ New variation</option>
                    {sug.map(v => <option key={v.id} value={v.id}>↳ {voRef(v.number)} — {v.description} (likely match)</option>)}
                    {open.filter(v => !sug.includes(v)).map(v => <option key={v.id} value={v.id}>↳ {voRef(v.number)} — {v.description}</option>)}
                  </select>
                )}
              </div>
            )
          })}
          <div className="muted" style={{ fontSize: 12 }}>Each variation gets the council's reference, is marked Instructed, and keeps a copy of this document as evidence.</div>
          <button className="btn btn-primary" disabled={!chosen.length || busy} onClick={async () => { setBusy(true); try { await onApply(vo, dec, file) } finally { setBusy(false) } }}>
            {busy ? 'Adding…' : `Add ${chosen.length} to variations`}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setStage({ s: 'pick' })}>Choose a different file</button>
        </div>
      </Sheet>
    )
  }
  return (
    <Sheet onClose={stage.s === 'reading' ? () => {} : onClose}>
      <div className="stack">
        <div className="label bracket">Import council instruction</div>
        {stage.s === 'reading' ? (
          <div className="card-dark" style={{ textAlign: 'center', padding: 28 }}><div className="beam-dot" /><div style={{ fontWeight: 600, marginTop: 14 }}>Reading {stage.name}</div></div>
        ) : (
          <>
            {stage.s === 'error' && <div className="card" style={{ color: 'var(--red)', fontSize: 14 }}>{stage.msg}</div>}
            <div className="muted" style={{ fontSize: 14 }}>A VO ticket, site instruction or works order — <b>photo, scan, screenshot, PDF or Excel</b>. Nothing's added until you check it.</div>
            <label className="btn btn-primary">📷 Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} /></label>
            <label className="btn btn-secondary">Choose file<input type="file" hidden accept="image/*,.pdf,.xlsx,.xlsm,.xls,.csv,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} /></label>
          </>
        )}
      </div>
    </Sheet>
  )
}
