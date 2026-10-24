/**
 * Shared "register" pieces so Scope, Variations and Valuations read like the same set of drawings:
 * one header (the tab's name — the job is named in the page header above), one boxed summary strip (like the Variation Register PDF), ruled schedules below.
 */
import type { CSSProperties, ReactNode } from 'react'

export function TabHead({ label, meta, menu }: { label: string; title?: string; meta?: ReactNode; menu?: ReactNode }) {
  return (
    <div className="row">
      <h2 className="tab-title grow">{label}{meta != null && <span className="tab-meta">{meta}</span>}</h2>
      {menu}
    </div>
  )
}

/** A figure's length, so CSS can shrink a long amount (£12,345,678.90) to fit its box instead of cutting it off. */
export const fitLen = (text: string) => ({ '--len': Math.max(6, text.length) }) as CSSProperties

export interface SumCell { label: string; value: string; note?: string; hot?: boolean; nil?: boolean; key?: string }

/** Boxed figures strip. A `nil` cell (nothing in it) reads "—", never £0.00. `progress` (0–100) draws a scale bar along the foot, like a drawing's scale. */
export function SumStrip({ cells, cols = 2, progress, label, caption }: { cells: SumCell[]; cols?: 2 | 3; progress?: number; label: string; caption?: string }) {
  const strip = (
    <div className={'sum sum-' + cols} data-n={cells.length} aria-label={label}>
      {cells.map(c => (
        <div key={c.key ?? c.label} className={'sum-cell' + (c.hot ? ' hot' : '') + (c.nil ? ' nil' : '')}>
          <div className="label">{c.label}</div>
          <div className="mono n" style={fitLen(c.nil ? '—' : c.value)}>{c.nil ? '—' : c.value}</div>
          {c.note && <small>{c.note}</small>}
        </div>
      ))}
      {progress != null && <div className="sum-bar"><div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
    </div>
  )
  return caption ? <div>{strip}<div className="sum-caption">{caption}</div></div> : strip
}

/**
 * A whole-row target that is a real button: sits under the row's content, so the row is one keyboard
 * stop with a proper name, and controls inside it (a tick) stay their own buttons.
 * The row needs className "has-hit".
 */
export function RowHit({ label, onClick, expanded }: { label: string; onClick: () => void; expanded?: boolean }) {
  return <button type="button" className="row-hit" aria-label={label} aria-expanded={expanded} onClick={onClick} />
}
