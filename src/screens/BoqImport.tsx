import { useState } from 'react'
import type { Job } from '../lib/types'
import { Sheet } from '../components/Ui'
import { money, qtyText, upliftFactor } from '../lib/format'
import { parseBoqRemote, type ParsedBoq, type ParsedLine } from '../lib/boq'
import { lineValue } from '../lib/valuation'
import { IconScope } from '../components/Icons'

type Stage = { s: 'pick' } | { s: 'reading'; name: string } | { s: 'review'; boq: ParsedBoq } | { s: 'error'; msg: string }

export function BoqImport({ job, existing, onImport, onClose }: {
  job: Job; existing: number; onImport: (lines: ParsedLine[], ref: string) => void; onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>({ s: 'pick' })

  const pick = async (file: File) => {
    setStage({ s: 'reading', name: file.name })
    try { setStage({ s: 'review', boq: await parseBoqRemote(file) }) }
    catch (e) { setStage({ s: 'error', msg: (e as Error).message }) }
  }

  if (stage.s === 'review') return <Review job={job} existing={existing} boq={stage.boq} onImport={onImport} onBack={() => setStage({ s: 'pick' })} onClose={onClose} />

  return (
    <Sheet onClose={onClose} locked={stage.s === 'reading'} label="Import BoQ">
      <div className="stack">
        <div className="label bracket">Import BoQ / works order</div>
        {stage.s === 'reading' ? (
          <div className="card-dark" style={{ textAlign: 'center', padding: 28 }}>
            <div className="beam-dot" />
            <div style={{ fontWeight: 600, marginTop: 14 }}>Reading {stage.name}</div>
            <div style={{ fontSize: 13, color: 'var(--cream-muted)', marginTop: 4 }}>Going through every line. A long BoQ can take a minute or two — keep this open.</div>
          </div>
        ) : (
          <>
            {stage.s === 'error' && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: 14 }}>{stage.msg}</div>}
            <div className="muted" style={{ fontSize: 14 }}>
              PDF, Excel, Word or CSV. Every line is read into a checklist for you to review — nothing is added until you confirm.
            </div>
            <label className="btn btn-primary">
              <IconScope /> Choose file
              <input type="file" hidden accept=".pdf,.xlsx,.xlsm,.xls,.docx,.csv,.txt,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
            </label>
          </>
        )}
      </div>
    </Sheet>
  )
}

