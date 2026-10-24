import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'
import { Plate } from '../components/Sign'

type Details = { authorization_id: string; client: { name: string }; user: { email: string } }

/**
 * /oauth/consent — Claude (or another app) asking to use Mastor as the signed-in person. Supabase Auth's
 * OAuth server sends people here with ?authorization_id=…; Allow hands Claude a sign-in that works exactly
 * like logging in to Mastor yourself (same company, same role, nothing more).
 */
export function Consent() {
  const id = new URLSearchParams(location.search).get('authorization_id') ?? ''
  const [details, setDetails] = useState<Details | null>(null)
  const [who, setWho] = useState<{ company: string; money: boolean } | null>(null)
  const [error, setError] = useState<string | null>(id ? null : 'This link is missing its authorisation. Start connecting again from Claude.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.auth.oauth.getAuthorizationDetails(id).then(({ data, error: e }) => {
      if (e || !data) { setError('This request has expired or was already answered. Start connecting again from Claude.'); return }
      if ('redirect_url' in data) { location.href = data.redirect_url; return }   // already allowed before: straight back to Claude
      setDetails(data as Details)
    })
    supabase.from('memberships').select('role, companies(name)').limit(1).then(({ data }) => {
      const m = data?.[0] as { role: string; companies: { name: string } | null } | undefined
      if (m) setWho({ company: m.companies?.name ?? 'your company', money: m.role !== 'operative' })
    })
  }, [id])

  const decide = async (allow: boolean) => {
    setBusy(true)
    const { error: e } = allow ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id)
    if (e) { setBusy(false); setError('That didn’t go through — start connecting again from Claude.') }
    // on success Supabase sends the browser back to Claude
  }

  const app = details?.client.name || 'Claude'
  return (
    <main className="cover">
      <header className="cover-head">
        <div className="cover-mark" style={{ padding: '36px 16px 26px' }}><Wordmark /><div className="cover-sub">Connect {app}</div></div>
      </header>
      <div className="cover-body stack" style={{ maxWidth: 480 }}>
        {error ? <Plate kind="stop">{error}</Plate> : !details ? <div className="loading-bar" /> : (
          <>
            <h1 className="tab-title">Let {app} use Mastor?</h1>
            <p className="t-note" style={{ margin: 0 }}>{app} will use Mastor as <b>{details.user.email}</b>{who ? <> at <b>{who.company}</b></> : ''} — it sees exactly what you see in the app, nothing more.</p>
            <div className="panel stack">
              <h2 className="label">It can</h2>
              <ul className="consent-list">
                <li>Read your jobs, scope, VOs{who?.money === false ? '' : ', valuations and what’s owed'}, notes and site diary</li>
                <li>Look at site photos and hear voice notes and videos — each new clip counts as one of your company’s daily AI reads</li>
              </ul>
              <h2 className="label sec">It can’t</h2>
              <ul className="consent-list">
                <li>Issue a valuation or an invoice — that always stays in the app with a person</li>
                <li>Change anything yet: this first version only reads</li>
              </ul>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={() => decide(true)}>{busy ? 'Connecting…' : `Allow ${app}`}</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => decide(false)}>Don’t allow</button>
            <p className="hint" style={{ margin: 0 }}>You can disconnect any time in {app}’s settings.</p>
          </>
        )}
      </div>
    </main>
  )
}
