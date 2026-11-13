/**
 * The front page, cut to what earns a sign-up (13 Nov): what it is, the form, the one thing it does (the site diary
 * runs the valuation, recorded in the real app), the time back (two figures, our estimate), that it never makes a
 * number up, three plans, fifty numbered places, five questions. Every fact is said once. The register shows the
 * places as they really are (counted in the database by /api/early-signup), never padded, and never guessed.
 */
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { PHOTOS, sized, srcSet, type Photo } from './photos'
import { Wordmark } from '../components/Wordmark'
import { IconArrow, IconCheck } from '../components/Icons'
import { roman } from '../lib/format'
import { SignMark } from '../components/Sign'

const PLACES = 50
const WORK = ['Planned programmes', 'Repairs and maintenance', 'Empty properties', 'A mix of these', 'Something else'] as const

type Claimed = { place: number | null; already: boolean; listed?: boolean }

/** The plans (PRODUCT.md → Plans): per firm, never per head. Mastor isn't VAT-registered (decided 6 Nov: not until its
 *  turnover needs it), so prices are what you pay. Once registered, set this: prices show + VAT with the VAT-inclusive
 *  figure beside each (the ASA wants both where some buyers can't reclaim VAT). Founding firms pay half. */
const VAT_REGISTERED = false
const PLANS = [
  { n: 'I', name: 'Column', line: 'The record, by hand.', month: 29, seats: 2, extra: false, lead: false,
    adds: ['Jobs, scope, VOs and the site diary', 'Valuations, invoices and payments', 'Five AI document reads a month'] },
  { n: 'II', name: 'Arch', line: 'With Clerk and the AI readers.', month: 69, seats: 5, extra: true, lead: true,
    adds: ['Everything in Column', 'Clerk, the assistant on every job', 'Reads site photos, voice notes and client packs', 'Costs and margin on every job'] },
  { n: 'III', name: 'Dome', line: 'More people, more AI, set-up help.', month: 149, seats: 12, extra: true, lead: false,
    adds: ['Everything in Arch', 'Site reading that never stops', 'Help moving your jobs in', 'Same-day support'] },
]
const pounds = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** The price schedule: three plans ruled like a rate book. The one most firms choose is marked, never boxed in. */
function Prices({ onClaim }: { onClaim: () => void }) {
  return (
    <section className="prices" id="prices" aria-labelledby="prices-h">
      <div className="wrap">
        <h2 className="h2" id="prices-h">One price for the firm, not for each person.</h2>
        <ol className="plan-grid">
          {PLANS.map(p => (
            <li key={p.name} className={'plan' + (p.lead ? ' lead' : '')} aria-label={`${p.name} ${p.n}`}>
              {p.lead && <span className="plan-flag">Most firms choose Arch</span>}
              <h3 className="plan-name"><span className="plan-n">{p.name} {p.n}</span><span className="plan-line">{p.line}</span></h3>
              <div className="plan-price">
                <span className="plan-fig">{pounds(p.month)}</span><span className="plan-per">a month{VAT_REGISTERED ? ' + VAT' : ''}</span>
              </div>
              <dl className="plan-terms">
                {VAT_REGISTERED && <div><dt>With VAT</dt><dd className="pf">{pounds(p.month * 1.2)} a month</dd></div>}
                <div><dt>People</dt><dd><span className="pf">{p.seats}</span>{p.extra ? <>, then <span className="pf">£10</span> each</> : ''}</dd></div>
                <div className="founding"><dt>Founding</dt><dd><span className="pf">{pounds(p.month / 2)}</span> a month</dd></div>
              </dl>
              <ul className="plan-adds">
                {p.adds.map((a, i) => <li key={a} className={i === 0 && p.n !== 'I' ? 'base' : ''}><IconCheck size={16} /><span>{a}</span></li>)}
              </ul>
            </li>
          ))}
        </ol>
        <p className="fine prices-fine">Pay yearly and get two months free. Stop any month.</p>
        <button className="claim on-white" onClick={onClaim}><span>Claim a founding place at half price</span><IconArrow size={22} /></button>
      </div>
    </section>
  )
}

