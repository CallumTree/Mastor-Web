import { useEffect, useRef, useState } from 'react'
import type { Job } from '../lib/types'
import { useAccess } from '../lib/access'
import { currentCompany } from '../lib/sync'
import { askMastor, changeDetail, changeTitle, convoSize, EMPTY, lines, loadConvo, saveConvo, TOO_LONG, type Convo } from '../lib/ask'
import { SignMark } from '../components/Sign'
import { Trace } from '../components/Trace'
import { IconMic, IconSend } from '../components/Icons'

/** Speech to text where the phone's browser offers it (Safari, Chrome); otherwise the keyboard's own mic. */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const Speech = (typeof window !== 'undefined' && ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition)) || null

const EXAMPLES_MONEY = ['What’s still to claim at No. 6?', 'Tick the finished kitchen lines into the open val', 'Log a VO: cracked lintel over the back door, 1.2 m', 'What’s overdue and who do I chase?']
const EXAMPLES_SITE = ['What’s left to do at No. 4?', 'Log a VO: cracked lintel over the back door, 1.2 m', 'Today: dry, 5 on site, scaffold struck at No. 2', 'Add a note: tenant at No. 8 away until Friday']

/**
 * Ask: Mastor's assistant for this job. Type or speak; it reads the job with the app's own figures and
 * proposes changes as a card that runs only on Do it. Issuing and invoicing stay with a person.
 */
export function AskTab({ job }: { job: Job }) {
  const access = useAccess()
  const [convo, setConvo] = useState<Convo>(EMPTY)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const rec = useRef<Rec | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const yes = useRef<HTMLButtonElement>(null)

  useEffect(() => { let live = true; loadConvo(job.id).then(c => live && setConvo(c)); return () => { live = false } }, [job.id])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [convo, busy])
  useEffect(() => () => rec.current?.stop(), [])
  // the decision is the next thing to do, so it takes focus (keyboard and screen readers land on it)
  const deciding = convo.pending.length > 0 && !busy
  useEffect(() => { if (deciding) yes.current?.focus({ preventScroll: true }) }, [deciding])
  // the box grows with the words; CSS does this where field-sizing exists (older Safari needs a hand)
  useEffect(() => {
    const t = box.current
    if (!t || CSS.supports?.('field-sizing', 'content')) return
    t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 3, 144) + 'px'
  }, [text])

  const online = !!currentCompany()
  const shown = lines(convo)
  const waiting = convo.pending
  const tooLong = convoSize(convo) > TOO_LONG

  const keep = (c: Convo) => { setConvo(c); void saveConvo(job.id, c) }
  const go = async (step: { text: string } | { decision: 'approve' | 'cancel' }) => {
    setErr(null); setBusy('Sending')
    try { keep(await askMastor(job.id, convo, step, s => setBusy(s))) }
    catch (e) { const c = (e as { convo?: Convo | null }).convo; if (c) keep(c); setErr((e as Error).message); if ('text' in step) setText(step.text) }
    finally { setBusy(null) }
  }
  const send = () => { const t = text.trim(); if (!t || busy || waiting.length) return; setText(''); rec.current?.stop(); void go({ text: t }) }
  const listen = () => {
    if (!Speech) return
    if (listening) { rec.current?.stop(); return }
    const r = new Speech(); rec.current = r
    const before = text ? text.replace(/\s*$/, ' ') : ''
    r.lang = 'en-GB'; r.interimResults = true; r.continuous = false
    r.onresult = e => setText(before + Array.from(e.results).map(x => x[0].transcript).join(''))
    r.onend = () => { setListening(false); box.current?.focus() }
    r.onerror = () => setListening(false)
    setListening(true); r.start()
  }

  if (!online) return (
    <section className="ask">
      <h1 className="tab-title">Ask</h1>
      <div className="card empty">Ask works when this phone is signed in to Mastor’s cloud, so it can read and change the job you share with the office. Sign in from Settings.</div>
    </section>
  )

  return (
    <section className="ask">
      <div className="row ask-head">
        <h1 className="tab-title grow">Ask</h1>
        {convo.messages.length > 0 && !busy && <button className="btn btn-secondary ask-new" onClick={() => { keep(EMPTY); setErr(null) }}>New chat</button>}
      </div>

      {!convo.messages.length && (
        <div className="ask-intro">
          <p>Ask about {job.name}, or tell it what to change. It reads the job the way the app does, and nothing changes until you tap <b>Do it</b>.</p>
          <div className="ask-try">
            {(access.money ? EXAMPLES_MONEY : EXAMPLES_SITE).map(x => <button key={x} className="chip" onClick={() => { setText(x); box.current?.focus() }}>{x}</button>)}
          </div>
        </div>
      )}

      <div className="ask-log" aria-live="polite">
        {shown.map((l, i) =>
          l.kind === 'you' ? <div key={i} className="ask-you">{l.text}</div>
          : l.kind === 'ask' ? <div key={i} className="ask-say">{l.text}</div>
          : (
            <div key={i} className={'ask-change ' + l.outcome}>
              {l.outcome === 'done' ? <SignMark kind="ok" size={18} /> : <span className="ask-x" aria-hidden="true" />}
              <div className="grow"><b>{l.outcome === 'done' ? 'Done' : l.outcome === 'cancelled' ? 'Cancelled' : 'Didn’t go through'}: {l.title}</b>
                {l.note && <small>{l.note}</small>}</div>
            </div>
          ))}

        {waiting.length > 0 && !busy && (
          <div className="ask-card live" role="group" aria-label="Change waiting for your yes">
            <Trace r={12} inset={4} />
            {waiting.map(w => (
              <div key={w.id} className="ask-card-item">
                <div className="ask-card-h">{changeTitle(w.name)}</div>
                <ul>{changeDetail(w.input).map((d, j) => <li key={j}>{d}</li>)}</ul>
              </div>
            ))}
            <div className="ask-card-do">
              <button ref={yes} className="btn ask-yes" onClick={() => go({ decision: 'approve' })}>Do it</button>
              <button className="btn ask-no" onClick={() => go({ decision: 'cancel' })}>Cancel</button>
            </div>
            <div className="ask-card-note">Saved changes are marked “by Claude” in the app.</div>
          </div>
        )}
        {busy && <div className="ask-busy live" role="status"><Trace r={12} inset={0} color="var(--volt)" delay={0} />{busy}…</div>}
        {err && <div className="flag">{err}</div>}
        {tooLong && <div className="hint">This conversation is getting long. Tap New chat to start a fresh one.</div>}
        <div ref={end} className="ask-end" />
      </div>

      <form className="ask-bar" onSubmit={e => { e.preventDefault(); send() }}>
        <textarea ref={box} rows={1} value={text} disabled={!!waiting.length && !busy} aria-label="Ask Mastor"
          placeholder={waiting.length ? 'Tap Do it or Cancel first' : Speech ? 'Ask, or tap the mic' : 'Ask, or use your keyboard’s mic'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send() } }} />
        {Speech && <button type="button" className={'icon-btn ask-mic' + (listening ? ' on' : '')} aria-label={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening} onClick={listen} disabled={!!busy || !!waiting.length}><IconMic /></button>}
        <button type="submit" className="icon-btn ask-send" aria-label="Send" disabled={!text.trim() || !!busy || !!waiting.length}><IconSend /></button>
      </form>
    </section>
  )
}
