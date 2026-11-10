/** Fewer waits: a voice note records as it opens; a photo taken on Scope stays on Scope, saying where it went. */
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
// the test browser can't decode a photo: store it as it comes, as the diary test does
vi.mock('../src/lib/photos', async orig => {
  const real = await orig<typeof import('../src/lib/photos')>()
  return { ...real, savePhoto: (f: File) => real.saveImageBlob(f) }
})
import App from '../src/App'
import { db, wipeLocal } from '../src/lib/db'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
  // a microphone that works: getUserMedia and a recorder that records nothing
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } })
  vi.stubGlobal('MediaRecorder', class { state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: unknown = null; onstop: (() => void) | null = null; start() { this.state = 'recording' } stop() { this.state = 'inactive'; this.onstop?.() } })
})
afterAll(async () => { cleanup(); vi.unstubAllGlobals(); await wipeLocal() })

describe('fewer waits', () => {
  it('voice records on open; a photo from Scope stays on Scope with Undo', async () => {
    await db.putJob({ id: 'jw', name: 'Wait Street', client: 'Example Council', address: '', contractRef: '', poNumber: 'PO1', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 })
    await db.putScope({ id: 's1', jobId: 'jw', code: '4360BD', description: 'Masonry paint', room: 'Front', qty: 10, unit: 'SM', rate: 5, valuationId: null, order: 1, createdAt: 1 })
    render(<App />)
    click(await screen.findByRole('button', { name: /Wait Street/ }))
    nav('scope')
    await screen.findByText('Masonry paint')

    // + → Voice note: already recording, no Start tap
    click(screen.getByRole('button', { name: 'Capture' }))
    click(await screen.findByRole('button', { name: /Voice note/ }))
    expect(await screen.findByRole('button', { name: 'Stop and save' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Start recording/ })).toBeNull()
    click(screen.getByRole('button', { name: 'Discard' }))

    // + → Photo from Scope: saved to today, still on Scope, with Undo
    fireEvent.click(document.querySelector('.sheet-bg')!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    click(screen.getByRole('button', { name: 'Capture' }))
    const input = [...document.querySelectorAll('.capture-sheet input[type=file]')].find(i => (i as HTMLInputElement).accept === 'image/*')!
    fireEvent.change(input, { target: { files: [new File(['p'], 'gutter.jpg', { type: 'image/jpeg' })] } })
    expect(await screen.findByText('Photo added to today’s diary')).toBeTruthy()
    expect(screen.getByText('Masonry paint')).toBeTruthy()                         // still on Scope
    await waitFor(async () => expect((await db.diary('jw')).filter(d => d.type === 'photo').length).toBe(1))
    click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await db.diary('jw')).filter(d => d.type === 'photo').length).toBe(0))
  })
})
