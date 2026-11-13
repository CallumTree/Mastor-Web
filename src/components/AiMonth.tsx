import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { figs } from './Figs'

/** This month's AI for the firm, as the database meters it (supabase/schema.sql v8, ai_month). */
export interface AiMonthData {
  plan: string; allowance: number; reads_allowed: number | null; economy: number
  used: number; reads: number; site_reads: number; site_credits: number
  questions_today: number; questions_allowed: number
}

/** The plans as people see them. The ids (mercury, minerva, jupiter) are the database's and never shown. */
export const PLAN_NAME: Record<string, string> = { pilot: 'Founding pilot', mercury: 'Column I', minerva: 'Arch II', jupiter: 'Dome III' }

/** What the meter says. Never a credit or a price: a share of the allowance, and site days left once there's a usual rate to go on. */
export function aiMonthLines(d: AiMonthData) {
  const plan = PLAN_NAME[d.plan] ?? d.plan
  // a plan with no AI on it (or none set yet) says so; it's never "100% used" before anything was used
  const none = { plan, pct: 0, figure: 'No allowance', lines: ['AI reading isn’t on this plan. Everything else works as normal; lines can be entered by hand.'] }
  if (d.reads_allowed != null) {
    if (!d.reads_allowed) return none
    const pct = d.reads_allowed ? Math.min(100, Math.round(d.reads / d.reads_allowed * 100)) : 100
    return { plan, pct, figure: `${d.reads} of ${d.reads_allowed} reads`, lines: [d.reads >= d.reads_allowed ? 'This month’s document reads are used. They start again on the 1st; you can still enter lines by hand.' : 'Document reads this month: the client’s pack and scanned schedules.'] }
  }
  const used = Number(d.used) || 0, allowance = Number(d.allowance) || 0
  if (!allowance) return none
  const pct = allowance ? Math.min(100, Math.round(used / allowance * 100)) : 100
  const lines: string[] = []
  if (used >= allowance) lines.push(d.economy > 0 ? 'This month’s allowance is used. Site captures are still read, more lightly, until the 1st; other AI reading pauses.' : 'This month’s allowance is used. AI reading pauses until the 1st.')
  else if (d.site_reads >= 3) {
    const perDay = Number(d.site_credits) / d.site_reads
    const days = perDay > 0 ? Math.floor((allowance - used) / perDay) : null
    if (days != null) lines.push(`About ${days} site day${days === 1 ? '' : 's'} left at your usual rate.`)
  }
  if (d.questions_allowed > 0) lines.push(`Everyday Clerk questions don’t count: ${d.questions_today} of ${d.questions_allowed} asked today.`)
  return { plan, pct, figure: `${pct}% used`, lines }
}

/** Settings → AI this month. Shows nothing until the database meters AI (v8), or while offline. */
export function AiMonth() {
  const [d, setD] = useState<AiMonthData | null>(null)
  useEffect(() => {
    let live = true
    supabase.rpc('ai_month').then(({ data, error }) => { if (live && !error && data) setD(data as AiMonthData) }, () => {})
    return () => { live = false }
  }, [])
  if (!d) return null
  const v = aiMonthLines(d)
  return (
    <>
      <h3 className="label bracket sec">AI this month</h3>
      <div className="ai-month">
        <div className="row"><span className="grow">{v.plan}</span><b>{figs(v.figure)}</b></div>
        <div className="ai-meter" role="meter" aria-label="AI allowance used this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}><i style={{ width: `${v.pct}%` }} /></div>
      </div>
      {v.lines[0] && <div className="hint">{v.lines[0]}</div>}
    </>
  )
}
