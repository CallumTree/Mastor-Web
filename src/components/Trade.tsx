import { createContext, useContext } from 'react'
import { tradeCore, type Core } from '../lib/trade'

/** The open job's trades and their cores (lib/trade jobCores), so a job never shows two trades in one colour. Outside
 *  a job (a pack being imported) each trade takes its own core. */
export const TradeCores = createContext<Map<string, Core> | null>(null)
export const useCore = () => { const cores = useContext(TradeCores); return (name: string) => cores?.get(name) ?? tradeCore(name) }

/** A trade's core: a small coloured band before its name (the name always says it; the band helps you find it). */
export function TradeMark({ name }: { name: string }) {
  const core = useCore()
  return <span className={`core core-${core(name)}`} aria-hidden="true" />
}

/**
 * A property's trades on one line: every core first, bundled like a cable's, then the names in the same
 * order. When the names run out of room the bands still show every trade.
 */
export function TradeList({ names }: { names: string[] }) {
  return <><span className="core-bundle" aria-hidden="true">{names.map(n => <TradeMark key={n} name={n} />)}</span>{names.join(', ')}</>
}
