import type { Job, ScopeItem, Valuation, Variation } from '../lib/types'
import { portfolio } from '../lib/portfolio'
import { money } from '../lib/format'
import { groupValue } from '../lib/voRegister'
import { TitleBlock } from '../components/Ui'
import { IconBack } from '../components/Icons'

/**
 * Director dashboard: a black board of headline figures, then flat bars in sign colours —
 * green = certified (done), yellow = in a valuation (needs doing), outline = still to claim.
 */
// site-sign palette: green = certified, yellow = in valuation, ink outline = still to claim
const INK = '#121316', MUTED = '#565B63', HAIR = 'rgba(18,19,22,.16)', COPPER = '#0B7A3E', COPPER_INK = '#121316'
const k = (n: number) => (Math.abs(n) >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : Math.abs(n) >= 1e4 ? `£${(n / 1e3).toFixed(1)}k` : money(n).replace(/\.00$/, ''))

const Hatch = ({ id }: { id: string }) => (
  <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5" height="5" fill="#FFCD00" />
  </pattern>
)

function SheetLabel({ children, no }: { children: string; no: string }) {
  return (
    <div className="row" style={{ margin: '28px 0 10px', gap: 10 }}>
      <span className="label bracket" style={{ color: INK }}>{children}</span>
      <span className="grow" style={{ height: 1, background: HAIR }} />
    </div>
  )
}

/**
 * Certified per month: hatched bars, ink running-total line with a dimension-style end tick.
 * Drawn narrow (300 units) so its text stays ≥11px even on a 320px phone; the figures themselves
 * live in the ruled schedule underneath, where they can be read rather than squeezed over the bars.
 */
function MonthChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 300, H = 156, pad = { l: 4, r: 4, t: 28, b: 26 }
  const cum = data.reduce<number[]>((a, d) => [...a, (a.length ? a[a.length - 1] : 0) + d.value], [])
  const max = Math.max(1, ...cum)
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const last = cum.length - 1
  return (
    <svg className="chart-month" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Certified per month this year, ${k(cum[last] ?? 0)} in total`}>
      <defs><Hatch id="hm" /></defs>
      <text x={pad.l} y="15" fontSize="14" fill={INK} fontFamily="Barlow Condensed" fontWeight="600">Σ {k(cum[last] ?? 0)} this year</text>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={INK} strokeWidth="1" />
      {data.map((d, i) => {
        const h = (H - pad.t - pad.b) * (d.value / max), x = pad.l + bw * i + bw * 0.22, w = bw * 0.56
        return (
          <g key={i}>
            <line x1={pad.l + bw * i + bw / 2} x2={pad.l + bw * i + bw / 2} y1={H - pad.b} y2={H - pad.b + 3} stroke={INK} strokeWidth=".8" />
            {d.value > 0 && <rect x={x} y={H - pad.b - h} width={w} height={h} fill={COPPER} stroke={COPPER_INK} strokeWidth="1" />}
            <text x={pad.l + bw * i + bw / 2} y={H - 7} textAnchor="middle" fontSize="13" fill={MUTED} fontFamily="Barlow Condensed">{d.label.slice(0, 3)}</text>
          </g>
        )
      })}
      <polyline points={cum.map((v, i) => `${pad.l + bw * i + bw / 2},${y(v)}`).join(' ')} fill="none" stroke={INK} strokeWidth="1" strokeDasharray="3 2" />
      {last >= 0 && <line x1={pad.l + bw * last + bw / 2 - 5} x2={pad.l + bw * last + bw / 2 + 5} y1={y(cum[last])} y2={y(cum[last])} stroke={INK} strokeWidth="1.4" />}
    </svg>
  )
}

/** Book of work as a section bar with a dimension line under it. */
function BookBar({ certified, inVal, remaining }: { certified: number; inVal: number; remaining: number }) {
  const total = certified + inVal + remaining || 1
  const W = 360, x0 = 4, w = W - 8
  const a = (certified / total) * w, b = (inVal / total) * w
  return (
    <svg className="chart-book" viewBox={`0 0 ${W} 92`} width="100%" role="img" aria-label="Book of work">
      <defs><Hatch id="hb" /></defs>
      <rect x={x0} y="10" width={w} height="22" fill="none" stroke={INK} strokeWidth="1" />
      <rect x={x0} y="10" width={a} height="22" fill={COPPER} />
      <rect x={x0 + a} y="10" width={b} height="22" fill="url(#hb)" stroke={COPPER_INK} strokeWidth=".8" />
      {/* dimension line */}
      <line x1={x0} x2={x0 + w} y1="50" y2="50" stroke={INK} strokeWidth=".8" />
      <line x1={x0} x2={x0} y1="42" y2="58" stroke={INK} strokeWidth=".8" /><line x1={x0 + w} x2={x0 + w} y1="42" y2="58" stroke={INK} strokeWidth=".8" />
      <path d={`M${x0} 50 l6 -3 v6 z M${x0 + w} 50 l-6 -3 v6 z`} fill={INK} />
      <rect x={W / 2 - 78} y="40" width="156" height="21" fill="#FFFFFF" />
      <text x={W / 2} y="56" textAnchor="middle" fontSize="16" fill={INK} fontFamily="Barlow Condensed" fontWeight="600">{k(total)} total</text>
      <text x={x0} y="84" fontSize="16" fill={MUTED} fontFamily="Barlow Condensed">{Math.round(((certified + inVal) / total) * 100)}% claimed</text>
    </svg>
  )
}

function Key({ swatch, label, value }: { swatch: 'solid' | 'hatch' | 'open'; label: string; value: string }) {
  return (
    <div className="row" style={{ padding: '7px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 13 }}>
      <span className={swatch === 'hatch' ? 'hatch' : ''} style={{ width: 16, height: 10, flex: 'none', border: `1px solid ${swatch === 'open' ? INK : COPPER_INK}`, background: swatch === 'solid' ? COPPER : undefined }} />
      <span className="grow" style={{ color: MUTED }}>{label}</span>
      <span className="amt">{value}</span>
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
  const voMax = Math.max(1, ...p.voGroups.map(g => g.value))

  return (
    <main className="page dash" style={{ paddingBottom: 48 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back to jobs"><IconBack size={20} /></button>
        <div className="grow">
          <h1 style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 20, letterSpacing: 0, color: INK, margin: 0 }}>{year} at a glance</h1>
        </div>
      </div>

      <TitleBlock
        head={['Certified this year', money(p.certifiedThisYear)]}
        rows={[
          [['In valuations now', k(p.inValuation)], ['Pipeline to claim', k(p.pipeline)]],
          [['Paid this year', k(p.paidThisYear)], ['Owed to you', k(p.owed)]],
          [['Overdue', p.overdueCount ? `${k(p.overdue)} · ${p.overdueCount}` : '—', p.overdueCount ? 'var(--red)' : undefined], ['Variations', k(p.variations)]],
          [['Active jobs', `${p.active} · ${k(p.revised)}`], ['', '']],
        ]} />
      <div className="muted" style={{ fontSize: 11, marginTop: 6, marginLeft: '12%' }}>Certified = issued valuations incl. uplifts{p.unpricedVos ? ` · ${p.unpricedVos} unpriced VO${p.unpricedVos === 1 ? '' : 's'} not included` : ''}</div>

      <div className="dash-secs">
      <section>
      <SheetLabel no="1">Certified by month</SheetLabel>
      <div className="panel" style={{ padding: 14 }}>
        {p.certifiedThisYear > 0 ? <>
          <MonthChart data={p.byMonth} />
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Bars: each month · dashed line: running total</div>
          {p.byMonth.filter(m => m.value > 0).reverse().map(m => <Key key={m.label} swatch="solid" label={m.label} value={money(m.value)} />)}
        </> : <div className="muted" style={{ fontSize: 13 }}>Nothing issued yet this year.</div>}
      </div>

      </section>
      <section>
      <SheetLabel no="2">Book of work</SheetLabel>
      <div className="panel" style={{ padding: 14 }}>
        <BookBar certified={activeCertified} inVal={p.inValuation} remaining={p.pipeline} />
        <Key swatch="solid" label="Certified" value={k(activeCertified)} />
        <Key swatch="hatch" label="In valuation" value={k(p.inValuation)} />
        <Key swatch="open" label="Still to claim" value={k(p.pipeline)} />
      </div>

      </section>
      <section>
      <SheetLabel no="3">Job schedule</SheetLabel>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="row" style={{ padding: '8px 14px', borderBottom: `1px solid ${INK}`, fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: MUTED, textTransform: 'uppercase' }}>
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
                <span className="amt" style={{ width: 88, textAlign: 'right', fontSize: 13 }}>{k(j.certified + j.inValuation)}</span>
                <span className="amt" style={{ width: 44, textAlign: 'right', fontSize: 13, color: COPPER_INK }}>{Math.round(pct(j.certified + j.inValuation))}</span>
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

      </section>
      <section>
      <SheetLabel no="4">Variation pipeline</SheetLabel>
      <div className="panel" style={{ padding: '6px 14px' }}>
        {p.voGroups.map(g => (
          <div key={g.key} style={{ padding: '8px 0', borderBottom: `1px solid ${HAIR}` }}>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="grow">{g.label} <span className="muted">({g.count}{g.unpriced && g.unpriced < g.count ? ` · ${g.unpriced} unpriced` : ''})</span></span>
              <span className="amt" style={{ color: g.count && g.unpriced === g.count ? COPPER_INK : undefined }}>{groupValue(g.value, g.count, g.unpriced, k)}</span>
            </div>
            <div style={{ height: 5, marginTop: 5, border: `1px solid ${HAIR}` }}>
              <div className={g.key === 'claimed' || g.key === 'rejected' ? '' : 'hatch'} style={{ height: '100%', width: `${(g.value / voMax) * 100}%`, background: g.key === 'claimed' ? COPPER : g.key === 'rejected' ? 'var(--line)' : undefined }} />
            </div>
          </div>
        ))}
        {p.unpricedVos > 0 && <div style={{ fontSize: 12, color: COPPER_INK, padding: '8px 0' }}>+ {p.unpricedVos} unpriced — not counted until priced</div>}
        <div className="muted" style={{ fontSize: 11, paddingTop: 8 }}>Same groups as each job’s Variation Register · values incl. uplifts</div>
      </div>
      </section>
      </div>
    </main>
  )
}
