import { useState } from 'react'
import { Sheet } from './Ui'

/**
 * The ⋯ options button every tab carries, top-right. Small, consistent, findable.
 * Dangerous actions ask once more before running.
 */
export interface MenuAction { label: string; hint?: string; danger?: boolean; confirm?: string; disabled?: boolean; onClick: () => void }

export function TabMenu({ title, actions }: { title: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState<MenuAction | null>(null)
  const run = (a: MenuAction) => { if (a.confirm && confirming !== a) { setConfirming(a); return } setOpen(false); setConfirming(null); a.onClick() }
  return (
    <>
      <button className="tabmenu-btn" aria-label={`${title} options`} onClick={() => { setConfirming(null); setOpen(true) }}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="19" cy="12" r="1.7" fill="currentColor" /></svg>
      </button>
      {open && (
        <Sheet onClose={() => { setOpen(false); setConfirming(null) }}>
          <div className="label bracket" style={{ marginBottom: 8 }}>{title} options</div>
          <div className="panel" style={{ padding: 0 }}>
            {actions.map((a, i) => (
              <div key={a.label} style={{ borderTop: i ? '1px solid var(--ink-line)' : 'none' }}>
                <button disabled={a.disabled} onClick={() => run(a)} className="tabmenu-item" style={{ color: a.danger ? 'var(--red)' : 'var(--ink)', opacity: a.disabled ? .45 : 1 }}>
                  <span style={{ fontWeight: 600 }}>{a.label}</span>
                  {a.hint && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{a.hint}</span>}
                </button>
                {confirming === a && (
                  <div style={{ padding: '0 14px 12px' }}>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>{a.confirm}</div>
                    <div className="row">
                      <button className="btn btn-secondary" style={{ flex: 1, minHeight: 42 }} onClick={() => setConfirming(null)}>Cancel</button>
                      <button className="btn" style={{ flex: 1, minHeight: 42, background: 'var(--red)', color: '#fff' }} onClick={() => run(a)}>Yes, {a.label.toLowerCase()}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}
