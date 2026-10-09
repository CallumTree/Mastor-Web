import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Bottom sheet. Once anything has been typed or changed inside it, a stray tap on the backdrop,
 * Esc or ✕ asks before throwing the work away. `keepsWork` = the sheet saves itself on close, so no ask.
 * `locked` = can't be dismissed right now (e.g. while a file is being read).
 */
export function Sheet({ onClose, children, label, keepsWork, locked }: { onClose: () => void; children: ReactNode; label?: string; keepsWork?: boolean; locked?: boolean }) {
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const ask = () => { if (locked) return; if (dirty && !keepsWork) setAsking(true); else onClose() }
  const latest = useRef({ ask, asking }); latest.current = { ask, asking }

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    // take focus for keyboard users, unless a field inside has already claimed it
    if (!box.current?.contains(document.activeElement)) box.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      const sheets = document.querySelectorAll('.sheet'); if (sheets[sheets.length - 1] !== box.current) return  // only the top sheet listens
      if (e.key === 'Escape') { e.preventDefault(); if (latest.current.asking) setAsking(false); else latest.current.ask() }
      if (e.key === 'Tab' && box.current) {   // keep keyboard focus inside the sheet
        const f = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); back?.focus?.({ preventScroll: true }) }
  }, [])

  return (
    <div className="sheet-bg" onClick={ask}>
      <div ref={box} className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        onClick={e => e.stopPropagation()} onInputCapture={() => setDirty(true)} onChangeCapture={() => setDirty(true)}>
        <div className="sheet-top">
          <div className="sheet-handle" />
          {!locked && <button className="sheet-x" aria-label="Close" onClick={ask}>×</button>}
        </div>
        {asking && (
          <div className="sheet-ask" role="alertdialog" aria-label="Discard changes?">
            <span className="grow">Discard what you’ve entered?</span>
            <button className="btn btn-ghost" onClick={() => setAsking(false)} autoFocus>Keep editing</button>
            <button className="btn sheet-discard" onClick={onClose}>Discard</button>
          </div>
        )}
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
