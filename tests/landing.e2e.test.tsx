/** The front page: the register shows the real count, the button names the next place, and claiming makes it yours. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Landing } from '../src/landing/Landing'

const sent: any[] = []
beforeEach(() => {
  sent.length = 0
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init || init.method !== 'POST') return new Response(JSON.stringify({ places: 50, taken: 13 }))
    const b = JSON.parse(String(init.body)); sent.push(b)
    return new Response(JSON.stringify({ ok: true, place: 14, already: false, taken: 14 }))
  }))
})

describe('front page', () => {
  it('claims the next founding place', async () => {
    const { container } = render(<Landing />)
    await screen.findByText('13 of 50 taken · 37 left')
    expect(container.querySelector('.tile.next')?.textContent).toBe('XIV')
    expect(container.querySelectorAll('.tile.taken').length).toBe(13)
    const claim = screen.getAllByRole('button', { name: /Claim place XIV/ })[0]

    fireEvent.click(claim)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Add your name and your firm and an email address that works/)
    expect(sent.length).toBe(0)

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dai Jones' } })
    fireEvent.change(screen.getByLabelText('Firm'), { target: { value: 'Jones Building' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dai@jones.co.uk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Responsive and voids' }))
    fireEvent.click(claim)
    await screen.findByText('Place XIV is yours.')
    expect(sent[0]).toMatchObject({ name: 'Dai Jones', firm: 'Jones Building', email: 'dai@jones.co.uk', work: 'Responsive and voids', website: '' })
    await waitFor(() => expect(container.querySelector('.tile.yours')?.textContent).toBe('XIV'))
    expect(container.querySelector('.tile.next')?.textContent).toBe('XV')
    expect(screen.getByText('14 of 50 taken · 36 left')).toBeTruthy()
  })

  it('never guesses the count when it can’t be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    const { container } = render(<Landing />)
    await new Promise(r => setTimeout(r, 20))
    expect(screen.getByText('50 places, I to L')).toBeTruthy()
    expect(container.querySelector('.tile.next')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Claim a founding place' }).length).toBeGreaterThan(0)
  })
})
