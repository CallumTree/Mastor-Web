import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Sheet } from '../src/components/Ui'

const backdrop = () => fireEvent.click(document.querySelector('.sheet-bg')!)
afterEach(cleanup)

describe('bottom sheet keeps your work', () => {
  it('closes straight away when nothing has been entered', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} label="Log variation"><input aria-label="What" /></Sheet>)
    expect(screen.getByRole('dialog', { name: 'Log variation' })).toBeTruthy()
    backdrop()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before throwing away typed work — backdrop, ✕ and Esc alike', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose}><input aria-label="What" /></Sheet>)
    fireEvent.input(screen.getByLabelText('What'), { target: { value: 'Rotten sill' } })
    backdrop()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(/discard what you’ve entered/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText(/discard what you’ve entered/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })   // Esc backs out of the question first
    expect(screen.queryByText(/discard what you’ve entered/i)).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a sheet that saves itself on close never asks', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} keepsWork><input aria-label="Caption" /></Sheet>)
    fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'Gable' } })
    backdrop()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cannot be dismissed while locked (file being read)', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} locked><p>Reading…</p></Sheet>)
    backdrop(); fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})
