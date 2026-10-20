import { useState } from 'react'
import type { DiaryEntry, ScopeItem, SiteSuggestion } from '../lib/types'
import { openSuggestions } from '../lib/siteRead'
import { usePhotoUrl } from '../lib/photos'
import { money } from '../lib/format'
import { lineValue } from '../lib/valuation'
import { Plate } from '../components/Sign'
import { prettyDay } from '../lib/dates'

const KIND: Record<SiteSuggestion['kind'], { badge: string; cls: string }> = {
  complete: { badge: 'Done', cls: 'b-green' },
  vo: { badge: 'Extra work', cls: 'b-amber' },
  note: { badge: 'Site note', cls: 'b-slate' },
}

function Capture({ e }: { e: DiaryEntry }) {
  const url = usePhotoUrl(e.type === 'photo' ? e.mediaId : null)
  if (url) return <img src={url} alt={e.note || 'Site photo'} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r-sm)', flex: 'none', border: '1px solid var(--line)' }} />
  return <span className="badge b-slate" style={{ flex: 'none' }}>{e.type === 'voice' ? 'Voice' : e.type === 'video' ? 'Video' : 'Note'}</span>
}

/** Vals → From site: what the day's captures suggest, for a person to approve or reject one by one. */
export function SiteReview({ diary, scope, valLabel, onDecide }: {
  diary: DiaryEntry[]; scope: ScopeItem[]; valLabel: string
  onDecide: (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const list = openSuggestions(diary)
  if (!list.length) return null
  const act = async (e: DiaryEntry, s: SiteSuggestion, state: 'approved' | 'rejected') => { setBusy(s.id); try { await onDecide(e, s, state) } finally { setBusy(null) } }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Plate kind="do">From site · {list.length} to review</Plate>
      <div className="panel flush clip">
        {list.map(({ entry: e, s }, n) => {
          const lines = scope.filter(i => s.lineIds.includes(i.id))
          const gone = s.kind === 'complete' && lines.every(i => i.valuationId)
          return (
            <div key={s.id} className="site-sug" style={{ padding: 12, borderTop: n ? '1px solid var(--line)' : 'none' }}>
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
                  {s.basis !== 'seen' && !s.verified && <div className="flag t-strong">Those words weren’t found in what was said — check before approving</div>}
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} disabled={busy === s.id} onClick={() => act(e, s, 'rejected')}>Reject</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy === s.id || gone} onClick={() => act(e, s, 'approved')}>
                  {s.kind === 'complete' ? (gone ? 'Already claimed' : `Add ${lines.filter(i => !i.valuationId).length === 1 ? 'it' : `${lines.filter(i => !i.valuationId).length} lines`} to ${valLabel}`) : s.kind === 'vo' ? 'Raise as a VO' : 'Save to notes'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
