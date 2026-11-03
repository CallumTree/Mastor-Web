import { useEffect, useRef, useState } from 'react'
import type { DiaryEntry, Job, Variation } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { Markup } from '../components/Markup'
import { ByClaude } from '../components/Sign'
import { usePhotoThumb, usePhotoUrl } from '../lib/photos'
import { addDays, dayKey, prettyDay } from '../lib/dates'
import { weatherFor } from '../lib/weather'
import { voRef } from '../lib/format'
import { IconBack, IconCamera, IconFlag, IconMarkup, IconMic, IconPlay, IconVideo } from '../components/Icons'
import { MAX_VOICE_SECONDS, startRecording, type Recorder } from '../lib/voice'
import { AUTO_DAYS, unread } from '../lib/siteRead'
import { useAccess } from '../lib/access'
import { NoteEditor, NoteRow, newNote, sortNotes } from './Notes'
import type { NoteCategory } from '../lib/types'

export const dayId = (jobId: string, date: string) => `day:${jobId}:${date}`
export const blankDay = (jobId: string, date: string): DiaryEntry => ({ id: dayId(jobId, date), jobId, date, type: 'day', note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: Date.now() })

function Thumb({ e, onOpen }: { e: DiaryEntry; onOpen: () => void }) {
  const tile = useRef<HTMLButtonElement>(null)
  const thumb = usePhotoThumb(e.type === 'photo' ? e.mediaId : null, tile)   // a small copy, made when the tile nears the screen
  const video = usePhotoUrl(e.type === 'video' ? e.mediaId : null)
  const url = e.type === 'video' ? video : thumb
  return (
    <button ref={tile} className="d-thumb" onClick={onOpen} aria-label={e.type === 'video' ? 'Open video' : e.type === 'voice' ? 'Open voice note' : 'Open photo'}>
      {e.type === 'voice' ? <span className="t-small" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4, color: 'var(--ink)', fontWeight: 600 }}><IconMic size={30} />Voice note</span>
        : url && (e.type === 'video'
        ? <video src={url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <img src={url} alt={e.note || 'Site photo'} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
      {e.type === 'video' && <span aria-hidden="true" className="d-thumb-play"><IconPlay size={28} /></span>}
      {e.originalMediaId && <span className="badge b-quiet" style={{ position: 'absolute', left: 4, bottom: 4 }}>Marked up</span>}
      {(e.read || e.voId) && <span style={{ position: 'absolute', left: 4, right: 4, top: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {e.read && <span className={'badge ' + (e.read.suggestions.some(x => x.state === 'open') ? 'b-amber' : 'b-green')}>{e.read.suggestions.some(x => x.state === 'open') ? `${e.read.suggestions.filter(x => x.state === 'open').length} to review` : 'Read'}</span>}
        {e.voId && <span className="badge b-slate" style={{ marginLeft: 'auto' }}>VO</span>}
      </span>}
    </button>
  )
}

function MediaSheet({ e, rooms, vos, onSave, onDelete, onRaiseVo, onClose }: {
  e: DiaryEntry; rooms: string[]; vos: Variation[]
  onSave: (e: DiaryEntry, markedUp?: Blob) => void; onDelete: () => void; onRaiseVo: (e: DiaryEntry) => void; onClose: () => void
}) {
  const url = usePhotoUrl(e.mediaId)
  const originalUrl = usePhotoUrl(e.originalMediaId)
  const [caption, setCaption] = useState(e.note)
  const [room, setRoom] = useState(e.room)
  const [marking, setMarking] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const vo = vos.find(v => v.id === e.voId)
  const close = () => { if (caption !== e.note || room !== e.room) onSave({ ...e, note: caption.trim(), room: room.trim() }); onClose() }
  if (marking && url) return <Markup src={originalUrl ?? url} onCancel={() => setMarking(false)} onSave={b => { setMarking(false); onSave({ ...e, note: caption.trim(), room: room.trim() }, b) }} />
  return (
    <Sheet onClose={close} keepsWork label={e.type === 'video' ? 'Video' : e.type === 'voice' ? 'Voice note' : 'Photo'}>
      <div className="stack">
        <h2 className="label bracket">{e.type === 'video' ? 'Video' : e.type === 'voice' ? 'Voice note' : 'Photo'} · {prettyDay(e.date)}</h2>
        {url && e.type === 'voice' ? <audio src={url} controls style={{ width: '100%' }} /> : url && (e.type === 'video'
          ? <video src={url} controls playsInline style={{ width: '100%', maxHeight: '52vh', background: 'var(--shell)', borderRadius: 'var(--r-sm)' }} />
          : <img src={showOriginal && originalUrl ? originalUrl : url} alt={caption || 'Site photo'} style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', background: 'var(--ground)', borderRadius: 'var(--r-sm)' }} />)}
        {e.transcript && <div className="panel t-note"><div className="label">What was said</div>{e.transcript}</div>}
        {e.originalMediaId && <button className="chip" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Showing original — tap for marked-up' : 'Show original'}</button>}
        <Field label="Caption" hint="Tip: tap the mic on your keyboard to dictate"><input value={caption} onChange={x => setCaption(x.target.value)} placeholder="What does this show?" /></Field>
        <Field label="Room / area"><input value={room} onChange={x => setRoom(x.target.value)} list="diary-rooms" /></Field>
        <datalist id="diary-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
        {e.type === 'photo' && <button className="btn btn-secondary" onClick={() => setMarking(true)}><IconMarkup /> {e.originalMediaId ? 'Mark up again' : 'Mark up'}</button>}
        {vo ? <div className="flag">Evidence for {voRef(vo.number)} — {vo.description}</div>
          : e.type === 'photo' && <button className="btn btn-secondary" onClick={() => { onSave({ ...e, note: caption.trim(), room: room.trim() }); onRaiseVo({ ...e, note: caption.trim(), room: room.trim() }) }}><IconFlag /> Raise VO from this photo</button>}
        <button className="btn btn-primary" onClick={close}>Done</button>
        <ConfirmDelete label="Delete…" confirmLabel={<>Delete this {e.type === 'voice' ? 'voice note' : e.type}</>} onConfirm={onDelete} />
      </div>
    </Sheet>
  )
}

export function DiaryTab({ job, entries, rooms, vos, date, setDate, focusNote, onBack, onSave, onDelete, onAddMedia, onRaiseVo }: {
  job: Job; entries: DiaryEntry[]; rooms: string[]; vos: Variation[]; date: string; setDate: (d: string) => void; focusNote?: boolean
  /** back to the job's line of days */
  onBack?: () => void
  onSave: (e: DiaryEntry, markedUp?: Blob) => void; onDelete: (e: DiaryEntry) => void
  onAddMedia: (file: File | Blob, kind: 'photo' | 'video' | 'voice', date: string) => Promise<void>; onRaiseVo: (e: DiaryEntry) => void
}) {
  const today = dayKey()
  const day = entries.find(e => e.id === dayId(job.id, date)) ?? null
  const media = entries.filter(e => e.date === date && (e.type === 'photo' || e.type === 'video' || e.type === 'voice')).sort((a, b) => a.createdAt - b.createdAt)
  const [recording, setRecording] = useState(false)
  const toRead = unread(entries, date).length
  const [note, setNote] = useState(day?.note ?? '')
  const [weather, setWeather] = useState(day?.weather ?? '')
  const [labour, setLabour] = useState<number | null>(day?.labour ?? null)
  const [open, setOpen] = useState<DiaryEntry | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const { money } = useAccess()
  // the day's own note, and the notes filed from it (client, commercial, H&S): one place for every note, on the day
  const dayNotes = entries.filter(e => e.type === 'note' && e.date === date && (money || e.category !== 'Commercial')).sort(sortNotes)
  const [noteOpen, setNoteOpen] = useState<DiaryEntry | null>(null)
  const FILE_AS: NoteCategory[] = money ? ['Client', 'Commercial', 'H&S'] : ['Client', 'H&S']

  // Refresh from storage (or another device) — but never overwrite the note while it's being typed
  const shownDate = useRef(date)
  useEffect(() => {
    const sameDay = shownDate.current === date; shownDate.current = date
    if (!(sameDay && document.activeElement === noteRef.current)) setNote(day?.note ?? '')
    setWeather(day?.weather ?? ''); setLabour(day?.labour ?? null)
  }, [date, day?.note, day?.weather, day?.labour])
  useEffect(() => { if (focusNote) noteRef.current?.focus() }, [focusNote])
  // Weather fills itself in for today and past days (free service; stays editable)
  useEffect(() => {
    if (day?.weather || date > today) return
    let live = true
    weatherFor(job.address, date).then(w => { if (w && live) { setWeather(w); saveDay({ weather: w }) } })
    return () => { live = false }
  }, [date, job.address])

  const saveDay = (patch: Partial<DiaryEntry>) => onSave({ ...(day ?? blankDay(job.id, date)), note: note.trim(), weather: weather.trim(), labour, ...patch })
  // The note saves itself as you type (a call or a locked screen mid-sentence loses nothing)
  const pending = useRef<{ timer: number; flush: () => void } | null>(null)
  const flushNote = () => { if (pending.current) { clearTimeout(pending.current.timer); const f = pending.current.flush; pending.current = null; f() } }
  const typeNote = (v: string) => {
    setNote(v)
    if (pending.current) clearTimeout(pending.current.timer)
    const flush = () => { if (v.trim() !== (day?.note ?? '')) saveDay({ note: v.trim() }) }
    pending.current = { timer: window.setTimeout(() => { pending.current = null; flush() }, 800), flush }
  }
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') flushNote() }
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', flushNote)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', flushNote); flushNote() }
  }, [])
  /** What's in the box becomes a note of its own with that tag (H&S stays pinned to the job), and the box is clear for the next. */
  const fileAs = (c: NoteCategory) => {
    const text = note.trim(); if (!text) return
    if (pending.current) { clearTimeout(pending.current.timer); pending.current = null }
    onSave(newNote(job, text, c, c === 'H&S', date))
    setNote(''); saveDay({ note: '' })
  }
  const add = async (f: File | Blob | undefined, kind: 'photo' | 'video' | 'voice') => {
    if (!f) return
    setErr(null); setBusy(true)
    try { await onAddMedia(f, kind, date) } catch (x) { setErr(`Couldn’t add that ${kind} — ${(x as Error).message || 'unknown problem'}. Try again, or pick a smaller file.`) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      {onBack && <button className="btn btn-ghost ln-back" onClick={onBack}><IconBack size={18} /> All days</button>}
      <div className="row diary-day">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IconBack size={18} /></button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <h2 className="diary-date">{date === today ? 'Today · ' : date === addDays(today, -1) ? 'Yesterday · ' : ''}{prettyDay(date)}</h2>
        </div>
        <button className="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} style={{ opacity: date >= today ? .35 : 1, transform: 'scaleX(-1)' }}><IconBack size={18} /></button>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="grow"><Field label="Weather" hint={job.address ? undefined : 'Add the site address in job setup and the weather fills in itself.'}><input value={weather} onChange={e => setWeather(e.target.value)} onBlur={() => weather !== (day?.weather ?? '') && saveDay({ weather: weather.trim() })} placeholder={job.address ? 'Looking up…' : 'e.g. Dry, 12°C'} /></Field></div>
        </div>
        <div className="row diary-labour" style={{ marginTop: 12 }}>
          <span className="grow hint t-strong">Labour on site</span>
          <button aria-label="Fewer operatives" onClick={() => { const n = Math.max(0, (labour ?? 0) - 1); setLabour(n); saveDay({ labour: n }) }} className="step-btn">−</button>
          <span className={'diary-count' + (labour == null ? ' unset' : '')}>{labour ?? 'None'}</span>
          <button aria-label="More operatives" onClick={() => { const n = (labour ?? 0) + 1; setLabour(n); saveDay({ labour: n }) }} className="step-btn">+</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Note" hint={note.trim() ? undefined : 'What happened, what was agreed, anything to watch. Tip: tap the mic on your keyboard to dictate'}>
            <textarea ref={noteRef} rows={4} value={note} onChange={e => typeNote(e.target.value)} onBlur={flushNote} placeholder="What happened on site today?" />
          </Field>
          {note.trim().length > 0 && <div className="row file-as" role="group" aria-label="File this note as">
            <span className="hint">File as</span>
            {FILE_AS.map(c => <button key={c} className="chip" onClick={() => fileAs(c)}>{c}</button>)}
          </div>}
          <ByClaude at={day?.byClaude} />
        </div>
        {dayNotes.length > 0 && <div className="day-notes">
          {dayNotes.map(n => <NoteRow key={n.id} n={n} onDay onOpen={() => setNoteOpen(n)} />)}
        </div>}
      </div>

      <div className="row">
        <h2 className="label bracket grow">Photos, video &amp; voice ({media.length})</h2>
      </div>
      {media.length > 0 && (
        <div className="diary-thumbs">
          {media.map(e => <Thumb key={e.id} e={e} onOpen={() => setOpen(e)} />)}
        </div>
      )}
      {err && <div className="flag">{err}</div>}
      <div className="cap-row">
        <label className="btn btn-secondary">
          <IconCamera /> {busy ? 'Saving…' : 'Photo'}
          <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={e => { add(e.target.files?.[0], 'photo'); e.target.value = '' }} />
        </label>
        <label className="btn btn-secondary">
          <IconVideo /> Video
          <input type="file" className="sr-only" accept="video/*" capture="environment" onChange={e => { add(e.target.files?.[0], 'video'); e.target.value = '' }} />
        </label>
        <button className="btn btn-secondary" onClick={() => setRecording(true)}><IconMic /> Voice</button>
      </div>
      <div className="row">
        <label className="btn btn-ghost" style={{ flex: 1 }}>
          From gallery
          <input type="file" className="sr-only" accept="image/*,video/*" onChange={e => { const f = e.target.files?.[0]; add(f, f?.type.startsWith('video') ? 'video' : 'photo'); e.target.value = '' }} />
        </label>
      </div>

      {toRead > 0 && date >= addDays(today, -AUTO_DAYS) && <div className="hint">{money
        ? 'Mastor reads these against the scope once they’ve uploaded and the day goes quiet. What’s done or extra waits in Vals for you to approve.'
        : 'Mastor reads these against the scope once they’ve uploaded. What’s done or extra goes to the office to approve.'}</div>}
      {recording && <VoiceSheet onClose={() => setRecording(false)} onSave={async b => { await add(b, 'voice'); setRecording(false) }} />}

      {noteOpen && <NoteEditor job={job} note={noteOpen} onClose={() => setNoteOpen(null)} onSave={n => { onSave(n); setNoteOpen(null) }} onDelete={() => { onDelete(noteOpen); setNoteOpen(null) }} />}
      {open && <MediaSheet e={open} rooms={rooms} vos={vos} onClose={() => setOpen(null)}
        onSave={(e, b) => { onSave(e, b); setOpen(o => (o ? { ...o, ...e } : o)) }}
        onDelete={() => { onDelete(open); setOpen(null) }}
        onRaiseVo={e => { setOpen(null); onRaiseVo(e) }} />}
    </div>
  )
}

/** Record a voice note: tap to start, tap to stop and keep. */
export function VoiceSheet({ onSave, onClose }: { onSave: (wav: Blob) => Promise<void>; onClose: () => void }) {
  const rec = useRef<Recorder | null>(null)
  const [secs, setSecs] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => () => rec.current?.cancel(), [])
  useEffect(() => {
    if (secs == null) return
    if (secs >= MAX_VOICE_SECONDS) { void stop(); return }
    const t = window.setTimeout(() => setSecs(s => (s == null ? s : s + 1)), 1000)
    return () => clearTimeout(t)
  }, [secs])
  const start = async () => { setErr(null); try { rec.current = await startRecording(); setSecs(0) } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Microphone blocked — allow it for Mastor in the phone’s settings.' : (e as Error).message) } }
  const stop = async () => { const r = rec.current; if (!r) return; rec.current = null; setSecs(null); setSaving(true); try { await onSave(await r.stop()) } catch (e) { setErr(`Couldn’t save the recording — ${(e as Error).message}`); setSaving(false) } }
  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  return (
    <Sheet onClose={() => { rec.current?.cancel(); onClose() }} locked={secs != null || saving} label="Voice note">
      <div className="stack">
        <h2 className="label bracket">Voice note</h2>
        <div className="muted t-note">Say what’s done, where, and anything extra you’ve found — “number 4, front elevation painted; rotten joists under the bath, about two metres”.</div>
        <div className="amt" aria-live="polite" style={{ fontSize: 40, fontWeight: 700, textAlign: 'center' }}>{secs != null ? mmss(secs) : saving ? 'Saving…' : '0:00'}</div>
        {err && <div className="flag">{err}</div>}
        {secs == null
          ? <button className="btn btn-primary" disabled={saving} onClick={start}><IconMic /> Start recording</button>
          : <button className="btn btn-primary" onClick={stop}>Stop and save</button>}
        {secs != null && <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => { rec.current?.cancel(); rec.current = null; setSecs(null) }}>Discard</button>}
      </div>
    </Sheet>
  )
}
