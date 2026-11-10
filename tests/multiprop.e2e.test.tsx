/** Multi-property scheme: import → collapsed per property → expand → tick all → valuation grouped by property. */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from '../src/App'
import { db } from '../src/lib/db'
const TSV = readFileSync(join(process.cwd(), 'tests/boq-trades.tsv'), 'utf8')
const click = (el: Element) => fireEvent.click(el)
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const nav = (name: string) => click(screen.getAllByRole('button').find(b => b.closest('nav') && b.textContent?.toLowerCase().includes(name))!)
beforeAll(() => { vi.stubGlobal('fetch', vi.fn(async (u: string) => String(u).includes('parse-boq') ? new Response(JSON.stringify({ text: TSV }), { status: 200 }) : new Response('{}', { status: 404 }))) })

describe('multi-property scheme', () => {
  it('shows one collapsed block per property; tick all remaining; valuation grouped by property', async () => {
    render(<App />)
    await screen.findByRole('img', { name: 'MASTOR' })
    click(screen.getByRole('button', { name: /new job/i }))
    click(await screen.findByRole('button', { name: /set it up by hand/i }))   // no client pack in this test: the job is set up by hand
    type('Job name *', 'Example Road')
    click(screen.getByRole('button', { name: 'Create job' }))
    await screen.findByText('Example Road')
    nav('scope')
    click(await screen.findByRole('button', { name: 'Import' })); click(within(document.querySelector('.sheet') as HTMLElement).getByRole('button', { name: /^Scope/ }))
    fireEvent.change(document.querySelector('input[type=file][accept*=".pdf"]')!, { target: { files: [new File(['x'], 'p.csv', { type: 'text/csv' })] } })
    await screen.findByText(/3 properties: 1, 2, 13/)
    // review is grouped by house number, collapsed; open one → its workstream groups
    const rev = screen.getAllByRole('button', { name: /^review property /i })
    expect(rev.map(b => b.getAttribute('aria-label'))).toEqual(['Review property 1', 'Review property 2', 'Review property 13'])
    expect(screen.queryByText(/masonry paint/i)).toBeNull()
    click(rev[2])
    expect(screen.getByText('Comp Doors')).toBeTruthy()
    expect(screen.getByText(/renew external composite door/i)).toBeTruthy()
    click(await screen.findByRole('button', { name: 'Import 7 items' }))

    // collapsed: property headers only, in number order, no lines showing
    const heads = await screen.findAllByRole('button', { name: /^property /i })
    expect(heads.map(h => h.getAttribute('aria-label'))).toEqual(['Property 1', 'Property 2', 'Property 13'])
    expect(screen.queryByText(/masonry paint/i)).toBeNull()

    // one tap on No. 1 → a sheet with every line, already open, under its trades (no second tap per trade)
    click(heads[0])
    const sheet = await screen.findByRole('dialog', { name: 'No. 1' })
    expect(within(sheet).getAllByText(/masonry paint/i).length).toBe(1)
    expect(within(sheet).getByRole('region', { name: 'PPR Paint' })).toBeTruthy()
    expect(within(sheet).getByRole('region', { name: 'Scaffold' })).toBeTruthy()
    expect(within(sheet).queryByText(/^Property$/)).toBeNull()                        // a whole-house line doesn't say "Property"

    // tick all remaining in No. 1 → VAL I, 100%
    // it acts on the tap (no "are you sure?"); Undo takes exactly those lines back
    click(within(sheet).getByRole('button', { name: /tick all remaining lines \(3\)/i }))
    await waitFor(() => expect(screen.getAllByText('100%').length).toBeGreaterThan(0))   // the sheet's bar and the house row
    expect(screen.getByText('3 lines ticked')).toBeTruthy()
    click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await db.scope((await db.jobs())[0].id)).filter(i => i.property === '1' && i.valuationId).length).toBe(0))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'No. 1' })).queryAllByText('VAL I').length).toBe(0))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    click(within(screen.getByRole('dialog', { name: 'No. 1' })).getByRole('button', { name: /tick all remaining lines \(3\)/i }))
    await waitFor(() => expect(screen.getAllByText('100%').length).toBeGreaterThan(0))
    expect(within(screen.getByRole('dialog', { name: 'No. 1' })).getAllByText('VAL I').length).toBe(3)   // every line, all open
    click(within(screen.getByRole('dialog', { name: 'No. 1' })).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // valuation shows the lines under a "Scope · No. 1" heading
    nav('vals')
    await screen.findByRole('heading', { name: 'Scope · No. 1' })
    expect(screen.getAllByRole('button', { name: /remove from valuation/i }).length).toBe(3)

    // clear unclaimed lines (to redo an import) keeps the claimed ones
    nav('scope')
    click(await screen.findByRole('button', { name: 'Scope options' }))
    click(screen.getByRole('button', { name: /clear unclaimed lines/i }))                        // on the tap, with Undo
    expect(await screen.findByText('4 unclaimed lines cleared')).toBeTruthy()
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^property /i }).length).toBe(0))   // only No. 1 left → single-property layout
    expect(screen.getByText('3 items')).toBeTruthy()

    // wrong spec: delete entire scope → certified lines survive, everything else goes
    nav('vals')
    click(await screen.findByRole('button', { name: /^send val i for £/i }))   // one deliberate tap: the figure is on the button
    await screen.findAllByText(/^With client · For review · sent today/)
    nav('scope')
    click(await screen.findByRole('button', { name: 'Scope options' })); click(screen.getByRole('button', { name: /^add a scope line/i }))
    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Wrong spec line' } })
    click(screen.getAllByRole('button', { name: 'Add line' }).at(-1)!)
    await screen.findByText('4 items')
    click(screen.getByRole('button', { name: 'Scope options' }))
    click(screen.getByRole('button', { name: /delete entire scope/i }))
    await screen.findByText(/delete 1 lines\? the 3 certified/i)
    click(screen.getByRole('button', { name: /yes, delete entire scope/i }))
    await screen.findByText('3 items')
    expect(screen.queryByText('Wrong spec line')).toBeNull()
  })
})
