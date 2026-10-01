/** Multi-property scheme: import → collapsed per property → expand → tick all → valuation grouped by property. */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from '../src/App'
const TSV = readFileSync(join(process.cwd(), 'tests/prescelly.tsv'), 'utf8')
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('parse-boq') ? new Response(JSON.stringify({ text: TSV }), { status: 200 }) : new Response('{}', { status: 404 }))) })

describe('multi-property scheme', () => {
  it('shows one collapsed block per property; tick all remaining; valuation grouped by property', async () => {
    render(<App />)
    await screen.findByText('MASTOR')
    click(screen.getByRole('button', { name: /new job/i }))
    type('Job name *', 'Prescelly Road')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Prescelly Road')
    nav('scope')
    click(await screen.findByRole('button', { name: /import boq/i }))
    fireEvent.change(document.querySelector('input[type=file][accept*=".pdf"]')!, { target: { files: [new File(['x'], 'p.csv', { type: 'text/csv' })] } })
    await screen.findByText(/3 properties: 1, 2, 13/)
    click(await screen.findByRole('button', { name: 'Import 7 items' }))

    // collapsed: property headers only, in number order, no lines showing
    const heads = await screen.findAllByRole('button', { name: /^property /i })
    expect(heads.map(h => h.getAttribute('aria-label'))).toEqual(['Property 1', 'Property 2', 'Property 13'])
    expect(screen.queryByText(/masonry paint/i)).toBeNull()

    // open No. 1 → workstream groups (collapsed), then lines inside
    click(heads[0])
    expect(screen.queryByText(/masonry paint/i)).toBeNull()
    click(screen.getByRole('button', { name: 'No. 1 PPR Paint' }))
    expect(screen.getAllByText(/masonry paint/i).length).toBe(1)
    expect(screen.getByRole('button', { name: 'No. 1 Scaffold' })).toBeTruthy()

    // tick all remaining in No. 1 → VAL-001, 100%
    click(screen.getByRole('button', { name: /tick all remaining \(3\)/i }))
    click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(screen.getAllByText('100%').length).toBeGreaterThan(0))   // property header (+ open group)
    expect(screen.getAllByText('VAL-001').length).toBe(2)                                // the open PPR Paint group's lines

    // valuation shows the lines under a "No. 1" heading
    nav('vals')
    await screen.findByText('No. 1')
    expect(screen.getAllByRole('button', { name: /remove from valuation/i }).length).toBe(3)

    // clear unclaimed lines (to redo an import) keeps the claimed ones
    nav('scope')
    click(await screen.findByRole('button', { name: /clear unclaimed lines/i }))
    click(screen.getByRole('button', { name: 'Remove 4' }))
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^property /i }).length).toBe(0))   // only No. 1 left → single-property layout
    expect(screen.getByText('3 items')).toBeTruthy()
  })
})
