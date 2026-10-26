/**
 * The front page: Mastor for firms that run their jobs from site, shown with the real app (an example
 * job, marked as one), real photographs, a time forecast built on stated estimates, and fifty numbered
 * founding places to claim. The register shows the places as they really are (counted in the database
 * by /api/early-signup). It is never padded, and when the count can't be read it doesn't guess.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Forecast } from './Forecast'
import { PHOTOS, sized, srcSet, type Photo } from './photos'
import { Wordmark } from '../components/Wordmark'
import { IconArrow, IconCheck } from '../components/Icons'
import { roman } from '../lib/format'
import { SignMark } from '../components/Sign'

const PLACES = 50
const WORK = ['Planned (PPR, WHQS, Decent Homes)', 'Responsive and voids', 'Both planned and responsive', 'Other framework work'] as const

type Claimed = { place: number | null; already: boolean; listed?: boolean }

/** Fifty places on a black board. Taken ones filled, the next one lit, yours ringed once you claim it. */
function Register({ taken, yours }: { taken: number | null; yours: number | null }) {
  const next = taken != null && taken < PLACES ? taken + 1 : null
  return (
    <section className="board" id="register" aria-labelledby="board-h">
      <div className="board-head">
        <h2 id="board-h" className="board-title">Founding register</h2>
        <p className="board-count" aria-live="polite">
          {taken == null ? `${PLACES} places, I to L` : taken >= PLACES ? 'All fifty taken' : `${taken} of ${PLACES} taken · ${PLACES - taken} left`}
        </p>
      </div>
      <ol className="tiles" aria-hidden="true">
        {Array.from({ length: PLACES }, (_, i) => {
          const n = i + 1
          const state = n === yours ? 'yours' : taken != null && n <= taken ? 'taken' : n === next ? 'next' : 'free'
          return <li key={n} className={`tile ${state}`} style={{ '--i': i, '--len': roman(n).length } as React.CSSProperties}><span>{roman(n)}</span></li>
        })}
      </ol>
      <ul className="board-key" aria-hidden="true">
        <li><i className="k taken" />Taken</li>
        {next && <li><i className="k next" />Next free</li>}
        <li><i className="k free" />Free</li>
      </ul>
    </section>
  )
}

