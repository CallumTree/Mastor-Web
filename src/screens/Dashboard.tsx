import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { portfolio } from '../lib/portfolio'
import { money } from '../lib/format'
import { TitleBlock } from '../components/Ui'
import { IconBack } from '../components/Icons'

/**
 * Director dashboard, drawn as a drawing sheet: title block for the headline figures,
 * hatched bars (how a drawing shows a cut section), dimension lines, and a ruled schedule.
 */
const INK = '#1A1A2E', MUTED = '#5A5A7A', HAIR = 'rgba(26,26,46,.16)', COPPER = '#C97B3F', COPPER_INK = '#A85E28'
const k = (n: number) => (Math.abs(n) >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : Math.abs(n) >= 1e4 ? `£${(n / 1e3).toFixed(1)}k` : money(n).replace(/\.00$/, ''))

const Hatch = ({ id }: { id: string }) => (
  <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="5" stroke={COPPER} strokeWidth="1.3" />
  </pattern>
)

function SheetLabel({ children, no }: { children: string; no: string }) {
  return (
    <div className="row" style={{ margin: '28px 0 10px', gap: 10 }}>
      <span className="mono" style={{ fontSize: 11, color: COPPER_INK, border: `1px solid ${COPPER_INK}`, borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center' }}>{no}</span>
      <span className="label bracket" style={{ color: INK }}>{children}</span>
      <span className="grow" style={{ height: 1, background: HAIR }} />
    </div>
  )
}

/** Certified per month: hatched bars, ink running-total line with a dimension-style end tick. */
function MonthChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 360, H = 150, pad = { l: 4, r: 4, t: 18, b: 22 }
  const cum = data.reduce<number[]>((a, d) => [...a, (a.length ? a[a.length - 1] : 0) + d.value], [])
  const max = Math.max(1, ...cum)
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const last = cum.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Certified per month this year">
      <defs><Hatch id="hm" /></defs>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={INK} strokeWidth="1" />
      {data.map((d, i) => {
        const h = (H - pad.t - pad.b) * (d.value / max), x = pad.l + bw * i + bw * 0.25, w = bw * 0.5
        return (
          <g key={i}>
            <line x1={pad.l + bw * i + bw / 2} x2={pad.l + bw * i + bw / 2} y1={H - pad.b} y2={H - pad.b + 3} stroke={INK} strokeWidth=".8" />
            {d.value > 0 && <rect x={x} y={H - pad.b - h} width={w} height={h} fill="url(#hm)" stroke={COPPER_INK} strokeWidth="1" />}
            {d.value > 0 && <text x={x + w / 2} y={H - pad.b - h - 4} textAnchor="middle" fontSize="8" fill={MUTED} fontFamily="Mono">{k(d.value)}</text>}
            <text x={pad.l + bw * i + bw / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill={MUTED} fontFamily="Inter" letterSpacing=".5">{d.label.toUpperCase()}</text>
          </g>
        )
      })}
      <polyline points={cum.map((v, i) => `${pad.l + bw * i + bw / 2},${y(v)}`).join(' ')} fill="none" stroke={INK} strokeWidth="1" strokeDasharray="3 2" />
      {last >= 0 && <><line x1={pad.l + bw * last + bw / 2 - 5} x2={pad.l + bw * last + bw / 2 + 5} y1={y(cum[last])} y2={y(cum[last])} stroke={INK} strokeWidth="1.4" />
        <text x={pad.l + bw * last + bw / 2 - 8} y={y(cum[last]) - 5} textAnchor="end" fontSize="8.5" fill={INK} fontFamily="Mono">Σ {k(cum[last])}</text></>}
    </svg>
  )
}

/** Book of work as a section bar with a dimension line under it. */
function BookBar({ certified, inVal, remaining }: { certified: number; inVal: number; remaining: number }) {
  const total = certified + inVal + remaining || 1
  const W = 360, x0 = 4, w = W - 8
  const a = (certified / total) * w, b = (inVal / total) * w
  return (
    <svg viewBox={`0 0 ${W} 86`} width="100%" role="img" aria-label="Book of work">
      <defs><Hatch id="hb" /></defs>
      <rect x={x0} y="10" width={w} height="22" fill="none" stroke={INK} strokeWidth="1" />
      <rect x={x0} y="10" width={a} height="22" fill={COPPER} />
      <rect x={x0 + a} y="10" width={b} height="22" fill="url(#hb)" stroke={COPPER_INK} strokeWidth=".8" />
      {/* dimension line */}
      <line x1={x0} x2={x0 + w} y1="50" y2="50" stroke={INK} strokeWidth=".8" />
      <line x1={x0} x2={x0} y1="42" y2="58" stroke={INK} strokeWidth=".8" /><line x1={x0 + w} x2={x0 + w} y1="42" y2="58" stroke={INK} strokeWidth=".8" />
      <path d={`M${x0} 50 l6 -3 v6 z M${x0 + w} 50 l-6 -3 v6 z`} fill={INK} />
      <rect x={W / 2 - 58} y="42" width="116" height="16" fill="#FFFDF8" />
      <text x={W / 2} y="54" textAnchor="middle" fontSize="10" fill={INK} fontFamily="Mono">{k(total)} total</text>
      <text x={x0} y="78" fontSize="9" fill={MUTED} fontFamily="Inter">{Math.round(((certified + inVal) / total) * 100)}% claimed</text>
    </svg>
  )
}

function Key({ swatch, label, value }: { swatch: 'solid' | 'hatch' | 'open'; label: string; value: string }) {
  return (
    <div className="row" style={{ padding: '7px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 13 }}>
      <span className={swatch === 'hatch' ? 'hatch' : ''} style={{ width: 16, height: 10, flex: 'none', border: `1px solid ${swatch === 'open' ? INK : COPPER_INK}`, background: swatch === 'solid' ? COPPER : undefined }} />
      <span className="grow" style={{ color: MUTED }}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  )
}

export function Dashboard({ jobs, scope, vos, vals, onBack, onOpenJob }: {
  jobs: Job[]; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]; onBack: () => void; onOpenJob: (j: Job) => void
}) {
  const p = portfolio(jobs, scope, vos, vals)
  const year = new Date().getFullYear()
  const activeCertified = p.jobs.filter(j => j.job.status === 'Active').reduce((t, j) => t + j.certified, 0)
  const sorted = [...p.jobs].sort((a, b) => (a.job.status === b.job.status ? b.revised - a.revised : a.job.status === 'Active' ? -1 : 1))
  const voMax = Math.max(1, ...p.voByStatus.map(s => s.value))

  return (
    <div className="page" style={{ paddingBottom: 48 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: '#FFFDF8', border: `1px solid ${HAIR}`, color: INK, width: 40, height: 40, borderRadius: 4, display: 'grid', placeItems: 'center' }}><IconBack size={20} /></button>
        <div className="grow">
          <div className="label" style={{ letterSpacing: '.3em' }}>Director</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: INK }}>{year} at a glance</div>
        </div>
      </div>

      <TitleBlock sheetRef={`Sheet 01 · ${year}`}
        head={['Certified this year', money(p.certifiedThisYear)]}
        rows={[
          [['In valuations now', k(p.inValuation)], ['Pipeline to claim', k(p.pipeline)]],
          [['Variations', k(p.variations), undefined], ['Active jobs', `${p.active} · ${k(p.revised)}`]],
        ]} />
      <div className="muted" style={{ fontSize: 11, marginTop: 6, marginLeft: '12%' }}>Certified = issued valuations incl. uplifts{p.unpricedVos ? ` · ${p.unpricedVos} unpriced VO${p.unpricedVos === 1 ? '' : 's'} not included` : ''}</div>

      <SheetLabel no="1">Certified by month</SheetLabel>
      <div className="panel" style={{ padding: 14 }}>
        {p.certifiedThisYear > 0 ? <MonthChart data={p.byMonth} /> : <div className="muted" style={{ fontSize: 13 }}>Nothing issued yet this year.</div>}
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Hatched bars: each month · dashed line: running total</div>
      </div>

      <SheetLabel no="2">Book of work</SheetLabel>
      <div className="panel" style={{ padding: 14 }}>
        <BookBar certified={activeCertified} inVal={p.inValuation} remaining={p.pipeline} />
        <Key swatch="solid" label="Certified" value={k(activeCertified)} />
        <Key swatch="hatch" label="In valuation" value={k(p.inValuation)} />
        <Key swatch="open" label="Still to claim" value={k(p.pipeline)} />
      </div>

      <SheetLabel no="3">Job schedule</SheetLabel>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="row" style={{ padding: '8px 14px', borderBottom: `1px solid ${INK}`, fontSize: 9, fontWeight: 700, letterSpacing: '.18em', color: MUTED, textTransform: 'uppercase' }}>
          <span className="grow">Job</span><span style={{ width: 88, textAlign: 'right' }}>Claimed</span><span style={{ width: 44, textAlign: 'right' }}>%</span>
        </div>
        {sorted.length === 0 && <div className="muted" style={{ padding: 14 }}>No jobs yet.</div>}
        {sorted.map((j, i) => {
          const pct = (n: number) => (j.revised > 0 ? Math.min(100, (n / j.revised) * 100) : 0)
          return (
            <button key={j.job.id} onClick={() => onOpenJob(j.job)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: i ? `1px solid ${HAIR}` : 'none', padding: '11px 14px', color: INK }}>
              <div className="row">
                <span className="grow" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{j.job.name}</span>
                  {j.job.contractRef && <span className="mono" style={{ fontSize: 11, color: COPPER_INK, marginLeft: 8 }}>{j.job.contractRef}</span>}
                </span>
                <span className="mono" style={{ width: 88, textAlign: 'right', fontSize: 13 }}>{k(j.certified + j.inValuation)}</span>
                <span className="mono" style={{ width: 44, textAlign: 'right', fontSize: 13, color: COPPER_INK }}>{Math.round(pct(j.certified + j.inValuation))}</span>
              </div>
              <div style={{ display: 'flex', height: 6, marginTop: 7, border: `1px solid ${HAIR}` }}>
                <div style={{ width: `${pct(j.certified)}%`, background: COPPER }} />
                <div className="hatch" style={{ width: `${pct(j.inValuation)}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>of {k(j.revised)} · {k(j.remaining)} to go{j.job.status !== 'Active' ? ` · ${j.job.status}` : ''}{j.unpricedVos ? ` · ${j.unpricedVos} unpriced VO${j.unpricedVos === 1 ? '' : 's'}` : ''}</div>
            </button>
          )
        })}
      </div>

      <SheetLabel no="4">Variation pipeline</SheetLabel>
      <div className="panel" style={{ padding: '6px 14px' }}>
        {p.voByStatus.map(s => (
          <div key={s.status} style={{ padding: '8px 0', borderBottom: `1px solid ${HAIR}` }}>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="grow">{s.status} <span className="muted">({s.count})</span></span>
              <span className="mono">{k(s.value)}</span>
            </div>
            <div style={{ height: 5, marginTop: 5, border: `1px solid ${HAIR}` }}>
              <div className={s.status === 'Complete' ? '' : 'hatch'} style={{ height: '100%', width: `${(s.value / voMax) * 100}%`, background: s.status === 'Complete' ? COPPER : undefined, opacity: s.status === 'Rejected' ? .35 : 1 }} />
            </div>
          </div>
        ))}
        {p.unpricedVos > 0 && <div style={{ fontSize: 12, color: COPPER_INK, padding: '8px 0' }}>+ {p.unpricedVos} unpriced — not counted until priced</div>}
      </div>
    </div>
  )
}
