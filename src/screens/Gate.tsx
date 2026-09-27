import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { createCompany, myCompany, startSync, stopSync } from '../lib/sync'
import { meta } from '../lib/db'
import { Drawing } from '../components/Drawing'
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
      const c = await myCompany()
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
    <div className="immersive">
      <div className="sky" />
      <div className="bg-drawing"><Drawing id="mastor" type="PPR" active bare /></div>
      <div className="imm-top" style={{ paddingTop: 48 }}>
        <div className="wordmark">MASTOR</div>
        <div className="imm-sub">Site · Variations · Valuations</div>
      </div>
      <div style={{ position: 'relative', zIndex: 3, padding: '28px 16px', maxWidth: 440, width: '100%', margin: '0 auto' }}>
        {stage.s === 'loading' && <div style={{ textAlign: 'center', color: 'var(--cream-muted)' }}><div className="beam-dot" /></div>}
        {stage.s === 'signedOut' && <SignIn />}
        {stage.s === 'needCompany' && <CompanySetup onDone={() => supabase.auth.getSession().then(({ data }) => afterSignIn(data.session))} />}
        {stage.s === 'error' && (
          <div className="glass" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Couldn’t reach Mastor’s servers</div>
            <div style={{ fontSize: 13, color: 'var(--cream-muted)' }}>{stage.msg}</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => location.reload()}>Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const go = async () => {
    setBusy(true); setMsg(null)
    const r = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin } })
    setBusy(false)
    if (r.error) setMsg({ ok: false, text: r.error.message })
    else if (mode === 'up' && !r.data.session) setMsg({ ok: true, text: 'Check your email and tap the link to confirm — then sign in here.' })
  }
  return (
    <div className="glass stack" style={{ padding: 16, background: 'rgba(26,26,46,.72)' }}>
      <div className="chips" style={{ justifyContent: 'center' }}>
        <button className={'chip' + (mode === 'in' ? ' on' : '')} onClick={() => setMode('in')}>Sign in</button>
        <button className={'chip' + (mode === 'up' ? ' on' : '')} onClick={() => setMode('up')}>Create account</button>
      </div>
      <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Password" hint={mode === 'up' ? 'At least 8 characters' : undefined}><input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {msg && <div style={{ fontSize: 13, color: msg.ok ? 'var(--copper-light)' : '#FCA5A5' }}>{msg.text}</div>}
      <button className="btn btn-primary" disabled={busy || !email.includes('@') || password.length < (mode === 'up' ? 8 : 1)} onClick={go}>
        {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      {mode === 'in' && <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--cream-muted)' }} onClick={async () => {
        if (!email.includes('@')) { setMsg({ ok: false, text: 'Enter your email first.' }); return }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin })
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Password reset email sent.' })
      }}>Forgotten password</button>}
    </div>
  )
}

function CompanySetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="glass stack" style={{ padding: 16, background: 'rgba(26,26,46,.72)' }}>
      <div style={{ fontWeight: 600 }}>Your company</div>
      <div style={{ fontSize: 13, color: 'var(--cream-muted)' }}>Jobs belong to your company, so people you invite later see the same jobs. Anything already on this phone comes with you.</div>
      <Field label="Company name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tree & Sons Ltd" /></Field>
      {err && <div style={{ fontSize: 13, color: '#FCA5A5' }}>{err}</div>}
      <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true); setErr(null)
        try { await createCompany(name.trim()); onDone() } catch (e) { setErr((e as Error).message); setBusy(false) }
      }}>Continue</button>
    </div>
  )
}