function SignUp({ taken, onClaimed, claimed, nameRef }: {
  taken: number | null; claimed: Claimed | null; onClaimed: (c: Claimed, taken: number | null) => void; nameRef: React.RefObject<HTMLInputElement>
}) {
  const [name, setName] = useState(''), [firm, setFirm] = useState(''), [email, setEmail] = useState(''), [phone, setPhone] = useState('')
  const [work, setWork] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const robot = useRef<HTMLInputElement>(null)
  const next = taken != null && taken < PLACES ? taken + 1 : null
  const full = taken != null && taken >= PLACES

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const missing = [!name.trim() && 'your name', !firm.trim() && 'your firm', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && 'an email address that works'].filter(Boolean)
    if (missing.length) { setErr(`Add ${missing.join(' and ')}.`); return }
    setBusy(true); setErr(null)
    try {
      const q = new URLSearchParams(location.search)
      const r = await fetch('/api/early-signup', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, firm, email, phone, work, website: robot.current?.value ?? '', source: q.get('utm_source') || q.get('ref') || document.referrer || '' }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok || !b.ok) throw new Error(b.error || 'Couldn’t save that just now. Try again in a minute.')
      onClaimed({ place: b.place ?? null, already: !!b.already, listed: !!b.listed }, typeof b.taken === 'number' ? b.taken : null)
    } catch (x) {
      setErr((x as Error).message === 'Failed to fetch' ? 'Couldn’t reach Mastor. Check your signal and try again.' : (x as Error).message)
    } finally { setBusy(false) }
  }

  if (claimed) {
    const { place, already, listed } = claimed
    return (
      <div className="claimed" role="status">
        {place ? <span className="claimed-tile" aria-hidden="true">{roman(place)}</span> : <span className="claimed-mark"><IconCheck size={22} /></span>}
        <div>
          <p className="claimed-h">{place ? (already ? `Place ${roman(place)} is already yours.` : `Place ${roman(place)} is yours.`) : listed ? 'You’re on the list.' : already ? 'You’re already on the waiting list.' : 'You’re on the waiting list.'}</p>
          <p className="claimed-t">{place
            ? 'It’s held for your firm. We’ll email you to get your first job in, and you’ll see the price before you pay anything.'
            : listed ? 'We’ve got your details and we’ll email you about your founding place.' : 'All fifty founding places have gone. We’ll email you as soon as Mastor opens to more firms.'}</p>
        </div>
      </div>
    )
  }

  return (
    <form className="signup" onSubmit={submit} noValidate>
      <div className="fields">
        <label className="field"><span>Your name</span><input ref={nameRef} value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
        <label className="field"><span>Firm</span><input value={firm} onChange={e => setFirm(e.target.value)} autoComplete="organization" required /></label>
        <label className="field"><span>Email</span><input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field"><span>Phone <em>optional</em></span><input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
        <label className="field work"><span>Your work <em>optional</em></span>
          <select value={work} onChange={e => setWork(e.target.value)}>
            <option value="">Choose…</option>
            {WORK.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      </div>
      {/* not for people: left empty by anyone who can see the form */}
      <input ref={robot} name="website" tabIndex={-1} autoComplete="off" className="robot" aria-hidden="true" />
      {err && <p className="err" role="alert"><SignMark kind="stop" size={16} /><span>{err}</span></p>}
      <button className="claim" disabled={busy}>
        <span>{busy ? 'Claiming…' : full ? 'Join the waiting list' : next ? <>Claim place <b>{roman(next)}</b></> : 'Claim a founding place'}</span>
        <IconArrow size={22} />
      </button>
      <p className="fine">We use these details only to talk to you about Mastor. No card needed.</p>
    </form>
  )
}

const STAGES: [string, string][] = [
  ['Works order in', 'Import the BoQ from the client’s Excel or PDF. Every rate is checked against your framework schedule of rates, and a line paid under the schedule is flagged before you start.'],
  ['On site', 'Photos, video and voice notes go into the site diary from a phone, signal or not. Weather fills itself in. Operatives log what they did without seeing a single rate.'],
  ['Variations', 'Every VO numbered and never reused, priced from your schedule, carrying the client’s own reference and showing whose court it’s in. The Variation Register goes to the client as a PDF.'],
  ['Valuation', 'Tick what’s done. Uplifts, previously certified and the cumulative total are worked out, and the questions a client QS would ask are checked before you issue the certificate.'],
  ['Invoice and paid', 'A VAT invoice from the issued valuation, on your own numbering, out to Xero or QuickBooks. What’s owed and what’s overdue, across every job.'],
  ['Margin', 'Subbie quotes, labour and materials set against what the client pays, job by job, so you know what each one makes.'],
]

const SHOTS: [string, string, string][] = [
  ['app-home', 'The job', 'What it’s worth, what’s certified, and what needs doing next, in order.'],
  ['app-scope', 'Scope by house', 'Every property’s lines and how much of each is claimed.'],
  ['app-vos', 'Variations', 'The VO register, priced and chased, ready to send.'],
  ['app-vals', 'Valuations', 'What’s certified, paid and owed, and what the open valuation will claim.'],
]

const SHOT_ALT: Record<string, string> = {
  'app-home': 'Mastor on a phone: the example job Hill Street WHQS, with its contract, certified and margin figures and the actions needed',
  'app-scope': 'Mastor on a phone: the scope grouped by house, 2, 4 and 6 Hill Street, with how much of each is claimed',
  'app-vos': 'Mastor on a phone: the variations register with totals for claimed, awaiting instruction and rejected VOs',
  'app-vals': 'Mastor on a phone: valuations, with certified, paid and owed, and the open VAL III',
}

