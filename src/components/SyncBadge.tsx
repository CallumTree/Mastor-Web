import { useEffect, useState } from 'react'
import { onSyncStatus, syncNow, type SyncStatus } from '../lib/sync'
import { supabase } from '../lib/supabase'
import { outbox, wipeLocal } from '../lib/db'

/** One line: where your data is. Synced / syncing / no signal (N waiting) / problem (tap to retry). Announced to screen readers. */
export function SyncBadge({ dark = true }: { dark?: boolean }) {
  const [s, setS] = useState<SyncStatus>({ state: 'idle', pending: 0 })
  useEffect(() => onSyncStatus(setS), [])
  const colour = s.state === 'error' ? '#FCA5A5' : s.state === 'offline' ? 'var(--copper-light)' : dark ? 'var(--cream-muted)' : 'var(--ink-muted)'
  const text =
    s.state === 'synced' ? `Synced ✓${s.pending ? ` · ${s.pending} waiting` : ''}` :
    s.state === 'syncing' ? 'Syncing…' :
    s.state === 'offline' ? `No signal — ${s.pending} change${s.pending === 1 ? '' : 's'} saved on phone, will sync` :
    s.state === 'error' ? 'Sync problem — tap to retry' : 'Saved on this device'
  return (
    <span role="status" aria-live="polite" style={{ color: colour }}>
      {s.state === 'error'
        ? <button className="linkish tap" style={{ color: colour }} onClick={() => syncNow()} title={s.message}>{text}</button>
        : text}
    </span>
  )
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
