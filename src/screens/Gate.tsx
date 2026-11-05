import { Wordmark } from '../components/Wordmark'
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { createCompany, myCompany, startSync, stopSync } from '../lib/sync'
import { meta } from '../lib/db'
import { acceptInvites } from '../lib/team'
import { Field } from '../components/Ui'

/**
 * Sign-in gate. Signed in + company → the app (syncing). Works offline once signed in:
 * the session and company are remembered on the device.
 */
type Stage = { s: 'loading' } | { s: 'signedOut' } | { s: 'needCompany' } | { s: 'ready'; company: string } | { s: 'error'; msg: string }

export function Gate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>({ s: 'loading' })

  const afterSignIn = async (session: Session | null) => {
    if (!session) { stopSync(); setStage({ s: 'signedOut' }); return }
    const cached = await meta.get<{ id: string; name: string; user: string }>('company')
    try {
      let c = await myCompany()
      if (!c && (await acceptInvites())) c = await myCompany()   // invited by email: join that company
      if (!c) { setStage({ s: 'needCompany' }); return }
      await meta.set('company', { ...c, user: session.user.id })
      await startSync(c.id); setStage({ s: 'ready', company: c.name })
    } catch (e) {
      // No signal: carry on with the company we already know, sync catches up later
      if (cached && cached.user === session.user.id) { await startSync(cached.id); setStage({ s: 'ready', company: cached.name }) }
      else setStage({ s: 'error', msg: (e as Error).message })
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => afterSignIn(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') afterSignIn(session) })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (stage.s === 'ready') return <>{children}</>
  return (
    <main className="cover cover-gate">
      <header className="cover-head">
        <div className="cover-mark" style={{ padding: '40px 16px 28px' }}>
          <Wordmark />
          <div className="cover-sub">Site · Variations · Valuations</div>
        </div>
      </header>
      <div className="cover-body" style={{ maxWidth: 440 }}>
        {stage.s === 'loading' && <div className="loading-bar" role="status" aria-label="Loading" />}
        {stage.s === 'signedOut' && <SignIn />}
        {stage.s === 'needCompany' && <CompanySetup onDone={() => supabase.auth.getSession().then(({ data }) => afterSignIn(data.session))} />}
        {stage.s === 'error' && (
          <div className="panel stack">
            <div style={{ fontWeight: 700 }}>Couldn’t reach Mastor’s servers</div>
            <div className="muted t-note">{stage.msg}</div>
            <button className="btn btn-primary" onClick={() => location.reload()}>Try again</button>
          </div>
        )}
      </div>
    </main>
  )
}

/** The sign-in service's messages, said the way a person would, with what to do next. */
export function plainAuth(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return 'That email and password don’t match an account. Check them, or tap “I’m new” to create one. Forgotten it? “Forgot password” below.'
  if (/already registered|already exists/i.test(raw)) return 'There’s already an account with that email. Tap “I have an account” and sign in (or reset the password).'
  if (/password should be|at least \d+ characters|weak password/i.test(raw)) return 'That password is too short or too easy to guess. Use at least 8 characters.'
  if (/rate limit|only request this after|too many/i.test(raw)) return 'Too many tries in a short time. Wait a minute, then try again.'
  if (/failed to fetch|network/i.test(raw)) return 'No signal reached the server. Try again once you have signal.'
  if (/invalid.*email|email.*invalid/i.test(raw)) return 'That doesn’t look like a full email address. Check it and try again.'
  return raw
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)   // resend only makes sense once an account exists: after signing up, or an unconfirmed sign-in
  const resend = async () => {
    if (!email.includes('@')) { setMsg({ ok: false, text: 'Enter your email first.' }); return }
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${location.origin}/app` } })
    setBusy(false)
    setMsg(error ? { ok: false, text: plainAuth(error.message) } : { ok: true, text: 'New confirmation email sent — tap the link in it, then sign in here.' })
  }
  const go = async () => {
    setBusy(true); setMsg(null)
    const r = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/app` } })
    setBusy(false)
    if (r.error && /not confirmed/i.test(r.error.message)) { setUnconfirmed(true); setMsg({ ok: false, text: 'Your email isn’t confirmed yet. Tap “Resend confirmation email” and use the link in the new email.' }) }
    else if (r.error) setMsg({ ok: false, text: plainAuth(r.error.message) })
    else if (mode === 'up' && !r.data.session) { setUnconfirmed(true); setMsg({ ok: true, text: 'Check your email and tap the link to confirm — then sign in here.' }) }
  }
  return (
    <div className="panel stack">
      {/* which form this is, not a button: the white block below is the one thing to press */}
      <div className="mode-switch" role="tablist" aria-label="Sign in or create an account">
        <button role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg(null) }}>I have an account</button>
        <button role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg(null) }}>I’m new</button>
      </div>
      <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Password" hint={mode === 'up' ? 'At least 8 characters' : undefined}><input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {msg && <div role="status" className="t-note" style={{ fontWeight: 600, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</div>}
      <button className="btn btn-primary" disabled={busy || !email.includes('@') || password.length < (mode === 'up' ? 8 : 1)} onClick={go}>
        {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      {unconfirmed && <button className="btn btn-secondary" disabled={busy} onClick={resend}>Resend confirmation email</button>}
      {mode === 'in' && <button className="btn btn-ghost" style={{ width: '100%' }} onClick={async () => {
        if (!email.includes('@')) { setMsg({ ok: false, text: 'Enter your email first.' }); return }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/app` })
        setMsg(error ? { ok: false, text: plainAuth(error.message) } : { ok: true, text: 'Password reset email sent.' })
      }}>Forgotten password</button>}
    </div>
  )
}

function CompanySetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="panel stack">
      <div style={{ fontWeight: 700 }}>Your company</div>
      <div className="muted t-note">Jobs belong to your company, so people you add later see the same jobs. Anything already on this phone comes with you.</div>
      <div className="muted t-note">Joining someone else’s company? Ask them to add your email under Settings → Team, then <button className="linkish tap" onClick={onDone}>check again</button>.</div>
      <Field label="Company name"><input value={name} onChange={e => setName(e.target.value)} placeholder="As it appears on your invoices" /></Field>
      {err && <div role="alert" className="t-note" style={{ fontWeight: 600, color: 'var(--red)' }}>{err}</div>}
      <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true); setErr(null)
        try { await createCompany(name.trim()); onDone() } catch (e) { setErr((e as Error).message); setBusy(false) }
      }}>Continue</button>
    </div>
  )
}
