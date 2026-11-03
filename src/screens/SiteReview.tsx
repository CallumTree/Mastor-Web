import { useLayoutEffect, useRef, useState } from 'react'
import type { DiaryEntry, ScopeItem, SiteSuggestion } from '../lib/types'
import { openSuggestions, unread } from '../lib/siteRead'

const unreadCount = (diary: DiaryEntry[]) => [...new Set(diary.map(e => e.date))].reduce((t, d) => t + unread(diary, d).length, 0)
import { usePhotoThumb } from '../lib/photos'
import { money } from '../lib/format'
import { lineValue } from '../lib/valuation'
import { Plate } from '../components/Sign'
import { prettyDay } from '../lib/dates'
import { Roll } from '../components/Roll'
import { reducedMotion, wait } from '../lib/motion'
import { IconCheck } from '../components/Icons'

const KIND: Record<SiteSuggestion['kind'], { badge: string; cls: string }> = {
  complete: { badge: 'Done', cls: 'b-green' },
  vo: { badge: 'Extra work', cls: 'b-amber' },
  note: { badge: 'Site note', cls: 'b-slate' },
}

function Capture({ e }: { e: DiaryEntry }) {
  const url = usePhotoThumb(e.type === 'photo' ? e.mediaId : null)
  if (url) return <img src={url} alt={e.note || 'Site photo'} decoding="async" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r-sm)', flex: 'none', border: '1px solid var(--line)' }} />
  return <span className="badge b-slate" style={{ flex: 'none' }}>{e.type === 'voice' ? 'Voice' : e.type === 'video' ? 'Video' : 'Note'}</span>
}

/** Vals → From site: what the day's captures suggest, for a person to approve or reject one by one. */
export function SiteReview({ diary, scope, valLabel, onDecide, note }: {
  diary: DiaryEntry[]; scope: ScopeItem[]; valLabel: string
  onDecide: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>
  /** why the day's captures aren't being read just now (the daily limit, not set up…) */
  note?: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const list = openSuggestions(diary)
  const waiting = unreadCount(diary)
  // a decided row confirms, folds shut, then goes; the count ticks down as it folds
  const [leaving, setLeaving] = useState<Record<string, 'approved' | 'rejected'>>({})
  // suggestions that arrive while you're looking (the automatic read just finished) come in one after another,
  // and the corner marks close in on them; the ones already here when the screen opens just sit there
  const seen = useRef<Set<string> | null>(null)
  const [arrived, setArrived] = useState<{ ids: Set<string>; k: number } | null>(null)
  const ids = list.map(x => x.s.id).join()
  useLayoutEffect(() => {
    const now = list.map(x => x.s.id)
    if (!seen.current) { seen.current = new Set(now); return }
    const fresh = now.filter(id => !seen.current!.has(id))
    now.forEach(id => seen.current!.add(id))
    if (!fresh.length || reducedMotion()) return
    setArrived(a => ({ ids: new Set(fresh), k: (a?.k ?? 0) + 1 }))
    const t = setTimeout(() => setArrived(null), 2600)
    return () => clearTimeout(t)
  }, [ids])   // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return note && waiting ? <div className="hint site-note">Site captures aren’t being read just now: {note}</div> : null
  const act = async (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => {
    setBusy(s.id); setLeaving(l => ({ ...l, [s.id]: state }))
    try {
      await wait(reducedMotion() ? 150 : state === 'approved' ? 440 : 320)
      await onDecide(e, s, state)
    } catch (x) {
      setLeaving(l => { const { [s.id]: _, ...rest } = l; return rest })   // it didn't save: the row comes back
      throw x
    } finally { setBusy(null) }
  }
  const left = list.filter(x => !leaving[x.s.id]).length
  return (
    <div className="stack site-review" style={{ gap: 8 }}>
      <Plate kind="do">From site · <Roll text={String(left)} /> to review</Plate>
      <div className="hint">Read from the site’s photos, video and voice notes. Check each one: nothing is claimed or raised until you approve it.</div>
      {note && waiting > 0 && <div className="hint">{waiting} more capture{waiting === 1 ? '' : 's'} not read yet: {note}</div>}
      <div className="site-wrap">{arrived && <span key={arrived.k} className="site-marks" aria-hidden="true" />}<div className="panel flush clip">
        {list.map(({ entry: e, s }, n) => {
          const lines = scope.filter(i => s.lineIds.includes(i.id))
          const gone = s.kind === 'complete' && lines.every(i => i.valuationId)
          const going = leaving[s.id]
          const order = arrived ? [...arrived.ids].indexOf(s.id) : -1
          return (
            <div key={s.id} className={'sug-fold' + (going ? ' going ' + going : '') + (order >= 0 ? ' arrive' : '')} style={order >= 0 ? { animationDelay: `${order * 70}ms` } : undefined}><div className="sug-fold-in">
            <div className="site-sug" style={{ padding: 12, borderTop: n ? '1px solid var(--line)' : 'none' }}>
              <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <Capture e={e} />
                <div className="grow">
                  <div><span className={'badge ' + KIND[s.kind].cls}>{KIND[s.kind].badge}</span> <span className="hint">{prettyDay(e.date)}{s.property ? ` · No. ${s.property}` : ''}{s.room ? ` · ${s.room}` : ''}</span></div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{s.text}</div>
                  {s.kind === 'complete' && lines.map(i => (
                    <div key={i.id} className="hint">{i.property ? `No. ${i.property} · ` : ''}<span className="mono">{i.code}</span> {i.description} · {money(lineValue(i.qty, i.rate))}{i.valuationId ? ' · already claimed' : ''}</div>
                  ))}
                  {s.kind === 'vo' && <div className="hint">{s.qty != null ? `${s.qty} ${s.unit}` : 'Not measured'}{s.code ? ` · ${s.code}` : ''} · unpriced until you price it</div>}
                  {s.quote && <div className="hint" style={{ marginTop: 2 }}>“{s.quote}”</div>}
                  {s.basis === 'seen' && <div className="flag t-strong">From the {e.type === 'video' ? 'video' : 'photo'} alone — look before approving</div>}
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy === s.id} onClick={() => act(e, s, 'rejected')}>Reject</button>
                <button className={'btn btn-primary' + (going === 'approved' ? ' confirmed' : '')} style={{ flex: 2 }} disabled={(busy === s.id && going !== 'approved') || gone} onClick={() => { if (!going) void act(e, s, 'approved') }}>
                  {going === 'approved' ? <><IconCheck size={20} />{s.kind === 'complete' ? `Added to ${valLabel}` : s.kind === 'vo' ? 'Raised' : 'Saved'}</>
                    : s.kind === 'complete' ? (gone ? 'Already claimed' : `Add ${lines.filter(i => !i.valuationId).length === 1 ? 'it' : `${lines.filter(i => !i.valuationId).length} lines`} to ${valLabel}`) : s.kind === 'vo' ? 'Raise as a VO' : 'Save to notes'}
                </button>
              </div>
            </div>
            </div></div>
          )
        })}
      </div></div>
    </div>
  )
}
