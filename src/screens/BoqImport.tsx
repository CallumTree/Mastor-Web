import { useMemo, useState } from 'react'
import type { Job, RateBook } from '../lib/types'
import { RateVerdict, useRateCheck } from './RateCheck'
import { Sheet } from '../components/Ui'
import { money, qtyText, upliftFactor } from '../lib/format'
import type { ParsedLine } from '../lib/boq'
import { readPackFiles, type PackResult } from '../lib/packIntake'
import { Plate } from '../components/Sign'
import type { PackFacts, Source } from '../lib/packFacts'
import { lineValue } from '../lib/valuation'
import { IconScope } from '../components/Icons'

type Stage = { s: 'pick' } | { s: 'reading'; name: string; of: number } | { s: 'review'; boq: PackResult } | { s: 'error'; msg: string }
export type ImportPack = (lines: ParsedLine[], pack: PackResult) => void

export function BoqImport({ job, existing, books = [], onImport, onClose }: {
  job: Job; existing: number; books?: RateBook[]; onImport: ImportPack; onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>({ s: 'pick' })

  const pick = async (files: File[]) => {
    setStage({ s: 'reading', name: files[0].name, of: files.length })
    try { setStage({ s: 'review', boq: await readPackFiles(files, name => setStage({ s: 'reading', name, of: files.length })) }) }
    catch (e) { setStage({ s: 'error', msg: (e as Error).message }) }
  }

  if (stage.s === 'review') return <Review job={job} books={books} existing={existing} boq={stage.boq} onImport={onImport} onBack={() => setStage({ s: 'pick' })} onClose={onClose} />

  return (
    <Sheet onClose={onClose} locked={stage.s === 'reading'} label="Import BoQ">
      <div className="stack">
        <h2 className="label bracket">Read the client’s pack</h2>
        {stage.s === 'reading' ? (
          <div className="panel" role="status" style={{ textAlign: 'center', padding: 28 }}>
            <div className="loading-bar" />
            <div style={{ fontWeight: 600, marginTop: 14 }}>Reading {stage.name}</div>
            <div className="hint" style={{ marginTop: 4 }}>{stage.of > 1 ? `${stage.of} files. ` : ''}Going through every line and checking the documents against each other — keep this open.</div>
          </div>
        ) : (
          <>
            {stage.s === 'error' && <div className="card t-note" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{stage.msg}</div>}
            <div className="muted t-note">
              Pick everything the client sent: spec list, BoQ, works orders, PCI, surveys. Schedules and works orders are read exactly and checked against each other; everything else is kept with the job’s documents. Nothing is added until you confirm.
            </div>
            <label className="btn btn-primary">
              <IconScope /> Choose files
              <input type="file" className="sr-only" multiple accept=".pdf,.xlsx,.xlsm,.xls,.docx,.doc,.csv,.txt,application/pdf" onChange={e => { const f = [...(e.target.files ?? [])]; if (f.length) pick(f); e.target.value = '' }} />
            </label>
          </>
        )}
      </div>
    </Sheet>
  )
}

export function Review({ job, existing, boq, books = [], onImport, onBack, onClose }: {
  job: Job; existing: number; boq: PackResult; books?: RateBook[]; onImport: ImportPack; onBack: () => void; onClose: () => void
}) {
  const [lines, setLines] = useState(boq.lines)
  const [facts, setFacts] = useState<PackFacts | undefined>(boq.facts)
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
  const checkLines = useMemo(() => chosen.map((l, i) => ({ id: String(i), code: l.code, description: l.description, qty: l.qty, unit: l.unit, rate: l.rate })), [lines])
  const { result: rateCheck } = useRateCheck(checkLines, books)
  const near = (a: number, b: number) => b > 0 && Math.abs(a - b) / b < 0.005
  const match = job.contractValue > 0 ? (near(base, job.contractValue) ? 'base' : near(withUplift, job.contractValue) ? 'uplift' : null) : null
  const ordersValue = boq.orders.reduce((t, o) => t + (o.contractValue ?? 0), 0)
  const docs = boq.files.filter(f => f.as.role === 'document').length
  /** One tick-to-include BoQ line — the same row in the by-property and by-room lists. */
  const lineRow = ({ l, i }: { l: (typeof lines)[number]; i: number }) => (
    <label key={i} className={'check-row' + (l.include ? '' : ' off') + (l.issues.length ? ' flagged' : '')}>
      <input type="checkbox" checked={l.include} onChange={() => toggle(i)} />
      <div className="grow">
        {l.code && <span className="mono t-small slate">{l.code}{l.contract ? <span className="muted"> · {l.contract}</span> : null}</span>}
        <div className="t-note" style={{ fontWeight: 500 }}>{l.description}</div>
        <div className="hint">{l.qty != null ? `${qtyText(l.qty)} ${l.unit}` : 'no qty'}{l.rate != null ? ` @ ${money(l.rate)}` : ' · no rate'}</div>
        {l.issues.length > 0 && <div className="flag t-strong">{l.issues.join(' · ')}</div>}
      </div>
      <div className="mono t-small">{l.qty != null && l.rate != null ? money(lineValue(l.qty, l.rate)) : '—'}</div>
    </label>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">Check before importing</h2>

        <div className="panel">
          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="grow"><div className="label">BoQ total (base)</div><div className="amt" style={{ fontSize: 28, fontWeight: 700 }}>{money(base)}</div></div>
            <div style={{ textAlign: 'right' }}><div className="label">Lines</div><div className="amt" style={{ fontSize: 22, fontWeight: 700 }}>{chosen.length}</div></div>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {props.length > 1 ? `${props.length} properties: ${props.join(', ')}` : `${rooms.length} area${rooms.length === 1 ? '' : 's'}`}{boq.ref ? ` · ref ${boq.ref}` : ''}{withUplift - base > 0.005 ? ` · incl. uplifts ${money(withUplift)}` : ''}
          </div>
          {job.contractValue > 0 && (
            <div className="t-small" style={{ marginTop: 10, fontWeight: 600, color: match ? 'var(--green)' : 'var(--ink-2)' }}>
              {match === 'base' && 'Matches your contract value'}
              {match === 'uplift' && 'Matches your contract value once uplifts are applied'}
              {!match && `Contract value is ${money(job.contractValue)} — ${money(Math.abs(job.contractValue - base))} difference. Check for missed or flagged lines.`}
            </div>
          )}
          {boq.orders.length > 0 && <div className="t-small" style={{ marginTop: 8, fontWeight: 600, color: near(base, ordersValue) ? 'var(--green)' : 'var(--ink-2)' }}>
            {near(base, ordersValue) ? `Matches the ${boq.orders.length} works order contract value${boq.orders.length === 1 ? '' : 's'}` : `Works order contract values ${money(ordersValue)} — ${money(Math.abs(ordersValue - base))} ${base < ordersValue ? 'short' : 'over'}. See below.`}
          </div>}
          {boq.method && <div className="hint" style={{ marginTop: 6 }}>{boq.method === 'ai' ? 'Read by AI — check the flagged lines' : 'Read exactly from the documents — no AI'}</div>}
          {boq.columnCheck && boq.columnCheck.length > 0 && (() => {
            const off = boq.columnCheck.filter(c => Math.abs(c.sheet - c.read) > 0.05)
            return <div className="t-small" style={{ marginTop: 8, fontWeight: 600, color: off.length ? 'var(--ink-2)' : 'var(--green)' }}>
              {off.length ? `Column totals differ: ${off.map(c => `${c.stream} sheet ${money(c.sheet)} vs read ${money(c.read)}`).join(' · ')}` : `All ${boq.columnCheck.length} column totals match the sheet`}
            </div>
          })()}
          {boq.truncated && <div className="t-small" style={{ marginTop: 8, color: 'var(--ink)', fontWeight: 600 }}>Check: the document was very long and may have been cut short — check the last section.</div>}
        </div>

        {(boq.findings.length > 0 || boq.agreed > 0) && (
          <div className="stack" style={{ marginTop: 0 }}>
            {boq.agreed > 0 && <Plate kind="ok">{boq.agreed} lines agree across the spec list and works orders</Plate>}
            {boq.findings.length > 0 && <>
              <Plate kind="warn">{boq.findings.length} thing{boq.findings.length === 1 ? '' : 's'} in the documents don’t agree</Plate>
              <ul className="panel findings t-note" style={{ margin: 0, paddingLeft: 30 }}>
                {boq.findings.map((f, i) => <li key={i} style={{ marginTop: i ? 6 : 0 }}>{f}</li>)}
              </ul>
              <div className="hint">Where they differ, the works order (the contract) is used and the line is flagged with the spec list’s figure beside it.</div>
            </>}
          </div>
        )}

        {facts && <FromDocuments f={facts} onChange={setFacts} />}

        {boq.files.length > 1 && (
          <div className="panel t-note">
            <b>In the pack · {boq.files.length} files</b>
            {boq.files.map((f, i) => (
              <div key={i} className="row" style={{ marginTop: 6, alignItems: 'baseline' }}>
                <span className={'badge ' + (f.as.role === 'document' ? 'b-slate' : f.as.role === 'ai' ? 'b-amber' : 'b-green')}>{f.as.role === 'spec' ? 'Schedule' : f.as.role === 'order' ? 'Works order' : f.as.role === 'ai' ? 'AI read' : 'Document'}</span>
                <span className="grow" style={{ overflowWrap: 'anywhere' }}>{f.file.name}<small className="hint" style={{ display: 'block' }}>{f.as.detail}</small></span>
              </div>
            ))}
            <div className="hint" style={{ marginTop: 8 }}>All {boq.files.length} files are saved to the job’s documents as “Client pack”{docs ? `, including the ${docs} that aren’t schedules` : ''}.</div>
          </div>
        )}

        {rateCheck && (
          <div className="stack" style={{ marginTop: 0 }}>
            <RateVerdict r={rateCheck} />
            <div className="hint">Checked against {rateCheck.book?.name}. After importing, Scope → ⋯ → Check rates lists every line.</div>
          </div>
        )}
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
                    <h3 className="label" style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', color: 'var(--ink-2)' }}>{g}</h3>
                    {gRows.map(lineRow)}
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
              <h3 className="label" style={{ marginBottom: 6 }}>{room}</h3>
              <div className="card flush clip">
                {rows.map(lineRow)}
              </div>
            </div>
          )
        })}

        {existing > 0 && <div className="hint">This adds to the {existing} item{existing === 1 ? '' : 's'} already in scope.</div>}
        <button className="btn btn-primary" disabled={!chosen.length} onClick={() => onImport(chosen, { ...boq, facts })}>Import {chosen.length} item{chosen.length === 1 ? '' : 's'}</button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onBack}>Choose different files</button>
      </div>
    </Sheet>
  )
}

