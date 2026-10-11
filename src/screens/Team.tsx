import { useEffect, useState } from 'react'
import { ConfirmDelete, Field, Sheet } from '../components/Ui'
import { Plate } from '../components/Sign'
import { ROLES, canManage, inviteMessage, roleLabel, team, type Role, type TeamRow } from '../lib/team'
import { ukDate } from '../lib/format'
import { meta } from '../lib/db'

/**
 * Team: who's in the company, who's been added but hasn't signed up yet, and adding someone.
 * Adding someone records their email and role; when they sign up with that email they join.
 * The app sends no email — you share the invite yourself (text, WhatsApp, email).
 */
export function TeamSheet({ company, onClose }: { company: string; onClose: () => void }) {
  const [rows, setRows] = useState<TeamRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('site_manager')
  const [busy, setBusy] = useState(false)
  const [shareFor, setShareFor] = useState<TeamRow | null>(null)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState(company)
  useEffect(() => { if (!company) meta.get<{ name: string }>('company').then(c => { if (c?.name) setName(c.name) }) }, [company])
  const load = async () => { try { setRows(await team.list()); setErr(null) } catch (e) { setErr((e as Error).message) } }
  useEffect(() => { void load() }, [])
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }

  const me = rows?.find(r => r.is_me)
  const manage = canManage(me?.role)
  const members = rows?.filter(r => r.kind === 'member') ?? []
  const invites = rows?.filter(r => r.kind === 'invite') ?? []
  const link = location.origin
  const msg = shareFor ? inviteMessage(name, shareFor.email, shareFor.role, link) : ''
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Join us on Mastor', text: msg }); return } catch { /* cancelled — fall through to copy */ } }
    try { await navigator.clipboard.writeText(msg); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <Sheet onClose={onClose} label="Team">
      <div className="stack">
        <div className="label bracket">Team</div>
        <div className="muted" style={{ fontSize: 14 }}>Everyone on the team sees the same jobs.</div>
        {err && <div role="alert"><Plate kind="stop">{err}</Plate></div>}
        {!rows && !err && <div className="loading-bar" role="status" aria-label="Loading team" />}

        {rows && (
          <>
            <h2 className="sec-h">People · {members.length}</h2>
            <div className="panel" style={{ padding: 0 }}>
              {members.map(m => (
                <div key={m.id} className="person">
                  <div className="grow"><b>{m.email}</b>{m.is_me && <small>You</small>}<small>Joined {ukDate(Date.parse(m.since))}</small></div>
                  {manage && !m.is_me ? (
                    <div className="person-ctl">
                      <label className="field"><span className="sr-only">Role for {m.email}</span>
                        <select value={m.role} disabled={busy} onChange={e => act(() => team.setRole(m.id, e.target.value as Role))}>
                          {ROLES.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
                        </select>
                      </label>
                      <ConfirmDelete label="Remove…" confirmLabel="Remove from team" note={`${m.email} will lose access to your jobs.`} onConfirm={() => act(() => team.remove(m.id))} />
                    </div>
                  ) : <span className="badge b-slate">{roleLabel(m.role)}</span>}
                </div>
              ))}
            </div>

            {invites.length > 0 && (
              <>
                <h2 className="sec-h">Added, not signed up yet · {invites.length}</h2>
                <div className="panel" style={{ padding: 0 }}>
                  {invites.map(i => (
                    <div key={i.id} className="person">
                      <div className="grow"><b>{i.email}</b><small>{roleLabel(i.role)} · added {ukDate(Date.parse(i.since))}</small></div>
                      <div className="person-ctl">
                        <button className="btn btn-secondary" onClick={() => { setShareFor(i); setCopied(false) }}>Share invite</button>
                        {manage && <ConfirmDelete label="Cancel…" confirmLabel="Cancel invite" onConfirm={() => act(() => team.cancel(i.id))} />}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {shareFor && (
              <div className="panel stack" aria-live="polite">
                <b>Send this to {shareFor.email}</b>
                <p className="share-msg">{msg}</p>
                <div className="row">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShareFor(null)}>Done</button>
                  <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={share}>Share invite</button>
                </div>
                {copied && <div role="status"><Plate kind="ok">Copied — paste it into a text or email</Plate></div>}
              </div>
            )}

            {manage ? (
              <form className="panel stack" onSubmit={e => {
                e.preventDefault()
                const em = email.trim()
                void act(async () => {
                  await team.invite(em, role)
                  setEmail('')
                  const fresh = await team.list(); setRows(fresh)
                  setShareFor(fresh.find(r => r.kind === 'invite' && r.email.toLowerCase() === em.toLowerCase()) ?? null); setCopied(false)
                })
              }}>
                <b>Add someone</b>
                <Field label="Their email"><input type="email" inputMode="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.co.uk" /></Field>
                <fieldset className="roles">
                  <legend>Role</legend>
                  {ROLES.map(r => (
                    <label key={r.role} className={'role' + (role === r.role ? ' on' : '')}>
                      <input type="radio" name="role" value={r.role} checked={role === r.role} onChange={() => setRole(r.role)} />
                      <span><b>{r.label}</b><small>{r.hint}</small></span>
                    </label>
                  ))}
                </fieldset>
                <button className="btn btn-primary" type="submit" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}>Add to team</button>
                <div className="muted" style={{ fontSize: 13 }}>They join when they sign up with this email and confirm it. Mastor doesn’t send the invite — you share it.</div>
              </form>
            ) : me && <div className="muted" style={{ fontSize: 14 }}>Only an owner or director can add or remove people.</div>}
          </>
        )}
      </div>
    </Sheet>
  )
}
