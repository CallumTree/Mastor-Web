/** Job documents: a RAMS PDF added on the job home, listed by kind; operatives can open but not remove. */
import { describe, it, expect, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import App from '../src/App'
import { db, meta, wipeLocal } from '../src/lib/db'
import type { Job } from '../src/lib/types'

afterAll(async () => { cleanup(); await wipeLocal() })
const click = (el: Element) => fireEvent.click(el)

describe('job documents', () => {
  it('add a RAMS to the job; operatives see it but cannot remove it', async () => {
    const job: Job = { id: 'jdoc', name: '12 Castle Way', client: 'PCC', address: '', contractRef: 'CW12', poNumber: 'PO2', contractValue: 0, uplift1: 0, uplift2: 0, workType: 'PPR', status: 'Active', photoId: null, createdAt: 1 }
    await db.putJob(job)
    render(<App />)
    click(await screen.findByRole('button', { name: /12 Castle Way/ }))
    await screen.findByText(/RAMS, programme, certificates, drawings/)
    const input = screen.getByText('+ Add document').querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.4 rams'], 'CW12 RAMS rev B.pdf', { type: 'application/pdf' })] } })
    await screen.findByText('Add document')
    expect(screen.getByRole('button', { name: 'RAMS' }).getAttribute('aria-pressed')).toBe('true')   // guessed from the file name
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('CW12 RAMS rev B')
    click(screen.getByRole('button', { name: 'Add to job' }))
    await screen.findByText('CW12 RAMS rev B')
    expect(screen.getByText('Documents · 1')).toBeTruthy()
    const [d] = await db.list('docs', 'jdoc')
    expect(d.kind).toBe('RAMS'); expect(d.type).toBe('application/pdf')
    expect(screen.getByRole('button', { name: 'Remove CW12 RAMS rev B' })).toBeTruthy()

    // an operative on the same device: can see and open it, not remove it
    await meta.set('company', { id: 'c', name: 'Tree & Sons', user: 'u', role: 'operative' })
    cleanup(); render(<App />)
    await screen.findByRole('heading', { name: '12 Castle Way' })   // still in the job after the reload
    await screen.findByText('CW12 RAMS rev B')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove CW12 RAMS rev B' })).toBeNull())
  })
})
