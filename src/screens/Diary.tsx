import { useEffect, useRef, useState } from 'react'
import type { DiaryEntry, Job, Variation } from '../lib/types'
import { Field, Sheet } from '../components/Ui'
import { Markup } from '../components/Markup'
import { TabMenu } from '../components/TabMenu'
import { usePhotoUrl } from '../lib/photos'
import { addDays, dayKey, prettyDay } from '../lib/dates'
import { weatherFor } from '../lib/weather'
import { voRef } from '../lib/format'
import { IconBack, IconCamera, IconFlag } from '../components/Icons'

export const dayId = (jobId: string, date: string) => `day:${jobId}:${date}`
export const blankDay = (jobId: string, date: string): DiaryEntry => ({ id: dayId(jobId, date), jobId, date, type: 'day', note: '', labour: null, weather: '', mediaId: null, originalMediaId: null, room: '', voId: null, createdAt: Date.now() })

function Thumb({ e, onOpen }: { e: DiaryEntry; onOpen: () => void }) {
  const url = usePhotoUrl(e.mediaId)
  return (
    <button onClick={onOpen} aria-label={e.type === 'video' ? 'Open video' : 'Open photo'} style={{ position: 'relative', aspectRatio: '1', padding: 0, border: '1px solid var(--ink-line)', borderRadius: 3, overflow: 'hidden', background: '#E9E3D8' }}>
      {url && (e.type === 'video'
        ? <video src={url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <img src={url} alt={e.note || 'Site photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
      {e.type === 'video' && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 26, textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>▶</span>}
      {e.originalMediaId && <span className="badge b-amber" style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 9 }}>Marked up</span>}
      {e.voId && <span className="badge b-slate" style={{ position: 'absolute', right: 4, top: 4, fontSize: 9 }}>VO</span>}
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
  const [confirm, setConfirm] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const vo = vos.find(v => v.id === e.voId)
  const close = () => { if (caption !== e.note || room !== e.room) onSave({ ...e, note: caption.trim(), room: room.trim() }); onClose() }
  if (marking && url) return <Markup src={originalUrl ?? url} onCancel={() => setMarking(false)} onSave={b => { setMarking(false); onSave({ ...e, note: caption.trim(), room: room.trim() }, b) }} />
  return (
    <Sheet onClose={close} keepsWork label={e.type === 'video' ? 'Video' : 'Photo'}>
      <div className="stack">
        <div className="label bracket">{e.type === 'video' ? 'Video' : 'Photo'} · {prettyDay(e.date)}</div>
        {url && (e.type === 'video'
          ? <video src={url} controls playsInline style={{ width: '100%', maxHeight: '52vh', background: '#000', borderRadius: 3 }} />
          : <img src={showOriginal && originalUrl ? originalUrl : url} alt={caption || 'Site photo'} style={{ width: '100%', maxHeight: '52vh', objectFit: 'contain', background: '#E9E3D8', borderRadius: 3 }} />)}
        {e.originalMediaId && <button className="chip" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Showing original — tap for marked-up' : 'Show original'}</button>}
        <Field label="Caption" hint="Tip: tap the mic on your keyboard to dictate"><input value={caption} onChange={x => setCaption(x.target.value)} placeholder="What does this show?" /></Field>
        <Field label="Room / area"><input value={room} onChange={x => setRoom(x.target.value)} list="diary-rooms" /></Field>
        <datalist id="diary-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
        {e.type === 'photo' && <button className="btn btn-secondary" onClick={() => setMarking(true)}>✎ {e.originalMediaId ? 'Mark up again' : 'Mark up'}</button>}
        {vo ? <div className="flag">Evidence for {voRef(vo.number)} — {vo.description}</div>
          : e.type === 'photo' && <button className="btn btn-secondary" onClick={() => { onSave({ ...e, note: caption.trim(), room: room.trim() }); onRaiseVo({ ...e, note: caption.trim(), room: room.trim() }) }}><IconFlag /> Raise VO from this photo</button>}
        <button className="btn btn-primary" onClick={close}>Done</button>
        {confirm
          ? <button className="btn" style={{ background: 'var(--red)', color: '#fff' }} onClick={onDelete}>Delete this {e.type}</button>
          : <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={() => setConfirm(true)}>Delete…</button>}
      </div>
    </Sheet>
  )
}

export function DiaryTab({ job, entries, rooms, vos, date, setDate, focusNote, onSave, onDelete, onAddMedia, onRaiseVo }: {
  job: Job; entries: DiaryEntry[]; rooms: string[]; vos: Variation[]; date: string; setDate: (d: string) => void; focusNote?: boolean
  onSave: (e: DiaryEntry, markedUp?: Blob) => void; onDelete: (e: DiaryEntry) => void
  onAddMedia: (file: File, kind: 'photo' | 'video', date: string) => Promise<void>; onRaiseVo: (e: DiaryEntry) => void
}) {
  const today = dayKey()
  const day = entries.find(e => e.id === dayId(job.id, date)) ?? null
  const media = entries.filter(e => e.date === date && (e.type === 'photo' || e.type === 'video')).sort((a, b) => a.createdAt - b.createdAt)
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
  const add = async (f: File | undefined, kind: 'photo' | 'video') => {
    if (!f) return
    setErr(null); setBusy(true)
    try { await onAddMedia(f, kind, date) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const recent = [...new Set(entries.filter(e => e.type !== 'note').map(e => e.date))].filter(d => d !== date).sort().reverse().slice(0, 7)

  return (
    <div className="stack">
      <div className="row">
        <button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} style={{ width: 44, height: 44, border: '1px solid var(--ink-line)', background: 'var(--paper-2)', borderRadius: 3, color: 'var(--ink)' }}><IconBack size={18} /></button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <div className="label">{date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : 'Site diary'}</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{prettyDay(date)}</div>
        </div>
        <TabMenu title="Diary" actions={[
          { label: 'Go to today', disabled: date === today, onClick: () => setDate(today) },
          { label: 'Write a note for this day', onClick: () => noteRef.current?.focus() },
        ]} />
        <button aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} style={{ width: 44, height: 44, border: '1px solid var(--ink-line)', background: 'var(--paper-2)', borderRadius: 3, color: 'var(--ink)', opacity: date >= today ? .35 : 1, transform: 'scaleX(-1)' }}><IconBack size={18} /></button>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="grow"><Field label="Weather"><input value={weather} onChange={e => setWeather(e.target.value)} onBlur={() => weather !== (day?.weather ?? '') && saveDay({ weather: weather.trim() })} placeholder={job.address ? 'Looking up…' : 'Add a site address in job setup for automatic weather'} /></Field></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="grow" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>Labour on site</span>
          <button aria-label="Fewer operatives" onClick={() => { const n = Math.max(0, (labour ?? 0) - 1); setLabour(n); saveDay({ labour: n }) }} className="step-btn">−</button>
          <span className="mono" style={{ width: 44, textAlign: 'center', fontSize: 20 }}>{labour ?? '—'}</span>
          <button aria-label="More operatives" onClick={() => { const n = (labour ?? 0) + 1; setLabour(n); saveDay({ labour: n }) }} className="step-btn">+</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Note" hint="Tip: tap the mic on your keyboard to dictate">
            <textarea ref={noteRef} rows={4} value={note} onChange={e => typeNote(e.target.value)} onBlur={flushNote} placeholder="What happened on site today?" />
          </Field>
        </div>
      </div>

      <div className="row">
        <div className="label bracket grow">Photos &amp; video ({media.length})</div>
      </div>
      {media.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {media.map(e => <Thumb key={e.id} e={e} onOpen={() => setOpen(e)} />)}
        </div>
      )}
      {err && <div className="flag">{err}</div>}
      <div className="row">
        <label className="btn btn-secondary" style={{ flex: 1 }}>
          <IconCamera /> {busy ? 'Saving…' : 'Photo'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={e => { add(e.target.files?.[0], 'photo'); e.target.value = '' }} />
        </label>
        <label className="btn btn-secondary" style={{ flex: 1 }}>
          ▶ Video
          <input type="file" accept="video/*" capture="environment" hidden onChange={e => { add(e.target.files?.[0], 'video'); e.target.value = '' }} />
        </label>
        <label className="btn btn-secondary" style={{ flex: 1 }}>
          Gallery
          <input type="file" accept="image/*,video/*" hidden onChange={e => { const f = e.target.files?.[0]; add(f, f?.type.startsWith('video') ? 'video' : 'photo'); e.target.value = '' }} />
        </label>
      </div>

      {recent.length > 0 && (
        <div>
          <div className="label" style={{ margin: '10px 0 6px' }}>Recent days</div>
          <div className="panel" style={{ padding: '2px 14px' }}>
            {recent.map((d, i) => {
              const n = entries.filter(e => e.date === d && (e.type === 'photo' || e.type === 'video')).length
              const dd = entries.find(e => e.id === dayId(job.id, d))
              return (
                <button key={d} onClick={() => setDate(d)} className="row" style={{ width: '100%', background: 'none', border: 'none', borderTop: i ? '1px solid var(--ink-line)' : 'none', padding: '10px 0', textAlign: 'left', color: 'var(--ink)' }}>
                  <span className="grow"><b style={{ fontWeight: 600 }}>{prettyDay(d)}</b><div className="muted" style={{ fontSize: 12 }}>{[dd?.weather, dd?.labour != null ? `${dd.labour} on site` : '', n ? `${n} photo${n === 1 ? '' : 's'}/video` : ''].filter(Boolean).join(' · ') || 'Note only'}</div></span>
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
