/**
 * Team screen against a stand-in for the database's team functions (the SQL itself is exercised
 * separately): add someone, share the invite, change a role, remove, and what non-managers see.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'

type Row = { kind: 'member' | 'invite'; id: string; email: string; role: string; since: string; is_me: boolean }
let rows: Row[] = []
const rpc = vi.fn(async (fn: string, a: Record<string, string> = {}) => {
  if (fn === 'company_team') return { data: rows, error: null }
  if (fn === 'invite_member') {
    if (rows.some(r => r.email === a.p_email)) return { data: null, error: { message: 'They’re already on your team.' } }
    rows.push({ kind: 'invite', id: 'i' + rows.length, email: a.p_email, role: a.p_role, since: '2026-10-11T09:00:00Z', is_me: false }); return { data: 'i', error: null }
  }
  if (fn === 'cancel_invite') { rows = rows.filter(r => r.id !== a.p_id); return { data: null, error: null } }
  if (fn === 'set_member_role') { rows = rows.map(r => (r.id === a.p_user ? { ...r, role: a.p_role } : r)); return { data: null, error: null } }
  if (fn === 'remove_member') { rows = rows.filter(r => r.id !== a.p_user); return { data: null, error: null } }
  return { data: null, error: { message: 'unknown' } }
})
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: (fn: string, a?: Record<string, string>) => rpc(fn, a) }, authHeader: async () => ({}) }))
import { TeamSheet } from '../src/screens/Team'

afterEach(cleanup)
const me = (role: string): Row => ({ kind: 'member', id: 'u-me', email: 'callum@tree.co.uk', role, since: '2026-01-02T09:00:00Z', is_me: true })

describe('team', () => {
  it('owner adds a site manager, shares the invite, then changes a role and removes someone', async () => {
    rows = [me('owner'), { kind: 'member', id: 'u-2', email: 'dai@tree.co.uk', role: 'operative', since: '2026-03-01T09:00:00Z', is_me: false }]
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
    render(<TeamSheet company="Tree & Sons" onClose={() => {}} />)
    await screen.findByText('People · 2')
    expect(screen.getByText('You')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'site@tree.co.uk' } })
    fireEvent.click(screen.getByLabelText(/Site manager/))
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }))
    await screen.findByText('Added, not signed up yet · 1')
    expect(rpc).toHaveBeenCalledWith('invite_member', { p_email: 'site@tree.co.uk', p_role: 'site_manager' })
    // the invite message is ready to share straight away
    expect(screen.getByText(/added to Tree & Sons on Mastor as Site manager/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Share invite' }).at(-1)!)
    await screen.findByText(/Copied/)

    fireEvent.change(screen.getByLabelText('Role for dai@tree.co.uk'), { target: { value: 'qs' } })
    await waitFor(() => expect(rows.find(r => r.id === 'u-2')!.role).toBe('qs'))

    const dai = screen.getByText('dai@tree.co.uk').closest('.person') as HTMLElement
    fireEvent.click(within(dai).getByRole('button', { name: 'Remove…' }))
    fireEvent.click(within(dai).getByRole('button', { name: 'Remove from team' }))
    await screen.findByText('People · 1')
  })

  it('an operative sees the team but cannot change it', async () => {
    rows = [me('operative'), { kind: 'member', id: 'u-o', email: 'boss@tree.co.uk', role: 'owner', since: '2026-01-01T09:00:00Z', is_me: false }]
    render(<TeamSheet company="Tree & Sons" onClose={() => {}} />)
    await screen.findByText('People · 2')
    expect(screen.queryByLabelText('Their email')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove…' })).toBeNull()
    expect(screen.getByText(/Only an owner or director/)).toBeTruthy()
  })

  it('a database error is shown, not swallowed', async () => {
    rows = [me('owner')]
    render(<TeamSheet company="Tree & Sons" onClose={() => {}} />)
    await screen.findByText('People · 1')
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'callum@tree.co.uk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }))
    await screen.findByText('They’re already on your team.')
  })
})
