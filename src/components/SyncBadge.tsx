import { useEffect, useState } from 'react'
import { onSyncStatus, syncNow, type SyncStatus } from '../lib/sync'
import { supabase } from '../lib/supabase'
import { outbox, wipeLocal } from '../lib/db'

/** One line: where your data is. Synced / syncing / no signal (N waiting) / problem. Plus sign out. */
export function SyncBadge({ dark = true }: { dark?: boolean }) {
  const [s, setS] = useState<SyncStatus>({ state: 'idle', pending: 0 })
  const [confirm, setConfirm] = useState<number | null>(null)
  useEffect(() => onSyncStatus(setS), [])
  const colour = s.state === 'error' ? '#FCA5A5' : s.state === 'offline' ? 'var(--copper-light)' : dark ? 'var(--cream-muted)' : 'var(--ink-muted)'
  const text =
    s.state === 'synced' ? `Synced ✓${s.pending ? ` · ${s.pending} waiting` : ''}` :
    s.state === 'syncing' ? 'Syncing…' :
    s.state === 'offline' ? `No signal — ${s.pending} change${s.pending === 1 ? '' : 's'} saved on phone, will sync` :
    s.state === 'error' ? 'Sync problem — tap to retry' : 'Saved on this device'
  const signOut = async () => {
    const waiting = await outbox.count()
    if (waiting && confirm === null) { setConfirm(waiting); return }
    await supabase.auth.signOut(); await wipeLocal(); location.reload()
  }
  return (
    <span style={{ color: colour }}>
      <button className="linkish" style={{ color: colour, textDecoration: 'none' }} onClick={() => syncNow()} title={s.message}>{text}</button>
      {' · '}<button className="linkish" onClick={signOut}>Sign out</button>
      {confirm !== null && <div style={{ color: '#FCA5A5', marginTop: 4 }}>{confirm} change{confirm === 1 ? '' : 's'} not synced yet — they’ll be lost. Tap Sign out again to confirm, or get signal first.</div>}
    </span>
  )
}
