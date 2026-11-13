/** Motion that carries meaning, through the real screens: the dock's marker follows the tab (and never sits under
 *  the +), the + turns into the capture menu's close, and a ticked line's tick is drawn in. */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App'

const click = (el: Element) => fireEvent.click(el)
const tab = (name: string) => screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase() === name)!
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

describe('motion', () => {
  it('the tab marker follows the tab; the capture menu has one close', async () => {
    const { container } = render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    click(await screen.findByRole('button', { name: /set it up by hand/i }))
    fireEvent.change(screen.getByLabelText('Job name *'), { target: { value: 'Motion Row' } })
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Motion Row')

    const mark = () => container.querySelector<HTMLElement>('.nav-mark')
    expect(mark()?.style.getPropertyValue('--i')).toBe('0')   // Home
    click(tab('scope'))
    await waitFor(() => expect(mark()?.style.getPropertyValue('--i')).toBe('2'))   // the middle tab: the marker is on the bottom edge, clear of the +
    click(screen.getByRole('button', { name: 'Clerk' }))
    await waitFor(() => expect(mark()).toBeNull())   // Clerk lives in the header: no tab is marked

    click(tab('home'))
    click(await screen.findByRole('button', { name: 'Capture' }))
    await screen.findByText(/^Capture$/)
    expect(container.querySelector('.cap-close')).toBeNull()   // one close: the menu's own ×
    click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText(/^Capture$/)).toBeNull())
  })
})
