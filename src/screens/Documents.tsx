import { useState } from 'react'
import type { JobDocument } from '../lib/types'
import { useAccess } from '../lib/access'
import { ukDate } from '../lib/format'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'

const KINDS: JobDocument['kind'][] = ['Purchase order', 'Client pack', 'RAMS', 'Programme', 'Certificate', 'Drawing', 'Other']
/** Kinds that carry money: hidden from operatives, as rates and values are (server/mcp/docs.ts keeps the same list). */
export const MONEY_KINDS: JobDocument['kind'][] = ['Purchase order']
const size = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)
export const MAX_DOC_BYTES = 20 * 1024 * 1024

/**
 * The job's documents: the client's purchase order and pack, the programme, RAMS, certificates,
 * drawings, kept as filed so they're on the phone on site and Clerk reads them as the source of truth.
 * Mastor stores them; it doesn't write them (your RAMS and programme stay your own documents).
 */
export function DocumentsPanel({ docs, onAdd, onOpen, onDelete }: {
  docs: JobDocument[]; onAdd: (file: File, kind: JobDocument['kind'], name: string) => Promise<void>
  onOpen: (d: JobDocument) => Promise<void>; onDelete: (d: JobDocument) => Promise<void>
}) {
  const { money: office } = useAccess()
  const [picked, setPicked] = useState<File | null>(null)
  const [kind, setKind] = useState<JobDocument['kind']>('RAMS')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState<JobDocument | null>(null)
  const kinds = office ? KINDS : KINDS.filter(k => !MONEY_KINDS.includes(k))
  const sorted = docs.filter(d => office || !MONEY_KINDS.includes(d.kind)).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.addedAt - a.addedAt)
  const guess = (f: File): JobDocument['kind'] => (office && (/(^|[^a-z])(order|po)([^a-z]|$)|\bPC\d{4,}/i.test(f.name)) && !/works? order/i.test(f.name) ? 'Purchase order' : /pre-?construction|pci|spec|works? order|survey|hazard/i.test(f.name) ? 'Client pack' : /rams|method|risk/i.test(f.name) ? 'RAMS' : /programme|gantt/i.test(f.name) ? 'Programme' : /cert|eicr|gas|epc/i.test(f.name) ? 'Certificate' : /dwg|drawing|plan/i.test(f.name) ? 'Drawing' : 'Other')

  return (
    <>
      <div className="row" style={{ margin: '18px 0 8px' }}>
        <h2 className="sec-h grow" style={{ margin: 0 }}>Documents{sorted.length ? ` · ${sorted.length}` : ''}</h2>
        <label className="linkish tap t-note">+ Add document
          <input type="file" className="sr-only" onChange={e => {
            const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
            if (f.size > MAX_DOC_BYTES) { setErr('That file is over 20 MB — save a smaller copy (e.g. PDF) and add that.'); return }
            setErr(null); setPicked(f); setKind(guess(f)); setName(f.name.replace(/\.[^.]+$/, ''))
          }} />
        </label>
      </div>
      {err && <div className="flag" role="alert">{err}</div>}
      <div className="panel chk">
        {sorted.length === 0 && <div className="muted" style={{ padding: '14px' }}>{office ? 'The purchase order, the client’s pack, programme, RAMS, certificates, drawings' : 'The client’s pack, programme, RAMS, certificates, drawings'} — keep them here so they’re on the phone on site. Clerk reads them too, so the paperwork is the source of truth.</div>}
        {sorted.map(d => (
          <div key={d.id} className="chk-row doc-row">
            <button className="grow doc-open" onClick={() => onOpen(d)}><span className="badge b-slate">{d.kind}</span> <b>{d.name}</b><small>{size(d.size)} · added {ukDate(d.addedAt)}</small></button>
            {office && <button className="icon-btn" aria-label={`Remove ${d.name}`} onClick={() => setManage(d)}>×</button>}
          </div>
        ))}
      </div>

      {picked && (
        <Sheet onClose={() => setPicked(null)} label="Add document" locked={busy}>
          <div className="stack">
            <h2 className="label bracket">Add document</h2>
            <div className="muted t-note" style={{ overflowWrap: 'anywhere' }}>{picked.name} · {size(picked.size)}</div>
            <div className="chips" role="group" aria-label="Kind">{kinds.map(k => <button key={k} className={'chip' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div>
            <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
            <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={async () => { setBusy(true); try { await onAdd(picked, kind, name.trim()); setPicked(null) } finally { setBusy(false) } }}>Add to job</button>
          </div>
        </Sheet>
      )}
      {manage && (
        <Sheet onClose={() => setManage(null)} label="Remove document">
          <div className="stack">
            <h2 className="label bracket">{manage.kind} · {manage.name}</h2>
            <ConfirmDelete label="Remove from this job…" confirmLabel="Remove document" onConfirm={async () => { await onDelete(manage); setManage(null) }} />
          </div>
        </Sheet>
      )}
    </>
  )
}
