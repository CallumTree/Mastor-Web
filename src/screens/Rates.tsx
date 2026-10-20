import { useEffect, useMemo, useState } from 'react'
import type { RateBook, RateItem } from '../lib/types'
import { rates, uid } from '../lib/db'
import { coveredBy, readRateFile, searchRates, type RateDraft } from '../lib/rates'
import { money, ukDate } from '../lib/format'
import { ConfirmDelete, Sheet } from '../components/Ui'
import { Plate } from '../components/Sign'

/** Every rate line on this device, loaded once and refreshed when the books change. */
function useRates(books: RateBook[]) {
  const [all, setAll] = useState<RateItem[] | null>(null)
  const key = books.map(b => b.id).join()
  useEffect(() => { let live = true; rates.all().then(a => { if (live) setAll(a) }); return () => { live = false } }, [key])
  return all
}

/** One rate: code, short description, unit and price — tap to read the full description. */
function RateRow({ item, book, onUse, open, onToggle }: { item: RateItem; book?: RateBook; onUse?: () => void; open: boolean; onToggle: () => void }) {
  return (
    <div className={'rate' + (open ? ' open' : '')}>
      <button className="rate-head" aria-expanded={open} onClick={onToggle}>
        <span className="rate-code mono">{item.code}</span>
        <span className="rate-desc">{item.short}<small>{book?.name}</small></span>
        <span className="rate-amt amt">{money(item.rate)}<small>{item.unit}</small></span>
      </button>
      {open && (
        <div className="rate-body">
          {item.long && <p>{item.long}</p>}
          <div className="rate-meta">{[item.section, item.subsection, item.priority && `Priority ${item.priority}`].filter(Boolean).join(' · ')}</div>
          {book?.notes.map(n => <div key={n}><Plate kind="warn">{n}</Plate></div>)}
          {onUse && <button className="btn btn-primary" onClick={onUse}>Use this rate</button>}
        </div>
      )}
    </div>
  )
}

/** Search box + results across every rate book. */
export function RateSearch({ books, onUse, autoFocus }: { books: RateBook[]; onUse?: (i: RateItem, b?: RateBook) => void; autoFocus?: boolean }) {
  const all = useRates(books)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const found = useMemo(() => (all ? searchRates(all, q) : []), [all, q])
  const byId = new Map(books.map(b => [b.id, b]))
  return (
    <div className="stack">
      <label className="field" data-keep-clean><span>Search by code or words</span>
        <input type="search" value={q} autoFocus={autoFocus} placeholder="e.g. 0171AD or fencing 1.8m" onChange={e => { setQ(e.target.value); setOpen(null) }} />
      </label>
      {q.trim() && all && (
        found.length ? (
          <div className="rate-list" aria-label="Rates found">
            {found.map(i => { const k = i.bookId + i.code; return <RateRow key={k} item={i} book={byId.get(i.bookId)} open={open === k} onToggle={() => setOpen(open === k ? null : k)} onUse={onUse && (() => onUse(i, byId.get(i.bookId)))} /> })}
          </div>
        ) : <div className="empty">No rates match “{q.trim()}”.</div>
      )}
      {q.trim() && !all && <div className="loading-bar" role="status" aria-label="Loading rates" />}
    </div>
  )
}