/** A phone, drawn the way the app's own black slabs are: a screenshot of the real app inside. */
function Phone({ name, alt, eager }: { name: string; alt: string; eager?: boolean }) {
  return <div className="phone"><img src={`/landing/${name}.webp`} alt={alt} width={780} height={1688} loading={eager ? 'eager' : 'lazy'} decoding="async" /></div>
}

function Pic({ p, ratio, sizes, className, eager }: { p: Photo; ratio?: number; sizes: string; className?: string; eager?: boolean }) {
  return <img className={className} src={sized(p, 1400, ratio)} srcSet={srcSet(p, ratio)} sizes={sizes} alt={p.alt} width={1400} height={Math.round(1400 / (ratio ?? p.w / p.h))} loading={eager ? 'eager' : 'lazy'} decoding="async" />
}

/** The main feature, recorded from the real app: plays by itself unless the visitor has asked for less motion, and can always be paused. */
function Recording() {
  const v = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const el = v.current
    // asked for less motion, or a browser without these: it waits for the play button
    if (!el || typeof IntersectionObserver === 'undefined' || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause() }, { threshold: 0.4 })
    io.observe(el); return () => io.disconnect()
  }, [])
  return (
    <>
    <div className="phone phone-video">
      <video ref={v} muted loop playsInline preload="metadata" poster="/landing/site-to-valuation-poster.webp" width={640} height={1384}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        aria-label="Screen recording of Mastor: a voice note from site is read against the scope, two kitchen lines go into the open valuation, and a cracked lintel becomes VO IV">
        <source src="/landing/site-to-valuation.webm" type="video/webm" />
        <source src="/landing/site-to-valuation.mp4" type="video/mp4" />
      </video>
    </div>
    <button type="button" className="vid-btn" onClick={() => { const el = v.current; if (el) { if (el.paused) el.play().catch(() => {}); else el.pause() } }} aria-label={playing ? 'Pause the recording' : 'Play the recording'}>
        {playing ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
          : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>}
      <span>{playing ? 'Pause' : 'Play'}</span>
    </button>
    </>
  )
}

