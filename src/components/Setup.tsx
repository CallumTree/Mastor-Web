import { useEffect, useState } from 'react'
import { meta } from '../lib/db'
import { IconCheck, IconChevron } from './Icons'

/**
 * A new firm's first steps, on the jobs screen until they're done: the details every invoice needs, the schedule
 * of rates, the team, the first job. Each step ticks itself off from the app's own data (company details complete,
 * a rate book in, someone invited, a job made), so it's never a form to fill in twice; a step that doesn't apply can
 * be set aside ("Just me for now"), and the whole list can be hidden. Kept on this device (meta 'setup').
 */
export interface SetupStep { key: string; label: string; hint: string; done: boolean; onClick: () => void; skip?: string }
type SetupMeta = { hidden?: boolean; skipped?: string[]; team?: boolean }

export async function markSetup(patch: SetupMeta) {
  const cur = (await meta.get<SetupMeta>('setup')) ?? {}
  await meta.set('setup', { ...cur, ...patch, skipped: [...new Set([...(cur.skipped ?? []), ...(patch.skipped ?? [])])] })
}

export function SetupList({ steps }: { steps: SetupStep[] }) {
  const [m, setM] = useState<SetupMeta | null>(null)
  useEffect(() => { void meta.get<SetupMeta>('setup').then(x => setM(x ?? {})) }, [])
  if (!m || m.hidden) return null
  const live = steps.map(s => ({ ...s, done: s.done || (m.skipped ?? []).includes(s.key) || (s.key === 'team' && !!m.team) }))
  const left = live.filter(s => !s.done).length
  if (!left) return null
  const update = async (patch: SetupMeta) => { await markSetup(patch); setM((await meta.get<SetupMeta>('setup')) ?? {}) }
  return (
    <section className="setup" aria-label="Getting set up">
      <div className="setup-h">
        <h2 className="sec-h">Getting set up · {live.length - left} of {live.length}</h2>
        <button className="linkish" onClick={() => void update({ hidden: true })}>Hide</button>
      </div>
      <ol className="setup-list">
        {live.map(s => (
          <li key={s.key} className={'setup-row' + (s.done ? ' done' : '')}>
            <button className="setup-go" onClick={s.onClick}>
              <span className="setup-box" aria-hidden="true">{s.done && <IconCheck size={14} />}</span>
              <span className="setup-t"><span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span><b>{s.label}</b><small>{s.hint}</small></span>
              {!s.done && <span className="setup-chev" aria-hidden="true"><IconChevron size={16} /></span>}
            </button>
            {!s.done && s.skip && <button className="linkish setup-skip" onClick={() => void update({ skipped: [s.key] })}>{s.skip}</button>}
          </li>
        ))}
      </ol>
    </section>
  )
}
