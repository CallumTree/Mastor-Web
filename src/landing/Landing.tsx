/**
 * The front page: what Mastor is, and fifty numbered founding places to claim. The register shows
 * the places as they really are (counted in the database by /api/early-signup). It is never
 * padded, and when the count can't be read it doesn't guess.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Wordmark } from '../components/Wordmark'
import { IconArrow, IconCheck } from '../components/Icons'
import { roman } from '../lib/format'
import { SignMark } from '../components/Sign'

const PLACES = 50
const WORK = ['Planned (PPR, WHQS, Decent Homes)', 'Responsive and voids', 'Other framework work'] as const

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
  const [work, setWork] = useState<string[]>([])
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
        body: JSON.stringify({ name, firm, email, phone, work: work.join('; '), website: robot.current?.value ?? '', source: q.get('utm_source') || q.get('ref') || document.referrer || '' }),
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
        <span className="claimed-mark"><IconCheck size={22} /></span>
        <div>
          <p className="claimed-h">{place ? (already ? `Place ${roman(place)} is already yours.` : `Place ${roman(place)} is yours.`) : listed ? 'You’re on the list.' : already ? 'You’re already on the waiting list.' : 'You’re on the waiting list.'}</p>
          <p className="claimed-t">{place
            ? 'Free through the pilot, then half price for as long as you stay. We’ll email you to get your first job in.'
            : listed ? 'We’ve got your details and we’ll email you about your founding place.' : 'All fifty founding places have gone. We’ll email you as soon as Mastor opens to more firms.'}</p>
        </div>
      </div>
    )
  }

  return (
    <form className="signup" onSubmit={submit} noValidate>
      <div className="pair">
        <label className="field"><span>Your name</span><input ref={nameRef} value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
        <label className="field"><span>Firm</span><input value={firm} onChange={e => setFirm(e.target.value)} autoComplete="organization" required /></label>
      </div>
      <div className="pair">
        <label className="field"><span>Email</span><input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field"><span>Phone <em>optional</em></span><input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
      </div>
      {/* not for people: left empty by anyone who can see the form */}
      <input ref={robot} name="website" tabIndex={-1} autoComplete="off" className="robot" aria-hidden="true" />
      {err && <p className="err" role="alert">{err}</p>}
      <button className="claim" disabled={busy}>
        <span>{busy ? 'Claiming…' : full ? 'Join the waiting list' : next ? <>Claim place <b>{roman(next)}</b></> : 'Claim a founding place'}</span>
        <IconArrow size={22} />
      </button>
      <p className="fine">We use these details only to talk to you about Mastor. No card needed.</p>
      {/* optional, so it sits after the button: the claim stays in a phone's first screen */}
      <fieldset className="work">
        <legend>Your work <em>optional, sent with your claim</em></legend>
        <div className="chips">
          {WORK.map(w => (
            <button type="button" key={w} className={'chip' + (work.includes(w) ? ' on' : '')} aria-pressed={work.includes(w)}
              onClick={() => setWork(s => (s.includes(w) ? s.filter(x => x !== w) : [...s, w]))}>{work.includes(w) && <IconCheck size={16} />}{w}</button>
          ))}
        </div>
      </fieldset>
    </form>
  )
}

const STAGES: [string, string][] = [
  ['Works order in', 'Import the BoQ from the client’s Excel or PDF. Every rate is checked against your framework schedule of rates, and a line paid under the schedule is flagged before you start.'],
  ['On site', 'Photos, video and voice notes go into the site diary from a phone, signal or not. Mastor reads them against the scope and suggests what’s done and what’s extra; a person approves every one.'],
  ['Variations', 'Every VO numbered and never reused, priced from your schedule, carrying the client’s own reference and showing whose court it’s in. The Variation Register goes to the client as a PDF.'],
  ['Valuation', 'Tick what’s done. Uplifts, previously certified and the cumulative total are worked out, and the questions a client QS would ask are checked before you issue the certificate.'],
  ['Invoice and paid', 'A VAT invoice from the issued valuation, on your own numbering, out to Xero or QuickBooks. What’s owed and what’s overdue, across every job.'],
  ['Margin', 'Subbie quotes, labour and materials set against what the client pays, job by job, so you know what each one makes.'],
]

