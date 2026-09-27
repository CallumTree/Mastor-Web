/**
 * Diary, end to end through the real screens: day note + labour persist, day pager, ⊕ capture,
 * video + photo capture, caption, raise VO from a photo (evidence attached), deleting the diary
 * photo leaves the VO's evidence intact.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// jsdom has no image decoding, so photos are stored as-is (the real app resizes them first)
vi.mock('../src/lib/photos', async orig => {
  const real = await orig<typeof import('../src/lib/photos')>()
  return { ...real, savePhoto: (f: File) => real.saveImageBlob(f) }
})
import App from '../src/App'
import { db } from '../src/lib/db'

const click = (el: Element) => fireEvent.click(el)
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
const pick = (input: Element, file: File) => fireEvent.change(input, { target: { files: [file] } })

beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))) })

describe('site diary', () => {
  it('note, labour, photos, video, mark-up link, raise VO, safe delete', async () => {
    render(<App />)
    await screen.findByText('MASTOR')
    click(screen.getByRole('button', { name: /new job/i }))
    fireEvent.change(screen.getByLabelText('Job name *'), { target: { value: 'Diary Close' } })
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Diary Close')

    // --- day note + labour
    nav('diary')
    await screen.findByText('Today')
    const note = screen.getByPlaceholderText(/what happened on site today/i)
    fireEvent.change(note, { target: { value: 'Stripped out kitchen, skip swapped' } }); fireEvent.blur(note)
    click(screen.getByRole('button', { name: /more operatives/i }))
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy())
    click(screen.getByRole('button', { name: /more operatives/i }))
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy())

    // --- video + photo into today
    const inputs = () => [...document.querySelectorAll('input[type=file]')] as HTMLInputElement[]
    pick(inputs().find(i => i.accept === 'video/*')!, new File(['v'], 'clip.mp4', { type: 'video/mp4' }))
    await screen.findByRole('button', { name: /open video/i })
    pick(inputs().find(i => i.accept === 'image/*')!, new File(['p'], 'joist.jpg', { type: 'image/jpeg' }))
    await screen.findByRole('button', { name: /open photo/i })
    expect(screen.getByText(/photos & video \(2\)/i)).toBeTruthy()

    // --- caption + raise VO from the photo
    click(screen.getByRole('button', { name: /open photo/i }))
    fireEvent.change(await screen.findByLabelText(/caption/i), { target: { value: 'Rotten joist under bath' } })
    click(screen.getByRole('button', { name: /raise vo from this photo/i }))
    const desc = await screen.findByLabelText(/extra work/i) as HTMLTextAreaElement
    expect(desc.value).toBe('Rotten joist under bath')          // pre-filled from the caption
    click(screen.getAllByRole('button', { name: /^log variation$/i }).at(-1)!)
    await waitFor(() => expect(document.querySelector('.sheet')).toBeNull())
    const [vo] = (await db.jobs()).length ? await db.variations((await db.jobs()).find(j => j.name === 'Diary Close')!.id) : []
    expect(vo.description).toBe('Rotten joist under bath')
    expect(vo.photoIds.length).toBe(1)
    await screen.findByText('VO')                                // badge on the diary photo

    // --- deleting the diary photo keeps the VO's evidence
    click(screen.getByRole('button', { name: /open photo/i }))
    click(await screen.findByRole('button', { name: /delete…/i }))
    click(screen.getByRole('button', { name: /delete this photo/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /open photo/i })).toBeNull())
    expect(await db.photo(vo.photoIds[0])).toBeTruthy()

    // --- day pager + recent days
    click(screen.getByRole('button', { name: /previous day/i }))
    await screen.findByText('Yesterday')
    expect(screen.getByText(/recent days/i)).toBeTruthy()

    // --- ⊕ capture → diary note goes to today's diary
    nav('scope')
    click(screen.getByRole('button', { name: 'Capture' }))
    click(await screen.findByRole('button', { name: /diary note/i }))
    await screen.findByText('Today')

    // --- survives a reload
    cleanup(); render(<App />)
    click(await screen.findByRole('button', { name: /open job/i }))
    nav('diary')
    expect(((await screen.findByPlaceholderText(/what happened on site today/i)) as HTMLTextAreaElement).value).toBe('Stripped out kitchen, skip swapped')
    expect(screen.getByText('2')).toBeTruthy()
  })
})
