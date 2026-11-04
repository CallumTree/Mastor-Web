/**
 * Shared "register" pieces so Scope, Variations and Valuations read like the same set of drawings:
 * one header (the tab's name — the job is named in the page header above), one ruled ledger of the money, ruled schedules below.
 */
import type { CSSProperties, ReactNode } from 'react'
import { IconChevron } from './Icons'
import { Roll } from './Roll'
import { figs } from './Figs'

export function TabHead({ label, meta, menu }: { label: string; title?: string; meta?: ReactNode; menu?: ReactNode }) {
  return (
    <div className="row">
      <h2 className="tab-title grow">{label}{meta != null && <span className="tab-meta">{meta}</span>}</h2>
      {menu}
    </div>
  )
}

/** A figure's length, so CSS can shrink a long amount (£12,345,678.90) to fit its box instead of cutting it off. */
export const fitLen = (text: string) => ({ '--len': Math.max(6, text.length + (text.match(/%/g)?.length ?? 0)) }) as CSSProperties   // a % is about two figures wide

export interface SumCell {
  label: string; value: string; note?: string; key?: string
  /** the figure this screen is about: set heavier, nothing else (figures are readings, never selections) */
  hot?: boolean
  /** nothing in it: reads "—", never £0.00 */
  nil?: boolean
  /** below zero (a loss): the figure in red */
  neg?: boolean
  /** a caution under the label, as a gold plate ("+ 2 not priced") */
  warn?: string
  /** the row opens something: it becomes a button with a chevron, named by `action` */
  onClick?: () => void; action?: string
}

/** The money, read like a statement: a ruled ledger, each label (and its note) on the left and its figure on the
 *  right, in one column, so amounts line up and compare at a glance. A reading, not a window: no box, no fill and
 *  no corner marks. Only a row that opens something looks like it does (a chevron). The job's progress is charted
 *  once, on the job's line in the header, so a ledger never repeats it as a bar. */
export function SumStrip({ cells, label, caption }: { cells: SumCell[]; label: string; caption?: string }) {
  return (
    <div className="ledger-wrap">
      <div className="ledger" role="group" aria-label={label} data-n={cells.length}>
        {cells.map(c => {
          const text = c.nil ? '—' : c.value
          const inner = <>
            <span className="lg-l">
              <span className="lg-name">{c.label}</span>
              {c.note && <small>{figs(c.note)}</small>}
              {c.warn && <span className="fig-note">{figs(c.warn)}</span>}
            </span>
            <span className={'lg-n' + (c.neg ? ' neg' : '')} style={fitLen(text)}><Roll text={text} /></span>
            {c.onClick && <span className="lg-go" aria-hidden="true"><IconChevron size={18} /></span>}
          </>
          const cls = 'lg-row' + (c.hot ? ' key' : '') + (c.nil ? ' nil' : '')
          return c.onClick
            ? <button key={c.key ?? c.label} type="button" className={cls + ' lg-link'} onClick={c.onClick} aria-label={c.action}>{inner}</button>
            : <div key={c.key ?? c.label} className={cls}>{inner}</div>
        })}
      </div>
      {caption && <div className="sum-caption">{caption}</div>}
    </div>
  )
}

/**
 * A whole-row target that is a real button: sits under the row's content, so the row is one keyboard
 * stop with a proper name, and controls inside it (a tick) stay their own buttons.
 * The row needs className "has-hit".
 */
export function RowHit({ label, onClick, expanded }: { label: string; onClick: () => void; expanded?: boolean }) {
  return <button type="button" className="row-hit" aria-label={label} aria-expanded={expanded} onClick={onClick} />
}