const QUESTIONS: [string, string][] = [
  ['Who sees the money?', 'Only the people you give a place to. A version for operatives, with the money hidden, comes later.'],
  ['Does it work without signal?', 'Yes. It saves on the phone and syncs when there’s signal.'],
  ['Can I bring my schedule of rates?', 'Yes. Import it once, and every line and VO prices from it.'],
  ['Does the AI send anything on its own?', 'No. Nothing is claimed or sent to a client until a person says so.'],
  ['What if I stop paying?', 'Your account goes read-only. Nothing is deleted, and you can take everything with you.'],
]

/** What firms ask before they sign up, answered plainly. Native details/summary: works with no script. */
function Questions() {
  return (
    <section className="questions" id="questions" aria-labelledby="q-h">
      <div className="wrap q-in">
        <h2 className="h2" id="q-h">Questions.</h2>
        <div className="q-list">
          {QUESTIONS.map(([q, a]) => (
            <details key={q} className="q">
              <summary><span>{q}</span><span className="q-mark" aria-hidden="true" /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

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
  const [name, setName] = useState(''), [firm, setFirm] = useState(''), [email, setEmail] = useState('')
  const [work, setWork] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const robot = useRef<HTMLInputElement>(null)
  const shown = useRef(Date.now())   // when the form appeared: a form sent faster than a person can fill it is a robot's
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
        body: JSON.stringify({ name, firm, email, phone: '', work, website: robot.current?.value ?? '', took: Date.now() - shown.current, source: q.get('utm_source') || q.get('ref') || document.referrer || '' }),
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
      <p className="fine">No card needed.{taken != null && !full ? ` ${PLACES - taken} of ${PLACES} places left.` : ''}</p>
    </form>
  )
}

/** The time back on one monthly valuation: two figures, our estimate (by hand about three hours; in Mastor most of it
 *  is done on site as the work happens). Stated as an estimate, never as a measurement. */
function ValuationTime() {
  return (
    <figure className="val-time" aria-label="A monthly valuation: about 3 hours by hand, 27 minutes in Mastor (our estimate)">
      <div><span className="vt-l">By hand</span><span className="vt-n">3 hrs</span></div>
      <div className="hot"><span className="vt-l">In Mastor</span><span className="vt-n">27 min</span></div>
    </figure>
  )
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
        aria-label="Screen recording of Mastor: a voice note from site has been read against the scope on its own; two kitchen lines go into the open valuation and a cracked lintel becomes VO IV">
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
  // the street print ends on a ruled edge just under the headline and offer, wherever they wrap to
  const band = useRef<HTMLDivElement>(null), head = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const fit = () => { if (band.current && head.current) band.current.style.height = `${Math.ceil(head.current.getBoundingClientRect().bottom + scrollY) + 28}px` }
    fit()
    if (typeof ResizeObserver === 'undefined' || !head.current) return
    const ro = new ResizeObserver(fit); ro.observe(head.current); return () => ro.disconnect()
  }, [])

  useEffect(() => {
    fetch('/api/early-signup').then(r => (r.ok ? r.json() : null)).then(b => { if (typeof b?.taken === 'number') setTaken(b.taken) }).catch(() => {})
  }, [])
  const toForm = () => { document.getElementById('claim')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); nameRef.current?.focus({ preventScroll: true }) }
  const next = taken != null && taken < PLACES ? taken + 1 : null
  const cta = claimed ? null : taken != null && taken >= PLACES ? 'Join the waiting list' : next ? <>Claim place <b>{roman(next)}</b></> : 'Claim a founding place'

  return (
    <>
      {/* a real street of terraced houses behind the header and headline, printed dark in blueprint blue under the drafting grid and cut off on a ruled edge; decorative, credited in the footer */}
      <div className="lead-bg" ref={band} aria-hidden="true"><img src={sized(PHOTOS.terrace, 1400)} srcSet={srcSet(PHOTOS.terrace)} sizes="100vw" alt="" width={1400} height={933} decoding="async" {...{ fetchpriority: "high" }} /></div>
      <header className="top">
        <div className="wrap top-in">
          <a href="/?site" className="top-mark" aria-label="Mastor, home"><Wordmark /></a>
          <a href="/app" className="top-link">Sign in</a>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-head" ref={head}>
            <h1 className="h1">Run the job from site, not from a desk.</h1>
            <p className="lede">Scope, diary, variations, valuations and invoices for schedule-of-rates work, on your phone.</p>
            <p className="offer"><b>Fifty founding places.</b> Free through the pilot, then half price for as long as you stay.</p>
          </div>
          <figure className="hero-art">
            <Pic p={PHOTOS.kitchen} ratio={4 / 5} sizes="(min-width: 1024px) 480px, 100vw" className="hero-photo" eager />
            <Phone name="app-home" alt="Mastor on a phone: the example job Hill Street refurb, with its contract, certified and margin figures and the actions needed" eager />
          </figure>
          <div className="hero-form" id="claim">
            <SignUp taken={taken} claimed={claimed} nameRef={nameRef} onClaimed={(c, t) => { setClaimed(c); if (t != null) setTaken(t) }} />
          </div>
        </section>

        <section className="feature" id="site">
          <div className="wrap feature-in">
            <div className="feature-copy">
              <h2 className="h2 on-dark">The site diary runs the valuation.</h2>
              <ol className="steps">
                <li><span className="step-n">I</span><div><h3 className="h3 on-dark">Say it or snap it</h3><p>“Kitchen’s fitted at No. 6. Lintel over the back door’s cracked.”</p></div></li>
                <li><span className="step-n">II</span><div><h3 className="h3 on-dark">Mastor reads it</h3><p>The kitchen lines are done. The lintel isn’t in the scope: it’s extra.</p></div></li>
                <li><span className="step-n">III</span><div><h3 className="h3 on-dark">You approve it</h3><p>Two taps: the lines go in the valuation, the lintel becomes VO IV.</p></div></li>
              </ol>
            </div>
            <figure className="feature-video">
              <Recording />
            </figure>
          </div>
        </section>

        <section className="time" id="time">
          <div className="wrap time-in">
            <div>
              <h2 className="h2">Two and a half hours back on every valuation.</h2>
              <p className="fine time-fine">Our estimate for a scheme of a few houses.</p>
            </div>
            <ValuationTime />
          </div>
        </section>

        <section className="honest">
          <div className="wrap honest-in">
            <div>
              <h2 className="h2 on-dark">It never makes a number up.</h2>
              <p className="body-l on-dark">No rate says <b>unpriced</b>, never £0. Every figure goes back to the BoQ, the rates or the instruction.</p>
            </div>
            <figure className="vo-reg">
              <figcaption><span>Variation register</span><span className="ex">Example</span></figcaption>
              <table>
                <thead><tr><th scope="col">VO</th><th scope="col">Work</th><th scope="col" className="r">Value</th></tr></thead>
                <tbody>
                  <tr><td className="ref">I</td><td>Renew rotten joists under bath<small>No. 4 bathroom · 2.40 LM @ £38.60</small></td><td className="r">£92.64</td></tr>
                  <tr><td className="ref">II</td><td>Replace defective consumer unit<small>No. 8 hall · 1 NO @ £420.00 · sent to the client</small></td><td className="r">£420.00</td></tr>
                  <tr><td className="ref">III</td><td>Additional plaster patching to kitchen walls<small>No. 6 kitchen · 6.50 SM</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Unpriced</span></td></tr>
                  <tr><td className="ref">IV</td><td>Replace cracked lintel over the back door<small>No. 6 back door · 1.20 LM</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Unpriced</span></td></tr>
                </tbody>
              </table>
            </figure>
          </div>
        </section>

        <Prices onClaim={toForm} />

        <section className="places" id="places">
          <div className="wrap places-in">
            <div>
              <h2 className="h2">Fifty founding places.</h2>
              <p className="body-l">Numbered I to L. Each firm keeps its place.</p>
              {cta && <button className="claim on-white" onClick={toForm}><span>{cta}</span><IconArrow size={22} /></button>}
            </div>
            <Register taken={taken} yours={claimed?.place ?? null} />
          </div>
        </section>

        <Questions />

      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <Wordmark />
          <a href="/app" className="top-link">Sign in</a>
        </div>
        <div className="wrap credits">
          <p>Photographs on <a href="https://unsplash.com/?utm_source=mastor&amp;utm_medium=referral">Unsplash</a> by {[...new Map(Object.values(PHOTOS).map(p => [p.by, p])).values()].map((p, i, a) => <span key={p.id}><a href={p.profile}>{p.by}</a>{i < a.length - 2 ? ', ' : i === a.length - 2 ? ' and ' : '.'}</span>)} App screens show an example job; its names and figures are made up.</p>
        </div>
      </footer>
    </>
  )
}
