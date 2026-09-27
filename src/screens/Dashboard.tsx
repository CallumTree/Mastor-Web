import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { portfolio } from '../lib/portfolio'
import { money } from '../lib/format'
import { IconBack } from '../components/Icons'

const COPPER = '#C97B3F', LIGHT = '#E8A868', LINE = '#34345A', MUTED = '#B0A898'
const k = (n: number) => (Math.abs(n) >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : Math.abs(n) >= 1e4 ? `£${(n / 1e3).toFixed(1)}k` : money(n).replace(/\.00$/, ''))

function Tile({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className="glass tile tile-dark" style={{ padding: 14 }}>
      <div className="l" style={{ marginTop: 0, marginBottom: 6 }}>{label}</div>
      <div className="n" style={{ fontSize: 24, color: accent ? LIGHT : undefined }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{note}</div>}
    </div>
  )
}

/** Certified per month (bars) with a running total (line). */
function MonthChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 340, H = 170, pad = { l: 8, r: 8, t: 16, b: 22 }
  const cum = data.reduce<number[]>((a, d) => [...a, (a.length ? a[a.length - 1] : 0) + d.value], [])
  const max = Math.max(1, ...cum)
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const pts = cum.map((v, i) => `${pad.l + bw * i + bw / 2},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Certified per month this year">
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * f} y2={pad.t + (H - pad.t - pad.b) * f} stroke={LINE} strokeWidth=".6" strokeDasharray="2 4" />)}
      {data.map((d, i) => {
        const h = (H - pad.t - pad.b) * (d.value / max)
        return (
          <g key={i}>
            <rect x={pad.l + bw * i + bw * 0.22} y={H - pad.b - h} width={bw * 0.56} height={Math.max(h, d.value ? 2 : 0)} fill={COPPER} opacity=".85" rx="2" />
            <text x={pad.l + bw * i + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={MUTED} fontFamily="Inter">{d.label}</text>
          </g>
        )
      })}
      <polyline points={pts} fill="none" stroke={LIGHT} strokeWidth="1.6" strokeLinejoin="round" />
      {cum.length > 0 && <circle cx={pad.l + bw * (cum.length - 1) + bw / 2} cy={y(cum[cum.length - 1])} r="3" fill="#FFF4E4" />}
    </svg>
  )
}

/** Donut: certified / in valuation / still to claim. */
function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1
  const R = 52, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="row" style={{ gap: 16, alignItems: 'center' }}>
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Book of work">
        <circle cx="70" cy="70" r={R} fill="none" stroke={LINE} strokeWidth="16" />
        {parts.map((p, i) => {
          const len = (p.value / total) * C
          const el = <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          offset += len
          return el
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="10" fill={MUTED} fontFamily="Inter" letterSpacing="1.5">CLAIMED</text>
        <text x="70" y="86" textAnchor="middle" fontSize="20" fill="#F5F0E8" fontFamily="Mono" fontWeight="300">{Math.round(((parts[0].value + parts[1].value) / total) * 100)}%</text>
      </svg>
      <div className="grow" style={{ fontSize: 13 }}>
        {parts.map(p => (
          <div key={p.label} className="row" style={{ padding: '5px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ width: 10, height: 10, background: p.color, borderRadius: 2, flex: 'none' }} />
            <span className="grow" style={{ color: MUTED }}>{p.label}</span>
            <span className="mono">{k(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Dashboard({ jobs, scope, vos, vals, onBack, onOpenJob }: {
  jobs: Job[]; scope: ScopeItem[]; vos: Variation[]; vals: Valuation[]; onBack: () => void; onOpenJob: (j: Job) => void
}) {
  const p = portfolio(jobs, scope, vos, vals)
  const year = new Date().getFullYear()
  const sorted = [...p.jobs].sort((a, b) => (a.job.status === b.job.status ? b.revised - a.revised : a.job.status === 'Active' ? -1 : 1))
  const voTotal = p.voByStatus.reduce((t, s) => t + s.value, 0) || 1
  const voColour: Record<string, string> = { Identified: '#D97706', Instructed: '#7C8DB5', Complete: COPPER, Rejected: '#5A5A7A' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal)', color: 'var(--cream-text)' }}>
      <div className="page" style={{ paddingBottom: 40 }}>
        <div className="row" style={{ marginBottom: 18 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'rgba(245,240,232,.08)', border: '1px solid rgba(245,240,232,.18)', color: 'inherit', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><IconBack size={20} /></button>
          <div className="grow" style={{ textAlign: 'center' }}>
            <div className="label" style={{ color: MUTED, letterSpacing: '.3em' }}>Director</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{year} at a glance</div>
          </div>
          <span style={{ width: 40 }} />
        </div>

        <div style={{ textAlign: 'center', margin: '8px 0 20px' }}>
          <div className="label" style={{ color: MUTED }}>Certified this year</div>
          <div className="mono" style={{ fontSize: 46, fontWeight: 300, color: COPPER, letterSpacing: '-.04em' }}>{money(p.certifiedThisYear)}</div>
          <div style={{ fontSize: 12, color: MUTED }}>Issued valuations, incl. uplifts · payments tracked from a later build</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Tile label="In valuations now" value={k(p.inValuation)} note="Open, not yet issued" accent />
          <Tile label="Pipeline" value={k(p.pipeline)} note="Still to claim on live jobs" />
          <Tile label="Variations" value={k(p.variations)} note={p.unpricedVos ? `${p.unpricedVos} still unpriced` : 'All priced'} />
          <Tile label="Active jobs" value={String(p.active)} note={`${k(p.revised)} of work`} />
        </div>

        <div className="label" style={{ color: MUTED, margin: '26px 0 8px' }}>Certified by month</div>
        <div className="card-dark" style={{ padding: 12 }}>
          {p.certifiedThisYear > 0 ? <MonthChart data={p.byMonth} /> : <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>Nothing issued yet this year.</div>}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Bars: each month · line: running total</div>
        </div>

        <div className="label" style={{ color: MUTED, margin: '26px 0 8px' }}>Book of work</div>
        <div className="card-dark">
          <Donut parts={[
            { label: 'Certified', value: p.jobs.filter(j => j.job.status === 'Active').reduce((t, j) => t + j.certified, 0), color: COPPER },
            { label: 'In valuation', value: p.inValuation, color: LIGHT },
            { label: 'Still to claim', value: p.pipeline, color: '#4A4A70' },
          ]} />
        </div>

        <div className="label" style={{ color: MUTED, margin: '26px 0 8px' }}>Jobs</div>
        <div className="card-dark" style={{ padding: '4px 16px' }}>
          {sorted.length === 0 && <div style={{ color: MUTED, padding: '12px 0' }}>No jobs yet.</div>}
          {sorted.map((j, i) => {
            const pct = (n: number) => (j.revised > 0 ? Math.min(100, (n / j.revised) * 100) : 0)
            return (
              <button key={j.job.id} onClick={() => onOpenJob(j.job)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'inherit', padding: '12px 0', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
                <div className="row">
                  <span className="grow" style={{ fontWeight: 600 }}>{j.job.name}</span>
                  {j.job.status !== 'Active' && <span className="badge b-slate">{j.job.status}</span>}
                  <span className="mono" style={{ fontSize: 13 }}>{k(j.certified + j.inValuation)} <span style={{ color: MUTED }}>/ {k(j.revised)}</span></span>
                </div>
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: LINE, marginTop: 8 }}>
                  <div style={{ width: `${pct(j.certified)}%`, background: COPPER }} />
                  <div style={{ width: `${pct(j.inValuation)}%`, background: LIGHT }} />
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>
                  {Math.round(pct(j.certified + j.inValuation))}% claimed · {k(j.remaining)} to go{j.unpricedVos ? ` · ${j.unpricedVos} unpriced VO${j.unpricedVos === 1 ? '' : 's'}` : ''}
                </div>
              </button>
            )
          })}
        </div>

        <div className="label" style={{ color: MUTED, margin: '26px 0 8px' }}>Variation pipeline</div>
        <div className="card-dark">
          <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', background: LINE }}>
            {p.voByStatus.map(s => <div key={s.status} style={{ width: `${(s.value / voTotal) * 100}%`, background: voColour[s.status] }} />)}
          </div>
          {p.voByStatus.map(s => (
            <div key={s.status} className="row" style={{ fontSize: 13, padding: '7px 0', borderBottom: `1px solid ${LINE}` }}>
              <span style={{ width: 10, height: 10, background: voColour[s.status], borderRadius: 2, flex: 'none' }} />
              <span className="grow" style={{ color: MUTED }}>{s.status} <span style={{ opacity: .7 }}>({s.count})</span></span>
              <span className="mono">{k(s.value)}</span>
            </div>
          ))}
          {p.unpricedVos > 0 && <div style={{ fontSize: 12, color: LIGHT, marginTop: 8 }}>+ {p.unpricedVos} unpriced — not in these figures until priced</div>}
        </div>
      </div>
    </div>
  )
}
