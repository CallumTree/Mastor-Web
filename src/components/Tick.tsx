import type { Valuation } from '../lib/types'
import { valRef } from '../lib/valuation'
import { IconLock } from './Icons'

/** Valuation tick. 44px to hit with a glove; the visible box sits inside. */
export function Tick({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button className="tick" onClick={e => { e.stopPropagation(); onClick() }} disabled={locked} aria-pressed={on} aria-label={on ? (locked ? 'In an issued valuation (locked)' : 'Remove from valuation') : 'Add to valuation'}>
      <span className={'tick-box' + (on ? ' on' : '') + (locked ? ' locked' : '')}>
        {/* the tick draws itself like a pen stroke when it goes in (CSS); a locked line shows its lock */}
        {locked ? on && <IconLock size={16} /> : <svg className="tick-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true"><path pathLength={1} d="M5 12l5 5L19 7" /></svg>}
      </span>
    </button>
  )
}

export function ValBadge({ val }: { val?: Valuation }) {
  if (!val) return null
  return <span className={'badge ' + (val.status === 'Issued' ? 'b-slate' : 'b-volt')}>{val.status === 'Issued' && <IconLock size={12} />}{valRef(val.number)}</span>
}
