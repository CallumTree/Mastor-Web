import { useEffect, useRef, useState } from 'react'
import type { DiaryEntry, Job, Variation } from '../lib/types'
import { Field, Sheet, ConfirmDelete } from '../components/Ui'
import { Markup } from '../components/Markup'
import { TabMenu } from '../components/TabMenu'
import { ByClaude } from '../components/Sign'
import { usePhotoThumb, usePhotoUrl } from '../lib/photos'
import { addDays, dayKey, prettyDay } from '../lib/dates'
import { weatherFor } from '../lib/weather'
import { voRef } from '../lib/format'
import { IconBack, IconCamera, IconFlag, IconMarkup, IconMic, IconPlay, IconVideo } from '../components/Icons'
import { MAX_VOICE_SECONDS, startRecording, type Recorder } from '../lib/voice'
import { unread } from '../lib/siteRead'

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

export function DiaryTab({ job, entries, rooms, vos, date, setDate, focusNote, onSave, onDelete, onAddMedia, onRaiseVo, onRead }: {
  job: Job; entries: DiaryEntry[]; rooms: string[]; vos: Variation[]; date: string; setDate: (d: string) => void; focusNote?: boolean
  onSave: (e: DiaryEntry, markedUp?: Blob) => void; onDelete: (e: DiaryEntry) => void
  onAddMedia: (file: File | Blob, kind: 'photo' | 'video' | 'voice', date: string) => Promise<void>; onRaiseVo: (e: DiaryEntry) => void
  /** read this day's captures against the scope; resolves to a one-line result */
  onRead?: (date: string) => Promise<string>
}) {
  const today = dayKey()
  const day = entries.find(e => e.id === dayId(job.id, date)) ?? null
  const media = entries.filter(e => e.date === date && (e.type === 'photo' || e.type === 'video' || e.type === 'voice')).sort((a, b) => a.createdAt - b.createdAt)
  const [recording, setRecording] = useState(false)
  const [reading, setReading] = useState(false)
  const [readMsg, setReadMsg] = useState<string | null>(null)
  const toRead = unread(entries, date).length
  const [note, setNote] = useState(day?.note ?? '')
  const [weather, setWeather] = useState(day?.weather ?? '')
  const [labour, setLabour] = useState<number | null>(day?.labour ?? null)
  const [open, setOpen] = useState<DiaryEntry | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

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
  const add = async (f: File | Blob | undefined, kind: 'photo' | 'video' | 'voice') => {
    if (!f) return
    setErr(null); setBusy(true)
    try { await onAddMedia(f, kind, date) } catch (x) { setErr(`Couldn’t add that ${kind} — ${(x as Error).message || 'unknown problem'}. Try again, or pick a smaller file.`) } finally { setBusy(false) }
  }
  const recent = [...new Set(entries.filter(e => e.type !== 'note').map(e => e.date))].filter(d => d !== date).sort().reverse().slice(0, 7)

  return (
    <div className="stack">
      <div className="row diary-day">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IconBack size={18} /></button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <h2 className="diary-date">{date === today ? 'Today · ' : date === addDays(today, -1) ? 'Yesterday · ' : ''}{prettyDay(date)}</h2>
        </div>
        <button className="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} style={{ opacity: date >= today ? .35 : 1, transform: 'scaleX(-1)' }}><IconBack size={18} /></button>
        <TabMenu title="Diary" actions={[
          { label: 'Go to today', disabled: date === today, onClick: () => setDate(today) },
          { label: 'Write a note for this day', onClick: () => noteRef.current?.focus() },
        ]} />
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
          <Field label="Note" hint="Tip: tap the mic on your keyboard to dictate">
            <textarea ref={noteRef} rows={4} value={note} onChange={e => typeNote(e.target.value)} onBlur={flushNote} placeholder="What happened on site today?" />
          </Field>
          <ByClaude at={day?.byClaude} />
        </div>
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

      {onRead && (toRead > 0 || readMsg) && (
        <div className="panel stack" style={{ gap: 8 }}>
          {toRead > 0 && <button className="btn btn-primary" disabled={reading} onClick={async () => { setReading(true); setReadMsg(null); try { setReadMsg(await onRead(date)) } finally { setReading(false) } }}>
            {reading ? 'Reading against the scope…' : `Read ${date === today ? 'today' : 'this day'} against the scope · ${toRead} new`}
          </button>}
          {readMsg && <div role="status" className="t-note">{readMsg}</div>}
          {!readMsg && <div className="hint">Photos, voice notes, videos and the note are checked against the scope. What’s done, extra work and site events come back as suggestions in Vals — nothing is claimed until someone approves it.</div>}
        </div>
      )}
      {recording && <VoiceSheet onClose={() => setRecording(false)} onSave={async b => { await add(b, 'voice'); setRecording(false) }} />}

      {recent.length > 0 && (
        <div>
          <h2 className="label" style={{ margin: '10px 0 6px' }}>Recent days</h2>
          <div className="panel" style={{ padding: '2px 14px' }}>
            {recent.map((d, i) => {
              const n = entries.filter(e => e.date === d && (e.type === 'photo' || e.type === 'video')).length
              const dd = entries.find(e => e.id === dayId(job.id, d))
              return (
                <button key={d} onClick={() => setDate(d)} className="row" style={{ width: '100%', background: 'none', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', padding: '10px 0', minHeight: 48, textAlign: 'left', color: 'var(--ink)' }}>
                  <span className="grow"><b className="t-strong">{prettyDay(d)}</b><div className="hint">{[dd?.weather, dd?.labour != null ? `${dd.labour} on site` : '', n ? `${n} photo${n === 1 ? '' : 's'}/video` : ''].filter(Boolean).join(' · ') || 'Note only'}</div></span>
                  <span className="muted">›</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
