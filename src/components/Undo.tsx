import { useSyncExternalStore } from 'react'
import { currentUndo, onUndoChange, takeUndo } from '../lib/undo'

/** The one Undo bar (lib/undo.ts): what just happened, and a button to take it back, for a few seconds. */
export function UndoBar() {
  const o = useSyncExternalStore(onUndoChange, currentUndo, currentUndo)
  if (!o) return null
  return (
    <div className="update-bar undo-bar" role="status" aria-live="polite" key={o.id}>
      <span className="grow">{o.text}</span>
      <button className="btn btn-secondary" onClick={() => { void takeUndo() }}>Undo</button>
    </div>
  )
}
