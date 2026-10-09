/**
 * Shared "register" pieces so Scope, Variations and Valuations read like the same set of drawings:
 * one header, one boxed summary strip (like the Variation Register PDF), ruled schedules below.
 */
import type { ReactNode } from 'react'

export function TabHead({ label, title, meta, menu }: { label: string; title: string; meta?: ReactNode; menu?: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="label bracket">{label}{meta != null && <span className="tab-meta">{meta}</span>}</div>
        <h1 style={{ fontSize: 22, margin: '2px 0 0' }}>{title}</h1>
      </div>
      {menu}
    </div>
  )
}

export interface SumCell { label: string; value: string; note?: string; hot?: boolean; nil?: boolean; key?: string }

/** Boxed figures strip. A `nil` cell (nothing in it) reads "—", never £0.00. `progress` (0–100) draws a scale bar along the foot, like a drawing's scale. */
export function SumStrip({ cells, cols = 2, progress, label, caption }: { cells: SumCell[]; cols?: 2 | 3; progress?: number; label: string; caption?: string }) {
  const strip = (
    <div className={'sum sum-' + cols} aria-label={label}>
      {cells.map(c => (
        <div key={c.key ?? c.label} className={'sum-cell' + (c.hot ? ' hot' : '') + (c.nil ? ' nil' : '')}>
          <div className="label">{c.label}</div>
          <div className="mono n">{c.nil ? '—' : c.value}</div>
          {c.note && <small>{c.note}</small>}
        </div>
      ))}
      {progress != null && <div className="sum-bar"><div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
    </div>
  )
  return caption ? <div>{strip}<div className="sum-caption">{caption}</div></div> : strip
}
