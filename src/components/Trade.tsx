import { tradeCore } from '../lib/trade'

/** A trade's core: a small coloured band before its name (the name always says it; the band helps you find it). */
export function TradeMark({ name }: { name: string }) {
  return <span className={`core core-${tradeCore(name)}`} aria-hidden="true" />
}

/**
 * A property's trades on one line: every core first, bundled like a cable's, then the names in the same
 * order. When the names run out of room the bands still show every trade.
 */
export function TradeList({ names }: { names: string[] }) {
  return <><span className="core-bundle" aria-hidden="true">{names.map(n => <TradeMark key={n} name={n} />)}</span>{names.join(', ')}</>
}