export function Review({ job, existing, boq, onImport, onBack, onClose }: {
  job: Job; existing: number; boq: ParsedBoq; onImport: (lines: ParsedLine[], ref: string) => void; onBack: () => void; onClose: () => void
}) {
  const [lines, setLines] = useState(boq.lines)
  const [onlyIssues, setOnlyIssues] = useState(false)
  const chosen = lines.filter(l => l.include)
  const base = chosen.reduce((t, l) => t + lineValue(l.qty, l.rate), 0)
  const withUplift = base * upliftFactor(job.uplift1, job.uplift2)
  const flagged = lines.filter(l => l.issues.length).length
  const rooms = [...new Set(lines.map(l => l.room))]
  const props = [...new Set(lines.map(l => l.property).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const multi = props.length > 1
  const [openProps, setOpenProps] = useState<Set<string>>(new Set())
  const toggle = (idx: number) => setLines(ls => ls.map((l, i) => (i === idx ? { ...l, include: !l.include } : l)))
  const near = (a: number, b: number) => b > 0 && Math.abs(a - b) / b < 0.005
  const match = job.contractValue > 0 ? (near(base, job.contractValue) ? 'base' : near(withUplift, job.contractValue) ? 'uplift' : null) : null

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">Check before importing</div>

        <div className="card-dark">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="grow"><div className="label">BoQ total (base)</div><div className="mono" style={{ fontSize: 26, fontWeight: 300, color: 'var(--copper)' }}>{money(base)}</div></div>
            <div style={{ textAlign: 'right' }}><div className="label">Lines</div><div className="mono" style={{ fontSize: 20, fontWeight: 300 }}>{chosen.length}</div></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--cream-muted)', marginTop: 6 }}>
            {props.length > 1 ? `${props.length} properties: ${props.join(', ')}` : `${rooms.length} area${rooms.length === 1 ? '' : 's'}`}{boq.ref ? ` · ref ${boq.ref}` : ''}{withUplift - base > 0.005 ? ` · incl. uplifts ${money(withUplift)}` : ''}
          </div>
          {job.contractValue > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: match ? 'var(--green)' : 'var(--copper-ink)' }}>
              {match === 'base' && '✓ Matches your contract value'}
              {match === 'uplift' && '✓ Matches your contract value once uplifts are applied'}
              {!match && `Contract value is ${money(job.contractValue)} — ${money(Math.abs(job.contractValue - base))} difference. Check for missed or flagged lines.`}
            </div>
          )}
          {boq.method && <div style={{ fontSize: 12, color: 'var(--cream-muted)', marginTop: 6 }}>{boq.method === 'ai' ? 'Read by AI — check the flagged lines' : `Read exactly from the ${boq.method === 'table' ? 'PDF table' : 'spreadsheet'} — no AI`}</div>}
          {boq.columnCheck && boq.columnCheck.length > 0 && (() => {
            const off = boq.columnCheck.filter(c => Math.abs(c.sheet - c.read) > 0.05)
            return <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: off.length ? 'var(--copper-ink)' : 'var(--green)' }}>
              {off.length ? `Column totals differ: ${off.map(c => `${c.stream} sheet ${money(c.sheet)} vs read ${money(c.read)}`).join(' · ')}` : `✓ All ${boq.columnCheck.length} column totals match the sheet`}
            </div>
          })()}
          {boq.truncated && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--copper-light)' }}>⚠ The document was very long and may have been cut short — check the last section.</div>}
        </div>

        {flagged > 0 && (
          <div className="row">
            <div className="grow flag">{flagged} line{flagged === 1 ? '' : 's'} need checking</div>
            <button className={'chip' + (onlyIssues ? ' on' : '')} onClick={() => setOnlyIssues(!onlyIssues)}>{onlyIssues ? 'Show all' : 'Show only these'}</button>
          </div>
        )}

        {multi ? <div className="panel prop-list">{props.map(p => {
          const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => (l.property || '—') === p && (!onlyIssues || l.issues.length))
          if (!rows.length) return null
          const isOpen = openProps.has(p) || onlyIssues
          const sum = rows.filter(({ l }) => l.include).reduce((t, { l }) => t + lineValue(l.qty, l.rate), 0)
          const flagged = rows.filter(({ l }) => l.issues.length).length
          const groups = [...new Set(rows.map(({ l }) => l.workstream || l.room))]
          return (
            <div key={p} className={'prop-item' + (isOpen ? ' open' : '')}>
              <button className="prop-row" aria-label={`Review property ${p}`} aria-expanded={isOpen} onClick={() => setOpenProps(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n })}>
                <span className="prop-no">{p === '—' ? '?' : p}</span>
                <span className="prop-main">
                  <span className="prop-name">{p === '—' ? 'Unassigned' : `No. ${p}`}</span>
                  <span className="prop-meta" style={{ display: 'block' }}>{groups.join(' · ')}</span>
                </span>
                <span className="prop-amt"><span className="mono">{money(sum)}</span><small>{rows.length} lines{flagged ? ` · ${flagged} to check` : ''}</small></span>
                <span className="prop-chev">▸</span>
              </button>
              {isOpen && <div className="prop-body">{groups.map(g => {
                const gRows = rows.filter(({ l }) => (l.workstream || l.room) === g)
                return (
                  <div key={g}>
                    <div className="label" style={{ padding: '8px 14px', borderTop: '1px solid var(--ink-line)', color: 'var(--copper-ink)' }}>{g}</div>
                {gRows.map(({ l, i }, n) => (
                  <label key={i} className="row" style={{ padding: '10px 12px', borderTop: n ? '1px solid var(--cream-line)' : 'none', alignItems: 'flex-start', cursor: 'pointer', opacity: l.include ? 1 : .45, background: l.issues.length ? 'rgba(217,119,6,.07)' : undefined }}>
                    <input type="checkbox" checked={l.include} onChange={() => toggle(i)} style={{ width: 22, height: 22, accentColor: 'var(--copper)', marginTop: 2, flex: 'none' }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      {l.code && <span className="mono" style={{ color: 'var(--copper-ink)', fontSize: 12 }}>{l.code}</span>}
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{l.description}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'no qty'}{l.rate != null ? ` @ ${money(l.rate)}` : ' · no rate'}</div>
                      {l.issues.length > 0 && <div className="flag" style={{ fontWeight: 600 }}>{l.issues.join(' · ')}</div>}
                    </div>
                    <div className="mono" style={{ fontSize: 13 }}>{l.qty != null && l.rate != null ? money(lineValue(l.qty, l.rate)) : '—'}</div>
                  </label>
                ))}
                  </div>
)
              })}</div>}
            </div>
          )
        })}</div> : rooms.map(room => {
          const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.room === room && (!onlyIssues || l.issues.length))
          if (!rows.length) return null
          return (
            <div key={room}>
              <div className="label" style={{ marginBottom: 6 }}>{room}</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {rows.map(({ l, i }, n) => (
                  <label key={i} className="row" style={{ padding: '10px 12px', borderTop: n ? '1px solid var(--cream-line)' : 'none', alignItems: 'flex-start', cursor: 'pointer', opacity: l.include ? 1 : .45, background: l.issues.length ? 'rgba(217,119,6,.07)' : undefined }}>
                    <input type="checkbox" checked={l.include} onChange={() => toggle(i)} style={{ width: 22, height: 22, accentColor: 'var(--copper)', marginTop: 2, flex: 'none' }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      {l.code && <span className="mono" style={{ color: 'var(--copper-ink)', fontSize: 12 }}>{l.code}</span>}
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{l.description}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'no qty'}{l.rate != null ? ` @ ${money(l.rate)}` : ' · no rate'}</div>
                      {l.issues.length > 0 && <div className="flag" style={{ fontWeight: 600 }}>{l.issues.join(' · ')}</div>}
                    </div>
                    <div className="mono" style={{ fontSize: 13 }}>{l.qty != null && l.rate != null ? money(lineValue(l.qty, l.rate)) : '—'}</div>
                  </label>
                ))}
              </div>
            </div>
          )
        })}

        {existing > 0 && <div className="muted" style={{ fontSize: 12 }}>This adds to the {existing} item{existing === 1 ? '' : 's'} already in scope.</div>}
        <button className="btn btn-primary" disabled={!chosen.length} onClick={() => onImport(chosen, boq.ref)}>Import {chosen.length} item{chosen.length === 1 ? '' : 's'}</button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onBack}>Choose a different file</button>
      </div>
    </Sheet>
  )
}
