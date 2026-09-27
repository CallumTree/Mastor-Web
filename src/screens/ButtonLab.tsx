import { useState } from 'react'

/** Style lab — open mastor-web.vercel.app/#lab. Five button directions to tap and compare. */
const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M5 12l5 5L19 7" /></svg>

function Set({ k, dark }: { k: 'A' | 'B' | 'C' | 'D' | 'E'; dark: boolean }) {
  const [chip, setChip] = useState(0)
  const [tick, setTick] = useState(true)
  const chips = ['All', 'Still to do', 'Claimed']
  return (
    <div className={'lab-sec' + (dark ? ' dark' : '')}>
      <div className="lab-note">{dark ? 'On charcoal (job screens, hero)' : 'On cream (lists, forms)'}</div>
      <div className="lab-row">
        {k === 'A' && <><button className="dA p"><i /><i /><i /><i />Issue VAL-002</button><button className="dA"><i /><i /><i /><i />Log variation</button></>}
        {k === 'B' && <><button className="dB p">Issue VAL-002</button><button className="dB s">Log variation</button></>}
        {k === 'C' && <><button className="dC">Issue VAL-002 <em>→</em></button><button className="dC s">Log variation <em>+</em></button></>}
        {k === 'D' && <><button className="dD p"><span className="ln l" />Issue VAL-002<span className="ln r" /></button><button className="dD"><span className="ln l" />Log variation<span className="ln r" /></button></>}
        {k === 'E' && <><button className="dE p">Issue VAL-002</button><button className="dE s">Log variation</button></>}
      </div>
      <div className="lab-row">
        {chips.map((c, i) => <button key={c} className={`c${k}` + (chip === i ? ' on' : '')} onClick={() => setChip(i)}>{c}</button>)}
        <span style={{ flex: 1 }} />
        <button className={`tk tk${k}` + (tick ? ' on' : '')} onClick={() => setTick(!tick)} aria-label="tick">{tick && <Check />}</button>
      </div>
    </div>
  )
}

const DIRS = [
  { k: 'A', name: 'Drafting', note: 'Hairline outline, crop marks at the corners, copper wipes in when you press.' },
  { k: 'B', name: 'Beam', note: 'The tracing beam runs round the edge of the main button. Everything else stays quiet.' },
  { k: 'C', name: 'Slab', note: 'Solid square-edged block, label left, arrow right. Presses down like a key.' },
  { k: 'D', name: 'Dimension', note: 'The label sits on a dimension line with arrows and end ticks, like a measurement.' },
  { k: 'E', name: 'Halo', note: 'Dark glass with a copper edge-light; a soft glow when pressed.' },
] as const

export function ButtonLab() {
  return (
    <div className="lab">
      <div className="lab-head">
        <div className="wordmark" style={{ fontSize: 22 }}>MASTOR</div>
        <div className="imm-sub">Style lab · buttons · tap everything</div>
      </div>
      {DIRS.map(d => (
        <div key={d.k} style={{ borderTop: '1px solid var(--cream-line)' }}>
          <div className="lab-sec" style={{ paddingBottom: 0 }}>
            <div className="lab-title"><b>{d.k}</b><span>{d.name}</span></div>
            <div className="lab-note">{d.note}</div>
          </div>
          <Set k={d.k} dark={true} />
          <Set k={d.k} dark={false} />
        </div>
      ))}
      <div className="lab-sec lab-note" style={{ textAlign: 'center' }}>Pick one, or mix — e.g. "B for the main button, A for the rest".</div>
    </div>
  )
}
