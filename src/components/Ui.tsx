import type { ReactNode } from 'react'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, warn, children }: { label: string; hint?: string; warn?: boolean; children: ReactNode }) {
  return (
    <label className={'field' + (warn ? ' warn' : '')}>
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  )
}

/** Mastor's signature: a drawing title block. One per screen. */
export function TitleBlock({ head, rows, sheetRef, progress }: {
  head: [string, string]; rows: [string, string, string?][][]; sheetRef?: string; progress?: number
}) {
  return (
    <div className="tb-wrap">
      <div className="tb">
        <div className="tb-cell tb-head">
          <div className="row"><div className="tb-label grow">{head[0]}</div>{sheetRef && <div className="tb-label" style={{ opacity: .6 }}>{sheetRef}</div>}</div>
          <div className="tb-val">{head[1]}</div>
        </div>
        {rows.map((r, i) => (
          <div className="tb-row" key={i}>
            {r.map(([l, v, c], j) => (
              <div className="tb-cell" key={j}>
                <div className="tb-label">{l}</div>
                <div className="tb-val" style={c ? { color: c } : undefined}>{v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {progress !== undefined && <div className="scalebar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
    </div>
  )
}
