import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { ProblemBar, ProblemBoundary, describeProblem } from '../src/components/Problem'
import { LogVariation } from '../src/screens/Variations'

afterEach(cleanup)

const reject = (reason: unknown) => act(() => {
  const ev = new Event('unhandledrejection') as PromiseRejectionEvent
  Object.defineProperty(ev, 'reason', { value: reason })
  window.dispatchEvent(ev)
})

describe('when something fails, the person is told', () => {
  it('says a full phone plainly, stays quiet for a closed share sheet, and names a lost signal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProblemBar />)
    await reject(new DOMException('cancelled', 'AbortError'))
    expect(screen.queryByRole('alert')).toBeNull()
    await reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
    expect(screen.getByRole('alert').textContent).toMatch(/out of storage space, so that wasn’t saved/)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(describeProblem(new TypeError('Failed to fetch'))).toMatch(/No signal/)
    expect(describeProblem(new Error('boom'))).toMatch(/That didn’t work \(boom\)/)
  })

  it('a screen that crashes shows a reload sign, not a blank app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = () => { throw new Error('bad row') }
    render(<ProblemBoundary><Broken /></ProblemBoundary>)
    expect(screen.getByRole('heading', { name: 'This screen hit a problem' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload Mastor' })).toBeTruthy()
    expect(screen.getByText('bad row')).toBeTruthy()
  })
})

describe('logging a VO', () => {
  it('a double tap on Log variation logs it once', async () => {
    let finish: () => void = () => {}
    const onSave = vi.fn(() => new Promise<void>(r => { finish = r }))
    render(<LogVariation onSave={onSave} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/What's the extra work/), { target: { value: 'Rotten joists under bath' } })
    const log = screen.getByRole('button', { name: 'Log variation' })
    fireEvent.click(log); fireEvent.click(log); fireEvent.click(log)
    expect(onSave).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await waitFor(() => expect((log as HTMLButtonElement).disabled).toBe(false))
  })

  it('each photo has its own labelled Remove button', () => {
    render(<LogVariation onSave={() => {}} onClose={() => {}} initial={{ photoIds: ['p1', 'p2'] }} />)
    const remove = screen.getAllByRole('button', { name: /^Remove photo/ })
    expect(remove.map(b => b.getAttribute('aria-label'))).toEqual(['Remove photo 1', 'Remove photo 2'])
    fireEvent.click(remove[0])
    expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(1)
  })
})