/** Schedule of rates: search every book; import and remove books. */
export function RatesSheet({ books, onAddBooks, onRemoveBook, onClose }: {
  books: RateBook[]
  onAddBooks: (books: RateBook[], items: RateItem[][]) => Promise<void>
  onRemoveBook: (b: RateBook) => Promise<void>
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<(RateDraft & { id: string; include: boolean; dupOf?: string })[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const read = async (files: File[]) => {
    setErr(null); setBusy(`Reading ${files.length === 1 ? files[0].name : `${files.length} files`}…`)
    try {
      const out: (RateDraft & { id: string; include: boolean; dupOf?: string })[] = []
      for (const f of files) for (const d of await readRateFile(f, uid)) out.push({ ...d, id: d.items[0].bookId, include: true })
      if (!out.length) throw new Error('No rates found — the file needs a code column and a rate column.')
      // books already in the library, or repeated by another file here, aren't added twice
      const existing = await Promise.all(books.map(async b => ({ name: b.name, items: await rates.book(b.id) })))
      out.forEach((d, i) => {
        const dup = existing.find(e => coveredBy(d.items, e.items)) ?? out.slice(0, i).find(o => o.include && coveredBy(d.items, o.items))
        if (dup) { d.dupOf = dup.name; d.include = false }
      })
      setDrafts(out)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }
  const add = async () => {
    const chosen = (drafts ?? []).filter(d => d.include)
    setBusy('Saving rates…')
    await onAddBooks(chosen.map(d => ({ id: d.id, name: d.name.trim() || d.source, source: d.source, notes: d.notes, lines: d.items.length, importedAt: Date.now() })), chosen.map(d => d.items))
    setBusy(null); setDrafts(null)
  }

  return (
    <Sheet onClose={onClose} label="Schedule of rates" locked={!!busy}>
      <div className="stack">
        <div className="label bracket">Schedule of rates</div>
        {busy ? <div className="panel" role="status" style={{ textAlign: 'center', padding: 28 }}><div className="loading-bar" /><div style={{ fontWeight: 600, marginTop: 14 }}>{busy}</div></div>
        : drafts ? (
          <>
            <div className="muted t-note">Check what was read. Rates are taken exactly as printed — nothing is estimated.</div>
            {drafts.map((d, i) => (
              <div key={d.id} className="panel stack">
                <label className="check-row flush">
                  <input type="checkbox" checked={d.include}
                    onChange={() => setDrafts(drafts.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))} />
                  <span className="grow"><b>{d.items.length.toLocaleString('en-GB')} rates</b>{d.skipped > 0 && ` · ${d.skipped} without a readable rate left out`}<br /><small className="hint">{d.source}</small></span>
                </label>
                {d.dupOf && <div className="flag">Already in your library as “{d.dupOf}” — same codes, same rates.</div>}
                {d.include && <label className="field"><span>Book name</span><input value={d.name} onChange={e => setDrafts(drafts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>}
                {d.notes.map(n => <div key={n}><Plate kind="warn">{n}</Plate></div>)}
                <div className="rate-sample">{d.items.slice(0, 2).map(r => <div key={r.code}><span className="mono">{r.code}</span> {r.short} · <span className="amt">{money(r.rate)}</span> {r.unit}</div>)}</div>
              </div>
            ))}
            <div className="row">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDrafts(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!drafts.some(d => d.include)} onClick={add}>
                Add {drafts.filter(d => d.include).length} book{drafts.filter(d => d.include).length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        ) : (
          <>
            {books.length > 0 ? <RateSearch books={books} />
              : <div className="empty">No rate books yet. Import your framework schedule of rates (Word) or a rates spreadsheet, and every code can be priced from it.</div>}
            {err && <div className="flag" role="alert">{err}</div>}
            <label className="btn btn-primary" data-keep-clean>Import rates…
              <input type="file" className="sr-only" multiple accept=".docx,.xlsx,.xlsm,.xls,.csv" onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) void read(f) }} />
            </label>
            {books.length > 0 && (
              <>
                <h2 className="sec-h">Your rate books · {books.length}</h2>
                <div className="panel flush">
                  {books.map(b => (
                    <div key={b.id} className="book">
                      <div className="grow"><b>{b.name}</b><small>{b.lines.toLocaleString('en-GB')} rates · added {ukDate(b.importedAt)}<br />{b.source}</small></div>
                      <ConfirmDelete label="Remove…" confirmLabel="Remove book" note="Jobs already priced keep their rates." onConfirm={() => { void onRemoveBook(b) }} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

/**
 * Under an SoR code field: the rate(s) that code has in your books, with a button to use one.
 * Also lets you find a rate by its description. Never fills anything without a tap.
 */
export function RateLookup({ code, books, onUse }: { code: string; books: RateBook[]; onUse: (i: RateItem, b?: RateBook) => void }) {
  const [hits, setHits] = useState<RateItem[]>([])
  const [finding, setFinding] = useState(false)
  const c = code.trim().toUpperCase()
  useEffect(() => { let live = true; if (c.length >= 4 && books.length) rates.byCode(c).then(h => { if (live) setHits(h) }); else setHits([]); return () => { live = false } }, [c, books.length])
  if (!books.length) return null
  const byId = new Map(books.map(b => [b.id, b]))
  const shown = hits.filter(h => byId.has(h.bookId))
  return (
    <div className="lookup">
      {shown.map(h => {
        const b = byId.get(h.bookId)
        return (
          <div key={h.bookId} className="lookup-hit">
            <div className="grow"><b>{h.short}</b><small>{b?.name} · <span className="amt">{money(h.rate)}</span> per {h.unit}</small>
              {b?.notes.map(n => <div key={n} style={{ marginTop: 4 }}><Plate kind="warn">{n}</Plate></div>)}</div>
            <button type="button" className="btn btn-primary" onClick={() => onUse(h, b)}>Use {money(h.rate)}</button>
          </div>
        )
      })}
      {c.length >= 4 && !shown.length && <div className="lookup-miss">{c} isn’t in your rate books.</div>}
      {finding ? <RateSearch books={books} autoFocus onUse={(i, b) => { setFinding(false); onUse(i, b) }} />
        : <button type="button" className="linkish tap" onClick={() => setFinding(true)}>Find a rate by description</button>}
    </div>
  )
}
