/**
 * The company's team: members and open invites, managed through database functions
 * (supabase/schema.sql v5) so emails and roles are only ever visible to the company's own members.
 */
import { supabase } from './supabase'

export type Role = 'owner' | 'director' | 'qs' | 'site_manager' | 'operative'
export const ROLES: { role: Role; label: string; hint: string }[] = [
  { role: 'owner', label: 'Owner', hint: 'Runs the account. Can add and remove anyone.' },
  { role: 'director', label: 'Director', hint: 'Can add and remove people.' },
  { role: 'qs', label: 'QS', hint: 'Valuations, variations and invoices.' },
  { role: 'site_manager', label: 'Site manager', hint: 'Diary, photos and variations on site.' },
  { role: 'operative', label: 'Operative', hint: 'Logs work and photos.' },
]
export const roleLabel = (r: string) => ROLES.find(x => x.role === r)?.label ?? r
export const canManage = (r?: string) => r === 'owner' || r === 'director'

export interface TeamRow { kind: 'member' | 'invite'; id: string; email: string; role: Role; since: string; is_me: boolean }

const call = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(/could not find the function|PGRST202/i.test(error.message) ? 'The team needs the latest database update (supabase/schema.sql) before it can be used.' : error.message)
  return data as T
}
export const team = {
  list: () => call<TeamRow[]>('company_team').then(r => r ?? []),
  invite: (email: string, role: Role) => call<string>('invite_member', { p_email: email, p_role: role }),
  cancel: (id: string) => call<void>('cancel_invite', { p_id: id }),
  setRole: (userId: string, role: Role) => call<void>('set_member_role', { p_user: userId, p_role: role }),
  remove: (userId: string) => call<void>('remove_member', { p_user: userId }),
}

/** On sign-in with no company: join one that invited this email, if any. Never fails sign-in. */
export async function acceptInvites(): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_invites')
  return !error && !!data
}

export const inviteMessage = (company: string, email: string, role: string, link: string) =>
  `You’ve been added to ${company || 'our company'} on Mastor as ${roleLabel(role)}.\n\nSign up at ${link} using ${email}. Once you’ve confirmed your email you’ll see our jobs.`
