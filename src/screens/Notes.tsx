import { useState } from 'react'
import type { DiaryEntry, Job, NoteCategory } from '../lib/types'
import { IconPin } from '../components/Icons'
import { ByClaude } from '../components/Sign'
import { NOTE_CATEGORIES } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { uid } from '../lib/db'
import { dayKey, prettyDay } from '../lib/dates'

/**
 * Job notes & decisions — the record that isn't daily site diary: agreements, client requests,
 * chasers, H&S matters. Stored alongside the diary (type 'note') so it syncs with no extra setup.
 */
export const newNote = (job: Job, text: string, category: NoteCategory, pinned = false): DiaryEntry => ({
  id: uid(), jobId: job.id, date: dayKey(), type: 'note', note: text, labour: null, weather: '', mediaId: null, originalMediaId: null,
  room: '', voId: null, createdAt: Date.now(), category, pinned,
})

const catColour: Record<NoteCategory, string> = { Client: 'var(--blue)', Commercial: 'var(--ink)', Site: 'var(--ink)', 'H&S': 'var(--red)', Other: 'var(--ink-muted)' }
// a note saved without a time (imported, back-dated) shows the day only — never a made-up 00:00
const time = (t: number) => { const d = new Date(t); return d.getHours() || d.getMinutes() ? ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '' }

export function NoteRow({ n, onOpen }: { n: DiaryEntry; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 0', color: 'var(--ink)' }}>
      <div className="row">
        <span className="label" style={{ color: catColour[n.category ?? 'Other'] }}>{n.category ?? 'Other'}</span>
        {n.pinned && <span role="img" aria-label="Pinned" style={{ color: 'var(--ink-2)', display: 'inline-flex' }}><IconPin size={14} /></span>}
        <ByClaude at={n.byClaude} />
        <span className="grow" />
        <span className="hint">{prettyDay(n.date)}{time(n.createdAt)}</span>
      </div>
      <div className="t-note" style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{n.note}</div>
    </button>
  )
}

export function NoteEditor({ job, note, onSave, onDelete, onClose }: {
  job: Job; note?: DiaryEntry; onSave: (n: DiaryEntry) => void; onDelete?: () => void; onClose: () => void
}) {
  const [text, setText] = useState(note?.note ?? '')
  const [cat, setCat] = useState<NoteCategory>(note?.category ?? 'Site')
  const [pinned, setPinned] = useState(!!note?.pinned)
  // a new note gets its id once, so a double tap on Add saves the same note twice rather than two notes
  const [base] = useState(() => note ?? newNote(job, '', 'Site', false))
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <h2 className="label bracket">{note ? 'Note' : 'New note'} · {job.name}</h2>
        <div className="chips">{NOTE_CATEGORIES.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
        <Field label="Note" hint="Tip: tap the mic on your keyboard to dictate"><textarea rows={5} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Dylan agreed the airing-cupboard partition can be claimed — email 2 Oct" /></Field>
        <label className="check-row t-note flush" style={{ alignItems: 'center' }}><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pin to the top of the job</label>
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => onSave({ ...base, note: text.trim(), category: cat, pinned })}>{note ? 'Save' : 'Add note'}</button>
        {onDelete && <ConfirmDelete label="Delete…" confirmLabel={<>Delete this note</>} onConfirm={onDelete} />}
      </div>
    </Sheet>
  )
}

const sortNotes = (a: DiaryEntry, b: DiaryEntry) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt

/** The full list: filter by category, add, open to edit. */
export function NotesSheet({ job, notes, onSave, onDelete, onClose }: {
  job: Job; notes: DiaryEntry[]; onSave: (n: DiaryEntry) => void; onDelete: (n: DiaryEntry) => void; onClose: () => void
}) {
  const [filter, setFilter] = useState<NoteCategory | 'All'>('All')
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)
  const [q, setQ] = useState('')
  const shown = notes.filter(n => (filter === 'All' || (n.category ?? 'Other') === filter) && (!q.trim() || n.note.toLowerCase().includes(q.trim().toLowerCase()))).sort(sortNotes)
  if (editing) return <NoteEditor job={job} note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}
    onSave={n => { onSave(n); setEditing(null) }} onDelete={editing !== 'new' ? () => { onDelete(editing); setEditing(null) } : undefined} />
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="row"><h2 className="label bracket grow">Notes &amp; decisions · {job.name}</h2><span className="hint mono">{notes.length}</span></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add note</button>
        <div className="chips">{(['All', ...NOTE_CATEGORIES] as const).map(c => <button key={c} className={'chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{c}</button>)}</div>
        {notes.length > 4 && <Field label="Search notes"><input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. partition, Dylan, asbestos" /></Field>}
        <div className="panel" style={{ padding: '0 14px' }}>
          {shown.length === 0 && <div className="muted" style={{ padding: '14px 0' }}>{notes.length ? 'Nothing matches.' : 'No notes yet. Agreements, client requests, chasers — put them on record here.'}</div>}
          {shown.map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}><NoteRow n={n} onOpen={() => setEditing(n)} /></div>)}
        </div>
      </div>
    </Sheet>
  )
}

export { sortNotes }
