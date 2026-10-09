import { useState } from 'react'
import type { DiaryEntry, Job, NoteCategory } from '../lib/types'
import { NOTE_CATEGORIES } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
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

const catColour: Record<NoteCategory, string> = { Client: '#2F6DB5', Commercial: 'var(--copper-ink)', Site: 'var(--ink)', 'H&S': 'var(--red)', Other: 'var(--ink-muted)' }
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function NoteRow({ n, onOpen }: { n: DiaryEntry; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 0', color: 'var(--ink)' }}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: catColour[n.category ?? 'Other'] }}>{n.category ?? 'Other'}</span>
        {n.pinned && <span style={{ fontSize: 11 }} aria-label="Pinned">📌</span>}
        <span className="grow" />
        <span className="muted" style={{ fontSize: 11 }}>{prettyDay(n.date)} · {time(n.createdAt)}</span>
      </div>
      <div style={{ fontSize: 14, marginTop: 3, whiteSpace: 'pre-wrap' }}>{n.note}</div>
    </button>
  )
}

export function NoteEditor({ job, note, onSave, onDelete, onClose }: {
  job: Job; note?: DiaryEntry; onSave: (n: DiaryEntry) => void; onDelete?: () => void; onClose: () => void
}) {
  const [text, setText] = useState(note?.note ?? '')
  const [cat, setCat] = useState<NoteCategory>(note?.category ?? 'Site')
  const [pinned, setPinned] = useState(!!note?.pinned)
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet onClose={onClose}>
      <div className="stack">
        <div className="label bracket">{note ? 'Note' : 'New note'} · {job.name}</div>
        <div className="chips">{NOTE_CATEGORIES.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
        <Field label="Note" hint="Tip: tap the mic on your keyboard to dictate"><textarea rows={5} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Dylan agreed the airing-cupboard partition can be claimed — email 2 Oct" /></Field>
        <label className="row" style={{ gap: 10, fontSize: 14 }}><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--copper)' }} /> Pin to the top of the job</label>
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => onSave(note ? { ...note, note: text.trim(), category: cat, pinned } : newNote(job, text.trim(), cat, pinned))}>{note ? 'Save' : 'Add note'}</button>
        {onDelete && (confirm
          ? <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onDelete}>Delete this note</button>
          : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => setConfirm(true)}>Delete…</button>)}
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
        <div className="row"><div className="label bracket grow">Notes &amp; decisions · {job.name}</div><span className="muted mono" style={{ fontSize: 12 }}>{notes.length}</span></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add note</button>
        <div className="chips">{(['All', ...NOTE_CATEGORIES] as const).map(c => <button key={c} className={'chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{c}</button>)}</div>
        {notes.length > 4 && <Field label="Search notes"><input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. partition, Dylan, asbestos" /></Field>}
        <div className="panel" style={{ padding: '0 14px' }}>
          {shown.length === 0 && <div className="muted" style={{ padding: '14px 0' }}>{notes.length ? 'Nothing matches.' : 'No notes yet. Agreements, client requests, chasers — put them on record here.'}</div>}
          {shown.map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--ink-line)' : 'none' }}><NoteRow n={n} onOpen={() => setEditing(n)} /></div>)}
        </div>
      </div>
    </Sheet>
  )
}

export { sortNotes }
