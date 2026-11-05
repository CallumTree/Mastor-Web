/** A new firm's first run: the jobs screen lists what's left to set up, and each step ticks itself off from the
 *  app's own data (a job made) or is set aside on purpose ("Just me for now"); sign-in errors say what to do. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import App from '../src/App'
import { wipeLocal } from '../src/lib/db'
import { plainAuth } from '../src/screens/Gate'

const click = (el: Element) => fireEvent.click(el)
afterAll(async () => { cleanup(); await wipeLocal() })

describe('first run', () => {
  it('lists the setup steps, ticks them off as they happen, and goes once they are done or hidden', async () => {
    render(<App />)
    const list = await screen.findByRole('region', { name: 'Getting set up' })
    expect(within(list).getByRole('heading').textContent).toBe('Getting set up · 0 of 4')
    // the four steps, each a row to tap; the ones that may not apply can be set aside
    for (const step of [/your company details/i, /your schedule of rates/i, /your team/i, /your first job, from the client’s pack/i])
      expect(within(list).getByRole('button', { name: step })).toBeTruthy()
    expect(within(list).getByRole('button', { name: 'We don’t use one' })).toBeTruthy()

    // a solo firm sets the team step aside; it counts as done
    click(within(list).getByRole('button', { name: 'Just me for now' }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Getting set up' })).getByRole('heading').textContent).toBe('Getting set up · 1 of 4'))

    // the first job step opens the client's pack reader
    click(within(screen.getByRole('region', { name: 'Getting set up' })).getByRole('button', { name: /your first job/i }))
    expect(await screen.findByRole('button', { name: /set it up by hand/i })).toBeTruthy()
    fireEvent.click(document.querySelector('.sheet-bg')!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())

    // hidden: gone, and stays gone
    click(within(screen.getByRole('region', { name: 'Getting set up' })).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Getting set up' })).toBeNull())
  })

  it('explains a month in Mastor from Settings, in six steps, without a support line until there is one', async () => {
    cleanup()
    render(<App />)
    click(await screen.findByRole('button', { name: 'Settings' }))
    click(await screen.findByRole('button', { name: 'How Mastor works' }))
    const guide = await screen.findByRole('dialog', { name: 'How Mastor works' })
    const steps = within(guide).getAllByRole('listitem')
    expect(steps.map(li => li.querySelector('.help-n')?.textContent)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI'])
    expect(within(guide).getByText(/Valuation week/)).toBeTruthy()
    expect(within(guide).queryByText(/Stuck\? Email/)).toBeNull()
  })

  it('says sign-in problems in plain words, with what to do next', () => {
    expect(plainAuth('Invalid login credentials')).toMatch(/don’t match an account.*I’m new/)
    expect(plainAuth('User already registered')).toMatch(/already an account with that email/)
    expect(plainAuth('For security purposes, you can only request this after 42 seconds.')).toMatch(/Wait a minute/)
    expect(plainAuth('Something new')).toBe('Something new')   // anything unknown is shown as it came, never hidden
  })
})