const cite = (s: Source) => `${s.document.replace(/^[0-9a-f]{8}-/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ')}${s.page ? `, p. ${s.page}` : ''}`

/** What the PCI and surveys say: facts for the job notes, and work they call for that the scope doesn't have. Ticked = saved. */
function FromDocuments({ f, onChange }: { f: PackFacts; onChange: (f: PackFacts) => void }) {
  if (f.error) return <Plate kind="wait">Site facts not read: {f.error}</Plate>
  if (!f.facts.length && !f.extras.length) return <div className="muted t-note">The other documents were read; nothing in them needs adding to the job.</div>
  const unverified = [...f.facts, ...f.extras].filter(x => !x.verified).length
  const row = (x: PackFacts['facts'][number] | PackFacts['extras'][number], toggle: () => void, head: string, extra?: string) => (
    <label key={head + x.text} className={'check-row pack-fact' + (x.include ? '' : ' off') + (x.verified ? '' : ' flagged')}>
      <input type="checkbox" checked={x.include} onChange={toggle} />
      <div className="grow">
        <div className="t-note" style={{ fontWeight: 500 }}>{x.text}{x.properties.length ? <span className="muted"> · no{x.properties.length > 1 ? 's' : ''}. {x.properties.join(', ')}</span> : null}</div>
        {extra && <div className="hint">{extra}</div>}
        <div className="hint" style={{ marginTop: 2 }}>“{x.quote}” — {cite(x)}</div>
        {!x.verified && <div className="flag t-strong">Quote not found in the document — check it before ticking</div>}
      </div>
    </label>
  )
  const setFact = (i: number) => onChange({ ...f, facts: f.facts.map((x, j) => (j === i ? { ...x, include: !x.include } : x)) })
  const setExtra = (i: number) => onChange({ ...f, extras: f.extras.map((x, j) => (j === i ? { ...x, include: !x.include } : x)) })
  const cats = [...new Set(f.facts.map(x => x.category))]
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <h3 className="sec-h">From the documents · read by AI</h3>
      {f.extras.length > 0 && <>
        <Plate kind="warn">{f.extras.length} piece{f.extras.length === 1 ? '' : 's'} of work the documents ask for that isn’t in the scope</Plate>
        <div className="panel flush clip">
          {f.extras.map((x, i) => row(x, () => setExtra(i), 'x', x.why))}
        </div>
        <div className="hint">Ticked ones are raised as VOs (Identified, unpriced) for you to price and send.</div>
      </>}
      {f.facts.length > 0 && <div className="panel flush clip">
        {cats.map((c, ci) => (
          <div key={c}>
            <h4 className="label" style={{ padding: '8px 14px', borderTop: ci ? '1px solid var(--line)' : undefined, color: 'var(--ink-2)' }}>{c}</h4>
            {f.facts.map((x, i) => (x.category === c ? row(x, () => setFact(i), 'f') : null))}
          </div>
        ))}
      </div>}
      <div className="hint">Ticked facts are saved to the job notes with their quote and page. {unverified ? `${unverified} item${unverified === 1 ? '' : 's'} couldn’t be matched to the document word for word and ${unverified === 1 ? 'is' : 'are'} left unticked.` : 'Every quote was found in its document.'}{f.cut.length ? ` Too long to read whole: ${f.cut.join(', ')} — check the end of ${f.cut.length === 1 ? 'it' : 'them'} yourself.` : ''}</div>
    </div>
  )
}
