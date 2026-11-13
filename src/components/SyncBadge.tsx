import { useEffect, useState } from 'react'
import { onSyncStatus, syncNow, type SyncStatus } from '../lib/sync'
import { supabase } from '../lib/supabase'
import { outbox, wipeLocal } from '../lib/db'

/** One line, only when it matters: no signal (N waiting), changes still waiting, or a problem (tap to retry). When all is
 *  well it says nothing; the status region stays in place so a change is still announced to screen readers. */
export function SyncBadge({ dark = true, wrap }: { dark?: boolean; wrap?: string }) {
  const [s, setS] = useState<SyncStatus>({ state: 'idle', pending: 0 })
  useEffect(() => onSyncStatus(setS), [])
  const worth = s.state === 'offline' || s.state === 'error' || (s.state === 'synced' && s.pending > 0)
  if (!worth) return <span role="status" aria-live="polite" className="sr-only" />
  const colour = s.state === 'error' ? (dark ? 'var(--red-on-dark)' : 'var(--red)') : s.state === 'offline' ? (dark ? 'var(--yellow)' : 'var(--ink)') : dark ? 'var(--shell-muted)' : 'var(--ink-muted)'
  const text =
    s.state === 'offline' ? `No signal · ${s.pending} saved on this phone, will sync` :
    s.state === 'error' ? 'Sync problem — tap to retry' : `${s.pending} waiting to sync`
  const badge = (
    <span role="status" aria-live="polite" style={{ color: colour }}>
      {s.state === 'error'
        ? <button className="linkish tap" style={{ color: colour }} onClick={() => syncNow()} title={s.message}>{text}</button>
        : text}
    </span>
  )
  return wrap ? <div className={wrap}>{badge}</div> : badge
}

/** Sign out — warns first if changes made on this device haven't reached the server yet. */
export function SignOutButton() {
  const [waiting, setWaiting] = useState<number | null>(null)
  const signOut = async () => {
    const n = await outbox.count()
    if (n && waiting === null) { setWaiting(n); return }
    await supabase.auth.signOut(); await wipeLocal(); location.reload()
  }
  return (
    <>
      <button className="btn btn-secondary" style={waiting !== null ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} onClick={signOut}>
        {waiting !== null ? 'Sign out anyway' : 'Sign out'}
      </button>
      {waiting !== null && <div className="flag">{waiting} change{waiting === 1 ? '' : 's'} not synced yet — signing out loses {waiting === 1 ? 'it' : 'them'}. Get signal first if you can.</div>}
    </>
  )
}
