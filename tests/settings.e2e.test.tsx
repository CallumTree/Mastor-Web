import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { SettingsSheet } from '../src/screens/Settings'

afterEach(cleanup)
const props = () => ({ onSave: vi.fn(), onClose: vi.fn(), onBackup: vi.fn(async () => {}), onRestore: vi.fn(async () => 3), onPlayIntro: vi.fn() })

describe('settings: this device', () => {
  it('holds backup, restore, the opening titles and sign out (moved off the cover banner)', async () => {
    const p = props(); render(<SettingsSheet {...p} />)
    for (const name of ['Back up', 'Sign out', '▶ Play the opening titles']) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByText('Restore…')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back up' }))
    await screen.findByText('Backup saved to your Downloads')
    fireEvent.click(screen.getByRole('button', { name: '▶ Play the opening titles' }))
    expect(p.onPlayIntro).toHaveBeenCalled()
  })

  it('restoring a file reports what came back and does not count as unsaved typing', async () => {
    const p = props(); render(<SettingsSheet {...p} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    const file = new File(['{"jobs":[]}'], 'mastor-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(p.onRestore).toHaveBeenCalledWith('{"jobs":[]}'))
    await screen.findByText('Restored 3 jobs')
    fireEvent.click(document.querySelector('.sheet-bg')!)
    expect(p.onClose).toHaveBeenCalled()       // no "discard?" question for a file pick
  })
})
