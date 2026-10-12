import { useEffect, useMemo, useState } from 'react'
import type { RateBook, RateItem } from '../lib/types'
import { rates } from '../lib/db'
import { bestBook, checkRates, patternText, type CheckLine, type CheckResult, type CheckRow } from '../lib/ratecheck'
import { money } from '../lib/format'
import { Sheet } from '../components/Ui'
import { Plate } from '../components/Sign'

export function useRateCheck(lines: CheckLine[], books: RateBook[]) {
  const [items, setItems] = useState<RateItem[] | null>(null)
  const [bookId, setBookId] = useState<string | null>(null)
  useEffect(() => { let live = true; if (books.length) rates.all().then(a => { if (live) setItems(a) }); return () => { live = false } }, [books.length])
  const book = useMemo(() => (items ? books.find(b => b.id === bookId) ?? bestBook(lines, books, items) : null), [items, bookId, books, lines])
  const result = useMemo(() => (items && book ? checkRates(lines, book, items) : null), [items, book, lines])
  return { result, book, setBookId, loading: !!books.length && !items }
}

/** One-line verdict, used on the BoQ import review and at the top of the check. */
export function RateVerdict({ r }: { r: CheckResult }) {
  const compared = r.counts.match + r.counts.pattern + r.counts.off + r.counts.differs
  if (!compared) return <Plate kind="wait">None of these codes are in {r.book?.name}</Plate>
  if (r.pattern) {
    return r.counts.off
      ? <Plate kind="warn">{r.counts.off} line{r.counts.off === 1 ? '' : 's'} don’t follow the {patternText(r.pattern)} pattern{r.below ? ` · ${money(r.below)} below it` : ''}</Plate>
      : <Plate kind="ok">All {compared} priced lines follow {patternText(r.pattern)}</Plate>
  }
  return <Plate kind="wait">Doesn’t follow {r.book?.name} — {r.counts.differs} of {compared} lines differ</Plate>
}

const line = (r: CheckRow) => (
  <div key={r.line.id} className="chk-row">
    <span className="mono">{r.line.code || '—'}</span>
    <span className="grow">{r.line.description}<small>
      {r.status === 'off' && <>BoQ {money(r.line.rate!)} · pattern {money(r.expected!)} · SoR {money(r.sor!.rate)} per {r.sor!.unit}</>}
      {r.status === 'differs' && <>BoQ {money(r.line.rate!)} · SoR {money(r.sor!.rate)} per {r.sor!.unit}</>}
      {r.status === 'unit' && <>BoQ per {r.line.unit || '—'} · SoR per {r.sor!.unit} ({money(r.sor!.rate)})</>}
      {r.status === 'missing' && <>Not in this schedule</>}
      {r.status === 'norate' && <>No rate in the BoQ · SoR {money(r.sor!.rate)} per {r.sor!.unit}</>}
    </small></span>
    {r.diff != null && <span className={'amt chk-diff' + (r.diff < 0 ? ' neg' : '')}>{r.diff < 0 ? '−' : '+'}{money(Math.abs(r.diff))}</span>}
  </div>
)

/** Scope → Check rates: the job's BoQ against one of the company's rate books. */
export function RateCheckSheet({ lines, books, onClose }: { lines: CheckLine[]; books: RateBook[]; onClose: () => void }) {
  const { result: r, book, setBookId, loading } = useRateCheck(lines, books)
  const [all, setAll] = useState(false)
  const group = (s: CheckRow['status']) => r?.rows.filter(x => x.status === s) ?? []
  const off = group('off').sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
  const differs = group('differs')
  return (
    <Sheet onClose={onClose} label="Check rates">
      <div className="stack">
        <div className="label bracket">Check rates against your SoR</div>
        {!books.length && <div className="empty">Import your schedule of rates first (jobs board → Schedule of rates).</div>}
        {loading && <div className="loading-bar" role="status" aria-label="Loading rates" />}
        {books.length > 1 && (
          <div className="chips" role="group" aria-label="Rate book">
            {books.map(b => <button key={b.id} className={'chip' + (book?.id === b.id ? ' on' : '')} onClick={() => setBookId(b.id)}>{b.name}</button>)}
          </div>
        )}
        {r && (
          <>
            <RateVerdict r={r} />
            <div className="panel stack">
              {r.pattern
                ? <div>{r.pattern.lines} lines are priced at <b>{patternText(r.pattern)}</b> — that’s this BoQ’s pattern against {book?.name}. Lines that don’t follow it are listed below; they’re worth querying with the client.</div>
                : <div>This BoQ doesn’t follow {book?.name} at one adjustment — it may be priced from an older SoR version or tendered rates. Nothing is called under- or over-priced; the differences are listed for you to judge.</div>}
              {r.boqTotal > 0 && <div className="muted" style={{ fontSize: 14 }}>Lines compared: <b className="amt">{money(r.boqTotal)}</b> at the BoQ’s rates, <b className="amt">{money(r.sorTotal)}</b> at {book?.name}.</div>}
            </div>

            {off.length > 0 && <><h2 className="sec-h">Don’t follow the pattern · {off.length}</h2><div className="panel chk">{off.map(line)}</div></>}
            {differs.length > 0 && (
              <>
                <h2 className="sec-h">Differ from the SoR · {differs.length}</h2>
                <div className="panel chk">{(all ? differs : differs.slice(0, 15)).map(line)}</div>
                {differs.length > 15 && !all && <button className="btn btn-ghost" onClick={() => setAll(true)}>Show all {differs.length}</button>}
              </>
            )}
            {group('unit').length > 0 && <><h2 className="sec-h">Unit differs · {group('unit').length}</h2><div className="panel chk">{group('unit').map(line)}</div></>}
            {group('missing').length > 0 && <><h2 className="sec-h">Not in {book?.name} · {group('missing').length}</h2><div className="panel chk">{group('missing').map(line)}</div></>}
            {group('norate').length > 0 && <><h2 className="sec-h">No rate in the BoQ · {group('norate').length}</h2><div className="panel chk">{group('norate').map(line)}</div></>}
            {r.counts.match + r.counts.pattern > 0 && <div className="muted" style={{ fontSize: 14 }}>{r.counts.match + r.counts.pattern} line{r.counts.match + r.counts.pattern === 1 ? '' : 's'} agree{r.counts.match + r.counts.pattern === 1 ? 's' : ''} — not listed.</div>}
          </>
        )}
      </div>
    </Sheet>
  )
}