export function Landing() {
  const [taken, setTaken] = useState<number | null>(null)
  const [claimed, setClaimed] = useState<Claimed | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/early-signup').then(r => (r.ok ? r.json() : null)).then(b => { if (typeof b?.taken === 'number') setTaken(b.taken) }).catch(() => {})
  }, [])
  const toForm = () => { document.getElementById('claim')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); nameRef.current?.focus({ preventScroll: true }) }
  const next = taken != null && taken < PLACES ? taken + 1 : null
  const cta = claimed ? null : taken != null && taken >= PLACES ? 'Join the waiting list' : next ? <>Claim place <b>{roman(next)}</b></> : 'Claim a founding place'

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a href="/?site" className="top-mark" aria-label="Mastor, home"><Wordmark /></a>
          <nav className="top-nav" aria-label="On this page">
            <a href="#site">How it works</a><a href="#time">Time back</a><a href="#places">Founding places</a>
          </nav>
          <a href="/app" className="top-link">Sign in</a>
        </div>
      </header>

      <main>
        <section className="hero wrap" id="claim">
          <div className="hero-copy">
            <h1 className="h1">Run the job from site, not from a desk.</h1>
            <p className="lede">Scope, site diary, variations, valuations and invoices for contractors on council and housing-association framework work, in the phone in your pocket. Say it or snap it on site, approve it, and it’s in the valuation.</p>
            <p className="offer"><b>Fifty founding places.</b> Free through the pilot, then half price for as long as you stay.</p>
            {next && taken != null && !claimed && (
              <a href="#places" className="next-strip">
                <span className="next-tile">{roman(next)}</span>
                <span>is the next founding place. <b>{PLACES - taken} of {PLACES}</b> left.</span>
              </a>
            )}
            <SignUp taken={taken} claimed={claimed} nameRef={nameRef} onClaimed={(c, t) => { setClaimed(c); if (t != null) setTaken(t) }} />
          </div>
          <figure className="hero-art">
            <Pic p={PHOTOS.phone} ratio={4 / 5} sizes="(min-width: 1024px) 480px, 100vw" className="hero-photo" eager />
            <Phone name="app-home" alt={SHOT_ALT['app-home']} eager />
            <figcaption>The app is shown with an example job.</figcaption>
          </figure>
        </section>

        <section className="who">
          <div className="wrap who-in">
            <Pic p={PHOTOS.street} ratio={4 / 3} sizes="(min-width: 1024px) 560px, 100vw" className="who-photo" />
            <div>
              <h2 className="h2">For firms that are out on the job.</h2>
              <p className="body-l">Small contractors, two to thirty people, working to a council’s or housing association’s schedule of rates. No commercial department, and the director prices the work, runs the site and chases the money.</p>
              <dl className="facts">
                <div><dt>The work</dt><dd>Planned programmes (PPR, WHQS, Decent Homes), responsive repairs and voids.</dd></div>
                <div><dt>The director</dt><dd>Valuations, the VO register, invoices and what’s owed, from the van or the kitchen table.</dd></div>
                <div><dt>Site managers</dt><dd>The diary, photos, voice notes and VOs as they’re found, with gloves on and no signal.</dd></div>
                <div><dt>Operatives</dt><dd>Log work, photos and voice notes without ever seeing a rate, a value or a margin.</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="feature" id="site">
          <div className="wrap feature-in">
            <div className="feature-copy">
              <h2 className="h2 on-dark">The site diary runs the valuation.</h2>
              <p className="body-l on-dark">Most apps keep your site photos. Mastor reads them, and your voice notes and videos, against the job’s own scope, then lines up what’s done and what’s extra for you to approve. It quotes the words it heard, so you can see why.</p>
              <ol className="steps">
                <li><span className="step-n">I</span><div><h3 className="h3 on-dark">Say it or snap it</h3><p>A voice note at No. 6: “kitchen’s fitted, lintel over the back door’s cracked.”</p></div></li>
                <li><span className="step-n">II</span><div><h3 className="h3 on-dark">Mastor reads it</h3><p>Against the scope: the kitchen lines at No. 6 are done, and the lintel isn’t in the scope, so it’s extra work.</p></div></li>
                <li><span className="step-n">III</span><div><h3 className="h3 on-dark">You approve it</h3><p>Two taps: the lines go into the open valuation and the lintel becomes VO IV. Nothing is claimed until you say so.</p></div></li>
              </ol>
            </div>
            <figure className="feature-video">
              <Recording />
              <figcaption>Recorded in the app with an example job. 23 seconds, no sound.</figcaption>
            </figure>
          </div>
        </section>

        <section className="wrap shots-sec">
          <h2 className="h2">The whole job, in your pocket.</h2>
          <p className="body-l">The same job on site and in the office. These are screens from the app with the example job in.</p>
          <ul className="shots">
            {SHOTS.map(([name, t, d]) => (
              <li key={name}><Phone name={name} alt={SHOT_ALT[name]} /><h3 className="h3">{t}</h3><p>{d}</p></li>
            ))}
          </ul>
          <figure className="desk">
            <div className="desk-pan" tabIndex={0} aria-label="The dashboard screenshot; scroll sideways on a phone">
              <img src="/landing/app-dashboard.webp" alt="Mastor on a desktop: the director’s dashboard showing £12,473.66 owed, £8,087.19 ready to claim, payments to chase and every job’s margin" width={1540} height={930} loading="lazy" decoding="async" />
            </div>
            <figcaption><b>Back at the desk:</b> what you’re owed, what’s ready to claim and what to chase, across every job.</figcaption>
          </figure>
        </section>

        <section className="band">
          <Pic p={PHOTOS.roof} sizes="100vw" className="band-photo" />
          <div className="wrap band-in">
            <p className="band-plate">No signal on the roof? Mastor keeps working and catches up when you’re back in range.</p>
          </div>
        </section>

        <section className="wrap stages-sec">
          <h2 className="h2">A job, start to finish.</h2>
          <ol className="stages">
            {STAGES.map(([t, d], i) => (
              <li key={t}>
                <span className="stage-n" aria-hidden="true">{roman(i + 1)}</span>
                <div><h3 className="h3">{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
          <p className="claude-line"><b>Ask Claude about any job.</b> Connect Mastor to Claude and it can read a job, tick lines into the valuation and log VOs when you say yes. Issuing always stays with you.</p>
        </section>

        <section className="time" id="time">
          <div className="wrap">
            <h2 className="h2">How much time it could give back.</h2>
            <p className="body-l">Put in your own workload. Every figure here is an estimate you can change.</p>
            <Forecast />
          </div>
        </section>

        <section className="honest">
          <div className="wrap honest-in">
            <div>
              <h2 className="h2 on-dark">It never makes a number up.</h2>
              <p className="body-l on-dark">A quantity nobody has measured says <b>not measured</b>. A line with no rate says <b>unpriced</b>, never £0. A missing PO stays blank and flagged. Every figure goes back to the BoQ, the schedule of rates, the VO or the instruction, so it stands up when the client’s QS goes through it.</p>
            </div>
            <figure className="vo-reg">
              <figcaption><span>Variation register</span><span className="ex">Example</span></figcaption>
              <table>
                <thead><tr><th scope="col">VO</th><th scope="col">Work</th><th scope="col" className="r">Value</th></tr></thead>
                <tbody>
                  <tr><td className="ref">I</td><td>Renew rotten joists under bath<small>No. 4 bathroom · 2.40 LM @ £38.60</small></td><td className="r">£92.64</td></tr>
                  <tr><td className="ref">III</td><td>Additional plaster patching to kitchen walls<small>No. 6 kitchen · 6.50 SM</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Unpriced</span></td></tr>
                  <tr><td className="ref">IV</td><td>Replace cracked lintel over the back door<small>No. 6 back door · 1.20 LM</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Unpriced</span></td></tr>
                  <tr><td className="ref">V</td><td>Fit new external door frame<small>No. 8 rear · size to be taken</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Not measured</span></td></tr>
                </tbody>
              </table>
            </figure>
          </div>
        </section>

        <section className="places" id="places">
          <div className="wrap places-in">
            <div>
              <h2 className="h2">Fifty founding places.</h2>
              <p className="body-l">Mastor is opening to fifty firms first. Each gets a numbered place on the register and keeps it.</p>
              <dl className="term-list">
                <div><dt>Places</dt><dd>Fifty, numbered I to L, one per firm.</dd></div>
                <div><dt>The pilot</dt><dd>Free for the whole pilot. No card needed.</dd></div>
                <div><dt>After the pilot</dt><dd>Half the standard price, for as long as your firm stays with Mastor.</dd></div>
                <div><dt>The price</dt><dd>Not set yet. You’ll see it before you pay anything, and you can leave whenever you like.</dd></div>
                <div><dt>For</dt><dd>UK contractors on council and housing-association schedule-of-rates work: planned, WHQS and Decent Homes, responsive and voids.</dd></div>
              </dl>
              {cta && <button className="claim on-white" onClick={toForm}><span>{cta}</span><IconArrow size={22} /></button>}
            </div>
            <Register taken={taken} yours={claimed?.place ?? null} />
          </div>
        </section>

        <section className="wrap origin">
          <img src="/icon.svg" alt="" width={44} height={44} />
          <p>Mastor was built inside Tree &amp; Sons Ltd, a Pembrokeshire contractor, on live council framework jobs, to replace the spreadsheets we ran them on.</p>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <Wordmark />
          <a href="/app" className="top-link">Sign in</a>
        </div>
        <div className="wrap credits">
          <p>Photographs on <a href="https://unsplash.com/?utm_source=mastor&amp;utm_medium=referral">Unsplash</a> by {[PHOTOS.phone, PHOTOS.street, PHOTOS.roof].map((p, i, a) => <span key={p.id}><a href={p.profile}>{p.by}</a>{i < a.length - 2 ? ', ' : i === a.length - 2 ? ' and ' : '.'}</span>)} App screens show an example job; its names and figures are made up.</p>
        </div>
      </footer>
    </>
  )
}