const STACK = ['Master Schedule v6.xlsx', 'Val 4 FINAL (2).xlsx', 'Subbie comparison.xlsx', 'OneNote: site notes', 'The planner', 'Sticky notes']

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
          <a href="/app" className="top-link">Sign in</a>
        </div>
      </header>

      <main>
        <section className="hero wrap" id="claim">
          <div className="hero-copy">
            <h1 className="h1">The master schedule, without the spreadsheets.</h1>
            <p className="lede">Scope, site diary, variations, valuations and invoices for each job in one place, for contractors on council and housing-association framework work.</p>
            <p className="offer"><b>Fifty founding places.</b> Free through the pilot, then half price for as long as you stay.</p>
            {/* phones: the register is below the form, so the next place is shown up here too */}
            {next && taken != null && !claimed && (
              <a href="#register" className="next-strip">
                <span className="next-tile">{roman(next)}</span>
                <span>is the next founding place. <b>{PLACES - taken} of {PLACES}</b> left.</span>
              </a>
            )}
            <SignUp taken={taken} claimed={claimed} nameRef={nameRef} onClaimed={(c, t) => { setClaimed(c); if (t != null) setTaken(t) }} />
          </div>
          <Register taken={taken} yours={claimed?.place ?? null} />
        </section>

        <section className="stack-sec">
          <div className="wrap">
            <h2 className="h2">One job, one place.</h2>
            <ul className="stack" aria-label="What it replaces">
              {STACK.map(s => <li key={s}><s>{s}</s></li>)}
            </ul>
            <p className="body-l">A job’s money and record end up across spreadsheets, notebooks, planners and the backs of envelopes. Trade job apps are built for domestic quotes and know nothing about SoR codes, uplifts, client VOs or valuations. Enterprise software is priced for firms with a commercial department. Mastor is for the firms in between: it does the in-between work a QS would, and grows with you without changing how it works.</p>
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
                  <tr><td className="ref">I</td><td>Renew rotten joists under bath<small>No. 4 bathroom · 2.00 LM</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Unpriced</span></td></tr>
                  <tr><td className="ref">II</td><td>Extra skirting<small>No. 3 · 3.00 LM @ £10.00 · ref PCC-1</small></td><td className="r">£30.00</td></tr>
                  <tr><td className="ref">III</td><td>Replace cracked lintel over back door<small>No. 4 rear</small></td><td className="r"><span className="unk"><SignMark kind="warn" size={14} />Not measured</span></td></tr>
                </tbody>
              </table>
            </figure>
          </div>
        </section>

        <section className="wrap firm-sec">
          <h2 className="h2">Built for the whole firm.</h2>
          <dl className="facts">
            <div><dt>On site</dt><dd>Works on a phone in the rain with gloves on, and keeps working with no signal. It catches up when you’re back in range.</dd></div>
            <div><dt>Operatives</dt><dd>Log work, photos and voice notes without ever seeing a rate, a value or a margin.</dd></div>
            <div><dt>Office</dt><dd>Valuations, certificates, the VO register, invoices and what’s owed, from the same jobs the site is filling in.</dd></div>
            <div><dt>With Claude</dt><dd>Connect Mastor to Claude and ask it about any job. It can tick lines into the valuation and log VOs when you say yes; issuing always stays with you.</dd></div>
          </dl>
        </section>

        <section className="terms">
          <div className="wrap terms-in">
            <h2 className="h2">Founding terms.</h2>
            <dl className="term-list">
              <div><dt>Places</dt><dd>Fifty, numbered I to L, one per firm.</dd></div>
              <div><dt>The pilot</dt><dd>Free for the whole pilot. No card needed.</dd></div>
              <div><dt>After the pilot</dt><dd>Half the standard price, for as long as your firm stays with Mastor.</dd></div>
              <div><dt>The price</dt><dd>Not set yet. You’ll see it before you pay anything, and you can leave whenever you like.</dd></div>
              <div><dt>For</dt><dd>UK contractors on council and housing-association schedule-of-rates work: planned, WHQS and Decent Homes, responsive and voids.</dd></div>
            </dl>
            {cta && <button className="claim on-white" onClick={toForm}><span>{cta}</span><IconArrow size={22} /></button>}
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
      </footer>
    </>
  )
}
